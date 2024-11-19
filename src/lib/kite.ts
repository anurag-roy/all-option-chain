export type Basket = {
  product: 'BO' | 'CNC' | 'CO' | 'MIS' | 'NRML';
  exchange: 'NSE' | 'NFO' | 'MCX' | 'CDS' | 'BSE' | 'BFO' | 'BCD';
  tradingsymbol: string;
  quantity: number;
  transaction_type: 'BUY' | 'SELL';
  order_type: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
  price: number | undefined;
};

export const getKiteBasket = (stocks: { tradingSymbol: string; quantity: number; price: number }[]) => {
  const basketValue: Basket[] = stocks.map((stock) => ({
    product: 'NRML',
    exchange: 'NSE',
    tradingsymbol: stock.tradingSymbol.replace('-EQ', ''),
    quantity: stock.quantity,
    transaction_type: 'BUY',
    order_type: 'LIMIT',
    price: stock.price,
  }));
  return basketValue;
};
