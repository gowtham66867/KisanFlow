# Free-tier-oriented Cloud Run deployment

The container serves the demo, health/status endpoints and a bounded Case Manager API. It uses request-based CPU, scale-to-zero, 256 MiB memory, one vCPU, concurrency 80 and a one-instance cap. These settings minimise idle and runaway cost; they do not guarantee a zero bill because Google Cloud free allowances, build/storage and egress terms can change.

## Deploy

```bash
gcloud auth login
gcloud config set project PROJECT_ID
./cloud-run/deploy-free-tier.sh PROJECT_ID
```

The deployed public experience needs no external API key: it uses the deterministic `offline_policy_runner`, executes all eight allow-listed tools and labels that mode visibly. To enable real LLM-controlled tool planning, create a Secret Manager secret named `GEMINI_API_KEY`, grant the Cloud Run runtime service account access, and bind it as an environment variable. The deterministic forecast, simulation, consent guard, verifier and human gate remain authoritative in both modes.

## Verify

```bash
curl -fsS SERVICE_URL/health
curl -fsS SERVICE_URL/api/status
curl -fsS -X POST SERVICE_URL/api/agent/run \
  -H 'Content-Type: application/json' \
  -d '{"scenario":"dairy_shg","intervention":"timing","consent":{"financial":true,"market":true,"climate":true,"revoked":false},"actor":{"id":"jury-maker","role":"maker"}}'
```

Expected: HTTP 200; 26-week forecast; eight completed tool events; verifier passed; action card status `awaiting_independent_checker`; `customer_contacted=false`; `account_changed=false`.

Refusal paths worth checking, because each one is a claim the submission makes:

```bash
# withdrawn consent -> 422 before any tool runs
curl -s -X POST SERVICE_URL/api/agent/run -H 'Content-Type: application/json' \
  -d '{"scenario":"dairy_shg","consent":{"financial":true,"revoked":true},"actor":{"id":"jury-maker","role":"maker"}}'
# prohibited field, injected instruction, wrong role, unknown fixture -> 422
# oversized body -> 413; non-GET/POST -> 405; malformed JSON -> 400
```

## Operator kill switch

```bash
gcloud run services update kisanflow-demo --region us-east1 --update-env-vars KISANFLOW_KILL_SWITCH=on
```

Every run then returns 503 `kill_switch_engaged` and `/api/status` reports `halted`. Remove the variable with `--remove-env-vars KISANFLOW_KILL_SWITCH` to resume.

## Billing safety checklist

- Configure a small project budget and billing alerts. Alerts notify; they are not a hard spending cap.
- Keep `min-instances=0` and `max-instances=1` for the jury demo.
- Do not place personal or production financial data in this public service.
- Review Cloud Build, Artifact Registry, logging and egress usage after deployment.
- Delete the service and unneeded container images after judging if no longer required.
