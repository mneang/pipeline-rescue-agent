import { NextResponse } from "next/server";

export async function GET() {
  const freshness = {
    table: "pipeline_rescue.sales_orders",
    lastUpdated: "2026-05-16T12:25:00-07:00",
    expectedFreshnessMinutes: 360,
    actualFreshnessMinutes: 1020,
    status: "stale",
    rowCountCurrent: 5,
    rowCountPrevious: 5,
    mode: "demo_fallback",
    note: "Demo freshness check based on the Pipeline Rescue Agent scenario. BigQuery live query will be added after the agent spine is working."
  };

  return NextResponse.json({
    ok: true,
    tool: "Data freshness check",
    result: freshness
  });
}
