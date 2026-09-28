import { useState } from "react"
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router"
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Grid2X2,
  Hash,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { useApp } from "@/lib/app-context"
import { deleteCard } from "@/lib/db"
import { queueFor, tagsFor, type Flashcard } from "@/lib/model"
import { TagFilter } from "@/components/tag-filter"
import { DeckTile } from "@/components/deck-tile"
import { Confirm, DeckIcon, EmptyState, IconButton } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Markdown } from "@/components/markdown"
import { notify, reportError } from "@/components/ui/toast"

export function Decks() {
  const { decks, cards, now, editDeck } = useApp()
  const { tag } = useSearch({ from: "/decks" })
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [sort, setSort] = useState("recent")
  const [filter, setFilter] = useState("all")
  const visible = decks
    .filter((d) => {
      const deckCards = cards.filter((c) => c.deckId === d.id)
      return (
        (!tag ||
          d.tags.includes(tag) ||
          deckCards.some((c) => c.tags.includes(tag))) &&
        `${d.name} ${d.description} ${d.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === "all" || queueFor(deckCards, now).length > 0)
      )
    })
    .toSorted((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.createdAt - a.createdAt,
    )
  return (
    <div>
      <div className="page-heading">
        <h1>My decks</h1>
        <Button onClick={() => editDeck()}>
          <Plus />
          New deck
        </Button>
      </div>
      <div className="library-toolbar">
        <div className="search-field">
          <Search />
          <Input
            placeholder="Find a deck…"
            aria-label="Search decks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <TagFilter
          label="Filter decks by tag"
          tags={tagsFor([...decks, ...cards])}
          value={tag}
          onChange={(value) => {
            void navigate({
              to: "/decks",
              search: { tag: value || undefined },
            }).catch(reportError)
          }}
        />
        <Select
          value={sort}
          onValueChange={(v) => v && setSort(v)}
          items={[
            { value: "recent", label: "Recently created" },
            { value: "name", label: "Name A–Z" },
          ]}
        >
          <SelectTrigger aria-label="Sort decks">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently created</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
        <div className="view-toggle">
          <IconButton
            label="Grid view"
            variant={view === "grid" ? "secondary" : "ghost"}
            onClick={() => setView("grid")}
          >
            <Grid2X2 />
          </IconButton>
          <IconButton
            label="List view"
            variant={view === "list" ? "secondary" : "ghost"}
            onClick={() => setView("list")}
          >
            <List />
          </IconButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="deck-filter-tabs">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All decks
            <span className="ml-1 text-muted-foreground">{decks.length}</span>
          </Button>
          <Button
            variant={filter === "due" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("due")}
          >
            Due for review
          </Button>
        </div>
      </div>
      {visible.length ? (
        <div
          className={view === "grid" ? "deck-grid library-grid" : "deck-list"}
        >
          {visible.map((d) => (
            <DeckTile key={d.id} deck={d} list={view === "list"} />
          ))}
          {view === "grid" && (
            <button className="new-deck-tile" onClick={() => editDeck()}>
              <span>
                <Plus />
              </span>
              <strong>Create a deck</strong>
            </button>
          )}
        </div>
      ) : (
        <EmptyState
          title={decks.length ? "No decks found" : "Create your first deck"}
          description={
            decks.length
              ? "Try another search or clear your filters."
              : "Group your cards by subject, then add a prompt and answer."
          }
        >
          <Button onClick={() => editDeck()}>
            <Plus />
            New deck
          </Button>
        </EmptyState>
      )}
    </div>
  )
}
function PreviewContent({
  prompt,
  answer,
}: {
  prompt: string
  answer: string
}) {
  return (
    <div>
      <div className="preview-question">
        <span className="eyebrow">PROMPT</span>
        <Markdown>{prompt}</Markdown>
      </div>
      <div className="preview-answer">
        <span className="eyebrow">ANSWER</span>
        <Markdown>{answer}</Markdown>
      </div>
    </div>
  )
}

function CardPreview({
  card,
  onClose,
}: {
  card: Flashcard
  onClose: () => void
}) {
  const { editCard } = useApp()
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="editor-dialog sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Card preview</DialogTitle>
        </DialogHeader>
        {card.reverse ? (
          <Tabs defaultValue="forward">
            <TabsList aria-label="Preview direction">
              <TabsTrigger value="forward">Forward</TabsTrigger>
              <TabsTrigger value="backward">
                <ArrowLeftRight />
                Reverse
              </TabsTrigger>
            </TabsList>
            <TabsContent value="forward">
              <PreviewContent prompt={card.prompt} answer={card.answer} />
            </TabsContent>
            <TabsContent value="backward">
              <PreviewContent
                prompt={card.reversePrompt || card.answer}
                answer={card.prompt}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <PreviewContent prompt={card.prompt} answer={card.answer} />
        )}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              onClose()
              editCard(card)
            }}
          >
            <Pencil />
            Edit card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export function DeckDetail() {
  const { deckId } = useParams({ from: "/decks/$deckId" })
  const { decks, cards, now, editDeck, editCard } = useApp()
  const deck = decks.find((d) => d.id === deckId)
  const [query, setQuery] = useState("")
  const [tag, setTag] = useState("")
  const [preview, setPreview] = useState<Flashcard | null>(null)
  const [deleting, setDeleting] = useState<Flashcard | null>(null)
  const [busy, setBusy] = useState(false)
  if (!deck)
    return (
      <EmptyState
        title="This deck isn’t here"
        description="It may have been deleted or replaced by a backup."
      >
        <Button nativeButton={false} render={<Link to="/decks" />}>
          Back to decks
        </Button>
      </EmptyState>
    )
  const deckCards = cards.filter((c) => c.deckId === deckId)
  const tags = tagsFor(deckCards)
  const visible = deckCards.filter(
    (c) =>
      `${c.prompt} ${c.answer} ${c.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!tag || c.tags.includes(tag)),
  )
  const due = queueFor(deckCards, now).length
  async function remove() {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteCard(deleting.id)
      notify("Card deleted")
      setDeleting(null)
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <Link to="/decks" className="back-link">
        <ArrowLeft size={14} />
        My decks
      </Link>
      <div className="deck-detail-heading">
        <DeckIcon deck={deck} />
        <div className="flex-1 min-w-0">
          <h1>{deck.name}</h1>
          <p>{deck.description}</p>
          <div className="deck-tags mt-3">
            {deck.tags.map((t) => (
              <Badge variant="secondary" key={t}>
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <IconButton
          label="Edit deck"
          variant="outline"
          onClick={() => editDeck(deck)}
        >
          <Pencil />
        </IconButton>
      </div>
      <div className="deck-study-banner">
        <div>
          <span className="deck-study-icon">
            <LayersIcon />
          </span>
          <span>
            <strong>
              {due ? `${due} reviews ready` : "You’re all caught up"}
            </strong>
            <small>
              {deckCards.length} cards ·{" "}
              {deckCards.filter((c) => c.reverse).length} with reverse practice
            </small>
          </span>
        </div>
        <Button
          nativeButton={false}
          render={<Link to="/study" search={{ deck: deck.id }} />}
        >
          Review deck
          <ArrowRight />
        </Button>
      </div>
      <div className="section-heading mt-9">
        <h2>
          Cards <span className="count-badge ml-2">{deckCards.length}</span>
        </h2>
        <Button onClick={() => editCard(undefined, deckId)}>
          <Plus />
          Add card
        </Button>
      </div>
      <div className="library-toolbar">
        <div className="search-field">
          <Search />
          <Input
            aria-label="Search cards"
            placeholder="Search prompts, answers, or tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <TagFilter
          label="Filter cards by tag"
          tags={tags}
          value={tag}
          onChange={setTag}
        />
      </div>
      {visible.length ? (
        <Card className="card-table">
          <div className="card-table-header">
            <span>PROMPT & ANSWER</span>
            <span>STATUS</span>
            <span />
          </div>
          {visible.map((card) => (
            <div key={card.id} className="card-row">
              <button
                onClick={() => setPreview(card)}
                className="card-row-main"
              >
                <strong>{card.prompt}</strong>
                <p>{card.answer.replace(/[#*`>[\]]/g, "").slice(0, 150)}</p>
                <span className="flex flex-wrap gap-1.5 mt-2">
                  {card.reverse && (
                    <Badge variant="outline">
                      <ArrowLeftRight />
                      Both ways
                    </Badge>
                  )}
                  {card.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </span>
              </button>
              <span className="card-status">
                {card.forward.reps === 0 ? (
                  <>
                    <span className="new-dot" />
                    New
                  </>
                ) : queueFor([card], now).length ? (
                  <>
                    <Clock3 size={13} />
                    Due
                  </>
                ) : (
                  <>
                    <Check size={13} />
                    Scheduled
                  </>
                )}
              </span>
              <div className="flex gap-1">
                <IconButton
                  label={`Edit ${card.prompt}`}
                  onClick={() => editCard(card)}
                >
                  <Pencil />
                </IconButton>
                <IconButton
                  label={`Delete ${card.prompt}`}
                  onClick={() => setDeleting(card)}
                >
                  <Trash2 />
                </IconButton>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState
          title={
            deckCards.length
              ? "Nothing matches just yet"
              : "Every deck starts with one card"
          }
          description={
            deckCards.length
              ? "Try a different search or tag."
              : "Add a question and an answer. We’ll take care of the timing."
          }
        >
          <Button onClick={() => editCard(undefined, deckId)}>
            <Plus />
            Add card
          </Button>
        </EmptyState>
      )}
      {preview && (
        <CardPreview card={preview} onClose={() => setPreview(null)} />
      )}
      {deleting && (
        <Confirm
          title="Delete this card?"
          description="The card and its forward and reverse review history will be permanently deleted."
          onConfirm={remove}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}
    </div>
  )
}
function LayersIcon() {
  return <ArrowLeftRight size={21} />
}
export function TagsPage() {
  const { decks, cards } = useApp()
  const [query, setQuery] = useState("")
  const tags = tagsFor([...decks, ...cards]).filter((t) =>
    t.includes(query.toLowerCase()),
  )
  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>Tags</h1>
          <p>Tags bring related ideas together, across every deck.</p>
        </div>
      </div>
      <div className="search-field mb-7 max-w-md">
        <Search />
        <Input
          aria-label="Search tags"
          placeholder="Find a tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="tags-grid">
        {tags.map((tag, i) => {
          const deckCount = decks.filter(
            (d) =>
              d.tags.includes(tag) ||
              cards.some((c) => c.deckId === d.id && c.tags.includes(tag)),
          ).length
          const cardCount = cards.filter((c) => c.tags.includes(tag)).length
          return (
            <Link to="/decks" search={{ tag }} key={tag}>
              <Card className="tag-card">
                <span
                  className={`tag-icon color-${["sage", "violet", "peach", "blue"][i % 4]}`}
                >
                  <Hash />
                </span>
                <h3>{tag}</h3>
                <p>
                  {deckCount} {deckCount === 1 ? "deck" : "decks"} · {cardCount}{" "}
                  tagged cards
                </p>
                <ArrowUpRight className="tag-arrow" size={16} />
              </Card>
            </Link>
          )
        })}
      </div>
      {!tags.length && (
        <EmptyState
          title="No tags yet"
          description="Add tags when you create or edit a deck or card."
        />
      )}
    </div>
  )
}
