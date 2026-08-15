# KisanFlow — three-minute jury walkthrough

Live demo: <https://kisanflow-demo-1012823692058.us-east1.run.app>

## Opening line

“KisanFlow predicts the next 26 weeks of cash flow for an SHG, FPO or rural micro-enterprise, explains stress before a missed repayment, and helps a field officer choose a consented response—without letting AI take the final action.”

## The live sequence

**0:00–0:25 · Name the exact problem.** Use Sakhi Dairy SHG. Point to the 26-week range and evidence labels. Say: “This matches NABARD’s three-to-six-month, multi-source cash-flow and early-warning brief. This case and today’s evaluation are explicitly synthetic.”

**0:25–0:50 · Prove consent and data honesty.** Toggle market consent off, then on. Then switch **Financial activity** off and press run: the service refuses with 422 and the panel reads “Blocked before any tool ran · No action card was created.” Switch it back on. Say: “Financial aggregates are required; market and climate are separately optional; withdrawal is enforced on the server, not in the browser. AA, LokOS, AGMARKNET and IMD are sandbox adapters until an institution authorises a live connection.”

**0:50–1:25 · Run the Case Manager.** Click **Run early-warning review**. Point to all eight completed tools, the execution-mode badge and the verifier. Say: “With a configured model key, the LLM chooses among these allow-listed tools. This free public deployment uses the visibly labelled offline policy runner. Deterministic services own every number either way.”

**1:25–1:55 · Explain the decision, not just a score.** Show the P10 stress window, P50 recovery and three drivers. Say: “The alert is temporary liquidity stress, not a default prediction. On synthetic temporal holdouts, MASE is 0.52 versus seasonal naïve; the conservative alert has 45.8% precision and 0.83 false alerts per hundred. These are engineering results, not pilot claims.”

**1:55–2:25 · Compare a response.** Select **Activate verified buyer referral** and show the changed P10 curve. Say: “This is a what-if scenario, not a causal uplift claim. The action card contains evidence and reason codes for officer judgement.”

**2:25–2:45 · Prove the boundary.** Point to **Locked**, `awaiting_independent_checker`, `customer_contacted=false`, and `account_changed=false`. Say: “The maker cannot approve their own card. No sanction, restructuring or contact tool exists.”

**2:45–3:00 · Make the pilot ask.** Say: “We ask for a six-month, two-district, 500-enterprise pilot: first retrospective validation, then silent mode, then controlled maker-checker interventions—with cohort metrics, customer grievance, kill switch and rollback.”

## Questions to welcome

**Is this actually AI/ML?** Yes. The repository trains three Gradient Boosting quantile models and evaluates them with rolling-origin splits. The Case Manager supports a real LLM planner adapter. The public deployment remains fully demonstrable without a paid/model key and labels that fallback.

**Why is recall only 28.2%?** The displayed alert is a conservative operating point chosen to limit field workload to 0.83 false alerts per hundred synthetic assessments. A lower-threshold watchlist has higher recall and is reported in the artifact. A partner must set thresholds using real costs and retrospective data.

**Are the forecast intervals calibrated?** On synthetic rolling holdouts, the P10–P90 band covers 83.2% of observations. It must be recalibrated on partner data and monitored by cohort.

**What makes the agent safe?** Input/consent validation, prohibited-field checks, an eight-tool allow-list, deterministic numerical tools, turn/tool/time limits, timeout fallback, verifier, idempotency, stable replay fingerprint, maker-checker, kill switch, and no exposed sanction/contact tools.

**Can a jury break it from the address bar?** Please try. Verified against the live service: withdrawn consent, an expired receipt, an unknown fixture, a prohibited personal field, an injected `prompt` field and a checker posing as a maker all return 422 before any tool runs; an oversized body returns 413; a wrong method returns 405; malformed JSON returns 400; path traversal returns 404; and `KISANFLOW_KILL_SWITCH=on` returns 503 with `/api/status` reporting `halted`. The same fixture always returns the same replay fingerprint and action-card id.

**How does it use Account Aggregator?** As a consented, purpose-bound rail for verified financial information. The current repository implements the receipt and adapter contracts only; it does not claim a live AA connection.

**Why DPG?** The challenge asks for common digital infrastructure. KisanFlow supplies an Apache-2.0 open core, OpenAPI/JSON schemas, model/data cards, non-PII extraction and do-no-harm controls mapped to the DPG Standard. It does not claim DPGA certification.

**Is hosting free?** The service uses request billing, scale-to-zero, 256 MiB, one vCPU and one maximum instance. That is free-tier-oriented; builds, storage, egress and platform terms can still produce cost.

## Never claim

- The synthetic scores are production accuracy or fairness evidence.
- A simulated intervention has a proven causal effect.
- A sandbox adapter is a live NABARD, lender, AA, LokOS, ULI, IMD or AGMARKNET integration.
- KisanFlow sanctions, rejects, restructures, disburses or independently contacts customers.
- DPG readiness equals DPGA recognition, or free-tier orientation guarantees a zero bill.
