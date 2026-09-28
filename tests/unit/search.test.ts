import { describe, expect, it } from "vitest"
import { decksSearchSchema, studySearchSchema } from "@/lib/search"

const cases = [
  { schema: decksSearchSchema, key: "tag" },
  { schema: studySearchSchema, key: "deck" },
] as const

describe.each(cases)("$key search parameter", ({ schema, key }) => {
  it("accepts a string and ignores unrelated parameters", () => {
    expect(schema.parse({ [key]: "example", ignored: true })).toEqual({
      [key]: "example",
    })
  })

  it.each([undefined, null, 42, ["example"], { id: "example" }])(
    "falls back for missing or invalid input: %s",
    (value) => {
      expect(schema.parse({ [key]: value })).toEqual({ [key]: "" })
    },
  )

  it("defaults when the parameter is absent", () => {
    expect(schema.parse({})).toEqual({ [key]: "" })
  })
})
