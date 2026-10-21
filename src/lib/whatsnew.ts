// История версий. При каждом изменении для пользователя: поднять APP_VERSION в pwa.ts и добавить запись сверху.
export const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  {
    version: "1.5.0",
    date: "22 октября 2026",
    items: ["Записанную операцию можно изменить: нажмите на неё и поправьте сумму, название, категорию, карту/наличные или дату."],
  },
  {
    version: "1.4.0",
    date: "20 октября 2026",
    items: [
      "На главной две кнопки: «Текст или голос» и «Чек или скриншот».",
      "Скриншоты из банка: переводы между счетами, Кубышка и поступления больше не попадают в траты.",
      "Категория выбирается по смыслу места: Городская ферма — радости, Госуслуги — сад и школа.",
      "Перед сохранением можно снять галочку с лишних трат.",
      "Приложение запоминает названия мест целиком и в следующий раз узнаёт их без ИИ.",
      "Ключ DeepSeek теперь читает скриншоты.",
      "После обновления показывается «Что нового».",
    ],
  },
];
const KEY = "berezhny-seen-version";
export function unseenChanges(current: string) {
  const seen = localStorage.getItem(KEY);
  if (!seen) {
    // brand-new user: nothing to announce; existing user from before this feature: show latest
    if (!localStorage.getItem("berezhny-budget-v1")) { localStorage.setItem(KEY, current); return null; }
    return CHANGELOG.slice(0, 1);
  }
  if (seen === current) return null;
  const idx = CHANGELOG.findIndex((c) => c.version === seen);
  const list = idx === -1 ? CHANGELOG.slice(0, 1) : CHANGELOG.slice(0, idx);
  return list.length ? list : null;
}
export const markSeen = (v: string) => localStorage.setItem(KEY, v);
