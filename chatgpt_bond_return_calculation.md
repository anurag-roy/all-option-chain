# Bond Return Calculation

**User:** Anonymous  
**Created:** 10/6/2026 11:35:39  
**Updated:** 10/6/2026 11:35:41  
**Exported:** 10/6/2026 11:59:06  
**Link:** [https://chatgpt.com/share/6ac48fb3-e928-83e8-8857-83fd06e2c544](https://chatgpt.com/share/6ac48fb3-e928-83e8-8857-83fd06e2c544)  

## Prompt:
10/6/2026, 9:53:19 AM

sAY LIKE fv OF A BOND IS 100
I am purchasing in sec. market @ 109
coupon is 900 = 9%
Maturity is exactly after 10 yrs 
whats my real RRR

## Response:
10/6/2026, 9:53:19 AM · gpt-5-6-thinking

> **Calculating bond yield to maturity**
>
>
> **Calculated bond yield to maturity**
>
> 
>
> Worked for 10s

Assuming you mean:

- Face value = ₹100
- Purchase price = ₹109
- Annual coupon = ₹9, i.e. 9% of face value
- Maturity = exactly 10 years
- Redemption at maturity = ₹100

Then your true annual return, i.e. **Yield to Maturity (YTM) / RRR earned**, is approximately **7.68% p.a.**

Why lower than 9%? You receive ₹9 every year, but you pay ₹109 today and receive only ₹100 back at maturity, so you lose ₹9 of principal over 10 years. That capital loss pulls your effective return down from the 9% coupon rate to about **7.68%**.

Mathematically, the rate $r$ solves:

$$
109=\frac9{(1+r)}+\frac9{(1+r)^2}+\cdots+\frac9{(1+r)^{10}}+\frac{100}{(1+r)^{10}}
$$

which gives:

$$
\boxed{r \approx 7.68\%}
$$

So **coupon rate = 9%**, **current yield = 9/109 = 8.26%**, but **actual YTM = ~7.68%**.

## Prompt:
10/6/2026, 9:54:21 AM

how to put this in my system 
I have zerodha's api

## Response:
10/6/2026, 9:54:21 AM · gpt-5-6-thinking

> **Searched 3 websites**
>
> 
>
> Worked for 5s

Yes. The clean way is to treat **YTM as a calculated field in your system**, not something Zerodha will directly give you.

Zerodha can give you the traded bond's **market price/LTP**, but its standard instrument dump contains fields such as `tradingsymbol`, `expiry`, `lot_size`, `instrument_type`, etc.; it does **not** appear to provide the bond's coupon rate, face value, redemption value, and coupon schedule as a complete bond master. ([Kite Trade](https://kite.trade/forum/discussion/13383/instruments-api?utm_source=chatgpt.com)) So you should maintain those bond terms in your own DB and combine them with the Zerodha price feed.

For your example, your system can have something like:

```python
from scipy.optimize import brentq

def calculate_ytm(
    market_price,
    face_value,
    annual_coupon_rate,
    years_to_maturity,
    redemption_value=None
):
    if redemption_value is None:
        redemption_value = face_value

    annual_coupon = face_value * annual_coupon_rate

    def price_difference(ytm):
        pv_coupons = sum(
            annual_coupon / ((1 + ytm) ** year)
            for year in range(1, years_to_maturity + 1)
        )

        pv_redemption = (
            redemption_value /
            ((1 + ytm) ** years_to_maturity)
        )

        theoretical_price = pv_coupons + pv_redemption

        return theoretical_price - market_price

    ytm = brentq(price_difference, -0.99, 1.0)

    return ytm

ytm = calculate_ytm(
    market_price=109,
    face_value=100,
    annual_coupon_rate=0.09,
    years_to_maturity=10
)

print(f"YTM: {ytm * 100:.2f}%")
```

Output:

```text
YTM: 7.68%
```

### Connecting it to Zerodha

Suppose your bond is available as:

```python
instrument = "NSE:YOUR_BOND_SYMBOL"
```

You could do:

```python
quote = kite.ltp(instrument)

market_price = quote[instrument]["last_price"]

ytm = calculate_ytm(
    market_price=market_price,
    face_value=100,
    annual_coupon_rate=0.09,
    years_to_maturity=10
)

print("Market price:", market_price)
print("YTM:", round(ytm * 100, 2), "%")
```

Kite's quote-style APIs support identifiers in the `EXCHANGE:TRADINGSYMBOL` form, while instrument tokens are primarily used for things such as historical data and WebSocket subscriptions. ([Kite Trade](https://kite.trade/forum/discussion/15700/fetching-ohlc-ltp-from-zerodha-api?utm_source=chatgpt.com))

The architecture I'd use is:

```text
ZERODHA
   ↓
Current Market Price
   ↓
┌─────────────────────────┐
│ Your Bond Master DB     │
│                         │
│ ISIN                    │
│ Trading symbol          │
│ Face value              │
│ Coupon %                │
│ Coupon frequency        │
│ Maturity date           │
│ Redemption value        │
└─────────────────────────┘
          ↓
      YTM Engine
          ↓
   YTM = 7.68%
```

One important improvement: **don't store "10 years to maturity."** Store the actual maturity date, e.g. `2036-10-06`, and calculate remaining time dynamically. Also store coupon frequency, because Indian bonds may pay annually, semi-annually, quarterly, etc. Once you do that, the calculation should use actual coupon dates rather than the simplified integer-year formula above.

If you're building a bond screener/trading system, I'd actually calculate these four values for every bond:

```text
Coupon Rate       9.00%
Market Price      ₹109.00
Current Yield     8.26%
YTM               7.68%
```

**YTM is the one I'd use as your "real RRR / return if held to maturity."**

If you tell me whether your Zerodha system is in **Python, Node.js, Java, or something else**, I can show you the production-ready version that takes `tradingsymbol + coupon + maturity date` and calculates live YTM automatically.

---

**Sources:**

- [Instruments API - Kite Connect developer forum](https://kite.trade/forum/discussion/13383/instruments-api?utm_source=chatgpt.com)

## Prompt:
10/6/2026, 11:19:27 AM

show me a manual calculation once
In terms of Days to maturity with 3 examples

## Response:
10/6/2026, 11:19:30 AM · gpt-5-6-thinking

> **Estimating YTM from days to maturity**
>
>
> **Estimated yield to maturity from days to maturity**
>
> 
>
> Worked for 19s

Yes. For a quick **manual days-to-maturity calculation**, use this approximation:

$$
\text{Approx YTM}=
\frac{
\text{Annual Coupon}+\frac{\text{FV}-\text{Purchase Price}}{\text{Years to Maturity}}
}{
\frac{\text{FV}+\text{Purchase Price}}{2}
}
$$

And convert days to years as:

$$
\text{Years to Maturity}=\frac{\text{Days to Maturity}}{365}
$$

Using your bond:

$$
FV=100,\quad Price=109,\quad Coupon=9
$$

### Example 1 — 3,650 days to maturity

$$
Years=\frac{3650}{365}=10
$$

Capital loss per year:

$$
\frac{100-109}{10}=-0.90
$$

So annual return amount is approximately:

$$
9-0.90=8.10
$$

Average capital employed:

$$
\frac{100+109}{2}=104.50
$$

Therefore:

$$
YTM\approx\frac{8.10}{104.50}
$$

$$
\boxed{YTM\approx7.75\%}
$$

The **exact YTM** using discounted cash flows is about:

$$
\boxed{7.68\%}
$$

So this manual formula gets you very close.

### Example 2 — 1,825 days to maturity

$$
Years=\frac{1825}{365}=5
$$

Capital loss per year:

$$
\frac{100-109}{5}=-1.80
$$

Annual return:

$$
9-1.80=7.20
$$

Therefore:

$$
YTM\approx\frac{7.20}{104.50}
$$

$$
\boxed{YTM\approx6.89\%}
$$

Exact YTM is approximately:

$$
\boxed{6.82\%}
$$

Notice what happened: because you're paying a ₹9 premium and now have only 5 years to absorb that loss, your return falls.

### Example 3 — 730 days to maturity

$$
Years=\frac{730}{365}=2
$$

Capital loss per year:

$$
\frac{100-109}{2}=-4.50
$$

Annual return:

$$
9-4.50=4.50
$$

Therefore:

$$
YTM\approx\frac{4.50}{104.50}
$$

$$
\boxed{YTM\approx4.31\%}
$$

Exact YTM is approximately:

$$
\boxed{4.21\%}
$$

So the pattern is:

| Days left | Years | Coupon | Premium loss/year | Approx YTM | Exact YTM |
|---:|---:|---:|---:|---:|---:|
| 3,650 | 10 | ₹9 | ₹0.90 | 7.75% | **7.68%** |
| 1,825 | 5 | ₹9 | ₹1.80 | 6.89% | **6.82%** |
| 730 | 2 | ₹9 | ₹4.50 | 4.31% | **4.21%** |

The intuition is important: **same ₹9 coupon, same ₹109 purchase price, same ₹100 redemption value — but the fewer days remaining, the worse your annualized return**, because you have less time to recover the ₹9 premium you paid.

For your system, the quick formula can literally be:

$$
\boxed{
YTM_{approx}=
\frac{
Coupon+\frac{FV-Price}{Days/365}
}{
(FV+Price)/2
}
}
$$

For example, if `days_to_maturity = 3650`:

$$
\frac{
9+\frac{100-109}{3650/365}
}{
(100+109)/2
}
=
7.75\%
$$

For your Zerodha system, though, I would use this only as a **fast estimate**. For the final displayed yield, use the exact cash-flow/XIRR-style calculation because actual coupon dates can materially affect the result.

## Prompt:
10/6/2026, 11:20:32 AM

is this discounted cash flow?

## Response:
10/6/2026, 11:20:33 AM · gpt-5-6-thinking

The **exact YTM calculation is a discounted cash flow (DCF) calculation**.

You’re solving for the discount rate $r$ that makes the present value of all future bond cash flows equal to the price you pay today:

$$
109
=
\frac{9}{(1+r)^1}
+
\frac{9}{(1+r)^2}
+\cdots+
\frac{109}{(1+r)^{10}}
$$

The last ₹109 is ₹9 coupon + ₹100 principal repayment.

That $r$ is the bond’s **YTM**, about **7.68%** in your example.

The shortcut formula I showed earlier:

$$
\frac{Coupon + (FV-Price)/Years}{(FV+Price)/2}
$$

is **not true DCF**. It’s only an approximation to YTM.

So for your system:

- **Quick estimate:** shortcut formula
- **Correct yield:** DCF / IRR / XIRR-style calculation using each actual coupon date and maturity cash flow

If you’re working in **days to maturity**, the exact version should discount each payment using something like:

$$
PV_i=\frac{CF_i}{(1+r)^{Days_i/365}}
$$

and solve for $r$. That is the version I’d recommend for your Zerodha-based system.

## Prompt:
10/6/2026, 11:21:03 AM

lets go

## Response:
10/6/2026, 11:21:03 AM · gpt-5-6-thinking

Let’s do the **proper DCF/YTM method using days**.

For every future cash flow:

$$
PV=\frac{CF}{(1+r)^{Days/365}}
$$

and we solve for $r$ such that:

$$
\boxed{\text{Purchase Price}=\sum PV(\text{future cash flows})}
$$

genui{"learning_viz":{"type_id":"PRESENT_VALUE_DISCOUNTING"}}

Take your bond:

- Face value = ₹100
- Purchase price = ₹109
- Coupon = ₹9 per year
- Redemption = ₹100
- Assume annual coupons

### Example 1 - 3,650 days remaining

Cash flows are:

| Days from today | Cash flow |
|---:|---:|
| 365 | ₹9 |
| 730 | ₹9 |
| 1,095 | ₹9 |
| ... | ... |
| 3,285 | ₹9 |
| 3,650 | ₹109 |

So:

$$
109=
\frac9{(1+r)^{365/365}}
+\frac9{(1+r)^{730/365}}
+\cdots+
\frac{109}{(1+r)^{3650/365}}
$$

which simplifies to:

$$
109=
\frac9{(1+r)^1}
+\frac9{(1+r)^2}
+\cdots+
\frac{109}{(1+r)^{10}}
$$

Solving:

$$
\boxed{r\approx7.68\%}
$$

That is your true annualized YTM.

### Example 2 - 1,825 days remaining

Five annual coupons remain:

$$
109=
\frac9{(1+r)^1}
+\frac9{(1+r)^2}
+\frac9{(1+r)^3}
+\frac9{(1+r)^4}
+\frac{109}{(1+r)^5}
$$

Solve for $r$:

$$
\boxed{r\approx6.82\%}
$$

The yield is lower because the ₹9 premium you paid:

$$
109-100=₹9
$$

must now be absorbed over only 5 years.

### Example 3 - 730 days remaining

Only two coupons remain:

$$
109=
\frac9{(1+r)^{365/365}}
+\frac{109}{(1+r)^{730/365}}
$$

So:

$$
109=
\frac9{1+r}
+\frac{109}{(1+r)^2}
$$

Try $r=4.2\%$:

$$
PV_1=\frac9{1.042}\approx8.64
$$

$$
PV_2=\frac{109}{1.042^2}\approx100.36
$$

Total:

$$
8.64+100.36\approx109.00
$$

Therefore:

$$
\boxed{YTM\approx4.2\%}
$$

The important part for your system is this:

$$
\boxed{
Price
=
\sum_i
\frac{CashFlow_i}
{(1+YTM)^{Days_i/365}}
}
$$

So don't first convert maturity into “10 years” and assume everything is neat. Keep **actual dates**, calculate the number of days from settlement date to every coupon date, and discount each individual cash flow.

For example, if the next coupon is only **137 days away**, you would discount that ₹9 as:

$$
\frac9{(1+r)^{137/365}}
$$

not:

$$
\frac9{1+r}
$$

That distinction is what will make your bond-yield engine properly accurate.

## Prompt:
10/6/2026, 11:24:01 AM

Can you provide with an example 
All steps in depth and explanation
simple english
Coupon frequency twice a year

## Response:
10/6/2026, 11:24:07 AM · gpt-5-6-thinking

> **Calculating bond price from cash flows**
>
>
> **Calculated bond price from cash flows**
>
> 
>
> Worked for 18s

Yes. Let’s do one full example slowly, with **coupon paid twice a year**.

Assume:

- Face value = ₹100
- Annual coupon rate = 8%
- Coupon frequency = 2 times per year
- So each coupon = ₹4
- Purchase price today = ₹103.72
- Maturity = exactly 2 years from today
- Redemption value at maturity = ₹100

Because coupons are paid twice a year, you will receive **4 coupon payments** before maturity.

### Step 1: Find the coupon amount

Annual coupon:

$$
100 \times 8\% = ₹8
$$

But payment is twice a year:

$$
₹8/2=₹4
$$

So every 6 months, you receive:

$$
\boxed{₹4}
$$

Your cash flows will look like this:

| Time from today | Cash flow |
|---:|---:|
| 6 months | ₹4 |
| 12 months | ₹4 |
| 18 months | ₹4 |
| 24 months | ₹104 |

Why ₹104 at the end?

Because at maturity you receive:

$$
₹4\text{ coupon}+₹100\text{ principal}=₹104
$$

---

### Step 2: What are we trying to calculate?

You are paying:

$$
\boxed{₹103.72}
$$

today.

We want to find the return rate that makes the present value of all those future payments equal to ₹103.72.

That return rate is the bond's **YTM**.

Because payments happen every 6 months, first we calculate the **6-month yield**.

Call it:

$$
r
$$

Then:

$$
103.72
=
\frac{4}{(1+r)^1}
+
\frac{4}{(1+r)^2}
+
\frac{4}{(1+r)^3}
+
\frac{104}{(1+r)^4}
$$

This is the discounted cash-flow calculation.

---

### Step 3: Try a 3% return every 6 months

Suppose:

$$
r=3\%
$$

Then the first coupon is received after 6 months.

Its present value is:

$$
PV_1=\frac{4}{1.03}
$$

$$
PV_1\approx₹3.88
$$

You don't value the future ₹4 at the full ₹4 today, because you have to wait 6 months for it.

---

### Step 4: Discount the second coupon

The second ₹4 is received after 12 months.

That is two 6-month periods.

$$
PV_2=\frac{4}{(1.03)^2}
$$

$$
PV_2\approx₹3.77
$$

Notice it is worth slightly less today than the first coupon, because you have to wait longer.

---

### Step 5: Discount the third coupon

The third ₹4 comes after 18 months.

$$
PV_3=\frac{4}{(1.03)^3}
$$

$$
PV_3\approx₹3.66
$$

---

### Step 6: Discount the final ₹104

At the end of 2 years, you receive:

$$
₹100 + ₹4 = ₹104
$$

This is four 6-month periods away.

So:

$$
PV_4=\frac{104}{(1.03)^4}
$$

$$
PV_4\approx₹92.40
$$

Now add everything:

$$
3.88+3.77+3.66+92.40
$$

$$
\approx₹103.72
$$

That is almost exactly the price you paid.

So the correct semi-annual yield is:

$$
\boxed{3\%\text{ every 6 months}}
$$

---

### Step 7: Convert it to annual YTM

This is where there are two common ways of quoting yield.

If the market uses the simple bond convention:

$$
YTM = 3\%\times2
$$

$$
\boxed{YTM=6.00\%}
$$

But if you want the true effective annual return, including compounding:

$$
(1.03)^2-1
$$

$$
=6.09\%
$$

So:

$$
\boxed{\text{Quoted YTM}=6.00\%}
$$

and

$$
\boxed{\text{Effective annual yield}=6.09\%}
$$

That distinction is important for your system.

---

Now let's connect this to **days**, because that is what you'll eventually calculate from actual dates.

Suppose today's settlement date is Day 0, and the future payments are approximately:

| Days from settlement | Cash flow |
|---:|---:|
| 182.5 | ₹4 |
| 365 | ₹4 |
| 547.5 | ₹4 |
| 730 | ₹104 |

Instead of thinking only in "period 1, period 2", you can write the DCF using years:

$$
103.72
=
\frac{4}{(1+R)^{182.5/365}}
+
\frac{4}{(1+R)^{365/365}}
+
\frac{4}{(1+R)^{547.5/365}}
+
\frac{104}{(1+R)^{730/365}}
$$

Here $R$ is the **effective annual return**.

In our example:

$$
R\approx6.09\%
$$

So the first cash flow is discounted for:

$$
182.5/365=0.5\text{ year}
$$

The third cash flow is discounted for:

$$
547.5/365=1.5\text{ years}
$$

This approach becomes especially useful when the dates are not perfectly clean.

For example, imagine you buy the bond between coupon dates and the next coupon is only **73 days away**.

Then the first coupon should be discounted as:

$$
\frac{₹4}{(1+R)^{73/365}}
$$

not as if you had to wait a full 6 months.

That is why, for your Zerodha system, I would eventually use:

$$
\boxed{
Price=
\sum
\frac{CashFlow_i}
{(1+YTM)^{Days_i/365}}
}
$$

where `Days_i` is the actual number of days from settlement to each future coupon/redemption payment.

The intuition is simple: **you paid ₹103.72 today, and the future ₹4, ₹4, ₹4, and ₹104 must be discounted back to today. The discount rate that makes their total exactly ₹103.72 is your real yield.**

In this example:

$$
\boxed{Coupon\ rate=8\%}
$$

but because you're buying above face value at ₹103.72:

$$
\boxed{YTM\approx6\%}
$$

So again, **coupon rate and actual return are not the same thing**.

## Prompt:
10/6/2026, 11:27:37 AM

take an example of 676GS2061 @ 89.43
Now find the RRR

## Response:
10/6/2026, 11:27:36 AM · gpt-5-6-thinking

I’ll calculate it as a proper **semi-annual G-Sec YTM**, using the bond’s actual maturity date and coupon schedule, and I’ll show the clean-price vs accrued-interest adjustment.

> **Searched 9 websites**
>
> 
>
> **Computing YTM from accrued interest and dirty price**
>
>
> **Calculated yield to maturity from accrued interest and dirty price**
>
> 
>
> Worked for 36s

For **6.76% GS 2061 (676GS2061)** bought at a quoted price of **₹89.43**, the annualized YTM/RRR is approximately:

$$
\boxed{7.63\% \text{ p.a.}}
$$

I’m assuming settlement on **6 October 2026**, ₹89.43 is the usual **clean price**, and you hold the bond to maturity.

RBI confirms that 6.76% GS 2061 matures on **22 February 2061**. The coupon is paid semi-annually, on **22 February and 22 August**, so each coupon is:

$$
₹100 \times 6.76\% \div 2
=
\boxed{₹3.38}
$$

The bond details are therefore:

| Item | Value |
|---|---:|
| Face value | ₹100 |
| Clean purchase price | ₹89.43 |
| Annual coupon | ₹6.76 |
| Half-year coupon | ₹3.38 |
| Coupon dates | 22 Feb & 22 Aug |
| Maturity | 22 Feb 2061 |
| Redemption | ₹100 |

The security details and maturity date are confirmed by Government/RBI-linked records. ([DEA](https://dea.gov.in/files/public_debt_management_documents/Quarterly_Report_on_Public_Debt_Management_for_the_quarter_April_June_2023.pdf?utm_source=chatgpt.com))

### 1. First, ₹89.43 is not your actual cash outflow

For Indian G-Secs, market prices are normally quoted **clean**, meaning accrued interest is excluded. RBI states that the buyer pays the clean price **plus accrued interest**, and G-Secs use the **30/360** day-count convention. ([Reserve Bank of India](https://m.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=711&utm_source=chatgpt.com))

The previous coupon date was:

$$
22\ Aug\ 2026
$$

Settlement assumed:

$$
6\ Oct\ 2026
$$

Accrued interest is calculated up to the day before settlement, i.e. 5 October.

Using 30/360:

$$
\text{Accrued days}
=
30 + 13
=
43
$$

Therefore:

$$
AI
=
6.76\times\frac{43}{360}
$$

$$
AI\approx₹0.8074
$$

So your actual purchase consideration per ₹100 face value is approximately:

$$
89.43+0.8074
$$

$$
\boxed{₹90.2374}
$$

This is called the **dirty price**.

---

### 2. Now look at the next coupon

Next coupon date:

$$
22\ Feb\ 2027
$$

Using the 30/360 convention, from 6 October to 22 February is approximately:

$$
136\text{ days}
$$

A full coupon period is:

$$
180\text{ days}
$$

So the next coupon is:

$$
\frac{136}{180}
=
0.7556
$$

half-year periods away.

This matters because you're **not waiting a full six months for the first ₹3.38**.

---

### 3. Future cash flows

You'll receive ₹3.38 every six months.

Conceptually:

$$
₹3.38,\ ₹3.38,\ ₹3.38,\ldots
$$

until maturity.

At maturity, the final payment is:

$$
₹3.38+₹100
=
₹103.38
$$

From February 2027 through February 2061, there are approximately **69 remaining coupon payments**.

---

### 4. Set up the DCF equation

Let:

$$
y = \text{annual quoted YTM}
$$

Since coupons are semi-annual, the six-month discount rate is:

$$
\frac y2
$$

We solve:

$$
90.2374
=
\frac{3.38}{(1+y/2)^{0.7556}}
+
\frac{3.38}{(1+y/2)^{1.7556}}
+
\frac{3.38}{(1+y/2)^{2.7556}}
+\cdots+
\frac{103.38}{(1+y/2)^{68.7556}}
$$

There is no easy algebraic way to isolate $y$, so a computer repeatedly tries yields until the DCF value equals exactly ₹90.2374.

The solution is approximately:

$$
\boxed{y=7.634\%}
$$

So I'd display:

$$
\boxed{\text{YTM / RRR} \approx 7.63\%}
$$

### 5. Why is the return higher than the 6.76% coupon?

Because you're paying only:

$$
₹89.43
$$

for something that eventually gives you:

$$
₹100
$$

back at maturity.

So you earn from **two sources**:

$$
\text{Coupon income}
+
\text{Capital appreciation}
$$

Coupon:

$$
6.76\%
$$

Plus you eventually gain:

$$
100-89.43
=
₹10.57
$$

That capital gain pushes your YTM above the coupon rate.

So:

$$
\boxed{\text{Coupon rate}=6.76\%}
$$

but

$$
\boxed{\text{YTM}\approx7.63\%}
$$

One more distinction: 7.63% is the standard **bond-equivalent/quoted annual YTM**, i.e. semi-annual yield × 2. If you compound the half-year return to get an effective annual return:

$$
\left(1+\frac{7.634\%}{2}\right)^2-1
$$

you get approximately:

$$
\boxed{7.78\%\text{ effective annual return}}
$$

For your Zerodha system, **7.63% is probably the number you want to show as YTM/RRR**, while 7.78% can optionally be shown as `Effective Annual Yield`.

---

**Sources:**

- [PUBLIC DEBT MANAGEMENT](https://dea.gov.in/files/public_debt_management_documents/Quarterly_Report_on_Public_Debt_Management_for_the_quarter_April_June_2023.pdf?utm_source=chatgpt.com)
- [Reserve Bank of India](https://m.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=711&utm_source=chatgpt.com)

## Prompt:
10/6/2026, 11:33:02 AM

now show the shortest way to calculate for a computer

## Response:
10/6/2026, 11:33:02 AM · gpt-5-6-thinking

For a computer, the shortest robust method is: **build the future cash flows, then solve for the yield that makes PV = dirty price**.

```python
from scipy.optimize import brentq

def ytm(price, coupon, n, frac):
    c = coupon / 2

    def f(y):
        r = y / 2
        pv = sum(
            c / (1 + r) ** (frac + i)
            for i in range(n)
        )

        pv += 100 / (1 + r) ** (frac + n - 1)

        return pv - price

    return brentq(f, 0.0, 0.30)
```

For **6.76 GS 2061**:

```python
dirty_price = 90.2374
coupon = 6.76
n = 69
frac = 136 / 180

result = ytm(dirty_price, coupon, n, frac)

print(result * 100)
```

Output roughly:

```text
7.63
```

So:

$$
\boxed{\text{YTM} \approx 7.63\%}
$$

The key inputs your computer needs are simply:

```text
dirty_price
annual_coupon_rate
number_of_remaining_coupons
fraction_of_period_until_next_coupon
```

For a semi-annual Government bond:

$$
\boxed{
PV =
\sum
\frac{Coupon/2}
{(1+YTM/2)^{fraction+i}}
+
\frac{100}
{(1+YTM/2)^{last\ period}}
}
$$

Then use a numerical root solver like `brentq`.

For your actual system, I’d reduce it further to one function that takes only:

```python
calculate_ytm(
    clean_price,
    coupon_rate,
    settlement_date,
    maturity_date
)
```

and internally calculates accrued interest, next coupon, remaining coupons, and YTM.

## Prompt:
10/6/2026, 11:34:38 AM

can you compute this into Node.js and python

## Response:
10/6/2026, 11:34:38 AM · gpt-5-6-thinking

Below are equivalent implementations in **Python** and **Node.js** for a semi-annual bond like **6.76 GS 2061**.

For our example:

```text
Dirty Price       = 90.2374
Annual Coupon     = 6.76%
Remaining Coupons = 69
Fraction to next coupon = 136 / 180
```

### Python

```python
from scipy.optimize import brentq

def calculate_ytm(dirty_price, coupon_rate, remaining_coupons, fraction_to_next_coupon):
    face_value = 100
    coupon = face_value * coupon_rate / 100 / 2

    def equation(ytm):
        half_year_rate = ytm / 2

        pv = 0

        # Coupon cash flows
        for i in range(remaining_coupons):
            period = fraction_to_next_coupon + i

            pv += coupon / ((1 + half_year_rate) ** period)

        # Principal repayment at maturity
        maturity_period = fraction_to_next_coupon + remaining_coupons - 1

        pv += face_value / ((1 + half_year_rate) ** maturity_period)

        return pv - dirty_price

    # Search between 0% and 30% annual YTM
    ytm = brentq(equation, 0.000001, 0.30)

    return ytm * 100

ytm = calculate_ytm(
    dirty_price=90.2374,
    coupon_rate=6.76,
    remaining_coupons=69,
    fraction_to_next_coupon=136 / 180
)

print(f"YTM: {ytm:.4f}%")
```

Output approximately:

```text
YTM: 7.63%
```

### Node.js

Node doesn't have `scipy`, so the simplest approach is a **binary search**. This is more than accurate enough for displaying bond YTM.

```javascript
function calculateYTM(
    dirtyPrice,
    couponRate,
    remainingCoupons,
    fractionToNextCoupon
) {
    const faceValue = 100;
    const coupon = faceValue * (couponRate / 100) / 2;

    function presentValue(ytm) {
        const halfYearRate = ytm / 2;

        let pv = 0;

        // Coupon cash flows
        for (let i = 0; i < remainingCoupons; i++) {
            const period = fractionToNextCoupon + i;

            pv += coupon / Math.pow(1 + halfYearRate, period);
        }

        // Principal repayment
        const maturityPeriod =
            fractionToNextCoupon + remainingCoupons - 1;

        pv += faceValue /
            Math.pow(1 + halfYearRate, maturityPeriod);

        return pv;
    }

    let low = 0.000001;
    let high = 0.30;

    // 100 iterations gives far more precision than needed
    for (let i = 0; i < 100; i++) {
        const mid = (low + high) / 2;

        const pv = presentValue(mid);

        if (pv > dirtyPrice) {
            // Yield too low
            low = mid;
        } else {
            // Yield too high
            high = mid;
        }
    }

    return ((low + high) / 2) * 100;
}

const ytm = calculateYTM(
    90.2374,     // dirty price
    6.76,        // annual coupon %
    69,          // remaining coupon payments
    136 / 180    // fraction until next coupon
);

console.log(`YTM: ${ytm.toFixed(4)}%`);
```

Output:

```text
YTM: ~7.63%
```

The core logic in both languages is identical:

$$
\text{Market Price}
=
\sum_{i=1}^{N}
\frac{\text{Coupon}}
{(1+YTM/2)^{t_i}}
+
\frac{100}
{(1+YTM/2)^{t_{maturity}}}
$$

Your computer simply keeps changing `YTM` until:

```text
Calculated Present Value ≈ Actual Dirty Price
```

For production, I would make the API look like this:

```javascript
calculateYTM({
    cleanPrice: 89.43,
    couponRate: 6.76,
    settlementDate: "2026-10-06",
    maturityDate: "2061-02-22",
    couponMonths: [2, 8],
    couponDay: 22
});
```

Then your code itself should derive **accrued interest → dirty price → next coupon date → remaining coupons → fractional period → YTM**. That way Zerodha only needs to supply the market price.

---

If you want, I can:

- Calculate YTM in Python step-by-step
- Show code to handle irregular coupon dates
- Generate an interactive YTM calculator UI



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)