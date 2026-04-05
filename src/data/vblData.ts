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

export const KNOWN_TEAMS: Record<string, string> = {
  "BBSC Berlin": "776308987",
  "BayerVolleys Leverkusen": "776308933",
  "Bayer-Volleys Leverkusen": "776308933",
  "DSHS SnowTrex Köln": "776308895",
  "ESA Grimma Volleys": "776308803",
  "Eintracht Spontent Düsseldorf": "776311815",
  "NawaRo Straubing": "776308823",
  "Neuseenland-Volleys Markkleeberg": "776309559",
  "Rote Raben Vilsbiburg": "776309082",
  "Sparkassen Wildcats Stralsund": "776309386",
  "1. VC Stralsund": "776309386",
  "TV Dingolfing": "776309004",
  "TV Hörde": "776309275",
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
export const SEASON_MATCHES: Record<string, MatchReference> = {
  "3150": {
    matchId: "777354215",
    homeTeam: "TV Planegg-Krailling",
    homeTeamId: "776309673",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "Feodor-Lynen-Gymnasium",
    locationId: "70012456",
    date: "28.03.2026",
    time: "19:00",
    weekday: "Samstag",
    spectators: "220",
    matchDuration: "68 Min. (22, 22, 24)",
    setPoints: "(18:25, 19:25, 21:25)",
    resultSets: "0:3",
    youtubeUrl: "https://www.youtube.com/live/tSHqf8A2yi4",
    samsScoreUuid: "0df17ec1-d1d3-4231-898c-b83a30b98f10" 
  },
  "3155": {
    matchId: "777354246",
    homeTeam: "NawaRo Straubing",
    homeTeamId: "776308823",
    awayTeam: "DSHS SnowTrex Köln",
    awayTeamId: "776308895",
    venueName: "turmair Volleyballarena",
    locationId: "12233",
    date: "28.03.2026",
    time: "19:00",
    weekday: "Samstag",
    spectators: "500",
    matchDuration: "92 Min. (26, 23, 22, 21)",
    resultSets: "3:1",
    setPoints: "20:25, 25:20, 25:15, 25:14"
  },
  "3003": {
    matchId: "777353197",
    homeTeam: "Skurios Volleys Borken",
    homeTeamId: "776309313",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "Merkelheider Weg",
    locationId: "70012466"
  }
};

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
