import { Link, useRouterState } from "@tanstack/react-router";
import { Users, Sun, CalendarDays, PieChart, Settings, MessageCircleHeart, HelpCircle, icons } from "lucide-react";
import type { ReactNode } from "react";
import { useBudget, type State } from "@/lib/budget";
import { useFamily } from "@/lib/family";

const PLAN_PATHS = ["/calendar", "/payments", "/incomes"];

const NAV = [
  { to: "/", label: "Сегодня", Icon: Sun },
  { to: "/calendar", label: "План", Icon: CalendarDays },
  { to: "/analytics", label: "Аналитика", Icon: PieChart },
  { to: "/advisor", label: "Помощник", Icon: MessageCircleHeart },
] as const;

export function CatIcon({ name, className }: { name: string; className?: string }) {
  const I = icons[name as keyof typeof icons] ?? icons.Circle;
  return <I className={className} />;
}

export function Shell({ title, children }: { title?: string; children: (s: State) => ReactNode }) {
  const s = useBudget();
  const fam = useFamily();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const nav = fam ? [...NAV.slice(0, 3), { to: "/family", label: "Семья", Icon: Users } as const, ...NAV.slice(3)] : NAV;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <div className="flex items-center justify-between gap-3 px-[max(1.25rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {title ? <h1 className="font-display text-2xl text-foreground">{title}</h1> : <span className="font-display text-lg text-foreground">Бережный бюджет</span>}
        <div className="flex shrink-0">
          <Link to="/help" aria-label="Как пользоваться" className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground" activeProps={{ className: "bg-secondary text-primary" }}>
            <HelpCircle className="h-5 w-5" />
          </Link>
          <Link to="/settings" aria-label="Настройки" className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground" activeProps={{ className: "bg-secondary text-primary" }}>
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>
      <main className="flex-1 px-[max(1.25rem,env(safe-area-inset-left))] pb-[calc(7rem+env(safe-area-inset-bottom))] pt-2">
        {s ? children(s) : <div className="py-20 text-center text-muted-foreground">…</div>}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className={`mx-auto grid max-w-md px-[env(safe-area-inset-left)] ${fam ? "grid-cols-5" : "grid-cols-4"}`}>
          {nav.map(({ to, label, Icon }) => {
            const active = to === "/calendar" ? PLAN_PATHS.includes(path) : path === to;
            return (
              <Link key={to} to={to} className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2.5 text-[11px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
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
