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
  samsScoreUuid?: string;
  youtubeUrl?: string;
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
  "3137": {
    matchId: "777354135",
    homeTeam: "NawaRo Straubing",
    homeTeamId: "776308823",
    awayTeam: "Sparkassen Wildcats Stralsund",
    awayTeamId: "776309386",
    venueName: "turmair Volleyballarena",
    locationId: "12233",
    matchDuration: "71 Min. (26, 24, 21)",
    setPoints: "(25:22, 25:20, 25:14)",
    resultSets: "3:0",
    samsScoreUuid: "dd9c86b1-0de5-423b-b85e-8fcb400e175d"
  },
  "3143": {
    matchId: "777354196",
    homeTeam: "TV Waldgirmes",
    homeTeamId: "776309795",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "Sporthalle der Lahntalschule Atzbach",
    locationId: "8844461"
  },
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
  "3129": {
    matchId: "777354079",
    homeTeam: "DSHS SnowTrex Köln",
    homeTeamId: "776309243",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "ACL 80 Köln",
    locationId: "70012457"
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
  "3122": {
    matchId: "777354030",
    homeTeam: "NawaRo Straubing",
    homeTeamId: "776308823",
    awayTeam: "Bayer-Volleys Leverkusen",
    awayTeamId: "776308933",
    venueName: "turmair Volleyballarena",
    locationId: "12233"
  },
  "3115": {
    matchId: "777353981",
    homeTeam: "ESA Grimma Volleys",
    homeTeamId: "776309173",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "Muldentalhalle Grimma",
    locationId: "70012458"
  },
  "3108": {
    matchId: "777353932",
    homeTeam: "NawaRo Straubing",
    homeTeamId: "776308823",
    awayTeam: "Rote Raben Vilsbiburg II",
    awayTeamId: "776309033",
    venueName: "turmair Volleyballarena",
    locationId: "12233"
  },
  "3101": {
    matchId: "777353883",
    homeTeam: "VfL Oythe",
    homeTeamId: "776309103",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "Sporthalle Gymnasium Marienschule",
    locationId: "70012459"
  },
  "3094": {
    matchId: "777353834",
    homeTeam: "NawaRo Straubing",
    homeTeamId: "776308823",
    awayTeam: "Skurios Volleys Borken",
    awayTeamId: "776309313",
    venueName: "turmair Volleyballarena",
    locationId: "12233"
  },
  "3087": {
    matchId: "777353785",
    homeTeam: "ETV Hamburg",
    homeTeamId: "776309383",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "Sporthalle Hoheluft",
    locationId: "70012460"
  },
  "3080": {
    matchId: "777353736",
    homeTeam: "NawaRo Straubing",
    homeTeamId: "776308823",
    awayTeam: "SSC Freisen",
    awayTeamId: "776309453",
    venueName: "turmair Volleyballarena",
    locationId: "12233"
  },
  "3073": {
    matchId: "777353687",
    homeTeam: "TG Bad Soden",
    homeTeamId: "776309523",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "Odenwaldhalle",
    locationId: "70012461"
  },
  "3066": {
    matchId: "777353638",
    homeTeam: "NawaRo Straubing",
    homeTeamId: "776308823",
    awayTeam: "SV Lohhof",
    awayTeamId: "776309603",
    venueName: "turmair Volleyballarena",
    locationId: "12233"
  },
  "3059": {
    matchId: "777353589",
    homeTeam: "TV Planegg-Krailling",
    homeTeamId: "776309673",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "Feodor-Lynen-Gymnasium",
    locationId: "70012462"
  },
  "3052": {
    matchId: "777353540",
    homeTeam: "NawaRo Straubing",
    homeTeamId: "776308823",
    awayTeam: "TV Waldgirmes",
    awayTeamId: "776309795",
    venueName: "turmair Volleyballarena",
    locationId: "12233"
  },
  "3045": {
    matchId: "777353491",
    homeTeam: "Bayer-Volleys Leverkusen",
    homeTeamId: "776308933",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "Ostermann-Arena",
    locationId: "70012463"
  },
  "3038": {
    matchId: "777353442",
    homeTeam: "NawaRo Straubing",
    homeTeamId: "776308823",
    awayTeam: "DSHS SnowTrex Köln",
    awayTeamId: "776309243",
    venueName: "turmair Volleyballarena",
    locationId: "12233"
  },
  "3031": {
    matchId: "777353393",
    homeTeam: "TV Dingolfing",
    homeTeamId: "776309863",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "Sporthalle Höll-Ost",
    locationId: "70012464"
  },
  "3024": {
    matchId: "777353344",
    homeTeam: "NawaRo Straubing",
    homeTeamId: "776308823",
    awayTeam: "ESA Grimma Volleys",
    awayTeamId: "776309173",
    venueName: "turmair Volleyballarena",
    locationId: "12233"
  },
  "3017": {
    matchId: "777353295",
    homeTeam: "Rote Raben Vilsbiburg II",
    homeTeamId: "776309033",
    awayTeam: "NawaRo Straubing",
    awayTeamId: "776308823",
    venueName: "Ballsporthalle Vilsbiburg",
    locationId: "70012465"
  },
  "3010": {
    matchId: "777353246",
    homeTeam: "NawaRo Straubing",
    homeTeamId: "776308823",
    awayTeam: "VfL Oythe",
    awayTeamId: "776309103",
    venueName: "turmair Volleyballarena",
    locationId: "12233"
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
