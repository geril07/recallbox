import { useEffect, useRef, useState } from "react"
import { Link, useSearch } from "@tanstack/react-router"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Eye,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react"
import { useApp } from "@/lib/app-context"
import { reviewCard } from "@/lib/db"
import { gradeCard, intervalLabel, queueFor, type Grade } from "@/lib/model"
import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { DeckIcon, IconButton } from "@/components/shared"
import { reportError } from "@/components/ui/toast"

export function Study() {
  const { deck: deckId } = useSearch({ from: "/study" })
  const { cards, decks, now } = useApp()
  const [queue, setQueue] = useState(() =>
    queueFor(cards.filter((c) => !deckId || c.deckId === deckId)),
  )
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [started, setStarted] = useState(Date.now)
  const lock = useRef(false)
  const current = queue[index]
  const deck = decks.find((d) => d.id === current?.card.deckId)
  const [error, setError] = useState(false)
  async function rate(grade: Grade) {
    if (!current || !revealed || lock.current || error) return
    lock.current = true
    setBusy(true)
    try {
      await reviewCard(current, grade)
      setCorrect((c) => c + (grade > 1 ? 1 : 0))
      setRevealed(false)
      setIndex((i) => i + 1)
    } catch (e) {
      reportError(e)
      setError(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.repeat ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        document.querySelector(
          '[data-slot="dialog-content"], [data-slot="alert-dialog-content"]',
        )
      )
        return
      if (e.code === "Space" && current && !revealed) {
        e.preventDefault()
        setRevealed(true)
      }
      if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault()
        void rate(Number(e.key) as Grade)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  })
  function restart() {
    setQueue(queueFor(cards.filter((c) => !deckId || c.deckId === deckId)))
    setIndex(0)
    setRevealed(false)
    setCorrect(0)
    setStarted(Date.now())
    setError(false)
  }
  if (!current) {
    const remaining = queueFor(
      cards.filter((c) => !deckId || c.deckId === deckId),
      now,
    ).length
    return (
      <motion.div
        className="session-complete"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="completion-art">
          <span />
          <span />
          <span className="completion-icon">
            <CheckCheck size={38} strokeWidth={1.4} />
          </span>
          <Sparkles className="completion-spark" size={24} />
        </div>
        <div className="eyebrow">
          {queue.length
            ? "A LITTLE MORE, REMEMBERED"
            : "A MOMENT TO LET IT SINK IN"}
        </div>
        <h1>
          {queue.length ? "That’s time well spent." : "You’re all caught up."}
        </h1>
        <p>
          {queue.length
            ? "Small steps make lasting memories. Nice work showing up."
            : "Your next reviews will appear when they’re ready."}
        </p>
        {queue.length > 0 && (
          <div className="completion-stats">
            <div>
              <strong>{index}</strong>
              <span>reviews completed</span>
            </div>
            <div>
              <strong>{Math.round((correct / queue.length) * 100)}%</strong>
              <span>recalled</span>
            </div>
            <div>
              <strong>
                {Math.max(1, Math.round((now - started) / 60000))}
                <small> min</small>
              </strong>
              <span>well invested</span>
            </div>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/" />}
          >
            <ArrowLeft />
            Back to overview
          </Button>
          {remaining > 0 ? (
            <Button onClick={restart}>
              <RotateCcw />
              Review {remaining} more
            </Button>
          ) : (
            <Button nativeButton={false} render={<Link to="/decks" />}>
              Explore decks
              <ArrowRight />
            </Button>
          )}
        </div>
        <p className="completion-note">
          Progress saved on this device. Learning cards may return in a few
          minutes.
        </p>
      </motion.div>
    )
  }
  const prompt =
    current.direction === "forward"
      ? current.card.prompt
      : current.card.reversePrompt || current.card.answer
  const answer =
    current.direction === "forward" ? current.card.answer : current.card.prompt
  return (
    <div className="study-page">
      <div className="study-topline">
        <Link to="/" className="back-link">
          <ArrowLeft size={14} />
          Overview
        </Link>
        <span>FOCUS MODE</span>
        <IconButton
          label="End session"
          nativeButton={false}
          render={<Link to="/" />}
        >
          <X />
        </IconButton>
      </div>
      <div className="study-progress">
        <span>
          {index} of {queue.length} reviewed
        </span>
        <Progress
          value={(index / queue.length) * 100}
          aria-label="Session progress"
        />
        <span>{Math.round((index / queue.length) * 100)}%</span>
      </div>
      <div className="study-deck-label">
        {deck && (
          <>
            <DeckIcon small deck={deck} />
            <span>{deck.name}</span>
            <ChevronRight size={13} />
          </>
        )}
        <Badge variant="outline">
          {current.direction === "backward" ? (
            <>
              <ArrowLeftRight />
              Reverse
            </>
          ) : (
            "Forward"
          )}
        </Badge>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.card.id}-${current.direction}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="study-card">
            <div className="study-question">
              <span className="eyebrow">BRING IT BACK TO MIND</span>
              <Markdown>{prompt}</Markdown>
            </div>
            {revealed && (
              <motion.div
                className="study-answer"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <span className="eyebrow">THE ANSWER</span>
                <Markdown>{answer}</Markdown>
              </motion.div>
            )}
            <div className="study-card-footer">
              <div className="flex gap-2">
                {current.card.tags.map((tag) => (
                  <Badge variant="secondary" key={tag}>
                    {tag}
                  </Badge>
                ))}
              </div>
              <span>
                {current.card[current.direction].reps === 0
                  ? "New card"
                  : "Spaced review"}
              </span>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
      {error ? (
        <div className="study-controls">
          <p className="text-sm text-destructive mb-4">
            The session changed or could not be saved. Your last answer was not
            counted.
          </p>
          <Button onClick={restart}>
            <RotateCcw />
            Reload session
          </Button>
        </div>
      ) : !revealed ? (
        <div className="study-controls">
          <Button size="lg" onClick={() => setRevealed(true)}>
            <Eye />
            Reveal answer<kbd>Space</kbd>
          </Button>
          <p>Take a breath. Try to recall before you reveal.</p>
        </div>
      ) : (
        <div className="rating-area">
          <p>How well did you remember?</p>
          <div className="rating-grid">
            {(
              [
                { grade: 1, label: "Again", help: "I forgot", color: "rose" },
                {
                  grade: 2,
                  label: "Hard",
                  help: "With effort",
                  color: "peach",
                },
                {
                  grade: 3,
                  label: "Good",
                  help: "Got it right",
                  color: "sage",
                },
                {
                  grade: 4,
                  label: "Easy",
                  help: "Knew it instantly",
                  color: "blue",
                },
              ] as const
            ).map((r) => (
              <Button
                key={r.grade}
                variant="outline"
                className={`rating-button color-${r.color}`}
                disabled={busy}
                onClick={() => rate(r.grade)}
              >
                <span className="rating-top">
                  <kbd>{r.grade}</kbd>
                  <span>
                    {intervalLabel(
                      gradeCard(current.card[current.direction], r.grade, now)
                        .due,
                      now,
                    )}
                  </span>
                </span>
                <strong>
                  {r.label}
                  {r.grade === 3 && <Check size={14} />}
                </strong>
                <small>{r.help}</small>
              </Button>
            ))}
          </div>
          <span className="rating-footnote">
            Your next review adapts to your answer.
          </span>
        </div>
      )}
    </div>
  )
}
