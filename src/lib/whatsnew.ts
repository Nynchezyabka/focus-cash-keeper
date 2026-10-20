// История версий. При каждом изменении для пользователя: поднять APP_VERSION в pwa.ts и добавить запись сверху.
export const CHANGELOG: { version: string; date: string; items: string[] }[] = [
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
  if (!seen) { localStorage.setItem(KEY, current); return null; } // first launch: nothing to announce
  if (seen === current) return null;
  const idx = CHANGELOG.findIndex((c) => c.version === seen);
  const list = idx === -1 ? CHANGELOG.slice(0, 1) : CHANGELOG.slice(0, idx);
  return list.length ? list : null;
}
export const markSeen = (v: string) => localStorage.setItem(KEY, v);
