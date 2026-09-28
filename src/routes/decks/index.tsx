import { createFileRoute } from "@tanstack/react-router"
import { Decks } from "@/pages/library"

export const Route = createFileRoute("/decks/")({ component: Decks })
