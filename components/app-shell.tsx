import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck, MapPin, Cpu } from "lucide-react";
import { getActor } from "@/lib/rbac";
import { PLATFORM, activeModelLabel } from "@/lib/platform";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { RoleSwitcher } from "./role-switcher";

export async function AppShell({ children }: { children: ReactNode }) {
  const actor = await getActor();
  const role = actor.role;
  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 flex-col bg-brand md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-4 text-white">
          <ShieldCheck className="h-6 w-6" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Scale AI</div>
            <div className="text-[11px] text-blue-200">Claims Intelligence</div>
          </div>
        </Link>
        <Sidebar role={role} />
        <div className="mt-auto px-5 py-4 text-[11px] leading-relaxed text-blue-200/70">
          AI-Assisted Vehicle
          <br />
          Damage Assessment
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav role={role} />
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Region {PLATFORM.region}
            </span>
            <span className="hidden sm:inline">Data Residency: {PLATFORM.dataResidency}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
              <Cpu className="h-3.5 w-3.5" /> {activeModelLabel()}
            </span>
          </div>
          <RoleSwitcher initialUserId={actor.id} />
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
