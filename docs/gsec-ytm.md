# G-Sec pricing and Tier 1 analytics

`RRR (YTM)` and `RRR Rank` use quoted annual yield to maturity. This replaces the previous coupon-number / seller-price current-yield calculation. Inputs remain restricted to pledgeable G-Secs and the lowest valid seller price. Buyers and LTP are never substituted.

For ₹100 face value, normalized coupon `676` means ₹6.76 annually and ₹3.38 per half year. Fixed-coupon Government of India bonds redeem ₹100 at maturity. Coupon dates are generated every six calendar months backwards from the exact maturity date, retaining the original day and clamping it where a month is shorter. Only coupons after settlement enter the calculation.

The seed finds the first trading day on or after today's IST date, then the next clearing business day for T+1 settlement. Weekends, trading holidays and clearing holidays are handled separately. If NSE has not published calendar coverage for a required year, the seed stops instead of assuming a settlement date.

Let `C` be the half-year coupon, `n` the number of remaining coupons, and `f` the European 30/360 days from settlement to the next coupon divided by 180. The calculator solves for quoted annual yield `y`:

```text
Seller price = Σ(i = 0 … n−1) C / (1 + y/2)^(f+i)
             + 100 / (1 + y/2)^(f+n−1)
RRR = 100 × y, displayed as a percentage
```

NSE's capital-market G-Sec quotes are **dirty prices**, including accrued interest. The supported BSE counterparts are active G-group securities marked `FinInstrmTp=D` (dirty-price debt) in BSE's daily master. For both exchanges, the seller price is the purchase-price input directly; no accrued interest is added. This differs from the clean-price assumption in the supplied ChatGPT conversation. A broker-available BSE counterpart with another quote convention aborts the seed rather than silently applying the dirty-price calculation.

The rate is quoted annual YTM (twice the half-year yield). The effective annual yield `(1+y/2)^2−1` is not displayed. The calculation excludes taxes and transaction fees.

The numerical solver verifies a bracket and accommodates negative or unusually high yields. Rankings use full precision with competition ranks for exact ties. Display uses four decimal places. Missing sellers, matured bonds and unsolvable inputs have no YTM rank. The table shows RRR Rank in its second column and defaults to ascending order. Its column header toggles ascending/descending, keeping unranked bonds last. The API retains face-value distance and Near FV ranks, but the page does not display them or offer ranking tabs.

## Target YTM and maximum buy price

The scanner accepts a target quoted annual YTM from 0% to 100%, defaulting to 8%. One target applies to every pledgeable bond in that browser. The existing coupon schedule and 30E/360 fraction are used in the forward pricing equation above, with `y = target YTM / 100`. This gives the theoretical maximum **dirty** buy price. The displayed `Buy Rate` is floored to each listing's trading tick using integer paise. NSE uses ₹0.01; the matched BSE listings currently use ₹0.01 or ₹0.05. Thus an NSE ceiling of ₹103.16 becomes ₹103.15 on a BSE counterpart with a ₹0.05 tick. Accrued interest is not added.

Only a valid seller price at or below that floored ceiling receives a green highlight. Other rows remain visible with their usual rankings. A ceiling can be calculated even without sellers; matured or invalid bonds have no ceiling. As with current YTM, the calculation excludes fees and taxes. The scanner's existing disconnected status still applies to retained quotes.

For `733GS2026-GS`, settlement 8 October 2026 and target 8%, the theoretical price is ₹103.1692561862, so the ceiling is **₹103.16**. A seller at ₹103.15 qualifies; a seller at ₹103.17 does not. For `709GS2054-GS`, the same settlement/target produces **₹91.13**. All 18 examples in the supplied target-YTM note are covered by numerical checks.

`GET /api/gsecs/target-prices?targetYtm=8` calculates ceilings server-side from the cached daily SQLite catalog. Its `prices` and `theoreticalPrices` maps use `EXCHANGE:tradingsymbol` keys, for example `NSE:733GS2026-GS` and `BSE:733GS2026`. `prices` contains tick-floored buy ceilings; `theoreticalPrices` contains unrounded dirty prices for the Bond Card. It does not fetch broker quotes or external reference data. The client caches each target/settlement/seed combination and requests new ceilings when one changes, debouncing target edits by 300ms. The seed identity ensures newly approved bonds get ceilings even when consecutive non-trading days share a settlement date. The existing ticker updates the seller-price comparison as quotes change. Old target/date/seed responses are excluded from highlighting while new ceilings are pending.

## Risk and exact scenarios

