import { useEffect, useState } from "react"
import ReactMarkdown, { defaultUrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import type { Asset } from "@/lib/model"

const schema = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, src: ["https", "http", "asset"] },
}
function LocalImage({
  id,
  alt,
  pending,
}: {
  id: string
  alt?: string
  pending: Asset[]
}) {
  const saved = useLiveQuery(() => db.assets.get(id), [id])
  const asset = pending.find((a) => a.id === id) ?? saved
  const [url, setUrl] = useState("")
  useEffect(() => {
    if (!asset) return
    const objectUrl = URL.createObjectURL(asset.blob)
    // Object URLs need effect cleanup; allocating them during render can leak on an abandoned render.
    // eslint-disable-next-line react/set-state-in-effect
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [asset])
  return url ? (
    <img src={url} alt={alt || "Card image"} />
  ) : (
    <span className="text-xs text-muted-foreground">
      [Image: {alt || "loading"}]
    </span>
  )
}
export function Markdown({
  children,
  assets = [],
}: {
  children: string
  assets?: Asset[]
}) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        urlTransform={(url, key) =>
          key === "src" && /^asset:[\w-]+$/.test(url)
            ? url
            : defaultUrlTransform(url)
        }
        components={{
          a: ({ href, children: linkText }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {linkText}
            </a>
          ),
          img: ({ src, alt }) =>
            typeof src === "string" && src.startsWith("asset:") ? (
              <LocalImage id={src.slice(6)} alt={alt} pending={assets} />
            ) : (
              <img
                src={src}
                alt={alt || "Card image"}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
