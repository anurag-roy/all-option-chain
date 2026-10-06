# G-Sec yield calculation

`RRR (YTM)` and `Best RRR Rank` use quoted annual yield to maturity. This replaces the previous coupon-number / seller-price current-yield calculation. Inputs remain restricted to pledgeable G-Secs and the lowest valid seller price. Buyers and LTP are never substituted.

For ₹100 face value, normalized coupon `676` means ₹6.76 annually and ₹3.38 per half year. Fixed-coupon Government of India bonds redeem ₹100 at maturity. Coupon dates are generated every six calendar months backwards from the exact maturity date, retaining the original day and clamping it where a month is shorter. Only coupons after settlement enter the calculation.

The seed finds the first trading day on or after today's IST date, then the next clearing business day for T+1 settlement. Weekends, trading holidays and clearing holidays are handled separately. If NSE has not published calendar coverage for a required year, the seed stops instead of assuming a settlement date.

Let `C` be the half-year coupon, `n` the number of remaining coupons, and `f` the European 30/360 days from settlement to the next coupon divided by 180. The calculator solves for quoted annual yield `y`:

```text
Seller price = Σ(i = 0 … n−1) C / (1 + y/2)^(f+i)
             + 100 / (1 + y/2)^(f+n−1)
RRR = 100 × y, displayed as a percentage
```

NSE's capital-market G-Sec quotes are **dirty prices**, including accrued interest. The seller price is the purchase-price input directly; no accrued interest is added. This differs from the clean-price assumption in the supplied ChatGPT conversation.

The rate is quoted annual YTM (twice the half-year yield). The effective annual yield `(1+y/2)^2−1` is not displayed. The calculation excludes taxes and transaction fees.

The numerical solver verifies a bracket and accommodates negative or unusually high yields. Rankings use full precision with competition ranks for exact ties. Display uses four decimal places. Missing sellers, matured bonds and unsolvable inputs have no YTM rank. Near FV remains `ABS(seller price − 100)` and can rank a valid seller price independently of YTM.

## Example

For `676GS2061-GS`, maturity is 22 February 2061 and coupons fall on 22 February and 22 August.

- With settlement **6 October 2026**, dirty price **₹90.2374** gives quoted YTM **7.6339793917%**, reproducing the conversation's final numerical inputs.
- With the same settlement, an **NSE seller price of ₹89.43** is already dirty and gives **7.7079062040%**. Adding the conversation's ₹0.8074 again would calculate a different purchase price.
- A trade on **6 October 2026** uses **7 October 2026** settlement. At an NSE seller price of **₹89.43**, that gives **7.7096404124%** quoted YTM.

## Daily reference data

`npm run data:prepare` applies the migration and runs the seed. Exact maturity dates are matched by ISIN from NSE's daily debt master, supplemented by `server/scripts/data/legacy-gsecs.ts` for 36 older issues omitted from that master when checked on 6 October 2026. Those fixed coupon rates and maturity dates were transcribed from Statement 3 of the Government of India's January–March 2021 public-debt report. The ISIN/symbol associations come from Zerodha's approved feed. No security becomes pledgeable merely because it appears in the reference file.

The seed rejects unknown terms, disagreement between sources, incompatible coupons/years, and missing instrument tokens before replacing the database snapshot. All runtime metadata is read from SQLite and cached for the IST day. Restart after reseeding during the same day. Pre-YTM database rows also require reseeding.

## Sources

- [NSE capital-market Government Securities specifications](https://www.nseindia.com/static/products-services/traded-on-cm): ₹100 face value and dirty-price quotation.
- [Zerodha explanation of G-Sec dirty prices](https://support.zerodha.com/category/trading-and-markets/general-kite/govt-securities/articles/g-sec-buy-average-dirty-price).
- [RBI G-Sec FAQ](https://m.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=711): fixed coupons, semiannual payments, T+1 settlement, and Excel YIELD basis 4 / 30/360 (sections 1, 16, 24–25).
- [NSE settlement cycle](https://www.nseindia.com/static/products-services/equity-market-settlement-cycle): settlement excludes weekends, exchange holidays and bank holidays.
- [NSE debt master](https://nsearchives.nseindia.com/content/equities/DEBT.csv) and [download page](https://www.nseindia.com/static/market-data/securities-available-for-trading).
- [NSE trading calendar](https://www.nseindia.com/api/holiday-master?type=trading) and [clearing calendar](https://www.nseindia.com/api/holiday-master?type=clearing), using the `CM` arrays.
- [Government of India public-debt report, January–March 2021](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2021/jun/doc202162531.pdf): Statement 3, printed pages 24–26.
- [Zerodha approved securities](https://zerodha.com/approved-securities/) and [public feed](https://public.zrd.sh/crux/approved-securities.json).
