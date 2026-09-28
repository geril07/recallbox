import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Clock3,
  Flame,
  Layers,
  Plus,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '@/lib/app-context'
import { db, setSetting } from '@/lib/db'
import { dateKey, queueFor, streakFor } from '@/lib/model'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DeckTile } from '@/components/deck-tile'
import { EmptyState, IconButton } from '@/components/shared'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { reportError } from '@/components/ui/toast'

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
    <div className={compact ? 'week-chart compact' : 'week-chart'}>
      {days.map((d, i) => (
        <Tooltip key={+d}>
          <TooltipTrigger
            render={
              <button
                className={`week-column ${i === 6 ? 'today' : ''}`}
                aria-label={`${d.toLocaleDateString()}: ${counts[i]} reviews`}
              />
            }
          >
            <span className="week-track">
              <span
                style={{ height: `${Math.max(4, (counts[i] / max) * 100)}%` }}
              />
            </span>
            <span className="week-day">
              {d.toLocaleDateString('en', { weekday: 'narrow' })}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {d.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}{' '}
            · {counts[i]} reviews
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
export function Overview() {
  const { decks, cards, reviews, now, editDeck } = useApp()
  const [filter, setFilter] = useState<'all' | 'due'>('all')
  const starter = useLiveQuery(() => db.settings.get('starterNotice'))
  const due = queueFor(cards, now).length
  const reviewedToday = reviews.filter(
    (r) => dateKey(r.at) === dateKey(now),
  ).length
  const streak = streakFor(reviews, new Date(now))
  const retention = reviews.length
    ? Math.round(
        (reviews.filter((r) => r.rating > 1).length / reviews.length) * 100,
      )
    : null
  const visible = decks.filter(
    (d) =>
      filter === 'all' ||
      queueFor(
        cards.filter((c) => c.deckId === d.id),
        now,
      ).length,
  )
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR DAILY DOSE OF DISCOVERY</div>
          <h1>
            A little practice. A lasting memory
            <span className="text-primary">.</span>
          </h1>
          <p>Pick up where you left off, or learn something new.</p>
        </div>
        <Button variant="outline" onClick={() => editDeck()}>
          <Plus />
          New deck
        </Button>
      </div>
      <section className="review-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span className="hero-spark">
              <Sparkles size={14} />
            </span>
            SMALL STEPS, STRONGER CONNECTIONS
          </div>
          <h2 id="hero-title">
            Make a little room
            <br />
            for what you know.
          </h2>
          <p>
            {due ? (
              <>
                <strong>{due} reviews</strong> are ready. A few focused minutes
                go a long way.
              </>
            ) : (
              <>You’re all caught up. Your next discovery is waiting.</>
            )}
          </p>
          <Button
            size="lg"
            nativeButton={false}
            render={
              <Link
                to={due ? '/study' : '/decks'}
                search={{ deck: undefined }}
              />
            }
          >
            {due ? 'Start reviewing' : 'Explore your decks'}
            <ArrowRight />
            <span className="hero-button-divider" />
            {due
              ? `~${Math.max(1, Math.ceil((due * 15) / 60))} min`
              : 'Your library'}
          </Button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="art-spark spark-one">✧</span>
          <span className="art-spark spark-two">✦</span>
          <div className="art-card art-back">
            <div />
            <div />
            <div />
          </div>
          <div className="art-card art-front">
            <div className="art-card-top">
              <span>ONE CARD AT A TIME</span>
              <Layers size={15} />
            </div>
            <div className="art-word">
              recall<span>.</span>
            </div>
            <div className="art-pronunciation">/rɪˈkɔːl/ · verb</div>
            <div className="art-card-rule" />
            <p>
              To bring back to mind.
              <br />
              To make it yours.
            </p>
            <span className="art-check">
              <Check size={15} />
            </span>
          </div>
          <span className="art-dot" />
        </div>
      </section>
      <section className="stats-grid" aria-label="Learning statistics">
        {[
          {
            label: 'Ready to review',
            value: due,
            icon: Layers,
            note: 'a fresh chance to remember',
            color: 'sage',
          },
          {
            label: 'Reviewed today',
            value: reviewedToday,
            icon: CheckCheck,
            note: 'one step further',
            color: 'blue',
          },
          {
            label: 'Current streak',
            value: `${streak}`,
            suffix: streak === 1 ? 'day' : 'days',
            icon: Flame,
            note: 'consistency over intensity',
            color: 'peach',
          },
          {
            label: 'Recall rate',
            value: retention === null ? '—' : `${retention}%`,
            icon: Target,
            note:
              retention === null
                ? 'your story starts here'
                : 'across all your reviews',
            color: 'violet',
          },
        ].map((stat) => (
          <Card key={stat.label} className="stat-card">
            <div className="stat-top">
              <span>{stat.label}</span>
              <span className={`stat-icon color-${stat.color}`}>
                <stat.icon size={16} />
              </span>
            </div>
            <div className="stat-value">
              {stat.value}
              <span>{stat.suffix}</span>
            </div>
            <p>{stat.note}</p>
          </Card>
        ))}
      </section>
      <div className="overview-bottom">
        <section>
          <div className="section-heading">
            <div className="flex items-center gap-2.5">
              <h2>Your decks</h2>
              <span className="count-badge">{decks.length}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link to="/decks" />}
            >
              View all
              <ArrowUpRight />
            </Button>
          </div>
          <div
            className="deck-filter-tabs"
            role="group"
            aria-label="Filter decks"
          >
            <Button
              variant={filter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All decks
            </Button>
            <Button
              variant={filter === 'due' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('due')}
            >
              Due for review
              <span className="tiny-dot" />
            </Button>
          </div>
          {visible.length ? (
            <div className="deck-grid">
              {visible.slice(0, 4).map((deck) => (
                <DeckTile key={deck.id} deck={deck} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                filter === 'due'
                  ? 'A clear mind, a clear queue.'
                  : 'Your first deck awaits.'
              }
              description={
                filter === 'due'
                  ? 'Come back when your next reviews are due.'
                  : 'Collect the things you want to remember.'
              }
            >
              <Button onClick={() => editDeck()}>
                <Plus />
                Create deck
              </Button>
            </EmptyState>
          )}
        </section>
        <aside className="insights" aria-label="Learning insights">
          <Card className="activity-card">
            <div className="section-heading">
              <h3>Your rhythm</h3>
              <span className="subtle-icon">
                <BarIcon />
              </span>
            </div>
            <p className="muted-description">A little progress adds up.</p>
            <WeekActivity compact />
            <div className="activity-summary">
              <span>
                <strong>
                  {reviews.filter((r) => r.at >= now - 7 * 86400000).length}
                </strong>{' '}
                reviews this week
              </span>
              <span className="activity-summary-icon">
                <ArrowUpRight size={15} />
              </span>
            </div>
            <Link to="/activity" className="text-link">
              Explore your activity
              <ArrowRight size={13} />
            </Link>
          </Card>
          <Card className="tip-card">
            <span className="tip-icon">
              <Sparkles size={18} />
            </span>
            <div className="eyebrow">BETTER, NOT LONGER</div>
            <h3>
              Let forgetting
              <br />
              do some of the work.
            </h3>
            <p>
              A little effort to recall builds a stronger memory. We’ll bring
              each card back at just the right time.
            </p>
            <span className="tip-footer">
              <Clock3 size={13} />
              Thoughtfully spaced with FSRS
            </span>
          </Card>
        </aside>
      </div>
      {starter?.value === 'true' && (
        <div className="starter-notice">
          <span className="flex items-center gap-2">
            <Sparkles size={14} />
            <span>
              A few starter decks to make yourself at home. Edit them, keep
              them, or make your own.
            </span>
          </span>
          <IconButton
            label="Dismiss starter note"
            size="icon-xs"
            onClick={() =>
              setSetting('starterNotice', 'false').catch(reportError)
            }
          >
            <X />
          </IconButton>
        </div>
      )}
    </motion.div>
  )
}
function BarIcon() {
  return (
    <span className="mini-bars">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}
