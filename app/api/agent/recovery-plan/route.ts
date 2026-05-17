import { NextResponse } from "next/server";
import incidents from "@/data/incidents.json";
import { getFivetranConnectionStatus } from "@/lib/fivetran";
import {
  generateRecoveryPlanWithGemini,
  getFallbackRecoveryPlan,
} from "@/lib/gemini";

export async function POST() {
  const incident = incidents[0];

  const freshness = {
    table: "pipeline_rescue.sales_orders",
    lastUpdated: "2026-05-16T12:25:00-07:00",
    expectedFreshnessMinutes: 360,
    actualFreshnessMinutes: 1020,
    status: "stale",
    rowCountCurrent: 5,
    rowCountPrevious: 5,
    mode: "demo_fallback",
  };

  try {
    const fivetranStatus = await getFivetranConnectionStatus();

    const inputs = {
      incident,
      fivetranStatus,
      freshness,
    };

    try {
      const recoveryPlan = await generateRecoveryPlanWithGemini(inputs);

      return NextResponse.json({
        ok: true,
        tool: "Gemini recovery planner",
        mode: "gemini_live",
        inputs,
        result: recoveryPlan,
      });
    } catch (geminiError) {
      const fallbackPlan = getFallbackRecoveryPlan(inputs);

      return NextResponse.json({
        ok: true,
        tool: "Gemini recovery planner",
        mode: "deterministic_agent_fallback",
        fallbackReason:
          geminiError instanceof Error
            ? geminiError.message
            : "Unknown Gemini error",
        inputs,
        result: fallbackPlan,
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        tool: "Gemini recovery planner",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
