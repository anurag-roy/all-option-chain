export function formatGsecRrr(value: number): string {
  // Suppress numerical noise around exact four-decimal yields before truncating.
  value = Number(value.toFixed(10));
  return `${(Math.trunc(value * 10_000) / 10_000).toFixed(4)}%`;
}
