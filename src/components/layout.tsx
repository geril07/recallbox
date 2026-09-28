import { useEffect, useMemo, useState } from "react"
import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import {
  BarChart3,
  House,
  Layers,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Sun,
  Tags,
  X,
} from "lucide-react"
import { useLibrary } from "@/lib/db"
import { AppContext } from "@/lib/app-context"
import { type Deck, type Flashcard } from "@/lib/model"
import { themeOptions, useTheme } from "@/lib/theme"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { DeckEditor, CardEditor } from "@/components/editors"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { IconButton, Loading } from "@/components/shared"
import { cn } from "@/lib/utils"

const navigation = [
  { to: "/", label: "Overview", icon: House },
  { to: "/decks", label: "My decks", icon: Layers },
  { to: "/tags", label: "Tags", icon: Tags },
  { to: "/activity", label: "Activity", icon: BarChart3 },
] as const
export function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true" />
      recallbox
    </span>
  )
}
function Navigation({
  decks,
  onClose,
  newDeck,
}: {
  decks: Deck[]
  onClose: () => void
  newDeck: () => void
}) {
  const path = useRouterState({ select: (s) => s.location.pathname })
  return (
    <>
      <Link
        to="/"
        className="brand-link"
        aria-label="Recallbox home"
        onClick={onClose}
      >
        <Logo />
      </Link>
      <nav className="main-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={cn(
              "nav-item",
              (path === item.to ||
                (item.to === "/decks" && path.startsWith("/decks/"))) &&
                "active",
            )}
          >
            <item.icon />
            <span>{item.label}</span>
            {item.to === "/decks" && (
              <span className="nav-count">{decks.length}</span>
            )}
          </Link>
        ))}
      </nav>
      <div className="nav-section-label flex items-center justify-between">
        YOUR DECKS
        <IconButton
          label="Create deck"
          size="icon-xs"
          onClick={() => {
            newDeck()
            onClose()
          }}
        >
          <Plus />
        </IconButton>
      </div>
      <nav className="deck-nav" aria-label="Deck shortcuts">
        {decks.slice(0, 5).map((deck) => (
          <Link
            to="/decks/$deckId"
            params={{ deckId: deck.id }}
            key={deck.id}
            onClick={onClose}
            className="deck-nav-item"
          >
            <span className={`deck-dot color-${deck.color}`} />
            <span>{deck.name}</span>
          </Link>
        ))}
        {!decks.length && (
          <p className="px-3 text-xs text-muted-foreground">No decks yet</p>
        )}
      </nav>
      <div className="sidebar-bottom">
        <Link
          to="/settings"
          onClick={onClose}
          className={cn("nav-item", path === "/settings" && "active")}
        >
          <Settings2 />
          <span>Settings & backup</span>
        </Link>
      </div>
    </>
  )
}
export function Layout() {
  const library = useLibrary()
  const [deckEditor, setDeckEditor] = useState<{ deck?: Deck } | null>(null)
  const [cardEditor, setCardEditor] = useState<{
    card?: Flashcard
    deckId?: string
  } | null>(null)
  const [mobile, setMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [clock, setClock] = useState(Date.now)
  const now = Math.max(clock, library?.loadedAt ?? clock)
  const { theme, setTheme } = useTheme()
  const path = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  const appValue = useMemo(
    () =>
      library && {
        ...library,
        now,
        editDeck: (deck?: Deck) => setDeckEditor({ deck }),
        editCard: (card?: Flashcard, deckId?: string) =>
          setCardEditor({ card, deckId }),
        theme,
        setTheme,
      },
    [library, now, theme, setTheme],
  )
  if (!library || !appValue) return <Loading />
  const title = path.startsWith("/decks/")
    ? "My decks"
    : path === "/study"
      ? "Review session"
      : path === "/settings"
        ? "Settings & backup"
        : navigation.find((n) => n.to === path)?.label || "Overview"
  const navProps = {
    decks: library.decks,
    newDeck: () => setDeckEditor({}),
    onClose: () => setMobile(false),
  }
  return (
    <AppContext.Provider value={appValue}>
      <div className="app-shell" data-sidebar-open={sidebarOpen}>
        <aside
          id="desktop-sidebar"
          className="sidebar"
          aria-label="Main sidebar"
          aria-hidden={!sidebarOpen}
          inert={!sidebarOpen}
        >
          <div className="sidebar-content">
            <Navigation {...navProps} />
          </div>
        </aside>
        <div className={cn("app-main", path === "/study" && "study-layout")}>
          <header className="topbar">
            <div className="flex min-w-0 items-center gap-3">
              <IconButton
                label="Open navigation"
                className="lg:hidden"
                onClick={() => setMobile(true)}
              >
                <Menu />
              </IconButton>
              <IconButton
                label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                className="hidden lg:inline-flex"
                aria-expanded={sidebarOpen}
                aria-controls="desktop-sidebar"
                onClick={() => setSidebarOpen((open) => !open)}
              >
                {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
              </IconButton>
              <span className="topbar-title">{title}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Color theme"
                  />
                }
              >
                {theme === "system" ? (
                  <Monitor />
                ) : theme === "dark" ? (
                  <Moon />
                ) : (
                  <Sun />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={setTheme}
                  aria-label="Color theme"
                >
                  {themeOptions.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main
            id="main-content"
            className={cn("page-content", path === "/study" && "study-content")}
          >
            <Outlet />
          </main>
        </div>
      </div>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent
          side="left"
          className="mobile-nav-dialog"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Main navigation and deck shortcuts
          </SheetDescription>
          <IconButton
            className="absolute right-3 top-4"
            label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X />
          </IconButton>
          <Navigation {...navProps} />
        </SheetContent>
      </Sheet>
      {deckEditor && (
        <DeckEditor
          deck={deckEditor.deck}
          onClose={() => setDeckEditor(null)}
        />
      )}
      {cardEditor &&
        (library.decks.length ? (
          <CardEditor
            {...cardEditor}
            decks={library.decks}
            onClose={() => setCardEditor(null)}
          />
        ) : (
          <Dialog open onOpenChange={() => setCardEditor(null)}>
            <DialogContent>
              <DialogTitle>Create a deck first</DialogTitle>
              <DialogDescription>
                Cards need a home in your library.
              </DialogDescription>
              <Button
                onClick={() => {
                  setCardEditor(null)
                  setDeckEditor({})
                }}
              >
                <Plus />
                Create deck
              </Button>
            </DialogContent>
          </Dialog>
        ))}
    </AppContext.Provider>
  )
}
