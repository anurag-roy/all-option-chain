# G-Sec yield calculation

`RRR (YTM)` and `RRR Rank` use quoted annual yield to maturity. This replaces the previous coupon-number / seller-price current-yield calculation. Inputs remain restricted to pledgeable G-Secs and the lowest valid seller price. Buyers and LTP are never substituted.

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

The numerical solver verifies a bracket and accommodates negative or unusually high yields. Rankings use full precision with competition ranks for exact ties. Display uses four decimal places. Missing sellers, matured bonds and unsolvable inputs have no YTM rank. The table shows RRR Rank in its second column and defaults to ascending order. Its column header toggles ascending/descending, keeping unranked bonds last. The API retains face-value distance and Near FV ranks, but the page does not display them or offer ranking tabs.

## Target YTM and maximum buy price

The scanner accepts a target quoted annual YTM from 0% to 100%, defaulting to 8%. One target applies to every pledgeable bond in that browser. The existing coupon schedule and 30E/360 fraction are used in the forward pricing equation above, with `y = target YTM / 100`. This gives the theoretical maximum **dirty** buy price. The displayed `Max Buy Price` is `floor(theoretical price × 100) / 100`, floored to NSE's ₹0.01 tick. Accrued interest is not added.

Only a valid seller price at or below that floored ceiling receives a green highlight. Other rows remain visible with their usual rankings. A ceiling can be calculated even without sellers; matured or invalid bonds have no ceiling. As with current YTM, the calculation excludes fees and taxes. The scanner's existing disconnected status still applies to retained quotes.

For `733GS2026-GS`, settlement 8 October 2026 and target 8%, the theoretical price is ₹103.1692561862, so the ceiling is **₹103.16**. A seller at ₹103.15 qualifies; a seller at ₹103.17 does not. For `709GS2054-GS`, the same settlement/target produces **₹91.13**. All 18 examples in the supplied target-YTM note are covered by numerical checks.

`GET /api/gsecs/target-prices?targetYtm=8` calculates ceilings server-side from the cached daily SQLite catalog. It does not fetch broker quotes or external reference data. The client caches each target/settlement/seed combination and requests new ceilings when one changes, debouncing target edits by 300ms. The seed identity ensures newly approved bonds get ceilings even when consecutive non-trading days share a settlement date. The existing ticker updates the seller-price comparison as quotes change. Old target/date/seed responses are excluded from highlighting while new ceilings are pending.

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
