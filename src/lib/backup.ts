import JSZip from "jszip"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  cardSchema,
  deckSchema,
  reviewSchema,
  referencedAssetIds,
  type Asset,
} from "@/lib/model"

const MAX_SIZE = 100 * 1024 * 1024
const assetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(250),
  type: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  size: z
    .number()
    .int()
    .nonnegative()
    .max(10 * 1024 * 1024),
})
const manifestSchema = z.object({
  format: z.literal("recallbox"),
  version: z.literal(1),
  exportedAt: z.string(),
  decks: z.array(deckSchema).max(10000),
  cards: z.array(cardSchema).max(100000),
  reviews: z.array(reviewSchema).max(500000),
  assets: z.array(assetSchema).max(10000),
})
export interface Backup {
  manifest: z.infer<typeof manifestSchema>
  assets: Asset[]
}
export const backupName = () =>
  `recallbox-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`
export async function createBackup() {
  const data = await db.transaction(
    "r",
    db.decks,
    db.cards,
    db.reviews,
    db.assets,
    async () => ({
      decks: await db.decks.toArray(),
      cards: await db.cards.toArray(),
      reviews: await db.reviews.toArray(),
      assets: await db.assets.toArray(),
    }),
  )
  const zip = new JSZip()
  const referenced = referencedAssetIds(data.cards)
  const assets = data.assets.filter((a) => referenced.has(a.id))
  const manifest = {
    format: "recallbox",
    version: 1,
    exportedAt: new Date().toISOString(),
    decks: data.decks,
    cards: data.cards,
    reviews: data.reviews,
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.blob.type,
      size: a.blob.size,
    })),
  }
  if (!manifestSchema.safeParse(manifest).success)
    throw new Error("The library exceeds the supported backup format limits.")
  const json = JSON.stringify(manifest, null, 2)
  if (
    assets.reduce(
      (size, asset) => size + asset.blob.size,
      new Blob([json]).size,
    ) > MAX_SIZE
  )
    throw new Error("The library exceeds the 100 MB backup limit.")
  zip.file("recallbox.json", json)
  for (const asset of assets)
    zip.file(`assets/${asset.id}`, await asset.blob.arrayBuffer())
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" })
  if (blob.size > MAX_SIZE)
    throw new Error("The ZIP exceeds the 100 MB backup limit.")
  return blob
}
function uniqueIds(items: { id: string }[]) {
  if (new Set(items.map((x) => x.id)).size !== items.length)
    throw new Error("Backup contains duplicate IDs.")
}
function readEntry(
  entry: JSZip.JSZipObject,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let size = 0
    const stream = entry.internalStream("uint8array")
    stream
      .on("data", (chunk) => {
        size += chunk.byteLength
        if (size > limit) {
          stream.pause()
          reject(new Error("Expanded backup content exceeds the size limit."))
          return
        }
        chunks.push(chunk)
      })
      .on("error", reject)
      .on("end", () => {
        const result = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.byteLength
        }
        resolve(result)
      })
      .resume()
  })
}
export async function readBackup(file: Blob): Promise<Backup> {
  if (file.size > MAX_SIZE)
    throw new Error("This backup exceeds the 100 MB import limit.")
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const entry = zip.file("recallbox.json")
  if (!entry)
    throw new Error("Not a Recallbox backup: recallbox.json is missing.")
  const raw = new TextDecoder().decode(await readEntry(entry, MAX_SIZE))
  const result = manifestSchema.safeParse(JSON.parse(raw))
  if (!result.success)
    throw new Error("This backup is damaged or uses an unsupported format.")
  const manifest = result.data
  ;[manifest.decks, manifest.cards, manifest.reviews, manifest.assets].forEach(
    uniqueIds,
  )
  const decks = new Set(manifest.decks.map((d) => d.id))
  const cards = new Map(manifest.cards.map((c) => [c.id, c]))
  const assetIds = new Set(manifest.assets.map((a) => a.id))
  for (const c of manifest.cards) {
    if (!decks.has(c.deckId))
      throw new Error("A card refers to a missing deck.")
    for (const match of `${c.prompt}\n${c.answer}\n${c.reversePrompt}`.matchAll(
      /asset:([\w-]+)/g,
    )) {
      if (!assetIds.has(match[1]))
        throw new Error("A card refers to a missing image.")
    }
  }
  for (const r of manifest.reviews)
    if (cards.get(r.cardId)?.deckId !== r.deckId)
      throw new Error("Review history contains an invalid card reference.")
  if (manifest.assets.reduce((sum, a) => sum + a.size, raw.length) > MAX_SIZE)
    throw new Error("Expanded backup exceeds 100 MB.")
  const assets: Asset[] = []
  for (const meta of manifest.assets) {
    const assetEntry = zip.file(`assets/${meta.id}`)
    if (!assetEntry) throw new Error(`Missing image: ${meta.name}`)
    const bytes = await readEntry(assetEntry, meta.size)
    if (bytes.byteLength !== meta.size)
      throw new Error(`Invalid image size: ${meta.name}`)
    assets.push({
      id: meta.id,
      name: meta.name,
      blob: new Blob([bytes], { type: meta.type }),
    })
  }
  return { manifest, assets }
}
export async function restoreBackup(backup: Backup) {
  await db.transaction(
    "rw",
    db.decks,
    db.cards,
    db.reviews,
    db.assets,
    db.settings,
    async () => {
      await Promise.all([
        db.decks.clear(),
        db.cards.clear(),
        db.reviews.clear(),
        db.assets.clear(),
      ])
      await db.decks.bulkAdd(backup.manifest.decks)
      await db.cards.bulkAdd(backup.manifest.cards)
      await db.reviews.bulkAdd(backup.manifest.reviews)
      await db.assets.bulkAdd(backup.assets)
      await db.settings.put({ key: "starterNotice", value: "false" })
    },
  )
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
