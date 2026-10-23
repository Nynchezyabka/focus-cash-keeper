import { Link } from "@tanstack/react-router";
import { Sun, CalendarClock, Wallet, PieChart, Settings, MessageCircleHeart, icons } from "lucide-react";
import type { ReactNode } from "react";
import { useBudget, type State } from "@/lib/budget";

const NAV = [
  { to: "/", label: "Сегодня", Icon: Sun },
  { to: "/payments", label: "Платежи", Icon: CalendarClock },
  { to: "/incomes", label: "Доходы", Icon: Wallet },
  { to: "/analytics", label: "Аналитика", Icon: PieChart },
  { to: "/advisor", label: "Помощник", Icon: MessageCircleHeart },
  { to: "/settings", label: "Настройки", Icon: Settings },
] as const;

export function CatIcon({ name, className }: { name: string; className?: string }) {
  const I = icons[name as keyof typeof icons] ?? icons.Circle;
  return <I className={className} />;
}

export function Shell({ title, children }: { title?: string; children: (s: State) => ReactNode }) {
  const s = useBudget();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      {title && <h1 className="px-5 pt-8 font-display text-2xl text-foreground">{title}</h1>}
      <main className="flex-1 px-5 pb-28 pt-4">{s ? children(s) : <div className="py-20 text-center text-muted-foreground">…</div>}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-6">
          {NAV.map(({ to, label, Icon }) => (
            <Link key={to} to={to} className="flex flex-col items-center gap-1 py-3 text-[10px] text-muted-foreground" activeProps={{ className: "text-primary" }} activeOptions={{ exact: true }}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function meta(title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
