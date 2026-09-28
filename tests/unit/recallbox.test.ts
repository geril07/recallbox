import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import {
  db,
  deleteCard,
  deleteDeck,
  reviewCard,
  saveCard,
  saveDeck,
} from '../../src/lib/db'
import { createBackup, readBackup, restoreBackup } from '../../src/lib/backup'
import {
  emptySchedule,
  gradeCard,
  parseTags,
  queueFor,
  streakFor,
  type Deck,
  type Flashcard,
  type Review,
} from '../../src/lib/model'

const now = new Date('2026-05-15T12:00:00Z').getTime()
const deck: Deck = {
  id: 'deck-1',
  name: 'Languages',
  description: '',
  tags: ['languages'],
  color: 'sage',
  icon: 'book',
  createdAt: now,
}
function card(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'card-1',
    deckId: deck.id,
    prompt: 'Hola',
    answer: '**Hello**',
    tags: ['greetings'],
    reverse: true,
    reversePrompt: 'Hello',
    forward: emptySchedule(now),
    backward: emptySchedule(now),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
async function fixture() {
  await saveDeck(deck)
  const c = card()
  await saveCard(c)
  return c
}
async function zipManifest(
  manifest: unknown,
  assets: Record<string, Uint8Array> = {},
) {
  const zip = new JSZip()
  zip.file('recallbox.json', JSON.stringify(manifest))
  for (const [name, value] of Object.entries(assets)) zip.file(name, value)
  return new Blob([await zip.generateAsync({ type: 'uint8array' })])
}
beforeEach(async () => {
  await db.open()
  await db.transaction(
    'rw',
    db.decks,
    db.cards,
    db.reviews,
    db.assets,
    db.settings,
    async () => {
      await Promise.all([
        db.decks.clear(),
        db.cards.clear(),
        db.reviews.clear(),
        db.assets.clear(),
        db.settings.clear(),
      ])
    },
  )
})
afterAll(() => db.close())

describe('Scheduling and review behavior', () => {
  it('queues both directions independently and honors the reverse toggle', () => {
    const c = card()
    expect(queueFor([c], now).map((q) => q.direction)).toEqual([
      'forward',
      'backward',
    ])
    c.forward = gradeCard(c.forward, 3, now)
    expect(c.forward.due).toBeGreaterThan(now)
    expect(queueFor([c], now).map((q) => q.direction)).toEqual(['backward'])
    c.reverse = false
    expect(queueFor([c], now)).toEqual([])
  })
  it('uses FSRS to schedule easy answers later than forgotten answers', () => {
    const schedule = emptySchedule(now)
    expect(gradeCard(schedule, 4, now).due).toBeGreaterThan(
      gradeCard(schedule, 1, now).due,
    )
    expect(schedule.reps).toBe(0)
  })
  it('records an answer and schedule atomically, rejecting a duplicate from another tab', async () => {
    const c = await fixture()
    const item = { card: c, direction: 'forward' as const }
    await reviewCard(item, 3)
    expect((await db.cards.get(c.id))?.forward.reps).toBe(1)
    expect((await db.cards.get(c.id))?.backward.reps).toBe(0)
    expect(await db.reviews.count()).toBe(1)
    await expect(reviewCard(item, 4)).rejects.toThrow('another tab')
    expect(await db.reviews.count()).toBe(1)
  })
  it('keeps a streak through yesterday, then breaks after a missed day', () => {
    const date = new Date(2026, 4, 15, 12)
    const reviews = [14, 13, 11].map((day, i): Review => ({
      id: String(i),
      cardId: 'c',
      deckId: 'd',
      direction: 'forward',
      rating: 3,
      at: +new Date(2026, 4, day, 12),
    }))
    expect(streakFor(reviews, date)).toBe(2)
    expect(streakFor(reviews, new Date(2026, 4, 16, 12))).toBe(0)
  })
  it('normalizes global tags without duplicates', () => {
    expect(parseTags(' Spanish, travel, spanish, , Travel ')).toEqual([
      'spanish',
      'travel',
    ])
  })
})

describe('Local data integrity', () => {
  it('refuses to save a card to a missing deck', async () => {
    await expect(saveCard(card())).rejects.toThrow('no longer exists')
    expect(await db.cards.count()).toBe(0)
  })
  it('preserves a concurrent review when an older card editor is saved', async () => {
    const stale = await fixture()
    await reviewCard({ card: stale, direction: 'forward' }, 4)
    await saveCard({ ...stale, answer: 'Updated explanation' })
    expect((await db.cards.get(stale.id))?.forward.reps).toBe(1)
    expect((await db.cards.get(stale.id))?.answer).toBe('Updated explanation')
    await expect(
      reviewCard({ card: stale, direction: 'backward' }, 3),
    ).rejects.toThrow('changed')
  })
  it('moves review history with a card so backup references remain valid', async () => {
    const c = await fixture()
    await reviewCard({ card: c, direction: 'forward' }, 3)
    await saveDeck({ ...deck, id: 'deck-2', name: 'Second deck' })
    await saveCard({ ...(await db.cards.get(c.id))!, deckId: 'deck-2' })
    expect((await db.reviews.toArray())[0].deckId).toBe('deck-2')
    await expect(readBackup(await createBackup())).resolves.toBeDefined()
  })
  it('removes orphan images but retains images shared by another card', async () => {
    await saveDeck(deck)
    const id = crypto.randomUUID()
    const image = {
      id,
      name: 'sample.png',
      blob: new Blob(['image'], { type: 'image/png' }),
    }
    await saveCard(card({ answer: `![sample](asset:${id})` }), [image])
    await saveCard(card({ id: 'card-2', answer: `![same](asset:${id})` }))
    await deleteCard('card-1')
    expect(await db.assets.count()).toBe(1)
    await deleteDeck(deck.id)
    expect(await db.assets.count()).toBe(0)
    expect(await db.cards.count()).toBe(0)
  })
})

describe('Portable ZIP backups', () => {
  it('round-trips Markdown, images, independent schedules, and review history', async () => {
    await saveDeck(deck)
    const id = crypto.randomUUID()
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
    const c = card({ answer: `# Hello\n\n![Hello](asset:${id})` })
    await saveCard(c, [
      {
        id,
        name: 'greeting.png',
        blob: new Blob([bytes], { type: 'image/png' }),
      },
    ])
    await reviewCard({ card: c, direction: 'backward' }, 4)
    const backup = await readBackup(await createBackup())
    await deleteDeck(deck.id)
    await restoreBackup(backup)
    const restored = await db.cards.get(c.id)
    expect(restored?.answer).toEqual(c.answer)
    expect(restored?.backward.reps).toBe(1)
    expect(restored?.forward.reps).toBe(0)
    expect(await db.reviews.count()).toBe(1)
    expect(
      new Uint8Array(await (await db.assets.get(id))!.blob.arrayBuffer()),
    ).toEqual(bytes)
  })
  it('rejects unsupported versions and duplicate IDs before touching local data', async () => {
    await fixture()
    const { manifest } = await readBackup(await createBackup())
    await expect(
      readBackup(await zipManifest({ ...manifest, version: 2 })),
    ).rejects.toThrow('unsupported')
    await expect(
      readBackup(
        await zipManifest({
          ...manifest,
          cards: [manifest.cards[0], manifest.cards[0]],
        }),
      ),
    ).rejects.toThrow('duplicate')
    expect(await db.cards.count()).toBe(1)
  })
  it('rejects broken deck, history, and image references', async () => {
    await fixture()
    const { manifest } = await readBackup(await createBackup())
    await expect(
      readBackup(await zipManifest({ ...manifest, decks: [] })),
    ).rejects.toThrow('missing deck')
    await expect(
      readBackup(
        await zipManifest({
          ...manifest,
          cards: [
            {
              ...manifest.cards[0],
              answer: `![missing](asset:${crypto.randomUUID()})`,
            },
          ],
        }),
      ),
    ).rejects.toThrow('missing image')
    await expect(
      readBackup(
        await zipManifest({
          ...manifest,
          reviews: [
            {
              id: 'r',
              cardId: 'missing',
              deckId: deck.id,
              direction: 'forward',
              rating: 3,
              at: now,
            },
          ],
        }),
      ),
    ).rejects.toThrow('invalid card reference')
  })
  it('bounds decompression when an image claims to be smaller than it is', async () => {
    await fixture()
    const { manifest } = await readBackup(await createBackup())
    const id = crypto.randomUUID()
    const blob = await zipManifest(
      {
        ...manifest,
        assets: [{ id, name: 'oversize.png', type: 'image/png', size: 1 }],
      },
      { [`assets/${id}`]: new Uint8Array(200000) },
    )
    await expect(readBackup(blob)).rejects.toThrow('size limit')
    expect(await db.cards.count()).toBe(1)
  })
})
