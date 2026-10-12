# G-Sec curve data access investigation

Initially investigated 9 October 2026 against official CCIL and FBIL pages and documents. This is not a provider quote or confirmation of contractual access. No provider was contacted, account created or subscription purchased.

## Implementation status

The user subsequently authorized implementation assuming they handle all required permissions. Tier 2 now imports the public CCIL NSS HTML table through `db:seed` / `data:prepare`, retains dated versions in SQLite, and loads them without external runtime requests. The user explicitly approved ACT/365 and continuous discounting as this app's convention, configurable and recorded on each snapshot. It is not described as a verified provider day-count convention. See [G-Sec YTM and analytics](gsec-ytm.md) for operational behavior and settings.

## Recommendation

CCIL NSS/ZCYC is the implemented provider, matching `GSec_Curve_Resolution_Tech_Spec.pdf`. FBIL remains a possible alternative with published API/SFTP dissemination charges; its cubic-spline curve would be a distinct provider and validation baseline. No FBIL adapter is connected.

The app uses a dated curve snapshot, loaded by morning `npm run data:prepare`, for live comparisons against independent NSE/BSE seller prices. The user handles provider permissions. The source research below records the original access investigation.

## CCIL

[CCIL's NSS parameter page](https://www.ccilindia.com/zcyc-parameters) publishes the equation and six parameters. The separate [curve page](https://www.ccilindia.com/curve) displays tenors from 0 to 50 years. This public output does not establish a contracted feed's supported tenor range.

[Operational Aspects](https://www.ccilindia.com/operational-aspects) describes daily ZCYC publication at approximately 7 p.m., delivered as a downloadable Excel workbook. That page's general download wording should be read alongside the newer access policy and website terms.

[Data Sharing Policy, October 2025](https://www.ccilindia.com/documents/d/ccil/ccil_datasharing_policy_oct25) permits non-commercial website use subject to website conditions. Commercial recurring feeds require an agreement specifying end-use, delivery and commercials. Individuals/non-members can make requests, and personal-email requests may be considered. It does not publish a numeric NSS subscription tariff. The user confirmed on 9 October 2026 that this app is for personal, non-commercial use. Permission for an unattended daily import remains separate from that intended use.

[Website terms](https://www.ccilindia.com/documents/d/ccil/terms-of-use) restrict commercial use without written consent and prohibit systematic automated website collection. Consequently, the public HTML table is not an established authorized unattended seed interface.

The official routes are [Data Services](https://www.ccilindia.com/en/otherservice-data-services) and the [Data Request Form](https://www.ccilindia.com/data-request-form). The [contact page](https://www.ccilindia.com/contactus-kurla) lists `research@ccilindia.co.in` for Research. No public developer specification for a supported NSS REST API, authentication, payload schema or service guarantee was found in the reviewed materials. This does not mean CCIL cannot provide an agreed machine-readable feed.

### Verified public HTTP request

Verified on 9 October 2026: HTTP 200, HTML, without cookies, authorization or an API key:

```sh
curl --fail --location --max-time 45 \
  'https://www.ccilindia.com/zcyc-parameters' \
  --output ccil-nss.html
```

The date and six parameters appear in `table#advancedSearch`. Local extraction returned two valid rows; the latest matched the approved fixture:

```json
{
  "curveReferenceDate": "2026-10-08",
  "beta0": 8.27,
  "beta1": -2.9928,
  "beta2": -19.9674,
  "beta3": 19.5976,
  "tau1": 2.0618,
  "tau2": 1.8925
}
```

This returns HTML rather than documented JSON. Validate headers, values and reference date when importing; publication time and rate conventions remain unverified.

The Excel control generates a workbook from the table after sign-in. Its `auditDownload` POST logs downloads rather than returning data. No static `.xlsx` URL was exposed by this control. No sign-in check was bypassed.

Context7 found no relevant CCIL API documentation. The seed adapter uses the verified public HTML request.

## FBIL

[G-Sec methodology version 4, August 2024](https://www.fbil.org.in/uploads/FBIL_Revised_G_Sec_Valuation_Methodology_Finaldocx_de34c9b72e.pdf) specifies a cubic-spline zero curve, with semiannual and annualized outputs. It describes tenors from 0.25 to 40 years, or the highest issued G-Sec, publication by 7 p.m. on Mumbai business days, and `GSEC_STRIPS_ZCYC.xlsx` as a publication format. Provider conventions and actual available tenor coverage must be verified from the delivered file/feed.

The older [fee FAQ](https://www.fbil.org.in/uploads/Data_Fee_Schedule_FAQ_repl_3576a15203.pdf) says G-Sec/ZCYC is free. That statement was superseded by [Notification 10, 28 December 2021](https://www.fbil.org.in/uploads/Pricing_of_FBIL_G_Sec_Valuation_and_SDL_Valuation_benchmarks_c4832dcaaa.pdf), making live G-Sec/SDL valuation data, including STRIPS/ZCYC, fee-liable from 1 April 2022. Its published schedule lists ₹50,000/year for end-user valuation and ₹2,50,000/year for other purposes, plus applicable taxes. It makes seven-day-delayed public data available for viewing. The app's classification and current applicable quote are unconfirmed; the delayed viewing facility is not an established free application feed.

The [2023 dissemination notice](https://www.fbil.org.in/uploads/Notification_on_Pricing_of_AM_MM_39521b0edc.pdf) documents one-time access charges of ₹50,000 plus taxes for API and ₹20,000 plus taxes for SFTP, separately from benchmark usage fees. These are published figures, not a confirmed current ZCYC quotation or a tested API contract. SFTP may suit one daily import, subject to FBIL confirming that the desired curve is supplied by that route.

[FBIL's November 2023 FAQ](https://www.fbil.org.in/uploads/FAQ_s_updates_30th_Nov_2023_edited_version_1def7b65bb.pdf) directs applicants to [registration](https://www.fbil.org.in/#/registration); staff then provide the agreement and quotation. The pricing notice lists `fbil@fbil.org.in` and `operations@fbil.org.in` for users outside the listed categories. No registration or authenticated download was attempted, and no current sample production file was obtained.

## Fit with this app

These are engineering conclusions from the provider documents and the approved local spec:

- Morning preparation should use the latest curve already published, normally the previous Mumbai business day's curve. It cannot use that evening's unpublished curve. Live seller quotes will move intraday against that fixed dated benchmark.
- Preserve snapshots across daily seeds, recording provider, reference date, actual publication timestamp, retrieval timestamp, valuation/settlement origin, parameters or zero rates, compounding, day-count, tenor limits and source identity. Retrieval time must not be presented as publication time.
- Load the curve once during preparation and use the stored snapshot at runtime. Missing/invalid curve data leaves Tier 1 available and curve-dependent results unavailable. A previous-business-day publication should not be rejected simply because its reference date differs from the seed date; explicit age and holiday rules are needed.
- Keep the benchmark broad and independent of the pledgeable list. Match cash flows to curve discount factors, then solve fair YTM using the existing bond solver. Do not substitute a curve spot rate directly for bond fair YTM.
- Keep CCIL and FBIL outputs separate and visibly identify the provider/date. A provider change must not reuse the other provider's golden fixture as a production baseline.
- Support an authorized local-file import as well as an eventual network delivery adapter. File import can enable development without inventing an API contract; its input still needs to come from an authorized source.

The inspected local DB contains 190 seeded listings, with maturities from 30 October 2026 to 19 January 2076 (seed date 8 October 2026). This implies a need for nearly 50-year coverage and cash flows shorter than three months. The actual feed must support those bounds, or the adapter must leave affected valuations unavailable. The FBIL methodology's lower bound deserves particular attention for near-maturity bonds. No DB data was changed during this check.

## Details to request from providers

1. Intended-use classification: a private individual, internal business application, or app supplied to clients; permitted display of derived fair prices/spreads; any redistribution restrictions.
2. Current price and any setup/access charges, specifically for the sovereign ZCYC needed here.
3. Authorized delivery: one daily file/download, SFTP or documented API; authentication, file naming, schema, sample file and support for unattended morning retrieval.
4. Curve reference date versus valuation/settlement origin, publication timestamp/timezone, corrections, holiday behaviour and historical retention rights.
5. Rate units and compounding, day-count/tenor definition, discount-factor conversion, minimum and maximum tenor, and approved interpolation/extrapolation rules.

The approved note's ACT/365 continuously compounded fixture is suitable for mathematical validation. It must not silently become the production convention for either provider without documentation.
