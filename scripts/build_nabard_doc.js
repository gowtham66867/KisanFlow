const fs = require("fs");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} = require("docx");

const PAGE = { width: 12240, height: 15840 }; // US Letter, DXA

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 150 },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
  });
}

function body(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 120 },
  });
}

function labeled(label, text) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label} `, bold: true, size: 22 }),
      new TextRun({ text, size: 22 }),
    ],
    spacing: { after: 120 },
  });
}

function bullet(text) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          size: PAGE,
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "KisanFlow",
              bold: true,
              size: 44,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "AI-Powered Cash Flow Forecasting for Rural Credit Access",
              italics: true,
              size: 26,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E7D32" },
          },
        }),
        new Paragraph({ text: "", spacing: { after: 300 } }),

        h1("1. Project Title"),
        body("KisanFlow — AI-Powered Cash Flow Forecasting for Rural Credit Access"),

        h1("2. Problem Statement"),
        body(
          "Over 100 million agricultural households in India lack formal credit history, forcing lenders into conservative, manual assessments that under-serve rural borrowers."
        ),

        h1("3. Proposed Solution / Business Model / Commercial Potential"),
        labeled(
          "Solution:",
          "A B2B2C SaaS platform offered to banks, NBFCs, microfinance institutions, and agri-fintechs (e.g., Samunnati, Jai Kisan, DeHaat) as a plug-in cash-flow-prediction layer for their existing lending workflows. Lenders integrate via API to get real-time cash flow forecasts and creditworthiness signals for borrowers who lack formal financial history — enabling faster, more confident credit decisions without needing new field infrastructure."
        ),
        h2("Revenue model"),
        bullet(
          "Per-API-call / per-assessment pricing for lenders, similar to how credit bureau checks are priced today."
        ),
        bullet(
          "Tiered SaaS subscription for NBFCs and microfinance institutions based on borrower volume."
        ),
        bullet(
          "Revenue-share model with agri-fintech platforms who white-label the forecasting engine into their own farmer-facing apps."
        ),
        h2("Commercial potential"),
        bullet(
          "Non-institutional lenders (moneylenders, traders) still account for roughly 28% of agricultural credit in India — the specific gap this product targets is credit-history-less borrowers who default to that channel today (NABARD, Trends and Patterns in Agriculture Credit in India)."
        ),
        bullet(
          "Ground Level Credit (institutional agri-credit flow) has grown from ₹8 lakh crore (FY 2014–15) to a ₹32.5 lakh crore target for FY 2025–26 — the addressable pipe this product plugs into is large and growing, not a fixed pool (Ministry of Finance / NABARD)."
        ),
        bullet(
          "Credit is regionally skewed: southern states receive ~48% of agricultural credit against 17% of cropped area, while East (~8.2%) and Central India (~13.7%) are structurally under-financed — a concrete, geographically targetable underserved segment rather than a generic national estimate."
        ),
        bullet(
          "Lenders currently rely on manual field assessments or overly conservative scoring — this reduces both lender risk and borrower rejection rates, expanding the addressable lending market."
        ),
        bullet(
          "Aligns with RBI and NABARD's push toward alternative data-based credit scoring and financial inclusion, positioning this as policy-aligned infrastructure rather than a standalone product — improving odds of institutional partnership and pilot funding."
        ),
        bullet(
          "Scalable beyond agriculture to other informal-income segments: gig workers, small traders, and rural artisans."
        ),

        h1("4. Technology Stack Details"),
        labeled(
          "Agent Orchestration:",
          "A Orchestrator agent (LangGraph / CrewAI) dynamically routes each request across five specialist agents rather than following one fixed pipeline — the route itself changes based on borrower state (e.g., a returning borrower is routed through the Memory Agent first; a new borrower skips it entirely)."
        ),
        h2("Agentic safety & reasoning layer"),
        bullet(
          "Memory Agent — recalls a returning borrower's prior-season repayment history from a persistent store and applies a trust adjustment to the confidence score, so track record compounds over time instead of every season starting from zero."
        ),
        bullet(
          "Verifier Agent — a self-check step that reviews the Forecasting Agent's own output against a sanity band before it reaches the lender. If confidence is too low to trust the number, the Verifier rejects the ML forecast outright rather than passing it downstream."
        ),
        bullet(
          "Guardrail fallback — when the Verifier rejects a forecast, the system does not fail silently: it falls back to a conservative, rule-based estimate (input cost × fixed multiplier) and always routes that file to a human loan officer, regardless of score."
        ),
        bullet(
          "Retrieval-augmented Advisory Agent — grounds its farmer-facing explanation in retrieved region- and crop-specific risk notes (e.g., regional monsoon variability, crop-specific payment timing) rather than generating unsourced free text."
        ),
        bullet(
          "Full reasoning trace — every tool call, agent handoff, verification result, and fallback decision is logged in a human-readable trace, so a loan officer (or auditor) can see exactly why a recommendation was made."
        ),
        h2("Data Layer"),
        bullet("Weather & rainfall data via IMD/OpenWeather APIs"),
        bullet("Crop calendar and mandi price data via Agmarknet / e-NAM APIs"),
        bullet(
          "Mobile recharge / UPI transaction proxies (where consented and available) as informal income signals"
        ),
        bullet(
          "Historical repayment data from partner lender systems (for training/calibration)"
        ),
        h2("Forecasting Engine"),
        bullet("Time-series models (Prophet / LSTM) for seasonal cash flow prediction"),
        bullet(
          "Gradient-boosted models (XGBoost) for creditworthiness scoring using proxy features"
        ),
        bullet(
          "Confidence scoring layer to flag low-certainty predictions for human review"
        ),
        h2("Advisory & Interface"),
        bullet(
          "LLM (Claude/GPT-based) to convert forecasts into plain-language, vernacular-friendly recommendations"
        ),
        bullet("REST API layer for integration into lender loan-origination systems"),
        bullet(
          "Lightweight web/mobile dashboard for loan officers to review flagged cases"
        ),
        h2("Infrastructure"),
        bullet(
          "Cloud-hosted (AWS/GCP) with containerized microservices (Docker/Kubernetes) for each agent"
        ),
        bullet(
          "PostgreSQL for structured data, vector DB (optional) for retrieval-augmented context in the Advisory Agent"
        ),

        h1("5. Process Flow / Architecture"),
        labeled(
          "Step 0 — Orchestrator routing (Memory Agent, conditional):",
          "The Orchestrator inspects borrower state first. A returning borrower is routed through the Memory Agent, which recalls prior-season repayment history and applies a trust adjustment to confidence before any new data is even pulled. A new borrower skips this step entirely — the route itself changes, not just the data."
        ),
        labeled(
          "Step 1 — Data Ingestion (Data Agent, tool calls):",
          "Borrower/farmer profile is created (location, crop type, land size). The Data Agent makes explicit tool calls — get_weather(), get_mandi_price(), get_transaction_history() — pulling only the signals actually available for this borrower; unavailable signals are logged as skipped rather than silently defaulted."
        ),
        labeled(
          "Step 2 — Cash Flow Forecasting (Forecasting Agent):",
          "The Data Agent's output feeds into the Forecasting Agent, which projects monthly cash inflows (harvest sales, other income) and outflows (input costs, household expenses, existing debt repayment). It identifies upcoming deficit windows (e.g., pre-harvest lean months) and generates a creditworthiness/repayment-capacity score."
        ),
        labeled(
          "Step 3 — Self-verification (Verifier Agent):",
          "Before anything reaches a lender, the Verifier Agent checks the Forecasting Agent's own output against a sanity band derived from data completeness. This is a genuine agentic safety check, not a rubber stamp:"
        ),
        bullet("Sanity check passes → forecast is cleared to continue to routing."),
        bullet(
          "Sanity check fails (confidence too low to trust) → the ML forecast is rejected outright, and a guardrail fallback substitutes a conservative, rule-based estimate instead."
        ),
        labeled(
          "Step 4 — Confidence-based routing:",
          "Each forecast carries a confidence score based on data completeness, signal reliability, and any memory trust adjustment."
        ),
        bullet("High confidence and Verifier pass → routed automatically for an instant recommendation."),
        bullet(
          "Low confidence, or a Verifier rejection → always flagged and routed to a human loan officer for manual review before proceeding."
        ),
        labeled(
          "Step 5 — Advisory Output (Advisory Agent, retrieval-grounded):",
          "The forecast and score are converted into plain-language, vernacular-friendly guidance for both the lender (recommended loan amount, basis, ideal disbursement timing, repayment schedule) and the borrower (when to expect tight months, how much buffer to request). The farmer-facing explanation is grounded in retrieved region- and crop-specific risk notes rather than generated as unsourced free text."
        ),
        labeled(
          "Step 6 — Integration & Action:",
          "Recommendations are delivered via API into the lender's existing loan origination system (or a simple dashboard for smaller MFIs), where the loan officer approves, adjusts, or requests more borrower data."
        ),
        labeled(
          "Feedback Loop:",
          "Actual repayment outcomes are written back into the Memory Agent's store, so they both recalibrate the Forecasting Agent's seasonal models and compound into future confidence scores for that specific borrower."
        ),

        h1("6. Data Sources & Known Limitations"),
        body(
          "The prototype's crop-economics baselines (yield per acre, MSP, cost of cultivation) are drawn from published government sources rather than invented figures, converted from per-hectare to per-acre at 1 hectare = 2.471 acres:"
        ),
        bullet("Rice: 17 quintal/acre (DES Cost of Cultivation, 41.25 quintal/hectare) · ₹2,369/quintal (Kharif MSP 2024–25)."),
        bullet("Cotton: 5 quintal/acre kapas, derived from a 405–436 kg/hectare lint yield (USDA/CAI) at ~34% ginning outturn · ₹7,710/quintal (Kharif MSP 2024–25, medium staple)."),
        bullet("Wheat: 15 quintal/acre national average (Economic Survey yield table; irrigated belts such as Punjab run 40–50% higher) · ₹2,275/quintal (RMS 2024–25 MSP)."),
        bullet("Sugarcane: 300 quintal/acre and ₹340/quintal are approximate national-average estimates — flagged in-product as unconfirmed pending an exact FRP figure."),
        bullet("Cost of cultivation for each crop uses the midpoint of published CACP/DES per-acre ranges, not this specific farmer's actual input spend."),
        bullet("Non-institutional lenders still account for ~28% of agricultural credit nationally, and credit is regionally skewed (South ~48% of credit vs. 17% of cropped area; East ~8.2%, Central ~13.7%) — NABARD, Trends and Patterns in Agriculture Credit in India."),
        h2("What is still a placeholder, not a finding"),
        bullet(
          "Weather, mandi-price, and UPI/transaction signals are simulated toggles in the demo, not live API calls — the Data Agent's tool-call interface is real, the data behind it is not yet connected."
        ),
        bullet(
          "The repayment-capacity and confidence scores are transparent formulas grounded in real crop economics, not a model trained or backtested against actual repayment/default outcomes — that validation requires a lending partner's historical data and has not been done."
        ),
        bullet(
          "Household expense assumptions and regional monsoon-risk notes are planning estimates, not sourced statistics, and are labelled as such in the product."
        ),
        body(
          "This section is included deliberately: a lending-adjacent tool that cannot show its assumptions is harder to trust than one that states plainly what is verified and what is still an estimate."
        ),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/Users/gowtham/Downloads/AIAgent/NABARD/KisanFlow_NABARD_Application.docx";
  fs.writeFileSync(out, buf);
  console.log("written:", out);
});
