import { useEffect, useRef, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowDownToLine, Cloud, Loader2, RefreshCw } from "lucide-react"
import { db, setSetting } from "@/lib/db"
import { useApp } from "@/lib/app-context"
import {
  backupName,
  createBackup,
  downloadBlob,
  readBackup,
  restoreBackup,
  type Backup,
} from "@/lib/backup"
import {
  chooseDriveBackup,
  connectDrive,
  disconnectDrive,
  downloadDriveBackup,
  driveClientId,
  drivePickerConfigured,
  DriveSessionExpired,
  hasDriveSession,
  listDriveBackups,
  loadGoogleIdentity,
  uploadDriveBackup,
  type DriveFile,
} from "@/lib/drive"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { notify } from "@/components/ui/toast"

type Selection = { backup: Backup; name: string; source: string }
type Failure = {
  message: string
  reconnect: boolean
  retry: () => Promise<void>
}

async function downloadCurrent() {
  const name = backupName()
  downloadBlob(await createBackup(), name)
  await setSetting("lastBackup", new Date().toISOString())
  notify(`Download prepared: ${name}`)
}

export function BackupSettings() {
  const { decks, cards } = useApp()
  const [busy, setBusy] = useState("")
  const busyRef = useRef(false)
  const pickerAbort = useRef<AbortController | null>(null)
  useEffect(() => () => pickerAbort.current?.abort(), [])
  const [failure, setFailure] = useState<Failure | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [driveOpen, setDriveOpen] = useState(false)
  const [drive, setDrive] = useState<Awaited<
    ReturnType<typeof listDriveBackups>
  > | null>(null)
  const [connected, setConnected] = useState(hasDriveSession)
  const [googleReady, setGoogleReady] = useState(false)
  const [googleError, setGoogleError] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const lastBackup = useLiveQuery(() => db.settings.get("lastBackup"))
  const lastDriveBackup = useLiveQuery(() => db.settings.get("lastDriveBackup"))

  function loadGoogle() {
    setGoogleError(false)
    void loadGoogleIdentity()
      .then(() => setGoogleReady(true))
      .catch(() => setGoogleError(true))
  }
  useEffect(() => {
    if (driveClientId)
      void loadGoogleIdentity()
        .then(() => setGoogleReady(true))
        .catch(() => setGoogleError(true))
  }, [])

  async function run(label: string, action: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(label)
    setFailure(null)
    try {
      await action()
    } catch (error) {
      const reconnect = error instanceof DriveSessionExpired
      if (reconnect) setConnected(false)
      setFailure({
        message:
          error instanceof Error
            ? error.message
            : "The operation failed. Please retry.",
        reconnect,
        retry: async () => {
          if (reconnect) {
            await connectDrive()
            setConnected(true)
          }
          await action()
        },
      })
    } finally {
      busyRef.current = false
      setBusy("")
    }
  }
  async function ensureConnected() {
    if (!hasDriveSession()) {
      await connectDrive()
      setConnected(true)
    }
  }
  async function refreshDrive() {
    setDrive(null)
    await ensureConnected()
    setDrive(await listDriveBackups())
  }
  async function selectDrive(file: DriveFile) {
    const backup = await readBackup(await downloadDriveBackup(file))
    setDriveOpen(false)
    setSelection({ backup, name: file.name, source: "Google Drive" })
  }
  async function pickOtherFile() {
    // The Google chooser owns focus; do not leave our modal underneath it.
    setDriveOpen(false)
    const controller = new AbortController()
    pickerAbort.current = controller
    try {
      await ensureConnected()
      const file = await chooseDriveBackup(controller.signal)
      if (controller.signal.aborted) return
      if (file) await selectDrive(file)
      else setDriveOpen(true)
    } catch (error) {
      if (controller.signal.aborted) return
      setDriveOpen(true)
      throw error
    } finally {
      pickerAbort.current = null
    }
  }
  const errorNotice = failure && (
    <div className="backup-notice" role="alert">
      <p>{failure.message}</p>
      <Button
        variant="outline"
        size="sm"
        disabled={!!busy}
        onClick={() => void run("Retrying…", failure.retry)}
      >
        {failure.reconnect ? "Reconnect and retry" : "Retry"}
      </Button>
    </div>
  )
  const progress = busy && (
    <p className="backup-progress" role="status">
      <Loader2 className="animate-spin" size={16} />
      {busy}
    </p>
  )
  return (
    <section className="settings-section">
      <div className="settings-section-label">
        <Cloud />
        <h2>Backup & restore</h2>
      </div>
      <Card className="settings-card">
        <div className="backup-action">
          <h3>Back up your library</h3>
          <p>Includes decks, cards, review history, and images.</p>
          <div className="backup-buttons">
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => void run("Preparing ZIP…", downloadCurrent)}
            >
              <ArrowDownToLine />
              Download ZIP
            </Button>
            <Button
              variant="outline"
              disabled={!googleReady || !!busy}
              onClick={() =>
                void run("Saving to Google Drive…", async () => {
                  await ensureConnected()
                  const name = await uploadDriveBackup()
                  await setSetting("lastDriveBackup", new Date().toISOString())
                  notify(`Saved to Google Drive: ${name}`)
                })
              }
            >
              <Cloud />
              Save to Google Drive
            </Button>
          </div>
          {lastBackup && (
            <small>
              Last ZIP download prepared:{" "}
              {new Date(lastBackup.value).toLocaleString()}
            </small>
          )}
          {lastDriveBackup && (
            <small>
              Last saved to Drive:{" "}
              {new Date(lastDriveBackup.value).toLocaleString()}
            </small>
          )}
        </div>
        <div className="backup-action">
          <h3>Restore your library</h3>
          <p>
            Replace this browser’s library with a backup. You will review it
            before anything changes. Up to 100 MB.
          </p>
          <div className="backup-buttons">
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => input.current?.click()}
            >
              Choose ZIP file
            </Button>
            <Button
              variant="outline"
              disabled={!googleReady || !!busy}
              onClick={() => {
                setDriveOpen(true)
                void run("Loading Drive backups…", refreshDrive)
              }}
            >
              <Cloud />
              Choose from Google Drive
            </Button>
          </div>
          <input
            ref={input}
            type="file"
            className="hidden"
            accept=".zip,application/zip"
            aria-label="Import backup file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file)
                void run("Validating backup…", async () =>
                  setSelection({
                    backup: await readBackup(file),
                    name: file.name,
                    source: "This device",
                  }),
                )
            }}
          />
        </div>
        <div className="backup-connection">
          <div>
            <strong>
              Google Drive · {connected ? "Connected" : "Not connected"}
            </strong>
            <p>Manual backups only. No automatic sync.</p>
          </div>
          {connected && (
            <Button
              variant="ghost"
              size="sm"
              disabled={!!busy}
              onClick={() => {
                disconnectDrive()
                setConnected(false)
                setDrive(null)
                setFailure(null)
                notify("Google Drive disconnected")
              }}
            >
              Disconnect
            </Button>
          )}
        </div>
        {!driveClientId && (
          <p className="backup-notice">
            Google Drive is not configured for this installation. You can still
            download and restore ZIP files.
          </p>
        )}
        {driveClientId && !googleReady && !googleError && (
          <p className="backup-notice" role="status">
            Loading Google sign-in…
          </p>
        )}
        {googleError && (
          <div className="backup-notice" role="alert">
            <p>Google sign-in could not load. Check your connection.</p>
            <Button variant="outline" size="sm" onClick={loadGoogle}>
              Retry Google sign-in
            </Button>
          </div>
        )}
        {!driveOpen && !selection && (
          <>
            {progress}
            {errorNotice}
          </>
        )}
      </Card>
      {driveOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) {
              setDriveOpen(false)
              setFailure(null)
            }
          }}
        >
          <DialogContent
            className="editor-dialog sm:max-w-2xl"
            showCloseButton={!busy}
          >
            <DialogHeader>
              <DialogTitle>Choose a Drive backup</DialogTitle>
              <DialogDescription>
                Recent Recallbox backups, newest first. Choosing a backup does
                not change your library.
              </DialogDescription>
            </DialogHeader>
            <div className="backup-buttons">
              <Button
                variant="outline"
                disabled={!!busy || !drivePickerConfigured}
                onClick={() =>
                  void run("Opening Google Drive chooser…", pickOtherFile)
                }
              >
                Choose another file in Drive
              </Button>
              <Button
                variant="ghost"
                disabled={!!busy}
                onClick={() => void run("Loading Drive backups…", refreshDrive)}
              >
                <RefreshCw />
                Refresh
              </Button>
            </div>
            {!drivePickerConfigured && (
              <p className="text-sm text-muted-foreground">
                Choosing files outside the Recallbox folder needs Google Picker
                configuration. See README.md.
              </p>
            )}
            {progress}
            {errorNotice}
            {drive && (
              <>
                <div className="drive-files-header">
                  <span>Recent backups (up to 100)</span>
                  {drive.folderId && (
                    <a
                      href={`https://drive.google.com/drive/folders/${drive.folderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open folder ↗
                    </a>
                  )}
                </div>
                {drive.files.length ? (
                  <div className="drive-file-list">
                    {drive.files.map((file) => (
                      <div className="drive-file" key={file.id}>
                        <span className="min-w-0">
                          <strong>{file.name}</strong>
                          <small>
                            {file.createdTime
                              ? new Date(file.createdTime).toLocaleString()
                              : "Date unavailable"}{" "}
                            ·{" "}
                            {file.size
                              ? `${(Number(file.size) / 1024 / 1024).toFixed(2)} MB`
                              : "Size unavailable"}
                          </small>
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!!busy}
                          onClick={() =>
                            void run("Downloading and validating backup…", () =>
                              selectDrive(file),
                            )
                          }
                        >
                          Choose backup
                          <span className="sr-only"> {file.name}</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No backups in your Recallbox folder yet. Save your first
                    backup, or choose another file in Drive.
                  </p>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
      {selection && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) {
              setSelection(null)
              setFailure(null)
            }
          }}
        >
          <DialogContent
            className="editor-dialog sm:max-w-lg"
            showCloseButton={!busy}
          >
            <DialogHeader>
              <DialogTitle>Review backup</DialogTitle>
              <DialogDescription>
                This replaces your current library. It does not merge.
              </DialogDescription>
            </DialogHeader>
            <div className="backup-review">
              <p className="break-all">
                <strong>{selection.name}</strong>
              </p>
              <p>Source: {selection.source}</p>
              <p>
                {selection.backup.manifest.decks.length} decks ·{" "}
                {selection.backup.manifest.cards.length} cards ·{" "}
                {selection.backup.assets.length} images ·{" "}
                {selection.backup.manifest.reviews.length} reviews
              </p>
              <p className="text-muted-foreground">
                Your current library has {decks.length} decks and {cards.length}{" "}
                cards. Download it first if you want to keep it.
              </p>
            </div>
            {progress}
            {errorNotice}
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                void run("Preparing current library…", downloadCurrent)
              }
            >
              <ArrowDownToLine />
              Download current library first
            </Button>
            <div className="backup-buttons justify-end">
              <Button
                variant="ghost"
                disabled={!!busy}
                onClick={() => {
                  setSelection(null)
                  setFailure(null)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!!busy}
                onClick={() =>
                  void run("Replacing library…", async () => {
                    await restoreBackup(selection.backup)
                    setSelection(null)
                    notify(
                      `Library restored: ${selection.backup.manifest.decks.length} decks and ${selection.backup.manifest.cards.length} cards`,
                    )
                  })
                }
              >
                Replace library
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}
