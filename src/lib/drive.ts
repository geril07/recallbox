/// <reference types="google.accounts" />
import { z } from 'zod'
import { backupName, createBackup } from './backup'

export const driveClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  string | undefined
const scope = 'https://www.googleapis.com/auth/drive.file'
let token: { value: string; expires: number } | undefined
let scriptPromise: Promise<void> | undefined
const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdTime: z.string().optional(),
  size: z.string().optional(),
})
export type DriveFile = z.infer<typeof fileSchema>

export function loadGoogleIdentity() {
  if (!driveClientId)
    return Promise.reject(
      new Error('Google Drive needs an OAuth client ID. See README.md.'),
    )
  if (window.google?.accounts) return Promise.resolve()
  if (!scriptPromise)
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        script.remove()
        scriptPromise = undefined
        reject(new Error('Could not reach Google. Check your connection.'))
      }
      document.head.appendChild(script)
    })
  return scriptPromise
}
export function connectDrive() {
  return new Promise<void>((resolve, reject) => {
    if (!window.google?.accounts || !driveClientId)
      return reject(new Error('Google sign-in is not ready.'))
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
            return reject(new Error('Google Drive permission was not granted.'))
          token = {
            value: response.access_token,
            expires: Date.now() + Number(response.expires_in) * 1000 - 60000,
          }
          resolve()
        },
        error_callback: () =>
          reject(
            new Error(
              'Google sign-in was closed or blocked. Please try again.',
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
  if (!token || token.expires <= Date.now()) {
    token = undefined
    throw new Error('Your Google session expired. Connect again to continue.')
  }
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token.value}`, ...options.headers },
  })
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? 'Your Google session expired. Connect again.'
        : `Google Drive request failed (${response.status}). Your local data is unchanged.`,
    )
  return response
}
const api = 'https://www.googleapis.com/drive/v3/files'
async function folder() {
  const q =
    "trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='recallbox' and value='backups' }"
  const response = await request(
    `${api}?${new URLSearchParams({ q, fields: 'files(id,name)', pageSize: '100' })}`,
  )
  const data = z
    .object({ files: z.array(fileSchema) })
    .parse(await response.json())
  if (data.files[0]) return data.files[0].id
  const created = await request(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Recallbox',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { recallbox: 'backups' },
    }),
  })
  return fileSchema.parse(await created.json()).id
}
export async function listDriveBackups() {
  const folderId = await folder()
  const response = await request(
    `${api}?${new URLSearchParams({ q: `'${folderId}' in parents and trashed = false and mimeType = 'application/zip'`, fields: 'files(id,name,createdTime,size)', orderBy: 'createdTime desc', pageSize: '100' })}`,
  )
  return {
    folderId,
    files: z.object({ files: z.array(fileSchema) }).parse(await response.json())
      .files,
  }
}
export async function uploadDriveBackup() {
  const folderId = await folder()
  const blob = await createBackup()
  const start = await request(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'application/zip',
      },
      body: JSON.stringify({
        name: backupName(),
        parents: [folderId],
        mimeType: 'application/zip',
      }),
    },
  )
  const location = start.headers.get('Location')
  if (!location) throw new Error('Google did not return an upload location.')
  await request(location, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/zip' },
    body: blob,
  })
}
export async function downloadDriveBackup(file: DriveFile) {
  if (Number(file.size || 0) > 100 * 1024 * 1024)
    throw new Error('This backup exceeds the 100 MB import limit.')
  return (
    await request(`${api}/${encodeURIComponent(file.id)}?alt=media`)
  ).blob()
}
