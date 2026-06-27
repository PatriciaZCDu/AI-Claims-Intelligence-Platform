import { NextResponse } from "next/server";
import { getCommandCenter, getModelOps } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const [commandCenter, modelOps] = await Promise.all([getCommandCenter(), getModelOps()]);
  return NextResponse.json({ commandCenter, modelOps });
}
