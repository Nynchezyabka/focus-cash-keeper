import { createFileRoute } from "@tanstack/react-router";
import { Shell, meta } from "@/components/Shell";
import { GUIDE } from "@/lib/guide";

export const Route = createFileRoute("/help")({
  head: () => meta("Как пользоваться — Бережный бюджет", "Коротко о том, как устроен Бережный бюджет и с чего начать."),
  component: () => (
    <Shell title="Как пользоваться">
      {() => (
        <div className="space-y-4">
          {GUIDE.map((g) => (
            <section key={g.title} className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
              <h2 className="font-display text-lg text-foreground">{g.title}</h2>
              {g.text.map((t) => (
                <p key={t} className="text-sm text-muted-foreground">{t}</p>
              ))}
            </section>
          ))}
        </div>
      )}
    </Shell>
  ),
});
