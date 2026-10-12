/** The base is a shock in bp; the five doubled values are mirrored around zero. */
export function gsecScenarioShocks(base: number): number[] {
  const positive = [1, 2, 4, 8, 16].map((factor) => (base + 5) * factor);
  return [...new Set([base, ...positive, ...positive.map((shock) => -shock)])].sort((a, b) => a - b);
}
