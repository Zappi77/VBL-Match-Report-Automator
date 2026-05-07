export function appendUniqueStatus(prev: string[], status: string): string[] {
  if (prev[prev.length - 1] === status) return prev;
  return [...prev, status];
}
