const fs = require("fs");
const {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header,
  HeadingLevel, LevelFormat, PageBreak, PageNumber, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} = require("docx");

const OUT = "KisanFlow_NABARD_Application.docx";
const BLUE = "2E74B5";
const DARK_BLUE = "1F4D78";
const GREEN = "174C36";
const ORANGE = "C97A1A";
const INK = "17221C";
const MUTED = "626E66";
const LIGHT = "F4F6F9";
const GREEN_LIGHT = "E7EFE6";
const PEACH = "F3DDD4";
const WHITE = "FFFFFF";
const PAGE = { width: 12240, height: 15840 };
const MARGIN = 1440;
const CONTENT = 9360;

function run(text, options = {}) {
  return new TextRun({ text, font: "Calibri", size: options.size || 22, color: options.color || INK, bold: options.bold, italics: options.italics, break: options.break });
}
function para(text, options = {}) {
  const children = Array.isArray(text) ? text : [run(text, options)];
  return new Paragraph({
    children,
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: { before: options.before ?? 0, after: options.after ?? 120, line: options.line ?? 300, lineRule: "auto" },
    keepNext: options.keepNext,
    keepLines: options.keepLines,
    pageBreakBefore: options.pageBreakBefore,
  });
}
function h1(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 }, keepNext: true }); }
function h2(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, keepNext: true }); }
function bullet(text) { return new Paragraph({ children: [run(text)], numbering: { reference: "proposal-bullets", level: 0 }, spacing: { after: 80, line: 290, lineRule: "auto" }, keepLines: true }); }
function label(labelText, bodyText) { return para([run(`${labelText} `, { bold: true, color: DARK_BLUE }), run(bodyText)]); }
function link(labelText, url) { return new ExternalHyperlink({ link: url, children: [new TextRun({ text: labelText, style: "Hyperlink", font: "Calibri", size: 18 })] }); }
function sourceLine(labelText, url) { return new Paragraph({ children: [run("Source: ", { bold: true, size: 18, color: MUTED }), link(labelText, url)], spacing: { before: 80, after: 80, line: 240, lineRule: "auto" } }); }
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

function cell(text, width, options = {}) {
  const children = Array.isArray(text) ? text : [para(text, { after: 0, line: 260 })];
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    shading: options.fill ? { type: ShadingType.CLEAR, fill: options.fill, color: "auto" } : undefined,
    children,
  });
}
function table(rows, widths, header = true) {
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    indent: { size: 120, type: WidthType.DXA },
    columnWidths: widths,
    layout: "fixed",
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "D4DAD5" }, bottom: { style: BorderStyle.SINGLE, size: 2, color: "D4DAD5" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "D4DAD5" }, right: { style: BorderStyle.SINGLE, size: 2, color: "D4DAD5" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDE2DE" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDE2DE" },
    },
    rows: rows.map((rowData, rowIndex) => new TableRow({
      tableHeader: header && rowIndex === 0,
      children: rowData.map((value, index) => cell(
        [para([run(String(value), { bold: header && rowIndex === 0, color: header && rowIndex === 0 ? DARK_BLUE : INK })], { after: 0, line: 250 })],
        widths[index],
        { fill: header && rowIndex === 0 ? LIGHT : undefined },
      )),
    })),
  });
}
function callout(title, body, fill = GREEN_LIGHT) {
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA }, indent: { size: 120, type: WidthType.DXA }, columnWidths: [CONTENT], layout: "fixed",
    borders: { top: { style: BorderStyle.SINGLE, size: 3, color: GREEN }, bottom: { style: BorderStyle.SINGLE, size: 3, color: GREEN }, left: { style: BorderStyle.SINGLE, size: 8, color: GREEN }, right: { style: BorderStyle.SINGLE, size: 3, color: GREEN }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [new TableRow({ tableHeader: true, children: [cell([para([run(title, { bold: true, color: GREEN }), run(`\n${body}`)], { after: 0, line: 280 })], CONTENT, { fill })] })],
  });
}

const header = new Header({ children: [new Paragraph({ children: [run("KISANFLOW ENTERPRISE PULSE", { bold: true, size: 17, color: MUTED }), run("   |   NABARD HACKATHON 2026", { size: 17, color: MUTED })], spacing: { after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9DDD5" } } })] });
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run("Decision-support prototype  ·  Synthetic evaluation  ·  Page ", { size: 17, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 17, color: MUTED })] })] });

const children = [];

