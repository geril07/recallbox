import { describe, expect, it } from "vitest"
import sharp from "sharp"

describe("App icons", () => {
  it.each([192, 512])(
    "provides a %i-pixel icon with transparent corners",
    async (size) => {
      const { data, info } = await sharp(`public/icon-${size}.png`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      expect([info.width, info.height]).toEqual([size, size])
      expect(data[3]).toBe(0)
      expect(data[((size / 2) * size + size / 2) * 4 + 3]).toBe(255)
    },
  )

  it("keeps the maskable mark inside the central safe circle on an opaque background", async () => {
    const { data, info } = await sharp("public/icon-maskable-512.png")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect([info.width, info.height]).toEqual([512, 512])
    let foregroundPixels = 0
    let outsideSafeArea = 0
    let transparentPixels = 0
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const offset = (y * info.width + x) * 4
        if (data[offset + 3] !== 255) transparentPixels++
        if (Math.abs(data[offset] - data[0]) > 10) {
          foregroundPixels++
          if (Math.hypot(x + 0.5 - 256, y + 0.5 - 256) > 512 * 0.4)
            outsideSafeArea++
        }
      }
    }
    expect(foregroundPixels).toBeGreaterThan(0)
    expect(outsideSafeArea).toBe(0)
    expect(transparentPixels).toBe(0)
  })
})
