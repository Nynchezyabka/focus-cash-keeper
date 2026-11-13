import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PALETTE, customColor } from "@/lib/colors";

export function ColorPicker({ value, onChange, automatic = "По группе" }: {
  value?: string | undefined; onChange: (value: string | undefined) => void; automatic?: string;
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
    <Button type="button" variant="ghost" size="sm" aria-pressed={!value} onClick={() => onChange(undefined)}>
      <RotateCcw className="h-3 w-3" />{automatic}{!value && <Check className="h-3 w-3" />}
    </Button>
  </fieldset>;
}