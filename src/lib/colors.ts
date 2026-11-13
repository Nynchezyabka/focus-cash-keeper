/** Persist palette IDs, not theme-dependent CSS values. */
export const PALETTE = [
  { id: "sage", name: "Шалфей" }, { id: "mint", name: "Мята" },
  { id: "teal", name: "Бирюза" }, { id: "sky", name: "Небесный" },
  { id: "denim", name: "Джинсовый" }, { id: "lavender", name: "Лаванда" },
  { id: "rose", name: "Розовый" }, { id: "peach", name: "Персиковый" },
  { id: "honey", name: "Медовый" }, { id: "olive", name: "Оливковый" },
  { id: "clay", name: "Глиняный" }, { id: "stone", name: "Серый" },
] as const;

export function customColor(value?: string): string | undefined {
  if (PALETTE.some((c) => c.id === value)) return `var(--palette-${value})`;
  // Old exports may already contain a literal color.
  if (value && /^#[a-f0-9]{6}$/i.test(value)) return value;
  return undefined;
}
export const goalColor = (g: { color?: string | undefined }) => customColor(g.color) ?? "var(--primary)";
export const sharedColor = (value?: string) => customColor(value) ?? (value && /^var\(--group-(must|safe|life)-[0-5]\)$/.test(value) ? value : "var(--primary)");