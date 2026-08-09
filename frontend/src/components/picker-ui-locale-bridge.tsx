import type { ReactNode } from "react"
import { PickerUiProvider } from "@/lib/picker-ui"
import { useUserLocale } from "@/lib/locale-store"

/**
 * Feeds the app's locale into the picker-ui seam.
 *
 * In the RICH lane the private package's components read locale from the
 * package's own context (they cannot reach the app's locale store), so this
 * bridge must wrap the tree or non-English picker labels silently fall back
 * to English. In the STUB lane the provider is a passthrough (the stub's
 * hooks read the app store directly) — mounting it is free.
 */
export function PickerUiLocaleBridge({ children }: { children: ReactNode }) {
  const locale = useUserLocale()
  return <PickerUiProvider locale={locale}>{children}</PickerUiProvider>
}
