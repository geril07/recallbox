import { Dexie, type EntityTable } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  cardSchema,
  deckSchema,
  emptySchedule,
  gradeCard,
  referencedAssetIds,
  type Asset,
  type Deck,
  type Flashcard,
  type Grade,
  type QueueItem,
  type Review,
  type Setting,
} from './model'

export const db = new Dexie('recallbox') as Dexie & {
  decks: EntityTable<Deck, 'id'>
  cards: EntityTable<Flashcard, 'id'>
  reviews: EntityTable<Review, 'id'>
  assets: EntityTable<Asset, 'id'>
  settings: EntityTable<Setting, 'key'>
}
db.version(1).stores({
  decks: 'id, createdAt',
  cards: 'id, deckId, *tags',
  reviews: 'id, cardId, deckId, at',
  assets: 'id',
  settings: 'key',
})

const starters: {
  deck: Omit<Deck, 'id' | 'createdAt'>
  cards: [string, string, string, boolean?][]
}[] = [
  {
    deck: {
      name: 'Everyday Spanish',
      description: 'Small conversations. A whole new world.',
      color: 'sage',
      icon: 'languages',
      tags: ['languages', 'spanish'],
    },
    cards: [
      [
        'Buenos días',
        '**Good morning**\n\nA greeting used from early morning until noon.\n\n> ¡Buenos días! ¿Cómo estás?',
        'greetings',
        true,
      ],
      [
        'Gracias',
        '**Thank you**\n\nUse *muchas gracias* for “thank you very much.”',
        'essentials',
        true,
      ],
      [
        '¿Cuánto cuesta?',
        '**How much does it cost?**\n\nUseful at a market, café, or shop.',
        'travel',
        true,
      ],
      [
        'Hasta luego',
        '**See you later**\n\nA friendly, everyday goodbye.',
        'greetings',
        true,
      ],
    ],
  },
  {
    deck: {
      name: 'Design essentials',
      description: 'The principles behind thoughtful interfaces.',
      color: 'violet',
      icon: 'sparkles',
      tags: ['design', 'learning'],
    },
    cards: [
      [
        'What is the law of proximity?',
        'Elements **close to each other** are perceived as a group.\n\nUse spacing to show relationships before adding borders or boxes.',
        'principles',
      ],
      [
        'What does a clear visual hierarchy do?',
        'It guides attention in order of importance using:\n\n- **Scale**\n- Contrast\n- Spacing\n- Position',
        'principles',
      ],
      [
        'What is an affordance?',
        'A property of an object that suggests **how it can be used**.\n\nA handle affords pulling; a button affords pressing.',
        'ux',
      ],
      [
        'What is progressive disclosure?',
        'Show only what is needed now. Reveal more advanced options when they become relevant.',
        'ux',
      ],
    ],
  },
  {
    deck: {
      name: 'The curious mind',
      description: 'A few things worth knowing about our world.',
      color: 'peach',
      icon: 'globe',
      tags: ['science', 'learning'],
    },
    cards: [
      [
        'Why is the sky blue?',
        'Air molecules scatter shorter **blue wavelengths** of sunlight more strongly than longer red wavelengths. This is called **Rayleigh scattering**.',
        'science',
      ],
      [
        'What is the spacing effect?',
        'Learning is retained better when practice is **spread over time**, rather than concentrated in one session.',
        'psychology',
      ],
      [
        'What is an astronomical unit?',
        'The average Earth–Sun distance: approximately **149.6 million kilometres**.',
        'space',
      ],
    ],
  },
  {
    deck: {
      name: 'Modern JavaScript',
      description: 'Build a stronger mental model, one card at a time.',
      color: 'blue',
      icon: 'code',
      tags: ['development'],
    },
    cards: [
      [
        'What is a closure?',
        'A function combined with references to its surrounding **lexical environment**.\n\n```js\nfunction counter() {\n  let count = 0;\n  return () => ++count;\n}\n```',
        'fundamentals',
      ],
      [
        'What does Promise.all do?',
        'Runs promises concurrently and resolves with an array of results **in input order**. Rejects when any input promise rejects.',
        'async',
      ],
      [
        'How do const and let differ?',
        '| Declaration | Reassignment | Scope |\n| --- | --- | --- |\n| `const` | No | Block |\n| `let` | Yes | Block |\n\n`const` does **not** make an object immutable.',
        'fundamentals',
      ],
    ],
  },
]