// Page 1 — proposal centerpiece
children.push(
  para("KISANFLOW", { alignment: AlignmentType.CENTER, bold: true, size: 24, color: GREEN, after: 120 }),
  para("Enterprise Pulse", { alignment: AlignmentType.CENTER, bold: true, size: 54, color: INK, after: 60, line: 560 }),
  para("AI-driven 26-week cash-flow prediction and risk flagging for rural micro-enterprises", { alignment: AlignmentType.CENTER, size: 28, color: MUTED, after: 160 }),
  para("Proposal to NABARD Hackathon @ Global Fintech Fest 2026", { alignment: AlignmentType.CENTER, bold: true, size: 20, color: ORANGE, after: 360 }),
  table([
    ["Challenge", "AI-driven cash-flow prediction & risk flagging", "Primary user", "Field / credit officer"],
    ["Target entities", "SHGs · FPOs · rural micro-enterprises", "Prototype status", "Live code · synthetic evaluation"],
    ["Forecast horizon", "26 weeks (3–6 month requirement)", "Decision boundary", "Human maker-checker required"],
  ], [1500, 3180, 1500, 3180], false),
  para("", { after: 160 }),
  callout("THE THESIS", "KisanFlow predicts the next 26 weeks of enterprise cash flow, explains emerging stress before a missed repayment, and helps an authorised officer choose a consented corrective response. It never sanctions, rejects, restructures, disburses, or contacts a customer on its own."),
  h2("Why KisanFlow is differentiated"),
  bullet("Exact challenge fit: 26-week P10/P50/P90 forecasting, multiple data rails, early warning and actionable field-officer insight."),
  bullet("Proof over theatre: reproducible ML training, rolling-origin evaluation, explicit baseline and a machine-readable artifact."),
  bullet("Advanced agentic engineering with a narrow boundary: real LLM tool planning when configured; deterministic numbers, verifier, budgets, replay and maker-checker in every mode."),
  bullet("Honest public-interest infrastructure: granular consent, model/data cards, open standards, Apache-2.0 and DPG/DPDP readiness without false certification claims."),
  pageBreak(),
);

// Page 2 — challenge and use case
children.push(
  h1("1. Problem fit and primary use case"),
  para("The official 2026 brief asks for an AI/ML system that predicts rural-enterprise cash flow over three to six months, combines financial, digital-transaction, market/historical and climate/seasonality signals, identifies emerging stress and gives enterprises and field officers a useful corrective action. KisanFlow implements that complete arc."),
  sourceLine("Official NABARD Hackathon @ GFF 2026 problem statement", "https://www.globalfintechfest.com/gff-hackathons/nabard-hackathon"),
  h2("Sakhi Dairy SHG: one deep, memorable case"),
  para("Twelve women run a fictional dairy collective in Anand, Gujarat. Weekly milk receipts soften while feed costs rise. Their point-in-time balance does not reveal whether the pressure is temporary; a 26-week curve does. KisanFlow shows P10/P50/P90 net cash flow, flags the week-eight stress window and separates a temporary liquidity gap from a structural decline."),
  table([
    ["Before KisanFlow", "With KisanFlow"],
    ["Manual review after visible arrears", "Pre-event cash-flow alert with a measured operating threshold"],
    ["Single score with hidden uncertainty", "P10/P50/P90 weekly range and visible interval coverage"],
    ["Generic collection response", "Reason-linked options: timing, verified buyer referral, advisory"],
    ["Opaque automation risk", "Consent receipt, evidence provenance, verifier and independent checker"],
  ], [4680, 4680]),
  h2("Users and value"),
  bullet("Field officers see the few cases that need attention, why the alert fired, and which source is stale or withheld."),
  bullet("Risk teams obtain temporal model evidence, portfolio/cohort measures, false-alert workload and a replayable case trace."),
  bullet("Enterprise representatives receive a plain-language reason and remain protected by consent withdrawal, correction, grievance and human review."),
  callout("POSITIONING", "KisanFlow is preventive decision support—not an autonomous lender, collections engine, fraud detector or replacement for regulated-institution accountability.", PEACH),
  pageBreak(),
);

