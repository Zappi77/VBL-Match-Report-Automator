export interface MatchReference {
  matchId: string;
  homeTeam: string;
  homeTeamId: string;
  awayTeam: string;
  awayTeamId: string;
  venueName: string;
  locationId: string;
  date?: string;
  time?: string;
  weekday?: string;
  spectators?: string;
  matchDuration?: string;
  setPoints?: string;
  resultSets?: string;
  totalPoints?: string;
  samsScoreUuid?: string;
  youtubeUrl?: string;
  mvpHomeName?: string;
  mvpHomeUserId?: string;
  mvpAwayName?: string;
  mvpAwayUserId?: string;
  fromDb?: boolean;
}

// Sparda 2. Liga Pro (eingleisig, zweithöchste Spielklasse) – Saison 2026/27:
// - Aufgestiegen in die 1. Liga: Rote Raben Vilsbiburg
// - Abgestiegen in die 2. Bundesliga Nord/Süd (darunter, zweigleisig): TV Hörde, BBSC Berlin (Nord), TV Dingolfing (Süd)
// - Aufsteiger aus den Meisterschaften der 2. Bundesliga: SCU Emlichheim (Nord), SV Lohhof (Süd)
//   -> teamId noch offen (VBL-Mannschaftsseite, Parameter c.teamId); bis dahin extrahiert die KI sie.
export const KNOWN_TEAMS: Record<string, string> = {
  "BayerVolleys Leverkusen": "776308933",
  "Bayer-Volleys Leverkusen": "776308933",
  "DSHS SnowTrex Köln": "776308895",
  "ESA Grimma Volleys": "776308803",
  "Eintracht Spontent Düsseldorf": "776311815",
  "NawaRo Straubing": "776308823",
  "Neuseenland-Volleys Markkleeberg": "776309559",
  "Sparkassen Wildcats Stralsund": "776309386",
  "1. VC Stralsund": "776309386",
  "TV Planegg-Krailling": "776309673",
  "TV Waldgirmes": "776309795",
  "VCO Dresden": "776309105",
  "VfL Oythe": "776308853"
};

export const KNOWN_LOCATIONS: Record<string, string> = {
  "Sporthalle der Lahntalschule Atzbach": "8844461",
  "Sporthalle Lahntalschule Lahnau": "8844461",
  "turmair Volleyballarena": "12233",
  "Turmair-Gymnasium Straubing": "12233",
  "Turmair-Gymnasium": "12233",
  "Feodor-Lynen-Gymnasium": "70012456"
};

// This table acts as the "Master Season Table"
// It maps Match Number -> Full Reference Data
// Saison 2026/27: bewusst leer – die Spielnummern der Vorsaison würden kollidieren.
// Einträge entstehen über die Datenbank (Firestore: seasons/<Saison>/matches).
export const SEASON_MATCHES: Record<string, MatchReference> = {};

export const KNOWN_PLAYERS: Record<string, { userId: string; teamId: string }> = {
  "Amber de Tant": { userId: "751749162", teamId: "776308823" },
  "Leonie Amann": { userId: "70434234", teamId: "776309795" },
  "Maia Rackel": { userId: "771986028", teamId: "776308823" },
  "Elisabeth Kettenbach": { userId: "59149633", teamId: "776309673" },
  "Amber De Tant": { userId: "751749162", teamId: "776308823" },
  "Gesa Brandstrup": { userId: "752329134", teamId: "776309386" },
  "Theresa Barner": { userId: "750792046", teamId: "776308823" },
  "Annika Stenchly": { userId: "70003721", teamId: "776308895" }
};
