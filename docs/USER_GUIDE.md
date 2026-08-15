# KisanFlow User and Operator Guide

## Three-minute product walkthrough

Recorded walkthrough: [watch the three-minute KisanFlow demo on Loom](https://www.loom.com/share/b22f095e05fd43a1b061f9d87f1eac70).

1. Open the [live KisanFlow demo](https://kisanflow-demo-1012823692058.us-east1.run.app).
2. Keep **Sakhi Dairy SHG** selected for the primary story.
3. Turn financial consent off and run once. Confirm the case is blocked before any tool executes.
4. Restore consent and select an intervention.
5. Click **Run early-warning review**.
6. Inspect the 26-week P10/P50/P90 range, stress reasons, proposed what-if response, eight tool events, verifier status and replay fingerprint.
7. Confirm the action card is locked at `awaiting_independent_checker` and that no customer or account action occurred.

Use `DEMO_WALKTHROUGH.md` for the timed presentation narrative and technical questions.

## What the forecast means

- **P10:** downside planning path used to expose liquidity risk.
- **P50:** median model path.
- **P90:** upside planning path.
- **Stress window:** weeks when downside cash flow crosses the configured operating buffer.
- **Reason codes:** observable drivers used to explain routing, not a label of default or fraud.
- **Intervention uplift:** illustrative what-if output. It is not a causal effect or customer promise.

## Run locally

Requirements: Node.js 22+ and Python 3.10+.

```bash
git clone https://github.com/gowtham66867/KisanFlow.git
cd KisanFlow
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
npm install
npm test
npm run serve
```

Open `http://localhost:8080`. For a static walkthrough without the server, open `demo/kisanflow_demo.html`; the file uses the same model artifact and browser-local deterministic policy runner.

## API usage

Check runtime state:

```bash
curl -sS http://localhost:8080/health
curl -sS http://localhost:8080/api/status
```

Run the Case Manager:

```bash
curl -sS -X POST http://localhost:8080/api/agent/run \
  -H 'Content-Type: application/json' \
  -d '{
    "scenario":"dairy_shg",
    "intervention":"buyer",
    "consent":{
      "financial":true,
      "market":true,
      "climate":true,
      "revoked":false
    },
    "actor":{"id":"demo-maker","role":"maker"}
  }'
```

Valid scenarios are `dairy_shg`, `millet_enterprise` and `fpo`. Valid intervention keys are `timing`, `buyer` and `advisory`. The normative contract is `api/openapi.yaml`.

## Response checklist

A successful run should show:

- HTTP 200 and `execution_mode` equal to `offline_policy_runner` or `llm_case_manager`.
- `budgets.tools_used` at or below eight.
- `verifier.passed=true` and no failed checks.
- A 26-step forecast with ordered P10/P50/P90 arrays.
- `results.actionCard.status=awaiting_independent_checker`.
- `customer_contacted=false` and `account_changed=false`.
- A stable `idempotency_key` and `replay_fingerprint` for an identical request.

## Expected refusal behaviour

| Condition | Expected result |
|---|---|
| Financial consent false or withdrawn | 422 before planning/tools |
| Expired or invalid consent timestamp | 422 |
| Unknown scenario or actor not a maker | 422 |
| Prohibited identity field or `prompt` | 422 |
| Malformed JSON | 400 |
| Body over 32 KiB | 413 |
| Wrong HTTP method | 405 |
| Kill switch enabled | 503 |
| Verifier detects invalid output | 409 with failed check names |

## Optional LLM planner

Set `GEMINI_API_KEY` in the server environment or bind it from Cloud Secret Manager. Never put the key in HTML, source control or a command transcript intended for sharing. `GEMINI_MODEL` defaults to `gemini-2.5-flash-lite`.

The model selects an allow-listed route; it does not calculate the forecast or approve an action. `/api/status` reports whether the adapter is configured, and the returned `execution_mode` reports which path actually ran.

## Regenerate evidence

```bash
python3 ml/train_model.py
npm test
npm run build:application
```

Do not hand-edit evaluation numbers. Commit the regenerated artifact, model/data-card implications and any changed test expectations together.

## Cloud Run operations

Deployment and smoke-test commands are documented in `cloud-run/DEPLOYMENT.md`. Keep minimum instances at zero and maximum instances at one for the public demo. Budgets are alerts, not hard spending caps.

To halt new agent runs:

```bash
gcloud run services update kisanflow-demo \
  --region us-east1 \
  --update-env-vars KISANFLOW_KILL_SWITCH=on
```

Remove the variable to resume. Do not use production or personal data in the public service.
