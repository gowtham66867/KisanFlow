# KisanFlow Data Card

## Prototype dataset

The checked-in model artifact is trained and evaluated on deterministic synthetic data generated with seed `20260808`. It contains 90 fictional enterprises over 104 weeks across three fictionalised cohorts: a women-led dairy SHG, a millet micro-enterprise and an FPO. It contains no personal data and must not be represented as a partner, NABARD, Account Aggregator, LokOS, ULI, IMD or AGMARKNET extract.

## Planned pilot sources

| Source | Minimum fields | Status | Control |
|---|---|---|---|
| Partner ledger / core system | weekly credits, debits, dues, repayment events | Sandbox schema | Purpose-limited agreement and role-based access |
| Account Aggregator | consented financial-information payload | Sandbox schema | Granular consent, expiry, revocation, FIU/FIP controls |
| LokOS / institution registry | group identity and programme attributes | Sandbox schema | Minimum necessary fields; no member-level export by default |
| AGMARKNET / e-NAM | commodity/market/date/price | Adapter + cached fixture | Source timestamp and stale-data warning |
| IMD / public climate rail | rainfall anomaly/district/date | Adapter + cached fixture | District aggregation; no continuous location |

“Sandbox” means the contract is implemented and testable with fictional data; it does not mean a production connection exists.

## Data minimisation and retention

- Store weekly aggregates rather than raw narrations or counterparties.
- Do not ingest SMS, contacts, photos, call records, caste, religion or political attributes.
- Keep consent receipts and action audit records separately from model features.
- Default feature retention: 180 days for the prototype; pilot retention requires institution/legal approval.
- Withdrawal stops new collection immediately and schedules derived-feature deletion unless a documented legal retention exception applies.

## Quality gates

Required checks are schema validity, consent validity, purpose match, source timestamp, missingness, duplicate period, extreme-value bounds and provenance. A case fails closed if essential data is stale or incomplete; it may be reviewed manually without an AI recommendation.

## Representativeness and bias

Synthetic cohorts are deliberately balanced and cannot estimate real geographic, gender, enterprise-size or institution effects. A pilot must publish coverage by cohort, compare missingness and alert burden, investigate disparities, and allow a no-automation route.
