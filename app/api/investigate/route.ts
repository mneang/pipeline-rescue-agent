import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import incidents from "@/data/incidents.json";
import { getFivetranConnectionStatus } from "@/lib/fivetran";
import {
  generateRecoveryPlanWithGemini,
  getFallbackRecoveryPlan,
} from "@/lib/gemini";
import { getBigQueryFreshness } from "@/lib/bigquery";

type TimelineStep = {
  step: string;
  tool: string;
  status: "success" | "fallback" | "error";
  summary: string;
  evidence?: Record<string, unknown>;
};

type FivetranStatus = Awaited<ReturnType<typeof getFivetranConnectionStatus>>;
type FreshnessResult = Awaited<ReturnType<typeof getBigQueryFreshness>>;
type RecoveryPlan = Awaited<ReturnType<typeof generateRecoveryPlanWithGemini>>;
type Incident = (typeof incidents)[number];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function formatFreshnessWindow(minutes: number) {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  const hours = Math.round(minutes / 60);
  return `~${hours} hours`;
}

function getPipelineDecision(fivetranStatus: FivetranStatus) {
  const rawStatus = asRecord(fivetranStatus.status);

  const setupState = String(rawStatus.setup_state ?? "");
  const updateState = String(rawStatus.update_state ?? "");
  const hasWarnings =
    Array.isArray(rawStatus.warnings) && rawStatus.warnings.length > 0;
  const hasTasks = Array.isArray(rawStatus.tasks) && rawStatus.tasks.length > 0;

  // A green verdict requires current/live Fivetran evidence.
  // Cached evidence is historical context only and cannot clear the pipeline.
  const hasLiveEvidence =
    fivetranStatus.mode === "mcp_live" ||
    fivetranStatus.mode === "live";

  const isHealthy =
    hasLiveEvidence &&
    setupState === "connected" &&
    updateState === "on_schedule" &&
    !hasWarnings &&
    !hasTasks &&
    fivetranStatus.paused === false;

  const falseGreenDetected = isHealthy && !hasLiveEvidence;

  Sentry.startSpan(
    {
      name: "Evaluate Fivetran health verdict",
      op: "pipeline.decision",
    },
    (span) => {
      span.setAttribute("bugsmash.scenario", "false-green");
      span.setAttribute("evidence.mode", fivetranStatus.mode);
      span.setAttribute("evidence.live", hasLiveEvidence);
      span.setAttribute("provenance.guard_applied", !hasLiveEvidence);
      span.setAttribute(
        "fivetran.mcp_ok",
        Boolean(fivetranStatus.mcpRuntime?.ok)
      );
      span.setAttribute("fivetran.setup_state", setupState || "unknown");
      span.setAttribute("fivetran.update_state", updateState || "unknown");
      span.setAttribute(
        "pipeline.health_verdict",
        isHealthy ? "healthy" : "needs_review"
      );
      span.setAttribute("false_green.detected", falseGreenDetected);

      if (falseGreenDetected) {
        Sentry.captureMessage(
          "False green health verdict: non-live Fivetran evidence classified as Healthy",
          {
            level: "warning",
            fingerprint: ["bugsmash-false-green"],
            tags: {
              bugsmash: "false-green",
              evidence_mode: fivetranStatus.mode,
              pipeline_verdict: "healthy",
            },
            extra: {
              liveEvidence: hasLiveEvidence,
              mcpOk: Boolean(fivetranStatus.mcpRuntime?.ok),
              setupState,
              updateState,
            },
          }
        );
      }
    }
  );

  return {
    status: isHealthy ? "healthy" : "needs_review",
    label: isHealthy ? "Healthy" : "Needs review",
    reason: isHealthy
      ? "Fivetran is connected, on schedule, and reporting no active warnings or tasks."
      : !hasLiveEvidence
        ? "Live Fivetran evidence is unavailable; cached evidence is advisory only and cannot clear the pipeline."
        : "Fivetran status requires review before the incident can be cleared.",
  };
}

function getLikelyIssue(
  pipelineDecision: ReturnType<typeof getPipelineDecision>,
  freshness: FreshnessResult
) {
  if (pipelineDecision.status !== "healthy") {
    return {
      label: "Connector health",
      explanation:
        "The pipeline connector requires review, so connector health must be investigated first.",
    };
  }

  if (freshness.status === "stale") {
    return {
      label: "Upstream source freshness",
      explanation:
        "Fivetran is healthy but BigQuery data is stale, so the likely issue is source data freshness, sync detection, or downstream processing.",
    };
  }

  return {
    label: "No active freshness breach",
    explanation:
      "The pipeline and freshness checks did not identify an active freshness breach.",
  };
}

