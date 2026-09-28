import { useEffect, useRef, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Cloud,
  ExternalLink,
  HardDrive,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Info,
  Sun,
  Unplug,
} from "lucide-react"
import { useApp } from "@/lib/app-context"
import { themeOptions } from "@/lib/theme"
import { db, setSetting } from "@/lib/db"
import {
  backupName,
  createBackup,
  downloadBlob,
  readBackup,
  restoreBackup,
  type Backup,
} from "@/lib/backup"
import {
  connectDrive,
  disconnectDrive,
  downloadDriveBackup,
  driveClientId,
  listDriveBackups,
  loadGoogleIdentity,
  uploadDriveBackup,
  type DriveFile,
} from "@/lib/drive"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Confirm, IconButton } from "@/components/shared"
import { notify, reportError } from "@/components/ui/toast"

async function exportZip() {
  const blob = await createBackup()
  downloadBlob(blob, backupName())
  await setSetting("lastBackup", new Date().toISOString())
  notify("Backup prepared for download")
}

export function Settings() {
  const { decks, cards, theme, setTheme } = useApp()
  const canPersist = typeof navigator.storage?.persist === "function"
  const [busy, setBusy] = useState("")
  const [backup, setBackup] = useState<Backup | null>(null)
  const [googleReady, setGoogleReady] = useState(false)
  const [googleError, setGoogleError] = useState(false)
  const [connected, setConnected] = useState(false)
  const [drive, setDrive] = useState<{
    folderId: string
    files: DriveFile[]
  } | null>(null)
  const [storage, setStorage] = useState<{
    usage?: number
    quota?: number
    persisted?: boolean
  }>({})
  const input = useRef<HTMLInputElement>(null)
  const lastBackup = useLiveQuery(() => db.settings.get("lastBackup"))
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
  function loadGoogle() {
    setGoogleError(false)
    loadGoogleIdentity()
      .then(() => setGoogleReady(true))
      .catch(() => setGoogleError(true))
  }
  useEffect(() => {
    if (driveClientId)
      loadGoogleIdentity()
        .then(() => setGoogleReady(true))
        .catch(() => setGoogleError(true))
  }, [])
  async function run(name: string, action: () => Promise<void>) {
    if (busy) return
    setBusy(name)
    try {
      await action()
    } catch (error) {
      reportError(error)
    } finally {
      setBusy("")
    }
  }
  async function restore() {
    if (!backup) return
    await run("restore", async () => {
      await restoreBackup(backup)
      setBackup(null)
      notify("Library restored, including images and progress")
    })
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
              disabled={!canPersist || storage.persisted || !!busy}
              onClick={() =>
                run("persist", async () => {
                  const persisted = await navigator.storage?.persist()
                  setStorage((s) => ({ ...s, persisted }))
                  notify(
                    persisted
                      ? "Browser data retention enabled. Keep regular backups."
                      : "Your browser did not grant this request. Export regular backups.",
                  )
                })
              }
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
      <section className="settings-section">
        <div className="settings-section-label">
          <ArrowDownToLine />
          <div>
            <h2>Backup files</h2>
          </div>
        </div>
        <Card className="settings-card">
          <div className="setting-row">
            <div>
              <h3>Export a backup</h3>
              <p>Decks, cards, review history, and uploaded images.</p>
              {lastBackup && (
                <small className="text-muted-foreground">
                  Last export: {new Date(lastBackup.value).toLocaleString()}
                </small>
              )}
            </div>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => run("export", exportZip)}
            >
              {busy === "export" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowDownToLine />
              )}
              Export ZIP
            </Button>
          </div>
          <div className="setting-row">
            <div>
              <h3>Restore from a backup</h3>
              <p>
                Replaces this browser’s library after you confirm. Up to 100 MB.
              </p>
            </div>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => input.current?.click()}
            >
              {busy === "import" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowUpFromLine />
              )}
              Import ZIP
            </Button>
          </div>
          <input
            ref={input}
            className="hidden"
            type="file"
            accept=".zip,application/zip"
            aria-label="Import backup file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (file)
                void run("import", async () =>
                  setBackup(await readBackup(file)),
                )
            }}
          />
        </Card>
      </section>
      <section className="settings-section">
        <div className="settings-section-label">
          <Cloud />
          <div>
            <h2>Google Drive backup</h2>
          </div>
        </div>
        <Card className="settings-card">
          <div className="setting-row">
            <div className="flex items-center gap-3">
              <span className="drive-icon">
                <svg viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#34a853" d="M16 5h16L11 41 3 27Z" />
                  <path
                    fill="#fbbc04"
                    d="M16 5h16l21 36H37Z"
                    transform="translate(-5 0)"
                  />
                  <path fill="#4285f4" d="M11 29h31l-7 12H4Z" />
                </svg>
              </span>
              <div>
                <h3>
                  Google Drive
                  {connected && <Badge variant="secondary">Connected</Badge>}
                </h3>
                <p>
                  Manual backups to My Drive / Recallbox. No automatic sync.
                </p>
              </div>
            </div>
            {connected ? (
              <IconButton
                label="Disconnect Google Drive"
                onClick={() => {
                  disconnectDrive()
                  setConnected(false)
                  setDrive(null)
                  notify("Google Drive disconnected")
                }}
                disabled={!!busy}
              >
                <Unplug />
              </IconButton>
            ) : (
              <Button
                variant="outline"
                disabled={!googleReady || !!busy}
                onClick={() =>
                  run("connect", async () => {
                    await connectDrive()
                    setConnected(true)
                    setDrive(await listDriveBackups())
                    notify("Google Drive connected")
                  })
                }
              >
                {busy === "connect" && <Loader2 className="animate-spin" />}
                Connect Drive
              </Button>
            )}
          </div>
          {!driveClientId && (
            <div className="settings-info">
              <Cloud size={15} />
              <p>
                Google Drive is not configured for this installation. You can
                still export and import backup files.
              </p>
            </div>
          )}
          {googleError && (
            <div className="settings-info">
              <p>Google sign-in could not load. Check your connection.</p>
              <Button variant="outline" size="sm" onClick={loadGoogle}>
                Retry
              </Button>
            </div>
          )}
          {connected && (
            <>
              <div className="setting-row">
                <div>
                  <h3>Manual backups</h3>
                  <p>
                    Upload a new timestamped ZIP when you choose. No automatic
                    sync.
                  </p>
                </div>
                <Button
                  disabled={!!busy}
                  onClick={() =>
                    run("upload", async () => {
                      await uploadDriveBackup()
                      setDrive(await listDriveBackups())
                      notify("Backup saved to Google Drive")
                    })
                  }
                >
                  {busy === "upload" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Cloud />
                  )}
                  Back up now
                </Button>
              </div>
              <div className="drive-files-header">
                <span>
                  RECENT BACKUPS <small>(up to 100)</small>
                </span>
                <div className="flex gap-1">
                  <IconButton
                    label="Reconnect Google Drive"
                    onClick={() =>
                      run("reconnect", async () => {
                        await connectDrive()
                        setDrive(await listDriveBackups())
                      })
                    }
                    disabled={!!busy}
                  >
                    <Unplug />
                  </IconButton>
                  <IconButton
                    label="Refresh backups"
                    onClick={() =>
                      run("refresh", async () =>
                        setDrive(await listDriveBackups()),
                      )
                    }
                    disabled={!!busy}
                  >
                    <RefreshCw />
                  </IconButton>
                  {drive && (
                    <IconButton
                      label="Open Recallbox folder in Google Drive"
                      nativeButton={false}
                      render={
                        <a
                          href={`https://drive.google.com/drive/folders/${drive.folderId}`}
                          aria-label="Open Recallbox folder in Google Drive"
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <ExternalLink />
                    </IconButton>
                  )}
                </div>
              </div>
              {drive?.files.length ? (
                drive.files.map((file) => (
                  <div key={file.id} className="drive-file">
                    <span className="min-w-0">
                      <strong>{file.name}</strong>
                      <small>
                        {file.createdTime &&
                          new Date(file.createdTime).toLocaleString()}
                      </small>
                    </span>
                    <IconButton
                      label={`Restore ${file.name}`}
                      disabled={!!busy}
                      onClick={() =>
                        run("download", async () =>
                          setBackup(
                            await readBackup(await downloadDriveBackup(file)),
                          ),
                        )
                      }
                    >
                      <ArrowDownToLine />
                    </IconButton>
                  </div>
                ))
              ) : (
                <p className="p-5 text-sm text-muted-foreground">
                  No Google Drive backups yet.
                </p>
              )}
            </>
          )}
        </Card>
      </section>
      <details className="settings-about">
        <summary>About review scheduling</summary>
        <p>
          Recallbox uses FSRS to schedule reviews, with a 90% target retention.
          This is a scheduling target, not a guarantee of recall. Forward and
          reverse reviews have separate schedules.
        </p>
      </details>
      {backup && (
        <Confirm
          title="Replace your local library?"
          description={`This backup contains ${backup.manifest.decks.length} decks, ${backup.manifest.cards.length} cards, and ${backup.assets.length} images. Your current library will be replaced, not merged. Export it first if you want to keep it.`}
          label="Restore backup"
          busy={busy === "restore"}
          onConfirm={restore}
          onClose={() => setBackup(null)}
        />
      )}
    </div>
  )
}
