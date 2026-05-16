import { NextResponse } from "next/server";
import incidents from "@/data/incidents.json";
import { getFivetranConnectionStatus } from "@/lib/fivetran";

export async function POST() {
  try {
    const incident = incidents[0];
    const fivetranStatus = await getFivetranConnectionStatus();

    const freshness = {
      table: "pipeline_rescue.sales_orders",
      lastUpdated: "2026-05-16T12:25:00-07:00",
      expectedFreshnessMinutes: 360,
      actualFreshnessMinutes: 1020,
      status: "stale",
      rowCountCurrent: 5,
      rowCountPrevious: 5,
      mode: "demo_fallback"
    };

    const recoveryPlan = {
      likelyCause:
        "The reporting table is stale compared with the expected freshness window. The live Fivetran connection is currently connected and on schedule, so this controlled incident likely represents a delayed or missed upstream refresh that needs verification before the leadership meeting.",
      businessRisk:
        "The Executive Sales Overview dashboard may show outdated sales activity, which could lead leadership to make decisions using stale revenue or pipeline data.",
      recommendedAction:
        "Verify the latest Google Sheet source data, trigger or wait for the next Fivetran sync, confirm the BigQuery table refresh, and notify stakeholders that the dashboard should not be used for live decisions until freshness is confirmed.",
      approvalRequired: true,
      severity: "high",
      evidence: [
        `Incident: ${incident.title}`,
        `Affected dashboard: ${incident.affectedDashboard}`,
        `Fivetran service: ${fivetranStatus.service ?? "unknown"}`,
        `Fivetran schema: ${fivetranStatus.schema ?? "unknown"}`,
        `Fivetran setup state: ${
          typeof fivetranStatus.status === "object" &&
          fivetranStatus.status !== null &&
          "setup_state" in fivetranStatus.status
            ? String(fivetranStatus.status.setup_state)
            : "unknown"
        }`,
        `Data freshness status: ${freshness.status}`,
        `Actual freshness: ${freshness.actualFreshnessMinutes} minutes`,
        `Expected freshness: ${freshness.expectedFreshnessMinutes} minutes`
      ],
      nextSteps: [
        "Check whether the Google Sheet source has the latest sales rows.",
        "Confirm the Fivetran connection remains connected and on schedule.",
        "Run or wait for the next sync.",
        "Verify the BigQuery table freshness after sync.",
        "Send a stakeholder-safe update before the leadership meeting."
      ],
      stakeholderMessage:
        "The Executive Sales Overview dashboard may be showing stale sales data due to a data freshness issue in the reporting pipeline. Please avoid using the dashboard for live revenue decisions until the pipeline refresh is verified."
    };

    return NextResponse.json({
      ok: true,
      tool: "Gemini recovery planner",
      mode: "deterministic_agent_fallback",
      note: "This route currently uses deterministic fallback reasoning so the demo remains stable. Gemini integration will replace or enhance this response after the backend spine is complete.",
      inputs: {
        incident,
        fivetranStatus,
        freshness
      },
      result: recoveryPlan
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        tool: "Gemini recovery planner",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