// Page 3 — system and data
children.push(
  h1("2. Solution architecture and consented data rails"),
  para("The product is a lightweight API and officer dashboard. Each case is schema-validated, purpose/consent-checked and routed through deterministic feature, forecast, EWS and intervention services. The Case Manager may choose tool order; it cannot invent data, change a model output or access an action tool that is not exposed."),
  h2("Data contracts"),
  table([
    ["Rail", "Minimum fields", "Prototype status", "Control"],
    ["Partner ledger", "Weekly credits, debits, dues, repayment events", "Sandbox fixture", "Institution access + RBAC"],
    ["AA / payment proxy", "Consented weekly aggregates and trend features", "Schema only", "Purpose, expiry, revocation"],
    ["AGMARKNET / e-NAM", "Commodity, market, date, price", "Cached adapter fixture", "Timestamp + stale-data gate"],
    ["IMD-compatible climate", "District, date, rainfall anomaly", "Cached adapter fixture", "District aggregation"],
    ["LokOS / ULI", "Institution and enterprise interoperability fields", "Schema only", "Minimum necessary export"],
  ], [1500, 3000, 1800, 3060]),
  para([run("Status convention: ", { bold: true, size: 18, color: MUTED }), run("LIVE = running code; SYNTHETIC = generated fictional data; SANDBOX = testable contract/fixture, not a production connection.", { size: 18, color: MUTED })], { before: 80, after: 80, line: 240 }),
  h2("Consent and data minimisation"),
  bullet("Financial activity is a separately described required category; market and climate signals are optional. Refusal reduces evidence but does not silently substitute data."),
  bullet("Each receipt records purpose, categories, language, grant/expiry and revocation. Consent is checked at run start and before retrieval."),
  bullet("The public demo accepts scenario identifiers only. Production design stores weekly aggregates, not SMS, contacts, account narrations, photos, caste, religion, politics or continuous location."),
  bullet("Withdrawal stops new collection and recommendation refresh; deletion follows the partner’s lawful retention decision."),
  sourceLine("Sahamati Account Aggregator technical resources", "https://sahamati.org.in/account-aggregator-key-resources/"),
  sourceLine("Government of India: LokOS / SHE-LEAPS", "https://www.pib.gov.in/FactsheetDetails.aspx?Id=150688&lang=1&reg=3"),
  pageBreak(),
);

// Page 4 — ML
children.push(
  h1("3. Real ML prototype and evaluation contract"),
  para("The repository contains an executable scikit-learn pipeline—not aspirational model names. It deterministically generates 90 fictional enterprises over 104 weeks, engineers lag-only features, trains Gradient Boosting regressors for P10/P50/P90 and evaluates them with three rolling temporal origins. A same-week prior-year estimate is the seasonal-naïve baseline."),
  h2("Canonical synthetic results"),
  table([
    ["Measure", "Result", "Meaning / decision use"],
    ["MASE", "0.52", "Model MAE is 52% of seasonal-naïve error; <1 beats baseline"],
    ["MAE improvement", "48.0%", "Relative improvement over seasonal naïve"],
    ["P10–P90 coverage", "83.2%", "Observed holdout coverage vs nominal 80% interval"],
    ["EWS precision", "45.8%", "Conservative alerts preceding labelled synthetic stress"],
    ["EWS recall", "28.2%", "Precision/workload trade-off is explicit"],
    ["False alerts / 100", "0.83", "Expected field-review burden at conservative threshold"],
    ["Maximum recall gap", "0.092", "Synthetic cohort diagnostic only"],
  ], [2100, 1500, 5760]),
  h2("Feature and validation safeguards"),
  bullet("Features use only contemporaneous or lagged cash flow, transaction count, market index, rainfall index and seasonal encodings; future values are excluded."),
  bullet("No protected category, raw narration, counterparty or customer contact data is eligible."),
  bullet("Report MAE, sMAPE, MASE, interval coverage/width, EWS precision/recall, false alerts, lead time and subgroup gaps—never only one flattering score."),
  bullet("A partner pilot must replace synthetic data with retrospective, de-identified temporal validation and choose thresholds from real customer/operational costs."),
  callout("LIMITATION THAT BUILDS TRUST", "Synthetic evaluation proves the engineering and governance contract. It does not prove production accuracy, real-world fairness, or causal intervention impact.", PEACH),
  label("Reproduce:", "python3 ml/train_model.py → artifacts/model_metrics.json. Unit tests assert interval ordering, lag-only features, honest status and baseline performance."),
  pageBreak(),
);

