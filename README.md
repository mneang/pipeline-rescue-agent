# Pipeline Rescue Agent

A Google Cloud + Gemini data operations agent that investigates stale reporting pipelines, checks live Fivetran pipeline status, checks live BigQuery freshness, and generates a human-approved recovery brief.

**Hackathon:** Google Cloud Rapid Agent Hackathon  
**Track:** Fivetran  
**Live Demo:** https://pipeline-rescue-agent-226881366082.us-central1.run.app  
**Repository:** Add your public GitHub repository URL here

---

## Why this exists

Business dashboards are only useful when the data behind them is fresh and trustworthy.

When a sales, finance, or operations dashboard becomes stale before an important meeting, analysts often have to jump between tools to answer basic questions:

- Is the data pipeline healthy?
- Did the source system stop updating?
- Is the destination table stale?
- Which report is affected?
- What should stakeholders be told?
- What action should be approved next?

Pipeline Rescue Agent turns that scattered investigation into one guided agent workflow.

---

## What it does

Pipeline Rescue Agent investigates a stale reporting incident and produces an approval-ready recovery brief.

The current demo scenario is:

> The Monday Sales Dashboard is stale before a leadership meeting. The agent investigates the pipeline, checks Fivetran connection status, checks BigQuery freshness, uses Gemini to reason over the evidence, and generates a recovery brief after human approval.

The agent flow is:

1. Load the active reporting incident.
2. Check live Fivetran connection status.
3. Check live BigQuery table freshness.
4. Use Gemini to generate a recovery plan from the evidence.
5. Require human approval before producing the recovery brief.
6. Generate a stakeholder-safe recovery summary.

---

## Demo flow

Open the live demo and click:

1. **Run Investigation**
2. Review the agent tool timeline:
   - Incident loaded
   - Fivetran connection checked
   - BigQuery freshness checked
   - Gemini recovery plan generated
3. Review the recovery recommendation.
4. Click **Approve Recovery Brief**
5. Review the final recovery brief and before/after impact summary.

---

## Architecture

```text
User / Judge
   |
   v
Next.js Web App
   |
   |-- Incident card
   |-- Agent tool timeline
   |-- Recovery plan
   |-- Human approval
   |-- Recovery brief
   |
   v
Next.js API Routes on Cloud Run
   |
   |-- POST /api/investigate
   |      orchestrates the full agent investigation
   |
   |-- GET /api/incidents
   |      loads the demo incident
   |
   |-- GET /api/fivetran/status
   |      checks live Fivetran connection status
   |
   |-- GET /api/data/freshness
   |      checks live BigQuery freshness with fallback
   |
   |-- POST /api/agent/recovery-plan
   |      uses Gemini to generate a recovery plan
   |
   |-- POST /api/approval/generate-brief
   |      generates the human-approved recovery brief
   |
   v
Google Cloud + Partner Services
   |
   |-- Cloud Run
   |      hosts the web app and API routes
   |
   |-- Gemini on Google Cloud / Vertex AI
   |      generates the recovery plan from incident evidence
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

This project uses Google Cloud in the agent workflow and deployment path:

- **Cloud Run** hosts the deployed web application.
- **Gemini on Google Cloud / Vertex AI** generates recovery recommendations from pipeline evidence.
- **BigQuery** stores the synced sales order data and provides live freshness evidence.
- **Secret Manager** stores Fivetran API credentials for the deployed service.
- **Cloud Build / Artifact Registry** support the Cloud Run source deployment process.

---

## Fivetran usage

Fivetran is used as the pipeline layer for the demo incident.

Current demo pipeline:

```text
Google Sheets source
   |
   v
Fivetran connection
   |
   v
