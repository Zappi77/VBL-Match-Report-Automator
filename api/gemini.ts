import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

const MODEL_FAST = "gemini-2.5-flash";
const MODEL_SMART = "gemini-2.5-flash";

const MAX_PROMPT_LENGTH = 20000;
const DEFAULT_ALLOWED_ORIGIN = "https://vbl-match-report-automator.vercel.app";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

function getHeader(req: VercelRequest, name: string): string {
  const value = req.headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function getAllowedOrigins(): string[] {
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const vercelOrigin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "";

  return Array.from(
    new Set([DEFAULT_ALLOWED_ORIGIN, vercelOrigin, ...configuredOrigins].filter(Boolean))
  );
}

function isAllowedOrigin(req: VercelRequest): boolean {
  const origin = getHeader(req, "origin");

  if (!origin) {
    return true;
  }

  return getAllowedOrigins().includes(origin);
}

function setApiSecurityHeaders(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
}

async function requireAdmin(req: VercelRequest): Promise<void> {
  const authorization = getHeader(req, "authorization");
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    throw new Error("Missing authorization token.");
  }

  const apiKey =
    process.env.FIREBASE_SERVER_API_KEY ||
    process.env.FIREBASE_WEB_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error("Firebase Auth API key is not configured.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken: token }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Invalid authorization token. ${errorText}`);
  }

  const data = await response.json();
  const customAttributes = data?.users?.[0]?.customAttributes;
  const claims = customAttributes ? JSON.parse(customAttributes) : {};

  if (claims.admin !== true) {
    throw new Error("Admin access required.");
  }
}

const matchSchema = {
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
    },
  },
  required: ["matchNumber", "homeTeam", "awayTeam"],
};

type GeminiMode =
  | "resolve_match_id_url_context"
  | "resolve_match_id_google_search"
  | "extract_match_data";

const allowedModes: GeminiMode[] = [
  "resolve_match_id_url_context",
  "resolve_match_id_google_search",
  "extract_match_data",
];

function getPrompt(req: VercelRequest): string {
  const prompt = req.body?.prompt;

  if (!prompt || typeof prompt !== "string") {
    throw new Error("Missing prompt.");
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error("Prompt too large.");
  }

  return prompt.trim();
}

function getMode(req: VercelRequest): GeminiMode {
  const mode = req.body?.mode;

  if (typeof mode !== "string" || !allowedModes.includes(mode as GeminiMode)) {
    throw new Error("Invalid mode.");
  }

  return mode as GeminiMode;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res);

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: "Forbidden origin." });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const contentType = getHeader(req, "content-type");

  if (!contentType.toLowerCase().includes("application/json")) {
    return res.status(415).json({ error: "Content-Type must be application/json." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Gemini API key is not configured." });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    console.warn("Gemini API unauthorized request:", error);
    return res.status(403).json({ error: "Admin access required." });
  }

  let prompt: string;
  let mode: GeminiMode;

  try {
    prompt = getPrompt(req);
    mode = getMode(req);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid request.",
    });
  }

  try {
    if (mode === "resolve_match_id_url_context") {
      const response = await ai.models.generateContent({
        model: MODEL_FAST,
        contents: prompt,
        config: {
          tools: [{ urlContext: {} }],
        },
      });

      return res.status(200).json({
        text: response.text ?? "",
      });
    }

    if (mode === "resolve_match_id_google_search") {
      const response = await ai.models.generateContent({
        model: MODEL_FAST,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      return res.status(200).json({
        text: response.text ?? "",
      });
    }

    if (mode === "extract_match_data") {
      const response = await ai.models.generateContent({
        model: MODEL_SMART,
        contents: prompt,
        config: {
          tools: [{ urlContext: {} }, { googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: matchSchema,
          systemInstruction:
            "Du bist ein präziser Daten-Extraktor für Volleyball-Spielberichte. Antworte ausschließlich mit validem JSON gemäß Schema. Leere Felder = leerer String. Halluziniere keine Daten.",
        },
      });

      return res.status(200).json({
        text: response.text ?? "",
      });
    }

    return res.status(400).json({ error: "Unsupported mode." });
  } catch (error) {
    console.error("Gemini API route failed:", error);

    return res.status(500).json({
      error: "Gemini request failed.",
    });
  }
}