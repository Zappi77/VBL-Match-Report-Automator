<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# VBL Match Report Automator

Ein Tool zur strukturierten Erstellung von Spielberichten für die **Sparda 2. Liga Pro Frauen** im Volleyball.

Der VBL Match Report Automator unterstützt Pressewarte und Vereinsteams dabei, relevante Spieldaten schneller zu erfassen, zu prüfen und in wiederverwendbare Berichtsformate zu überführen.

Die App ruft Spieldaten aus öffentlich verfügbaren Quellen der Volleyball Bundesliga ab, ergänzt diese über Google Gemini und erzeugt daraus Spielberichte im Markdown- und Gutenberg-HTML-Format.

---

## Features

- Automatische Spielberichts-Erstellung mit Google Gemini
- Abruf und Strukturierung von Spieldaten, Ergebnissen, Satzständen, MVPs und Spielorten
- Validierungsmaske zur manuellen Prüfung und Korrektur der extrahierten Daten
- Speicherung geprüfter Matchdaten in Firebase Firestore
- Export als Markdown
- Export als Gutenberg-kompatibles HTML für WordPress
- Google Login mit Admin-Modus
- Server-seitige Gemini-Anbindung über Vercel API Route

---

## Architektur

Die Anwendung besteht aus einem React/Vite-Frontend und einer serverseitigen Vercel API Route für KI-Aufrufe.

```text
Browser / React-App
  -> /api/gemini
      -> Google Gemini API

Browser / React-App
  -> Firebase Authentication
  -> Firebase Firestore
```

Der Gemini API Key wird **nicht** im Browser ausgeliefert.

Wichtig:

```text
GEMINI_API_KEY        serverseitig, nicht öffentlich
VITE_FIREBASE_*       clientseitige Firebase-Web-Konfiguration
```

---

## Security-Hinweis

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
unbekannte Spielnummer mit KI-Suche
manuelle Match-ID
Markdown-Export
Gutenberg-HTML-Export
Admin-Login
Firestore-Speicherung als Admin
Nicht-Admin ohne Schreibrechte
```

---

## Deployment

Die App ist für Vercel ausgelegt.

Erforderliche Environment Variable in Vercel:

```env
GEMINI_API_KEY=...
```

Zusätzlich müssen die Firebase-Web-Konfigurationswerte als `VITE_FIREBASE_*` Variablen gesetzt werden.

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

---

## Live Demo

https://vbl-match-report-automator.vercel.app

---

## Sicherheit nach Deployment prüfen

Nach dem Deployment sollte geprüft werden, dass kein Gemini-Key im Browser sichtbar ist.

Im Browser DevTools suchen nach:

```text
VITE_GEMINI_API_KEY
GEMINI_API_KEY
GoogleGenAI
AIza
```

Erwartung:

```text
kein Gemini API Key im Browser-Bundle
Gemini-Aufrufe laufen über /api/gemini
```

Im Network Tab sollte bei der Berichtsgenerierung ein Request an die eigene API Route sichtbar sein:

```text
POST /api/gemini
```

---

## Hinweise zu Firebase

Firebase-Web-Konfigurationswerte sind nicht geheim im klassischen Sinne. Die Absicherung erfolgt über:

- Firebase Authentication
- Firestore Security Rules
- Rollen-/Admin-Prüfung
- optional Firebase App Check

Schreib- und Löschrechte sollten nicht allein im Frontend geprüft werden, sondern über Firestore Security Rules abgesichert sein.

---

## Projektstatus

Dieses Projekt ist ein spezialisiertes Arbeitstool für die Vereins- und Sportkommunikation im Volleyball. Der Fokus liegt auf effizienter Datenerfassung, nachvollziehbarer Validierung und wiederverwendbaren Exportformaten für die Pressearbeit.
