import { useState, useEffect } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NodaroLogo } from "@/components/nodaro-logo"
import { useAuth } from "@/hooks/use-auth"
import { isCloud } from "@/lib/edition"
import { AUTH_REDIRECT_KEY } from "@/lib/storage-keys"
import { FREE_TIER_CREDITS } from "@/lib/pricing-data"

const PENDING_PLAN_KEY = "nodaro_pending_plan"

/** Read + consume the stored post-auth redirect (same key the OAuth
 *  round-trip uses), falling back to the dashboard. */
function consumeRedirect(): string {
  const stored = localStorage.getItem(AUTH_REDIRECT_KEY)
  if (stored && stored.startsWith("/") && !stored.startsWith("//")) {
    localStorage.removeItem(AUTH_REDIRECT_KEY)
    return stored
  }
  return "/projects"
}

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Email/password is the self-host path (GoTrue native). Cloud stays
  // Google-only — its funnel is a product decision, not an edition default.
  const showEmailAuth = !isCloud()

  // Persist redirect param to localStorage (survives Google OAuth round-trip)
  useEffect(() => {
    const redirect = searchParams.get("redirect")
    if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
      localStorage.setItem(AUTH_REDIRECT_KEY, redirect)
    }
  }, [searchParams])

  async function handleGoogleSignIn() {
    setPending(true)
    setError(null)

    // Persist plan param through the OAuth redirect
    const plan = searchParams.get("plan")
    if (plan) {
      localStorage.setItem(PENDING_PLAN_KEY, plan)
    }

    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed")
      setPending(false)
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await signInWithEmail(email, password)
      navigate(consumeRedirect(), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed")
      setPending(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 bg-gradient-to-b from-background via-background to-zinc-950/40">
      {/* Subtle dot grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm space-y-8 text-center">
        {/* Logo + tagline */}
        <div className="space-y-3">
          <h1>
            <NodaroLogo size="xl" />
          </h1>
          <p className="text-base text-muted-foreground animate-in fade-in duration-700">
            Visual workflows for AI video generation
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-6 shadow-lg space-y-4">
          <h2 className="text-lg font-semibold">Sign in</h2>

          {showEmailAuth && (
            <>
              <form onSubmit={handleEmailSignIn} className="space-y-3 text-left">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  required
                  aria-label="Email"
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                  aria-label="Password"
                />
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground/60">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <Button
            variant={showEmailAuth ? "outline" : "default"}
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={pending}
          >
            {pending ? "Redirecting..." : "Continue with Google"}
          </Button>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {showEmailAuth ? (
            <p className="text-xs text-muted-foreground/60 pt-1">
              New here?{" "}
              <Link to="/signup" className="underline underline-offset-2 hover:text-muted-foreground">
                Create an account
              </Link>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/60 pt-1">
              Start free with up to {FREE_TIER_CREDITS.toLocaleString()} credits. No credit card required.
            </p>
          )}
        </div>
      </div>

      {/* Legal footer */}
      <div className="absolute bottom-6 flex items-center justify-center gap-4 text-xs text-muted-foreground/60">
        <a href="https://nodaro.ai/terms" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">
          Terms of Service
        </a>
        <span>&middot;</span>
        <a href="https://nodaro.ai/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">
          Privacy Policy
        </a>
        <span>&middot;</span>
        <a href="https://nodaro.ai/refund" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">
          Refund Policy
        </a>
      </div>
    </div>
  )
}
