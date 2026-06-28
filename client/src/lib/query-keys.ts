export const queryKeys = {
  user: {
    profile: ['userProfile'] as const,
    margin: ['userMargin'] as const,
  },
  chain: {
    expiries: ['chainExpiries'] as const,
    status: ['chainStatus'] as const,
  },
  orders: {
    quote: (instrumentToken: number) => ['orderQuote', instrumentToken] as const,
    margin: (tradingsymbol: string, price: number, quantity: number) =>
      ['orderMargin', tradingsymbol, price, quantity] as const,
  },
} as const;
