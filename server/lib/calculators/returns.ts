const BID_BALANCE = 0.05;

export const calculateSellValue = (bid: number, lotSize: number) => (bid - BID_BALANCE) * lotSize;

export const calculateStrikePosition = (strike: number, ltp: number) => (Math.abs(strike - ltp) * 100) / ltp;

export const calculateReturnValue = (sellValue: number, orderMargin: number) => {
  if (orderMargin <= 0) {
    return 0;
  }
  return (sellValue * 100) / orderMargin;
};
