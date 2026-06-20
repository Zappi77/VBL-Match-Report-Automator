<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# VBL Match Report Automator

Ein Tool zur strukturierten Erstellung von Spielberichten für die **Sparda 2. Liga Pro Frauen** im Volleyball.

Der VBL Match Report Automator unterstützt Pressewarte und Vereinsteams dabei, relevante Spieldaten schneller zu erfassen, zu prüfen und in wiederverwendbare Berichtsformate zu überführen.

Die App nutzt öffentlich verfügbare Quellen der Volleyball Bundesliga, Firebase Authentication, Firestore und Google Gemini. KI- und Scraping-nahe Verarbeitung läuft über serverseitige Vercel API Routes, damit sensible API-Schlüssel nicht im Browser ausgeliefert werden.

---

## Features

- Automatische Spielberichts-Erstellung mit Google Gemini
- Abruf und Strukturierung von Spieldaten, Ergebnissen, Satzständen, MVPs und Spielorten
- Server-seitiger Abruf konkreter VBL-Matchseiten, sobald die `matchId` bekannt ist
- Validierungsmaske zur manuellen Prüfung und Korrektur der extrahierten Daten
- Speicherung geprüfter Matchdaten in Firebase Firestore
- Export als Markdown
- Export als Gutenberg-kompatibles HTML für WordPress
- Google Login mit Admin-Modus
- Geschützte Gemini API Route mit Firebase-ID-Token-Prüfung

---

## Architektur

Die Anwendung besteht aus einem React/Vite-Frontend und serverseitigen Vercel API Routes.

```text
Browser / React-App
  -> Firebase Authentication
  -> Firebase Firestore
  -> /api/gemini
      -> Firebase Auth Tokenprüfung
      -> VBL-Matchseite serverseitig abrufen
      -> Google Gemini API
```

Der Gemini API Key wird **nicht** im Browser ausgeliefert.

Sobald eine `matchId` bekannt ist, ist die VBL-Detailseite eindeutig. Die Serverroute ruft diese Seite direkt ab und übergibt den HTML-Inhalt an Gemini zur strukturierten Extraktion.

```text
matchId bekannt
  -> VBL-Detail-URL fest ableitbar
  -> Server fetch() auf VBL-Seite
  -> Gemini extrahiert JSON aus dem HTML
```

---

## Security-Hinweise

### Gemini API Key

Der Gemini API Key darf nicht mit dem Präfix `VITE_` verwendet werden.

Nicht verwenden:

```env
VITE_GEMINI_API_KEY=...
```

Korrekt:

```env
GEMINI_API_KEY=...
```

Der Key wird ausschließlich serverseitig in der Vercel API Route genutzt.

### Firebase Web-Konfiguration

Firebase-Web-Konfigurationswerte mit `VITE_FIREBASE_*` sind clientseitig sichtbar. Das ist bei Firebase grundsätzlich erwartbar. Die Zugriffskontrolle erfolgt über Firebase Authentication, Firestore Security Rules und serverseitige Prüfungen.

### Firebase Server API Key

Für die serverseitige Admin-Validierung kann ein separater Firebase/Identity-Toolkit API Key verwendet werden:

```env
FIREBASE_SERVER_API_KEY=...
```

Dieser Key sollte **nicht** per HTTP-Referrer eingeschränkt sein, weil serverseitige Vercel-Requests keinen Browser-Referrer haben. Er sollte stattdessen auf die benötigte API eingeschränkt werden, zum Beispiel auf:

```text
Identity Toolkit API
```

### Admin-Prüfung

Die Gemini API Route erwartet einen Firebase ID Token im `Authorization` Header. Nur Nutzer mit Custom Claim

```json
{ "admin": true }
```

dürfen KI-Extraktionen auslösen.

---

## Tech Stack

- React
- TypeScript
- Vite
- Firebase Authentication
- Firebase Firestore
- Google Gemini API
- Vercel
- Vercel Serverless Functions

---

