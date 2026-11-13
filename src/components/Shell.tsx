import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Users, Sun, CalendarDays, PieChart, Settings, MessageCircleHeart, HelpCircle, icons } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { openerDue, trackOpen } from "@/lib/advisor-memory";
import { rub, useBudget, type State } from "@/lib/budget";
import { APP_VERSION } from "@/lib/pwa";
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

export function Shell({ title, wide, children }: { title?: string; wide?: boolean; children: (s: State) => ReactNode }) {
  const s = useBudget();
  const fam = useFamily();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const [dot, setDot] = useState(false);
  useEffect(() => { trackOpen(); }, []);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const upd = () => setOnline(navigator.onLine);
    upd();
    window.addEventListener("online", upd); window.addEventListener("offline", upd);
    return () => { window.removeEventListener("online", upd); window.removeEventListener("offline", upd); };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
      const k = e.key.toLowerCase();
      if (k !== "n" && k !== "т") return;
      e.preventDefault();
      if (window.location.pathname === "/") window.dispatchEvent(new Event("quick-expense"));
      else { sessionStorage.setItem("quick-expense", "1"); void navigate({ to: "/" }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
  useEffect(() => { setDot(!!s && path !== "/advisor" && !!openerDue(s)); }, [s, path]);
  const nav = fam ? [...NAV.slice(0, 3), { to: "/family", label: "Семья", Icon: Users } as const, ...NAV.slice(3)] : NAV;
  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 border-r border-border bg-card/60 px-3 py-6 lg:flex">
        <Link to="/" className="mb-6 px-3 font-display text-xl text-foreground">Бережный бюджет</Link>
        {nav.map(({ to, label, Icon }) => {
          const active = to === "/calendar" ? PLAN_PATHS.includes(path) : path === to;
          return (
            <Link key={to} to={to} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${active ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-secondary/60"}`}>
              <span className="relative"><Icon className="h-5 w-5" />{to === "/advisor" && dot && <span aria-label="Есть сообщение" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-primary" />}</span>
              {label}
            </Link>
          );
        })}
        <div className="mt-auto space-y-1">
          {s && <div className="mb-3 space-y-1 rounded-2xl bg-secondary/60 px-3 py-3 text-xs text-muted-foreground">
            <p className="flex justify-between gap-2"><span>Карта</span><span className="text-foreground">{rub(s.balance)}</span></p>
            <p className="flex justify-between gap-2"><span>Наличные</span><span className="text-foreground">{rub(s.cash ?? 0)}</span></p>
            {s.demo && <p className="text-primary">Вы смотрите пример</p>}
            {!online && <p>Нет сети — всё работает на устройстве</p>}
            <p>Версия {APP_VERSION} · клавиша N — трата</p>
          </div>}
          <Link to="/help" className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary/60" activeProps={{ className: "bg-secondary text-primary" }}><HelpCircle className="h-5 w-5" />Справка</Link>
          <Link to="/settings" className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary/60" activeProps={{ className: "bg-secondary text-primary" }}><Settings className="h-5 w-5" />Настройки</Link>
        </div>
      </aside>
    <div className={`mx-auto flex min-h-screen w-full max-w-md flex-col lg:px-6 ${wide ? "lg:max-w-5xl" : "lg:max-w-2xl"}`}>
      <div className="relative flex min-h-11 items-center justify-between gap-3 px-[max(1.25rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {title ? (
          <div className="flex min-w-0 items-center gap-1">
            {!NAV.some((n) => n.to === path) && !PLAN_PATHS.includes(path) && path !== "/family" && (
              <button type="button" aria-label="Назад" onClick={() => (window.history.length > 1 ? window.history.back() : void navigate({ to: "/" }))} className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            {path !== "/help" && <Link to="/help" aria-label="Справка" className="lg:hidden grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground" activeProps={{ className: "bg-secondary text-primary lg:hidden" }}>
              <HelpCircle className="h-5 w-5" />
            </Link>}
          </div>
        ) : <div className="flex items-center gap-1"><Link to="/help" aria-label="Справка" className="lg:hidden grid -ml-2 h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground" activeProps={{ className: "bg-secondary text-primary lg:hidden" }}>
              <HelpCircle className="h-5 w-5" />
            </Link></div>}
        {title && <h1 className="pointer-events-none absolute inset-x-0 truncate px-24 text-center font-display text-xl sm:text-2xl text-foreground">{title}</h1>}
        {!title && <span className="pointer-events-none absolute inset-x-0 text-center font-display text-lg text-foreground lg:hidden">Бережный бюджет</span>}
        <div className="flex shrink-0 lg:hidden">
          <Link to="/settings" aria-label="Настройки" className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground" activeProps={{ className: "bg-secondary text-primary" }}>
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>
      <main className="flex-1 px-[max(1.25rem,env(safe-area-inset-left))] pb-[calc(7rem+env(safe-area-inset-bottom))] pt-2 lg:pb-12">
        {s ? children(s) : <div className="py-20 text-center text-muted-foreground">…</div>}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 lg:hidden border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className={`mx-auto grid max-w-md px-[env(safe-area-inset-left)] ${fam ? "grid-cols-5" : "grid-cols-4"}`}>
          {nav.map(({ to, label, Icon }) => {
            const active = to === "/calendar" ? PLAN_PATHS.includes(path) : path === to;
            return (
              <Link key={to} to={to} className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2.5 text-[11px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                <span className="relative"><Icon className="h-5 w-5" />{to === "/advisor" && dot && <span aria-label="Есть сообщение" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-primary" />}</span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
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
