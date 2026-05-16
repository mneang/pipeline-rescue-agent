import { NextResponse } from "next/server";
import { getFivetranConnectionStatus } from "@/lib/fivetran";

export async function GET() {
  try {
    const status = await getFivetranConnectionStatus();

    return NextResponse.json({
      ok: true,
      tool: "Fivetran connection status",
      result: status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        tool: "Fivetran connection status",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
