import { useApp } from "@/lib/app-context"
import { normalizeTags, tagsFor } from "@/lib/model"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"

export function TagInput({
  id,
  value,
  onChange,
  query,
  onQueryChange,
  disabled = false,
}: {
  id: string
  value: string[]
  onChange: (tags: string[]) => void
  query: string
  onQueryChange: (query: string) => void
  disabled?: boolean
}) {
  const { decks, cards } = useApp()
  const anchor = useComboboxAnchor()
  const suggestions = normalizeTags([
    ...tagsFor([...decks, ...cards]),
    ...value,
  ]).toSorted()
  const candidate = query.trim().toLowerCase()
  const canCreate =
    candidate.length > 0 &&
    candidate.length <= 50 &&
    !suggestions.includes(candidate)
  const items = canCreate ? [...suggestions, candidate] : suggestions
  const limitReached = value.length >= 30
  const hint =
    candidate.length > 50
      ? "Use 50 characters or fewer per tag."
      : limitReached
        ? "You can add up to 30 tags. Remove a tag to add another."
        : query.trim()
          ? "Select or create a tag, or clear the search before saving."
          : "Search tags across your library, or type a new tag to create it."

  return (
    <>
      <Combobox
        multiple
        items={items}
        value={value}
        inputValue={query}
        onInputValueChange={(next, details) => {
          // Closing suggestions must not discard an unfinished tag draft.
          if (details.reason === "input-clear") {
            details.cancel()
            return
          }
          onQueryChange(next)
        }}
        onValueChange={(next, details) => {
          onChange(normalizeTags(next))
          if (details.reason === "item-press") onQueryChange("")
        }}
        filter={(item, search) => item.includes(search.trim().toLowerCase())}
        disabled={disabled}
        modal={false}
        autoHighlight
      >
        <ComboboxChips ref={anchor} className="w-full">
          {value.map((tag) => (
            <ComboboxChip
              key={tag}
              removeLabel={`Remove tag ${tag}`}
              className="max-w-full"
            >
              <span className="truncate">{tag}</span>
            </ComboboxChip>
          ))}
          <ComboboxChipsInput
            id={id}
            placeholder="Add a tag…"
            aria-describedby={`${id}-hint`}
            aria-invalid={candidate.length > 50 || undefined}
            onKeyDown={(event) => {
              // Enter selects a suggestion; it must not submit the enclosing editor.
              if (event.key === "Enter" && !event.nativeEvent.isComposing)
                event.preventDefault()
            }}
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>No matching tags</ComboboxEmpty>
          <ComboboxList>
            {(tag: string) => (
              <ComboboxItem
                key={tag}
                value={tag}
                disabled={limitReached && !value.includes(tag)}
                className="break-all"
              >
                {canCreate && tag === candidate ? `Create “${tag}”` : tag}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <p id={`${id}-hint`} className="field-hint" aria-live="polite">
        {hint}
      </p>
    </>
  )
}
