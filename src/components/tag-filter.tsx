import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"

export function TagFilter({
  tags,
  value,
  onChange,
  label,
}: {
  tags: string[]
  value: string
  onChange: (tag: string) => void
  label: string
}) {
  const items = ["", ...new Set([...tags, ...(value ? [value] : [])])]
  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={(tag) => onChange(tag ?? "")}
      itemToStringLabel={(tag) => tag || "All tags"}
    >
      <ComboboxTrigger
        render={
          <Button
            variant="outline"
            className="max-w-full min-w-36 justify-between"
          />
        }
        aria-label={label}
      >
        <span className="truncate">{value || "All tags"}</span>
      </ComboboxTrigger>
      <ComboboxContent className="min-w-56">
        <ComboboxInput
          aria-label="Search tags"
          placeholder="Search tags…"
          showTrigger={false}
        />
        <ComboboxEmpty>No matching tags</ComboboxEmpty>
        <ComboboxList>
          {(tag: string) => (
            <ComboboxItem key={tag} value={tag} className="break-all">
              {tag || "All tags"}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
