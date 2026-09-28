import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
} from "@tanstack/react-router"
import { Layout } from "@/components/layout"
import { Overview } from "@/pages/overview"
const Decks = lazyRouteComponent(() => import("@/pages/library"), "Decks")
const DeckDetail = lazyRouteComponent(
  () => import("@/pages/library"),
  "DeckDetail",
)
const TagsPage = lazyRouteComponent(() => import("@/pages/library"), "TagsPage")
const Activity = lazyRouteComponent(
  () => import("@/pages/activity"),
  "Activity",
)
const Study = lazyRouteComponent(() => import("@/pages/study"), "Study")
const Settings = lazyRouteComponent(
  () => import("@/pages/settings"),
  "Settings",
)
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared"

const rootRoute = createRootRoute({
  component: Layout,
  notFoundComponent: () => (
    <EmptyState
      title="A page yet to be discovered"
      description="This page does not exist."
    >
      <Button nativeButton={false} render={<Link to="/" />}>
        Back to overview
      </Button>
    </EmptyState>
  ),
  errorComponent: ({ error }) => (
    <div className="p-10">
      <EmptyState
        title="Your library could not be opened"
        description={
          error instanceof Error
            ? error.message
            : "Please check that browser storage is available."
        }
      >
        <Button onClick={() => location.reload()}>Try again</Button>
      </EmptyState>
    </div>
  ),
})
const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Overview,
})
const decksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/decks",
  component: Decks,
  validateSearch: (search: Record<string, unknown>): { tag?: string } => ({
    tag: typeof search.tag === "string" ? search.tag : undefined,
  }),
})
const deckRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/decks/$deckId",
  component: DeckDetail,
  remountDeps: ({ params }) => params.deckId,
})
const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tags",
  component: TagsPage,
})
const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity",
  component: Activity,
})
const studyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/study",
  component: Study,
  validateSearch: (search: Record<string, unknown>): { deck?: string } => ({
    deck: typeof search.deck === "string" ? search.deck : undefined,
  }),
  remountDeps: ({ search }) => search.deck,
})
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Settings,
})
export const router = createRouter({
  routeTree: rootRoute.addChildren([
    overviewRoute,
    decksRoute,
    deckRoute,
    tagsRoute,
    activityRoute,
    studyRoute,
    settingsRoute,
  ]),
  scrollRestoration: true,
})
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
