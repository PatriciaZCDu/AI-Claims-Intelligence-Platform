import { NextResponse } from "next/server";
import { ROLE_COOKIE, USER_COOKIE } from "@/lib/roles";
import { personById } from "@/lib/personnel";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  const person = personById(body.userId);
  if (!person) {
    return NextResponse.json({ error: "invalid user" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, role: person.role });
  const opts = { httpOnly: false, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };
  res.cookies.set(USER_COOKIE, person.id, opts);
  // Keep the legacy role cookie in sync for back-compat.
  res.cookies.set(ROLE_COOKIE, person.role, opts);
  return res;
}
