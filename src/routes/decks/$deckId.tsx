import { createFileRoute } from "@tanstack/react-router"
import { DeckDetail } from "@/pages/library"

export const Route = createFileRoute("/decks/$deckId")({
  component: DeckDetail,
  remountDeps: ({ params }) => params.deckId,
})
