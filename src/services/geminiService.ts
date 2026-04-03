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
} from "firebase/firestore";

// ─────────────────────────────────────────────
// Konstanten
// ─────────────────────────────────────────────
const MODEL_FAST = "gemini-2.0-flash";
const MODEL_SMART = "gemini-2.0-flash"; // auf 2.5-pro-preview upgraden wenn nötig

const YOUTUBE_PLAYLIST_URL =
  "https://www.youtube.com/watch?v=-FkRIwJ7_KI&list=PLKvhsxfxEhVcbdeGhYZfXAPpB8UFaFWrp";

const TEAM_MATCHES_URL = (teamId: string) =>
  `https://www.volleyball-bundesliga.de/cms/home/2_bundesliga_frauen/2_bundesliga_frauen_pro/mannschaften.xhtml?c.teamId=${teamId}&c.view=matches#samsCmsComponent_766577326`;

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
  ["n/a", "unknown", "0", "", "unbekannt"].includes(
    String(val).trim().toLowerCase()
  );

const isValidMatchId = (val: unknown, matchNumber: string): boolean => {
  const s = String(val || "").trim();
  return s.length >= 8 && s !== matchNumber && /^\d+$/.test(s);
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
  onStatusUpdate?: (s: string) => void
): Promise<string | null> {
  onStatusUpdate?.(`Suche matchId für Spiel #${matchNumber}...`);

  // Stufe 1: Google Search → URL finden
  const searchPrompt = `
    Suche auf volleyball-bundesliga.de nach Spiel #${matchNumber} 
    Sparda 2. Liga Pro Frauen 2025/26.
    
    Gib mir NUR die vollständige URL zur Spieldetailseite zurück.
    Format: https://www.volleyball-bundesliga.de/popup/matchSeries/matchDetails.xhtml?matchId=XXXXXXXXX
    
    Antworte nur mit der URL, nichts sonst.
    Falls nicht gefunden: "not_found"
  `;

  try {
    const searchResponse = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const searchText = (searchResponse.text || "").trim();
    console.log("Search response:", searchText);

    // matchId direkt aus URL extrahieren falls vorhanden
    const directMatch = searchText.match(/matchId=(\d{8,10})/);
    if (directMatch && isValidMatchId(directMatch[1], matchNumber)) {
      onStatusUpdate?.(`matchId direkt gefunden: ${directMatch[1]}`);
      return directMatch[1];
    }

    // Stufe 2: URL extrahieren und per urlContext abrufen
    const urlMatch = searchText.match(
      /https:\/\/www\.volleyball-bundesliga\.de[^\s"')]+/
    );

    if (urlMatch) {
      const url = urlMatch[0];
      onStatusUpdate?.(`Rufe URL auf: ${url}`);

      const fetchPrompt = `
        Rufe diese URL auf: ${url}
        
        Finde in der Seite einen Link mit matchId.
        Format: matchDetails.xhtml?matchId=XXXXXXXXX
        
        Die matchId ist 9-stellig und NICHT ${matchNumber}.
        Antworte NUR mit der matchId als Zahl.
      `;

      const fetchResponse = await ai.models.generateContent({
        model: MODEL_FAST,
        contents: fetchPrompt,
        config: {
          tools: [{ urlContext: {} }],
        },
      });

      const fetchText = (fetchResponse.text || "").trim();
      console.log("Fetch response:", fetchText);

      const fetchMatch = fetchText.match(/\b(\d{8,10})\b/);
      if (fetchMatch && isValidMatchId(fetchMatch[0], matchNumber)) {
        onStatusUpdate?.(`matchId gefunden: ${fetchMatch[0]}`);
        return fetchMatch[0];
      }
    }

    // Letzter Fallback: Mannschaftsseite per urlContext
    onStatusUpdate?.("Fallback: Suche auf Mannschaftsseite...");
    const teamUrl = TEAM_MATCHES_URL(homeTeamId);

    const teamPrompt = `
      Rufe diese URL auf: ${teamUrl}
      
      Finde das Spiel mit der Nummer ${matchNumber}.
      Extrahiere die matchId aus dem Link:
      matchDetails.xhtml?matchId=XXXXXXXXX
      
      matchId ist 9-stellig, NICHT ${matchNumber}.
      Antworte NUR mit der matchId.
    `;

    const teamResponse = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: teamPrompt,
      config: {
        tools: [{ urlContext: {} }],
      },
    });

    const teamText = (teamResponse.text || "").trim();
    console.log("Team page response:", teamText);

    const teamMatch = teamText.match(/\b(\d{8,10})\b/);
    if (teamMatch && isValidMatchId(teamMatch[0], matchNumber)) {
      onStatusUpdate?.(`matchId über Mannschaftsseite gefunden: ${teamMatch[0]}`);
      return teamMatch[0];
    }

  } catch (e) {
    console.error("resolveMatchId failed:", JSON.stringify(e));
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

async function saveReport(matchNumber: string, content: string) {
  matchCache[matchNumber] = content;
  if (!auth.currentUser) return;
  try {
    await setDoc(doc(db, "reports", matchNumber), {
      matchNumber,
      content,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    logFirestoreError(e, "WRITE", `reports/${matchNumber}`);
  }
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
      const merged: Partial<MatchReference> = { ...staticData };
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
// Firestore: Match-Daten schreiben (mit Validierung)
// ─────────────────────────────────────────────
async function saveMatchData(matchNumber: string, data: Record<string, unknown>) {
  if (!auth.currentUser) return;

  // matchId validieren VOR dem Speichern
  if (!isValidMatchId(data.matchId, matchNumber)) {
    console.warn(
      `Ungültige matchId (${data.matchId}) – wird nicht gespeichert.`
    );
    data.matchId = "";
  }

  const clean: Record<string, string> = {};
  const fields = [
    "matchNumber","matchId","homeTeam","homeTeamId","awayTeam","awayTeamId",
    "venueName","locationId","date","time","weekday","spectators",
    "matchDuration","setPoints","resultSets","samsScoreUuid","youtubeUrl",
    "mvpHomeName","mvpHomeUserId","mvpAwayName","mvpAwayUserId",
  ];

  fields.forEach((f) => {
    const val = String(data[f] || "");
    clean[f] = isNA(val) ? "" : val;
  });

  try {
    await setDoc(doc(db, "matches", matchNumber), clean);

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
  } catch (e) {
    logFirestoreError(e, "WRITE", `matches/${matchNumber}`);
  }
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
    
    1. SPIELERGEBNIS (Zeile 2):
       - Heimteam, Gastteam, Satzstand (z.B. 3:0), Gesamtpunkte (z.B. 75:58), Satzpunkte (z.B. 25:18, 25:19, 25:21)
    
    2. SPIELDAUER (Zeile 3):
       - HTML: <div class="samsContentBoxHeader">Statistiken</div>
       - Format: "68 Min. (22, 22, 24)"
    
    3. ZUSCHAUER (Zeile 4):
       - Selbe Statistiken-Box
       - NUR tatsächlich Anwesende, NICHT Kapazität
    
    4. SPIELORT + locationId (Zeile 5):
       - locationId aus Link: locationDetails.xhtml?locationId=XXXXXXX
    
    5. SAMS Score UUID (Zeile 6):
       - Link direkt unter Spieldauer
       - Format: https://distributor.sams-score.de/scoresheet/pdf/{UUID}/{matchNumber}
       - Extrahiere NUR die UUID
    
    6. MVPs (Zeilen 8+9):
       - HTML: <div class="samsContentBoxHeader">Most Valuable Player</div>
       - Name UND userId (aus Link: teamMemberDetails.xhtml?teamId=X&userId=Y)
       - Für BEIDE Teams
    
    7. TEAM-IDs (homeTeamId, awayTeamId):
       - Aus Links zu Mannschaftsseiten: c.teamId=XXXXXXXXX
    
    8. YOUTUBE Re-Live (Zeile 10):
       ${knownData.youtubeUrl && !forceRefresh
         ? `Nutze aus DB: ${knownData.youtubeUrl}`
         : `Suche in Playlist: ${YOUTUBE_PLAYLIST_URL}
            Video-Titel muss beide Teamnamen enthalten.
            Fallback: ${YOUTUBE_PLAYLIST_URL}`
       }
    
    WICHTIGE REGELN:
    - matchId ist ${matchId} – gib EXAKT diesen Wert zurück
    - matchId darf NIEMALS die Spielnummer ${matchNumber} sein
    - Wenn UUID nicht gefunden: leerer String (kein Platzhalter)
    - Bei userId: NUR die Zahl, keine URL
    - Logs: Schreibe für jeden gefundenen Wert einen Eintrag
    
    REFERENZDATEN:
    Teams: ${JSON.stringify(KNOWN_TEAMS)}
    Locations: ${JSON.stringify(KNOWN_LOCATIONS)}
    Players: ${JSON.stringify(KNOWN_PLAYERS)}
  `;

  const stream = await ai.models.generateContentStream({
    model: MODEL_SMART,
    contents: prompt,
    config: {
      tools: [{ urlContext: {} }],
      responseMimeType: "application/json",
      responseSchema: matchSchema,
      systemInstruction:
        "Du bist ein präziser Daten-Extraktor für Volleyball-Spielberichte. Antworte ausschließlich mit validem JSON gemäß Schema. Leere Felder = leerer String.",
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

  if (!fullText.trim()) throw new Error("Keine Antwort von Gemini.");

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
// Bericht zusammenbauen
// ─────────────────────────────────────────────
function buildReport(
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

// ─────────────────────────────────────────────
// HAUPT-EXPORT
// ─────────────────────────────────────────────
export async function getMatchReport(
  matchNumber: string,
  onStatusUpdate?: (status: string) => void,
  forceRefresh = false
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
  } else {
    delete matchCache[matchNumber];
    onStatusUpdate?.("Cache geleert – generiere neu...");
  }

  // Bekannte Daten laden
  let knownData = await getMatchData(matchNumber);

  // ── PHASE 1: matchId auflösen ──────────────
  if (!isValidMatchId(knownData.matchId, matchNumber)) {
    onStatusUpdate?.("matchId fehlt – starte Auflösung...");

    // homeTeamId ermitteln (aus DB oder KNOWN_TEAMS)
    const homeTeamId =
      knownData.homeTeamId ||
      (knownData.homeTeam ? KNOWN_TEAMS[knownData.homeTeam] : null) ||
      Object.values(KNOWN_TEAMS)[0];

    const resolvedId = await resolveMatchId(
      matchNumber,
      homeTeamId,
      onStatusUpdate
    );

    if (resolvedId) {
      // Sofort in DB speichern damit nächster Aufruf schnell ist
      if (auth.currentUser) {
        await setDoc(
          doc(db, "matches", matchNumber),
          { matchId: resolvedId },
          { merge: true }
        );
      }
      knownData = { ...knownData, matchId: resolvedId };
    } else {
      onStatusUpdate?.("⚠️ matchId konnte nicht aufgelöst werden.");
      return "Fehler: matchId für dieses Spiel nicht gefunden. Bitte Spielnummer prüfen.";
    }
  } else {
    onStatusUpdate?.(`matchId bekannt: ${knownData.matchId}`);
  }

  // ── PHASE 2: Hauptdaten extrahieren ────────
  onStatusUpdate?.("Extrahiere Spieldaten...");
  let rawData: Record<string, unknown>;

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
    return `Fehler bei der Datenextraktion: ${e instanceof Error ? e.message : String(e)}`;
  }

  // ── Post-Processing ─────────────────────────
  rawData.matchNumber = matchNumber;

  // matchId darf nicht überschrieben werden
  rawData.matchId = String(knownData.matchId);

  // Bekannte Werte haben Vorrang (Stammdaten)
  if (knownData.homeTeam) rawData.homeTeam = knownData.homeTeam;
  if (knownData.homeTeamId) rawData.homeTeamId = knownData.homeTeamId;
  if (knownData.awayTeam) rawData.awayTeam = knownData.awayTeam;
  if (knownData.awayTeamId) rawData.awayTeamId = knownData.awayTeamId;
  if (knownData.venueName) rawData.venueName = knownData.venueName;
  if (knownData.locationId) rawData.locationId = knownData.locationId;

  // Bei normalem Modus: DB-Werte bevorzugen
  if (!forceRefresh) {
    const prefer = (field: keyof MatchReference) => {
      if (!isNA(knownData[field])) rawData[field] = knownData[field] as string;
    };
    prefer("matchDuration"); prefer("setPoints"); prefer("resultSets");
    prefer("youtubeUrl"); prefer("samsScoreUuid"); prefer("date");
    prefer("time"); prefer("weekday"); prefer("spectators");
    prefer("mvpHomeName"); prefer("mvpHomeUserId");
    prefer("mvpAwayName"); prefer("mvpAwayUserId");
  }

  // Statische Daten als letzter Fallback
  const staticData = SEASON_MATCHES[matchNumber];
  if (staticData) {
    const fallback = (field: keyof MatchReference) => {
      if (isNA(rawData[field])) rawData[field] = staticData[field] || "";
    };
    fallback("spectators"); fallback("matchDuration");
    fallback("setPoints"); fallback("resultSets");
  }

  // UUID bereinigen
  if (!isNA(rawData.samsScoreUuid)) {
    rawData.samsScoreUuid = extractUUID(rawData.samsScoreUuid);
  }
  if (!isUUID(rawData.samsScoreUuid)) {
    console.warn(`Ungültige UUID: ${rawData.samsScoreUuid} – geleert.`);
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

  // ── Bericht bauen ───────────────────────────
  onStatusUpdate?.("Baue Bericht zusammen...");
  const report = buildReport(rawData, matchNumber);

  // ── Speichern ───────────────────────────────
  await saveMatchData(matchNumber, rawData);
  await saveReport(matchNumber, report);

  onStatusUpdate?.("✅ Fertig!");
  return report;
}