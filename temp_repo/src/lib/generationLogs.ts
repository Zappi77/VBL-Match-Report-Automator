export function buildGenerationStartLogs(
  isKnown: boolean,
  manualMatchId: string,
  allowAiFallback: boolean
): string[] {
  let initialLog = isKnown
    ? "Direktzugriff auf Master-Datenbank (Spiel bekannt)..."
    : "Initialisiere Suche...";

  if (manualMatchId) {
    initialLog = `Nutze manuelle Match-ID: ${manualMatchId}...`;
  }

  const aiModeLog = allowAiFallback
    ? "Resolver-Modus: Direct Scraping + KI-Fallback"
    : "Resolver-Modus: Nur Direct Scraping (KI deaktiviert)";

  return [initialLog, aiModeLog];
}