BigQuery dataset/table: pipeline_rescue.sales_orders
```

The agent checks live Fivetran status through the backend, including:

- service
- schema
- setup state
- sync state
- update state
- warnings
- tasks

This helps the agent distinguish between a broken connector and a stale data situation where the connector is healthy but the destination table has not received fresh records.

---

## Gemini usage

Gemini is used to generate the recovery plan after the agent gathers evidence.

Inputs to Gemini include:

- the incident details
- live Fivetran connection status
- live BigQuery freshness evidence
- row count and freshness window information

Gemini returns a structured recovery plan with:

- likely cause
- business risk
- recommended action
- evidence
- next steps
- stakeholder-safe message
- approval requirement

The app includes a deterministic fallback plan so the demo remains stable if model access is unavailable.

---

## API routes

### `POST /api/investigate`

Main orchestration route.

Runs the full investigation:

1. Loads incident.
2. Checks Fivetran.
3. Checks BigQuery freshness.
4. Calls Gemini.
5. Returns a timeline and recovery plan.

### `GET /api/incidents`

Returns the active demo incident.

### `GET /api/fivetran/status`

Checks live Fivetran connection status.

### `GET /api/data/freshness`

Checks live BigQuery freshness using Fivetran synced metadata. Falls back to demo freshness data if BigQuery is unavailable.

### `POST /api/agent/recovery-plan`

Generates a recovery plan using Gemini, with deterministic fallback.

### `POST /api/approval/generate-brief`

Generates the final recovery brief after human approval.

---

## Fallback strategy

The app is designed to keep the demo stable without hiding failures.

Fallback behavior:

- If Fivetran credentials are missing or unavailable, the app returns a clearly labeled fallback response.
- If BigQuery freshness cannot be queried, the app returns a demo fallback freshness result.
- If Gemini is unavailable, the app uses a deterministic fallback recovery plan.

This makes the project reliable for judging while still showing live integrations when available.

---

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/mneang/pipeline-rescue-agent
cd pipeline-rescue-agent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env.local`

Create a `.env.local` file based on `.env.example`.

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

### 5. Run the app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Useful local tests

Test the main orchestration route:

```bash
curl -X POST http://localhost:3000/api/investigate
```

Test Fivetran status:

```bash
curl http://localhost:3000/api/fivetran/status
```

Test BigQuery freshness:

```bash
curl http://localhost:3000/api/data/freshness
```

Test Gemini recovery planning:

```bash
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

## Current demo scenario

The current demo uses a controlled sales reporting incident:

```text
Incident:
Monday Sales Dashboard is stale

Affected dashboard:
Executive Sales Overview

Source:
Google Sheets sales order data

Pipeline:
Google Sheets -> Fivetran -> BigQuery

Destination:
pipeline_rescue.sales_orders

Agent output:
approval-ready recovery brief
```

The scenario is intentionally narrow so the demo is easy to understand, reliable to run, and focused on a real data operations workflow.

---

## Known limitations

- The current demo focuses on one incident scenario.
- The Fivetran integration currently uses Fivetran API status checks in the deployed app.
- The BigQuery freshness check uses the synced demo table and freshness metadata.
- The project does not include authentication or multi-user workspaces.
- The app does not send real stakeholder notifications; it generates a stakeholder-ready message for human review.
- The app does not perform destructive actions or write changes back to Fivetran.

These limitations are intentional for a focused hackathon MVP.

---

## Future improvements

If extended beyond the hackathon MVP, the next improvements would be:

- Add more incident scenarios.
- Add optional Fivetran MCP server support for local or managed agent tool use.
- Add richer BigQuery lineage and dashboard dependency mapping.
- Add severity scoring.
- Add exportable recovery briefs.
- Add optional ticket creation after human approval.
- Add incident history and trend analysis.

---

## Why this matters

Pipeline Rescue Agent is designed for small data teams and business analysts who need to respond quickly when reporting pipelines become stale or unreliable.

Instead of manually jumping between pipeline tools, warehouses, and stakeholder messages, the agent creates a structured investigation path:

```text
detect the incident
check the pipeline
check the data
reason over the evidence
ask for approval
produce the recovery brief
```

The result is a faster, clearer, and safer response to reporting incidents.
