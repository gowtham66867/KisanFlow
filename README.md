# KisanFlow

AI-powered cash-flow forecasting for rural credit access — a NABARD application concept for scoring credit-history-less farmers using alternative data (weather, mandi prices, transaction history) instead of traditional collateral/credit-bureau checks.

## Contents

- [`KisanFlow_NABARD_Application.docx`](./KisanFlow_NABARD_Application.docx) — the full application write-up: problem statement, solution/business model, tech stack, agent architecture, and a data sources & known limitations section.
- [`demo/kisanflow_demo.html`](./demo/kisanflow_demo.html) — a self-contained, interactive walkthrough of the agentic pipeline. Open it directly in a browser (no server or build step required).
- [`scripts/build_nabard_doc.js`](./scripts/build_nabard_doc.js) — the Node/`docx` script that generates the application `.docx` from source. Run `npm install docx && node scripts/build_nabard_doc.js`.

## What the demo shows

An Orchestrator agent dynamically routes a farmer profile through:

1. **Data Agent** — explicit tool calls (`get_weather`, `get_mandi_price`, `get_transaction_history`), skipping any signal that isn't available for that borrower.
2. **Forecasting Agent** — projects a 12-month cash-flow curve and repayment-capacity score from real government-published crop economics (CACP/DES cost of cultivation, Kharif/Rabi MSP 2024–25).
3. **Verifier Agent** — a self-check that can reject the forecast outright when confidence is too low, triggering a conservative rule-based guardrail fallback instead of trusting a thin-data ML output.
4. **Confidence Router** — auto-approves or flags the file for a human loan officer.
5. **Advisory Agent** — retrieval-grounded, plain-language output for both the lender and the farmer, citing the specific region/crop notes it drew from.

A **Memory Agent** panel simulates cross-season recall for returning borrowers, and a live reasoning-trace console shows every handoff and tool call as it happens.

## Honest status

This is a prototype/pitch artifact, not a production credit tool. Crop yield, MSP, and cost-of-cultivation figures are real, cited national averages — not this specific farmer's plot data — and the confidence score has not been backtested against actual repayment outcomes. See the "Data Sources & Known Limitations" section in the application document for the full list of what's verified versus estimated.
