"use client";

import { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy, type ReactNode } from "react";
import {
  Type,
  List,
  BookOpen,
  ImageIcon,
  Film,
  Merge,
  Upload,
  Video,
  Rss,
  Palette,
  PaintBucket,
  Server,
  Hash,
  Clock,
  RatioIcon,
  Mic,
  ShieldCheck,
  Volume2,
  Captions,
  Maximize,
  AudioLines,
  VolumeX,
  Music,
  SlidersHorizontal,
  Scissors,
  Frame,
  Aperture,
  Lightbulb,
  SwatchBook,
  CloudFog,
  Brush,
  Mountain,
  Globe,
  HardDrive,
  Webhook,
  Clapperboard,
  UserPlus,
  Package,
  MapPin,
  ChevronRight,
  Search,
  Download,
  ArrowLeft,
  Wand2,
  Layers,
  Users,
  Waypoints,
  ArrowUpFromLine,
  ScanSearch,
  SearchCheck,
  FileText,
  Disc3,
  FastForward,
  Smile,
  Sparkles,
  Repeat,
  Gauge,
  SunDim,
  RefreshCw,
  Shapes,
  Box,
  AudioWaveform,
  Eye,
  Languages,
  AlignLeft,
  Workflow,
  LogIn,
  LogOut,
  Share2,
  Instagram,
  Youtube,
  Linkedin,
  Twitter,
  Facebook,
  StickyNote,
  UserRound,
  Send,
  GitBranch,
  Puzzle,
  MessageSquare,
  ZoomIn,
  Eraser,
  ListMusic,
  Braces,
  Filter,
  Funnel,
  ListFilter,
  ListTree,
  CopyMinus,
  GitMerge,
  ArrowUpDown,
  PersonStanding,
  Gem,
  PawPrint,
  Car,
  Swords,
  Armchair,
  Camera,
  Hourglass,
  Cpu,
  LayoutDashboard,
  HandMetal,
  Zap,
  Activity,
  Piano,
  User,
  MessageCircle,
  ScanFace,
  VenetianMask,
  Paintbrush,
  LayoutGrid,
  Link2,
} from "lucide-react";
import type { Connection } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/use-click-outside";
import { clusterByGroup } from "@/lib/cluster-by-group";
import { categoryRank } from "@/lib/node-category-order";
import type { SceneNodeType } from "@/types/nodes";
import type { ConnectionContext, NodeOption } from "@/lib/node-compatibility";
import { getCompatibleNodes, resolveTargetHandle, PARAMETER_ACCEPTING_HANDLE_IDS } from "@/lib/node-compatibility";
import { buildPrefillInitialData } from "@/lib/node-name-field";
import {
  readAddNodeMenuTab,
  persistAddNodeMenuTab,
  nextAddNodeMenuTab,
  readCreativeControlsOpen,
  persistCreativeControlsOpen,
  type AddNodeMenuTab,
} from "@/lib/add-node-menu-tab";
import { sectionsForTab, tabTypeSet } from "@/lib/node-picker-sections";
import { familyLabel } from "@/lib/node-families";
import {
  SearchOwnBlock,
  SearchOtherBlock,
  SearchEmptyState,
} from "./add-node-popup/picker-search-results";
import { COMMON_SECTIONS as COMMON_TAB_SECTIONS } from "@/lib/node-families";
import { PickerTabBar } from "./add-node-popup/picker-tab-bar";
import {
  PickerSectionList,
  flattenSections,
  isCreativeControlsNavItem,
} from "./add-node-popup/picker-section-list";
import { searchModelVariants, type ModelKind, type ModelTreeVariant } from "@nodaro/shared"
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useUserSettings } from "@/hooks/queries/use-user-settings-queries";
import { useNodeSelectionHistoryStore, type HistoryEntry } from "@/hooks/use-node-selection-history-store";
import { useWorkflowStore } from "@/hooks/use-workflow-store";
import { Switch } from "@/components/ui/switch";
import { enumerateConnectionOptionsCore } from "@/lib/enumerate-connection-options";
import { getAutoConnectPref, setAutoConnectPref } from "@/lib/auto-connect-pref";
import { hasCredits } from "@/lib/edition";
import { CLOUD_ONLY_NODE_TYPES } from "@/lib/cloud-only-nodes";

const ComponentMarketplaceModal = lazy(() => import("./component-marketplace-modal").then(m => ({ default: m.ComponentMarketplaceModal })));
import type { ComponentSelection } from "./component-marketplace-modal";
import { ModelsTab, VariantRow, variantToSelection, type ModelSelection } from "./models-tab";

const EMPTY_SET = new Set<string>();

