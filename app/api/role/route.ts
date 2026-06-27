import { NextResponse } from "next/server";
import { ROLE_COOKIE, ROLES } from "@/lib/roles";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { role?: string };
  if (!ROLES.some((r) => r.value === body.role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ROLE_COOKIE, body.role as string, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
