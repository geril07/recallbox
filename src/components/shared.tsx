import { Inbox, Loader2 } from "lucide-react"
import { deckIcons } from "@/components/deck-icons"
import type { ComponentProps, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Deck } from "@/lib/model"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog"

export function DeckIcon({
  deck,
  small = false,
}: {
  deck: Pick<Deck, "icon" | "color">
  small?: boolean
}) {
  const Icon = deckIcons[deck.icon]
  return (
    <span
      className={cn(
        "deck-icon",
        `color-${deck.color}`,
        small && "deck-icon-sm",
      )}
    >
      <Icon strokeWidth={1.65} />
    </span>
  )
}
export function IconButton({
  label,
  children,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={label} {...props} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  )
}
export function Loading() {
  return (
    <div className="flex min-h-60 items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Opening your library…
    </div>
  )
}
export function Confirm({
  title,
  description,
  onConfirm,
  onClose,
  busy = false,
  label = "Delete",
  destructive = true,
}: {
  title: string
  description: string
  onConfirm: () => void
  onClose: () => void
  busy?: boolean
  label?: string
  destructive?: boolean
}) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            loading={busy}
          >
            {label}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
