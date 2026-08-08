import { GoogleGenAI } from "@google/genai";

type RecoveryPlanInput = {
  incident: unknown;
  fivetranStatus: unknown;
  freshness: unknown;
};

export type RecoveryPlan = {
  likelyCause: string;
  businessRisk: string;
  recommendedAction: string;
  approvalRequired: boolean;
  severity: "low" | "medium" | "high";
  evidence: string[];
  nextSteps: string[];
  stakeholderMessage: string;
};

export function getFallbackRecoveryPlan(input: RecoveryPlanInput): RecoveryPlan {
  const incident = input.incident as {
    title?: string;
    affectedDashboard?: string;
  };
  const fivetranStatus = input.fivetranStatus as Record<string, unknown>;
  const evidenceMode = String(fivetranStatus.mode ?? "unknown");
  const hasLiveFivetranEvidence =
    evidenceMode === "mcp_live" || evidenceMode === "live";

  return {
    likelyCause: hasLiveFivetranEvidence
      ? "The reporting table is stale compared with the expected freshness window. Live Fivetran evidence shows the connection is connected and on schedule, so the incident points to a data freshness gap that needs verification before the leadership meeting."
      : "The reporting table is stale and live Fivetran evidence is unavailable. Cached connector evidence cannot verify current health, so connector status and data freshness both require verification before the leadership meeting.",
    businessRisk:
      "The Executive Sales Overview dashboard may show outdated sales activity, which could lead leadership to make decisions using stale revenue or pipeline data.",
    recommendedAction: hasLiveFivetranEvidence
      ? "Verify the latest Google Sheet source data, confirm the Fivetran connection remains on schedule, wait for or trigger the next sync, confirm the BigQuery table freshness, and notify stakeholders that the dashboard should not be used for live decisions until freshness is verified."
      : "Restore or verify live Fivetran telemetry first, then verify the latest Google Sheet source data and BigQuery freshness before clearing the dashboard for stakeholder use.",
    approvalRequired: true,
    severity: "high",
    evidence: [
      `Incident: ${incident.title ?? "Monday Sales Dashboard is stale"}`,
      `Affected dashboard: ${
        incident.affectedDashboard ?? "Executive Sales Overview"
      }`,
      hasLiveFivetranEvidence
        ? "Live Fivetran connection status was checked."
        : "Live Fivetran status is unavailable; cached connector evidence is advisory only.",
      "The reporting table is outside the expected freshness window.",
    ],
    nextSteps: [
      "Check whether the Google Sheet source has the latest sales rows.",
      hasLiveFivetranEvidence
        ? "Confirm the Fivetran connection remains connected and on schedule."
        : "Restore or verify live Fivetran telemetry before judging connector health.",
      "Wait for or trigger the next sync.",
      "Verify the BigQuery table freshness after sync.",
      "Send a stakeholder-safe update before the leadership meeting.",
    ],
    stakeholderMessage:
      "The Executive Sales Overview dashboard may be showing stale sales data due to a reporting pipeline freshness issue. Please avoid using the dashboard for live revenue decisions until the pipeline refresh is verified.",
  };
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  throw new Error("Gemini response did not contain valid JSON.");
}

function buildJudgeSafeEvidence(input: RecoveryPlanInput) {
  const incident = input.incident as Record<string, unknown>;
  const fivetranStatus = input.fivetranStatus as Record<string, unknown>;
  const freshness = input.freshness as Record<string, unknown>;

  const rawStatus =
    typeof fivetranStatus.status === "object" && fivetranStatus.status !== null
      ? (fivetranStatus.status as Record<string, unknown>)
      : {};

  return {
    incident: {
      title: incident.title,
      severity: incident.severity,
      affectedDashboard: incident.affectedDashboard,
      destinationTable: incident.destinationTable,
      businessImpact: incident.businessImpact,
      lastSuccessfulRefreshHoursAgo: incident.lastSuccessfulRefreshHoursAgo,
    },
    fivetranStatus: {
      service: fivetranStatus.service,
      schema: fivetranStatus.schema,
      paused: fivetranStatus.paused,
      setupState: rawStatus.setup_state,
      schemaStatus: rawStatus.schema_status,
      syncState: rawStatus.sync_state,
      updateState: rawStatus.update_state,
      tasks: rawStatus.tasks,
      warnings: rawStatus.warnings,
      evidenceMode: fivetranStatus.mode,
      liveEvidenceAvailable:
        fivetranStatus.mode === "mcp_live" || fivetranStatus.mode === "live",
    },
    freshness: {
      table: freshness.table,
      lastUpdated: freshness.lastUpdated,
      expectedFreshnessMinutes: freshness.expectedFreshnessMinutes,
      actualFreshnessMinutes: freshness.actualFreshnessMinutes,
      status: freshness.status,
      rowCountCurrent: freshness.rowCountCurrent,
      rowCountPrevious: freshness.rowCountPrevious,
    },
  };
}

export async function generateRecoveryPlanWithGemini(
  input: RecoveryPlanInput
): Promise<RecoveryPlan> {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (!project) {
    throw new Error("Missing GOOGLE_CLOUD_PROJECT.");
  }

  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });

  const judgeSafeEvidence = buildJudgeSafeEvidence(input);

  const prompt = `
You are Pipeline Rescue Agent, a data operations incident agent.

Your job:
Analyze a stale business reporting pipeline using the provided evidence.
Return ONLY valid JSON. No markdown. No commentary.

Important interpretation rules:
- Treat the provided freshness status as a controlled demo incident for a hackathon.
- Evidence provenance is safety-critical. Treat Fivetran as currently healthy only when liveEvidenceAvailable is true and the live health fields are healthy.
- If liveEvidenceAvailable is false, never describe the Fivetran connection as live, currently healthy, or verified healthy. Say current connector health needs verification.
- Do not expose implementation labels such as cached_fivetran_evidence verbatim to stakeholders, but preserve their meaning: cached evidence is historical/advisory, not current proof.
- If live Fivetran evidence is healthy but the table is stale, explain that the agent should verify source data, sync timing, and BigQuery freshness before stakeholders use the dashboard.
- Be honest: if evidence is inconclusive, say the likely cause needs verification.
- Keep the output useful for a business analyst.
- Keep the stakeholder message calm and concise.

Evidence:
${JSON.stringify(judgeSafeEvidence, null, 2)}

Return this exact JSON shape:
{
  "likelyCause": "string",
  "businessRisk": "string",
  "recommendedAction": "string",
  "approvalRequired": true,
  "severity": "low | medium | high",
  "evidence": ["string"],
  "nextSteps": ["string"],
  "stakeholderMessage": "string"
}
`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  const text = response.text ?? "";
  const jsonText = extractJson(text);
  const parsed = JSON.parse(jsonText);

  return {
    likelyCause: String(parsed.likelyCause),
    businessRisk: String(parsed.businessRisk),
    recommendedAction: String(parsed.recommendedAction),
    approvalRequired: Boolean(parsed.approvalRequired),
    severity:
      parsed.severity === "low" ||
      parsed.severity === "medium" ||
      parsed.severity === "high"
        ? parsed.severity
        : "high",
    evidence: Array.isArray(parsed.evidence)
      ? parsed.evidence.map(String)
      : [],
    nextSteps: Array.isArray(parsed.nextSteps)
      ? parsed.nextSteps.map(String)
      : [],
    stakeholderMessage: String(parsed.stakeholderMessage),
  };
}
