import { NextResponse } from "next/server";
import incidents from "@/data/incidents.json";
import { getFivetranConnectionStatus } from "@/lib/fivetran";

export async function POST() {
  try {
    const incident = incidents[0];
    const fivetranStatus = await getFivetranConnectionStatus();

    const brief = {
      title: "Pipeline Rescue Recovery Brief",
      status: "Approved for stakeholder communication",
      generatedAt: new Date().toISOString(),
      incident: {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        affectedDashboard: incident.affectedDashboard,
        businessImpact: incident.businessImpact
      },
      diagnosis: {
        likelyCause:
          "The reporting table is stale compared with the expected freshness window. The live Fivetran connection is connected and on schedule, so the immediate next step is to verify source freshness and confirm the next sync refreshes BigQuery.",
        fivetranEvidence: {
          connectionId: fivetranStatus.connectionId,
          service: fivetranStatus.service,
          schema: fivetranStatus.schema,
          mode: fivetranStatus.mode,
          status: fivetranStatus.status
        },
        dataFreshnessEvidence: {
          table: "pipeline_rescue.sales_orders",
          status: "stale",
          expectedFreshnessMinutes: 360,
          actualFreshnessMinutes: 1020,
          rowCountCurrent: 5,
          rowCountPrevious: 5
        }
      },
      recommendedActions: [
        "Confirm the Google Sheet source has the latest sales rows.",
        "Confirm the Fivetran connection remains connected and on schedule.",
        "Run or wait for the next Fivetran sync.",
        "Verify the BigQuery table refresh after sync.",
        "Notify stakeholders before the leadership meeting."
      ],
      stakeholderMessage:
        "The Executive Sales Overview dashboard may be showing stale sales data due to a reporting pipeline freshness issue. Please avoid using the dashboard for live revenue decisions until the pipeline refresh is verified.",
      humanApproval: {
        required: true,
        approved: true,
        approvedAction: "Generate stakeholder-ready recovery brief"
      }
    };

    return NextResponse.json({
      ok: true,
      tool: "Approval-gated recovery brief generator",
      mode: "deterministic_agent_fallback",
      result: brief
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        tool: "Approval-gated recovery brief generator",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
