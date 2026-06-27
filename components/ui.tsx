import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoutingDecision, Severity } from "@/lib/types";
import { ROUTING_META } from "@/lib/routing";

type Tone = "green" | "amber" | "red" | "blue" | "slate";

const TONE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  const accent: Record<Tone, string> = {
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
    blue: "text-blue-700",
    slate: "text-slate-900",
  };
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1 text-3xl font-semibold tabular-nums", accent[tone])}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

export function SeverityBadge({ severity }: { severity: Severity | null }) {
  if (!severity) return <Badge tone="slate">Unknown</Badge>;
  const tone: Tone = severity === "high" ? "red" : severity === "medium" ? "amber" : "green";
  return <Badge tone={tone}>{severity[0].toUpperCase() + severity.slice(1)}</Badge>;
}

export function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) return <Badge tone="slate">—</Badge>;
  const tone: Tone = value >= 95 ? "green" : value >= 70 ? "amber" : "red";
  return <Badge tone={tone}>{Math.round(value)}%</Badge>;
}

export function RoutingBadge({ routing }: { routing: RoutingDecision | null }) {
  if (!routing) return <Badge tone="slate">—</Badge>;
  const meta = ROUTING_META[routing];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const BUTTON_VARIANTS = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 border-blue-600",
  secondary: "bg-white text-slate-700 hover:bg-slate-50 border-slate-300",
  danger: "bg-red-600 text-white hover:bg-red-700 border-red-600",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 border-transparent",
};

export function buttonClass(variant: keyof typeof BUTTON_VARIANTS = "primary", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    className,
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
}) {
  return (
    <button className={buttonClass(variant, className)} {...props}>
      {children}
    </button>
  );
}

const CONTROL_CLASS =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500";

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium text-slate-600">{children}</span>;
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL_CLASS, className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL_CLASS, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL_CLASS, className)} {...props} />;
}

export function NavLinkRow({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <span className="flex items-center gap-2">
        {icon}
        {children}
      </span>
      <ArrowRight className="h-4 w-4 text-slate-400" />
    </Link>
  );
}

export function DefinitionRow({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  tone?: "green" | "slate";
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "green" ? "text-emerald-600" : "text-slate-900",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
