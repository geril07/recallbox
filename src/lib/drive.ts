/// <reference types="google.accounts" />
/// <reference types="google.picker" />
/// <reference types="gapi" />
import { z } from "zod"
import { backupName, createBackup } from "@/lib/backup"

export const driveClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined
const pickerKey = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined
const projectNumber = import.meta.env.VITE_GOOGLE_PROJECT_NUMBER as
  | string
  | undefined
export const drivePickerConfigured = Boolean(pickerKey && projectNumber)
const scope = "https://www.googleapis.com/auth/drive.file"
let token: { value: string; expires: number } | undefined
let identityPromise: Promise<void> | undefined
let pickerPromise: Promise<void> | undefined
const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdTime: z.string().optional(),
  size: z.string().optional(),
})
export type DriveFile = z.infer<typeof fileSchema>
export class DriveSessionExpired extends Error {
  constructor() {
    super("Your Google session expired. Reconnect and retry.")
  }
}
export function hasDriveSession() {
  return Boolean(token && token.expires > Date.now())
}
function accessToken() {
  if (!hasDriveSession()) {
    token = undefined
    throw new DriveSessionExpired()
  }
  return token!.value
}
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    const timer = window.setTimeout(fail, 15000)
    function fail() {
      clearTimeout(timer)
      script.remove()
      reject(
        new Error("Could not reach Google. Check your connection and retry."),
      )
    }
    script.src = src
    script.async = true
    script.addEventListener("load", () => {
      clearTimeout(timer)
      resolve()
    })
    script.addEventListener("error", fail)
    document.head.appendChild(script)
  })
}
export function loadGoogleIdentity() {
  if (!driveClientId)
    return Promise.reject(
      new Error("Google Drive is not configured. See README.md."),
    )
  if (window.google?.accounts) return Promise.resolve()
  identityPromise ??= loadScript(
    "https://accounts.google.com/gsi/client",
  ).catch((error) => {
    identityPromise = undefined
    throw error
  })
  return identityPromise
}
export function connectDrive() {
  return new Promise<void>((resolve, reject) => {
    if (!window.google?.accounts || !driveClientId)
      return reject(new Error("Google sign-in is not ready."))
    google.accounts.oauth2
      .initTokenClient({
        client_id: driveClientId,
        scope,
        callback: (response) => {
          if (
            response.error ||
            !response.access_token ||
            !google.accounts.oauth2.hasGrantedAllScopes(response, scope)
          )
            return reject(new Error("Google Drive permission was not granted."))
          token = {
            value: response.access_token,
            expires: Date.now() + Number(response.expires_in) * 1000 - 60000,
          }
          resolve()
        },
        error_callback: () =>
          reject(
            new Error(
              "Google sign-in was closed or blocked. Please try again.",
            ),
          ),
      })
      .requestAccessToken()
  })
}
export function disconnectDrive() {
  if (token) google.accounts.oauth2.revoke(token.value, () => {})
  token = undefined
}
async function request(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken()}`, ...options.headers },
  })
  if (response.status === 401) {
    token = undefined
    throw new DriveSessionExpired()
  }
  if (!response.ok)
    throw new Error(
      `Google Drive request failed (${response.status}). Your local data is unchanged.`,
    )
  return response
}
const api = "https://www.googleapis.com/drive/v3/files"
async function findFolder() {
  const q =
    "trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='recallbox' and value='backups' }"
  const response = await request(
    `${api}?${new URLSearchParams({ q, fields: "files(id,name)", pageSize: "100" })}`,
  )
  const data = z
    .object({ files: z.array(fileSchema) })
    .parse(await response.json())
  return data.files[0]?.id ?? null
}
async function createFolder() {
  const response = await request(api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Recallbox",
      mimeType: "application/vnd.google-apps.folder",
      appProperties: { recallbox: "backups" },
    }),
  })
  return fileSchema.parse(await response.json()).id
}
export async function listDriveBackups() {
  const folderId = await findFolder()
  if (!folderId) return { folderId, files: [] as DriveFile[] }
  const response = await request(
    `${api}?${new URLSearchParams({ q: `'${folderId}' in parents and trashed = false and mimeType = 'application/zip'`, fields: "files(id,name,createdTime,size)", orderBy: "createdTime desc", pageSize: "100" })}`,
  )
  return {
    folderId,
    files: z.object({ files: z.array(fileSchema) }).parse(await response.json())
      .files,
  }
}
export async function uploadDriveBackup() {
  const blob = await createBackup()
  const folderId = (await findFolder()) ?? (await createFolder())
  const name = backupName()
  const start = await request(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "application/zip",
      },
      body: JSON.stringify({
        name,
        parents: [folderId],
        mimeType: "application/zip",
      }),
    },
  )
  const location = start.headers.get("Location")
  if (!location) throw new Error("Google did not return an upload location.")
  await request(location, {
    method: "PUT",
    headers: { "Content-Type": "application/zip" },
    body: blob,
  })
  return name
}
export async function downloadDriveBackup(file: DriveFile) {
  if (Number(file.size || 0) > 100 * 1024 * 1024)
    throw new Error("This backup exceeds the 100 MB import limit.")
  return (
    await request(`${api}/${encodeURIComponent(file.id)}?alt=media`)
  ).blob()
}
async function loadPicker() {
  if (window.google?.picker) return
  pickerPromise ??= (async () => {
    if (!window.gapi) await loadScript("https://apis.google.com/js/api.js")
    await new Promise<void>((resolve, reject) => {
      gapi.load("picker", {
        callback: resolve,
        onerror: () =>
          reject(new Error("Google Drive chooser could not load. Retry.")),
        timeout: 15000,
        ontimeout: () =>
          reject(new Error("Google Drive chooser timed out. Retry.")),
      })
    })
  })().catch((error) => {
    pickerPromise = undefined
    throw error
  })
  await pickerPromise
}
export async function chooseDriveBackup(
  signal: AbortSignal,
): Promise<DriveFile | null> {
  if (!pickerKey || !projectNumber)
    throw new Error(
      "Choosing other Drive files needs a Google API key and project number. See README.md.",
    )
  await loadPicker()
  signal.throwIfAborted()
  const value = accessToken()
  const id = await new Promise<string | null>((resolve) => {
    const picker = new google.picker.PickerBuilder()
      .addView(
        new google.picker.DocsView()
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false)
          .setMimeTypes("application/zip,application/x-zip-compressed"),
      )
      .setTitle("Choose a Recallbox backup")
      .setOAuthToken(value)
      .setDeveloperKey(pickerKey)
      .setAppId(projectNumber)
      .setOrigin(window.location.origin)
      .setCallback((data) => {
        if (
          data.action === google.picker.Action.PICKED ||
          data.action === google.picker.Action.CANCEL
        ) {
          finish(
            data.action === google.picker.Action.PICKED
              ? (data.docs?.[0]?.id ?? null)
              : null,
          )
        }
      })
      .build()
    function finish(selectedId: string | null) {
      signal.removeEventListener("abort", cancel)
      picker.dispose()
      resolve(selectedId)
    }
    function cancel() {
      finish(null)
    }
    signal.addEventListener("abort", cancel, { once: true })
    picker.setVisible(true)
  })
  if (!id) return null
  const response = await request(
    `${api}/${encodeURIComponent(id)}?fields=id,name,createdTime,size`,
  )
  return fileSchema.parse(await response.json())
}
