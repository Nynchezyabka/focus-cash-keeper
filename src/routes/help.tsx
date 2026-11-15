import { Link, createFileRoute } from "@tanstack/react-router";
import { Sun, CalendarDays, PieChart, MessageCircleHeart, Users, HelpCircle, Settings, Scale, ListPlus, ChevronDown, type LucideIcon } from "lucide-react";
import { Shell, meta } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { GUIDE } from "@/lib/guide";

const ICONS: [string, LucideIcon][] = [
  ["«Сегодня»", Sun], ["«План»", CalendarDays], ["«Аналитика»", PieChart],
  ["«Помощник»", MessageCircleHeart], ["«Семья»", Users], ["«?»", HelpCircle], ["«Настройки»", Settings],
];
const iconFor = (t: string) => ICONS.find(([k]) => t.startsWith(k))?.[1];

export const Route = createFileRoute("/help")({
  head: () => meta("Справка — Бережный бюджет", "Коротко о том, как устроен Бережный бюджет и с чего начать."),
  component: () => <Shell title="Справка">{() => <Help />}</Shell>,
});

function Way({ icon: I, kicker, title, points, to, cta }: { icon: LucideIcon; kicker: string; title: string; points: string[]; to: "/" | "/calendar"; cta: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-soft">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary"><I className="h-4 w-4" /></span>
      <p className="text-xs text-muted-foreground">{kicker}</p>
      <h3 className="font-display text-lg text-foreground">{title}</h3>
      <ul className="flex-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">{points.map((p) => <li key={p}>{p}</li>)}</ul>
      <Button asChild variant="secondary" className="mt-1"><Link to={to}>{cta}</Link></Button>
    </div>
  );
}

function Help() {
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl bg-card p-5 shadow-soft">
        <h2 className="font-display text-2xl text-foreground">Сколько можно потратить сегодня</h2>
        <p className="text-sm text-muted-foreground">Укажите, сколько денег на карте и наличными, и дату дохода. Приложение вычтет платежи и накопления, а свободные деньги разделит по дням.</p>
        <Button asChild><Link to="/">Открыть бюджет</Link></Button>
      </section>

      <section className="space-y-1 rounded-2xl border-2 border-primary/40 bg-card p-4 shadow-soft">
        <p className="text-xs font-medium text-primary">Первый шаг</p>
        <h2 className="font-display text-lg text-foreground">Начните с баланса карты</h2>
        <p className="text-sm text-muted-foreground">Нажмите «Карта» на главном экране и введите, сколько там сейчас. В «Плане» укажите дату следующего дохода и обязательные платежи.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg text-foreground">Как вести бюджет</h2>
        <p className="text-sm text-muted-foreground">Выберите удобный способ. Это не тарифы: оба доступны всегда, их можно смешивать.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Way icon={Scale} kicker="Сверять остаток" title="По балансу" points={["Иногда обновляйте карту и наличные по факту", "Сумма на день пересчитается сама", "Каждую мелочь записывать не нужно"]} to="/" cta="Указать баланс" />
          <Way icon={ListPlus} kicker="Записывать операции" title="По тратам" points={["Добавляйте траты текстом, голосом или с чека", "Подтверждайте пришедшие доходы", "Итоги смотрите в «Аналитике»"]} to="/calendar" cta="Открыть план" />
        </div>
      </section>

      <section className="space-y-1 rounded-2xl bg-secondary p-4 text-secondary-foreground">
        <h2 className="font-medium">Не учитывайте одну сумму дважды</h2>
        <p className="text-sm">Свободно на день + отложено на платежи + накопления = все ваши деньги на карте и наличными. Бюджет хранится только на вашем устройстве.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg text-foreground">Подробнее</h2>
        {GUIDE.map((g) => (
          <details key={g.title} className="group rounded-2xl bg-card shadow-soft">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-medium text-foreground [&::-webkit-details-marker]:hidden">
              {g.title}<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 px-4 pb-4">
              {g.text.map((t) => {
                const I = iconFor(t);
                return I ? (
                  <p key={t} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-primary"><I className="h-4 w-4" /></span>
                    <span className="pt-1.5">{t}</span>
                  </p>
                ) : <p key={t} className="text-sm text-muted-foreground">{t}</p>;
              })}
            </div>
          </details>
        ))}
      </section>

      <blockquote className="rounded-2xl bg-card p-5 shadow-soft">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Главный принцип</p>
        <p className="mt-2 font-display text-lg text-foreground">«Спокойный бюджет без таблиц и чувства вины: одна цифра на день, сверка баланса в один клик.»</p>
      </blockquote>
    </div>
  );
}
