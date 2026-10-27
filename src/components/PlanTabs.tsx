import { Link } from "@tanstack/react-router";

const TABS = [
  { to: "/calendar", label: "График" },
  { to: "/payments", label: "Платежи" },
  { to: "/incomes", label: "Доходы" },
] as const;

/** Переключатель внутри раздела «План»: один раздел вместо трёх отдельных экранов. */
export function PlanTabs() {
  return (
    <div className="mb-5 grid grid-cols-3 gap-1 rounded-full bg-secondary p-1 text-sm">
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className="rounded-full py-2 text-center text-muted-foreground transition-colors"
          activeProps={{ className: "bg-card text-foreground shadow-soft" }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
