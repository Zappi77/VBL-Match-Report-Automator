import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { KNOWN_TEAMS, KNOWN_LOCATIONS, KNOWN_PLAYERS, SEASON_MATCHES, type MatchReference } from "../data/vblData";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, where } from "firebase/firestore";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const isNA = (val: any) => !val || String(val).trim().toUpperCase() === "N/A" || String(val).trim().toUpperCase() === "UNKNOWN" || String(val).trim() === "0" || String(val).trim() === "" || String(val).trim() === "Unbekannt";
const isUUID = (val: any) => typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Simple in-memory cache for the current session (still useful for speed)
export const matchCache: Record<string, string> = {};

/**
 * Checks if a report exists in Firestore or memory cache
 */
async function getCachedReport(matchNumber: string): Promise<string | null> {
  if (matchCache[matchNumber]) return matchCache[matchNumber];
  
  try {
    const reportDoc = await getDoc(doc(db, "reports", matchNumber));
    if (reportDoc.exists()) {
      const data = reportDoc.data();
      matchCache[matchNumber] = data.content;
      return data.content;
    }
  } catch (e) {
    console.error("Error fetching cached report from Firestore", e);
  }
  return null;
}

/**
 * Saves a report to Firestore if the user is authenticated
 */
async function saveReportToFirestore(matchNumber: string, content: string) {
  matchCache[matchNumber] = content;
  
  if (!auth.currentUser) return; // Only save if logged in (admin)
  
  try {
    await setDoc(doc(db, "reports", matchNumber), {
      matchNumber,
      content,
      generatedAt: new Date().toISOString()
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `reports/${matchNumber}`);
  }
}

/**
 * Fetches match data from Firestore or falls back to static data
 */
async function getMatchData(matchNumber: string): Promise<Partial<MatchReference>> {
  const staticData: Partial<MatchReference> = SEASON_MATCHES[matchNumber] || {};
  try {
    const matchDoc = await getDoc(doc(db, "matches", matchNumber));
    if (matchDoc.exists()) {
      const data = matchDoc.data() as Partial<MatchReference>;
      // Cleanup: If matchId is just the matchNumber, ignore it and fall back to static data
      if (data.matchId && String(data.matchId) === String(matchNumber)) {
        console.warn(`Firestore has invalid matchId (${data.matchId}) for #${matchNumber}. Ignoring.`);
        return staticData;
      }
      
      // Merge: Firestore data takes precedence over static data, but only if it's not empty/N/A
      const merged: Partial<MatchReference> = { ...staticData };
      
      Object.keys(data).forEach(key => {
        const k = key as keyof MatchReference;
        if (!isNA(data[k])) {
          (merged as any)[k] = data[k];
        }
      });
      return merged;
    }
  } catch (e) {
    console.error("Error fetching match data from Firestore", e);
  }
  return staticData;
}

/**
 * Saves match data to Firestore if the user is authenticated
 */
async function saveMatchDataToFirestore(matchNumber: string, data: any) {
  if (!auth.currentUser) return;
  
  try {
    const matchData: any = {
      matchNumber: String(data.matchNumber || matchNumber),
      matchId: String(data.matchId || ""),
      homeTeam: String(data.homeTeam || ""),
      homeTeamId: String(data.homeTeamId || ""),
      awayTeam: String(data.awayTeam || ""),
      awayTeamId: String(data.awayTeamId || ""),
      venueName: String(data.venueName || ""),
      locationId: String(data.locationId || ""),
      date: String(data.date || ""),
      time: String(data.time || ""),
      weekday: String(data.weekday || ""),
      spectators: String(data.spectators || ""),
      matchDuration: String(data.matchDuration || ""),
      setPoints: String(data.setPoints || ""),
      resultSets: String(data.resultSets || ""),
      samsScoreUuid: String(data.samsScoreUuid || ""),
      youtubeUrl: String(data.youtubeUrl || "")
    };

    // Clean up N/A values before saving
    Object.keys(matchData).forEach(key => {
      if (isNA(matchData[key])) {
        matchData[key] = "";
      }
    });

    await setDoc(doc(db, "matches", matchNumber), matchData);
    
    // Also save team info if not exists
    if (data.homeTeamId) {
      await setDoc(doc(db, "teams", data.homeTeamId), { name: data.homeTeam, teamId: data.homeTeamId }, { merge: true });
    }
    if (data.awayTeamId) {
      await setDoc(doc(db, "teams", data.awayTeamId), { name: data.awayTeam, teamId: data.awayTeamId }, { merge: true });
    }
    
    // Save player info (MVPs)
    const isValidPlayer = (name: any, userId: any) => {
      const n = String(name || "").trim();
      const u = String(userId || "").trim();
      return n && n !== "N/A" && n !== "Unbekannt" && u && u !== "N/A" && u !== "0";
    };

    if (isValidPlayer(data.mvpHomeName, data.mvpHomeUserId)) {
      const playerId = String(data.mvpHomeName).replace(/\//g, "-");
      await setDoc(doc(db, "players", playerId), { name: data.mvpHomeName, userId: data.mvpHomeUserId, teamId: data.homeTeamId }, { merge: true });
    }
    if (isValidPlayer(data.mvpAwayName, data.mvpAwayUserId)) {
      const playerId = String(data.mvpAwayName).replace(/\//g, "-");
      await setDoc(doc(db, "players", playerId), { name: data.mvpAwayName, userId: data.mvpAwayUserId, teamId: data.awayTeamId }, { merge: true });
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `matches/${matchNumber}`);
  }
}

const YOUTUBE_PLAYLIST_URL = "https://www.youtube.com/watch?v=-FkRIwJ7_KI&list=PLKvhsxfxEhVcbdeGhYZfXAPpB8UFaFWrp";

const matchReportSchema = {
  type: Type.OBJECT,
  properties: {
    matchNumber: { type: Type.STRING },
    weekday: { type: Type.STRING },
    date: { type: Type.STRING },
    time: { type: Type.STRING },
    homeTeam: { type: Type.STRING },
    awayTeam: { type: Type.STRING },
    homeTeamId: { type: Type.STRING },
    awayTeamId: { type: Type.STRING },
    resultSets: { type: Type.STRING },
    totalPoints: { type: Type.STRING },
    setPoints: { type: Type.STRING },
    matchDuration: { type: Type.STRING },
    matchId: { type: Type.STRING },
    venueName: { type: Type.STRING },
    locationId: { type: Type.STRING },
    samsScoreUuid: { type: Type.STRING },
    mvpHomeName: { type: Type.STRING },
    mvpHomeUserId: { type: Type.STRING },
    mvpAwayName: { type: Type.STRING },
    mvpAwayUserId: { type: Type.STRING },
    spectators: { type: Type.STRING },
    youtubeUrl: { type: Type.STRING },
    logs: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Progress logs for the user (e.g. 'Found spectators: 500')"
    }
  },
  required: ["matchNumber", "homeTeam", "awayTeam"]
};

export async function getMatchReport(matchNumber: string, onStatusUpdate?: (status: string) => void, forceRefresh: boolean = false) {
  if (!matchNumber || isNaN(Number(matchNumber))) {
    onStatusUpdate?.("Fehler: Ungültige Spielnummer.");
    return "Fehler: Bitte gib eine gültige Spielnummer ein (z.B. 3150).";
  }

  // Check Cache (Memory + Firestore)
  if (!forceRefresh) {
    const cached = await getCachedReport(matchNumber);
    if (cached) {
      console.log(`Serving match #${matchNumber} from cache`);
      onStatusUpdate?.("Daten aus Cache geladen...");
      return cached;
    }
  } else {
    onStatusUpdate?.("Erzwinge Neugenerierung...");
    delete matchCache[matchNumber];
  }

  const knownMatch = await getMatchData(matchNumber);
  const directUrl = (knownMatch && knownMatch.matchId && knownMatch.matchId.length > 5) 
    ? `https://www.volleyball-bundesliga.de/popup/matchSeries/matchDetails.xhtml?matchId=${knownMatch.matchId}` 
    : null;

  if (knownMatch && knownMatch.matchId) {
    onStatusUpdate?.(`Spiel #${matchNumber} (Fast-Path): Nutze Match-ID ${knownMatch.matchId}...`);
  } else {
    onStatusUpdate?.(`Spiel #${matchNumber} nicht in Datenbank. Starte KI-Recherche...`);
  }

  // Prepare knownMatch for AI - remove biased fields if forceRefresh is true
  const knownMatchForAI: any = knownMatch ? { ...knownMatch } : null;
  if (knownMatchForAI && forceRefresh) {
    delete knownMatchForAI.spectators;
    delete knownMatchForAI.matchDuration;
    delete knownMatchForAI.mvpHomeName;
    delete knownMatchForAI.mvpAwayName;
    delete knownMatchForAI.mvpHomeUserId;
    delete knownMatchForAI.mvpAwayUserId;
  }

  const prompt = knownMatch ? `
    KONTEXT: Sparda 2. Liga Pro Frauen 2025/26.
    DIREKT-URL: ${directUrl}
    DATEN AUS DATENBANK (BITTE KRITISCH PRÜFEN): ${JSON.stringify(knownMatchForAI, null, 2)}
    ${forceRefresh ? "ACHTUNG: Dies ist ein Force-Refresh! Die Daten in der Datenbank (insbesondere Zuschauer) sind vermutlich FALSCH. Bitte ignoriere sie und nimm NUR die Daten von der Webseite!" : ""}    AUFGABE:
    1. Rufe die URL auf.
    2. YouTube-Suche (WICHTIG):
       ${(knownMatch?.youtubeUrl && !forceRefresh) ? `Nutze den YouTube-Link aus der Datenbank: ${knownMatch.youtubeUrl}` : `Rufe die YouTube-Playlist auf: ${YOUTUBE_PLAYLIST_URL}
       Suche in der YouTube-Playlist nach dem Video, dessen TITEL exakt oder sehr ähnlich zur Paarung (${knownMatch?.homeTeam || "Heimteam"} vs. ${knownMatch?.awayTeam || "Gastteam"}) ist.
       WICHTIG: Der Titel des Videos muss die Namen beider Teams enthalten. Wenn du das Video findest, extrahiere den Link im Format https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID.`}
    3. Extrahiere PRÄZISE (HTML-Struktur beachten!): 
       - YouTube-Link: ${(knownMatch?.youtubeUrl && !forceRefresh) ? `Nutze ${knownMatch.youtubeUrl}` : `Suche in der Playlist nach einem Video, dessen Titel die Namen der beiden Teams enthält. 
         WICHTIG: Wenn du kein spezifisches Video für dieses Spiel findest, gib den Playlist-Link zurück: ${YOUTUBE_PLAYLIST_URL}`}
       - Zuschaueranzahl: Suche in der Tabelle (meistens unter "Statistiken" oder "Match Details") nach dem Label "Zuschauer:". 
         WICHTIG: Nimm NUR die Zahl der TATSÄCHLICH ANWESENDEN Personen. Ignoriere "Kapazität" oder "Sitzplätze". 
       - Spieldauer: Suche nach "Spieldauer:". Extrahiere den Text (z.B. "92 Minuten (26, 23, 22, 21)").
       - SAMS Score UUID: Suche nach dem Link zum "Offiziellen Spielbericht" oder "SAMS Score". 
         WICHTIG: Dieser Link befindet sich auf der Masterseite meistens DIREKT UNTERHALB der "Spieldauer".
         Der Link hat das Format: https://distributor.sams-score.de/scoresheet/pdf/{UUID}/{matchNumber}
         Extrahiere NUR die UUID (den langen String mit Bindestrichen).
       - MVPs: Suche nach dem Text "MVP", "Wertvollste Spielerin" oder den Klassen "samsOutputMvpPlayerName", "samsOutputMvpPlayerLink", "mvp-gold", "mvp-silber". 
         Extrahiere für BEIDE Teams den Namen und die 'userId' (aus dem Link Parameter 'userId=...').
       - Team IDs: Extrahiere die 'teamId' (77630...) für Heim- und Gastmannschaft aus den Links zu den Mannschaftsseiten.
       - Location ID: Extrahiere die 'locationId' aus dem Link zum Spielort (z.B. locationId=70012456).
       - Match ID: Extrahiere die 'matchId' (77735...) aus der URL der Hauptseite.
    4. Erstelle den Spielbericht EXAKT in 10 Zeilen (Markdown):
       Zeile 1: ##### Spiel #{matchNumber}, {Wochentag} {Datum} um {Uhrzeit} Uhr
       Zeile 2: [{Heimteam} vs. {Gastteam} … {Satzstand} / {Punktstand} ({Satzpunkte})](Link zur Hauptseite mit matchId)
       Zeile 3: Spieldauer: {Spieldauer}
       Zeile 4: Zuschauer: {Zuschauer}
       Zeile 5: Spielort: [{Hallenname}](Link zur Halle mit locationId)
       Zeile 6: [Offizieller Spielbericht (VBL)](Link mit UUID)
       Zeile 7: [Offizielle Spielstatistik (VBL)](Link mit Spielnummer)
       Zeile 8: MVP [{Heimteam}](Team-Link): [{MVP-Name}](Spieler-Link)
       Zeile 9: MVP [{Gastteam}](Team-Link): [{MVP-Name}](Spieler-Link)
       Zeile 10: [Re-Live DYN Volleyball YouTube (kostenfrei)](YouTube-Link)
    
    WICHTIG: Wenn du eine Information nicht findest, schreibe NICHT "N/A", sondern versuche sie durch logisches Kombinieren oder genaueres Suchen zu finden.
    Die Zuschaueranzahl steht EXAKT in der Tabelle.
    Die MVPs sind EXAKT markiert.
    
    WICHTIG: Sei so schnell wie möglich! Nutze NUR die bereitgestellten URLs für die Extraktion.
  ` : `
    Ich benötige EXAKTE Daten für ein Volleyballspiel der Sparda 2. Liga Pro Frauen (Saison 2025/26).
    Spielnummer (Match Number): ${matchNumber}.

    DEINE STRATEGIE (WICHTIG):
    1. Suche bei Google nach der offiziellen VBL-Seite für Spiel #${matchNumber}.
       Nutze Queries wie: site:volleyball-bundesliga.de "Spiel #${matchNumber}" 2025/26 "2. Liga Pro"
    2. Wenn du die Seite gefunden hast, rufe sie auf.
    3. Identifiziere die 'matchId' (9-stellig, z.B. 777354246) aus der URL der Detailseite. 
       WICHTIG: Die 'matchId' ist NICHT die Spielnummer (${matchNumber}). Sie ist eine 9-stellige Zahl!
    4. Extrahiere Mannschaften, Datum, Zeit, Ergebnis, Sätze, Punkte sowie die Zuschaueranzahl.
    5. MVPs: Extrahiere Namen und 'userId' für beide Teams.
    6. Suche in der YouTube-Playlist nach dem Video (Titel-Match): ${YOUTUBE_PLAYLIST_URL}
    7. Erstelle den Spielbericht EXAKT in 10 Zeilen wie oben beschrieben.
  `;

  const sharedInstructions = `
    ZUSÄTZLICHE ANWEISUNGEN:
    - Extrahiere die 'teamId' (77630...) und 'locationId'.
    - Extrahiere die Spieldauer EXAKT: "Gesamtminuten Min. (Satz1, Satz2, ...)".
    - Berechne 'totalPoints' (Heim:Gast) basierend auf den Satzpunkten (z.B. 95:74).
    - Extrahiere die SAMS Score UUID aus dem Link zum Spielbericht.
    - Extrahiere für BEIDE MVPs den Namen UND die 'userId'.
    - Suche den YouTube Re-Live Link (Kanal "Dyn Volleyball").
    
    REFERENZDATEN (FALLS NICHT IN DB):
    Teams: ${JSON.stringify(KNOWN_TEAMS)}
    Locations: ${JSON.stringify(KNOWN_LOCATIONS)}
    Players: ${JSON.stringify(KNOWN_PLAYERS)}

    LOGGING:
    Füge für jeden wichtigen Schritt einen Eintrag in das 'logs' Array ein (z.B. "Zuschauer gefunden: 500").
  `;

  const finalPrompt = prompt + sharedInstructions;

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-3.1-pro-preview",
    contents: finalPrompt,
    config: {
      tools: directUrl ? [{ urlContext: {} }] : [{ googleSearch: {} }, { urlContext: {} }],
      responseMimeType: "application/json",
      responseSchema: matchReportSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      systemInstruction: "Du bist ein präziser Daten-Extraktor für Volleyball-Spielberichte. Deine Antwort muss ausschließlich ein valides JSON-Objekt sein, das dem vorgegebenen Schema entspricht. Wenn du Informationen nicht findest, lasse das Feld leer oder setze einen leeren String, aber liefere IMMER ein valides JSON zurück."
    },
  });

  let fullText = "";
  let lastLogCount = 0;
  const chunks: any[] = [];

  try {
    for await (const chunk of responseStream) {
      chunks.push(chunk);
      // Check for safety blocks
      if (chunk.candidates?.[0]?.finishReason === "SAFETY") {
        onStatusUpdate?.("Fehler: Die KI hat die Antwort aus Sicherheitsgründen blockiert.");
        throw new Error("Sicherheitsblockade durch die KI.");
      }

      const text = chunk.text;
      if (text) {
        fullText += text;
      }

      // Check for tool calls (if any)
      if (chunk.candidates?.[0]?.content?.parts?.some(p => p.functionCall)) {
        onStatusUpdate?.("KI nutzt Werkzeuge zur Recherche...");
      }

      // Try to extract logs from partial JSON to keep the UI alive
      try {
        if (fullText.includes('"logs"')) {
          const logsMatch = fullText.match(/"logs":\s*\[([\s\S]*?)\]/);
          if (logsMatch) {
            const logsText = logsMatch[1];
            const logs = logsText.split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(s => s.length > 0);
            if (logs.length > lastLogCount) {
              for (let i = lastLogCount; i < logs.length; i++) {
                onStatusUpdate?.(logs[i]);
              }
              lastLogCount = logs.length;
            }
          }
        }
      } catch (e) {
        // Ignore partial parsing errors
      }
    }
  } catch (e: any) {
    if (e.message?.includes("Sicherheitsblockade")) throw e;
    console.error("Error during streaming:", e);
    onStatusUpdate?.("Fehler beim Streamen der Daten.");
  }

  if (!fullText.trim()) {
    console.error("Empty response from Gemini. Chunks received:", chunks.length);
    if (chunks.length > 0) {
      console.error("Last chunk:", JSON.stringify(chunks[chunks.length - 1]));
    }
    onStatusUpdate?.("Fehler: Keine Daten von der KI empfangen.");
    throw new Error("Die KI hat keine Antwort geliefert. Dies kann an einer Zeitüberschreitung oder einer Blockade liegen. Bitte versuche es erneut.");
  }

  onStatusUpdate?.("Daten empfangen, verarbeite JSON...");

  try {
    // Robust JSON extraction: find the first '{' and last '}'
    let jsonToParse = fullText.trim();
    const firstBrace = jsonToParse.indexOf('{');
    const lastBrace = jsonToParse.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonToParse = jsonToParse.substring(firstBrace, lastBrace + 1);
    }

    const data = JSON.parse(jsonToParse);
    data.matchNumber = matchNumber;

    // Validation: matchId should be 9 digits, not the matchNumber
    if (data.matchId && String(data.matchId) === String(matchNumber)) {
      console.warn(`AI incorrectly used matchNumber (${matchNumber}) as matchId. Resetting matchId.`);
      data.matchId = "";
    }
    
    // Post-processing: Verify IDs and Names against reference data
    const ref = knownMatch;
    if (ref) {
      data.matchId = ref.matchId || data.matchId;
      data.homeTeam = ref.homeTeam || data.homeTeam;
      data.homeTeamId = ref.homeTeamId || data.homeTeamId;
      data.awayTeam = ref.awayTeam || data.awayTeam;
      data.awayTeamId = ref.awayTeamId || data.awayTeamId;
      data.venueName = ref.venueName || data.venueName;
      data.locationId = ref.locationId || data.locationId;
      
      const staticData = SEASON_MATCHES[matchNumber];

      // If forceRefresh is true, we ignore the DB values for these specific fields to ensure we get fresh data from the AI
      if (forceRefresh) {
        // AI values are already in 'data'. If AI found nothing, use STATIC data as fallback, NOT the DB.
        if (isNA(data.matchDuration)) data.matchDuration = staticData?.matchDuration || "";
        if (isNA(data.setPoints)) data.setPoints = staticData?.setPoints || "";
        if (isNA(data.resultSets)) data.resultSets = staticData?.resultSets || "";
        if (isNA(data.youtubeUrl)) data.youtubeUrl = staticData?.youtubeUrl || "";
        if (isNA(data.samsScoreUuid)) data.samsScoreUuid = staticData?.samsScoreUuid || "";
        if (isNA(data.date)) data.date = staticData?.date || "";
        if (isNA(data.time)) data.time = staticData?.time || "";
        if (isNA(data.weekday)) data.weekday = staticData?.weekday || "";
        if (isNA(data.spectators)) data.spectators = staticData?.spectators || "";
      } else {
        // Normal mode: Use DB values if they are valid
        if (!isNA(ref.matchDuration)) data.matchDuration = ref.matchDuration;
        if (!isNA(ref.setPoints)) data.setPoints = ref.setPoints;
        if (!isNA(ref.resultSets)) data.resultSets = ref.resultSets;
        if (!isNA(ref.youtubeUrl)) data.youtubeUrl = ref.youtubeUrl;
        if (!isNA(ref.samsScoreUuid)) data.samsScoreUuid = ref.samsScoreUuid;
        if (!isNA(ref.date)) data.date = ref.date;
        if (!isNA(ref.time)) data.time = ref.time;
        if (!isNA(ref.weekday)) data.weekday = ref.weekday;
        if (!isNA(ref.spectators)) data.spectators = ref.spectators;
        
        // Final fallback to static data if both AI and DB have N/A
        if (staticData) {
          if (isNA(data.spectators)) data.spectators = staticData.spectators;
          if (isNA(data.matchDuration)) data.matchDuration = staticData.matchDuration;
          if (isNA(data.setPoints)) data.setPoints = staticData.setPoints;
          if (isNA(data.resultSets)) data.resultSets = staticData.resultSets;
        }
      }
    } else {
      // No DB data: Use AI result and fall back to static data
      const staticData = SEASON_MATCHES[matchNumber];
      
      if (staticData) {
        if (isNA(data.spectators)) data.spectators = staticData.spectators;
        if (isNA(data.matchDuration)) data.matchDuration = staticData.matchDuration;
        if (isNA(data.setPoints)) data.setPoints = staticData.setPoints;
        if (isNA(data.resultSets)) data.resultSets = staticData.resultSets;
      }
      
      if (KNOWN_TEAMS[data.homeTeam]) data.homeTeamId = KNOWN_TEAMS[data.homeTeam];
      if (KNOWN_TEAMS[data.awayTeam]) data.awayTeamId = KNOWN_TEAMS[data.awayTeam];
      
      const knownLocationEntries = Object.entries(KNOWN_LOCATIONS);
      let matchedLocation = knownLocationEntries.find(([_, id]) => id === data.locationId);
      if (!matchedLocation) {
        matchedLocation = knownLocationEntries.find(([name, _]) => name === data.venueName);
      }
      
      if (matchedLocation) {
        data.venueName = matchedLocation[0];
        data.locationId = matchedLocation[1];
      }
    }

    // Sanitize samsScoreUuid: If AI returned a full URL, extract the UUID
    const extractUUID = (val: any) => {
      if (!val) return "";
      const s = String(val);
      // Try to find UUID in a SAMS Score URL first
      const urlMatch = s.match(/\/pdf\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (urlMatch) return urlMatch[1];
      
      // Fallback to any UUID in the string
      const uuidMatch = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      return uuidMatch ? uuidMatch[0] : s;
    };

    if (!isNA(data.samsScoreUuid)) data.samsScoreUuid = extractUUID(data.samsScoreUuid);

    // Sanitize samsScoreUuid: If it's just a number or doesn't look like a UUID, clear it
    if (data.samsScoreUuid && !isUUID(data.samsScoreUuid)) {
      if (data.samsScoreUuid.length === 9 && !isNaN(Number(data.samsScoreUuid))) {
        onStatusUpdate?.("Warnung: KI hat Match-ID statt SAMS-UUID gefunden. Ignoriere...");
      }
      console.warn(`AI incorrectly used non-UUID (${data.samsScoreUuid}) as samsScoreUuid. Clearing.`);
      data.samsScoreUuid = "";
    }

    // Sanitize MVP userIds: If AI returned a full URL, extract the ID
    const extractUserId = (val: any) => {
      if (!val) return "";
      const s = String(val);
      const match = s.match(/userId=(\d+)/);
      return match ? match[1] : s.replace(/\D/g, "");
    };

    if (!isNA(data.mvpHomeUserId)) data.mvpHomeUserId = extractUserId(data.mvpHomeUserId);
    if (!isNA(data.mvpAwayUserId)) data.mvpAwayUserId = extractUserId(data.mvpAwayUserId);

    if (!isNA(data.mvpHomeName) && KNOWN_PLAYERS[String(data.mvpHomeName).trim()]) {
      const p = KNOWN_PLAYERS[String(data.mvpHomeName).trim()];
      data.mvpHomeUserId = p.userId;
      data.homeTeamId = p.teamId;
    }
    if (!isNA(data.mvpAwayName) && KNOWN_PLAYERS[String(data.mvpAwayName).trim()]) {
      const p = KNOWN_PLAYERS[String(data.mvpAwayName).trim()];
      data.mvpAwayUserId = p.userId;
      data.awayTeamId = p.teamId;
    }

    onStatusUpdate?.("Konstruiere Links und Bericht...");

    const homeTeamUrl = data.homeTeamId ? `https://www.volleyball-bundesliga.de/cms/home/2_bundesliga_frauen/2_bundesliga_frauen_pro/mannschaften.xhtml?c.teamId=${data.homeTeamId}&c.view=teamMain#samsCmsComponent_766577326` : "#";
    const awayTeamUrl = data.awayTeamId ? `https://www.volleyball-bundesliga.de/cms/home/2_bundesliga_frauen/2_bundesliga_frauen_pro/mannschaften.xhtml?c.teamId=${data.awayTeamId}&c.view=teamMain#samsCmsComponent_766577326` : "#";
    const mvpHomeUrl = (data.homeTeamId && data.mvpHomeUserId && !isNA(data.mvpHomeUserId)) ? `https://www.volleyball-bundesliga.de/popup/teamMember/teamMemberDetails.xhtml?teamId=${data.homeTeamId}&userId=${data.mvpHomeUserId}` : "#";
    const mvpAwayUrl = (data.awayTeamId && data.mvpAwayUserId && !isNA(data.mvpAwayUserId)) ? `https://www.volleyball-bundesliga.de/popup/teamMember/teamMemberDetails.xhtml?teamId=${data.awayTeamId}&userId=${data.mvpAwayUserId}` : "#";

    const report = `
##### Spiel #${data.matchNumber || matchNumber}, ${data.weekday || ""} ${data.date || ""} um ${data.time || ""} Uhr

[${data.homeTeam || "Unbekannt"} vs. ${data.awayTeam || "Unbekannt"} … ${data.resultSets || ""} / ${data.totalPoints || ""} ${data.setPoints ? (data.setPoints.trim().startsWith("(") ? data.setPoints.trim() : `(${data.setPoints.trim()})`) : ""}](https://www.volleyball-bundesliga.de/popup/matchSeries/matchDetails.xhtml?matchId=${data.matchId || ""}&hideHistoryBackButton=true)

Spieldauer: ${data.matchDuration || ""}

Zuschauer: ${data.spectators || ""}

Spielort: [${data.venueName || "Unbekannt"}](https://www.volleyball-bundesliga.de/popup/location/locationDetails.xhtml?locationId=${data.locationId || ""}&showVolleyballFields=true)

[Offizieller Spielbericht (VBL)](https://distributor.sams-score.de/scoresheet/pdf/${isUUID(data.samsScoreUuid) ? data.samsScoreUuid : ""}/${data.matchNumber || matchNumber})

[Offizielle Spielstatistik (VBL)](https://live.volleyball-bundesliga.de/2025-26/Women/${data.matchNumber || matchNumber}.pdf)

MVP [${data.homeTeam || "Heim"}](${homeTeamUrl}): [${data.mvpHomeName || "Unbekannt"}](${mvpHomeUrl})

MVP [${data.awayTeam || "Gast"}](${awayTeamUrl}): [${data.mvpAwayName || "Unbekannt"}](${mvpAwayUrl})

[Re-Live DYN Volleyball YouTube (kostenfrei)](${data.youtubeUrl || "#"})
    `.trim().split('\n').filter(line => line.trim() !== '').join('\n\n');

    // Save to Firestore (Learning mechanism)
    await saveMatchDataToFirestore(matchNumber, data);
    await saveReportToFirestore(matchNumber, report);
    
    return report;
  } catch (e) {
    console.error("Failed to parse JSON response", e);
    return `Fehler bei der Datenverarbeitung. Die KI hat folgendes geantwortet:\n\n${fullText}`;
  }
}
