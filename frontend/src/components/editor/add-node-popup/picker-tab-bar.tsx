/**
 * The picker's tablist. Nine intent tabs that never wrap — the row scrolls
 * horizontally with a fade over the right edge, so `All` (far right) is
 * reachable but never clipped.
 */
import { useEffect, useRef } from "react"
import {
  Film,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Music,
  Send,
  Star,
  Workflow,
  Box,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ADD_NODE_MENU_TABS, type AddNodeMenuTab } from "@/lib/add-node-menu-tab"

const TAB_META: Record<AddNodeMenuTab, { label: string; icon: React.ReactNode }> = {
  common: { label: "Common", icon: <Star className="h-[13px] w-[13px]" /> },
  image: { label: "Image", icon: <ImageIcon className="h-[13px] w-[13px]" /> },
  video: { label: "Video", icon: <Film className="h-[13px] w-[13px]" /> },
  audio: { label: "Audio", icon: <Music className="h-[13px] w-[13px]" /> },
  models: { label: "Models", icon: <Layers className="h-[13px] w-[13px]" /> },
  assets: { label: "Assets", icon: <Box className="h-[13px] w-[13px]" /> },
  automate: { label: "Automate", icon: <Workflow className="h-[13px] w-[13px]" /> },
  publish: { label: "Publish", icon: <Send className="h-[13px] w-[13px]" /> },
  all: { label: "All", icon: <LayoutGrid className="h-[13px] w-[13px]" /> },
}

interface PickerTabBarProps {
  readonly activeTab: AddNodeMenuTab
  readonly onSelect: (tab: AddNodeMenuTab) => void
}

export function PickerTabBar({ activeTab, onSelect }: PickerTabBarProps) {
  const activeRef = useRef<HTMLButtonElement>(null)

  // At narrow viewports the strip scrolls, and Tab-cycling can land on a tab
  // that is off-screen or half-hidden behind the right-edge fade. Pull the
  // selected one fully into view so the active tab is never the clipped one.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeTab])

  return (
    <div className="relative px-3 pb-0.5">
      <div
        className="npk-tabs flex gap-0.5 overflow-x-auto pr-[22px]"
        role="tablist"
        aria-label="Node menu mode"
      >
        {ADD_NODE_MENU_TABS.map((id) => {
          const { label, icon } = TAB_META[id]
          const active = activeTab === id
          return (
            <button
              key={id}
              ref={active ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 py-[7px]",
                "text-[12.5px] font-medium transition-colors",
                active
                  ? "bg-[var(--npk-tab-active)] text-[var(--npk-accent)]"
                  : "text-[var(--npk-dim)] hover:bg-[var(--npk-hover)] hover:text-[var(--npk-t2)]",
              )}
            >
              {icon}
              {label}
            </button>
          )
        })}
      </div>
      {/* Fade painted in the surface colour so the strip reads as clipped, not cut. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 w-5 bg-gradient-to-l from-[var(--npk-surface)] to-transparent"
      />
    </div>
  )
}
