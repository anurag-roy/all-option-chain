# G-Sec Opportunity Rating

The Bond Card's Rating summarizes four server-calculated factors. It never changes the price-based `BUY ZONE`/`WAIT` decision, which remains `Sell Rate <= tick-floored Buy Rate`. Each venue uses its own best valid seller price; buyer prices and last-trade prices are excluded.

This implements the supplied G-Sec Opportunity Rating Framework technical note, with the user's explicit override retaining the app's existing no-staleness behavior. Quote age does not disable Rating or BUY/WAIT. Existing curve validity and missing/invalid/future exchange-time checks remain in effect.

## Scores and weights

All yields and returns below are percentage values (8 means 8%); spreads are in basis points. `clamp` bounds a score to 0–100.

| Factor           | Raw metric                                     | Score                                        | Weight |
| ---------------- | ---------------------------------------------- | -------------------------------------------- | ------ |
| Target Fit       | `gapBp = (currentYtm - targetYtm) * 100`       | `clamp(100 + 4 * gapBp)`                     | 40%    |
| Relative Value   | Signed `zSpreadBp`                             | `clamp(50 + 5 * zSpreadBp)`                  | 25%    |
| Carry + Roll     | `ratioPercent = 100 * carryRoll1Y / targetYtm` | `clamp(ratioPercent)`                        | 20%    |
| Rate Sensitivity | Exact +80 bp price change                      | `clamp(100 * (1 - abs(changePercent) / 12))` | 15%    |

Carry + Roll always uses the standard 12-month constant-Z-spread gross return. Rate Sensitivity always reprices all remaining cash flows at current YTM + 0.8 percentage points. Neither depends on the selected Scenario Base or custom carry horizon. If maturity occurs before one year, the existing carry convention stops at maturity without annualizing the result.

Each unrounded score is multiplied by its weight. Contributions round to two decimals, and the displayed overall score sums those rounded contributions so the breakdown reconciles exactly. Missing or non-finite factors leave the overall score unavailable; remaining weights are never rescaled. A zero target YTM remains valid for price ceilings and entry decisions, but makes the carry ratio and overall rating unavailable.

## Color bands

Raw factor colors are independent of overall score colors.

| Color  | Target gap (bp) | Signed Z-spread (bp) | Carry as % of target | Absolute +80 bp loss |
| ------ | --------------- | -------------------- | -------------------- | -------------------- |
| Blue   | ≥0              | ≥10                  | ≥100%                | ≤2%                  |
| Green  | ≥−5 to <0       | ≥3 to <10            | ≥90% to <100%        | >2% to ≤4.5%         |
| Yellow | ≥−10 to <−5     | ≥−3 to <3            | ≥75% to <90%         | >4.5% to ≤7%         |
| Orange | ≥−20 to <−10    | ≥−10 to <−3          | ≥50% to <75%         | >7% to ≤10%          |
| Red    | <−20            | <−10                 | <50%                 | >10%                 |

Overall bands: below 20 red (Worst / Danger), below 40 orange (Very Cautious / Almost Danger), below 60 yellow (Fair but Cautious), below 80 green (Fair and Clean), and 80–100 blue (One of the Best).

The existing CHEAP/FAIR/RICH classification continues to describe the secondary market-minus-fair YTM spread. It is separate from the signed Z-spread rating factor. Scanner sorting uses the absolute Z-spread while the rating uses its sign.

## Worked fixture

For current YTM 7.8496%, target 8%, Z-spread +0.41 bp, 1Y Carry + Roll 7.7218% and +80 bp exact price change −8.34%:

| Factor           | Score | Contribution | Raw color |
| ---------------- | ----: | -----------: | --------- |
| Target Fit       | 39.84 |        15.94 | Orange    |
| Relative Value   | 52.05 |        13.01 | Yellow    |
| Carry + Roll     | 96.52 |        19.30 | Green     |
| Rate Sensitivity | 30.50 |         4.58 | Orange    |
| Overall          |       |        52.83 | Yellow    |

The image's 58.25 is illustrative. Actual scores always use calculated inputs; 52.83 is a fixture, not a hard-coded bond score.

## API and update behavior

`GET /api/gsecs/bond-analytics?exchange=NSE&tradingsymbol=698GR2054-GS&targetYtm=8&customMonths=3.4` reads the approved listing and seller data from the scanner's cached daily snapshot. Target YTM and custom months are optional. No forced broker quote refresh or external reference request occurs; scanner startup or daily catalog changes retain their existing initialization behavior.

The response includes listing identity, seller price, settlement, seed identity, curve snapshot identity, requested target/horizon, Rating and the custom unchanged-YTM/Carry + Roll rows. The client requests it only while a Bond Card is open, caches by those inputs and excludes responses for a different seller price, curve, target, horizon or seed. Other browsers and shared scanner settings remain independent. A new custom horizon replaces the previous custom row while standard horizons stay intact. A missing curve leaves unchanged-YTM carry available, with curve-dependent roll and the overall Rating unavailable.

## Nested breakdown dialog

The breakdown remains a nested Base UI Dialog so the library manages modal focus trapping, active-trigger focus restoration, Escape handling and topmost-dialog dismissal. The shared `DialogContent` passes optional `overlayProps` to `Dialog.Backdrop`; the breakdown opts into `forceRender: true` so its own themed backdrop covers the parent Bond Card and receives outside clicks. Clicking that backdrop closes the breakdown while leaving the Bond Card open. No document-level click handlers or non-modal workaround is used.

Initial focus goes to the breakdown heading (`tabIndex=-1`) so its structured table can be read before the close control; closing restores focus to the trigger used to open it. The parent Bond Card retains its existing disabled autofocus behavior. See [Base UI nested dialogs](https://base-ui.com/react/components/dialog#nested-dialogs) and the [Backdrop API](https://base-ui.com/react/components/dialog#backdrop).