export const NODE_OPTIONS: ReadonlyArray<NodeOption> = [
  // Input
  {
    type: "text-prompt",
    label: "Text",
    icon: <Type className="h-4 w-4" />,
    category: "Input",
    group: "automate-text",
    // Renamed from "Text Prompt" → "Text"; keep "prompt" searchable so users
    // who look for "prompt" still find this node.
    keywords: ["prompt", "text prompt"],
  },
  {
    type: "upload-image",
    label: "Upload Image",
    icon: <Upload className="h-4 w-4" />,
    category: "Input",
    group: "image-add-your-own",
  },
  {
    type: "upload-video",
    label: "Upload Video",
    icon: <Video className="h-4 w-4" />,
    category: "Input",
    group: "video-add-your-own",
  },
  {
    type: "upload-audio",
    label: "Upload Audio",
    icon: <Music className="h-4 w-4" />,
    category: "Input",
    group: "audio-add-your-own",
  },
  // Hidden — uncomment to restore in the Add Node UI:
  // {
  //   type: "rss-feed",
  //   label: "RSS Feed",
  //   icon: <Rss className="h-4 w-4" />,
  //   category: "Input",
  // },
  {
    type: "youtube-video",
    label: "Video URL",
    icon: <Video className="h-4 w-4" />,
    category: "Input",
    group: "automate-get-content",
  },
  {
    type: "reference-audio",
    label: "Reference Audio",
    icon: <Music className="h-4 w-4" />,
    category: "Input",
    group: "audio-add-your-own",
  },
  // Triggers
  {
    type: "webhook-trigger" as const,
    label: "Webhook Trigger",
    icon: <Webhook className="h-4 w-4" />,
    category: "Triggers",
    group: "automate-triggers",
  },
  {
    type: "schedule-trigger" as const,
    label: "Schedule Trigger",
    group: "automate-triggers",
    icon: <Clock className="h-4 w-4" />,
    category: "Triggers",
  },
  {
    type: "telegram-trigger",
    label: "Telegram Trigger",
    icon: <Send className="h-4 w-4" />,
    category: "Triggers",
    group: "automate-triggers",
  },
  {
    type: "telegram-channel-feed",
    label: "Telegram Channel Feed",
    icon: <Rss className="h-4 w-4" />,
    category: "Input",
    group: "automate-get-content",
    keywords: ["telegram", "channel", "feed", "monitor", "follow", "scrape", "rss"],
  },
  // Data
  {
    type: "list",
    label: "List",
    icon: <List className="h-4 w-4" />,
    category: "Data",
    group: "automate-lists",
  },
  {
    type: "web-scrape",
    label: "Web Scrape",
    icon: <Globe className="h-4 w-4" />,
    category: "Data",
    group: "automate-get-content",
  },
  // Hidden — uncomment to restore in the Add Node UI:
  // {
  //   type: "json-process",
  //   label: "JSON Process",
  //   icon: <Filter className="h-4 w-4" />,
  //   category: "Data",
  // },
  {
    type: "extract-field",
    label: "Extract Field",
    icon: <Braces className="h-4 w-4" />,
    category: "Data",
    group: "automate-logic",
  },
  {
    type: "filter-list",
    label: "Filter List",
    icon: <ListFilter className="h-4 w-4" />,
    category: "Data",
    group: "automate-lists",
  },
  {
    type: "deduplicate",
    label: "Remove Duplicates",
    icon: <CopyMinus className="h-4 w-4" />,
    category: "Data",
    group: "automate-lists",
  },
  {
    type: "merge-lists",
    label: "Merge Lists",
    icon: <GitMerge className="h-4 w-4" />,
    category: "Data",
    group: "automate-lists",
  },
  {
    type: "sort-list",
    label: "Sort List",
    icon: <ArrowUpDown className="h-4 w-4" />,
    category: "Data",
    group: "automate-lists",
  },
  {
    type: "selector",
    label: "Selector",
    icon: <ListTree className="h-4 w-4" />,
    category: "Data",
    group: "automate-lists",
  },
  // Parameter
  {
    type: "tone",
    label: "Tone",
    icon: <Palette className="h-4 w-4" />,
    category: "Parameter",
    group: "models-generation-settings",
  },
  {
    type: "style-guide",
    label: "Style Guide",
    icon: <PaintBucket className="h-4 w-4" />,
    category: "Parameter",
    group: "models-generation-settings",
  },
  {
    type: "provider",
    label: "Provider",
    icon: <Server className="h-4 w-4" />,
    category: "Parameter",
    group: "models-generation-settings",
  },
  {
    type: "scene-count",
    label: "Scene Count",
    icon: <Hash className="h-4 w-4" />,
    category: "Parameter",
    group: "models-generation-settings",
  },
  {
    type: "duration",
    label: "Duration",
    icon: <Clock className="h-4 w-4" />,
    category: "Parameter",
    group: "models-generation-settings",
  },
  {
    type: "aspect-ratio",
    label: "Aspect Ratio",
    icon: <RatioIcon className="h-4 w-4" />,
    category: "Parameter",
    group: "models-generation-settings",
  },
  {
    type: "motion",
    label: "Motion",
    icon: <SlidersHorizontal className="h-4 w-4" />,
    category: "Parameter",
    group: "models-generation-settings",
  },
  {
    type: "camera-motion",
    label: "Camera Motion",
    icon: <Video className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-motion-time",
    keywords: ["camera", "shot", "movement", "orbit", "pan", "tilt", "dolly", "crane", "zoom"],
  },
  {
    type: "transition",
    label: "Transition",
    icon: <GitBranch className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-effects",
    keywords: ["transition", "cut", "dissolve", "fade", "wipe", "morph", "blend", "cross", "scene change"],
  },
  {
    type: "framing",
    label: "Framing",
    icon: <Frame className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-camera",
    keywords: ["camera", "shot", "composition", "close-up", "wide", "angle", "vantage"],
  },
  {
    type: "lens",
    label: "Lens",
    icon: <Aperture className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-camera",
    keywords: ["camera", "optics", "focal length", "bokeh", "depth of field", "anamorphic", "fisheye"],
  },
  {
    type: "camera-format",
    label: "Camera / Film Stock",
    icon: <Film className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-camera",
    keywords: ["camera", "film", "35mm", "super 8", "vhs", "imax", "stock", "format"],
  },
  {
    type: "lighting",
    label: "Lighting",
    icon: <Lightbulb className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-light-look",
    keywords: ["light", "rembrandt", "chiaroscuro", "golden hour", "key", "rim", "shot"],
  },
  {
    type: "color-look",
    label: "Color / Look",
    icon: <SwatchBook className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-light-look",
    keywords: ["color", "grade", "palette", "lut", "kodak", "fuji", "teal orange", "shot"],
  },
  {
    type: "atmosphere",
    label: "Atmosphere",
    icon: <CloudFog className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-light-look",
    keywords: ["weather", "fog", "rain", "snow", "smoke", "god rays", "particles", "shot"],
  },
  {
    type: "action-fx",
    label: "Action FX",
    icon: <Zap className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-effects",
    keywords: ["explosion", "lightning", "storm", "earthquake", "fire", "laser", "magic", "blast", "fx", "vfx", "action", "shockwave", "force field", "sci-fi"],
  },
  {
    type: "character-fx",
    label: "Character FX",
    icon: <Sparkles className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-effects",
    keywords: ["character", "fx", "effect", "expression", "emotion", "gesture", "blink", "wink", "laugh", "cry", "smile", "frown", "shiver", "tremble", "gasp", "reaction"],
  },
  {
    type: "style",
    label: "Style",
    icon: <Brush className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-light-look",
    keywords: ["anime", "oil painting", "watercolor", "cinematic", "photorealistic", "comic", "pixel art", "pop art", "noir", "illustration", "rendering"],
  },
  {
    type: "setting",
    label: "Setting",
    icon: <Mountain className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-scene",
    keywords: ["place", "environment", "location", "scene", "forest", "cafe", "alley", "cathedral", "desert", "cyberpunk", "fantasy", "indoor", "urban", "nature"],
  },
  {
    type: "loop-subject",
    label: "Loop Subject",
    icon: <Sparkles className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-scene",
    keywords: ["loop", "loopable", "seamless", "tunnel", "kaleidoscope", "fractal", "aurora", "particle", "vj", "background", "perfect loop", "veo loop"],
  },
  {
    type: "person",
    label: "Person",
    icon: <UserRound className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-subject",
    keywords: ["subject", "character", "people", "human", "gender", "age", "ethnicity", "hair", "skin", "eyes", "build", "man", "woman", "child", "beard", "mustache"],
  },
  {
    type: "mood",
    label: "Mood",
    icon: <Smile className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-light-look",
    keywords: ["emotion", "expression", "feeling", "happy", "sad", "angry", "serene", "fierce", "brooding", "confident", "melancholy", "mysterious"],
  },
  {
    type: "photographer",
    label: "Photographer / Artist Style",
    icon: <Camera className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-light-look",
    keywords: ["photographer", "artist", "style", "tim walker", "deakins", "lubezki", "fashion", "editorial", "cinematographer", "illustrator", "painter", "ghibli", "rutkowski", "leibovitz", "cartier-bresson"],
  },
  {
    type: "aesthetic",
    label: "Aesthetic / Microtrend",
    icon: <Sparkles className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-light-look",
    keywords: ["aesthetic", "microtrend", "core", "y2k", "cottagecore", "dark academia", "techwear", "gorpcore", "old money", "preppy", "streetwear", "coquette", "indie sleaze", "balletcore", "goblincore", "minimalism", "maximalism", "vibe"],
  },
  {
    type: "era",
    label: "Era / Period",
    icon: <Hourglass className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-scene",
    keywords: ["era", "period", "decade", "1920s", "1950s", "1970s", "1980s", "1990s", "2000s", "victorian", "medieval", "renaissance", "wild west", "feudal japan", "cyberpunk", "post-apocalyptic", "retrofuturism", "dieselpunk", "atompunk", "vintage", "future"],
  },
  {
    type: "pose",
    label: "Pose",
    icon: <PersonStanding className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-wardrobe-pose",
    keywords: ["pose", "posture", "action", "stance", "standing", "sitting", "running", "walking", "dancing", "jumping", "fighting", "body", "position"],
  },
  {
    type: "styling",
    label: "Styling",
    icon: <Gem className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-wardrobe-pose",
    keywords: ["beauty", "makeup", "glamour", "smoky eye", "lipstick", "eyewear", "sunglasses", "aviators", "headwear", "hat", "beanie", "fedora", "jewelry", "necklace", "earrings", "nails", "manicure", "face paint", "fabric", "silk", "leather", "denim", "velvet", "satin", "lace"],
  },
  {
    type: "material",
    label: "Material",
    icon: <Layers className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-scene",
    keywords: ["material", "fabric", "metal", "stone", "wood", "glass", "silk", "leather", "chrome", "marble", "gold", "silver", "bronze", "velvet", "porcelain", "crystal", "holographic", "iridescent", "neon", "made of"],
  },
  {
    type: "animal",
    label: "Animal",
    icon: <PawPrint className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-subject",
    keywords: ["animal", "cat", "dog", "bird", "fish", "horse", "lion", "tiger", "bear", "wolf", "fox", "elephant", "pet", "wildlife", "dinosaur", "dragon"],
  },
  {
    type: "vehicle",
    label: "Vehicle",
    icon: <Car className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-subject",
    keywords: ["vehicle", "car", "truck", "motorcycle", "bike", "boat", "plane", "helicopter", "tank", "spaceship", "muscle", "classic", "sports", "transport"],
  },
  {
    type: "weapon",
    label: "Weapon",
    icon: <Swords className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-subject",
    keywords: ["weapon", "sword", "katana", "gun", "rifle", "pistol", "bow", "dagger", "axe", "spear", "mace", "crossbow", "firearm", "blade"],
  },
  {
    type: "furniture",
    label: "Furniture",
    icon: <Armchair className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-scene",
    keywords: ["furniture", "chair", "sofa", "couch", "table", "desk", "bed", "lamp", "cabinet", "shelf", "wardrobe", "stool"],
  },
  {
    type: "photo-genre",
    label: "Photo Genre",
    icon: <Camera className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-light-look",
    keywords: ["photo", "genre", "intent", "paparazzi", "editorial", "vogue", "lookbook", "selfie", "mirror selfie", "gym selfie", "headshot", "mugshot", "passport", "yearbook", "wedding", "movie poster", "album cover", "advertising", "documentary", "snapshot", "noir"],
  },
  {
    type: "backdrop",
    label: "Backdrop",
    icon: <LayoutDashboard className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-scene",
    keywords: ["backdrop", "background", "studio", "seamless", "wall", "gradient", "muslin", "velvet", "halo", "bokeh", "vignette", "white seamless", "black seamless", "brick wall", "concrete"],
  },
  {
    type: "held-prop",
    label: "Held Prop",
    icon: <HandMetal className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-scene",
    keywords: ["prop", "hand", "holding", "phone", "cigarette", "coffee", "wine", "microphone", "book", "umbrella", "bouquet", "guitar", "katana", "drink", "smoking", "instrument", "bag"],
  },
  {
    type: "temporal",
    label: "Temporal",
    icon: <Clock className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-motion-time",
    keywords: ["time", "speed", "slow motion", "freeze", "bullet time", "shutter", "shot"],
  },
  {
    type: "exposure-settings",
    label: "Exposure Settings",
    icon: <Aperture className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-camera",
    keywords: ["exposure", "aperture", "f-stop", "shutter", "iso", "depth of field", "bokeh", "grain", "long exposure", "freeze"],
  },
  {
    type: "render-quality",
    label: "Render Quality",
    icon: <Cpu className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-light-look",
    keywords: ["render", "engine", "unreal", "octane", "cycles", "raytracing", "pbr", "8k", "4k", "masterpiece", "raw", "award-winning", "lumen", "global illumination"],
  },
  {
    type: "composition-effects",
    label: "Composition Effects",
    icon: <Wand2 className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-effects",
    keywords: ["composition", "frame", "burst", "shatter", "smoke", "liquid", "pixel", "particles", "glitch", "mosaic", "silhouette", "exploding", "fragment", "glass", "trick"],
  },
  {
    type: "post-process-effects",
    label: "Post-Process Effects",
    icon: <Sparkles className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-effects",
    keywords: ["post", "grade", "vignette", "grain", "halation", "bloom", "chromatic aberration", "light leak", "film burn", "scratched", "diffusion", "contrast", "glow"],
  },
  // Sound
  {
    type: "music-genre",
    label: "Music Genre",
    icon: <Music className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-music-voice",
    keywords: ["music", "genre", "rock", "pop", "electronic"],
  },
  {
    type: "music-mood",
    label: "Music Mood",
    icon: <Activity className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-music-voice",
    keywords: ["music", "mood", "energy", "emotion", "vibe"],
  },
  {
    type: "instrumentation",
    label: "Instrumentation",
    icon: <Piano className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-music-voice",
    keywords: ["instruments", "guitar", "piano", "drums"],
  },
  {
    type: "voice-character",
    label: "Voice Character",
    icon: <User className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-music-voice",
    keywords: ["voice", "age", "gender", "accent", "timbre"],
  },
  {
    type: "voice-delivery",
    label: "Voice Delivery",
    icon: <MessageCircle className="h-4 w-4" />,
    category: "Pickers",
    group: "cc-music-voice",
    keywords: ["voice", "pace", "emotion", "narrator"],
  },
  // AI — Script & Text
  {
    type: "generate-script",
    label: "Generate Script",
    icon: <BookOpen className="h-4 w-4" />,
    category: "AI",
    group: "video-story-script",
  },
  {
    type: "llm-chat",
    label: "Generate Text",
    icon: <MessageSquare className="h-4 w-4" />,
    category: "AI",
    group: "automate-text",
  },
  {
    type: "transcribe",
    label: "Transcribe",
    icon: <FileText className="h-4 w-4" />,
    category: "AI",
    group: "audio-transcribe",
  },
  // AI — Image
  {
    type: "generate-image",
    label: "Generate Image",
    icon: <ImageIcon className="h-4 w-4" />,
    category: "AI",
    group: "image-create",
  },
  {
    type: "modify-image",
    label: "Modify Image",
    icon: <Layers className="h-4 w-4" />,
    category: "AI",
    group: "image-edit-retouch",
  },
  {
    type: "upscale-image",
    label: "Upscale Image",
    icon: <ZoomIn className="h-4 w-4" />,
    category: "AI",
    group: "image-edit-retouch",
  },
  {
    type: "remove-background",
    label: "Remove Background",
    icon: <Eraser className="h-4 w-4" />,
    category: "AI",
    group: "image-edit-retouch",
  },
  {
    type: "generate-mask",
    label: "Generate Mask",
    icon: <VenetianMask className="h-4 w-4" />,
    category: "AI",
    group: "image-edit-retouch",
  },
  {
    type: "paint-mask",
    label: "Paint Mask",
    icon: <Paintbrush className="h-4 w-4" />,
    category: "Processing",
    group: "image-edit-retouch",
    keywords: ["mask", "paint", "brush", "inpaint", "matte", "hand", "draw"],
  },
  {
    type: "reference-sheet",
    label: "Reference Sheet",
    icon: <LayoutGrid className="h-4 w-4" />,
    category: "AI",
    group: "image-references",
    keywords: ["sheet", "reference", "turnaround", "character sheet", "model sheet"],
  },
  {
    type: "reference-board",
    label: "Reference Board",
    icon: <LayoutGrid className="h-4 w-4" />,
    category: "AI",
    group: "image-references",
    keywords: ["board", "reference", "palette", "hero", "panels", "reference board"],
  },
  {
    type: "image-to-text",
    label: "Describe Image",
    icon: <Eye className="h-4 w-4" />,
    category: "AI",
    group: "image-understand",
  },
  {
    type: "describe-to-picker",
    label: "Describe to Picker",
    icon: <ScanFace className="h-4 w-4" />,
    category: "AI",
    group: "image-understand",
  },
  // AI — Video
  {
    type: "generate-video",
    label: "Generate Video",
    icon: <Clapperboard className="h-4 w-4" />,
    category: "AI",
    group: "video-create",
    keywords: ["image-to-video", "text-to-video", "i2v", "t2v", "video"],
  },
  {
    type: "generate-video-pro",
    label: "Generate Video Pro",
    icon: <Clapperboard className="h-4 w-4" />,
    category: "AI",
    group: "video-create",
    keywords: ["long-form", "long video", "multi-segment", "stitch", "extended duration", "seedance", "pro"],
  },
  {
    type: "edit-video-pro",
    label: "Edit Video Pro",
    icon: <Scissors className="h-4 w-4" />,
    category: "AI",
    group: "video-continue-restyle",
    keywords: ["retake", "replace span", "edit clip", "seedance", "pro", "reshoot"],
  },
  {
    type: "video-to-video",
    label: "Video to Video",
    icon: <Film className="h-4 w-4" />,
    category: "AI",
    group: "video-continue-restyle",
  },
  {
    type: "switchx",
    label: "Relight & Switch",
    icon: <Wand2 className="h-4 w-4" />,
    category: "AI",
    group: "video-continue-restyle",
    keywords: ["relight", "relighting", "relit", "lighting", "switch", "swap background", "replace background", "change background", "scene swap", "restyle", "recolor", "composite", "compositing", "green screen", "chroma key", "rotoscope", "matte", "alpha", "color match", "harmonize", "vfx", "video to video", "beeble"],
  },
  {
    type: "generative-pipeline",
    label: "Story → Video",
    icon: <Film className="h-4 w-4" />,
    category: "AI",
    group: "video-story-script",
    keywords: ["story", "pipeline", "trailer", "short film", "music video", "reel", "commercial", "cinematic"],
  },
  {
    type: "ai-avatar",
    label: "AI Avatar",
    icon: <UserRound className="h-4 w-4" />,
    category: "AI",
    group: "video-animate-perform",
    keywords: ["heygen", "talking avatar", "avatar", "talking head", "voice", "tts"],
  },
  {
    type: "cinematic-avatar",
    label: "Cinematic Avatar",
    icon: <Clapperboard className="h-4 w-4" />,
    category: "AI",
    group: "video-animate-perform",
    keywords: ["heygen", "cinematic", "avatar", "generative", "prompt", "looks", "seedance"],
  },
  {
    type: "lip-sync",
    label: "Lip Sync",
    icon: <Users className="h-4 w-4" />,
    category: "AI",
    group: "video-animate-perform",
  },
  {
    type: "speech-to-video",
    label: "Speech to Video",
    icon: <AudioLines className="h-4 w-4" />,
    category: "AI",
    group: "video-animate-perform",
  },
  {
    type: "motion-transfer",
    label: "Motion Transfer",
    icon: <Waypoints className="h-4 w-4" />,
    category: "AI",
    group: "video-animate-perform",
  },
  {
    type: "extend-video",
    label: "Extend Video",
    icon: <FastForward className="h-4 w-4" />,
    category: "AI",
    group: "video-continue-restyle",
  },
  {
    type: "video-retake",
    label: "Retake Video",
    icon: <Scissors className="h-4 w-4" />,
    category: "AI",
    group: "video-continue-restyle",
    keywords: ["retake", "replace audio", "replace video", "ltx", "ltx-2.3"],
  },
  {
    type: "face-swap",
    label: "Face Swap",
    icon: <ScanFace className="h-4 w-4" />,
    category: "AI",
    group: "video-animate-perform",
  },
  {
    type: "video-sfx",
    label: "Video SFX",
    icon: <AudioWaveform className="h-4 w-4" />,
    category: "AI",
    group: "video-sound",
    keywords: ["sfx", "foley", "sound effects", "mmaudio", "audio", "sound"],
  },
  // AI — Audio & Speech
  {
    type: "text-to-speech",
    label: "Text to Speech",
    icon: <Mic className="h-4 w-4" />,
    category: "AI",
    group: "audio-speech",
  },
  {
    type: "text-to-audio",
    label: "Text to Audio",
    icon: <Volume2 className="h-4 w-4" />,
    category: "AI",
    group: "audio-sfx",
  },
  {
    type: "audio-isolation",
    label: "Voice Extractor",
    icon: <AudioWaveform className="h-4 w-4" />,
    category: "AI",
    group: "audio-clean-separate",
  },
  {
    type: "audio-separation",
    label: "Audio Separation",
    icon: <Scissors className="h-4 w-4" />,
    category: "AI",
    group: "audio-clean-separate",
  },
  {
    type: "text-to-dialogue",
    label: "Text to Dialogue",
    icon: <Users className="h-4 w-4" />,
    category: "AI",
    group: "audio-speech",
  },
  {
    type: "voice-changer",
    label: "Voice Changer",
    icon: <AudioWaveform className="h-4 w-4" />,
    category: "AI",
    group: "audio-voices",
  },
  {
    type: "voice-changer-pro",
    label: "Voice Changer Pro",
    icon: <AudioWaveform className="h-4 w-4" />,
    category: "AI",
    group: "audio-voices",
  },
  {
    type: "dubbing",
    label: "Dubbing",
    icon: <Languages className="h-4 w-4" />,
    category: "AI",
    group: "audio-voices",
  },
  {
    type: "voice-remix",
    label: "Voice Remix",
    icon: <Mic className="h-4 w-4" />,
    category: "AI",
    group: "audio-voices",
  },
  {
    type: "voice-design",
    label: "Voice Design",
    icon: <Wand2 className="h-4 w-4" />,
    category: "AI",
    group: "audio-voices",
  },
  {
    type: "forced-alignment",
    label: "Forced Alignment",
    icon: <AlignLeft className="h-4 w-4" />,
    category: "AI",
    group: "audio-transcribe",
  },
  {
    type: "generate-music",
    label: "Generate Music",
    icon: <Music className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  // AI — Suno Music
  {
    type: "suno-voice",
    label: "Suno Voice",
    icon: <Mic className="h-4 w-4" />,
    category: "AI",
    group: "cc-music-voice",
  },
  {
    type: "suno-generate",
    label: "Suno Create Music",
    icon: <Music className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  {
    type: "suno-cover",
    label: "Suno Cover",
    icon: <Disc3 className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  {
    type: "suno-extend",
    label: "Suno Extend",
    icon: <FastForward className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  {
    type: "suno-lyrics",
    label: "Suno Lyrics",
    icon: <FileText className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  {
    type: "suno-separate",
    label: "Suno Separate",
    icon: <Scissors className="h-4 w-4" />,
    category: "AI",
    group: "audio-clean-separate",
  },
  {
    type: "suno-music-video",
    label: "Music Video",
    icon: <Film className="h-4 w-4" />,
    category: "AI",
    group: "video-create",
  },
  {
    type: "suno-mashup",
    label: "Suno Mashup",
    icon: <Merge className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  {
    type: "suno-replace-section",
    label: "Suno Replace Section",
    icon: <Scissors className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  {
    type: "suno-style-boost",
    label: "Suno Style Boost",
    icon: <Sparkles className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  {
    type: "suno-add-instrumental",
    label: "Suno Add Instrumental",
    icon: <Music className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  {
    type: "suno-add-vocals",
    label: "Suno Add Vocals",
    icon: <Mic className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  {
    type: "suno-convert-wav",
    label: "Suno Convert WAV",
    icon: <AudioLines className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  {
    type: "suno-upload-extend",
    label: "Suno Upload Extend",
    icon: <FastForward className="h-4 w-4" />,
    category: "AI",
    group: "audio-music",
  },
  // AI — Quality
  {
    type: "qa-check",
    label: "QA Check",
    icon: <ShieldCheck className="h-4 w-4" />,
    category: "AI",
    group: "automate-logic",
    adminOnly: true,
  },
  {
    type: "image-critic",
    label: "Image Critic",
    icon: <Eye className="h-4 w-4" />,
    category: "AI",
    group: "image-understand",
    // adminOnly NOT set — image-critic is user-facing (qa-check is admin-only; we deliberately differ)
  },
  // Processing — Image
  {
    type: "image-collage",
    label: "Image Collage",
    icon: <LayoutGrid className="h-4 w-4" />,
    category: "Processing",
    group: "image-edit-retouch",
    keywords: ["collage", "grid", "montage", "mosaic", "combine images", "contact sheet", "tile"],
  },
  // Processing — Video
  {
    type: "combine-videos",
    label: "Combine Videos",
    icon: <Merge className="h-4 w-4" />,
    category: "Processing",
    group: "video-cut-assemble",
  },
  {
    type: "assemble-narrated-video",
    label: "Assemble Narrated Video",
    icon: <Merge className="h-4 w-4" />,
    category: "Processing",
    group: "video-cut-assemble",
    keywords: ["narration", "voiceover", "narrated", "audio-led", "montage", "assemble"],
  },
  {
    type: "resize-video",
    label: "Resize Video",
    icon: <Maximize className="h-4 w-4" />,
    category: "Processing",
    group: "video-format-export",
  },
  {
    type: "social-media-format",
    label: "Social Media Format",
    icon: <Share2 className="h-4 w-4" />,
    category: "Processing",
    group: "video-format-export",
  },
  {
    type: "trim-video",
    label: "Trim Video",
    icon: <Scissors className="h-4 w-4" />,
    category: "Processing",
    group: "video-cut-assemble",
  },
  {
    type: "extract-frame",
    label: "Extract Frame",
    icon: <Frame className="h-4 w-4" />,
    category: "Processing",
    group: "image-edit-retouch",
  },
  {
    type: "video-upscale",
    label: "Upscale Video",
    icon: <ArrowUpFromLine className="h-4 w-4" />,
    category: "Processing",
    group: "video-format-export",
  },
  {
    type: "add-captions",
    label: "Add Captions",
    icon: <Captions className="h-4 w-4" />,
    category: "Processing",
    group: "video-titles-graphics",
  },
  {
    type: "video-analysis",
    label: "Video Analysis",
    icon: <ScanSearch className="h-4 w-4" />,
    category: "Processing",
    group: "video-analyze",
    keywords: ["analyze video", "scene breakdown", "shot list", "understand video", "describe video", "storyboard from video"],
  },
  {
    type: "video-audit",
    label: "AI Audit",
    icon: <SearchCheck className="h-4 w-4" />,
    category: "Processing",
    group: "video-analyze",
    keywords: ["audit", "ai audit", "verify analysis", "check analysis", "fact check video", "qa analysis", "review scene breakdown", "correct analysis"],
  },
  // Processing — Video Production
  {
    type: "video-composer",
    label: "Compose Video",
    icon: <Sparkles className="h-4 w-4" />,
    category: "Processing",
    group: "video-cut-assemble",
  },
  {
    type: "after-effects",
    label: "After Effects",
    icon: <Wand2 className="h-4 w-4" />,
    category: "Processing",
    group: "video-titles-graphics",
  },
  {
    type: "lottie-overlay",
    label: "Lottie Overlay",
    icon: <Layers className="h-4 w-4" />,
    category: "Processing",
    group: "video-titles-graphics",
  },
  {
    type: "3d-title",
    label: "3D Title",
    icon: <Box className="h-4 w-4" />,
    category: "Processing",
    group: "video-titles-graphics",
  },
  {
    type: "motion-graphics",
    label: "Motion Graphics",
    icon: <Shapes className="h-4 w-4" />,
    category: "Processing",
    group: "video-titles-graphics",
  },
  {
    type: "composite",
    label: "Composite",
    icon: <Layers className="h-4 w-4" />,
    category: "Processing",
    group: "video-cut-assemble",
  },
  {
    type: "render-video",
    label: "Render Video",
    icon: <Film className="h-4 w-4" />,
    category: "Processing",
    group: "video-titles-graphics",
  },
  {
    type: "speed-ramp",
    label: "Adjust Speed",
    icon: <Gauge className="h-4 w-4" />,
    category: "Processing",
    group: "video-cut-assemble",
  },
  {
    type: "loop-video",
    label: "Loop Video",
    icon: <Repeat className="h-4 w-4" />,
    category: "Processing",
    group: "video-cut-assemble",
  },
  {
    type: "fade-video",
    label: "Fade In/Out",
    icon: <SunDim className="h-4 w-4" />,
    category: "Processing",
    group: "video-cut-assemble",
  },
  {
    type: "transcode-video",
    label: "Transcode Video",
    icon: <RefreshCw className="h-4 w-4" />,
    category: "Processing",
    group: "video-format-export",
  },
  {
    type: "manual-edit",
    label: "Manual Edit",
    icon: <Scissors className="h-4 w-4" />,
    category: "Processing",
    group: "video-cut-assemble",
  },
  // Processing — Audio
  {
    type: "merge-video-audio",
    label: "Merge Video & Audio",
    icon: <Volume2 className="h-4 w-4" />,
    category: "Processing",
    group: "video-sound",
  },
  {
    type: "trim-audio",
    label: "Trim Audio",
    icon: <AudioLines className="h-4 w-4" />,
    category: "Processing",
    group: "audio-edit",
  },
  {
    type: "split-media",
    label: "Split into Chunks",
    icon: <Scissors className="h-4 w-4" />,
    category: "Processing",
    group: "video-cut-assemble",
  },
  {
    type: "extract-audio",
    label: "Extract Audio",
    icon: <AudioLines className="h-4 w-4" />,
    category: "Processing",
    group: "video-sound",
    keywords: ["extract audio", "rip audio", "audio from video", "demux", "detach audio", "get audio", "mp3", "split video audio"],
  },
  {
    type: "remove-audio",
    label: "Remove Audio",
    icon: <VolumeX className="h-4 w-4" />,
    category: "Processing",
    group: "video-sound",
    keywords: ["remove audio", "mute", "strip audio", "silent video", "delete audio", "no sound", "detach audio", "split video audio"],
  },
  {
    type: "mix-audio",
    label: "Mix Audio",
    icon: <Music className="h-4 w-4" />,
    category: "Processing",
    group: "audio-edit",
  },
  {
    type: "combine-audio",
    label: "Combine Audio",
    icon: <ListMusic className="h-4 w-4" />,
    category: "Processing",
    group: "audio-edit",
  },
  {
    type: "adjust-volume",
    label: "Adjust Volume",
    icon: <SlidersHorizontal className="h-4 w-4" />,
    category: "Processing",
    group: "audio-edit",
  },
  {
    type: "audio-fx",
    label: "Audio FX",
    icon: <SlidersHorizontal className="h-4 w-4" />,
    category: "Processing",
    group: "audio-edit",
  },
  // Processing — Text
  {
    type: "combine-text",
    label: "Combine Text",
    icon: <Merge className="h-4 w-4" />,
    category: "Processing",
    group: "automate-text",
  },
  {
    type: "split-text",
    label: "Split Text",
    icon: <Scissors className="h-4 w-4" />,
    category: "Processing",
    group: "automate-text",
  },
  // Assets
  {
    type: "character",
    label: "Character Asset",
    icon: <UserPlus className="h-4 w-4" />,
    category: "Assets",
    group: "assets-characters",
  },
  {
    type: "object",
    label: "Object/Props Asset",
    icon: <Package className="h-4 w-4" />,
    category: "Assets",
    group: "assets-objects",
  },
  {
    type: "creature",
    label: "Animal/Creature Asset",
    icon: <PawPrint className="h-4 w-4" />,
    category: "Assets",
    group: "assets-creatures",
  },
  {
    type: "location",
    label: "Location Asset",
    icon: <MapPin className="h-4 w-4" />,
    category: "Assets",
    group: "assets-places",
  },
  {
    type: "face",
    label: "Create Face",
    icon: <Smile className="h-4 w-4" />,
    category: "Assets",
    group: "assets-characters",
  },
  // Scene (Phase 1B.2 pipeline-managed SceneNode — replaces legacy scene)
  {
    type: "scene",
    label: "Scene",
    icon: <Clapperboard className="h-4 w-4" />,
    category: "AI",
    group: "video-story-script",
    keywords: ["scene", "shot list", "storyboard", "camera", "pipeline"],
  },
  // Output
  {
    type: "save-to-storage",
    label: "Save to Storage",
    icon: <HardDrive className="h-4 w-4" />,
    category: "Output",
    group: "publish-export",
  },
  {
    type: "webhook-output",
    label: "Webhook Output",
    icon: <Webhook className="h-4 w-4" />,
    category: "Output",
    group: "publish-export",
  },
  // Output — Social Media
  {
    type: "instagram-post",
    label: "Instagram Post",
    icon: <Instagram className="h-4 w-4" />,
    category: "Output",
    group: "publish-platforms",
  },
  {
    type: "tiktok-post",
    label: "TikTok Post",
    icon: <Video className="h-4 w-4" />,
    category: "Output",
    group: "publish-platforms",
  },
  {
    type: "youtube-upload",
    label: "YouTube Upload",
    icon: <Youtube className="h-4 w-4" />,
    category: "Output",
    group: "publish-platforms",
  },
  {
    type: "linkedin-post",
    label: "LinkedIn Post",
    icon: <Linkedin className="h-4 w-4" />,
    category: "Output",
    group: "publish-platforms",
  },
  {
    type: "x-post",
    label: "X Post",
    icon: <Twitter className="h-4 w-4" />,
    category: "Output",
    group: "publish-platforms",
  },
  {
    type: "facebook-post",
    label: "Facebook Post",
    icon: <Facebook className="h-4 w-4" />,
    category: "Output",
    group: "publish-platforms",
  },
  {
    type: "telegram-post",
    label: "Telegram Post",
    icon: <Send className="h-4 w-4" />,
    category: "Output",
    group: "publish-platforms",
  },
  {
    type: "publish-social",
    label: "Publish to Social",
    icon: <Share2 className="h-4 w-4" />,
    category: "Output",
    group: "publish-one-click",
  },
  // Workflow
  {
    type: "sub-workflow-input",
    label: "Sub-Workflow Input",
    icon: <LogIn className="h-4 w-4" />,
    category: "Workflow",
    group: "automate-workflows",
  },
  {
    type: "sub-workflow-output",
    label: "Sub-Workflow Output",
    icon: <LogOut className="h-4 w-4" />,
    category: "Workflow",
    group: "automate-workflows",
  },
  {
    type: "sub-workflow",
    label: "Sub-Workflow",
    icon: <Workflow className="h-4 w-4" />,
    category: "Workflow",
    group: "automate-workflows",
  },
  {
    type: "teleport-send",
    label: "Teleport Send",
    icon: <Send className="h-4 w-4" />,
    category: "Workflow",
    group: "automate-canvas",
  },
  {
    type: "teleport-receive",
    label: "Teleport Receive",
    icon: <Download className="h-4 w-4" />,
    category: "Workflow",
    group: "automate-canvas",
  },
  {
    type: "router",
    label: "Router",
    icon: <GitBranch className="h-4 w-4" />,
    category: "Workflow",
    group: "automate-logic",
  },
  {
    type: "group",
    label: "Group",
    icon: <Box className="h-4 w-4" />,
    category: "Workflow",
    group: "automate-canvas",
    keywords: ["group", "container", "wrap"],
  },
  {
    type: "collect",
    label: "Collect",
    icon: <Layers className="h-4 w-4" />,
    category: "Workflow",
    group: "automate-lists",
    keywords: ["collect", "gather", "bucket", "by-type", "split-by-type"],
  },
  {
    type: "reduce",
    label: "Reduce",
    icon: <Funnel className="h-4 w-4" />,
    category: "Workflow",
    group: "automate-lists",
    keywords: ["reduce", "fan-in", "merge", "pick best", "join", "aggregate", "vote", "count"],
  },
  {
    type: "sticky-note",
    label: "Sticky Note",
    icon: <StickyNote className="h-4 w-4" />,
    category: "Workflow",
    group: "automate-canvas",
  },
  {
    type: "component" as SceneNodeType,
    label: "Component",
    icon: <Puzzle className="h-4 w-4" />,
    category: "Component",
    group: "automate-workflows",
  },
  {
    type: "preview",
    label: "Preview",
    icon: <Eye className="h-4 w-4" />,
    category: "Processing",
    group: "automate-canvas",
  },
];

/**
 * Returns `NODE_OPTIONS` filtered for the current edition.
 * Cloud-only nodes (`CLOUD_ONLY_NODE_TYPES`) are excluded when `hasCredits()` is false.
 * Use this instead of `NODE_OPTIONS` whenever building a user-visible list.
 */
export function getNodeOptions(): ReadonlyArray<NodeOption> {
  return NODE_OPTIONS.filter((o) => !CLOUD_ONLY_NODE_TYPES.has(o.type) || hasCredits());
}

export const VIRTUAL_CATEGORY_IDS = {
  recent: "Recent",
  common: "Common",
  commonPickers: "Common Pickers",
  models: "Models",
} as const;

const isNodeOption = (n: NodeOption | undefined): n is NodeOption => Boolean(n);

function mapHistoryToOptions(
  history: ReadonlyArray<HistoryEntry>,
  compare: (a: HistoryEntry, b: HistoryEntry) => number,
  optionByType: Map<SceneNodeType, NodeOption>,
): NodeOption[] {
  return history
    .slice()
    .sort(compare)
    .map((h) => optionByType.get(h.nodeType))
    .filter(isNodeOption);
}

/** Set view of the Common tab's membership, derived from the family registry
 *  so the two can never disagree. Search ranking puts these before
 *  non-common matches. */
export const COMMON_NODE_TYPES: ReadonlySet<SceneNodeType> = new Set(
  COMMON_TAB_SECTIONS.flatMap((s) => s.types),
);

export const CATEGORIES = [
  {
    id: VIRTUAL_CATEGORY_IDS.recent,
    label: "RECENT",
    icon: <Clock className="h-4 w-4" />,
    description: "Recently added nodes",
  },
  // "Common" is deliberately NOT a category here — it's the popup's Common
  // tab (see the tablist above the search box). The All tab shows this list.
  {
    id: "AI",
    label: "AI",
    icon: <BookOpen className="h-4 w-4" />,
    description: "Image, Video, Voice, Music",
  },
  {
    id: "Input",
    label: "INPUT",
    icon: <Download className="h-4 w-4" />,
    description: "Text, Images, Video",
  },
  {
    id: "Triggers",
    label: "TRIGGERS",
    icon: <Webhook className="h-4 w-4" />,
    description: "Webhook, Schedule, Telegram",
  },
  {
    id: "Data",
    label: "DATA",
    icon: <Filter className="h-4 w-4" />,
    description: "Scrape, Filter, Dedupe, Extract",
  },
  // Parameter category section is hidden — all Parameter-typed nodes are
  // already filtered out of `visibleNodes` (search for `n.category !== "Parameter"`),
  // so the section header was showing as an empty pane. Re-enable by restoring
  // the entry below alongside dropping the `visibleNodes` filter.
  // {
  //   id: "Parameter",
  //   label: "PARAMETER",
  //   icon: <SlidersHorizontal className="h-4 w-4" />,
  //   description: "Tone, Style, Duration",
  // },
  {
    id: "Pickers",
    label: "PICKERS",
    icon: <SlidersHorizontal className="h-4 w-4" />,
    description: "Camera, Look, Subject, Object, Sound",
  },
  {
    id: "Processing",
    label: "PROCESSING",
    icon: <Merge className="h-4 w-4" />,
    description: "Combine, Merge, Trim",
  },
  {
    id: "Assets",
    label: "ASSETS",
    icon: <UserPlus className="h-4 w-4" />,
    description: "Character, Face, Object, Location",
  },
  {
    id: "Output",
    label: "OUTPUT",
    icon: <HardDrive className="h-4 w-4" />,
    description: "Save, Webhook",
  },
  {
    id: "Workflow",
    label: "WORKFLOW",
    icon: <Workflow className="h-4 w-4" />,
    description: "Sub-Workflows, Teleport",
  },
  {
    id: "Component",
    label: "COMPONENT",
    icon: <Puzzle className="h-4 w-4" />,
    description: "Reusable Components",
  },
  // Models is a popup-only virtual root: it opens the series → variants model
  // browser (same as the Models tab). categoryRank pins it last in the All tab.
  {
    id: VIRTUAL_CATEGORY_IDS.models,
    label: "MODELS",
    icon: <Layers className="h-4 w-4" />,
    description: "Image, Video & Audio models",
  },
].sort((a, b) => categoryRank(a.id) - categoryRank(b.id));

/** Filter a node pool by a search query (label / type / category / keywords)
 *  and rank the matches: direct-match tier first (edge-drop context), then
 *  COMMON nodes, then the rest — pool order preserved within each bucket
 *  (Array.prototype.sort is stable). */
export function searchNodeOptions(
  pool: ReadonlyArray<NodeOption>,
  query: string,
  directTypes: ReadonlySet<string> = EMPTY_SET,
): NodeOption[] {
  const q = query.toLowerCase();
  const directTier = (n: NodeOption) => (directTypes.has(n.type) ? 0 : 1);
  const commonTier = (n: NodeOption) => (COMMON_NODE_TYPES.has(n.type) ? 0 : 1);
  return pool
    .filter(
      (node) =>
        node.label.toLowerCase().includes(q) ||
        node.type.toLowerCase().includes(q) ||
        node.category.toLowerCase().includes(q) ||
        (node.keywords?.some((kw) => kw.toLowerCase().includes(q)) ?? false),
    )
    .sort((a, b) => directTier(a) - directTier(b) || commonTier(a) - commonTier(b));
}

/** Tab-aware search: on the Common / Image / Video / Audio tabs the active
 *  tab's own items come first and every remaining match lands in `other`
 *  (rendered under an "Other" section). The All tab stays flat. Both blocks
 *  keep the searchNodeOptions ranking (direct tier, then common, then pool
 *  order). */
export function searchNodeOptionsSectioned(
  pool: ReadonlyArray<NodeOption>,
  query: string,
  tab: AddNodeMenuTab,
  directTypes: ReadonlySet<string> = EMPTY_SET,
): { own: NodeOption[]; other: NodeOption[] } {
  const ranked = searchNodeOptions(pool, query, directTypes);
  // "all"/"models" are flat at the node level (all matches in `own`); the popup
  // interleaves model hits around them per SEARCH_BLOCK_ORDER below.
  if (tab === "all" || tab === "models") return { own: ranked, other: [] };
  // "On this tab" means exactly what browsing the tab renders — families,
  // superset members and Creative Controls — so a match can never be filed
  // under "From other tabs" while sitting in plain sight on this one.
  const ownSet = tabTypeSet(pool, tab);
  return {
    own: ranked.filter((n) => ownSet.has(n.type)),
    other: ranked.filter((n) => !ownSet.has(n.type)),
  };
}

/** A row in the unified node+model search list (drives render AND keyboard nav). */
type SearchRow = { kind: "node"; node: NodeOption } | { kind: "model"; model: ModelTreeVariant };
export type SearchBlock = "nodeOwn" | "models" | "nodeOther";

/** Per-tab order of the three search blocks (§4/§5). Image/Video/Audio surface
 *  that-kind models right after their media nodes; Models leads with all models;
 *  All appends all models after the nodes; Common appends all models last. Each
 *  value is a permutation of the three blocks (guarded by a test). */
export const SEARCH_BLOCK_ORDER: Record<AddNodeMenuTab, readonly SearchBlock[]> = {
  image: ["nodeOwn", "models", "nodeOther"],
  video: ["nodeOwn", "models", "nodeOther"],
  audio: ["nodeOwn", "models", "nodeOther"],
  models: ["models", "nodeOwn", "nodeOther"],
  all: ["nodeOwn", "models", "nodeOther"],
  common: ["nodeOwn", "nodeOther", "models"],
  // The non-media intent tabs have no model affinity, so models trail the
  // cross-tab matches rather than splitting the two node blocks apart.
  assets: ["nodeOwn", "nodeOther", "models"],
  automate: ["nodeOwn", "nodeOther", "models"],
  publish: ["nodeOwn", "nodeOther", "models"],
};

/** "From other tabs" is deliberately explicit: a search must never look like
 *  a dead end just because the match lives on a different tab. */
const SEARCH_BLOCK_HEADER: Record<SearchBlock, string> = { nodeOwn: "Nodes", models: "Models", nodeOther: "From other tabs" };

/** The model kind a media tab PRIORITIZES in search (sorts first, never filters);
 *  undefined = no kind preference (Models/All/Common show every model in order). */
const TAB_MODEL_KIND: Partial<Record<AddNodeMenuTab, ModelKind>> = { image: "image", video: "video", audio: "audio" };

/** A labeled pink Switch — the Auto Connect / Smart toggles in the search bar. */
function ToggleLabel({
  icon,
  label,
  checked,
  onChange,
  ariaLabel,
  title,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
  readonly ariaLabel: string;
  readonly title: string;
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none" title={title}>
      {icon}
      <span className="text-[11px] font-semibold text-[var(--npk-badge-text)] whitespace-nowrap">{label}</span>
      <Switch size="sm" checked={checked} onCheckedChange={onChange} aria-label={ariaLabel} className="data-[state=checked]:bg-[var(--npk-accent)]" />
    </label>
  );
}

/** Green badge marking a node that can wire to the focused node:
 *  "connects" in Tab-auto-connect, "direct" in edge-drop. */
function MatchBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("text-[12px] text-[var(--npk-match)] font-medium flex items-center gap-1 shrink-0", className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--npk-match)]" />
      {label}
    </span>
  );
}

interface AddNodePopupProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onAddNode: (type: SceneNodeType, initialData?: Record<string, unknown>) => void;
  readonly position?: { x: number; y: number };
  readonly connectionContext?: ConnectionContext | null;
  readonly storeAddNode?: (type: SceneNodeType, position: { x: number; y: number }, initialData?: Record<string, unknown>) => string | undefined;
  readonly storeOnConnect?: (connection: Connection) => void;
  /** Pre-select a category drill-down on open (e.g. "Input") instead of the
   *  top-level category list. Used by the editor empty-state's upload bar. */
  readonly initialCategory?: string | null;
  /** Tab-auto-connect mode: the focused node to wire the new node to, with its
   *  rendered handle ids (sourced from React Flow `handleBounds` by the caller).
   *  When set + the Auto toggle is on, selecting a node hands off to the Connect
   *  dialog via `onPickType` instead of creating immediately. */
  readonly autoConnectCtx?: {
    readonly nodeId: string;
    readonly nodeType: string;
    readonly focusedLabel: string;
    readonly sourceHandles: readonly string[];
    readonly targetHandles: readonly string[];
  } | null;
  readonly onPickType?: (type: SceneNodeType, initialData?: Record<string, unknown>) => void;
}

export function AddNodePopup({
  open,
  onClose,
  onAddNode,
  position,
  connectionContext,
  storeAddNode,
  storeOnConnect,
  initialCategory,
  autoConnectCtx,
  onPickType,
}: AddNodePopupProps) {
  const { isAdmin, user } = useAuth();
  const { data: userSettings } = useUserSettings(user?.id);
  const openPickerForNode = useWorkflowStore((s) => s.openPickerForNode);
  const showRecentNodes = userSettings?.showRecentNodes ?? false;
  const history = useNodeSelectionHistoryStore((s) => s.history);
  const recordSelection = useNodeSelectionHistoryStore((s) => s.recordSelection);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // Common/All mode (the tablist above the search box). The last explicit
  // user choice is remembered across sessions.
  const [activeTab, setActiveTab] = useState<AddNodeMenuTab>(readAddNodeMenuTab);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [componentBrowserOpen, setComponentBrowserOpen] = useState(false);
  // Creative Controls stay collapsed by default and remember their state for
  // the session (sessionStorage, so a new tab starts collapsed again).
  const [creativeControlsOpen, setCreativeControlsOpen] = useState(readCreativeControlsOpen);
  const toggleCreativeControls = useCallback(() => {
    setCreativeControlsOpen((prev) => {
      persistCreativeControlsOpen(!prev);
      return !prev;
    });
  }, []);
  // Auto-connect toggle (Tab-from-focused-node). Seeded from localStorage; the
  // live value lets the user flip it within the open popup.
  const [autoConnect, setAutoConnect] = useState(getAutoConnectPref);
  // Smart Connect's toggle is intentionally hidden (the feature is force-OFF in
  // auto-connect-pref.ts, so picking a node always opens the Connect dialog).
  const popupRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Switch Common/All. Refocusing the search input keeps keystrokes flowing
  // to the popup after mouse interactions — the canvas's capture-phase
  // shortcut handler skips events only when an editable element has focus.
  const switchTab = useCallback((tab: AddNodeMenuTab) => {
    setActiveTab(tab);
    persistAddNodeMenuTab(tab);
    setSelectedCategory(null);
    searchInputRef.current?.focus();
  }, []);

  // Compatibility pool. Parameter-category nodes stay OUT of it: edge-drop
  // reaches them through the typed-handle pool below, and letting them into
  // the generic compatibility tiers would offer a Duration node on handles
  // that cannot consume one.
  const visibleNodes = useMemo(
    () => getNodeOptions().filter((n) => (!n.adminOnly || isAdmin) && n.category !== "Parameter"),
    [isAdmin],
  );

  // Browse + search pool. Unlike `visibleNodes` this DOES include the seven
  // Parameter nodes — the redesign surfaces them under Models · Generation
  // Settings instead of leaving them reachable only by dragging a wire.
  const browsePool = useMemo(
    () => getNodeOptions().filter((n) => !n.adminOnly || isAdmin),
    [isAdmin],
  );

  // Typed-handle pool: Parameter-category nodes are normally hidden from
  // the popup browse view, but they MUST be available as candidates for
  // certain typed-handle edge drops. Example: `tone` (Parameter) is a
  // registered HINT_PRODUCER, so dragging from camera-motion's
  // startState should surface tone in the suggestions.
  //
  // Gated on `PARAMETER_ACCEPTING_HANDLE_IDS` — the NARROWER set of typed
  // handles that need Parameter-category candidates (startState/endState/
  // target). The broader TYPED_HANDLE_IDS includes "in" for ffmpeg
  // consumer dispatch, but ffmpeg `in` handles accept video/audio/dynamic
  // producers — all in core categories. Routing every "in" drag through
  // the unfiltered pool would surface tone / lens / mood as candidates
  // on every non-ffmpeg `in` handle (text-to-speech, voice-*, motion-
  // graphics, after-effects, transcribe, etc.) — false-positive UX.
  const typedHandlePool = useMemo(
    () => getNodeOptions().filter((n) => !n.adminOnly || isAdmin),
    [isAdmin],
  );

  // Compatibility filtering for per-handle edge-drop (connectionContext): render
  // the Direct/Compatible tiers + hide the tabs. (Tab-auto-connect is NOT filtered
  // — it shows the full list and just marks connectable nodes; see directMatchTypes.)
  const { compatibilityNodes, isFiltered } = useMemo(() => {
    if (connectionContext) {
      const usesTypedPool =
        connectionContext.direction === "target" &&
        PARAMETER_ACCEPTING_HANDLE_IDS.has(connectionContext.handleId);
      const pool = usesTypedPool ? typedHandlePool : visibleNodes;
      const result = getCompatibleNodes(connectionContext.handleId, connectionContext.direction, pool, connectionContext.nodeType);
      if (result.direct.length === 0 && result.compatible.length === 0) {
        return { compatibilityNodes: null, isFiltered: false };
      }
      return { compatibilityNodes: result, isFiltered: true };
    }
    return { compatibilityNodes: null, isFiltered: false };
    // PARAMETER_ACCEPTING_HANDLE_IDS is a stable module-level const.
  }, [connectionContext, visibleNodes, typedHandlePool]);

  // Handle node selection — auto-connects edge when connectionContext is present
  const handleNodeSelect = useCallback(
    (type: SceneNodeType) => {
      if (type === "component") {
        setComponentBrowserOpen(true);
        return;
      }
      recordSelection(type);
      if (connectionContext && storeAddNode && storeOnConnect) {
        // Sequence: create node → wire edge → open picker. Opening the
        // picker AFTER `storeOnConnect` is intentional — config panels for
        // tile-grid pickers (e.g. CameraMotionConfig) read `edges` on mount
        // to compose preview hints; if the panel opens before the edge
        // lands, the first render is missing the upstream context and the
        // user sees a one-frame flash of an incomplete preview.
        const newNodeId = storeAddNode(
          type,
          connectionContext.dropPosition,
          buildPrefillInitialData(type, connectionContext.prefillName),
        );
        if (!newNodeId) {
          onClose();
          return;
        }
        const resolvedHandle = resolveTargetHandle(type, connectionContext.handleId, connectionContext.direction);
        const connection: Connection =
          connectionContext.direction === "source"
            ? {
                source: connectionContext.nodeId,
                sourceHandle: connectionContext.handleId,
                target: newNodeId,
                targetHandle: resolvedHandle,
              }
            : {
                source: newNodeId,
                sourceHandle: resolvedHandle,
                target: connectionContext.nodeId,
                targetHandle: connectionContext.handleId,
              };
        storeOnConnect(connection);
        openPickerForNode(newNodeId, type);
        onClose();
      } else if (autoConnect && autoConnectCtx && onPickType) {
        // Tab-auto-connect: defer creation to the Connect dialog (name + handle).
        // Do NOT onClose() here — the canvas hides the popup and hands off to the
        // Connect dialog (or wires immediately when Smart Connect is on).
        onPickType(type);
      } else {
        onAddNode(type);
        onClose();
      }
    },
    [connectionContext, storeAddNode, storeOnConnect, onAddNode, onClose, recordSelection, openPickerForNode, autoConnect, autoConnectCtx, onPickType],
  );

  // Handle component selected from marketplace modal
  const handleComponentSelect = useCallback(
    (component: ComponentSelection) => {
      onAddNode("component", component as unknown as Record<string, unknown>);
      onClose();
    },
    [onAddNode, onClose],
  );

  // Models tab: a model variant was picked. Seed the node it runs on with the
  // chosen provider/model field, then create it — deferring to the auto-connect
  // Connect dialog when that flow is active (same handoff as handleNodeSelect).
  const handleSelectModel = useCallback(
    (sel: ModelSelection) => {
      const initialData = sel.field ? ({ [sel.field]: sel.value } as Record<string, unknown>) : undefined;
      if (autoConnect && autoConnectCtx && onPickType) {
        // Hand off to the canvas (Smart Connect or the Connect dialog). Do NOT
        // onClose() — mirrors handleNodeSelect: the canvas hides the popup and the
        // Connect dialog (or immediate wiring) takes over.
        onPickType(sel.nodeType as SceneNodeType, initialData);
        return;
      }
      onAddNode(sel.nodeType as SceneNodeType, initialData);
      onClose();
    },
    [autoConnect, autoConnectCtx, onPickType, onAddNode, onClose],
  );

  // Effective node pool: filtered by compatibility when edge-dropping, otherwise all visible
  const effectivePool = useMemo(() => {
    if (!isFiltered || !compatibilityNodes) return visibleNodes;
    return [...compatibilityNodes.direct, ...compatibilityNodes.compatible];
  }, [visibleNodes, isFiltered, compatibilityNodes]);

  // Auto-connect marking: node types that have ≥1 valid connection option with
  // the focused node. Reuses the same enumerator as the Connect dialog so the
  // mark and the dialog can't disagree. Skipped while `isFiltered` — edge-drop
  // already supplies the badge set via compatibilityNodes.directTypes, so the
  // ~150 enumerations here would be computed and thrown away every render.
  const autoConnectActive = autoConnect && !!autoConnectCtx;
  const autoConnectMatchTypes = useMemo(() => {
    if (!autoConnectActive || !autoConnectCtx || isFiltered) return EMPTY_SET;
    const matched = new Set<SceneNodeType>();
    for (const node of visibleNodes) {
      if (node.type === autoConnectCtx.nodeType) continue;
      const { handles } = enumerateConnectionOptionsCore({
        focusedType: autoConnectCtx.nodeType,
        newType: node.type,
        focusedSourceHandles: autoConnectCtx.sourceHandles,
        focusedTargetHandles: autoConnectCtx.targetHandles,
        missingRefNames: [],
      });
      if (handles.length > 0) matched.add(node.type);
    }
    return matched;
  }, [autoConnectActive, autoConnectCtx, visibleNodes, isFiltered]);

  const directMatchTypes = isFiltered && compatibilityNodes
    ? compatibilityNodes.directTypes
    : autoConnectActive
      ? autoConnectMatchTypes
      : EMPTY_SET;
  // Edge-drop has a real two-tier vocabulary (a "Direct Match" section vs
  // "Compatible"); Tab-auto-connect instead marks every node that can wire to the
  // focused node in EITHER direction, which reads better as "connects" than "direct".
  const matchLabel = isFiltered ? "direct" : "connects";

  const optionByType = useMemo(() => {
    const map = new Map<SceneNodeType, NodeOption>();
    for (const node of effectivePool) map.set(node.type, node);
    return map;
  }, [effectivePool]);

  const searchActive = !!searchQuery.trim();
  // The Models tab AND the All-tab "Models" category share one view: the model
  // browser when idle, the models-first unified search when typing.
  const inModelsView = activeTab === "models" || selectedCategory === VIRTUAL_CATEGORY_IDS.models;
  // The tab whose affinity drives search layout. Edge-drop is flat ("all"); the
  // Models view ranks models first regardless of activeTab.
  const searchTab: AddNodeMenuTab = isFiltered ? "all" : inModelsView ? "models" : activeTab;

  // Node matches, sectioned (own first, then "other"); flat on all/models.
  const searchSections = useMemo(() => {
    if (!searchActive) return null;
    // Search spans the browse pool so the Generation Settings nodes are
    // findable by name, not only by dragging a compatible wire.
    return searchNodeOptionsSectioned(
      isFiltered ? effectivePool : browsePool,
      searchQuery,
      searchTab,
      directMatchTypes,
    );
  }, [searchActive, effectivePool, browsePool, isFiltered, searchQuery, searchTab, directMatchTypes]);

  // ALL matching models (never filtered by tab) — just ordered so the active
  // media tab's own kind leads. Suppressed in edge-drop (connection-driven).
  const modelHits = useMemo<ModelTreeVariant[]>(() => {
    if (!searchActive || isFiltered) return [];
    const all = searchModelVariants(searchQuery);
    const kind = TAB_MODEL_KIND[searchTab];
    // Show every model, the active media tab's own kind first (stable partition).
    return kind ? [...all.filter((m) => m.kind === kind), ...all.filter((m) => m.kind !== kind)] : all;
  }, [searchActive, isFiltered, searchQuery, searchTab]);

  // Non-empty blocks in this tab's order — drives both render and keyboard nav.
  const searchBlocks = useMemo(() => {
    if (!searchActive) return null;
    const own = searchSections?.own ?? [];
    const other = searchSections?.other ?? [];
    const byBlock: Record<SearchBlock, SearchRow[]> = {
      nodeOwn: own.map((node): SearchRow => ({ kind: "node", node })),
      nodeOther: other.map((node): SearchRow => ({ kind: "node", node })),
      models: modelHits.map((model): SearchRow => ({ kind: "model", model })),
    };
    return SEARCH_BLOCK_ORDER[searchTab].map((block) => ({ block, rows: byBlock[block] })).filter((b) => b.rows.length > 0);
  }, [searchActive, searchSections, modelHits, searchTab]);

  const searchRows = useMemo<SearchRow[]>(() => (searchBlocks ? searchBlocks.flatMap((b) => b.rows) : []), [searchBlocks]);


  const categoryNodes = useMemo<NodeOption[]>(() => {
    if (!selectedCategory) return [];
    if (selectedCategory === VIRTUAL_CATEGORY_IDS.recent) {
      return mapHistoryToOptions(history, (a, b) => b.lastUsedAt - a.lastUsedAt, optionByType);
    }
    // Real categories: cluster nodes by group so each section header renders
    // once (the virtual categories above keep their curated/history order).
    return clusterByGroup(effectivePool.filter((node) => node.category === selectedCategory));
  }, [selectedCategory, effectivePool, optionByType, history]);

  // Recent is opt-in per-user (Settings → Add Node Menu). Most Used was
  // removed with the picker redesign — POPULAR covers the same need
  // editorially, and a second history list was never reachable.
  const visibleCategories = useMemo(() => {
    return CATEGORIES.filter((cat) => {
      if (cat.id === VIRTUAL_CATEGORY_IDS.recent) return showRecentNodes;
      return true;
    });
  }, [showRecentNodes]);

  // Family-grouped content for the active tab. Built for Models too — that
  // view keeps the model tree and appends the Generation Settings family
  // underneath it.
  const pickerSections = useMemo(() => {
    const built = sectionsForTab(isFiltered ? effectivePool : browsePool, activeTab);
    // RECENT leads the Common tab when the user has opted in — the per-user
    // counterpart to the editorial POPULAR block. It is derived from history,
    // so it cannot live in the static registry; an empty history renders
    // nothing at all, same as any other empty family.
    if (activeTab !== "common" || !showRecentNodes) return built;
    const recent = mapHistoryToOptions(
      history,
      (a, b) => b.lastUsedAt - a.lastUsedAt,
      optionByType,
    ).slice(0, 6);
    if (!recent.length) return built;
    return {
      ...built,
      sections: [{ id: "common-recent", label: "Recent", options: recent }, ...built.sections],
    };
  }, [activeTab, effectivePool, browsePool, isFiltered, showRecentNodes, history, optionByType]);

  // Generation Settings rows under the model tree. They keep their own cursor
  // because the tree owns the arrows on that tab and hands the index over once
  // it runs off its own end.
  const modelsTrailingRows = useMemo(
    () => (pickerSections ? pickerSections.sections.flatMap((s) => [...s.options]) : []),
    [pickerSections],
  );
  const [modelsTrailingIndex, setModelsTrailingIndex] = useState<number | null>(null);
  useEffect(() => setModelsTrailingIndex(null), [activeTab, searchQuery]);

  // Rows the section list contributes to the flat keyboard order, in render
  // order — including the Creative Controls toggle sentinel.
  const sectionNavItems = useMemo(
    () =>
      pickerSections
        ? flattenSections(pickerSections.sections, pickerSections.controls, creativeControlsOpen)
        : [],
    [pickerSections, creativeControlsOpen],
  );

  // Items to display (search results, compatibility tiers, category nodes,
  // a media tab, the Common tab root, or the All tab's categories)
  const displayItems = useMemo(() => {
    // Search nav is driven by searchRows; displayItems only needs the node slice
    // here for the non-search branches + the scroll-into-view effect.
    if (searchActive) return searchSections ? [...searchSections.own, ...searchSections.other] : [];
    if (isFiltered && !selectedCategory) return effectivePool;
    if (selectedCategory) return categoryNodes;
    if (pickerSections) return sectionNavItems;
    return visibleCategories;
  }, [searchActive, searchSections, isFiltered, selectedCategory, effectivePool, categoryNodes, pickerSections, sectionNavItems, visibleCategories]);

  // Footer count: node rows currently on screen. Model rows, category rows and
  // the Creative Controls toggle are excluded — none of them is a node you can
  // add — and nothing here is a hardcoded catalog total, so the number stays
  // honest as families collapse or an edition hides its Cloud-only nodes.
  const renderedNodeCount = useMemo(
    () =>
      searchActive
        ? searchRows.filter((r) => r.kind === "node").length
        : displayItems.filter((item) => item && "type" in item).length,
    [searchActive, searchRows, displayItems],
  );

  // Reset state when opening/closing
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSelectedCategory(initialCategory ?? null);
      // An initialCategory drill-down (e.g. the empty-state's "Input") lives
      // under the All root — display that tab for this open WITHOUT
      // persisting; only explicit tab switches are remembered.
      setActiveTab(initialCategory ? "all" : readAddNodeMenuTab());
      setHighlightedIndex(0);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open, initialCategory]);

  // Handle click outside
  useClickOutside(popupRef, onClose, open);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      // A key another handler already consumed must not be re-processed here.
      // Concretely: the canvas's capture-phase Tab handler preventDefaults the
      // Tab that OPENS this popup — React flushes the open synchronously
      // (discrete event), our listener attaches mid-dispatch, and the same
      // keystroke would otherwise immediately toggle the Common/All mode.
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        if (selectedCategory && !searchQuery) {
          // Jump straight back to the active tab's root from any inner menu.
          setSelectedCategory(null);
          setHighlightedIndex(0);
        } else {
          onClose();
        }
        return;
      }

      if (e.key === "Tab") {
        // Tab cycles the mode forward, Shift+Tab backward. In edge-drop
        // compatibility mode the tabs are hidden, so let the browser's
        // default focus move run.
        if (!isFiltered) {
          e.preventDefault();
          switchTab(nextAddNodeMenuTab(activeTab, e.shiftKey ? -1 : 1));
        }
        return;
      }

      // ←/→ cycle tabs while the query is empty — the footer advertises
      // "→ Tabs", so the shortcut has to work. Placed above the Models bail
      // because the model tree only claims ArrowLeft when a series is drilled
      // open (it stops propagation there, and backing out wins over cycling).
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !searchQuery && !isFiltered) {
        e.preventDefault();
        switchTab(nextAddNodeMenuTab(activeTab, e.key === "ArrowRight" ? 1 : -1));
        return;
      }

      // In the Models browse view the model-tree owns Arrow/Enter. Bail before
      // those branches — but AFTER Escape (closes) and Tab (cycles tabs), and
      // only while NOT searching (search is the popup's own unified list).
      if (inModelsView && !searchActive) return;

      // During search the unified node+model rows drive nav; otherwise the
      // category/media/common/all displayItems do.
      const navLen = searchActive ? searchRows.length : displayItems.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, navLen - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (searchActive) {
          const row = searchRows[highlightedIndex];
          if (row?.kind === "node") handleNodeSelect(row.node.type);
          else if (row?.kind === "model") handleSelectModel(variantToSelection(row.model));
        } else {
          const item = displayItems[highlightedIndex];
          if (item) {
            if (isCreativeControlsNavItem(item)) {
              toggleCreativeControls();
            } else if ("type" in item) {
              handleNodeSelect(item.type);
            } else {
              // It's a category
              setSelectedCategory(item.id);
              setHighlightedIndex(0);
            }
          }
        }
      } else if (e.key === "Backspace" && !searchQuery && selectedCategory) {
        // Inner menus all sit directly under the tab root, so back == root.
        setSelectedCategory(null);
        setHighlightedIndex(0);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    open,
    displayItems,
    searchRows,
    searchActive,
    inModelsView,
    highlightedIndex,
    selectedCategory,
    searchQuery,
    isFiltered,
    activeTab,
    switchTab,
    onClose,
    handleNodeSelect,
    handleSelectModel,
    toggleCreativeControls,
  ]);

  // Reset highlighted index when items change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, selectedCategory, activeTab]);

  // Keep the keyboard-highlighted item scrolled into view (arrow up/down).
  // `modelsTrailingIndex` is in the deps because the Generation Settings rows
  // under the model tree carry their own cursor — without it those rows are
  // navigable but scroll off-screen, which is the defect the keyboard fix was
  // meant to remove.
  useEffect(() => {
    scrollContainerRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, displayItems, modelsTrailingIndex]);

  if (!open && !componentBrowserOpen) return null;

  // Always centred in the viewport, regardless of the invocation point (Tab,
  // sidebar "+", right-click, edge-drop). Only NODE PLACEMENT uses the
  // invocation `position` — the canvas keeps that in its own state; the
  // `position` prop here is forwarded to the component marketplace modal.
  // Fixed 60% page height: every tab renders the same stable modal — long
  // lists scroll inside, short ones don't shrink it.
  const popupStyle = {
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    height: "60vh",
  };

  return (
    <>
    {open && !componentBrowserOpen && <div
      ref={popupRef}
      className={cn(
        // 790px is the design width — the nine intent tabs need it to fit on
        // one line without the strip having to scroll.
        "fixed z-[100] w-[790px] max-w-[calc(100vw-16px)] flex flex-col",
        "bg-[var(--npk-surface)]",
        "border border-[var(--npk-border)]",
        "rounded-xl shadow-xl",
        "overflow-hidden",
      )}
      style={popupStyle}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--npk-border)]">
        <h3 className="text-base font-semibold text-[var(--npk-t1)]">
          {selectedCategory ? (
            <button
              onClick={() => {
                setSelectedCategory(null);
                searchInputRef.current?.focus();
              }}
              className="flex items-center gap-2 hover:text-[var(--npk-accent)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {selectedCategory}
            </button>
          ) : isFiltered && connectionContext ? (
            <div className="flex items-center gap-2">
              <span>Connect to</span>
              {(() => {
                // Tint the chip in the handle's own type color when known
                // (`connectionContext.color` is the pip's `--pip-color`);
                // fall back to the default violet otherwise. `${hex}33` /
                // `${hex}4D` append ~20% / ~30% alpha to the 6-digit hex.
                const c = connectionContext.color
                const style = c
                  ? { color: c, backgroundColor: `${c}33`, borderColor: `${c}4D` }
                  : undefined
                return (
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-sm font-medium border",
                      !c &&
                        "bg-[var(--npk-chip-fallback)]/20 text-[var(--npk-chip-fallback)] border-[var(--npk-chip-fallback)]/30",
                    )}
                    style={style}
                  >
                    {connectionContext.direction === "source"
                      ? `${connectionContext.handleId} →`
                      : `→ ${connectionContext.handleId}`}
                  </span>
                )
              })()}
            </div>
          ) : autoConnectCtx ? (
            <span className="flex items-center gap-1.5">
              <span>Connecting new node to</span>
              <span className="text-[var(--npk-accent)]">{autoConnectCtx.focusedLabel}</span>
            </span>
          ) : (
            "What do you want to do?"
          )}
        </h3>
      </div>

      {/* Mode tabs — hidden in edge-drop compatibility mode where the list is
          connection-driven, not category-driven. Tab cycles, Shift+Tab reverses. */}
      {!isFiltered && <PickerTabBar activeTab={activeTab} onSelect={switchTab} />}

      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--npk-border)]">
        <div className="flex items-center gap-2">
          <div className={cn("relative", isFiltered ? "flex-1" : "w-[300px] max-w-full")}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--npk-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={inModelsView ? "Search models & nodes..." : "Search nodes..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-9 pr-3 py-2 text-base",
                "bg-[var(--npk-footer)]",
                "border border-[var(--npk-border)]",
                "rounded-lg",
                "text-[var(--npk-t1)]",
                "placeholder:text-[var(--npk-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--npk-accent)]/50 focus:border-[var(--npk-accent)]",
              )}
            />
          </div>
          {/* Auto Connect toggle: only meaningful when there's a focused node to
              wire to (Tab on a node sets autoConnectCtx). Hidden when nothing is
              focused (generic Tab / sidebar add) and for edge-drop (which
              direct-wires the dragged handle). The Smart Connect toggle that used
              to sit beside it is intentionally hidden — Smart is force-OFF in
              auto-connect-pref.ts so picking a node always opens the dialog. */}
          {autoConnectCtx && (
            <div className="flex items-center gap-3 shrink-0 ml-auto">
              <ToggleLabel
                icon={<Link2 className="w-3.5 h-3.5 text-[var(--npk-accent)]" />}
                label="Auto Connect"
                checked={autoConnect}
                onChange={(v) => {
                  setAutoConnect(v)
                  setAutoConnectPref(v)
                }}
                ariaLabel="Auto-connect"
                title="Auto-connect the new node to the focused node"
              />
            </div>
          )}
        </div>
      </div>

      {/* Content — flex-1 so it fills whatever space remains within the
          fixed-height popup (header + tabs + search above are fixed). Radix
          scroll area (type="auto") keeps the scrollbar visible whenever the
          list overflows, regardless of the OS overlay-scrollbar setting. */}
      <ScrollArea type="auto" className="flex-1 min-h-0">
      <div ref={scrollContainerRef} className="py-2">
        {inModelsView && !searchActive ? (
          // Models browse view (the Models tab or the All-tab "Models"
          // category): series → variants, then the Generation Settings family
          // — the seven config nodes that used to be reachable only by
          // dragging a wire. The model tree owns the arrow keys, so it hands
          // the cursor on to these rows rather than clamping at its own end.
          <>
            <ModelsTab
              onSelectModel={handleSelectModel}
              trailing={
                modelsTrailingRows.length > 0
                  ? {
                      count: modelsTrailingRows.length,
                      highlighted: modelsTrailingIndex,
                      onHighlight: setModelsTrailingIndex,
                      onEnter: (i) => {
                        const node = modelsTrailingRows[i];
                        if (node) handleNodeSelect(node.type);
                      },
                    }
                  : undefined
              }
            />
            {pickerSections.sections.length > 0 && (
              <PickerSectionList
                sections={pickerSections.sections}
                controls={[]}
                controlsOpen={false}
                onToggleControls={toggleCreativeControls}
                highlightedIndex={modelsTrailingIndex ?? -1}
                onHover={setModelsTrailingIndex}
                onSelect={handleNodeSelect}
              />
            )}
          </>
        ) : searchActive ? (
          // Search: current-tab hits under their family headers, then a
          // labelled separator and the cross-tab hits, each badged with the
          // tab it lives on. Model hits slot in per SEARCH_BLOCK_ORDER. One
          // running nav index across every row so keyboard highlight/Enter
          // line up with what is drawn.
          searchBlocks && searchBlocks.length > 0 ? (
            (() => {
              let nav = 0;
              return searchBlocks.map(({ block, rows }) => {
                const at = nav;
                nav += rows.length;
                if (block === "models") {
                  return (
                    <div key={block} className="mb-2.5">
                      <div className="sticky top-0 z-10 bg-[var(--npk-surface)] px-2.5 pb-1.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[1.3px] text-[var(--npk-dim)]">
                        {SEARCH_BLOCK_HEADER[block]}
                      </div>
                      {rows.map((r, i) =>
                        r.kind === "model" ? (
                          <VariantRow
                            key={`m-${r.model.id}`}
                            v={r.model}
                            active={at + i === highlightedIndex}
                            onHover={() => setHighlightedIndex(at + i)}
                            onPick={(v) => handleSelectModel(variantToSelection(v))}
                          />
                        ) : null,
                      )}
                    </div>
                  );
                }
                const hits = rows.flatMap((r) => (r.kind === "node" ? [r.node] : []));
                const badge = (node: NodeOption) =>
                  directMatchTypes.has(node.type) ? matchLabel : undefined;
                return block === "nodeOwn" ? (
                  <SearchOwnBlock
                    key={block}
                    hits={hits}
                    startIndex={at}
                    highlightedIndex={highlightedIndex}
                    onHover={setHighlightedIndex}
                    onSelect={handleNodeSelect}
                    badgeFor={badge}
                  />
                ) : (
                  <SearchOtherBlock
                    key={block}
                    hits={hits}
                    startIndex={at}
                    highlightedIndex={highlightedIndex}
                    onHover={setHighlightedIndex}
                    onSelect={handleNodeSelect}
                    directBadge={badge}
                  />
                );
              });
            })()
          ) : (
            <SearchEmptyState query={searchQuery.trim()} />
          )

        ) : isFiltered && compatibilityNodes && !selectedCategory ? (
          // Smart edge-drop: show direct matches then compatible
          <>
            {compatibilityNodes.direct.length > 0 && (
              <>
                <div className="text-[12px] uppercase tracking-wider text-[var(--npk-match)]/80 font-medium px-4 pt-2 pb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--npk-match)]" />
                  Direct Match
                </div>
                {compatibilityNodes.direct.map((node, index) => (
                  <button
                    key={node.type}
                    type="button"
                    onClick={() => handleNodeSelect(node.type)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      index === highlightedIndex
                        ? "bg-[var(--npk-sel-bg)]"
                        : "hover:bg-[var(--npk-hover)]",
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                data-active={index === highlightedIndex ? "true" : undefined}
                  >
                    <span className="text-[var(--npk-icon)]">
                      {node.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium text-[var(--npk-t1)] truncate">{node.label}</div>
                      <div className="text-sm text-[var(--npk-muted)]">{node.category}</div>
                    </div>
                    <MatchBadge label={matchLabel} />
                  </button>
                ))}
              </>
            )}
            {compatibilityNodes.compatible.length > 0 && (
              <>
                <div className="text-[12px] uppercase tracking-wider text-muted-foreground/60 font-medium px-4 pt-2 pb-1">
                  Compatible
                </div>
                {compatibilityNodes.compatible.map((node, rawIndex) => {
                  const index = compatibilityNodes.direct.length + rawIndex;
                  return (
                    <button
                      key={node.type}
                      type="button"
                      onClick={() => handleNodeSelect(node.type)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        index === highlightedIndex
                          ? "bg-[var(--npk-sel-bg)]"
                          : "hover:bg-[var(--npk-hover)]",
                      )}
                      onMouseEnter={() => setHighlightedIndex(index)}
                data-active={index === highlightedIndex ? "true" : undefined}
                    >
                      <span className="text-[var(--npk-icon)]">
                        {node.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-medium text-[var(--npk-t2)] truncate">{node.label}</div>
                        <div className="text-sm text-[var(--npk-muted)]">{node.category}</div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </>
        ) : selectedCategory ? (
          categoryNodes.length === 0 ? (
            <div className="px-4 py-8 text-center text-base text-[var(--npk-muted)]">
              No nodes here yet — they&apos;ll appear as you use them.
            </div>
          ) : (
          // Category nodes — with optional group sub-headers
          (categoryNodes as NodeOption[]).map((node, index, arr) => {
            const prevGroup =
              index > 0 ? arr[index - 1].group : undefined;
            const showGroupHeader =
              node.group && node.group !== prevGroup;
            return (
              <div key={node.type}>
                {showGroupHeader && (
                  <>
                    {index > 0 && (
                      <div className="border-t border-muted-foreground/10 mx-3 mt-1" />
                    )}
                    <div className="text-[12px] uppercase tracking-wider text-muted-foreground/60 font-medium px-4 pt-2 pb-1">
                      {familyLabel(node.group)}
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handleNodeSelect(node.type)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left",
                    "transition-colors",
                    index === highlightedIndex
                      ? "bg-[var(--npk-sel-bg)]"
                      : "hover:bg-[var(--npk-hover)]",
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                data-active={index === highlightedIndex ? "true" : undefined}
                >
                  <span
                    className={cn(
                      "text-[var(--npk-icon)]",
                    )}
                  >
                    {node.icon}
                  </span>
                  <span className="text-base text-[var(--npk-t1)]">
                    {node.label}
                  </span>
                  {directMatchTypes.has(node.type) && (
                    <MatchBadge label={matchLabel} className="ml-auto" />
                  )}
                </button>
              </div>
            );
          })
          )
        ) : pickerSections ? (
          // Family-grouped tab body: POPULAR (media tabs), then the families
          // this tab shows, then the collapsed Creative Controls block. Nav
          // order mirrors sectionNavItems, so highlight and Enter line up
          // with what is drawn.
          pickerSections.sections.length === 0 && pickerSections.controls.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13.5px] text-[var(--npk-muted)]">
              No nodes available here in this edition.
            </div>
          ) : (
            <PickerSectionList
              sections={pickerSections.sections}
              controls={pickerSections.controls}
              controlsOpen={creativeControlsOpen}
              onToggleControls={toggleCreativeControls}
              highlightedIndex={highlightedIndex}
              onHover={setHighlightedIndex}
              onSelect={handleNodeSelect}
              badgeFor={(node) => (directMatchTypes.has(node.type) ? matchLabel : undefined)}
            />
          )
        ) : (
          // Categories (All tab)
          visibleCategories.map((cat, index) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id);
                setHighlightedIndex(0);
                searchInputRef.current?.focus();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left",
                "transition-colors",
                index === highlightedIndex
                  ? "bg-[var(--npk-sel-bg)]"
                  : "hover:bg-[var(--npk-hover)]",
              )}
              onMouseEnter={() => setHighlightedIndex(index)}
                data-active={index === highlightedIndex ? "true" : undefined}
            >
              <span
                className={cn(
                  "text-[var(--npk-icon)]",
                )}
              >
                {cat.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold uppercase tracking-wider text-[var(--npk-t1)]">
                  {cat.label}
                </div>
                <div className="text-sm text-[var(--npk-muted)]">{cat.description}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--npk-muted)]" />
            </button>
          ))
        )}
      </div>
      </ScrollArea>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-[var(--npk-border)] bg-[var(--npk-footer)]">
        <div className="flex items-center gap-4 text-[12px] text-[var(--npk-muted)]">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-[var(--npk-key)] rounded border border-[var(--npk-border)]">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-[var(--npk-key)] rounded border border-[var(--npk-border)]">
              ↵
            </kbd>
            Select
          </span>
          {!isFiltered && (
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[var(--npk-key)] rounded border border-[var(--npk-border)]">
                ⇥
              </kbd>
              Tabs
            </span>
          )}
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-[var(--npk-key)] rounded border border-[var(--npk-border)]">
              Esc
            </kbd>
            Close
          </span>
          {/* Count of what is actually on screen right now — derived, never a
              hardcoded catalog total, so it stays honest as families collapse
              or the edition hides Cloud-only nodes. */}
          <span className="ml-auto tabular-nums text-[var(--npk-faint)]">
            {renderedNodeCount} {renderedNodeCount === 1 ? "node" : "nodes"}
          </span>
        </div>
      </div>
    </div>}

    {/* Component Marketplace Modal */}
    {componentBrowserOpen && (
      <Suspense fallback={null}>
        <ComponentMarketplaceModal
          open={componentBrowserOpen}
          onOpenChange={setComponentBrowserOpen}
          onSelect={handleComponentSelect}
          position={position}
        />
      </Suspense>
    )}
    </>
  );
}
