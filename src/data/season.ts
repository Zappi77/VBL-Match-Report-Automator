// Zentrale Saison-Konfiguration. Beim Saisonwechsel nur diese Datei anpassen
// (und SEASON_MATCHES in vblData.ts leeren) – Firestore-Daten liegen pro Saison
// getrennt unter seasons/{id}/..., damit sich wiederholende Spielnummern
// nicht mit der Vorsaison kollidieren.
export const SEASON = {
  /** Firestore-Namespace, z.B. seasons/2026-27/matches/{Spielnummer} */
  id: "2026-27",
  /** Anzeige, z.B. "2026/27" */
  label: "2026/27",
  /** Pfad-Segment im VBL-Live-Statistik-PDF */
  statsPathId: "2026-27",
  /** Kalenderjahre der Saison: Hinrunde (Herbst) / Rückrunde (Frühjahr) */
  yearFirst: "2026",
  yearSecond: "2027",
} as const;
