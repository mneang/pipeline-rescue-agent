# Pipeline Rescue Agent

Pipeline Rescue Agent is an evidence-backed, human-approved executive incident cockpit for stale reporting pipelines.

It answers one urgent business question: **can stakeholders trust this dashboard right now?**

The agent investigates the incident, checks live Fivetran status, checks BigQuery freshness, uses Gemini on Google Cloud to generate a recovery plan, records an auditable agent run ledger, and requires human approval before producing a stakeholder-ready recovery brief.

**Hackathon:** [Google Cloud Rapid Agent Hackathon](https://rapid-agent.devpost.com/)  
**Track:** Fivetran  
**Live Demo:** https://pipeline-rescue-agent-226881366082.us-central1.run.app  
**Repository:** https://github.com/mneang/pipeline-rescue-agent

---

## Quick demo path

1. Open the live demo.
2. Click **Run Rescue Investigation**.
3. Review the executive trust decision.
4. Open optional proof panels for evidence, audit, or recovery details.
5. Click **Approve Recovery Brief**.
6. Review the approved stakeholder brief.

---

## Why this exists

Business dashboards are only useful when the data behind them is fresh and trustworthy.

When a sales, finance, or operations dashboard becomes stale before an important meeting, analysts often have to jump between tools to answer basic questions:

- Is the pipeline healthy?
- Did the source stop updating?
- Is the warehouse table stale?
- Which dashboard is affected?
- What should stakeholders be told?
- What action needs human approval?

Pipeline Rescue Agent compresses that investigation into one agent workflow.

It is not a chatbot and it is not just a monitoring dashboard. It is a focused data incident responder that gathers evidence, makes a decision, records its reasoning path, and stops for human approval before communication.

---

## Demo scenario

The current demo simulates a high-severity reporting incident:

> The Monday Sales Dashboard is stale before a leadership meeting. The agent investigates whether the Executive Sales Overview dashboard can be trusted before stakeholders use outdated sales data.

The demo pipeline is:

```text
Google Sheets source
   |
   v
Fivetran connection
   |
   v
BigQuery table: pipeline_rescue.sales_orders
   |
   v
Executive Sales Overview dashboard scenario
```

The agent determines that Fivetran is healthy, BigQuery data is stale, and the likely issue is upstream source freshness, sync detection, or downstream processing.

---

## How the agent works

Pipeline Rescue Agent runs a structured investigation:

1. Loads the active reporting incident.
2. Checks live Fivetran connection status.
3. Checks live BigQuery freshness evidence.
4. Uses Gemini on Google Cloud to generate a recovery plan.
5. Records an auditable agent run ledger.
6. Requires human approval before producing the stakeholder-ready recovery brief.

The model recommends; the human approves.

---

## Key features

- **Live Fivetran status check**  
  Reads the active connection status, setup state, sync state, update state, warnings, and tasks.

- **Live BigQuery freshness check**  
  Checks the destination table freshness and row count evidence.

- **Gemini recovery planning**  
  Uses Gemini on Google Cloud to generate likely cause, business risk, recommended action, evidence, next steps, and stakeholder messaging.

- **Agent Run Ledger**  
  Records the agent goal, plan, tools used, observations, decision, confidence, guardrails, and final artifact status.

- **Human approval guardrail**  
  High-severity or stale-data incidents require human approval before the recovery brief is treated as stakeholder-ready.

- **Fallback strategy**  
  If Fivetran, BigQuery, or Gemini are unavailable, the app returns clearly labeled fallback results so the demo remains stable without hiding failures.

---

## Agent Run Ledger

The main investigation route returns an `agentRun` object that documents the full agent workflow.

The ledger includes:

- agent goal
- mission context
- investigation plan
- tools used
- observations gathered from Fivetran, BigQuery, and Gemini
- decision summary
- confidence level
- guardrails
- final artifact status

This makes the agent behavior auditable. The system does not simply return a generated answer; it performs a structured investigation, records evidence, makes a decision, and stops for human approval before stakeholder communication.

Example decision fields:

```json
{
  "pipelineStatus": "Healthy",
  "dataStatus": "Stale",
  "likelyIssue": "Upstream source freshness",
  "confidence": "high",
  "approvalRequired": true
}
```

---

## Human approval and guardrails

Pipeline Rescue Agent is designed for safe operational use.

For high-severity or stale-data incidents, the application enforces human approval before the recovery brief is treated as stakeholder-ready. Gemini can generate the recommendation, but the app-level guardrail controls whether the result is approved for communication.

Guardrails include:

- the agent does not send stakeholder communication automatically
- the agent does not perform destructive pipeline operations automatically
- the agent uses Fivetran and BigQuery evidence before generating a recommendation
- the recovery brief requires human approval before it is treated as stakeholder-ready

---

## Architecture

<img width="1774" height="887" alt="technical architecture" src="https://github.com/user-attachments/assets/79ee1f22-cea8-4fb3-a67f-c58ab83532de" />

```text
User / Judge
   |
   v
Next.js Web App
   |
   |-- Executive incident cockpit
   |-- Trust decision summary
   |-- Optional proof panels
   |-- Evidence trail
   |-- Agent Run Ledger
   |-- Recovery path
   |-- Human approval
   |-- Approved stakeholder brief
   |
   v
Next.js API Routes on Cloud Run
   |
   |-- POST /api/investigate
   |      orchestrates the full agent investigation
   |      returns timeline + agentRun + recoveryPlan
   |
   |-- GET /api/incidents
   |      loads the demo incident
   |
   |-- GET /api/fivetran/status
   |      checks live Fivetran connection status
   |
   |-- GET /api/data/freshness
   |      checks live BigQuery freshness
   |
   |-- POST /api/agent/recovery-plan
   |      generates a Gemini recovery plan
   |
   |-- POST /api/approval/generate-brief
   |      generates the approved recovery brief
   |
   v
Google Cloud + Partner Services
   |
   |-- Cloud Run
   |      hosts the web app and API routes
   |
   |-- Gemini on Google Cloud / Vertex AI
   |      generates recovery recommendations
   |
   |-- BigQuery
   |      stores synced sales order data and provides freshness evidence
   |
   |-- Secret Manager
   |      stores Fivetran API credentials for deployment
   |
   |-- Fivetran
          syncs Google Sheets source data into BigQuery
          provides live connection status for the agent investigation
```

---

## Tech stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes
- **Hosting:** Google Cloud Run
- **AI:** Gemini on Google Cloud / Vertex AI through the Google Gen AI SDK
- **Data destination:** BigQuery
- **Partner integration:** Fivetran
- **Secrets:** Google Cloud Secret Manager
- **Development environment:** GitHub Codespaces

---

## Google Cloud usage

This project uses Google Cloud throughout the workflow:

- **Cloud Run** hosts the deployed web app and API routes.
- **Gemini on Google Cloud / Vertex AI** generates recovery recommendations from incident evidence.
- **BigQuery** stores Fivetran-synced sales order data and provides freshness evidence.
- **Secret Manager** stores Fivetran credentials for the deployed service.
- **Cloud Build / Artifact Registry** support Cloud Run source deployment.

---

## Fivetran usage

Fivetran is the partner-powered pipeline layer for the demo.

The app checks live Fivetran connection status through the backend, including:

- connection ID
- service
- schema
- setup state
- sync state
- update state
- warnings
- tasks

This helps the agent distinguish between a broken connector and a stale-data scenario where the connector is healthy but the destination table has not received fresh records.

---

## Fivetran MCP validation

The official Fivetran MCP server was validated locally in read-only mode with:

```text
FIVETRAN_ALLOW_WRITES=false
```

During development, a local MCP client successfully:

- initialized the official Fivetran MCP server
- listed 77 available tools
- confirmed connection-inspection tools including `list_connections`, `get_connection_details`, and `get_connection_state`
- called `get_connection_details` for the same Fivetran connection used in the deployed demo
- retrieved live connection details for the Google Sheets to BigQuery pipeline

For judge-facing reliability, the deployed Cloud Run app uses stable backend tool routes to inspect Fivetran status and BigQuery freshness. The MCP validation confirms compatibility with the official Fivetran MCP surface without adding late-stage deployment risk to the public demo.

---

## API routes

### `POST /api/investigate`

Main orchestration route.

Runs the full agent investigation and returns:

- incident
- timeline
- `agentRun`
- recovery plan
- approval requirement

Example test:

```bash
curl -X POST https://pipeline-rescue-agent-226881366082.us-central1.run.app/api/investigate
```

### `GET /api/incidents`

Returns the active demo incident.

### `GET /api/fivetran/status`

Checks live Fivetran connection status.

### `GET /api/data/freshness`

Checks live BigQuery freshness using synced table metadata and row count evidence.

### `POST /api/agent/recovery-plan`

Generates a recovery plan using Gemini, with deterministic fallback behavior.

### `POST /api/approval/generate-brief`

Generates the final stakeholder-ready recovery brief after human approval.

---

## Demo flow

Open the live demo:

```text
https://pipeline-rescue-agent-226881366082.us-central1.run.app
```

Then:

1. Click **Run Rescue Investigation**.
2. Review the **Executive Incident Cockpit** trust decision.
3. Open optional proof panels if you want to inspect evidence, audit, or recovery details.
4. Click **Approve Recovery Brief**.
5. Review the approved stakeholder brief and before/after impact summary.

The intended interaction is intentionally short:

```text
Run Rescue Investigation
   |
   v
Review trust decision
   |
   v
Approve Recovery Brief
```

---

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/mneang/pipeline-rescue-agent.git
cd pipeline-rescue-agent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env.local`

Use `.env.example` as a starting point.

```env
FIVETRAN_API_KEY=
FIVETRAN_API_SECRET=
FIVETRAN_CONNECTION_ID=

GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=true
GEMINI_MODEL=gemini-2.5-flash

BIGQUERY_DATASET=pipeline_rescue
BIGQUERY_TABLE=sales_orders

DEMO_MODE=true
LIVE_MODE=true
```

### 4. Authenticate with Google Cloud for local development

```bash
gcloud auth login
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
gcloud config set project YOUR_PROJECT_ID
```

### 5. Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Useful local tests

```bash
curl -X POST http://localhost:3000/api/investigate
curl http://localhost:3000/api/fivetran/status
curl http://localhost:3000/api/data/freshness
curl -X POST http://localhost:3000/api/agent/recovery-plan
```

---

## Deployment

The project is deployed to Google Cloud Run.

Example deploy command:

```bash
gcloud run deploy pipeline-rescue-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

The deployed service uses Cloud Run environment variables and Secret Manager for Fivetran credentials.

---

## Fallback strategy

The app is designed to keep the demo stable without hiding failures.

Fallback behavior:

- If Fivetran credentials are missing or unavailable, the app returns a clearly labeled fallback response.
- If BigQuery freshness cannot be queried, the app returns a demo fallback freshness result.
- If Gemini is unavailable, the app uses a deterministic fallback recovery plan.

This makes the project reliable for judging while still showing live integrations when available.

---

## MVP scope and limitations

The current MVP intentionally focuses on one high-impact incident scenario.

Current limitations:

- one demo incident scenario
- no multi-user authentication
- no automatic stakeholder email sending
- no destructive pipeline actions
- no automatic Fivetran resync trigger
- no full dashboard BI integration
- deployed app uses stable backend routes while Fivetran MCP was validated locally

These limits are intentional. The project prioritizes a reliable, judge-testable vertical slice of an agentic data incident response workflow.

---

## Future improvements

Possible future improvements:

- add more incident scenarios
- add optional MCP-driven tool execution path in production
- add Fivetran sync-history inspection
- add exportable recovery briefs
- add optional stakeholder email draft after approval
- add incident history and trend analysis
- add dashboard lineage mapping
- add ticket creation after human approval

---

## License

This project is licensed under the terms in the `LICENSE` file.
