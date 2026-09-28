import { readFile, writeFile } from "node:fs/promises"
import sharp from "sharp"

const background = "#202020"
const mark = await readFile("public/brand-mark.svg", "utf8")
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${background}" />
  <g transform="translate(120 104)" color="#f5f5f5">${mark.trim()}</g>
</svg>
`
await writeFile("public/icon.svg", icon)
for (const size of [192, 512]) {
  await sharp(Buffer.from(icon))
    .resize(size, size)
    .png()
    .toFile(`public/icon-${size}.png`)
}
await sharp(Buffer.from(icon))
  .resize(512, 512)
  .flatten({ background })
  .png()
  .toFile("public/icon-maskable-512.png")