db.on('populate', async (tx) => {
  const now = Date.now()
  for (const sample of starters) {
    const deck = {
      ...sample.deck,
      id: crypto.randomUUID(),
      createdAt: now + starters.indexOf(sample),
    }
    await tx.table('decks').add(deck)
    for (const [prompt, answer, tag, reverse] of sample.cards) {
      await tx.table('cards').add({
        id: crypto.randomUUID(),
        deckId: deck.id,
        prompt,
        answer,
        tags: [tag],
        reverse: !!reverse,
        reversePrompt: reverse ? answer.split('**')[1] : '',
        forward: emptySchedule(now),
        backward: emptySchedule(now),
        createdAt: now,
        updatedAt: now,
      })
    }
  }
  await tx.table('settings').add({ key: 'starterNotice', value: 'true' })
})

export function useLibrary() {
  return useLiveQuery(async () => {
    const [decks, cards, reviews] = await Promise.all([
      db.decks.toArray(),
      db.cards.toArray(),
      db.reviews.toArray(),
    ])
    return {
      decks: decks.sort((a, b) => a.createdAt - b.createdAt),
      cards,
      reviews,
      loadedAt: Date.now(),
    }
  })
}
async function removeUnusedAssets() {
  const referenced = referencedAssetIds(await db.cards.toArray())
  const ids = await db.assets.toCollection().primaryKeys()
  await db.assets.bulkDelete(ids.filter((id) => !referenced.has(id)))
}
export async function saveDeck(deck: Deck) {
  await db.decks.put(deckSchema.parse(deck))
}
export async function saveCard(card: Flashcard, assets: Asset[] = []) {
  const parsed = cardSchema.parse(card)
  await db.transaction(
    'rw',
    db.cards,
    db.decks,
    db.assets,
    db.reviews,
    async () => {
      if (!(await db.decks.get(parsed.deckId)))
        throw new Error('This deck no longer exists.')
      const existing = await db.cards.get(parsed.id)
      if (assets.length) await db.assets.bulkPut(assets)
      await db.cards.put(
        existing
          ? {
              ...parsed,
              forward: existing.forward,
              backward: existing.backward,
              createdAt: existing.createdAt,
            }
          : parsed,
      )
      await db.reviews
        .where('cardId')
        .equals(parsed.id)
        .modify({ deckId: parsed.deckId })
      await removeUnusedAssets()
    },
  )
}
export async function deleteDeck(id: string) {
  await db.transaction(
    'rw',
    db.decks,
    db.cards,
    db.reviews,
    db.assets,
    async () => {
      await db.cards.where('deckId').equals(id).delete()
      await db.reviews.where('deckId').equals(id).delete()
      await db.decks.delete(id)
      await removeUnusedAssets()
    },
  )
}
export async function deleteCard(id: string) {
  await db.transaction('rw', db.cards, db.reviews, db.assets, async () => {
    await db.cards.delete(id)
    await db.reviews.where('cardId').equals(id).delete()
    await removeUnusedAssets()
  })
}
export async function reviewCard(item: QueueItem, rating: Grade) {
  await db.transaction('rw', db.cards, db.reviews, async () => {
    const card = await db.cards.get(item.card.id)
    if (
      !card ||
      (item.direction === 'backward' && !card.reverse) ||
      card.prompt !== item.card.prompt ||
      card.answer !== item.card.answer ||
      card.reversePrompt !== item.card.reversePrompt ||
      card.deckId !== item.card.deckId
    )
      throw new Error('This card changed. Please start a new session.')
    const current = card[item.direction]
    const expected = item.card[item.direction]
    if (
      current.reps !== expected.reps ||
      current.last_review !== expected.last_review
    )
      throw new Error(
        'This card was reviewed in another tab. Please start a new session.',
      )
    const now = Date.now()
    await db.cards.put({
      ...card,
      [item.direction]: gradeCard(current, rating, now),
      updatedAt: now,
    })
    await db.reviews.add({
      id: crypto.randomUUID(),
      cardId: card.id,
      deckId: card.deckId,
      direction: item.direction,
      rating,
      at: now,
    })
  })
}
export async function setSetting(key: string, value: string) {
  await db.settings.put({ key, value })
}
