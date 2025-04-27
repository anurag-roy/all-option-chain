-- CreateTable
CREATE TABLE "instrument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchange" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "lotSize" REAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "tradingSymbol" TEXT NOT NULL,
    "expiry" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "optionType" TEXT NOT NULL,
    "strikePrice" REAL NOT NULL,
    "tickSize" TEXT NOT NULL,
    "dv" REAL,
    "av" REAL
);
