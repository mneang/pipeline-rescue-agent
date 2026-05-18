import { NextResponse } from "next/server";
import { getBigQueryFreshness } from "@/lib/bigquery";

export async function GET() {
  const freshness = await getBigQueryFreshness();

  return NextResponse.json({
    ok: true,
    tool: "Data freshness check",
    result: freshness,
  });
}
