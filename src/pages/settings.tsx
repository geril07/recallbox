import { useEffect, useState } from "react"
import { Check, HardDrive, Info, Monitor, Moon, Sun } from "lucide-react"
import { useApp } from "@/lib/app-context"
import { themeOptions } from "@/lib/theme"
import { BackupSettings } from "@/components/backup-settings"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { notify, reportError } from "@/components/ui/toast"

export function Settings() {
  const { decks, cards, theme, setTheme } = useApp()
  const canPersist = typeof navigator.storage?.persist === "function"
  const [busy, setBusy] = useState(false)
  const [storage, setStorage] = useState<{
    usage?: number
    quota?: number
    persisted?: boolean
  }>({})
  useEffect(() => {
    void (async () => {
      try {
        const info = await navigator.storage?.estimate()
        const persisted = await navigator.storage?.persisted()
        setStorage({ ...info, persisted })
      } catch {
        /* Some private browsing modes do not expose storage estimates. */
      }
    })()
  }, [])
  async function keepData() {
    setBusy(true)
    try {
      const persisted = await navigator.storage?.persist()
      setStorage((s) => ({ ...s, persisted }))
      notify(
        persisted
          ? "Browser data retention enabled. Keep regular backups."
          : "Your browser did not grant this request. Export regular backups.",
      )
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="settings-page">
      <div className="page-heading">
        <h1>Settings & backup</h1>
      </div>
      <section className="settings-section">
        <div className="settings-section-label">
          <Monitor />
          <div>
            <h2>Appearance</h2>
          </div>
        </div>
        <Card className="settings-card">
          <div className="setting-row">
            <div>
              <h3>Color theme</h3>
              <p>System follows your device’s appearance.</p>
            </div>
            <div
              className="theme-options"
              role="group"
              aria-label="Color theme"
            >
              {themeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={theme === option.value ? "secondary" : "ghost"}
                  aria-pressed={theme === option.value}
                  onClick={() => setTheme(option.value)}
                >
                  {option.value === "system" ? (
                    <Monitor />
                  ) : option.value === "dark" ? (
                    <Moon />
                  ) : (
                    <Sun />
                  )}
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </section>
      <section className="settings-section">
        <div className="settings-section-label">
          <HardDrive />
          <div>
            <h2>Browser storage</h2>
          </div>
        </div>
        <Card className="settings-card">
          <div className="setting-row">
            <div>
              <h3>Saved in this browser</h3>
              <p>
                Other browsers, browser profiles, and site addresses have
                separate libraries. No account is needed.
              </p>
              <p>
                {decks.length} decks · {cards.length} cards
                {storage.usage !== undefined
                  ? ` · ${(storage.usage / 1024 / 1024).toFixed(1)} MB used by this site`
                  : ""}
              </p>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <h3>Keep browser data</h3>
              <p>
                {storage.persisted
                  ? "This browser has agreed not to automatically remove your library when storage is low. This is not a backup."
                  : canPersist
                    ? "Ask this browser not to automatically remove your library when storage is low. This is not a backup."
                    : "This browser does not support requests to keep site data. Export regular backups."}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={!canPersist || storage.persisted || busy}
              onClick={() => void keepData()}
            >
              {storage.persisted && <Check />}
              {storage.persisted ? "Enabled" : "Request"}
            </Button>
          </div>
          <div className="settings-info">
            <Info size={15} />
            <p>
              Clearing site data or losing this device can remove your library.
              Private browsing data may be deleted when you close the session.
              Keep a separate backup. Recallbox does not encrypt local data or
              backup files.
            </p>
          </div>
        </Card>
      </section>
      <BackupSettings />
      <details className="settings-about">
        <summary>About review scheduling</summary>
        <p>
          Recallbox uses FSRS to schedule reviews, with a 90% target retention.
          This is a scheduling target, not a guarantee of recall. Forward and
          reverse reviews have separate schedules.
        </p>
      </details>
    </div>
  )
}
