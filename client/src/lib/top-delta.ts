import type { OptionChainData, OptionChainRow } from '@shared/types/types';

export function getTop3DeltaTokens(rows: OptionChainRow[]): number[] {
  return [...rows]
    .filter((row) => row.av > 0)
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
    .slice(0, 3)
    .map((row) => row.instrumentToken);
}

export function getTop3DeltaSet(data: OptionChainData): Set<number> {
  return new Set(getTop3DeltaTokens(Object.values(data)));
}

export function hasTop3DeltaChanged(previous: Set<number>, next: Set<number>): boolean {
  if (previous.size !== next.size) {
    return true;
  }

  for (const token of next) {
    if (!previous.has(token)) {
      return true;
    }
  }

  return false;
}
