'use client'

// AuthCard — the auth-screen layout shell used by Fort + every product login.
//
// Renders a brand panel + a form card in one of four layouts (split,
// split-reverse, centered, minimal). All branding (name, tagline, bullets,
// logo, footer) is prop-driven so Fort can swap its own brand with zero forking.
//
// Product-agnostic (Rule 25): no context, no fetching — `language`/`dir` and
// brand copy are injected by the caller. Full RTL (Rule 8/16): the panel order
// flips with `dir`, and all spacing uses logical properties.

import * as React from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@togo-framework/ui-core'
import { Card, CardContent } from '@togo-framework/ui-core'
import { cn } from '@togo-framework/ui-core'

export type AuthLayout = 'split' | 'split-reverse' | 'centered' | 'minimal'

export interface AuthCardBrand {
  /**
   * Optional logo image URL — the preferred brand mark. When provided it
   * replaces the default icon crest.
   */
  logoUrl?: string
  /**
   * Optional icon element (e.g. a lucide icon) shown in the crest when no
   * `logoUrl` is given. Defaults to a ShieldCheck mark. Pass `null` to fall
   * back to the text `initial`.
   */
  icon?: React.ReactNode | null
  /** Text initial — only used when `icon` is explicitly `null` and no logoUrl. */
  initial?: string
  /**
   * Product name shown in the panel and mobile header. Default: 'Sentra Insight Hub'.
   * Pass a `{ en, ar }` pair to localize the title per language (operator
   * 2026-06-05: the AR title wasn't switching). A bare string is used as-is.
   */
  name?: string | { en: string; ar: string }
  /** Tagline shown under the name. Provide both locales. */
  tagline?: { en: string; ar: string }
  /** Feature bullets shown in the brand panel. Provide both locales for each. */
  bullets?: Array<{ en: string; ar: string }>
  /** Footer note in the brand panel. Default: lock icon + 'Secure & Encrypted'. */
  secureNote?: { en: string; ar: string }
}

type ResolvedBrand = Required<Omit<AuthCardBrand, 'logoUrl' | 'icon'>> & {
  logoUrl?: string
  icon?: React.ReactNode | null
}

interface AuthCardProps {
  children: React.ReactNode
  /** Current display language. Default: 'en'. */
  language?: 'en' | 'ar'
  /**
   * Layout variant. Default: 'split'.
   *  - split          brand panel on the leading side (start), form trailing.
   *  - split-reverse  brand panel on the trailing side (end), form leading.
   *  - centered       no brand panel; a single centered card with a compact
   *                   brand header above it. Good for minimal Fort tenants.
   *  - minimal        like centered but without the card chrome (bare form,
   *                   only the brand crest + name). Smallest footprint.
   */
  layout?: AuthLayout
  /**
   * Called when the user clicks the language toggle button.
   * If omitted the toggle is hidden.
   */
  onLanguageToggle?: () => void
  /** Brand customisation. Defaults to Sentra copy if omitted. */
  brand?: AuthCardBrand
  /** Optional extra class on the outer wrapper. */
  className?: string
}

const DEFAULT_BRAND: ResolvedBrand = {
  initial: 'S',
  logoUrl: undefined,
  // Default brand mark is an icon (not the "S" initial). Products override with
  // `logoUrl` (image) or a custom `icon`.
  icon: <ShieldCheck className="h-1/2 w-1/2" strokeWidth={1.75} />,
  name: 'Sentra Insight Hub',
  tagline: {
    en: 'National Intelligence Analysis Platform',
    ar: 'منصة التحليل الاستخباراتي الوطني',
  },
  // No feature bullets by default — keeps the brand panel clean (mofa.id look).
  // Products that want them pass `bullets` explicitly.
  bullets: [],
  secureNote: { en: 'Secure & Encrypted', ar: 'مؤمّن ومشفّر' },
}

// brandName — resolve the (possibly bilingual) brand name for the active language.
const brandName = (brand: ResolvedBrand, ar: boolean): string => {
  const n = brand.name
  if (typeof n === 'string') return n
  return (ar ? n.ar || n.en : n.en || n.ar) ?? ''
}

