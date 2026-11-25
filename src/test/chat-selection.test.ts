import { expect, it } from "vitest";
import { selectedDialogue } from "@/lib/chat-selection";
it("copies selected user and assistant messages in dialogue order, excluding unselected replies", () => {
  expect(
    selectedDialogue(
      [
        { role: "user", content: "Сколько осталось?" },
        { role: "assistant", content: "3500 ₽" },
        { role: "user", content: "Не выбрано" },
      ],
      new Set([1, 0]),
    ),
  ).toBe("Вы: Сколько осталось?\n\nПомощник: 3500 ₽");
});
