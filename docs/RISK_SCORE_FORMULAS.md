# Risk Score Formulas

This document describes every variable and formula used to calculate a forklift's risk score in Fleet Shield.

---

## Overall Risk Score

```
Overall Score = round(Raw Score x Application Severity Multiplier)
```

- Scale: 1 to 10 (capped at 10)
- The raw score is a weighted average of 5 individual factor scores
- The application severity multiplier adjusts the score based on operating environment

---

## Raw Score (Weighted Average)

```
Raw Score = (Age Score x 0.15)
          + (Hours Score x 0.20)
          + (Maintenance Cost Score x 0.25)
          + (Repair Frequency Score x 0.20)
          + (Downtime Score x 0.20)
```

| Factor | Weight |
|---|---|
| Equipment Age | 15% |
| Operating Hours | 20% |
| Maintenance Cost | **25%** |
| Repair Frequency | 20% |
| Downtime | 20% |

Each factor is scored on a 1-10 scale using linear interpolation between thresholds.

---

## Factor 1: Equipment Age (15%)

**Input:** Age in years (calculated from purchase date or model year)

| Range | Score |
|---|---|
| 0-3 years | 1 |
| 3-6 years | 2-4 (linear) |
| 6-8 years | 5-7 (linear) |
| 8-10 years | 8-9 (linear) |
| 10+ years | 10 |

**Formula within each band:**

```
0 to 3 years:   score = 1
3 to 6 years:   score = ceil(1 + ((age - 3) / (6 - 3)) x 3)
6 to 8 years:   score = ceil(4 + ((age - 6) / (8 - 6)) x 3)
8 to 10 years:  score = ceil(7 + ((age - 8) / (10 - 8)) x 2)
10+ years:       score = 10
```

---

## Factor 2: Operating Hours (20%)

**Input:** Total current operating hours on the unit

| Range | Score |
|---|---|
| 0-5,000 hrs | 1 |
| 5,000-10,000 hrs | 2-4 (linear) |
| 10,000-15,000 hrs | 5-7 (linear) |
| 15,000-20,000 hrs | 8-9 (linear) |
| 20,000+ hrs | 10 |

**Formula within each band:**

```
0 to 5,000:       score = 1
5,000 to 10,000:   score = ceil(1 + ((hours - 5000) / 5000) x 3)
10,000 to 15,000:  score = ceil(4 + ((hours - 10000) / 5000) x 3)
15,000 to 20,000:  score = ceil(7 + ((hours - 15000) / 5000) x 2)
20,000+:           score = 10
```

---

## Factor 3: Maintenance Cost (25%)

**Input:** Total maintenance cost over the last 12 months, expressed as a percentage of the original purchase price

```
Cost % = (12-month maintenance cost / purchase price) x 100
```

If no purchase price is on file, a default of $25,000 is used.

| Range | Score |
|---|---|
| 0-5% | 1 |
| 5-10% | 2-4 (linear) |
| 10-15% | 5-7 (linear) |
| 15-20% | 8-9 (linear) |
| 20%+ | 10 |

**Formula within each band:**

```
0 to 5%:    score = 1
5 to 10%:   score = ceil(1 + ((costPct - 5) / 5) x 3)
10 to 15%:  score = ceil(4 + ((costPct - 10) / 5) x 3)
15 to 20%:  score = ceil(7 + ((costPct - 15) / 5) x 2)
20%+:       score = 10
```

---

## Factor 4: Repair Frequency (20%)

**Input:** Number of repairs (type = "repair" or "emergency") in the last 12 months

| Range | Score |
|---|---|
| 0-2 repairs/yr | 1 |
| 2-4 repairs/yr | 2-4 (linear) |
| 4-6 repairs/yr | 5-7 (linear) |
| 6-8 repairs/yr | 8-9 (linear) |
| 8+ repairs/yr | 10 |

**Formula within each band:**

```
0 to 2:   score = 1
2 to 4:   score = ceil(1 + ((repairs - 2) / 2) x 3)
4 to 6:   score = ceil(4 + ((repairs - 4) / 2) x 3)
6 to 8:   score = ceil(7 + ((repairs - 6) / 2) x 2)
8+:       score = 10
```

---

## Factor 5: Downtime (20%)

**Input:** Total downtime hours in the last 12 months

| Range | Score |
|---|---|
| 0-24 hrs/yr | 1 |
| 24-72 hrs/yr | 2-4 (linear) |
| 72-168 hrs/yr | 5-7 (linear) |
| 168-336 hrs/yr | 8-9 (linear) |
| 336+ hrs/yr | 10 |

**Formula within each band:**

```
0 to 24:     score = 1
24 to 72:    score = ceil(1 + ((hours - 24) / 48) x 3)
72 to 168:   score = ceil(4 + ((hours - 72) / 96) x 3)
168 to 336:  score = ceil(7 + ((hours - 168) / 168) x 2)
336+:        score = 10
```

---

## Application Severity Multiplier

Each forklift is assigned an operating environment classification that adjusts the overall risk score. Harsher environments cause faster equipment degradation.

| Application | Multiplier | Examples |
|---|---|---|
| **Clean** | 1.0x | Dry warehouse, climate-controlled facility |
| **Medium** | 1.2x | Outdoor yard, dusty environment, moderate wear |
| **Severe** | 1.4x | Freezer/cold storage, wash-down areas, corrosive/chemical environments |

**Example:** A forklift with a raw score of 6 in a severe (freezer) environment:

```
Overall Score = round(6 x 1.4) = round(8.4) = 8 (High Risk)
```

The same forklift in a clean warehouse:

```
Overall Score = round(6 x 1.0) = round(6.0) = 6 (Medium Risk)
```

---

## Risk Levels

The overall score maps to a risk level:

| Score | Risk Level | Action |
|---|---|---|
| 1-3 | **Low** | Continue normal operations |
| 4-6 | **Medium** | Monitor closely, re-assess in 3 months |
| 7-8 | **High** | Plan replacement within 6-12 months |
| 9-10 | **Critical** | Replace immediately |

---

## Repair vs. Replace Decision

The system also generates a repair-or-replace recommendation based on the overall score and financial projections:

| Score | Decision | Urgency |
|---|---|---|
| 9-10 | Replace | Immediate |
| 7-8 (savings if replaced > $0) | Replace | Planned (6-12 months) |
| 7-8 (no savings) | Monitor | Planned |
| 5-6 | Monitor | Low |
| 3-4 | Repair | Routine |
| 1-2 | Repair (not needed) | None |

---

## Financial Projections

These are calculated alongside the risk score to support the repair vs. replace decision:

| Metric | Formula |
|---|---|
| **Current Value** | `purchase_price x (1 - depreciation_rate) ^ age_years` |
| **Projected Annual Maintenance** | `last_12mo_maintenance_cost x (1 + age_years x 0.05)` |
| **Projected Downtime Cost** | `last_12mo_downtime_cost x (1 + age_years x 0.05)` |
| **Projected Repair Cost** | `projected_annual_maintenance x 0.60` |
| **Replacement Cost** | `purchase_price x 1.20` |
| **Remaining Life** | `max(0, (expected_lifespan_years - age_years) x 12)` months |
| **Savings if Replaced** | `(continue_cost - replace_cost) + current_value` |
| **ROI if Replaced** | `(savings / (replacement_cost - current_value)) x 100` |

Where:
- `continue_cost` = (projected maintenance + projected downtime) x min(3, remaining life in years)
- `replace_cost` = replacement cost + (purchase_price x 0.03 x comparison years)
- Default depreciation rate: 15%
- Default expected lifespan: 10 years
- Default downtime cost: $150/hour
