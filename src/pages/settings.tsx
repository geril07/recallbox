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
  ShieldCheck,
  Sun,
  Unplug,
} from "lucide-react"
import { useApp } from "@/lib/app-context"
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
  const { decks, cards, theme, toggleTheme } = useApp()
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
        <div>
          <div className="eyebrow">ALWAYS YOURS</div>
          <h1>
            A space that feels like you<span className="text-primary">.</span>
          </h1>
          <p>Your preferences, your data, your peace of mind.</p>
        </div>
      </div>
      <section className="settings-section">
        <div className="settings-section-label">
          <Monitor />
          <div>
            <h2>Appearance</h2>
            <p>A little easier on the eyes.</p>
          </div>
        </div>
        <Card className="settings-card">
          <div className="setting-row">
            <div>
              <h3>Color theme</h3>
              <p>Choose the light that suits you.</p>
            </div>
            <div className="theme-options">
              <Button
                variant={theme === "light" ? "secondary" : "ghost"}
                onClick={() => {
                  if (theme !== "light") toggleTheme()
                }}
              >
                <Sun />
                Light{theme === "light" && <Check className="size-3" />}
              </Button>
              <Button
                variant={theme === "dark" ? "secondary" : "ghost"}
                onClick={() => {
                  if (theme !== "dark") toggleTheme()
                }}
              >
                <Moon />
                Dark{theme === "dark" && <Check className="size-3" />}
              </Button>
            </div>
          </div>
        </Card>
      </section>
      <section className="settings-section">
        <div className="settings-section-label">
          <HardDrive />
          <div>
            <h2>On this device</h2>
            <p>Local first. No account needed.</p>
          </div>
        </div>
        <Card className="settings-card">
          <div className="setting-row">
            <div>
              <h3>
                Your library is stored locally
                <Badge variant="secondary">IndexedDB</Badge>
              </h3>
              <p>
                {decks.length} decks · {cards.length} cards
                {storage.usage !== undefined
                  ? ` · ${(storage.usage / 1024 / 1024).toFixed(1)} MB used by this site`
                  : ""}
              </p>
            </div>
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <div className="setting-row">
            <div>
              <h3>
                {storage.persisted
                  ? "Persistent storage enabled"
                  : "Protect local storage"}
              </h3>
              <p>
                {storage.persisted
                  ? "Your browser will not automatically evict this site’s data."
                  : "Ask your browser to keep Recallbox data on this device."}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={storage.persisted || !!busy}
              onClick={() =>
                run("persist", async () => {
                  const persisted = await navigator.storage?.persist()
                  setStorage((s) => ({ ...s, persisted }))
                  notify(
                    persisted
                      ? "Persistent storage enabled"
                      : "Your browser did not grant persistent storage. Keep regular backups.",
                  )
                })
              }
            >
              {storage.persisted ? <Check /> : <ShieldCheck />}
              {storage.persisted ? "Protected" : "Protect"}
            </Button>
          </div>
          <div className="settings-info">
            <ShieldCheck size={15} />
            <p>
              Clearing site data or losing this device removes your library.
              Keep a backup somewhere safe. Local data is not encrypted by
              Recallbox.
            </p>
          </div>
        </Card>
      </section>
      <section className="settings-section">
        <div className="settings-section-label">
          <ArrowDownToLine />
          <div>
            <h2>Take your knowledge with you</h2>
            <p>One ZIP. Your entire library.</p>
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
                Replaces this device’s library after you confirm. Up to 100 MB.
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
            <h2>A second home on Google Drive</h2>
            <p>A visible folder. Fully in your control.</p>
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
                <p>Saved to My Drive / Recallbox. Never hidden app storage.</p>
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
                Google Drive setup is needed for this installation. Set{" "}
                <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env.local</code>.
                See <code>README.md</code> for the Google Cloud steps. ZIP
                backups work without it.
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
                  No backups here yet. Your first one is a click away.
                </p>
              )}
            </>
          )}
        </Card>
      </section>
      <div className="settings-about">
        <span>
          recallbox<span className="text-primary">.</span>
        </span>
        <p>Built for a curious mind. Designed to stay yours.</p>
        <small>
          FSRS · 90% target retention · Independent forward & reverse schedules
        </small>
      </div>
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