function enforceHumanApproval(
  incident: Incident,
  freshness: FreshnessResult,
  recoveryPlan: RecoveryPlan
): RecoveryPlan {
  const mustRequireApproval =
    incident.severity === "high" || freshness.status === "stale";

  if (!mustRequireApproval) {
    return recoveryPlan;
  }

  return {
    ...recoveryPlan,
    approvalRequired: true,
  };
}

function buildAgentRun(args: {
  incident: Incident;
  timeline: TimelineStep[];
  fivetranStatus: FivetranStatus;
  freshness: FreshnessResult;
  recoveryPlan: RecoveryPlan;
  mode: "gemini_live" | "deterministic_agent_fallback";
}) {
  const { incident, timeline, fivetranStatus, freshness, recoveryPlan, mode } =
    args;

  const pipelineDecision = getPipelineDecision(fivetranStatus);
  const likelyIssue = getLikelyIssue(pipelineDecision, freshness);

  const liveEvidenceCount = [
    fivetranStatus.mode === "mcp_live" ||
      fivetranStatus.mode === "live",
    freshness.mode === "live_bigquery",
    mode === "gemini_live",
  ].filter(Boolean).length;

  const confidence =
    liveEvidenceCount >= 3
      ? "high"
      : liveEvidenceCount === 2
        ? "medium-high"
        : "medium";

  return {
    agentName: "Pipeline Rescue Agent",
    runType: "data_pipeline_incident_investigation",
    goal:
      "Investigate whether a stale reporting dashboard can be trusted before stakeholders use it for business decisions.",
    mission: {
      incidentId: incident.id,
      affectedDashboard: incident.affectedDashboard,
      destinationTable: incident.destinationTable,
      businessImpact: incident.businessImpact,
    },
    plan: [
      "Load the active reporting incident.",
      "Inspect the Fivetran connection for pipeline health.",
      "Inspect BigQuery freshness evidence for the destination table.",
      "Ask Gemini to generate a recovery plan from the collected evidence.",
      "Require human approval before producing stakeholder-facing communication.",
    ],
    toolsUsed: timeline.map((step) => ({
      step: step.step,
      tool: step.tool,
      status: step.status,
    })),
    observations: [
      pipelineDecision.reason,
      `${freshness.table} is ${freshness.status}; last update is ${formatFreshnessWindow(
        freshness.actualFreshnessMinutes
      )} old against a ${formatFreshnessWindow(
        freshness.expectedFreshnessMinutes
      )} freshness expectation.`,
      `Row count comparison: current ${freshness.rowCountCurrent}, previous ${freshness.rowCountPrevious}.`,
      mode === "gemini_live"
        ? "Gemini generated the recovery plan from the incident, Fivetran status, and BigQuery freshness evidence."
        : "Gemini was unavailable, so deterministic fallback planning kept the investigation stable.",
    ],
    decision: {
      pipelineStatus: pipelineDecision.label,
      dataStatus: freshness.status === "stale" ? "Stale" : "Fresh",
      likelyIssue: likelyIssue.label,
      decisionSummary: likelyIssue.explanation,
      confidence,
      recommendedHumanAction:
        freshness.status === "stale"
          ? "Verify the source Google Sheet and Fivetran sync history before clearing the dashboard for stakeholder use."
          : "Confirm the dashboard is using the latest BigQuery data before closing the incident.",
      approvalRequired: recoveryPlan.approvalRequired,
    },
    guardrails: [
      "The agent does not send stakeholder communication automatically.",
      "The agent does not perform destructive pipeline operations automatically.",
      "The agent uses Fivetran and BigQuery evidence before generating a recommendation.",
      "The recovery brief requires human approval before it is treated as stakeholder-ready.",
    ],
    finalArtifact: {
      type: "human_approved_recovery_brief",
      status: recoveryPlan.approvalRequired
        ? "pending_human_approval"
        : "ready",
      stakeholderMessagePreview: recoveryPlan.stakeholderMessage,
    },
  };
}

