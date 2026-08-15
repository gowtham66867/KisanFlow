# KisanFlow Technical Architecture and Agent Harness

## System objective

KisanFlow forecasts rural-enterprise cash flow for the next 26 weeks, explains emerging stress and prepares a proposed intervention for human review. It is deliberately unable to sanction, reject, price, restructure, disburse or contact a customer.

The public deployment is a synthetic-data prototype. Financial, market, climate, Account Aggregator, LokOS and ULI integrations are contracts or fixtures until an authorised institution provides production access.

## Runtime architecture

```text
Browser / API client
        |
        v
Input contract + consent gate
        |
        v
Case Manager planner -------- timeout/error ------> offline policy runner
        |                                                |
        +-------------- validated tool plan <------------+
                              |
                              v
  1 validate_case_data
  2 retrieve_market_signal
  3 compute_features
  4 forecast_p10_p50_p90
  5 detect_stress
  6 retrieve_intervention_playbook
  7 simulate_intervention
  8 create_action_card
                              |
                              v
                    five-check policy verifier
                              |
                    pass 200 / fail 409
                              |
                              v
                  independent checker required
```

The browser experience is static HTML backed by a small Node.js service. `cloud-run/server.js` provides `/health`, `/api/status`, `/api/agent/run` and static assets. The canonical forecast artifact is loaded once at startup from `cloud-run/static/data/model_artifact.json`.

## Agent lifecycle

### 1. Contract and consent gate

The server accepts only known scenario fixtures, a purpose receipt and a maker identity. Financial consent is mandatory. Withdrawal, expiry, a wrong role, an unknown scenario, prohibited personal fields or a caller-supplied `prompt` are rejected with HTTP 422 before the planner or any tool runs. Bodies above 32 KiB return 413.

### 2. Planner adapter

When `GEMINI_API_KEY` is available, the Case Manager sends a policy-constrained planning request with temperature zero and JSON output. The model may choose only from the eight named tools. The server discards unknown tool names and always retains the minimum validation, forecast, stress and action-card path.

The model is not asked to calculate forecasts, scores or monetary values. It performs bounded orchestration only.

### 3. Deterministic fallback

If there is no model key, the adapter exceeds its 4.5-second timeout, the provider rejects the request or the returned JSON is invalid, execution switches to `offline_policy_runner`. This mode runs the deterministic eight-tool policy and is visibly labelled in both `/api/status` and the UI.

Fallback is a reliability mechanism, not a disguised claim that an LLM ran.

### 4. Tool execution and shared state

Every tool reads and writes a scoped run state. The harness records ordered events containing the run ID, tool, status, detail and timestamp. Execution stops after eight tools or six seconds. No customer-contact or account-mutation tool exists in the allow-list.

| Tool | Responsibility | Output boundary |
|---|---|---|
| `validate_case_data` | Validate schema, consent status and synthetic-only marker | No inference |
| `retrieve_market_signal` | Return a consented cached fixture or a reason for withholding | Provenance and freshness required |
| `compute_features` | Declare lag-safe feature windows | No protected or identity fields |
| `forecast_p10_p50_p90` | Return versioned 26-week quantiles | Deterministic artifact owns values |
| `detect_stress` | Identify window and reason codes | Not a default/fraud label |
| `retrieve_intervention_playbook` | Retrieve institution-approved options | No open-web advice |
| `simulate_intervention` | Produce a bounded what-if P10 change | Explicitly non-causal |
| `create_action_card` | Prepare a proposed response | Locked for independent checker |

### 5. Executed verification

The verifier recomputes five conditions rather than trusting the planner:

1. Required forecast, stress and action-card outputs exist.
2. Every P10/P50/P90 series has 26 steps and `P10 <= P50 <= P90` at every step.
3. Available market data has a source and freshness; withheld data has a reason.
4. Financial consent remains valid.
5. The action card has not contacted a customer or changed an account, requires a checker and does not present a simulation as causal.

Any failed check produces HTTP 409 and names the failing checks.

### 6. Human approval boundary

Successful machine execution ends at `awaiting_independent_checker`. The action card records `required_next_role=checker`, `customer_contacted=false` and `account_changed=false`. The public prototype contains no endpoint that completes the checker action.

## Forecasting and evaluation

`ml/train_model.py` creates a fixed-seed synthetic panel of 90 fictional enterprises over 104 weeks. It trains three Gradient Boosting quantile regressors and evaluates them at three rolling temporal origins against a seasonal-naive baseline. The machine-readable output is `artifacts/model_metrics.json`; UI and documentation metrics must come from that file.

Evaluation includes MAE, sMAPE, MASE, interval coverage, early-warning precision/recall, false alerts per 100, median lead time and cohort diagnostics. These are synthetic engineering results, not production accuracy or fairness claims.

## Reliability, security and cost controls

- Stable idempotency and action-card identifiers for the same case, actor, model and intervention.
- Replay fingerprint over scenario, consent, model, selected tools and action card.
- `KISANFLOW_KILL_SWITCH=on` rejects new runs with HTTP 503.
- Static path canonicalisation blocks traversal; security headers deny framing and browser sensors.
- No raw production PII is accepted by the public endpoint.
- Cloud Run uses scale-to-zero and a one-instance maximum for the public demonstration service.
- Model-provider failures degrade to deterministic planning.

See `THREAT_MODEL.md` and `docs/evals/AGENT_HARNESS_EVALS.md` for the tested threat and release contracts.

## Production integration path

The prototype becomes pilot-ready only after institution-controlled adapters, a DPIA and legal review, retrospective validation on de-identified partner data, cohort threshold approval, field-officer training, grievance design and rollback ownership. Live credentials must be stored in a secret manager and must never enter the repository or browser bundle.