// Page 5 — harness
children.push(
  h1("4. Bounded Case Manager and agent harness"),
  para("KisanFlow uses one accountable Case Manager rather than five theatrical personas. With a configured Gemini key, an LLM chooses an ordered subset of eight allow-listed tools. Without a key or on timeout, an explicitly labelled offline policy runner executes the same contract. All numerical outputs remain deterministic in both modes."),
  h2("Eight typed tools"),
  table([
    ["Stage", "Tool", "Machine output"],
    ["Gate", "validate_case_data", "Schema, consent, synthetic-only and prohibited-field checks"],
    ["Evidence", "retrieve_market_signal", "Available / withheld, source and freshness"],
    ["Features", "compute_features", "Lag windows and feature contract"],
    ["Forecast", "forecast_p10_p50_p90", "26 ordered weekly quantiles + model ID"],
    ["EWS", "detect_stress", "Window, classification and reason codes"],
    ["Grounding", "retrieve_intervention_playbook", "Approved content and allowed options"],
    ["Simulation", "simulate_intervention", "What-if P10 curve; explicitly non-causal"],
    ["Proposal", "create_action_card", "Awaiting checker; no contact/account change"],
  ], [1300, 2750, 5310]),
  h2("Harness controls"),
  bullet("Tool allow-list; strict request schema; prohibited PII fields; retrieved text treated as untrusted data."),
  bullet("Maximum eight tools, two turns and six seconds; model-call timeout falls back safely; Cloud Run caps instances."),
  bullet("Versioned model/harness, durable idempotency key, ordered event trace and stable replay fingerprint."),
  bullet("Verifier checks ordered quantiles, provenance, valid consent, numerical source and no autonomous action."),
  bullet("Maker-checker separation, override reason, consent recheck, kill switch and rollback artifact."),
  callout("NON-NEGOTIABLE BOUNDARY", "No sanction, reject, price, restructure, disburse or contact tool exists. The only writable product output is a proposed action card awaiting a different checker.", PEACH),
  pageBreak(),
);

// Page 6 — Responsible AI and DPG
children.push(
  h1("5. Responsible AI, DPDP readiness and DPG design"),
  h2("Responsible and contestable operations"),
  bullet("Purpose limitation and minimum data are enforced as run-time gates, not policy prose alone."),
  bullet("Every alert displays uncertainty, reason codes, source freshness and whether optional evidence was withheld."),
  bullet("Officers can correct data, choose manual review or override with a recorded reason; customers retain an institution grievance route."),
  bullet("Monitoring covers drift, calibration, false-alert burden, cohort gaps, intervention acceptance and adverse outcomes."),
  bullet("Release blocks include prompt injection, tool misuse, PII leakage, numerical fidelity, consent, idempotency, budgets, replay and maker-checker tests."),
  h2("Digital Public Good readiness"),
  table([
    ["DPG indicator area", "KisanFlow evidence"],
    ["Open licensing + ownership", "Apache-2.0 LICENSE, contributing and security policies"],
    ["Platform independence", "Provider-neutral API; deterministic offline path; container deployment"],
    ["Documentation", "README, OpenAPI, JSON schemas, walkthrough, model/data cards"],
    ["Non-PII extraction", "Synthetic public demo; weekly aggregate pilot contract"],
    ["Privacy + applicable law", "Consent receipt, withdrawal, TTL, DPIA/pilot gates"],
    ["Open standards", "OpenAPI 3.1 and JSON Schema 2020-12"],
    ["Do no harm", "Action boundary, cohort metrics, grievance, kill switch, threat model"],
  ], [3000, 6360]),
  para("KisanFlow claims DPG readiness—not Digital Public Goods Alliance recognition. It maps design evidence to the Standard’s nine indicators and would still require formal nomination/review."),
  sourceLine("Digital Public Goods Standard", "https://www.digitalpublicgoods.net/standard"),
  sourceLine("MeitY: Digital Personal Data Protection Rules, 2025", "https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa"),
  pageBreak(),
);

// Page 7 — pilot
children.push(
  h1("6. Six-month pilot: two districts, three cohorts, 500 enterprises"),
  para("The proposed pilot is staged so that evidence and controls mature before any customer-facing response. Suggested cohorts are women-led dairy SHGs, rural food-processing micro-enterprises and FPOs, selected with NABARD and a regulated partner institution."),
  table([
    ["Phase", "Weeks", "Work", "Promotion evidence"],
    ["Foundation", "0–4", "Agreements, DPIA, consent UX, schemas, retrospective extract", "Lawful purpose; usable/representative data"],
    ["Validation", "5–10", "Temporal backtest, calibration, cohort review, playbooks, red-team", "Approved thresholds and rollback"],
    ["Silent mode", "11–18", "Generate alerts; no customer/account action", "Precision/recall, coverage, lead time, workload"],
    ["Controlled action", "19–26", "Maker-checker responses for approved cases", "Outcomes, consent, grievances, officer time"],
  ], [1400, 900, 4100, 2960]),
  h2("Pilot success measures"),
  table([
    ["Dimension", "Primary measures", "Stop / review trigger"],
    ["Forecast", "MASE, sMAPE, P10–P90 coverage/width", "Coverage shift >10 percentage points"],
    ["Early warning", "Precision, recall, false alerts/100, median lead weeks", "Workload exceeds partner threshold"],
    ["Equity", "Missingness, alert burden and recall by cohort", "Recall gap >0.15 pending review"],
    ["Operations", "Officer minutes/case, acceptance, override, replay success", "Maker-checker or replay failure"],
    ["Customer", "Consent completion/withdrawal, grievance, missed-payment rate", "Unresolved harm or consent breach"],
  ], [1700, 4700, 2960]),
  h2("What KisanFlow needs from NABARD / partner"),
  bullet("A regulated institution and named data-protection/model-risk/field-operations owners."),
  bullet("A de-identified retrospective extract and approved sandbox/live adapter access."),
  bullet("Two district cohorts, field-officer co-design and an intervention playbook with escalation limits."),
  bullet("Joint review of thresholds, customer notice/grievance, audit evidence and pilot stop criteria."),
  pageBreak(),
);

