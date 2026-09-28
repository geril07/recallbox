import { Link } from "@tanstack/react-router"
import { ArrowRight, CheckCheck, Flame, Target, TrendingUp } from "lucide-react"
import { useApp } from "@/lib/app-context"
import { dateKey, streakFor } from "@/lib/model"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DeckIcon, EmptyState } from "@/components/shared"
import { WeekActivity } from "@/pages/overview"

export function Activity() {
  const { reviews, decks, cards, now } = useApp()
  const days = Array.from({ length: 112 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - 111 + i)
    return d
  })
  const counts = new Map<string, number>()
  reviews.forEach((r) =>
    counts.set(dateKey(r.at), (counts.get(dateKey(r.at)) || 0) + 1),
  )
  const recall = reviews.length
    ? Math.round(
        (reviews.filter((r) => r.rating > 1).length / reviews.length) * 100,
      )
    : null
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE BIGGER PICTURE</div>
          <h1>
            Look how far you’ve come<span className="text-primary">.</span>
          </h1>
          <p>Progress isn’t always a straight line. Every review counts.</p>
        </div>
        <Button
          nativeButton={false}
          render={<Link to="/study" search={{ deck: undefined }} />}
        >
          Keep learning
          <ArrowRight />
        </Button>
      </div>
      <div className="stats-grid">
        {[
          { icon: CheckCheck, title: "Total reviews", value: reviews.length },
          {
            icon: Flame,
            title: "Current streak",
            value: `${streakFor(reviews, new Date(now))} days`,
          },
          {
            icon: Target,
            title: "Recall rate",
            value: recall === null ? "—" : `${recall}%`,
          },
          {
            icon: TrendingUp,
            title: "Cards learned",
            value: cards.filter(
              (c) =>
                c.forward.state === 2 && (!c.reverse || c.backward.state === 2),
            ).length,
          },
        ].map((stat) => (
          <Card className="stat-card" key={stat.title}>
            <div className="stat-top">
              <span>{stat.title}</span>
              <stat.icon className="size-4 text-primary" />
            </div>
            <div className="stat-value">{stat.value}</div>
          </Card>
        ))}
      </div>
      <div className="activity-layout">
        <Card className="heatmap-card">
          <div className="section-heading">
            <h2>A habit, one day at a time</h2>
            <span className="text-xs text-muted-foreground">Last 16 weeks</span>
          </div>
          <p className="muted-description">Your personal trail of curiosity.</p>
          <div className="heatmap">
            {days.map((d) => {
              const count = counts.get(dateKey(+d)) || 0
              return (
                <Tooltip key={+d}>
                  <TooltipTrigger
                    render={
                      <button
                        className={`heatmap-cell level-${count === 0 ? 0 : count < 5 ? 1 : count < 15 ? 2 : 3}`}
                        aria-label={`${d.toLocaleDateString()}: ${count} reviews`}
                      />
                    }
                  />
                  <TooltipContent>
                    {d.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {count} reviews
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          <div className="heatmap-legend">
            <span>Less</span>
            {[0, 1, 2, 3].map((n) => (
              <span key={n} className={`heatmap-cell level-${n}`} />
            ))}
            <span>More</span>
          </div>
        </Card>
        <Card className="activity-card">
          <h2>This week</h2>
          <WeekActivity />
        </Card>
      </div>
      <section className="mt-9">
        <div className="section-heading">
          <h2>Recent reviews</h2>
          <span className="text-xs text-muted-foreground">Last 20 answers</span>
        </div>
        {reviews.length ? (
          <Card className="recent-reviews">
            {reviews
              .toSorted((a, b) => b.at - a.at)
              .slice(0, 20)
              .map((r) => {
                const card = cards.find((c) => c.id === r.cardId)
                const deck = decks.find((d) => d.id === r.deckId)
                return (
                  <div key={r.id} className="review-row">
                    {deck && <DeckIcon small deck={deck} />}
                    <div className="flex-1 min-w-0">
                      <strong>{card?.prompt || "Deleted card"}</strong>
                      <p>
                        {deck?.name || "Deleted deck"} ·{" "}
                        {r.direction === "backward" ? "Reverse" : "Forward"}
                      </p>
                    </div>
                    <span
                      className={`review-grade color-${["", "rose", "peach", "sage", "blue"][r.rating]}`}
                    >
                      {["", "Again", "Hard", "Good", "Easy"][r.rating]}
                    </span>
                    <time>
                      {new Date(r.at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      <small>
                        {new Date(r.at).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </time>
                  </div>
                )
              })}
          </Card>
        ) : (
          <EmptyState
            title="A fresh page"
            description="Your first review will be the start of your story."
          >
            <Button
              nativeButton={false}
              render={<Link to="/study" search={{ deck: undefined }} />}
            >
              Start reviewing
              <ArrowRight />
            </Button>
          </EmptyState>
        )}
      </section>
    </div>
  )
}
