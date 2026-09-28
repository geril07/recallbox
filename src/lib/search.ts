import { z } from "zod"

const searchString = z.string().catch("").default("")

export const decksSearchSchema = z.object({ tag: searchString })
export const studySearchSchema = z.object({ deck: searchString })
