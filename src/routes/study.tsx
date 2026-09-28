import { createFileRoute } from "@tanstack/react-router"
import { studySearchSchema } from "@/lib/search"
import { Study } from "@/pages/study"

export const Route = createFileRoute("/study")({
  component: Study,
  validateSearch: studySearchSchema,
  remountDeps: ({ search }) => search.deck,
})
