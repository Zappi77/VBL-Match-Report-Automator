import { GoogleGenAI, Type } from "@google/genai";
import {
  KNOWN_TEAMS,
  KNOWN_LOCATIONS,
  KNOWN_PLAYERS,
  SEASON_MATCHES,
  type MatchReference,
} from "../data/vblData";
import { db, auth } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";

// ─────────────────────────────────────────────
// Konstanten
// ─────────────────────────────────────────────
const MODEL_FAST = "gemini-3-flash-preview";
const MODEL_SMART = "gemini-3.1-pro-preview";

const YOUTUBE_PLAYLIST_URL =
  "https://www.youtube.com/watch?v=-FkRIwJ7_KI&list=PLKvhsxfxEhVcbdeGhYZfXAPpB8UFaFWrp";

const TEAM_MATCHES_URL = (teamId: string) =>
  `https://www.volleyball-bundesliga.de/cms/home/2_bundesliga_frauen/2_bundesliga_frauen_pro/mannschaften.xhtml?c.teamId=${teamId}&c.view=matches#samsCmsComponent_766577326`;

const LEAGUE_SCHEDULE_URL = 
  "https://www.volleyball-bundesliga.de/cms/home/2_bundesliga_frauen/2_bundesliga_frauen_pro/spielplan.xhtml";

const VBL_MATCH_URL = (matchId: string) =>
  `https://www.volleyball-bundesliga.de/popup/matchSeries/matchDetails.xhtml?matchId=${matchId}&hideHistoryBackButton=true`;

const STATS_URL = (matchNumber: string) =>
  `https://live.volleyball-bundesliga.de/2025-26/Women/${matchNumber}.pdf`;

const SAMS_URL = (uuid: string, matchNumber: string) =>
  `https://distributor.sams-score.de/scoresheet/pdf/${uuid}/${matchNumber}`;

const LOCATION_URL = (locationId: string) =>
  `https://www.volleyball-bundesliga.de/popup/location/locationDetails.xhtml?locationId=${locationId}&showVolleyballFields=true`;

const TEAM_URL = (teamId: string) =>
  `https://www.volleyball-bundesliga.de/cms/home/2_bundesliga_frauen/2_bundesliga_frauen_pro/mannschaften.xhtml?c.teamId=${teamId}&c.view=teamMain#samsCmsComponent_766577326`;

const PLAYER_URL = (teamId: string, userId: string) =>
  `https://www.volleyball-bundesliga.de/popup/teamMember/teamMemberDetails.xhtml?teamId=${teamId}&userId=${userId}`;

// ─────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const isNA = (val: unknown): boolean =>
  !val ||
  ["n/a", "unknown", "0", "", "unbekannt", "heim", "gast", "team a", "team b"].includes(
    String(val).trim().toLowerCase()
  );

const isValidMatchId = (val: unknown, matchNumber: string): boolean => {
  const s = String(val || "").trim();
  // matchId darf keine bekannte teamId sein
  if (Object.values(KNOWN_TEAMS).includes(s)) {
    console.warn(`Rejected matchId ${s} because it is a known teamId.`);
    return false;
  }
  // matchId muss mindestens 8 Stellen haben, darf nicht die Spielnummer sein
  // und sollte idealerweise mit 777 oder 776 beginnen (VBL Standard)
  const validFormat = s.length >= 8 && s !== matchNumber && /^\d+$/.test(s) && (s.startsWith("777") || s.startsWith("776"));
  
  // Halluzinations-Check: Wenn die matchId auf die Spielnummer endet, ist sie SEHR verdächtig
  // (VBL matchIds sind meist fortlaufend, aber enden selten exakt auf die Spielnummer)
  if (validFormat && s.endsWith(matchNumber)) {
    console.warn(`Suspicious matchId ${s} ends with matchNumber ${matchNumber}. Rejecting to avoid hallucination.`);
    return false;
  }

  if (!validFormat && s.length > 0) {
    console.warn(`Rejected matchId ${s} (matchNumber: ${matchNumber}) - format invalid.`);
  }
  return validFormat;
};

const isUUID = (val: unknown): boolean =>
  typeof val === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    val.trim()
  );

