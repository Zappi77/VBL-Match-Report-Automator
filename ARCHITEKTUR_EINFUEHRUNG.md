# VBL Match Report Automator – Architektur-Einführung

Stand: Juni 2026

Diese Datei beschreibt die aktuelle Architektur des VBL Match Report Automators nach dem Umbau auf serverseitige Gemini-Aufrufe, Firebase-Admin-Prüfung und serverseitigen Abruf konkreter VBL-Matchseiten.

---

## 1) Überblick in 60 Sekunden

Die App besteht aktuell aus vier Schichten:

1. **UI-Schicht (React)**
   - Datei: `src/App.tsx`
   - Aufgabe: Eingaben entgegennehmen, Admin-Modus anzeigen, Statusmeldungen ausgeben, Ergebnisse darstellen und Aktionen des Nutzers steuern.

2. **Service-Schicht (Domänenlogik + Orchestrierung)**
   - Datei: `src/services/geminiService.ts`
   - Aufgabe: Spielnummern validieren, bekannte Daten laden, `matchId` auflösen, API-Aufrufe orchestrieren, Matchdaten normalisieren, Reports bauen und Firestore-Zugriffe kapseln.

3. **Server-/API-Schicht (Vercel Serverless Function)**
   - Datei: `api/gemini.ts`
   - Aufgabe: geschützte Gemini-Aufrufe ausführen, Firebase ID Token prüfen, Admin-Claim validieren, konkrete VBL-Matchseiten serverseitig abrufen und den HTML-Inhalt an Gemini zur Extraktion übergeben.

4. **Daten-/Infrastruktur-Schicht**
   - Dateien: `src/firebase.ts`, `src/data/vblData.ts`
   - Aufgabe: Firebase initialisieren, statische Referenzdaten bereitstellen und Firestore als persistente Datenquelle nutzen.

---

## 2) Zentrales Architekturprinzip

Die öffentliche React-App darf keine geheimen API-Schlüssel enthalten.

Insbesondere gilt:

```text
GEMINI_API_KEY
  -> serverseitig in Vercel
  -> niemals im Browser
  -> niemals mit VITE_ Präfix
```

Firebase-Web-Konfigurationswerte dürfen dagegen im Browser sichtbar sein:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
```

Die eigentliche Zugriffskontrolle erfolgt über:

```text
Firebase Authentication
Firestore Security Rules
Firebase Custom Claims
Serverseitige Admin-Prüfung in /api/gemini
```

---

## 3) Datenfluss – mental model

### 3.1 Standardfall: Spielnummer wird eingegeben

```text
Benutzer gibt Spielnummer ein
   ↓
App.tsx
   ↓
fetchMatchDataFull(...) in src/services/geminiService.ts
   ↓
A) Lookup in statischen Daten (SEASON_MATCHES)
B) Firestore-Lookup in matches/{matchNumber}
C) matchId-Auflösung, falls nötig
   ↓
matchId bekannt
   ↓
VBL-Detail-URL wird eindeutig gebaut
   ↓
callGeminiApi("extract_match_data", prompt, sourceUrl)
   ↓
POST /api/gemini
   ↓
Server prüft Firebase ID Token + admin:true Claim
   ↓
Server ruft VBL-Matchseite per fetch() ab
   ↓
Server übergibt HTML an Gemini
   ↓
Gemini extrahiert strukturierte JSON-Daten
   ↓
Post-Processing in geminiService.ts
   ↓
Validierungsmaske / Report / optional Firestore-Speicherung
```

---

### 3.2 Wenn die matchId bereits bekannt ist

Sobald die `matchId` bekannt ist, ist die Zielseite eindeutig:

```text
https://www.volleyball-bundesliga.de/popup/matchSeries/matchDetails.xhtml?matchId={matchId}&hideHistoryBackButton=true
```

Dann muss die App nicht mehr suchen.

Der Zielablauf lautet:

```text
matchId bekannt
   ↓
URL fest ableitbar
   ↓
Server fetch() auf VBL-Detailseite
   ↓
HTML an Gemini
   ↓
JSON-Extraktion
```

Das ersetzt den früheren, instabileren Ansatz:

```text
Gemini soll selbst suchen
Gemini soll Google Search verwenden
Gemini soll URL Context verwenden
```

---

### 3.3 Wenn die matchId nicht bekannt ist

Wenn keine gültige `matchId` vorliegt, versucht die App weiterhin, die `matchId` aufzulösen:

```text
Spielnummer
   ↓
Saison-Stammdaten / Firestore prüfen
   ↓
direkte Seitenauswertung versuchen
   ↓
