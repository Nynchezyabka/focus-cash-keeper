import { Link } from "@tanstack/react-router";
import { Users, Sun, CalendarClock, Wallet, PieChart, Settings, MessageCircleHeart, icons } from "lucide-react";
import type { ReactNode } from "react";
import { useBudget, type State } from "@/lib/budget";
import { useFamily } from "@/lib/family";

const NAV = [
  { to: "/", label: "Сегодня", Icon: Sun },
  { to: "/payments", label: "Платежи", Icon: CalendarClock },
  { to: "/incomes", label: "Доходы", Icon: Wallet },
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
  const nav = fam ? [...NAV.slice(0, 4), { to: "/family", label: "Семья", Icon: Users } as const, ...NAV.slice(4)] : NAV;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <div className="flex items-start justify-between gap-3 px-5 pt-6">
        {title ? <h1 className="pt-2 font-display text-2xl text-foreground">{title}</h1> : <span />}
        <Link to="/settings" aria-label="Настройки" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground" activeProps={{ className: "bg-secondary text-primary" }}>
          <Settings className="h-5 w-5" />
        </Link>
      </div>
      <main className="flex-1 px-5 pb-28 pt-4">{s ? children(s) : <div className="py-20 text-center text-muted-foreground">…</div>}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
        <div className={`mx-auto grid max-w-md ${fam ? "grid-cols-6" : "grid-cols-5"}`}>
          {nav.map(({ to, label, Icon }) => (
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