`gsec-cash-flows.ts` supplies the same coupon schedule and discount periods to YTM, target pricing and `gsec-analytics.ts`. Each row's `analytics` is calculated server-side from its own exchange's best seller price and included in HTTP and live websocket snapshots. Risk and carry update with seller ticks, without extra broker requests. Unchanged prices and terms reuse the previous snapshot's analytics; settlement or term changes invalidate that reuse, while quantities and depth still update. Missing sellers, matured bonds and invalid or unsolvable inputs have `analytics: null`. A valid YTM is retained if an extreme shocked yield cannot be priced; the affected scenario or finite-difference metric is null.

Let `P(y)` be the unrounded dirty price, `CF_i` the cash flow, `t_i = (f+i)/2` its year fraction, and `h = 0.0001` an annual yield change of 1 bp. Here `y` is the quoted annual yield as a decimal:

```text
PV_i = CF_i / (1 + y/2)^(f+i)
Macaulay duration = Σ(t_i × PV_i) / P(y)
Modified duration = Macaulay duration / (1 + y/2)
DV01 = (P(y−h) − P(y+h)) / 2
Convexity = (P(y−h) + P(y+h) − 2P(y)) / (P(y) × h²)
```

Macaulay and modified duration are in years; DV01 is the positive rupee sensitivity per ₹100 face value; convexity is in years squared. DV01 and convexity use symmetric ±1 bp repricing without rounding intermediate prices. Scenarios reprice the complete remaining cash flows at annual yield shocks of ±10, ±25, ±50 and ±100 bp, plus the current-price baseline. These are theoretical dirty prices, without trading-tick flooring. Percentage changes compare each scenario directly with the current seller price.

## Carry at unchanged YTM

The Bond Card shows 1M, 3M, 6M and 1Y gross holding-period returns. Horizons add calendar months to settlement, retain the original day and clamp shorter months. Analytical horizons are not shifted for weekends or holidays. The ending dirty price uses the current quoted YTM at the horizon date. Coupons received are held as cash, with no reinvestment, annualization, fees or taxes:

```text
Return (%) = 100 × (ending dirty price + coupons + redemption − purchase price) / purchase price
```

Coupons paid on the horizon date are included in received cash and excluded from the ending bond price. If maturity is on or before a selected horizon, the effective horizon is maturity, the ending price is zero after redemption, and ₹100 principal plus the final coupon are included exactly once. A bond maturing before a selected horizon is labeled accordingly; its return is through maturity, with no assumed income on the redeemed cash afterwards.

The Bond Card replaces the Market Depth dialog and includes pricing, risk, carry, scenario tables and a price-versus-yield-shock chart, followed by the existing top-five seller depth. Green indicates only a seller price at or below the tick-floored target buy ceiling. Scenario losses use amber styling separately from target eligibility. The scanner retains sortable ascending RRR Rank and adds modified duration, DV01 and convexity.

Tier 2 uses an independent, dated CCIL sovereign NSS curve. No local seller-derived interpolation or sample parameters are substituted for a benchmark feed. The scenario chart and benchmark zero-curve chart are separate displays.

## CCIL curve and relative value (Tier 2)