optional KI-gestützte matchId-Auflösung
```

Erst wenn eine valide `matchId` vorhanden ist, beginnt die eigentliche Matchdaten-Extraktion.

---

## 4) Warum der VBL-Abruf serverseitig erfolgt

Browserseitige Zugriffe auf VBL-Seiten können durch CORS blockiert werden.

Problematisch ist dieser Ablauf:

```text
Browser
   -> www.volleyball-bundesliga.de
   -> CORS blockiert
```

Stabiler ist dieser Ablauf:

```text
Browser
   -> /api/gemini
      -> Vercel Serverless Function
         -> www.volleyball-bundesliga.de
```

Vorteile:

```text
keine Browser-CORS-Blockade beim VBL-Abruf
konkrete Zielseite statt Websuche
weniger Gemini-Tool-Abhängigkeit
geringeres Risiko leerer Gemini-Antworten
reduzierter Quota-Verbrauch
bessere Serverlogs bei Fehlern
```

---

## 5) Security-Modell

### 5.1 Öffentliche App, geschützte KI-Route

Die App selbst ist öffentlich erreichbar. Die KI-Extraktion ist jedoch geschützt.

```text
Öffentlicher Browser
   ↓
Firebase Login
   ↓
Firebase ID Token
   ↓
Authorization: Bearer <token>
   ↓
/api/gemini
   ↓
Server prüft admin:true
```

Nur Nutzer mit Custom Claim

```json
{ "admin": true }
```

dürfen die geschützte Gemini-Route verwenden.

---

### 5.2 Environment Variables

#### Serverseitig

```env
GEMINI_API_KEY=...
FIREBASE_SERVER_API_KEY=...
ALLOWED_ORIGINS=...
```

`GEMINI_API_KEY` ist geheim und darf nicht im Browser erscheinen.

`FIREBASE_SERVER_API_KEY` wird serverseitig verwendet, um Firebase ID Tokens über Identity Toolkit zu prüfen. Dieser Key sollte nicht über HTTP-Referrer eingeschränkt sein, da Vercel-Serverrequests keinen Browser-Referrer haben. Stattdessen sollte er auf die benötigte API eingeschränkt werden:

```text
Identity Toolkit API
```

#### Clientseitig

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
```

Diese Werte sind Teil der Firebase-Web-Konfiguration und werden im Browser ausgeliefert.

---

### 5.3 Was ausdrücklich vermieden wird

Nicht verwenden:

```env
VITE_GEMINI_API_KEY=...
```

Grund:

```text
VITE_* Variablen werden von Vite in den Browser-Build eingebettet.
```

Ein Gemini API Key mit `VITE_` Präfix wäre für Besucher potenziell aus dem JavaScript-Bundle extrahierbar.

---

## 6) Wichtige Dateien

### `src/App.tsx`

Aufgaben:

```text
UI-State
Formulareingaben
Admin-Modus-Anzeige
Statusausgaben
Validierungsmaske
Interaktion mit Service-Funktionen
```

### `src/services/geminiService.ts`

Aufgaben:

```text
Spielnummer validieren
Daten aus Firestore und Stammdaten laden
matchId auflösen
VBL-Detail-URL bauen
/api/gemini aufrufen
extrahierte Daten normalisieren
Report in Markdown und Gutenberg-HTML bauen
Firestore lesen/schreiben
```

Wichtig: Diese Datei orchestriert die Fachlogik, ruft Gemini aber nicht mehr direkt mit einem API Key auf.

### `api/gemini.ts`

Aufgaben:

```text
HTTP-Methode prüfen
Origin prüfen
Firebase ID Token prüfen
Admin-Claim prüfen
VBL-Detailseite serverseitig abrufen
Gemini serverseitig aufrufen
JSON-Antwort zurückgeben
```

Diese Datei ist die zentrale Sicherheitsgrenze für Gemini.

### `src/firebase.ts`

Aufgaben:

```text
Firebase Web SDK initialisieren
Authentication bereitstellen
Firestore bereitstellen
```

### `src/data/vblData.ts`

Aufgaben:

```text
Saison-Stammdaten
Team-IDs
Spielhallen
bekannte Spielerinnen
bekannte Spielreferenzen
```

---

## 7) Lokale Entwicklung

Da die App Vercel API Routes verwendet, sollte lokal mit Vercel gestartet werden:

```bash
npx vercel dev
```

Nicht ausreichend für vollständige Tests:

```bash
npm run dev
```

Grund:

```text
npm run dev startet nur das Vite-Frontend.
npx vercel dev startet Frontend plus API Routes.
```

---

## 8) Deployment

Die App ist für Vercel ausgelegt.

Erforderliche Variablen in Vercel:

```env
GEMINI_API_KEY=...
FIREBASE_SERVER_API_KEY=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
```

Optional:

