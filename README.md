<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# VBL Match Report Automator

Ein Tool zur automatischen Erstellung von Spielberichten für die **Sparda 2. Liga Pro Frauen** (Volleyball).

Entwickelt für Pressewarte von Vereinen in der zweithöchsten deutschen Volleyball-Liga. Die App ruft Spieldaten von der VBL-Website ab, ergänzt sie per KI (Google Gemini) und generiert fertige Spielberichte im Markdown- und Gutenberg-HTML-Format.

## Features

- 🏐 Automatische Spielberichts-Erstellung via Google Gemini AI
- 📊 Abruf von Spieldaten, Ergebnissen, MVPs und Spielorten
- 💾 Speicherung in Firebase Firestore
- 📋 Export als Markdown oder Gutenberg HTML (für WordPress)
- 🔒 Google Login mit Admin-Rechteverwaltung

## Lokale Entwicklung

**Voraussetzungen:** Node.js

1. Repository klonen:
   `git clone https://github.com/Zappi77/VBL-Match-Report-Automator.git`

2. Abhängigkeiten installieren:
   `npm install`

3. Umgebungsvariablen setzen — `.env.local` im Projektordner anlegen:

VITE_GEMINI_API_KEY=dein_gemini_api_key

VITE_FIREBASE_API_KEY=dein_firebase_api_key

VITE_FIREBASE_PROJECT_ID=dein_project_id

VITE_FIREBASE_APP_ID=deine_app_id

VITE_FIREBASE_AUTH_DOMAIN=deine_auth_domain

VITE_FIREBASE_DATABASE_ID=deine_database_id

VITE_FIREBASE_STORAGE_BUCKET=dein_storage_bucket

VITE_FIREBASE_MESSAGING_SENDER_ID=deine_sender_id

4. App starten:
   `npm run dev`

## Live Demo

[vbl-match-report-automator.vercel.app](https://vbl-match-report-automator.vercel.app)

## Tech Stack

- React + TypeScript + Vite
- Firebase (Firestore + Authentication)
- Google Gemini AI
- Vercel (Deployment)
