import { z } from 'zod'

/*
 * Tolerant parsing helpers for third-party APIs. Fields that are missing or the wrong type become
 * undefined instead of failing the whole response, and bad items inside a list are skipped.
 */
export const str = z.string().optional().catch(undefined)
export const nstr = z.string().nullish().catch(undefined)
export const nnum = z.number().nullish().catch(undefined)
export const num = z.number().optional().catch(undefined)
export const text = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined)

/** An array whose bad items are dropped; a missing or non-array value becomes []. */
export const list = <T extends z.ZodType>(item: T) =>
  z.array(z.unknown()).catch([]).transform((arr) => arr.flatMap((i) => { const r = item.safeParse(i); return r.success ? [r.data as z.infer<T>] : [] }))
