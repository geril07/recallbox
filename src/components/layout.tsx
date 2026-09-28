import { useEffect, useMemo, useState } from "react"
import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  ChevronRight,
  Cloud,
  House,
  Layers,
  Leaf,
  Menu,
  Moon,
  Plus,
  Settings2,
  ShieldCheck,
  Sun,
  Tags,
  X,
} from "lucide-react"
import { useLibrary } from "@/lib/db"
import { AppContext } from "@/lib/app-context"
import { queueFor, type Deck, type Flashcard } from "@/lib/model"
import { DeckEditor, CardEditor } from "@/components/editors"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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
      <span className="brand-symbol">
        <Layers size={21} strokeWidth={1.7} />
      </span>
      recallbox<span className="brand-dot">.</span>
    </span>
  )
}
function Navigation({
  decks,
  due,
  onClose,
  newDeck,
}: {
  decks: Deck[]
  due: number
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
      <div className="workspace-label">
        <span className="workspace-avatar">Y</span>
        <span>
          Your workspace<small>Personal library</small>
        </span>
        <ShieldCheck className="ml-auto size-4 text-muted-foreground" />
      </div>
      <div className="nav-section-label">WORKSPACE</div>
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
          <p className="px-3 text-xs text-muted-foreground">
            Your next chapter starts here.
          </p>
        )}
      </nav>
      <div className="sidebar-bottom">
        <div className="local-note">
          <span className="local-note-icon">
            <Leaf size={17} />
          </span>
          <strong>A little, every day.</strong>
          <p>
            {due
              ? `${due} reviews are ready when you are.`
              : "Make room for something new."}
          </p>
          <Link to="/study" search={{ deck: undefined }}>
            Let’s make it stick <ArrowUpRight size={14} />
          </Link>
        </div>
        <Link
          to="/settings"
          onClick={onClose}
          className={cn("nav-item", path === "/settings" && "active")}
        >
          <Settings2 />
          <span>Settings & backup</span>
        </Link>
        <div className="sidebar-status">
          <span className="status-dot" />
          Local-first. Always yours.
          <ShieldCheck size={13} />
        </div>
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
  const [clock, setClock] = useState(Date.now)
  const now = Math.max(clock, library?.loadedAt ?? clock)
  const [online, setOnline] = useState(navigator.onLine)
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("recallbox-theme") === "dark" ? "dark" : "light",
  )
  const path = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("recallbox-theme", theme)
  }, [theme])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
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
        toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")),
      },
    [library, now, theme],
  )
  if (!library || !appValue) return <Loading />
  const title = path.startsWith("/decks/")
    ? "My decks"
    : path === "/study"
      ? "Review session"
      : path === "/settings"
        ? "Settings & backup"
        : navigation.find((n) => n.to === path)?.label || "Overview"
  const due = queueFor(library.cards, now).length
  const navProps = {
    decks: library.decks,
    due,
    newDeck: () => setDeckEditor({}),
    onClose: () => setMobile(false),
  }
  return (
    <AppContext.Provider value={appValue}>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Workspace sidebar">
          <Navigation {...navProps} />
        </aside>
        <div className="app-main">
          <header className="topbar">
            <div className="flex min-w-0 items-center gap-3">
              <IconButton
                label="Open navigation"
                className="lg:hidden"
                onClick={() => setMobile(true)}
              >
                <Menu />
              </IconButton>
              <BookOpen className="hidden size-4 text-muted-foreground sm:block" />
              <span className="breadcrumb-workspace">Workspace</span>
              <ChevronRight className="hidden size-3 text-muted-foreground sm:block" />
              <span className="topbar-title">{title}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="local-pill">
                <span className="status-dot" />
                {online ? "Stored on this device" : "Offline · ready to learn"}
              </span>
              <span className="h-4 border-r" />
              <IconButton
                label={
                  theme === "light"
                    ? "Switch to dark theme"
                    : "Switch to light theme"
                }
                onClick={() =>
                  setTheme((t) => (t === "light" ? "dark" : "light"))
                }
              >
                {theme === "light" ? <Moon /> : <Sun />}
              </IconButton>
              <Link
                to="/settings"
                className="profile-avatar"
                aria-label="Workspace settings"
              >
                Y
              </Link>
            </div>
          </header>
          <main
            id="main-content"
            className={cn("page-content", path === "/study" && "study-content")}
          >
            <Outlet />
          </main>
          <footer className="app-footer">
            <span>
              <ShieldCheck size={12} />
              Your knowledge. Your device. Your pace.
            </span>
            <Link to="/settings">
              <Cloud size={13} />
              Back up your library
              <ArrowUpRight size={12} />
            </Link>
          </footer>
        </div>
      </div>
      <Dialog open={mobile} onOpenChange={setMobile}>
        <DialogContent className="mobile-nav-dialog" showCloseButton={false}>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Workspace navigation and deck shortcuts
          </DialogDescription>
          <IconButton
            className="absolute right-3 top-4"
            label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X />
          </IconButton>
          <Navigation {...navProps} />
        </DialogContent>
      </Dialog>
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
