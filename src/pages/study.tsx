import { useEffect, useRef, useState } from "react"
import { Link, useSearch } from "@tanstack/react-router"
import { ArrowLeft, CircleHelp, RotateCcw } from "lucide-react"
import { useApp } from "@/lib/app-context"
import { reviewCard } from "@/lib/db"
import { gradeCard, intervalLabel, queueFor, type Grade } from "@/lib/model"
import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { IconButton } from "@/components/shared"
import { reportError } from "@/components/ui/toast"

const ratings = [
  { grade: 1, label: "Again", help: "Did not recall", color: "rose" },
  { grade: 2, label: "Hard", help: "Recalled with difficulty", color: "peach" },
  { grade: 3, label: "Good", help: "Recalled correctly", color: "sage" },
  { grade: 4, label: "Easy", help: "Recalled immediately", color: "blue" },
] as const

export function Study() {
  const { deck: deckId } = useSearch({ from: "/study" })
  const { cards, decks, now } = useApp()
  const [queue, setQueue] = useState(() =>
    queueFor(cards.filter((card) => !deckId || card.deckId === deckId)),
  )
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [help, setHelp] = useState(false)
  const lock = useRef(false)
  const body = useRef<HTMLDivElement>(null)
  const answerHeading = useRef<HTMLHeadingElement>(null)
  const current = queue[index]
  const deck = decks.find((item) => item.id === current?.card.deckId)
  const sessionDeck = decks.find((item) => item.id === deckId)

  async function rate(grade: Grade) {
    if (!current || !revealed || lock.current || error) return
    lock.current = true
    setBusy(true)
    try {
      await reviewCard(current, grade)
      setRevealed(false)
      setIndex((value) => value + 1)
    } catch (e) {
      reportError(e)
      setError(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!current) return
    body.current?.scrollTo({ top: 0 })
    if (index > 0) body.current?.focus({ preventScroll: true })
  }, [current, index])

  useEffect(() => {
    if (revealed) {
      answerHeading.current?.focus({ preventScroll: true })
      answerHeading.current?.scrollIntoView({ block: "start" })
    }
  }, [revealed])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.isContentEditable ||
        target?.closest('input, textarea, select, [role="combobox"]') ||
        (target?.closest("button, a") && !target.closest(".study-page")) ||
        document.querySelector(
          '[data-slot="dialog-content"], [data-slot="alert-dialog-content"], [role="menu"], [role="listbox"]',
        )
      )
        return
      if (
        event.code === "Space" &&
        current &&
        !revealed &&
        !target?.closest("button, a")
      ) {
        event.preventDefault()
        setRevealed(true)
      }
      if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault()
        void rate(Number(event.key) as Grade)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  })

  function restart() {
    setQueue(
      queueFor(cards.filter((card) => !deckId || card.deckId === deckId)),
    )
    setIndex(0)
    setRevealed(false)
    setError(false)
  }

  if (!current) {
    const remaining = queueFor(
      cards.filter((card) => !deckId || card.deckId === deckId),
      now,
    ).length
    return (
      <div className="session-complete">
        <h1>{queue.length ? "Session complete" : "No reviews due now"}</h1>
        <p>
          {queue.length
            ? `${index} ${index === 1 ? "review" : "reviews"} completed. Progress saved in this browser.`
            : "Reviews will appear when they are due."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            nativeButton={false}
            render={
              sessionDeck ? (
                <Link to="/decks/$deckId" params={{ deckId: sessionDeck.id }} />
              ) : (
                <Link to="/" />
              )
            }
          >
            <ArrowLeft />
            {sessionDeck ? "Back to deck" : "Back to overview"}
          </Button>
          {remaining > 0 && (
            <Button variant="outline" onClick={restart}>
              <RotateCcw />
              Review {remaining} more
            </Button>
          )}
        </div>
      </div>
    )
  }

  const prompt =
    current.direction === "forward"
      ? current.card.prompt
      : current.card.reversePrompt || current.card.answer
  const answer =
    current.direction === "forward" ? current.card.answer : current.card.prompt
  const progress = (index / queue.length) * 100

  return (
    <div className="study-page">
      <h1 className="sr-only">Review</h1>
      <div className="study-heading">
        <div className="study-context">
          <div className="study-deck-label">
            <span>{deck?.name || "Review"}</span>
            {current.direction === "backward" && (
              <span className="study-direction">Reverse</span>
            )}
          </div>
          <div className="study-progress">
            <span aria-live="polite">
              {index} of {queue.length} reviewed
            </span>
            <span aria-hidden="true">{Math.round(progress)}%</span>
            <IconButton
              label="Review help"
              size="icon-sm"
              onClick={() => setHelp(true)}
            >
              <CircleHelp />
            </IconButton>
          </div>
        </div>
        <Progress
          className="w-full"
          value={progress}
          aria-label="Session progress"
        />
      </div>
      <div
        className="study-body"
        ref={body}
        role="region"
        aria-label="Review card"
        // Keyboard users need to focus this region to scroll long cards.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        <Card className="study-card">
          <div className="study-question">
            <Markdown>{prompt}</Markdown>
          </div>
          {revealed && (
            <div className="study-answer">
              <h2 ref={answerHeading} tabIndex={-1}>
                Answer
              </h2>
              <Markdown>{answer}</Markdown>
            </div>
          )}
        </Card>
      </div>
      <div className="study-actions">
        {error ? (
          <div className="study-error" role="alert">
            <p>
              The session changed or could not be saved. Your last answer was
              not counted.
            </p>
            <Button onClick={restart}>
              <RotateCcw />
              Reload session
            </Button>
          </div>
        ) : !revealed ? (
          <Button
            className="reveal-button"
            size="lg"
            aria-keyshortcuts="Space"
            onClick={() => setRevealed(true)}
          >
            Show answer{" "}
            <kbd className="study-shortcut" aria-hidden="true">
              Space
            </kbd>
          </Button>
        ) : (
          <>
            <p className="rating-label">How well did you recall?</p>
            <div className="rating-grid">
              {ratings.map((rating) => (
                <Button
                  key={rating.grade}
                  variant="outline"
                  className={`rating-button color-${rating.color}`}
                  disabled={busy}
                  aria-keyshortcuts={String(rating.grade)}
                  onClick={() => rate(rating.grade)}
                >
                  <span className="rating-name">
                    <strong>{rating.label}</strong>
                    <kbd className="study-shortcut" aria-hidden="true">
                      {rating.grade}
                    </kbd>
                  </span>
                  <small>{rating.help}</small>
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogTitle>Review help</DialogTitle>
          <DialogDescription>
            Rate what you recalled before showing the answer.
          </DialogDescription>
          <dl className="review-help-grades">
            {ratings.map((rating) => (
              <div key={rating.grade}>
                <dt>{rating.label}</dt>
                <dd>{rating.help}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">
            Each rating saves immediately. You can leave through the navigation
            at any time.
          </p>
          <p className="text-sm text-muted-foreground">
            Each direction appears once per session. Again schedules a review
            soon; start another session when it is due.
          </p>
          {revealed && (
            <div>
              <h3 className="mb-2 text-sm font-medium">
                Estimated next review
              </h3>
              <dl className="review-help-grades">
                {ratings.map((rating) => (
                  <div key={rating.grade}>
                    <dt>{rating.label}</dt>
                    <dd>
                      In{" "}
                      {intervalLabel(
                        gradeCard(
                          current.card[current.direction],
                          rating.grade,
                          now,
                        ).due,
                        now,
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Keyboard: Space shows the answer. Keys 1–4 select Again, Hard, Good,
            or Easy.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
