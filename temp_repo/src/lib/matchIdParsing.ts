export function extractMatchIdCandidate(html: string, matchNumber: string): string | null {
  const directRegex = new RegExp(
    `matchId=(\\d{8,10})[^\\n\\r]{0,300}${matchNumber}|${matchNumber}[^\\n\\r]{0,300}matchId=(\\d{8,10})`,
    "i"
  );
  const directMatch = html.match(directRegex);
  const directCandidate = directMatch?.[1] || directMatch?.[2];
  if (directCandidate) return directCandidate;

  const nearIndex = html.indexOf(matchNumber);
  if (nearIndex === -1) return null;

  const windowStart = Math.max(0, nearIndex - 4000);
  const windowEnd = Math.min(html.length, nearIndex + 4000);
  const snippet = html.slice(windowStart, windowEnd);
  const snippetMatch = snippet.match(/match[_-](\d{8,10})|matchId=(\d{8,10})/i);
  return snippetMatch?.[1] || snippetMatch?.[2] || null;
}
