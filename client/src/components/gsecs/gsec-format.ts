const bondDateFormat = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export const formatBondDate = (value: string) => bondDateFormat.format(new Date(`${value}T00:00:00Z`));
export const formatNumber = (value: number | null | undefined, digits = 2) =>
  value == null ? '—' : value.toFixed(digits);
export const formatDurationMonths = (years: number | null | undefined, digits = 2) =>
  formatNumber(years == null ? years : years * 12, digits);
export const formatMoney = (value: number | null | undefined, digits = 2) =>
  value == null ? '—' : `₹${value.toFixed(digits)}`;
export const formatPercent = (value: number | null | undefined, digits = 4) =>
  value == null ? '—' : `${value.toFixed(digits)}%`;
export const formatSignedPercent = (value: number | null | undefined, digits = 2) =>
  value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