const extractUUID = (val: unknown): string => {
  if (!val) return "";
  const s = String(val);
  const urlMatch = s.match(
    /\/pdf\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (urlMatch) return urlMatch[1];
  const uuidMatch = s.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  return uuidMatch ? uuidMatch[0] : "";
};

const extractUserId = (val: unknown): string => {
  if (!val) return "";
  const s = String(val);
  const match = s.match(/userId=(\d+)/);
  return match ? match[1] : s.replace(/\D/g, "");
};

// ─────────────────────────────────────────────
// Firestore Fehlerbehandlung
// ─────────────────────────────────────────────
function logFirestoreError(error: unknown, operation: string, path: string) {
  console.error(`Firestore [${operation}] at ${path}:`, error);
}

// ─────────────────────────────────────────────
// Cache (Session-Memory)
// ─────────────────────────────────────────────
export const matchCache: Record<string, string> = {};

// ─────────────────────────────────────────────
// PHASE 1: matchId auflösen (isoliert & fokussiert)
// ─────────────────────────────────────────────
async function resolveMatchId(
  matchNumber: string,
  homeTeamId: string,
  onStatusUpdate?: (s: string) => void,
  selectedTeamId?: string
): Promise<string | null> {
  onStatusUpdate?.(`Suche matchId für Spiel #${matchNumber}...`);

  const searchUrls = [LEAGUE_SCHEDULE_URL];
  if (selectedTeamId) {
    searchUrls.unshift(TEAM_MATCHES_URL(selectedTeamId));
  }

  const prompt = `
    AUFGABE: Finde die matchId für das VBL Volleyball Spiel Nummer ${matchNumber} (Saison 2025/26).
    
    SUCHE AUF DIESEN SEITEN:
    ${searchUrls.map((url, i) => `${i + 1}. ${url}`).join("\n")}
    
    ANWEISUNG:
    1. Suche in den Tabellen nach der Spielnummer ${matchNumber}.
    2. Die matchId steht im Link zum Info-Icon "i" oder zur Detailseite (matchDetails.xhtml?matchId=XXXXXXXXX).
    3. Die matchId ist eine 9-stellige Zahl (beginnt meist mit 777).
    
    WICHTIG:
    - Die matchId ist NICHT die Spielnummer ${matchNumber}.
    - Falls du die ID auf der ersten Seite findest, brich ab und gib sie zurück.
    - Falls nicht gefunden, suche auf der nächsten Seite.
    
    Antworte NUR mit der matchId als Zahl. Falls absolut nicht gefunden, antworte "not_found".
  `;

  try {
    onStatusUpdate?.("Analysiere VBL-Seiten parallel...");
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        tools: [{ urlContext: {} }],
      },
    });

    const text = (response.text || "").trim();
    const match = text.match(/\b(\d{8,10})\b/);
    
    if (match && isValidMatchId(match[0], matchNumber)) {
      onStatusUpdate?.(`matchId gefunden: ${match[0]}`);
      return match[0];
    }

    // Fallback: Google Search nur wenn urlContext nichts liefert
    onStatusUpdate?.("VBL-Direktsuche erfolglos. Starte Google-Suche...");
    const searchPrompt = `
      Suche nach der matchId für "VBL Volleyball Spiel ${matchNumber} 2025/26".
      Die matchId ist 9-stellig und steht in der URL hinter matchId=.
      Antworte NUR mit der ID.
    `;

    const searchResponse = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const searchText = (searchResponse.text || "").trim();
    const searchMatch = searchText.match(/\b(\d{8,10})\b/);
    if (searchMatch && isValidMatchId(searchMatch[0], matchNumber)) {
      onStatusUpdate?.(`matchId via Google gefunden: ${searchMatch[0]}`);
      return searchMatch[0];
    }

  } catch (e) {
    console.error("resolveMatchId failed:", e);
  }

  onStatusUpdate?.("matchId konnte nicht aufgelöst werden.");
  return null;
}

// ─────────────────────────────────────────────
// Firestore: Report lesen/schreiben
// ─────────────────────────────────────────────
async function getCachedReport(matchNumber: string): Promise<string | null> {
  if (matchCache[matchNumber]) return matchCache[matchNumber];
  try {
    const snap = await getDoc(doc(db, "reports", matchNumber));
    if (snap.exists()) {
      const content = snap.data().content;
      matchCache[matchNumber] = content;
      return content;
    }
  } catch (e) {
    logFirestoreError(e, "GET", `reports/${matchNumber}`);
  }
  return null;
}