```env
ALLOWED_ORIGINS=...
```

Nach Änderungen an Environment Variables ist ein neues Deployment erforderlich.

---

## 9) Fehlerdiagnose

### 9.1 `Admin access required`

Mögliche Ursachen:

```text
kein Authorization Header
Firebase ID Token fehlt
Token ungültig
admin:true Claim fehlt
FIREBASE_SERVER_API_KEY falsch oder nicht gesetzt
```

Prüfung:

```text
Browser DevTools -> Network -> /api/gemini -> Request Headers
Vercel Logs -> /api/gemini
```

### 9.2 `Requests from referer <empty> are blocked`

Ursache:

```text
Der serverseitig verwendete Firebase API Key ist per HTTP-Referrer eingeschränkt.
```

Lösung:

```text
separaten FIREBASE_SERVER_API_KEY verwenden
keine HTTP-Referrer-Restriction
API-Restriction auf Identity Toolkit API
```

### 9.3 `Tool use with responseMimeType application/json is unsupported`

Ursache:

```text
Gemini Tools wurden zusammen mit responseMimeType/responseSchema verwendet.
```

Lösung:

```text
Für die Matchdaten-Extraktion keine Gemini Tools verwenden.
VBL-Seite serverseitig abrufen.
HTML direkt an Gemini übergeben.
responseMimeType und responseSchema können dann wieder genutzt werden.
```

### 9.4 `Keine Antwort von Gemini`

Mögliche Ursachen:

```text
VBL-Seite konnte nicht gelesen werden
Gemini hat leeren Text geliefert
Prompt zu groß
Quota/Rate Limit
Modellzugriff eingeschränkt
```

Prüfung:

```text
Vercel Logs
Network Response
Prompt-Länge
Gemini-Quota
```

---

## 10) Warum diese Aufteilung sinnvoll ist

- **UI bleibt reaktiv:** Nutzer sieht Ladezustand, Logs und Fehler.
- **Fachlogik bleibt zentral:** Matchdaten, Validierungen und Reportbau bleiben in der Service-Schicht.
- **Secrets bleiben serverseitig:** Gemini Key und serverseitige Auth-Prüfung liegen in Vercel.
- **VBL-Zugriffe werden stabiler:** Der Browser muss die VBL-Seiten nicht direkt laden.
- **Fehler sind besser diagnostizierbar:** Serverlogs zeigen konkrete Ursachen.
- **Refactoring bleibt möglich:** UI, Service und API können schrittweise getrennt werden.

---

## 11) Nächste sinnvolle Refactoring-Schritte

### 11.1 `useMatchGeneration` Hook

Aus `App.tsx` kann später ein Hook extrahiert werden:

```text
useMatchGeneration
```

Aufgaben:

```text
loading
logs
error
report
elapsedTime
generate(matchNumber, options)
Timeout-Handling
Aufruf fetchMatchDataFull
```

Ziel:

```text
App.tsx verkürzen
UI und Ablaufsteuerung trennen
bessere Testbarkeit
```

### 11.2 Serverseitige VBL-Extraktion weiter ausbauen

Langfristig kann die Serverroute mehr Vorarbeit übernehmen:

```text
HTML bereinigen
relevante Tabellenabschnitte extrahieren
nur reduzierte Textdaten an Gemini senden
Kosten und Tokenverbrauch senken
```

### 11.3 Firestore-Zugriffe trennen

Firestore-Lese- und Schreiboperationen können perspektivisch in eigene Module ausgelagert werden:

```text
matchRepository.ts
reportRepository.ts
teamRepository.ts
playerRepository.ts
```

---

## 12) Lernhinweise für Quereinsteiger

Wenn du aus der Physik kommst, hilft folgende Zuordnung:

```text
useState
  -> Messwertspeicher / aktueller Zustand

useEffect
  -> Reaktion auf Zustandsänderungen

Service-Funktion
  -> Auswertepipeline

Firestore
  -> persistente Messdatenbank

/api/gemini
  -> geschützter Auswerteserver

VBL-HTML
  -> Rohdatenquelle

Gemini
  -> strukturierter Extraktor
```

Mit dieser Denkweise lässt sich der Code als Datenverarbeitungskette lesen:

```text
Eingabe
  -> Rohdaten
  -> Extraktion
  -> Validierung
  -> Normalisierung
  -> Bericht
```

---

## Kurzfassung

Die Architektur hat sich vom reinen Frontend-KI-Aufruf zu einer sichereren Server-Architektur entwickelt:

```text
vorher:
Browser -> Gemini

jetzt:
Browser -> /api/gemini -> VBL-Seite + Gemini
```

Das schützt den Gemini API Key, reduziert CORS-Probleme und macht die Extraktion robuster.
