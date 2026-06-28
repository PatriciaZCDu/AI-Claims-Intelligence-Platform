"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { navForRole } from "./sidebar";

export function MobileNav({ role }: { role: Role }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-brand px-3 py-2 md:hidden"
    >
      {navForRole(role).map((item) => {
        const Icon = item.icon;
        const on = item.match(path);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              on ? "bg-white/15 text-white" : "text-blue-100/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
