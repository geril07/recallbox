import { z } from "zod"
import { createEmptyCard, fsrs, Rating, type Card as FSRSCard } from "ts-fsrs"

export const colors = [
  "sage",
  "blue",
  "peach",
  "violet",
  "rose",
  "sand",
] as const
const id = z.string().min(1).max(100)
const text = z.string().max(200000)
const time = z.number().finite().nonnegative().max(8640000000000000)
export const scheduleSchema = z.object({
  due: time,
  stability: z.number().finite().nonnegative(),
  difficulty: z.number().finite().min(0).max(10),
  elapsed_days: z.number().finite().nonnegative(),
  scheduled_days: z.number().finite().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  learning_steps: z.number().int().nonnegative(),
  state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  last_review: time.optional(),
})
const tags = z.array(z.string().min(1).max(50)).max(30)
export const deckSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  description: z.string().max(240),
  color: z.enum(colors),
  icon: z.enum(["languages", "sparkles", "code", "book", "globe", "leaf"]),
  tags,
  createdAt: time,
})
export const cardSchema = z.object({
  id,
  deckId: id,
  prompt: text.trim().min(1),
  answer: text.trim().min(1),
  tags,
  reverse: z.boolean(),
  reversePrompt: text,
  forward: scheduleSchema,
  backward: scheduleSchema,
  createdAt: time,
  updatedAt: time,
})
export const reviewSchema = z.object({
  id,
  cardId: id,
  deckId: id,
  direction: z.enum(["forward", "backward"]),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  at: time,
})
export type Deck = z.infer<typeof deckSchema>
export type Flashcard = z.infer<typeof cardSchema>
export type Review = z.infer<typeof reviewSchema>
export type Schedule = z.infer<typeof scheduleSchema>
export type Direction = Review["direction"]
export type Grade = Review["rating"]
export interface Asset {
  id: string
  name: string
  blob: Blob
}
export interface Setting {
  key: string
  value: string
}
export interface QueueItem {
  card: Flashcard
  direction: Direction
}

export const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: false })
export function storeSchedule(card: FSRSCard): Schedule {
  return {
    ...card,
    due: card.due.getTime(),
    last_review: card.last_review?.getTime(),
  }
}
export function loadSchedule(card: Schedule): FSRSCard {
  return {
    ...card,
    due: new Date(card.due),
    last_review:
      card.last_review === undefined ? undefined : new Date(card.last_review),
  }
}
export function emptySchedule(now = Date.now()) {
  return storeSchedule(createEmptyCard(new Date(now)))
}
export function gradeCard(schedule: Schedule, grade: Grade, now = Date.now()) {
  return storeSchedule(
    scheduler.next(loadSchedule(schedule), new Date(now), grade).card,
  )
}
export function queueFor(cards: Flashcard[], now = Date.now()): QueueItem[] {
  return cards
    .flatMap((card) =>
      (["forward", ...(card.reverse ? ["backward"] : [])] as Direction[])
        .filter((direction) => card[direction].due <= now)
        .map((direction) => ({ card, direction })),
    )
    .toSorted((a, b) => a.card[a.direction].due - b.card[b.direction].due)
}
export function referencedAssetIds(cards: Flashcard[]) {
  return new Set(
    cards.flatMap((c) =>
      [
        ...`${c.prompt}\n${c.answer}\n${c.reversePrompt}`.matchAll(
          /asset:([\w-]+)/g,
        ),
      ].map((m) => m[1]),
    ),
  )
}
export function normalizeTags(values: string[]) {
  return [
    ...new Set(
      values.map((value) => value.trim().toLowerCase()).filter(Boolean),
    ),
  ]
}
export function tagsFor(items: { tags: string[] }[]) {
  return [...new Set(items.flatMap((item) => item.tags))].toSorted()
}
export function intervalLabel(due: number, now = Date.now()) {
  const minutes = Math.max(1, Math.round((due - now) / 60000))
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}
export function dateKey(timestamp: number) {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
export function streakFor(reviews: Review[], now = new Date()) {
  const days = new Set(reviews.map((r) => dateKey(r.at)))
  const date = new Date(now)
  if (!days.has(dateKey(+date))) date.setDate(date.getDate() - 1)
  let streak = 0
  while (days.has(dateKey(+date))) {
    streak++
    date.setDate(date.getDate() - 1)
  }
  return streak
}
export { Rating }