// Page 8 — status and close
children.push(
  h1("7. Delivery status, risks and final ask"),
  h2("Demonstrated in the working prototype"),
  bullet("Responsive live demo with three rural-enterprise fixtures, granular consent, 26-week quantile chart, drivers, intervention simulation, human gate, agent trace and evaluation panel."),
  bullet("Reproducible synthetic-data forecast/EWS pipeline and canonical JSON artifact; Python and Node contract tests pass."),
  bullet("Bounded API with optional real LLM planner, deterministic fallback, verifier, idempotency and replay."),
  bullet("Apache-2.0 open core, OpenAPI/JSON schemas, model/data cards, threat model, responsible-AI and harness-eval documents."),
  bullet("Free-tier-oriented Cloud Run container: request billing, scale-to-zero, 256 MiB, one vCPU and one-instance cap."),
  h2("Open gates stated plainly"),
  table([
    ["Risk / unknown", "Current treatment", "Pilot resolution"],
    ["Synthetic performance", "Clearly labelled; no production claim", "Retrospective temporal validation"],
    ["Sandbox data rails", "Source/status visible; stale/withheld fail safely", "Authorised partner integrations"],
    ["Illustrative uplift", "Marked counterfactual and non-causal", "Controlled outcome evaluation"],
    ["Cohort bias", "Synthetic diagnostic only", "Real missingness/alert/outcome review"],
    ["LLM variability", "Allow-list + deterministic numbers + fallback", "Release evals and model/version monitoring"],
    ["Cloud cost", "Scale-to-zero and max-one cap", "Budget alerts and usage review"],
  ], [1900, 3600, 3860]),
  h2("Final ask"),
  callout("PARTNER WITH KISANFLOW", "Provide one regulated-institution sponsor, two districts and six months to validate 500 enterprises—moving from retrospective evidence, to silent-mode early warning, to tightly controlled maker-checker interventions."),
  para([run("Live demo: ", { bold: true }), link("kisanflow-demo-1012823692058.us-east1.run.app", "https://kisanflow-demo-1012823692058.us-east1.run.app")]),
  para([run("Repository evidence: ", { bold: true }), run("README · MODEL_CARD · DATA_CARD · THREAT_MODEL · api/ · docs/evals/ · artifacts/model_metrics.json", { color: MUTED })], { after: 0 }),
);

const doc = new Document({
  creator: "KisanFlow",
  title: "KisanFlow Enterprise Pulse — NABARD Hackathon 2026 Application",
  description: "Evidence-backed proposal for AI-driven cash-flow prediction and risk flagging for rural micro-enterprises.",
  styles: {
    default: { document: { run: { font: "Calibri", size: 22, color: INK }, paragraph: { spacing: { after: 120, line: 300, lineRule: "auto" } } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Calibri", size: 32, bold: true, color: BLUE }, paragraph: { spacing: { before: 320, after: 160 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Calibri", size: 26, bold: true, color: BLUE }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Calibri", size: 24, bold: true, color: DARK_BLUE }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [{ reference: "proposal-bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 279 }, tabStops: [{ type: "left", position: 540 }] }, run: { font: "Calibri", size: 22, color: INK } } }] }],
  },
  sections: [{ properties: { page: { size: PAGE, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 708, footer: 708 } }, titlePage: false }, headers: { default: header }, footers: { default: footer }, children }],
});

Packer.toBuffer(doc).then((buffer) => { fs.writeFileSync(OUT, buffer); console.log(OUT); });
