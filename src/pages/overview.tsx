import { Link } from "@tanstack/react-router"
import { ArrowRight, Plus, X } from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"
import { useApp } from "@/lib/app-context"
import { db, setSetting } from "@/lib/db"
import { dateKey, queueFor } from "@/lib/model"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DeckIcon, EmptyState, IconButton } from "@/components/shared"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { reportError } from "@/components/ui/toast"

export function WeekActivity({ compact = false }: { compact?: boolean }) {
  const { reviews, now } = useApp()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - 6 + i)
    return d
  })
  const counts = days.map(
    (d) => reviews.filter((r) => dateKey(r.at) === dateKey(+d)).length,
  )
  const max = Math.max(5, ...counts)
  return (
    <div className={compact ? "week-chart compact" : "week-chart"}>
      {days.map((d, i) => (
        <Tooltip key={+d}>
          <TooltipTrigger
            render={
              <button
                className={`week-column ${i === 6 ? "today" : ""}`}
                aria-label={`${d.toLocaleDateString()}: ${counts[i]} reviews`}
              />
            }
          >
            <span className="week-track">
              <span style={{ height: `${(counts[i] / max) * 100}%` }} />
            </span>
            <span className="week-day">
              {d.toLocaleDateString("en", { weekday: "narrow" })}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {d.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}{" "}
            · {counts[i]} reviews
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

export function Overview() {
  const { decks, cards, reviews, now, editDeck } = useApp()
  const starter = useLiveQuery(() => db.settings.get("starterNotice"))
  const queue = queueFor(cards, now)
  const reviewedToday = reviews.filter(
    (r) => dateKey(r.at) === dateKey(now),
  ).length
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 6)
  weekStart.setHours(0, 0, 0, 0)
  const reviewedThisWeek = reviews.filter(
    (r) => r.at >= +weekStart && r.at <= now,
  ).length
  const dueByDeck = new Map<string, number>()
  for (const item of queue) {
    dueByDeck.set(item.card.deckId, (dueByDeck.get(item.card.deckId) ?? 0) + 1)
  }
  // Queue order puts the deck with the oldest due review first.
  const readyDecks = [...dueByDeck.keys()].flatMap((id) =>
    decks.filter((deck) => deck.id === id),
  )
  const visible = (
    queue.length
      ? readyDecks
      : decks.toSorted((a, b) => b.createdAt - a.createdAt)
  ).slice(0, 4)

  return (
    <div className="overview-page">
      <div className="page-heading">
        <h1>Overview</h1>
        <Button variant="outline" onClick={() => editDeck()}>
          <Plus />
          New deck
        </Button>
      </div>
      {cards.length ? (
        <section
          className="review-summary"
          aria-labelledby="review-summary-title"
        >
          <div>
            <h2 id="review-summary-title">
              {queue.length
                ? `${queue.length} ${queue.length === 1 ? "review" : "reviews"} ready`
                : "No reviews due now"}
            </h2>
            <p>{reviewedToday} reviewed today</p>
          </div>
          {queue.length > 0 && (
            <Button
              nativeButton={false}
              render={<Link to="/study" search={{ deck: undefined }} />}
            >
              Start reviewing <ArrowRight />
            </Button>
          )}
        </section>
      ) : (
        <EmptyState
          title={
            decks.length
              ? "Add cards to start reviewing"
              : "Create your first deck"
          }
          description={
            decks.length
              ? "Open a deck and add a prompt and answer."
              : "Group your cards by subject, or restore a library from a backup."
          }
        >
          {decks.length ? (
            <Button nativeButton={false} render={<Link to="/decks" />}>
              Open decks
            </Button>
          ) : (
            <Button onClick={() => editDeck()}>
              <Plus />
              Create deck
            </Button>
          )}
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/settings" />}
          >
            Import backup
          </Button>
        </EmptyState>
      )}
      <div className="overview-bottom">
        <section aria-labelledby="overview-decks-title">
          <div className="section-heading">
            <h2 id="overview-decks-title">
              {queue.length
                ? "Decks ready to review"
                : "Recently created decks"}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link to="/decks" />}
            >
              All decks <ArrowRight />
            </Button>
          </div>
          {visible.length ? (
            <Card className="overview-decks">
              {visible.map((deck) => (
                <div className="overview-deck-row" key={deck.id}>
                  <Link
                    to="/decks/$deckId"
                    params={{ deckId: deck.id }}
                    className="overview-deck-link"
                  >
                    <DeckIcon small deck={deck} />
                    <span>{deck.name}</span>
                  </Link>
                  <span className="overview-deck-count">
                    {dueByDeck.get(deck.id) ?? 0} to review
                  </span>
                  {!!dueByDeck.get(deck.id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      nativeButton={false}
                      aria-label={`Review ${deck.name}`}
                      render={<Link to="/study" search={{ deck: deck.id }} />}
                    >
                      Review <ArrowRight />
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          ) : (
            <p className="muted-description">No decks yet</p>
          )}
        </section>
        <section aria-labelledby="overview-activity-title">
          <Card className="activity-card">
            <div className="section-heading">
              <h2 id="overview-activity-title">This week</h2>
              <Link to="/activity" className="text-link">
                Activity <ArrowRight size={13} />
              </Link>
            </div>
            <WeekActivity compact />
            <div className="activity-summary">
              <span>
                <strong>{reviewedThisWeek}</strong> reviews in the last 7 days
              </span>
            </div>
          </Card>
        </section>
      </div>
      {decks.length > 0 && starter?.value === "true" && (
        <div className="starter-notice">
          <div>
            <p>Starter decks are included. Edit or delete them as needed.</p>
            <p>
              This library is saved in this browser only.{" "}
              <Link to="/settings" className="underline underline-offset-2">
                Export backups
              </Link>{" "}
              to keep a separate copy.
            </p>
          </div>
          <IconButton
            label="Dismiss starter note"
            size="icon-xs"
            onClick={() =>
              setSetting("starterNotice", "false").catch(reportError)
            }
          >
            <X />
          </IconButton>
        </div>
      )}
    </div>
  )
}