// ── Brand crest (logo image or initial) ────────────────────────────────────────

const BrandCrest = ({
  brand,
  size,
  onPanel,
}: {
  brand: ResolvedBrand
  size: 'lg' | 'md'
  onPanel: boolean
}) => {
  const box = size === 'lg' ? 'h-20 w-20' : 'h-12 w-12'
  const text = size === 'lg' ? 'text-3xl' : 'text-xl'

  // Track logo-image load failure. A non-empty-but-broken logo_url (404, bad
  // host, deleted asset) would otherwise render as a BROKEN IMAGE instead of
  // falling through to the icon. On error we flip this flag and fall back to the
  // icon crest below — so "no usable logo" always lands on the platform icon.
  // (operator 2026-06-05: "still see the [broken] image even if it doesn't exist
  // — that must show up the icon".)
  const [logoFailed, setLogoFailed] = React.useState(false)

  // Reset the failure flag when the URL changes (a new logo deserves a retry).
  React.useEffect(() => {
    setLogoFailed(false)
  }, [brand.logoUrl])

  // Is there a REAL logo to show? Treat empty/whitespace AND the Sentra default
  // placeholder as "no logo" so the platform ICON wins (operator 2026-06-05: an
  // empty DB logo must NOT render /sentra-logo-full.png — show the icon).
  const rawLogo = (brand.logoUrl ?? '').trim()
  const hasRealLogo =
    rawLogo !== '' && !rawLogo.endsWith('/sentra-logo-full.png')

  // Preferred: logo image — only when there's a real logo and it hasn't failed.
  if (hasRealLogo && !logoFailed) {
    return (
      <div className={cn('flex items-center justify-center', box)}>
        <img
          src={brand.logoUrl}
          alt={typeof brand.name === 'string' ? brand.name : brand.name.en}
          className="h-full w-full rounded-2xl object-contain"
          onError={() => setLogoFailed(true)}
        />
      </div>
    )
  }

  const crestChrome = cn(
    'flex items-center justify-center rounded-2xl',
    box,
    onPanel ? 'border-2 border-white/30 bg-white/10' : 'bg-primary/10',
    onPanel ? 'text-white' : 'text-primary',
  )

  // Fallback when there is no usable logo (none set, OR set-but-broken/404):
  // ALWAYS render the ICON. The brand carries the platform's DB icon (resolved
  // from platform_branding.icon by the caller); when a caller does not provide
  // one, brand.icon defaults to ShieldCheck. The icon is NEVER skipped in favour
  // of a text initial — a broken/missing logo must show the icon, not an "S".
  // (operator 2026-06-05: "you have an icon in the database, use it if the image
  // doesn't exist".)
  if (brand.icon !== null && brand.icon !== undefined) {
    return (
      <div className={crestChrome} aria-hidden="true">
        {brand.icon}
      </div>
    )
  }

  // Last resort ONLY when a caller EXPLICITLY opts out of any icon by passing
  // `icon: null` AND there is no logo. Default callers never reach here because
  // brand.icon defaults to ShieldCheck.
  return (
    <div className={crestChrome}>
      <span className={cn('font-bold tracking-tight', text)}>{brand.initial}</span>
    </div>
  )
}
BrandCrest.displayName = 'BrandCrest'

// ── Brand panel (the "sidebar") ─────────────────────────────────────────────────

