# VBL Match Report Automator – Architektur-Einführung

## 1) Überblick (in 60 Sekunden)

Die App besteht aus drei Schichten:

1. **UI-Schicht (React)**
   - Datei: `src/App.tsx`
   - Aufgabe: Eingaben entgegennehmen, Status anzeigen, Ergebnisse darstellen.

2. **Service-Schicht (Domänenlogik + KI-Aufrufe)**
   - Datei: `src/services/geminiService.ts`
   - Aufgabe: Matchdaten auflösen, validieren, KI-Aufrufe orchestrieren, Firestore-Zugriffe kapseln.

3. **Daten-/Infrastruktur-Schicht**
   - Dateien: `src/firebase.ts`, `src/data/vblData.ts`
   - Aufgabe: Firebase initialisieren, statische Referenzdaten bereitstellen.

---

## 2) Datenfluss (mental model)

```text
Benutzer (Matchnummer)
   ↓
App.tsx (UI-State + Event Handler)
   ↓
fetchMatchDataFull(...) in geminiService.ts
   ↓
A) Lookup in statischen Daten (SEASON_MATCHES)
B) Firestore-Lookup
C) KI-gestützte Auflösung (matchId etc.)
   ↓
normalisierte Matchdaten
   ↓
buildReport(...) / getMatchReport(...)
   ↓
Markdown-Report in UI + optional speichern
```

---

## 3) Warum diese Aufteilung sinnvoll ist

- **UI bleibt reaktiv**: Nutzer sieht Ladezustand, Logs, Fehler.
- **Fachlogik zentral**: Validierungen und URL-Aufbau liegen gebündelt im Service.
- **Persistenz getrennt**: Firebase-Setup ist von UI entkoppelt.

Das erleichtert spätere Tests und Refactoring.

---

## 4) Nächster Refactoring-Schritt (klein, risikoarm)

Empfohlenes erstes Ziel:

- Aus `App.tsx` einen Hook `useMatchGeneration` extrahieren, der nur den Ablauf „Generieren + Timeout + Logs“ kapselt.
- Vorteil: `App.tsx` wird kürzer und verständlicher, ohne Verhalten zu ändern.

### Geplanter Inhalt des Hooks

- Zustand: `loading`, `logs`, `error`, `report`, `elapsedTime`
- API: `generate(matchNumber, options)`
- Intern: Timeout-Handling + Aufruf `fetchMatchDataFull`

---

## 5) Lernhinweise für Quereinsteiger

Wenn du aus der Physik kommst, hilft oft folgende Zuordnung:

- `useState` = Messwertspeicher
- `useEffect` = Mess-Trigger / Reaktion auf Zustandsänderung
- Service-Funktion = Auswertepipeline
- Firestore = Messdatenbank

Mit dieser Denkweise kannst du den Code schnell „lesen“, ohne jedes React-Detail zu kennen.
