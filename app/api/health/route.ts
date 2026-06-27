import { NextResponse } from "next/server";
import { activeProvider } from "@/lib/platform";
import { getAdmin } from "@/lib/supabase/admin";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    provider: activeProvider(),
    supabaseConfigured: Boolean(getAdmin()),
    time: new Date().toISOString(),
  });
}
