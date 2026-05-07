import assert from "node:assert/strict";
import test from "node:test";
import { buildGenerationStartLogs } from "./generationLogs";

test("buildGenerationStartLogs for known match with AI fallback", () => {
  const logs = buildGenerationStartLogs(true, "", true);
  assert.equal(logs[0], "Direktzugriff auf Master-Datenbank (Spiel bekannt)...");
  assert.equal(logs[1], "Resolver-Modus: Direct Scraping + KI-Fallback");
});

test("buildGenerationStartLogs prefers manual matchId and logs AI-off mode", () => {
  const logs = buildGenerationStartLogs(false, "777123456", false);
  assert.equal(logs[0], "Nutze manuelle Match-ID: 777123456...");
  assert.equal(logs[1], "Resolver-Modus: Nur Direct Scraping (KI deaktiviert)");
});
