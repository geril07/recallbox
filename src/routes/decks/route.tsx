import { createFileRoute } from "@tanstack/react-router"
import { decksSearchSchema } from "@/lib/search"

export const Route = createFileRoute("/decks")({
  validateSearch: decksSearchSchema,
})