`db:seed` makes one unauthenticated GET to [CCIL's NSS parameter table](https://www.ccilindia.com/zcyc-parameters), validating its named table, headers, six finite parameters, positive tau values and real reference dates. The source has returned ISO timestamps to curl and `DD-MM-YYYY` to Node; both observed formats are parsed explicitly. Failed imports are recorded without aborting the instrument/G-Sec seed. Runtime never contacts CCIL.

Snapshots and corrections are retained in `gsec_curve_snapshots`, with the source URL/hash, reference date, retrieval time, first-observation time, method, six parameters, conventions and supported tenor range. `gsec_curve_seed_state` records the last attempt. The public feed does not expose an actual publication timestamp: it stays null rather than being invented from the approximately 7 p.m. release schedule. First observation is the conservative availability time. A curve cannot be applied to a quote received before it was available; reference dates alone do not establish availability. Seller quote timestamps here are server receipt timestamps.

The user explicitly approved **ACT/365 with continuous discounting as the app's convention** on 9 October 2026. CCIL's working paper documents exponential discounting, but the public feed's exact day-count remains unconfirmed. The app convention is persisted and configurable; it is not silently presented as a provider-verified convention. Cash-flow tenors are measured from the seeded settlement date (or analytical horizon), keeping the selected dated curve shape unchanged. The adapter supports the public curve's displayed 0–50-year range and refuses cash flows outside it.

```text
z(t) = beta0 + (beta1 + beta2) × A(t/tau1) − beta2 × exp(−t/tau1)
       + beta3 × A(t/tau2) − beta3 × exp(−t/tau2)
A(x) = (1 − exp(−x)) / x; A(0) = 1
DF(t) = exp[−(z(t)/100) × t]
Fair dirty price = Σ(CF_i × DF(t_i))
Fair YTM = existing semiannual 30E/360 bond solver at fair dirty price
Spread (bp) = 100 × (market YTM percent − fair YTM percent)
Fair − sell amount = fair dirty price − market dirty price
```

The fair YTM is solved from the full discounted cash-flow price; the maturity zero rate is not used as a substitute. Fair valuations are cached by bond terms, settlement and curve version, shared across NSE/BSE. Each venue's own seller price drives its spread and roll estimates. Missing sellers leave fair valuation available, with spread/RV/market carry unavailable.

For **Carry + Roll**, reprice remaining cash flows at each 1M/3M/6M/1Y horizon using today's curve at shorter remaining tenors, solve horizon fair YTM, then add the current market-minus-fair YTM spread. Reprice the bond at that spread-preserved horizon YTM, including the same coupons held as cash and maturity cap as unchanged-YTM carry. This is not a forward-curve or spread-convergence forecast. Tier 3 convergence forecasts, implied forwards, z-scores and in-house curve fitting remain deferred.

| Setting | Default | Behavior |
| --- | --- | --- |
| `GSEC_CURVE_DAY_COUNT` | `ACT/365` | Alternative explicit conventions: `ACT/360`, `30E/360` |
| `GSEC_CURVE_COMPOUNDING` | `continuous` | Alternative explicit conventions: `annual`, `semiannual` |
| `GSEC_CURVE_MAX_AGE_DAYS` | `7` | Maximum reference-date age in calendar days; previous-day and weekend curves are allowed |
| `GSEC_RV_THRESHOLD_BP` | `5` | Nonnegative FAIR spread band, configurable in `.env` |

CHEAP means spread > threshold; RICH means spread < −threshold; equality on either boundary is FAIR. CHEAP is blue, RICH amber and FAIR neutral. Green remains driven only by Sell <= tick-floored Buy Rate. The Bond Card identifies CCIL/reference date/conventions, shows both carry models and a local zero-rate chart with the selected market and fair bond YTMs labeled separately.

The runtime catalog reads SQLite once per IST day and chooses the latest curve known as of valuation. A failed import can reuse a previously stored curve within the age limit, with the fallback identified in the Bond Card. Missing, stale, inconsistent or unsupported curve data leaves standalone YTM, target pricing, risk and scenarios available. Restart after same-day reseeding. Changing conventions requires reseeding and restart; changing the RV threshold requires restart.

### Tier 2 golden fixture

For the same 709GS2054 bond below, using the resolution note's CCIL parameters dated 8 October 2026:

| Field | Expected value |
| --- | ---: |
| Fair dirty price | ₹93.7053059191 |
| Fair quoted YTM | 7.7528734851% |
| Market − fair spread / RV at 5 bp | −14.76408848 bp / RICH |
| Fair − sell | −₹1.5946940809 |
| 1Y fair curve price / fair YTM | ₹93.8539285804 / 7.7465056879% |
| 1Y assumed YTM, spread preserved | 7.5988648031% |
| 1Y horizon market price | ₹95.4348697599 |
| 1Y Carry + Roll | 7.5811854774% |

These values are unit-test fixtures only. Production reads current seeded parameters; no fixed fixture is used as a live fallback.

## Tier 1 worked fixture

For `709GS2054-GS`, maturity **5 August 2054**, settlement **8 October 2026**, coupon **7.09%** and dirty seller price **₹95.30**:

| Field | Expected value |
| --- | ---: |
| Current quoted YTM | 7.6052326003% |
| Next coupon / remaining coupons | 5 February 2027 / 56 |
| Theoretical price at 8% / NSE Buy Rate | ₹91.1324325967 / ₹91.13 |
| Macaulay / modified duration | 11.9285014670 / 11.4915229424 |
| DV01 / convexity | ₹0.1095142916 / 215.968726 |
| −50 bp / +50 bp dirty price | ₹101.0430364146 / ₹90.0721180530 |
| 1Y ending dirty price / coupons received | ₹95.3657947448 / ₹7.09 |
| 1Y unchanged-YTM holding return | 7.5087038245% |

The approved reference notes' fixture and edge cases are covered by focused calculator tests, including negative yields, coupon-date horizons, calendar month ends and maturity before or exactly on a horizon.

## Example

For `676GS2061-GS`, maturity is 22 February 2061 and coupons fall on 22 February and 22 August.

- With settlement **6 October 2026**, dirty price **₹90.2374** gives quoted YTM **7.6339793917%**, reproducing the conversation's final numerical inputs.
- With the same settlement, an **NSE seller price of ₹89.43** is already dirty and gives **7.7079062040%**. Adding the conversation's ₹0.8074 again would calculate a different purchase price.
- A trade on **6 October 2026** uses **7 October 2026** settlement. At an NSE seller price of **₹89.43**, that gives **7.7096404124%** quoted YTM.

## Daily reference data

`npm run data:prepare` applies the migration and runs the seed. Exact maturity dates are matched by ISIN from NSE's daily debt master, supplemented by `server/scripts/data/legacy-gsecs.ts` for 36 older issues omitted from that master when checked on 6 October 2026. Those fixed coupon rates and maturity dates were transcribed from Statement 3 of the Government of India's January–March 2021 public-debt report. The ISIN/symbol associations come from Zerodha's approved feed. No security becomes pledgeable merely because it appears in the reference file.

The seed also downloads [BSE's daily security master ZIP](https://www.bseindia.com/downloads/Help/file/SCRIP.zip), extracting only `BSE_EQ_SCRIP_DDMMYYYY.csv`. It matches active BSE G-Secs to the approved NSE bonds by ISIN, then matches `FinInstrmId` to Kite's BSE `exchange_token`. BSE symbols need not resemble NSE names: `709GS2054-GS` and `709GOI54` share ISIN `IN0020240118`. Every matched BSE listing copies the resolved NSE coupon, maturity and ISIN, and uses the same seeded settlement date. Its BSE symbol, instrument token and tick remain separate. Missing BSE counterparts are omitted; BSE-only ISINs outside the approved NSE universe are excluded.

Both venues appear as separate table rows in a combined YTM ranking. A dot to the left of the name identifies BSE (black in light mode, white in dark mode). Quote caches, ticker routing, target prices, table keys and seller-depth lookups all use the exchange plus symbol; one venue's sellers are never used for another. `GET /api/gsecs/depth` accepts `exchange=NSE|BSE` alongside `tradingsymbol`, defaulting to NSE when omitted.

The seed rejects unknown terms, disagreement between sources, incompatible coupons/years, missing NSE tokens, inconsistent BSE identifiers/ticks/face values, unsupported matched BSE quote conventions and source failures before replacing the database snapshot. A failed BSE download does not become an apparently successful NSE-only seed. All runtime metadata is read from SQLite and cached for the IST day. Restart after reseeding during the same day. Pre-YTM database rows also require reseeding.

## Sources

- [CCIL NSS parameter page](https://www.ccilindia.com/zcyc-parameters), [public 0–50-year curve](https://www.ccilindia.com/curve), and [operational release description](https://www.ccilindia.com/operational-aspects).
- [CCIL working paper WP/014](https://www.ccilindia.com/documents/d/ccil/WP014%20Modelling%20Issues%20in%20Efficient%20Term%20Structure%20Estimation-%20A%20Study%20of%20the%20Indian%20Government%20Securities%20Market%20(2)-pdf), equations 2–4: NSS, exponential discount factor and cash-flow valuation.

- [NSE capital-market Government Securities specifications](https://www.nseindia.com/static/products-services/traded-on-cm): ₹100 face value and dirty-price quotation.
- [Zerodha explanation of G-Sec dirty prices](https://support.zerodha.com/category/trading-and-markets/general-kite/govt-securities/articles/g-sec-buy-average-dirty-price).
- [RBI G-Sec FAQ](https://m.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=711): fixed coupons, semiannual payments, T+1 settlement, and Excel YIELD basis 4 / 30/360 (sections 1, 16, 24–25).
- [NSE settlement cycle](https://www.nseindia.com/static/products-services/equity-market-settlement-cycle): settlement excludes weekends, exchange holidays and bank holidays.
- [NSE debt master](https://nsearchives.nseindia.com/content/equities/DEBT.csv) and [download page](https://www.nseindia.com/static/market-data/securities-available-for-trading).
- [BSE daily security master](https://www.bseindia.com/downloads/Help/file/SCRIP.zip): ISIN, scrip code, symbol, group, active status, quote type, tick and face value (in paise).
- [NSE trading calendar](https://www.nseindia.com/api/holiday-master?type=trading) and [clearing calendar](https://www.nseindia.com/api/holiday-master?type=clearing), using the `CM` arrays.
- [Government of India public-debt report, January–March 2021](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2021/jun/doc202162531.pdf): Statement 3, printed pages 24–26.
- [Zerodha approved securities](https://zerodha.com/approved-securities/) and [public feed](https://public.zrd.sh/crux/approved-securities.json).
