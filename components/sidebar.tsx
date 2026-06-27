"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, FilePlus, Gauge, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Command Center", icon: LayoutDashboard, match: (p: string) => p === "/" },
  {
    href: "/claims",
    label: "Claims Queue",
    icon: ClipboardList,
    match: (p: string) => p === "/claims" || (p.startsWith("/claims/") && p !== "/claims/new"),
  },
  { href: "/claims/new", label: "New Claim", icon: FilePlus, match: (p: string) => p === "/claims/new" },
  { href: "/operations", label: "Model Operations", icon: Gauge, match: (p: string) => p === "/operations" },
  {
    href: "/operations/learning",
    label: "Learning Loop",
    icon: GitBranch,
    match: (p: string) => p === "/operations/learning",
  },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const on = item.match(path);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
