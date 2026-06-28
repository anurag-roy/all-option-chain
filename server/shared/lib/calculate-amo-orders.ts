import type { AmoOrderItem, AmoStockRow } from '@shared/schemas/amo';

export function calculateAmoOrders(values: AmoStockRow): AmoOrderItem[] {
  const { isAmo, tradingsymbol, value, ltp, lowerCircuit, leg1, leg2, leg3 } = values;
  const prices: number[] = [];
  let currentValue = ltp;
  let totalValue = 0;

  const addPrice = (diff: number) => {
    currentValue = Number((currentValue - diff).toFixed(2));
    totalValue += currentValue;
    prices.push(currentValue);
  };

  addPrice(leg1);

  while (currentValue >= lowerCircuit && totalValue < value) {
    addPrice(leg2);
    if (currentValue < lowerCircuit || totalValue > value) {
      break;
    }
    addPrice(leg3);
  }

  if (prices.length === 0) {
    return [];
  }

  const lastPrice = prices.pop()!;
  totalValue = Number((totalValue - lastPrice).toFixed(2));
  const quantity = Math.max(Math.floor(value / totalValue), 1);

  return prices.map((price) => ({
    isAmo,
    tradingsymbol,
    price,
    quantity,
  }));
}
