import { NextResponse } from "next/server";
import incidents from "@/data/incidents.json";

export async function GET() {
  return NextResponse.json({
    mode: "demo_seed",
    incidents,
  });
}
