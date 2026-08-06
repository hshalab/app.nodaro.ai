import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { driverTick, resetRecastDriverCronForTests } from "../recast-driver-cron.js"

const appWith = (impl: () => Promise<{ statusCode: number }>) => ({ inject: vi.fn(impl) })

beforeEach(() => { resetRecastDriverCronForTests(); process.env.RECAST_DRIVER_CRON_ENABLED = "true" })
afterEach(() => { delete process.env.RECAST_DRIVER_CRON_ENABLED })

describe("driverTick", () => {
  it("does nothing when the kill switch is off", async () => {
    process.env.RECAST_DRIVER_CRON_ENABLED = "false"
    const app = appWith(async () => ({ statusCode: 200 }))
    expect(await driverTick(app as never)).toBe("disabled")
    expect(app.inject).not.toHaveBeenCalled()
  })

  it("never overlaps itself", async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const app = appWith(async () => { await gate; return { statusCode: 200 } })
    const first = driverTick(app as never)
    expect(await driverTick(app as never)).toBe("skipped")
    release()
    expect(await first).toBe("ran")
    expect(app.inject).toHaveBeenCalledTimes(1)
  })

  it("disables itself permanently on 404 — the plugin is not loaded", async () => {
    const app = appWith(async () => ({ statusCode: 404 }))
    expect(await driverTick(app as never)).toBe("ran")
    expect(await driverTick(app as never)).toBe("disabled")
    expect(app.inject).toHaveBeenCalledTimes(1)
  })

  it("keeps ticking after a transient 500", async () => {
    const app = appWith(async () => ({ statusCode: 500 }))
    expect(await driverTick(app as never)).toBe("ran")
    expect(await driverTick(app as never)).toBe("ran")
  })
})
