import { createFileRoute } from "@tanstack/react-router"
import { TagsPage } from "@/pages/library"

export const Route = createFileRoute("/tags")({ component: TagsPage })
