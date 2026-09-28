import { createContext, useContext } from "react"
import type { Deck, Flashcard, Review } from "@/lib/model"
export interface AppState {
  decks: Deck[]
  cards: Flashcard[]
  reviews: Review[]
  now: number
  editDeck: (deck?: Deck) => void
  editCard: (card?: Flashcard, deckId?: string) => void
  theme: "light" | "dark"
  toggleTheme: () => void
}
export const AppContext = createContext<AppState | null>(null)
export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error("Recallbox context is missing")
  return context
}