export async function saveReport(matchNumber: string, content: string) {
  matchCache[matchNumber] = content;
  if (!auth.currentUser) return;
  
  await setDoc(doc(db, "reports", matchNumber), {
    matchNumber,
    content,
    generatedAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────
// Firestore: Match-Daten lesen
// ─────────────────────────────────────────────
async function getMatchData(
  matchNumber: string
): Promise<Partial<MatchReference>> {
  const staticData: Partial<MatchReference> = SEASON_MATCHES[matchNumber] || {};
  try {
    const snap = await getDoc(doc(db, "matches", matchNumber));
    if (snap.exists()) {
      const dbData = snap.data() as Partial<MatchReference>;

      // Ungültige matchId aus DB ignorieren
      if (!isValidMatchId(dbData.matchId, matchNumber)) {
        console.warn(
          `Ungültige matchId in DB (${dbData.matchId}) für #${matchNumber} – ignoriert.`
        );
        dbData.matchId = undefined;
      }

      // Merge: DB überschreibt Static, aber nur wenn nicht leer
      const merged: Partial<MatchReference> = { ...staticData, fromDb: true };
      (Object.keys(dbData) as (keyof MatchReference)[]).forEach((key) => {
        if (!isNA(dbData[key])) {
          (merged as Record<string, unknown>)[key] = dbData[key];
        }
      });
      return merged;
    }
  } catch (e) {
    logFirestoreError(e, "GET", `matches/${matchNumber}`);
  }
  return staticData;
}

// ─────────────────────────────────────────────
// JSON Schema für Gemini
// ─────────────────────────────────────────────
const matchSchema = {
  type: Type.OBJECT,
  properties: {
    matchNumber:    { type: Type.STRING },
    weekday:        { type: Type.STRING },
    date:           { type: Type.STRING },
    time:           { type: Type.STRING },
    homeTeam:       { type: Type.STRING },
    awayTeam:       { type: Type.STRING },
    homeTeamId:     { type: Type.STRING },
    awayTeamId:     { type: Type.STRING },
    resultSets:     { type: Type.STRING },
    totalPoints:    { type: Type.STRING },
    setPoints:      { type: Type.STRING },
    matchDuration:  { type: Type.STRING },
    matchId:        { type: Type.STRING },
    venueName:      { type: Type.STRING },
    locationId:     { type: Type.STRING },
    samsScoreUuid:  { type: Type.STRING },
    mvpHomeName:    { type: Type.STRING },
    mvpHomeUserId:  { type: Type.STRING },
    mvpAwayName:    { type: Type.STRING },
    mvpAwayUserId:  { type: Type.STRING },
    spectators:     { type: Type.STRING },
    youtubeUrl:     { type: Type.STRING },
    logs: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Fortschritts-Logs für den Nutzer",
    },
  },
  required: ["matchNumber", "homeTeam", "awayTeam"],
};

// ─────────────────────────────────────────────
// PHASE 2: Hauptdaten extrahieren
// ─────────────────────────────────────────────
async function extractMatchData(
  matchNumber: string,
  matchId: string,
  knownData: Partial<MatchReference>,
  forceRefresh: boolean,
  onStatusUpdate?: (s: string) => void
): Promise<Record<string, unknown>> {
  const mainUrl = VBL_MATCH_URL(matchId);
  onStatusUpdate?.(`Rufe Spielseite auf: ${mainUrl}`);

  const prompt = `
    KONTEXT: Sparda 2. Liga Pro Frauen, Saison 2025/26
    SPIELNUMMER: ${matchNumber}
    MATCH-ID: ${matchId} (9-stellig – NICHT die Spielnummer!)
    HAUPT-URL: ${mainUrl}
    
    BEKANNTE DATEN AUS DATENBANK:
    ${JSON.stringify(knownData, null, 2)}
    ${forceRefresh ? "\nACHTUNG: Force-Refresh! Ignoriere DB-Werte für Zuschauer/MVPs – nur Webseite zählt." : ""}
    
    AUFGABE – Extrahiere von der Haupt-URL:
    
    WICHTIG: Nutze das Tool 'urlContext' um die Seite ${mainUrl} zu lesen.
    Falls die Seite nicht direkt geladen werden kann, nutze 'googleSearch' um nach "VBL Spiel ${matchNumber} ${knownData.homeTeam || ""} vs ${knownData.awayTeam || ""}" zu suchen.
    
    1. SPIELERGEBNIS (Zeile 2):
       - Heimteam, Gastteam, Satzstand (z.B. 3:0), Gesamtpunkte (z.B. 75:58), Satzpunkte (z.B. 25:18, 25:19, 25:21)
       - WICHTIG: Die Gesamtpunkte (totalPoints) sind die Summe aller Punkte beider Teams über alle Sätze hinweg.
       - Falls die Teams nicht explizit genannt werden, nutze Google Search.
    
    2. SPIELDAUER (Zeile 3):
       - HTML: <div class="samsContentBoxHeader">Statistiken</div>
       - Format: "68 Min. (22, 22, 24)"
       - WICHTIG: Lies die Zahlen EXAKT aus der Tabelle unter "Statistiken".
    
    3. ZUSCHAUER (Zeile 4):
       - Selbe Statistiken-Box
       - NUR tatsächlich Anwesende, NICHT Kapazität
    
    4. SPIELORT + locationId (Zeile 5):
       - Name der Halle (z.B. "Sporthalle Berg Fidel")
       - locationId aus dem Link DIREKT neben dem Hallennamen: locationDetails.xhtml?locationId=XXXXXXX
       - WICHTIG: Die locationId ist meist 5- bis 8-stellig (z.B. 12233 oder 70012456).
    
    5. SAMS Score UUID (Zeile 6):
       - Link DIREKT unter der Spieldauer-Zeile (meist ein PDF-Icon oder Link "Spielbericht")
       - Format: https://distributor.sams-score.de/scoresheet/pdf/{UUID}/{matchNumber}
       - Extrahiere NUR die UUID (36 Zeichen, Hexadezimal mit Bindestrichen)
    
    6. MVPs (Zeilen 8+9):
       - HTML: <div class="samsContentBoxHeader">Most Valuable Player</div>
       - Name UND userId (aus Link: teamMemberDetails.xhtml?teamId=X&userId=Y)
       - WICHTIG: Nimm NUR die MVPs dieses Spiels (${matchNumber}). Ignoriere MVPs von anderen Spielen ("Nächstes Spiel" / "Letztes Spiel").
       - Die userId ist meist 5- bis 7-stellig (z.B. 123456). Sie beginnt NICHT mit 777 (das sind matchIds).
       - Falls nicht vorhanden: leerer String.
    
    7. TEAM-IDs (homeTeamId, awayTeamId):
       - Aus Links zu Mannschaftsseiten (meist oben beim Ergebnis): c.teamId=XXXXXXXXX
       - WICHTIG: Verifiziere, dass die teamId zum jeweiligen Teamnamen passt. Nimm NICHT die IDs von anderen Spielen auf der Seite.
       - Die teamId ist meist 9-stellig (z.B. 776308823). Sie beginnt meist mit 776.
    
    8. YOUTUBE Re-Live (Zeile 10):
       ${knownData.youtubeUrl && !forceRefresh
         ? `Nutze aus DB: ${knownData.youtubeUrl}`
         : `Suche in Playlist: ${YOUTUBE_PLAYLIST_URL}
            Der Video-Titel MUSS die Spielnummer ${matchNumber} ODER beide Teamnamen (${knownData.homeTeam || ""} vs ${knownData.awayTeam || ""}) enthalten.
            Fallback: Suche auf YouTube nach "VBL Volleyball Spiel ${matchNumber} 2025/26"`
       }
    
    WICHTIGE REGELN:
    - matchId ist ${matchId} – gib EXAKT diesen Wert zurück.
    - Falls auf der Seite eine ANDERE matchId steht (z.B. bei "Nächstes Spiel"), IGNORIERE diese.
    - matchId darf NIEMALS die Spielnummer ${matchNumber} sein.
    - Alle IDs (locationId, userId, teamId) müssen EXAKT aus den Links der Seite extrahiert werden.
    - Falls ein Link nicht eindeutig ist, nutze Google Search zur Verifizierung.
    - Wenn UUID nicht gefunden: leerer String (kein Platzhalter)
    - Bei userId: NUR die Zahl, keine URL
    - Logs: Schreibe für jeden gefundenen Wert einen Eintrag (z.B. "Zuschauer gefunden: 150")
    - Falls Daten auf der Seite fehlen (z.B. Spiel noch nicht stattgefunden), nutze leere Strings.
    
    REFERENZDATEN:
    Teams: ${JSON.stringify(KNOWN_TEAMS)}
    Locations: ${JSON.stringify(KNOWN_LOCATIONS)}
    Players: ${JSON.stringify(KNOWN_PLAYERS)}
  `;

  console.log("Extracting data for matchId:", matchId, "URL:", mainUrl);
  onStatusUpdate?.(`Analysiere Spieldaten für #${matchNumber}...`);

  const stream = await ai.models.generateContentStream({
    model: MODEL_FAST,
    contents: prompt,
    config: {
      tools: [{ urlContext: {} }, { googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true },
      responseMimeType: "application/json",
      responseSchema: matchSchema,
      systemInstruction:
        "Du bist ein präziser Daten-Extraktor für Volleyball-Spielberichte. Antworte ausschließlich mit validem JSON gemäß Schema. Leere Felder = leerer String. Nutze die Tools (urlContext, googleSearch) um die Daten zu verifizieren.",
    },
  });

  let fullText = "";
  let lastLogCount = 0;

  for await (const chunk of stream) {
    if (chunk.candidates?.[0]?.finishReason === "SAFETY") {
      throw new Error("KI-Sicherheitsblockade.");
    }
    if (chunk.text) fullText += chunk.text;

    // Live-Logs aus Partial-JSON
    try {
      const logsMatch = fullText.match(/"logs":\s*\[([\s\S]*?)\]/);
      if (logsMatch) {
        const logs = logsMatch[1]
          .split(",")
          .map((s) => s.trim().replace(/^"|"$/g, ""))
          .filter((s) => s.length > 2);
        for (let i = lastLogCount; i < logs.length; i++) {
          onStatusUpdate?.(logs[i]);
        }
        lastLogCount = logs.length;
      }
    } catch {
      // Partial-JSON Fehler ignorieren
    }
  }

  if (!fullText.trim()) {
    console.error("Gemini returned empty response for matchId:", matchId);
    throw new Error("Keine Antwort von Gemini.");
  }

  console.log("Gemini Raw Response (Match Data):", fullText);

  // Robustes JSON-Parsing
  const first = fullText.indexOf("{");
  const last = fullText.lastIndexOf("}");
  const jsonStr =
    first !== -1 && last > first
      ? fullText.substring(first, last + 1)
      : fullText;

  return JSON.parse(jsonStr);
}

// ─────────────────────────────────────────────
// Einzelnen Eintrag löschen
// ─────────────────────────────────────────────
export async function deleteMatchEntry(matchNumber: string): Promise<void> {
  if (!auth.currentUser) throw new Error("Nicht autorisiert.");
  await deleteDoc(doc(db, "matches", matchNumber));
  await deleteDoc(doc(db, "reports", matchNumber));
}
export function buildReport(
  data: Record<string, unknown>,
  matchNumber: string
): string {
  const homeTeamUrl = data.homeTeamId ? TEAM_URL(String(data.homeTeamId)) : "#";
  const awayTeamUrl = data.awayTeamId ? TEAM_URL(String(data.awayTeamId)) : "#";

  const mvpHomeUrl =
    data.homeTeamId && data.mvpHomeUserId && !isNA(data.mvpHomeUserId)
      ? PLAYER_URL(String(data.homeTeamId), String(data.mvpHomeUserId))
      : "#";

  const mvpAwayUrl =
    data.awayTeamId && data.mvpAwayUserId && !isNA(data.mvpAwayUserId)
      ? PLAYER_URL(String(data.awayTeamId), String(data.mvpAwayUserId))
      : "#";

  const matchUrl = data.matchId ? VBL_MATCH_URL(String(data.matchId)) : "#";
  const locationUrl = data.locationId
    ? LOCATION_URL(String(data.locationId))
    : "#";
  const samsUrl =
    isUUID(data.samsScoreUuid)
      ? SAMS_URL(String(data.samsScoreUuid), matchNumber)
      : "#";

  const setPointsFormatted = data.setPoints
    ? String(data.setPoints).trim().startsWith("(")
      ? String(data.setPoints).trim()
      : `(${String(data.setPoints).trim()})`
    : "";

  const lines = [
    `##### Spiel #${matchNumber}, ${data.weekday || ""} ${data.date || ""} um ${data.time || ""} Uhr`,
    `[${data.homeTeam || "Heim"} vs. ${data.awayTeam || "Gast"} … ${data.resultSets || ""} / ${data.totalPoints || ""} ${setPointsFormatted}](${matchUrl})`,
    `Spieldauer: ${data.matchDuration || ""}`,
    `Zuschauer: ${data.spectators || ""}`,
    `Spielort: [${data.venueName || "Unbekannt"}](${locationUrl})`,
    `[Offizieller Spielbericht (VBL)](${samsUrl})`,
    `[Offizielle Spielstatistik (VBL)](${STATS_URL(matchNumber)})`,
    `MVP [${data.homeTeam || "Heim"}](${homeTeamUrl}): [${data.mvpHomeName || "Unbekannt"}](${mvpHomeUrl})`,
    `MVP [${data.awayTeam || "Gast"}](${awayTeamUrl}): [${data.mvpAwayName || "Unbekannt"}](${mvpAwayUrl})`,
    `[Re-Live DYN Volleyball YouTube (kostenfrei)](${data.youtubeUrl || YOUTUBE_PLAYLIST_URL})`,
  ];

  return lines.join("\n\n");
}

/**
 * PHASE 1 & 2: Daten abrufen und extrahieren (ohne Speichern)
 */
export async function fetchMatchDataFull(
  matchNumber: string,
  onStatusUpdate?: (status: string) => void,
  forceRefresh = false,
  selectedTeamId?: string,
  manualMatchId?: string
): Promise<MatchReference> {
  // Eingabe validieren
  if (!matchNumber || isNaN(Number(matchNumber))) {
    throw new Error("Fehler: Bitte eine gültige Spielnummer eingeben (z.B. 3150).");
  }

  // Bekannte Daten laden
  onStatusUpdate?.("Prüfe Master-Datenbank...");
  let knownData = await getMatchData(matchNumber);
  
  if (knownData.fromDb) {
    onStatusUpdate?.("✓ Spiel in Master-Datenbank gefunden.");
  } else if (SEASON_MATCHES[matchNumber]) {
    onStatusUpdate?.("✓ Spiel in Saison-Stammdaten gefunden.");
  } else {
    onStatusUpdate?.("Spiel unbekannt – starte Initialisierung...");
  }

  // ── PHASE 1: matchId auflösen ──────────────
  let resolvedId = manualMatchId || "";
  const needsResolution = !manualMatchId && (forceRefresh || !isValidMatchId(knownData.matchId, matchNumber));
  
  if (needsResolution) {
    onStatusUpdate?.(forceRefresh ? "Force-Refresh: Re-resolving matchId..." : "matchId fehlt – starte Auflösung...");

    // homeTeamId ermitteln (aus DB oder KNOWN_TEAMS)
    const homeTeamId =
      knownData.homeTeamId ||
      (knownData.homeTeam ? KNOWN_TEAMS[knownData.homeTeam] : null) ||
      Object.values(KNOWN_TEAMS)[0];

    resolvedId = (await resolveMatchId(
      matchNumber,
      homeTeamId,
      onStatusUpdate,
      selectedTeamId
    )) || "";

    if (resolvedId) {
      knownData = { ...knownData, matchId: resolvedId };
    } else {
      onStatusUpdate?.("⚠️ matchId konnte nicht aufgelöst werden.");
      throw new Error("matchId für dieses Spiel nicht gefunden. Bitte Spielnummer prüfen.");
    }
  } else if (manualMatchId) {
    onStatusUpdate?.(`Manuelle matchId verwendet: ${manualMatchId}`);
    knownData = { ...knownData, matchId: manualMatchId };
  } else {
    onStatusUpdate?.(`matchId bekannt: ${knownData.matchId}`);
  }

  // ── PHASE 2: Hauptdaten extrahieren ────────
  let rawData: Record<string, any>;

  // Falls Daten bereits in DB/Static vorhanden sind und kein Refresh erzwungen wird:
  // Wir prüfen, ob wir bereits ein Ergebnis (resultSets) haben.
  const isDataComplete = !isNA(knownData.resultSets) && !isNA(knownData.setPoints);
  
  if (!forceRefresh && isDataComplete) {
    onStatusUpdate?.("Daten bereits in Master-Datenbank vorhanden. Überspringe KI-Extraktion.");
    rawData = { ...knownData, fromDb: true };
  } else {
    onStatusUpdate?.("Extrahiere Spieldaten...");
    try {
      rawData = await extractMatchData(
        matchNumber,
        String(knownData.matchId),
        knownData,
        forceRefresh,
        onStatusUpdate
      );
    } catch (e) {
      console.error("extractMatchData failed:", e);
      throw new Error(`Fehler bei der Datenextraktion: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Post-Processing ─────────────────────────
  rawData.matchNumber = matchNumber;
  rawData.matchId = String(knownData.matchId);

  // Bekannte Werte aus Stammdaten (SEASON_MATCHES) haben Vorrang
  const staticData = SEASON_MATCHES[matchNumber];
  if (staticData) {
    if (!isNA(staticData.homeTeam)) rawData.homeTeam = staticData.homeTeam;
    if (!isNA(staticData.homeTeamId)) rawData.homeTeamId = staticData.homeTeamId;
    if (!isNA(staticData.awayTeam)) rawData.awayTeam = staticData.awayTeam;
    if (!isNA(staticData.awayTeamId)) rawData.awayTeamId = staticData.awayTeamId;
    if (!isNA(staticData.venueName)) rawData.venueName = staticData.venueName;
    if (!isNA(staticData.locationId)) rawData.locationId = staticData.locationId;
  }

  // Bei normalem Modus: DB-Werte bevorzugen (falls nicht N/A)
  if (!forceRefresh) {
    let hasDbValues = false;
    const prefer = (field: keyof MatchReference) => {
      if (!isNA(knownData[field])) {
        rawData[field] = knownData[field] as any;
        hasDbValues = true;
      }
    };
    prefer("homeTeam"); prefer("homeTeamId");
    prefer("awayTeam"); prefer("awayTeamId");
    prefer("venueName"); prefer("locationId");
    prefer("matchDuration"); prefer("setPoints"); prefer("resultSets");
    prefer("totalPoints");
    prefer("youtubeUrl"); prefer("samsScoreUuid"); prefer("date");
    prefer("time"); prefer("weekday"); prefer("spectators");
    prefer("mvpHomeName"); prefer("mvpHomeUserId");
    prefer("mvpAwayName"); prefer("mvpAwayUserId");
    
    if (hasDbValues) {
      rawData.fromDb = true;
    }
  }

  // Statische Daten als letzter Fallback
  if (staticData) {
    const fallback = (field: keyof MatchReference) => {
      if (isNA(rawData[field])) rawData[field] = staticData[field] || "";
    };
    fallback("spectators"); fallback("matchDuration");
    fallback("setPoints"); fallback("resultSets"); fallback("totalPoints");
  }

  // UUID bereinigen
  if (!isNA(rawData.samsScoreUuid)) {
    rawData.samsScoreUuid = extractUUID(rawData.samsScoreUuid);
  }
  if (!isUUID(rawData.samsScoreUuid)) {
    rawData.samsScoreUuid = "";
  }

  // userIds bereinigen
  if (!isNA(rawData.mvpHomeUserId))
    rawData.mvpHomeUserId = extractUserId(rawData.mvpHomeUserId);
  if (!isNA(rawData.mvpAwayUserId))
    rawData.mvpAwayUserId = extractUserId(rawData.mvpAwayUserId);

  // KNOWN_PLAYERS abgleichen
  const checkPlayer = (
    nameKey: string,
    userIdKey: string,
    teamIdKey: string
  ) => {
    const name = String(rawData[nameKey] || "").trim();
    if (name && KNOWN_PLAYERS[name]) {
      rawData[userIdKey] = KNOWN_PLAYERS[name].userId;
      rawData[teamIdKey] = KNOWN_PLAYERS[name].teamId;
    }
  };
  checkPlayer("mvpHomeName", "mvpHomeUserId", "homeTeamId");
  checkPlayer("mvpAwayName", "mvpAwayUserId", "awayTeamId");

  // KNOWN_TEAMS abgleichen
  if (!rawData.homeTeamId && rawData.homeTeam)
    rawData.homeTeamId = KNOWN_TEAMS[String(rawData.homeTeam)] || "";
  if (!rawData.awayTeamId && rawData.awayTeam)
    rawData.awayTeamId = KNOWN_TEAMS[String(rawData.awayTeam)] || "";

  // KNOWN_LOCATIONS abgleichen
  if (!rawData.locationId && rawData.venueName) {
    rawData.locationId = KNOWN_LOCATIONS[String(rawData.venueName)] || "";
  }

  return rawData as MatchReference;
}

/**
 * Daten in Firestore speichern
 */
export async function saveMatchData(
  matchNumber: string,
  data: MatchReference
): Promise<void> {
  if (!auth.currentUser) throw new Error("Nicht authentifiziert.");
  
  // matchId validieren VOR dem Speichern
  if (!isValidMatchId(data.matchId, matchNumber)) {
    console.warn(`Ungültige matchId (${data.matchId}) – wird nicht gespeichert.`);
    data.matchId = "";
  }

  const clean: Record<string, string> = {};
  const fields = [
    "matchNumber","matchId","homeTeam","homeTeamId","awayTeam","awayTeamId",
    "venueName","locationId","date","time","weekday","spectators",
    "matchDuration","setPoints","resultSets","totalPoints","samsScoreUuid","youtubeUrl",
    "mvpHomeName","mvpHomeUserId","mvpAwayName","mvpAwayUserId",
  ];

  fields.forEach((f) => {
    const val = String((data as any)[f] || "");
    clean[f] = isNA(val) ? "" : val;
  });

  await setDoc(
    doc(db, "matches", matchNumber),
    { ...clean, updatedAt: new Date().toISOString() },
    { merge: true }
  );

  // Teams speichern
  if (clean.homeTeamId && clean.homeTeam) {
    await setDoc(
      doc(db, "teams", clean.homeTeamId),
      { name: clean.homeTeam, teamId: clean.homeTeamId },
      { merge: true }
    );
  }
  if (clean.awayTeamId && clean.awayTeam) {
    await setDoc(
      doc(db, "teams", clean.awayTeamId),
      { name: clean.awayTeam, teamId: clean.awayTeamId },
      { merge: true }
    );
  }

  // MVPs speichern
  const savePlayer = async (
    name: string,
    userId: string,
    teamId: string
  ) => {
    if (!name || !userId || isNA(name) || isNA(userId)) return;
    const playerId = name.replace(/\//g, "-");
    await setDoc(
      doc(db, "players", playerId),
      { name, userId, teamId },
      { merge: true }
    );
  };

  await savePlayer(clean.mvpHomeName, clean.mvpHomeUserId, clean.homeTeamId);
  await savePlayer(clean.mvpAwayName, clean.mvpAwayUserId, clean.awayTeamId);
  
  // Cache leeren
  delete matchCache[matchNumber];
}

export async function getMatchReport(
  matchNumber: string,
  onStatusUpdate?: (status: string) => void,
  forceRefresh = false,
  selectedTeamId?: string
): Promise<string> {
  // Eingabe validieren
  if (!matchNumber || isNaN(Number(matchNumber))) {
    return "Fehler: Bitte eine gültige Spielnummer eingeben (z.B. 3150).";
  }

  // Cache prüfen
  if (!forceRefresh) {
    const cached = await getCachedReport(matchNumber);
    if (cached) {
      onStatusUpdate?.("Daten aus Cache geladen.");
      return cached;
    }
  }

  try {
    const data = await fetchMatchDataFull(matchNumber, onStatusUpdate, forceRefresh, selectedTeamId);
    
    // Automatisches Speichern (für Abwärtskompatibilität)
    if (auth.currentUser) {
      await saveMatchData(matchNumber, data);
    }

    onStatusUpdate?.("Baue Bericht zusammen...");
    const report = buildReport(data as any, matchNumber);
    
    // In Cache speichern
    matchCache[matchNumber] = report;
    await saveReport(matchNumber, report);

    return report;
  } catch (e) {
    return String(e);
  }
}
