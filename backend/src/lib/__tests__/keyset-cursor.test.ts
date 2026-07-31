import { describe, it, expect } from "vitest"
import { decodeKeysetCursor, encodeKeysetCursor, keysetFilter } from "../keyset-cursor.js"

const TS = "2026-07-31T10:23:45.123456+00:00"
const ID = "00000000-0000-4000-8000-000000000020"

describe("encodeKeysetCursor / decodeKeysetCursor", () => {
  it("round-trips a cursor", () => {
    expect(decodeKeysetCursor(encodeKeysetCursor({ createdAt: TS, id: ID }))).toEqual({
      createdAt: TS,
      id: ID,
    })
  })

  it("accepts every timestamp shape PostgREST returns", () => {
    for (const ts of [
      "2026-07-31T10:23:45+00:00",
      "2026-07-31T10:23:45Z",
      "2026-07-31T10:23:45.1Z",
      "2026-07-31T10:23:45.123456+00:00",
      "2026-07-31T10:23:45.123456+0000",
      "2026-07-31T10:23:45",
    ]) {
      expect(decodeKeysetCursor(encodeKeysetCursor({ createdAt: ts, id: ID }))).not.toBeNull()
    }
  })

  it("returns null for an absent cursor", () => {
    expect(decodeKeysetCursor(undefined)).toBeNull()
    expect(decodeKeysetCursor(null)).toBeNull()
    expect(decodeKeysetCursor("")).toBeNull()
  })

  it("returns null (never throws) for malformed input", () => {
    expect(decodeKeysetCursor("not-base64-at-all!!")).toBeNull()
    expect(decodeKeysetCursor(Buffer.from("not json").toString("base64"))).toBeNull()
    expect(decodeKeysetCursor(Buffer.from('"a string"').toString("base64"))).toBeNull()
    expect(decodeKeysetCursor(Buffer.from("null").toString("base64"))).toBeNull()
    expect(decodeKeysetCursor(Buffer.from("[]").toString("base64"))).toBeNull()
  })

  it("rejects a cursor missing either field", () => {
    expect(decodeKeysetCursor(Buffer.from(JSON.stringify({ createdAt: TS })).toString("base64"))).toBeNull()
    expect(decodeKeysetCursor(Buffer.from(JSON.stringify({ id: ID })).toString("base64"))).toBeNull()
  })

  it("rejects a non-UUID id", () => {
    const raw = Buffer.from(JSON.stringify({ createdAt: TS, id: "nope" })).toString("base64")
    expect(decodeKeysetCursor(raw)).toBeNull()
  })

  it("rejects a non-string / wrongly-typed field", () => {
    const raw = Buffer.from(JSON.stringify({ createdAt: 12345, id: ID })).toString("base64")
    expect(decodeKeysetCursor(raw)).toBeNull()
  })

  // The decoded fields are interpolated into a PostgREST `.or(...)` string, so
  // any value carrying a filter metacharacter must be rejected at the door —
  // this is the injection guard, not a formatting nicety.
  it("rejects PostgREST filter metacharacters in either field", () => {
    for (const bad of [
      `2026-07-31T10:23:45+00:00,id.gt.0`,
      `2026-07-31T10:23:45+00:00)`,
      `2026-07-31T10:23:45+00:00,or(id.gt.0`,
    ]) {
      const raw = Buffer.from(JSON.stringify({ createdAt: bad, id: ID })).toString("base64")
      expect(decodeKeysetCursor(raw)).toBeNull()
    }
    for (const bad of [`${ID},created_at.gt.2000-01-01T00:00:00Z`, `${ID})`, `${ID},or(x.gt.0`]) {
      const raw = Buffer.from(JSON.stringify({ createdAt: TS, id: bad })).toString("base64")
      expect(decodeKeysetCursor(raw)).toBeNull()
    }
  })
})

describe("keysetFilter", () => {
  // The `OR (created_at = c AND id < i)` leg is what makes ties survive: with a
  // bare `created_at.lt.c`, every row sharing the boundary timestamp would be
  // skipped entirely.
  it("emits a composite predicate that includes the tie leg", () => {
    expect(keysetFilter({ createdAt: TS, id: ID })).toBe(
      `created_at.lt.${TS},and(created_at.eq.${TS},id.lt.${ID})`,
    )
  })
})