## Voraussetzungen

Für die lokale Entwicklung werden benötigt:

- Node.js
- npm
- Vercel CLI über `npx`
- Firebase-Projekt mit Authentication und Firestore
- Gemini API Key aus Google AI Studio oder Google Cloud Console
- Firebase/Identity-Toolkit API Key für serverseitige Tokenprüfung

---

## Installation

Repository klonen:

```bash
git clone https://github.com/Zappi77/VBL-Match-Report-Automator.git
cd VBL-Match-Report-Automator
```

Abhängigkeiten installieren:

```bash
npm install
```

---

## Umgebungsvariablen

Lege im Projektordner eine lokale Datei an:

```bash
touch .env.local
```

Beispiel:

```env
# Server-side only. Never expose this with VITE_.
GEMINI_API_KEY="your_gemini_api_key"

# Server-side Firebase Auth / Identity Toolkit key.
# This key is used by /api/gemini to validate Firebase ID tokens.
FIREBASE_SERVER_API_KEY="your_firebase_identity_toolkit_api_key"

# Optional: comma-separated list of allowed origins for /api/gemini.
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"

# Firebase web config. These values are allowed to be visible in the browser.
VITE_FIREBASE_API_KEY="your_firebase_api_key"
VITE_FIREBASE_PROJECT_ID="your_firebase_project_id"
VITE_FIREBASE_APP_ID="your_firebase_app_id"
VITE_FIREBASE_AUTH_DOMAIN="your_firebase_auth_domain"
VITE_FIREBASE_DATABASE_ID="your_firebase_database_id"
VITE_FIREBASE_STORAGE_BUCKET="your_firebase_storage_bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_firebase_messaging_sender_id"
```

Die Datei `.env.local` darf nicht committed werden.

Die Vorlage `.env.example` enthält nur Platzhalter und darf im Repository liegen.

---

## Lokale Entwicklung

Da die App eine Vercel API Route unter `/api/gemini` verwendet, sollte lokal mit Vercel gestartet werden:

```bash
npx vercel dev
```

Nicht empfohlen für vollständige lokale Tests:

```bash
npm run dev
```

`npm run dev` startet nur das Vite-Frontend. Die API Route `/api/gemini` steht dann nicht wie im Vercel-Deployment zur Verfügung.

---

## Build

Produktionsbuild lokal prüfen:

```bash
npm run build
```

---

## Tests

Vor einem Deployment sollten mindestens folgende Fälle geprüft werden:

```text
bekannte Spielnummer
Spiel aus Firestore
unbekannte Spielnummer mit KI-gestützter matchId-Auflösung
manuelle Match-ID
serverseitiger Abruf der VBL-Matchseite
Markdown-Export
Gutenberg-HTML-Export
Admin-Login
Firestore-Speicherung als Admin
Nicht-Admin ohne Schreibrechte
kein Gemini-Key im Browser-Bundle
```

---

## Deployment

Die App ist für Vercel ausgelegt.

Erforderliche Environment Variables in Vercel:

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

Empfohlene Umgebungen:

```text
Production
Preview
Development
```

Mindestens erforderlich für die Live-App:

```text
Production
```

Nach Änderungen an Environment Variables muss Vercel neu deployt werden.

---

## Hinweise zur VBL-Datenextraktion

Die App versucht zunächst, vorhandene Daten aus Firestore oder Saison-Stammdaten zu verwenden.

Wenn eine `matchId` bekannt ist, wird die konkrete VBL-Detailseite serverseitig abgerufen. Dadurch muss Gemini nicht mehr selbst im Web suchen, sondern erhält den HTML-Inhalt der Zielseite zur Extraktion.

Das reduziert:

```text
Browser-CORS-Probleme
unnötige Gemini-Tool-Aufrufe
Fehler durch Google Search / URL Context
Quota-Verbrauch
```

---

## Live Demo

[vbl-match-report-automator.vercel.app](https://vbl-match-report-automator.vercel.app)
