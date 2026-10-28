import { createFileRoute } from "@tanstack/react-router";
import { Sun, CalendarDays, PieChart, MessageCircleHeart, Users, HelpCircle, Settings, type LucideIcon } from "lucide-react";
import { Shell, meta } from "@/components/Shell";
import { GUIDE } from "@/lib/guide";

const ICONS: [string, LucideIcon][] = [
  ["«Сегодня»", Sun], ["«План»", CalendarDays], ["«Аналитика»", PieChart],
  ["«Помощник»", MessageCircleHeart], ["«Семья»", Users], ["«?»", HelpCircle], ["«Настройки»", Settings],
];
const iconFor = (t: string) => ICONS.find(([k]) => t.startsWith(k))?.[1];

export const Route = createFileRoute("/help")({
  head: () => meta("Как пользоваться — Бережный бюджет", "Коротко о том, как устроен Бережный бюджет и с чего начать."),
  component: () => (
    <Shell title="Как пользоваться">
      {() => (
        <div className="space-y-4">
          {GUIDE.map((g) => (
            <section key={g.title} className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
              <h2 className="font-display text-lg text-foreground">{g.title}</h2>
              {g.text.map((t) => {
                const I = iconFor(t);
                return I ? (
                  <p key={t} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-primary"><I className="h-4 w-4" /></span>
                    <span className="pt-1.5">{t}</span>
                  </p>
                ) : <p key={t} className="text-sm text-muted-foreground">{t}</p>;
              })}
            </section>
          ))}
        </div>
      )}
    </Shell>
  ),
});
