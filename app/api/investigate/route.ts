import { NextResponse } from "next/server";
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

    const rawFivetranStatus =
      typeof fivetranStatus.status === "object" && fivetranStatus.status !== null
        ? (fivetranStatus.status as Record<string, unknown>)
        : {};

    timeline.push({
      step: "Check Fivetran connection",
      tool: "Fivetran API",
      status: fivetranStatus.mode === "live" ? "success" : "fallback",
      summary: `Fivetran ${String(fivetranStatus.service ?? "connection")} is ${String(
        rawFivetranStatus.setup_state ?? "checked"
      )} / ${String(rawFivetranStatus.update_state ?? "status available")}.`,
      evidence: {
        connectionId: fivetranStatus.connectionId,
        service: fivetranStatus.service,
        schema: fivetranStatus.schema,
        paused: fivetranStatus.paused,
        mode: fivetranStatus.mode,
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
      summary: `${freshness.table} is ${freshness.status}: ${freshness.actualFreshnessMinutes} minutes old vs ${freshness.expectedFreshnessMinutes} expected.`,
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
      const recoveryPlan = await generateRecoveryPlanWithGemini(inputs);

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

      return NextResponse.json({
        ok: true,
        mode: "gemini_live",
        incident,
        timeline,
        recoveryPlan,
        approvalRequired: recoveryPlan.approvalRequired,
      });
    } catch (geminiError) {
      const recoveryPlan = getFallbackRecoveryPlan(inputs);

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

      return NextResponse.json({
        ok: true,
        mode: "deterministic_agent_fallback",
        incident,
        timeline,
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
