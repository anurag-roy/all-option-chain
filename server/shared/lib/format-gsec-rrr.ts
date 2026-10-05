export function formatGsecRrr(value: number): string {
  // Show the first four decimal places, as in the requested RRR examples.
  return `${(Math.trunc(value * 10_000) / 10_000).toFixed(4)}%`;
}
