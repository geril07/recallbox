import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Button } from "@/components/ui/button"

describe("Button loading", () => {
  it("keeps the label and exposes a disabled, busy state", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { loading: true }, "Download ZIP"),
    )
    expect(markup).toContain("Download ZIP")
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('aria-disabled="true"')
    expect(markup).not.toMatch(/ loading=/)
  })

  it("returns to an enabled state when loading ends", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { loading: false }, "Download ZIP"),
    )
    expect(markup).toContain("Download ZIP")
    expect(markup).not.toContain('aria-busy="true"')
    expect(markup).not.toContain('aria-disabled="true"')
    expect(markup).not.toMatch(/ disabled=/)
  })

  it("respects an explicitly disabled button after loading ends", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { loading: false, disabled: true }, "Download ZIP"),
    )
    expect(markup).toMatch(/ disabled=/)
  })
})
