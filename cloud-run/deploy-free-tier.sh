#!/usr/bin/env bash
set -euo pipefail

service_name="kisanflow-demo"
deploy_region="us-east1"
deploy_project="${1:-$(gcloud config get-value project 2>/dev/null)}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${deploy_project}" || "${deploy_project}" == "(unset)" ]]; then
  echo "No Google Cloud project is selected. Pass a project ID as the first argument."
  exit 1
fi

gcloud run deploy "${service_name}" \
  --project "${deploy_project}" \
  --region "${deploy_region}" \
  --source "${script_dir}" \
  --allow-unauthenticated \
  --no-invoker-iam-check \
  --ingress all \
  --min-instances 0 \
  --max-instances 1 \
  --concurrency 80 \
  --cpu 1 \
  --memory 256Mi \
  --cpu-throttling \
  --no-cpu-boost \
  --timeout 15 \
  --port 8080 \
  --set-env-vars "GEMINI_MODEL=gemini-2.5-flash-lite" \
  --quiet

service_url="$(gcloud run services describe "${service_name}" --project "${deploy_project}" --region "${deploy_region}" --format='value(status.url)')"
echo "Deployed: ${service_url}"
echo "Cost controls: request-based CPU, scale-to-zero, max 1 instance, 256Mi memory."
echo "Optional: bind GEMINI_API_KEY from Secret Manager to enable model-planned tool routing; without it, the honest offline policy runner remains fully functional."
