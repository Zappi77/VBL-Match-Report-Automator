import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

const MODEL_FAST = "gemini-3-flash-preview";
const MODEL_SMART = "gemini-3.1-pro-preview";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

function getPrompt(req: VercelRequest): string {
  const prompt = req.body?.prompt;

  if (!prompt || typeof prompt !== "string") {
    throw new Error("Missing prompt.");
  }

  if (prompt.length > 20000) {
    throw new Error("Prompt too large.");
  }

  return prompt;
}

function getMode(req: VercelRequest): GeminiMode {
  const mode = req.body?.mode;

  const allowedModes: GeminiMode[] = [
    "resolve_match_id_url_context",
    "resolve_match_id_google_search",
    "extract_match_data",
  ];

  if (!allowedModes.includes(mode)) {
    throw new Error("Invalid mode.");
  }

  return mode;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Gemini API key is not configured." });
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