export async function POST() {
  const timeline: TimelineStep[] = [];

  try {
    const incident = incidents[0];

    timeline.push({
      step: "Load incident",
      tool: "Incident store",
      status: "success",
      summary: `Incident loaded: ${incident.title}.`,
      evidence: {
        severity: incident.severity,
        affectedDashboard: incident.affectedDashboard,
        businessImpact: incident.businessImpact,
      },
    });

    const fivetranStatus = await getFivetranConnectionStatus();

    const rawFivetranStatus = asRecord(fivetranStatus.status);
    const hasLiveFivetranEvidence =
      fivetranStatus.mode === "mcp_live" || fivetranStatus.mode === "live";

    timeline.push({
      step: "Check Fivetran connection",
      tool: "Fivetran MCP / API",
      status: hasLiveFivetranEvidence ? "success" : "fallback",
      summary: hasLiveFivetranEvidence
        ? `Fivetran ${String(
            fivetranStatus.service ?? "connection"
          )} is ${String(rawFivetranStatus.setup_state ?? "checked")} / ${String(
            rawFivetranStatus.update_state ?? "status available"
          )}.`
        : "Live Fivetran status is unavailable; cached evidence is advisory only and cannot clear the pipeline.",
      evidence: {
        connectionId: fivetranStatus.connectionId,
        service: fivetranStatus.service,
        schema: fivetranStatus.schema,
        paused: fivetranStatus.paused,
        mode: fivetranStatus.mode,
        liveEvidence: hasLiveFivetranEvidence,
        mcpRuntime: fivetranStatus.mcpRuntime,
        setupState: rawFivetranStatus.setup_state,
        syncState: rawFivetranStatus.sync_state,
        updateState: rawFivetranStatus.update_state,
        tasks: rawFivetranStatus.tasks,
        warnings: rawFivetranStatus.warnings,
      },
    });

    const freshness = await getBigQueryFreshness();

    timeline.push({
      step: "Check data freshness",
      tool: "Freshness check",
      status: freshness.mode === "live_bigquery" ? "success" : "fallback",
      summary: `${freshness.table} is ${
        freshness.status
      }: ${formatFreshnessWindow(
        freshness.actualFreshnessMinutes
      )} old vs ${formatFreshnessWindow(
        freshness.expectedFreshnessMinutes
      )} expected.`,
      evidence: {
        table: freshness.table,
        lastUpdated: freshness.lastUpdated,
        expectedFreshnessMinutes: freshness.expectedFreshnessMinutes,
        actualFreshnessMinutes: freshness.actualFreshnessMinutes,
        status: freshness.status,
        rowCountCurrent: freshness.rowCountCurrent,
        rowCountPrevious: freshness.rowCountPrevious,
      },
    });

    const inputs = {
      incident,
      fivetranStatus,
      freshness,
    };

    try {
      const rawRecoveryPlan = await generateRecoveryPlanWithGemini(inputs);
      const recoveryPlan = enforceHumanApproval(
        incident,
        freshness,
        rawRecoveryPlan
      );

      timeline.push({
        step: "Generate recovery plan",
        tool: "Gemini on Google Cloud",
        status: "success",
        summary:
          "Gemini generated a recovery plan from the incident, Fivetran status, and freshness evidence.",
        evidence: {
          mode: "gemini_live",
          approvalRequired: recoveryPlan.approvalRequired,
          severity: recoveryPlan.severity,
        },
      });

      const agentRun = buildAgentRun({
        incident,
        timeline,
        fivetranStatus,
        freshness,
        recoveryPlan,
        mode: "gemini_live",
      });

      return NextResponse.json({
        ok: true,
        mode: "gemini_live",
        incident,
        timeline,
        agentRun,
        recoveryPlan,
        approvalRequired: recoveryPlan.approvalRequired,
      });
    } catch (geminiError) {
      const rawRecoveryPlan = getFallbackRecoveryPlan(inputs);
      const recoveryPlan = enforceHumanApproval(
        incident,
        freshness,
        rawRecoveryPlan
      );

      timeline.push({
        step: "Generate recovery plan",
        tool: "Deterministic fallback planner",
        status: "fallback",
        summary:
          "Gemini was unavailable, so the agent used a deterministic recovery plan fallback.",
        evidence: {
          mode: "deterministic_agent_fallback",
          fallbackReason:
            geminiError instanceof Error
              ? geminiError.message
              : "Unknown Gemini error",
          approvalRequired: recoveryPlan.approvalRequired,
          severity: recoveryPlan.severity,
        },
      });

      const agentRun = buildAgentRun({
        incident,
        timeline,
        fivetranStatus,
        freshness,
        recoveryPlan,
        mode: "deterministic_agent_fallback",
      });

      return NextResponse.json({
        ok: true,
        mode: "deterministic_agent_fallback",
        incident,
        timeline,
        agentRun,
        recoveryPlan,
        approvalRequired: recoveryPlan.approvalRequired,
      });
    }
  } catch (error) {
    timeline.push({
      step: "Investigate pipeline incident",
      tool: "Pipeline Rescue Agent",
      status: "error",
      summary: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        ok: false,
        mode: "error",
        timeline,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