const BrandPanel = ({ brand, ar }: { brand: ResolvedBrand; ar: boolean }) => (
  <div
    className="relative hidden lg:flex lg:w-1/2 flex-col items-center justify-center overflow-hidden border-e border-border px-12 py-16"
    style={{ background: 'var(--togo-ink, #0B1429)', color: 'var(--togo-paper, #F0EBE1)' }}
  >
    {/* The grid's hatch on the ink ground — hairline diagonals, never a gradient or glow. */}
    <div
      className="absolute inset-0 opacity-[0.1]"
      style={{ backgroundImage: 'repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 10px)' }}
      aria-hidden="true"
    />

    <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-7 text-center text-white">
      <BrandCrest brand={brand} size="lg" onPanel />
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[2rem] font-bold leading-tight tracking-tight">{brandName(brand, ar)}</h1>
        <p className="text-sm leading-relaxed text-white/75">
          {ar ? brand.tagline.ar : brand.tagline.en}
        </p>
      </div>

      {/* Feature bullets — only rendered when the product supplies them.
          Default brand omits them for the clean mofa.id look. */}
      {brand.bullets.length > 0 && (
        <ul className="mt-1 flex w-full flex-col items-center gap-3.5 text-center text-sm text-white/85">
          {brand.bullets.map((bullet, i) => (
            <li key={i} className="flex items-center justify-center gap-2.5">
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/15"
                aria-hidden="true"
              >
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <span className="leading-snug">{ar ? bullet.ar : bullet.en}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-white/55">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {ar ? brand.secureNote.ar : brand.secureNote.en}
      </div>
    </div>
  </div>
)
BrandPanel.displayName = 'BrandPanel'

// ── Component ───────────────────────────────────────────────────────────────────

const AuthCard = ({
  children,
  language = 'en',
  layout = 'split',
  onLanguageToggle,
  brand: brandProp,
  className,
}: AuthCardProps) => {
  const ar = language === 'ar'
  const dir = ar ? 'rtl' : 'ltr'

  const brand: ResolvedBrand = {
    ...DEFAULT_BRAND,
    ...brandProp,
    // Preserve the default icon unless the caller explicitly set `icon` (incl. null).
    icon: brandProp && 'icon' in brandProp ? brandProp.icon : DEFAULT_BRAND.icon,
    tagline: { ...DEFAULT_BRAND.tagline, ...brandProp?.tagline },
    bullets: brandProp?.bullets ?? DEFAULT_BRAND.bullets,
    secureNote: { ...DEFAULT_BRAND.secureNote, ...brandProp?.secureNote },
  }

  const langToggle = onLanguageToggle && (
    <div className="absolute end-4 top-4 z-20">
      <Button
        variant="ghost"
        size="sm"
        onClick={onLanguageToggle}
        className="text-xs font-medium"
        aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}
      >
        {ar ? 'EN' : 'ع'}
      </Button>
    </div>
  )

  // ── Centered / minimal: single column, compact brand header, no side panel ──
  if (layout === 'centered' || layout === 'minimal') {
    const bare = layout === 'minimal'
    return (
      <div
        dir={dir}
        className={cn(
          'relative flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-12',
          className,
        )}
      >
        {langToggle}
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandCrest brand={brand} size="md" onPanel={false} />
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-base font-semibold text-foreground">{brandName(brand, ar)}</span>
            <span className="text-xs text-muted-foreground">
              {ar ? brand.tagline.ar : brand.tagline.en}
            </span>
          </div>
        </div>
        {bare ? (
          <div className="w-full max-w-sm">{children}</div>
        ) : (
          <Card className="w-full max-w-sm shadow-lg">
            <CardContent className="pt-6">{children}</CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ── Split / split-reverse: brand panel + form card ──────────────────────────
  // `split` puts the brand on the leading (start) side, `split-reverse` on the
  // trailing (end) side. flex-row-reverse swaps the visual order; with dir=rtl
  // the row already mirrors, so reverse composes correctly either way.
  const reverse = layout === 'split-reverse'

  return (
    <div
      dir={dir}
      className={cn(
        'relative flex min-h-screen w-full',
        reverse ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
    >
      {langToggle}

      <BrandPanel brand={brand} ar={ar} />

      {/* Form side — bare on the background (no card chrome) for the clean,
          flat mofa.id look. Full width on mobile, half-width lg+. */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12 lg:w-1/2">
        {/* Mobile brand header — shown below lg */}
        <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
          <BrandCrest brand={brand} size="md" onPanel={false} />
          <span className="text-sm font-semibold text-foreground">{brandName(brand, ar)}</span>
        </div>

        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
AuthCard.displayName = 'AuthCard'

export default AuthCard
