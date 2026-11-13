import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PALETTE, customColor } from "@/lib/colors";

export function ColorPicker({ value, onChange, automatic = "Цвет основной категории", showAutomatic = true }: {
  value?: string | undefined; onChange: (value: string | undefined) => void; automatic?: string; showAutomatic?: boolean;
}) {
  return <fieldset className="space-y-2">
    <legend className="mb-2 text-sm">Цвет</legend>
    <div className="grid grid-cols-6 gap-2">
      {PALETTE.map((c) => <Button key={c.id} type="button" variant="outline" size="icon"
        aria-label={c.name} title={c.name} aria-pressed={value === c.id}
        className="h-9 w-full rounded-full text-palette-ink"
        style={{ background: customColor(c.id) }} onClick={() => onChange(c.id)}>
        {value === c.id && <Check className="h-4 w-4" />}
      </Button>)}
    </div>
    {showAutomatic && <label className="flex items-center justify-between gap-3 text-sm">
      <span>{automatic}</span>
      <Switch aria-label={automatic} checked={!value} onCheckedChange={(checked) => onChange(checked ? undefined : PALETTE[0].id)} />
    </label>}
  </fieldset>;
}