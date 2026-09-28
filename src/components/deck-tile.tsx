import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { deleteDeck } from '@/lib/db'
import { queueFor, type Deck } from '@/lib/model'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu'
import { Confirm, DeckIcon } from './shared'
import { notify, reportError } from './ui/toast'
import { Progress } from './ui/progress'

export function DeckTile({
  deck,
  list = false,
}: {
  deck: Deck
  list?: boolean
}) {
  const { cards, now, editDeck, editCard } = useApp()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const deckCards = cards.filter((c) => c.deckId === deck.id)
  const due = queueFor(deckCards, now).length
  const schedules = deckCards.flatMap((c) => [
    c.forward,
    ...(c.reverse ? [c.backward] : []),
  ])
  const learned = schedules.filter((s) => s.state === 2).length
  const progress = schedules.length
    ? Math.round((learned / schedules.length) * 100)
    : 0
  async function remove() {
    setBusy(true)
    try {
      await deleteDeck(deck.id)
      notify('Deck deleted')
      setConfirm(false)
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Card className={`deck-tile ${list ? 'deck-tile-list' : ''}`}>
        <div className="deck-tile-top">
          <DeckIcon deck={deck} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Options for ${deck.name}`}
                />
              }
            >
              <Ellipsis />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => editDeck(deck)}>
                <Pencil />
                Edit deck
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editCard(undefined, deck.id)}>
                <Plus />
                Add card
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirm(true)}
              >
                <Trash2 />
                Delete deck
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Link
          to="/decks/$deckId"
          params={{ deckId: deck.id }}
          className="deck-main-link"
        >
          <h3>
            {deck.name}
            <ArrowUpRight size={17} />
          </h3>
          <p>
            {deck.description ||
              'A new collection of things worth remembering.'}
          </p>
        </Link>
        <div className="deck-tags">
          {deck.tags.slice(0, 3).map((tag) => (
            <Badge variant="secondary" key={tag}>
              {tag}
            </Badge>
          ))}
        </div>
        <div className="deck-progress">
          <div>
            <span>{deckCards.length} cards</span>
            <span>{progress}% learned</span>
          </div>
          <Progress
            value={progress}
            aria-label={`${deck.name}: ${progress}% learned`}
            className={`color-${deck.color}`}
          />
        </div>
        <div className="deck-tile-footer">
          <span className={due ? 'due-label' : 'text-muted-foreground'}>
            <span className={due ? 'status-dot' : 'quiet-dot'} />
            {due ? `${due} to review` : 'All caught up'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link to="/study" search={{ deck: deck.id }} />}
          >
            {due ? 'Review' : 'Open review'}
            <ArrowUpRight />
          </Button>
        </div>
      </Card>
      {confirm && (
        <Confirm
          title={`Delete “${deck.name}”?`}
          description={`This will permanently delete ${deckCards.length} cards and their review history. Export a backup first if you want to keep them.`}
          onConfirm={remove}
          onClose={() => setConfirm(false)}
          busy={busy}
        />
      )}
    </>
  )
}
