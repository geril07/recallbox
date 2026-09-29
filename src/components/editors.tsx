import { useRef, useState } from "react"
import {
  ArrowLeftRight,
  Bold,
  Check,
  Code,
  Eye,
  ImagePlus,
  Italic,
  Link2,
  List,
  Pencil,
  Plus,
} from "lucide-react"
import {
  colors,
  emptySchedule,
  normalizeTags,
  type Asset,
  type Deck,
  type Flashcard,
} from "@/lib/model"
import { saveCard, saveDeck } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DeckIcon, IconButton, Confirm } from "@/components/shared"
import { deckIcons } from "@/components/deck-icons"
import { Markdown } from "@/components/markdown"
import { TagInput } from "@/components/tag-input"
import { notify, reportError } from "@/components/ui/toast"

export function DeckEditor({
  deck,
  onClose,
}: {
  deck?: Deck
  onClose: () => void
}) {
  const [name, setName] = useState(deck?.name || "")
  const [description, setDescription] = useState(deck?.description || "")
  const [color, setColor] = useState<Deck["color"]>(deck?.color || "sage")
  const [icon, setIcon] = useState<Deck["icon"]>(deck?.icon || "book")
  const [tags, setTags] = useState(() => normalizeTags(deck?.tags ?? []))
  const [tagQuery, setTagQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const [discard, setDiscard] = useState(false)
  const dirty =
    name !== (deck?.name || "") ||
    description !== (deck?.description || "") ||
    JSON.stringify(tags) !== JSON.stringify(normalizeTags(deck?.tags ?? [])) ||
    !!tagQuery.trim() ||
    color !== (deck?.color || "sage") ||
    icon !== (deck?.icon || "book")
  function close() {
    if (dirty) setDiscard(true)
    else onClose()
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || tagQuery.trim()) return
    setBusy(true)
    try {
      await saveDeck({
        id: deck?.id || crypto.randomUUID(),
        name,
        description,
        color,
        icon,
        tags,
        createdAt: deck?.createdAt || Date.now(),
      })
      notify(deck ? "Deck updated" : "Your new deck is ready")
      onClose()
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !busy) close()
        }}
      >
        <DialogContent className="editor-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deck ? "Edit deck" : "A new place to learn"}
            </DialogTitle>
            <DialogDescription>
              {deck ? "Make it your own." : "Give your next collection a home."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="flex items-center gap-4">
              <DeckIcon deck={{ color, icon }} />
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch color-${c}`}
                    aria-label={`${c} color`}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                  >
                    {color === c && <Check className="size-3.5" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1">
              {Object.entries(deckIcons).map(([key, Icon]) => (
                <IconButton
                  key={key}
                  label={key}
                  variant={icon === key ? "secondary" : "ghost"}
                  onClick={() => setIcon(key as Deck["icon"])}
                >
                  <Icon />
                </IconButton>
              ))}
            </div>
            <div className="field">
              <Label htmlFor="deck-name">Deck name</Label>
              <Input
                id="deck-name"
                autoFocus
                required
                maxLength={80}
                placeholder="What would you like to remember?"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <Label htmlFor="deck-description">
                Description <span className="optional">optional</span>
              </Label>
              <Textarea
                id="deck-description"
                maxLength={240}
                rows={2}
                placeholder="A little context for your collection"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="field">
              <Label htmlFor="deck-tags">
                Tags <span className="optional">optional</span>
              </Label>
              <TagInput
                id="deck-tags"
                value={tags}
                onChange={setTags}
                query={tagQuery}
                onQueryChange={setTagQuery}
                disabled={busy}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={close}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || !!tagQuery.trim()}
                loading={busy}
              >
                <Plus />
                {deck ? "Save changes" : "Create deck"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {discard && (
        <Confirm
          title="Discard changes?"
          description="Your unsaved deck changes will be lost."
          label="Discard"
          onConfirm={onClose}
          onClose={() => setDiscard(false)}
        />
      )}
    </>
  )
}

export function CardEditor({
  card,
  deckId,
  decks,
  onClose,
}: {
  card?: Flashcard
  deckId?: string
  decks: Deck[]
  onClose: () => void
}) {
  const [selectedDeck, setSelectedDeck] = useState(
    card?.deckId || deckId || decks[0]?.id || "",
  )
  const [prompt, setPrompt] = useState(card?.prompt || "")
  const [answer, setAnswer] = useState(card?.answer || "")
  const [reverse, setReverse] = useState(card?.reverse || false)
  const [reversePrompt, setReversePrompt] = useState(card?.reversePrompt || "")
  const [tags, setTags] = useState(() => normalizeTags(card?.tags ?? []))
  const [tagQuery, setTagQuery] = useState("")
  const [assets, setAssets] = useState<Asset[]>([])
  const [busy, setBusy] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [tab, setTab] = useState<string>("write")
  const text = useRef<HTMLTextAreaElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const dirty =
    prompt !== (card?.prompt || "") ||
    answer !== (card?.answer || "") ||
    reverse !== (card?.reverse || false) ||
    reversePrompt !== (card?.reversePrompt || "") ||
    JSON.stringify(tags) !== JSON.stringify(normalizeTags(card?.tags ?? [])) ||
    !!tagQuery.trim() ||
    selectedDeck !== (card?.deckId || deckId || decks[0]?.id || "")
  function close() {
    if (dirty) setDiscard(true)
    else onClose()
  }
  function insert(before: string, after = "", placeholder = "") {
    const start = text.current?.selectionStart ?? answer.length
    const end = text.current?.selectionEnd ?? answer.length
    const selection = answer.slice(start, end) || placeholder
    setAnswer(
      answer.slice(0, start) + before + selection + after + answer.slice(end),
    )
    setTab("write")
    requestAnimationFrame(() => {
      text.current?.focus()
      text.current?.setSelectionRange(
        start + before.length,
        start + before.length + selection.length,
      )
    })
  }
  function addImage(file: File) {
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      )
    )
      return reportError(new Error("Use a PNG, JPEG, WebP, or GIF image."))
    if (file.size > 10 * 1024 * 1024)
      return reportError(new Error("Choose an image smaller than 10 MB."))
    const asset: Asset = {
      id: crypto.randomUUID(),
      name: file.name,
      blob: file,
    }
    setAssets((old) => [...old, asset])
    insert(`\n![${file.name.replace(/[[\]\\]/g, "")}](asset:${asset.id})\n`)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || tagQuery.trim()) return
    setBusy(true)
    try {
      const now = Date.now()
      await saveCard(
        {
          id: card?.id || crypto.randomUUID(),
          deckId: selectedDeck,
          prompt,
          answer,
          tags,
          reverse,
          reversePrompt,
          forward: card?.forward || emptySchedule(now),
          backward: card?.backward || emptySchedule(now),
          createdAt: card?.createdAt || now,
          updatedAt: now,
        },
        assets,
      )
      notify(card ? "Card updated" : "Card added to your deck")
      onClose()
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !busy) close()
        }}
      >
        <DialogContent className="editor-dialog sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {card ? "Edit card" : "One more thing to remember"}
            </DialogTitle>
            <DialogDescription>
              Keep the prompt simple. Make the answer yours.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="field">
              <Label id="card-deck-label">Deck</Label>
              <Select
                value={selectedDeck}
                onValueChange={(v) => v && setSelectedDeck(v)}
                items={decks.map((d) => ({ value: d.id, label: d.name }))}
              >
                <SelectTrigger
                  aria-labelledby="card-deck-label"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {decks.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="field">
              <Label htmlFor="card-prompt">Prompt</Label>
              <Textarea
                id="card-prompt"
                autoFocus
                required
                maxLength={200000}
                rows={2}
                placeholder="A question, a word, a spark of curiosity…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <div className="flex items-center justify-between">
                <Label htmlFor="card-answer">Answer</Label>
                <TabsList>
                  <TabsTrigger value="write">
                    <Pencil />
                    Write
                  </TabsTrigger>
                  <TabsTrigger value="preview">
                    <Eye />
                    Preview
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="write">
                <div className="markdown-editor">
                  <div className="editor-toolbar">
                    <IconButton
                      label="Bold"
                      onClick={() => insert("**", "**", "bold text")}
                    >
                      <Bold />
                    </IconButton>
                    <IconButton
                      label="Italic"
                      onClick={() => insert("*", "*", "italic text")}
                    >
                      <Italic />
                    </IconButton>
                    <IconButton
                      label="List"
                      onClick={() => insert("\n- ", "", "item")}
                    >
                      <List />
                    </IconButton>
                    <IconButton
                      label="Code block"
                      onClick={() => insert("\n```\n", "\n```\n", "code")}
                    >
                      <Code />
                    </IconButton>
                    <span className="mx-1 h-4 border-r" />
                    <IconButton
                      label="Insert link"
                      onClick={() =>
                        insert("[", "](https://example.com)", "link text")
                      }
                    >
                      <Link2 />
                    </IconButton>
                    <IconButton
                      label="Add image"
                      onClick={() => imageInput.current?.click()}
                    >
                      <ImagePlus />
                    </IconButton>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      Markdown
                    </span>
                  </div>
                  <Textarea
                    ref={text}
                    id="card-answer"
                    maxLength={200000}
                    rows={6}
                    placeholder="The answer, with all the detail you need."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onPaste={(e) => {
                      const image = Array.from(e.clipboardData.files).find(
                        (f) => f.type.startsWith("image/"),
                      )
                      if (image) {
                        e.preventDefault()
                        addImage(image)
                      }
                    }}
                  />
                </div>
              </TabsContent>
              <TabsContent value="preview">
                <div className="min-h-48 rounded-lg border p-4">
                  <Markdown assets={assets}>
                    {answer || "*Nothing to preview yet.*"}
                  </Markdown>
                </div>
              </TabsContent>
            </Tabs>
            <p className="field-hint">
              Paste or upload images for offline use. Linked images need a
              connection.
            </p>
            <input
              ref={imageInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              aria-label="Upload card image"
              onChange={(e) => {
                if (e.target.files?.[0]) addImage(e.target.files[0])
                e.target.value = ""
              }}
            />
            <div className="reverse-panel">
              <div className="flex items-center gap-3">
                <ArrowLeftRight className="size-4 text-primary" />
                <div className="flex-1">
                  <Label htmlFor="reverse">Practice both ways</Label>
                  <p className="field-hint mt-1">
                    Answer → prompt, with its own review schedule.
                  </p>
                </div>
                <Switch
                  id="reverse"
                  checked={reverse}
                  onCheckedChange={setReverse}
                />
              </div>
              {reverse && (
                <div className="field mt-4">
                  <Label htmlFor="reverse-prompt">
                    Reverse prompt <span className="optional">optional</span>
                  </Label>
                  <Input
                    id="reverse-prompt"
                    placeholder="A shorter version of the answer"
                    maxLength={200000}
                    value={reversePrompt}
                    onChange={(e) => setReversePrompt(e.target.value)}
                  />
                  <p className="field-hint">
                    Leave empty to use the full answer.
                  </p>
                </div>
              )}
            </div>
            <div className="field">
              <Label htmlFor="card-tags">
                Tags <span className="optional">optional</span>
              </Label>
              <TagInput
                id="card-tags"
                value={tags}
                onChange={setTags}
                query={tagQuery}
                onQueryChange={setTagQuery}
                disabled={busy}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={busy}
                disabled={
                  !prompt.trim() ||
                  !answer.trim() ||
                  !selectedDeck ||
                  !!tagQuery.trim()
                }
              >
                <Check />
                {card ? "Save changes" : "Add card"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {discard && (
        <Confirm
          title="Discard this draft?"
          description="The card and any new images have not been saved."
          label="Discard"
          onConfirm={onClose}
          onClose={() => setDiscard(false)}
        />
      )}
    </>
  )
}
