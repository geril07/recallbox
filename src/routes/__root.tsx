import { createRootRoute, Link } from "@tanstack/react-router"
import { Layout } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared"

export const Route = createRootRoute({
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
