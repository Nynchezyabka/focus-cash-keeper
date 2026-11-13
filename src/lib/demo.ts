import { dayKey, getState, replaceState, setState, type State, type Tx } from "./budget";

/** Пример бюджета: показать, как выглядит заполненное приложение. Помечен флагом demo. */
export function demoState(now = new Date()): State {
  const d = (shift: number) => { const x = new Date(now); x.setDate(x.getDate() + shift); return x; };
  const day = (shift: number) => d(shift).getDate();
  const iso = (shift: number, h = 12) => { const x = d(shift); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  const tx = (id: string, amount: number, category: string, note: string, shift: number, method: "card" | "cash" = "card"): Tx =>
    ({ id, kind: "expense", amount, category, note, date: iso(shift), method });
  return {
    version: 1, balance: 42500, cash: 3000, cushion: 15000,
    txs: [
      { id: "demo-g1", kind: "goal", amount: 15000, category: "savings", note: "Поездка на море", date: iso(-20), goal: "demo-goal" },
      tx("demo-t1", 1840, "food", "Продукты", -3),
      tx("demo-t2", 380, "cafe", "Кофе с подругой", -2),
      tx("demo-t3", 620, "health", "Аптека", -1),
      tx("demo-t4", 450, "taxi", "Такси", -1, "cash"),
      tx("demo-t5", 290, "cafe", "Круассан", 0),
    ],
    obligations: [
      { id: "demo-o1", name: "ЖКУ", amount: 6200, day: day(4), category: "home" },
      { id: "demo-o2", name: "Интернет и связь", amount: 900, day: day(6), category: "phone" },
      { id: "demo-o3", name: "Рассрочка за коляску", amount: 3500, day: day(15), category: "loan" },
    ],
    incomes: [
      { id: "demo-i1", name: "Аванс", amount: 35000, day: day(8) },
      { id: "demo-i2", name: "Зарплата", amount: 45000, day: day(23) },
    ],
    incomeAck: {},
    goals: [{ id: "demo-goal", name: "Поездка на море", target: 50000, date: dayKey(d(180)) }],
    ai: { provider: "none", apiKey: "", model: "" },
    createdAt: iso(-3), lastBackup: iso(0), demo: true,
  };
}

export const isDemo = (s: State) => !!s.demo;
export function startDemo() { replaceState(demoState()); }
/** стереть пример и начать с чистого листа (оформление и ключ ИИ не трогаем) */
export function clearDemo() {
  const { ai, advisorTone, advisorName } = getState();
  replaceState({ version: 1, balance: 0, cushion: 0, txs: [], obligations: [], incomes: [], incomeAck: {}, ai, advisorTone, advisorName, createdAt: new Date().toISOString() } as State);
  setState((s) => ({ ...s, demo: undefined }));
}
