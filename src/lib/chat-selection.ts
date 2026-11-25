export function selectedDialogue(
  messages: { role: "user" | "assistant"; content: string }[],
  selected: ReadonlySet<number>,
) {
  return messages
    .filter((_, i) => selected.has(i))
    .map((m) => `${m.role === "user" ? "Вы" : "Помощник"}: ${m.content}`)
    .join("\n\n");
}
