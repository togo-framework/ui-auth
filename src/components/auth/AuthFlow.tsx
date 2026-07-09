'use client'

// AuthFlow — convenience wrapper that orchestrates the full auth flow:
//   login → OTP → 2FA → forgot → reset
// in a single component, managing step state and rendering the correct form.
//
// Fort's web can use either:
//   A) <AuthFlow authClient={...} onSuccess={...} />  (full flow, one component)
//   B) Individual forms — LoginForm, ForgotForm, ResetForm, TwoFAForm — for
//      page-per-step architectures (Next.js pages router, etc.).
//
// AuthFlow is best for embedded auth panels (modals, sidebars) where you don't
// want to navigate between pages.

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import type { AuthClient, AuthCardBrand } from './index'
import AuthCard, { type AuthLayout } from './AuthCard'
import LoginForm from './LoginForm'
import ForgotForm from './ForgotForm'
import ResetForm from './ResetForm'
import TwoFAForm from './TwoFAForm'

type FlowStep =
  | { name: 'login' }
  | { name: 'twofa'; challengeToken?: string }
  | { name: 'forgot' }
  | { name: 'reset'; token: string }

interface AuthFlowProps {
  /** Transport seam — Fort's web passes its concrete implementation. */
  authClient: AuthClient
  /**
   * Reset token from URL query param.
   * When provided, flow starts at the 'reset' step directly.
   */
  resetToken?: string
  /** Called after the user is fully authenticated. */
  onSuccess?: () => void
  /**
   * Display language. Default: 'en'.
   * Toggling is handled internally unless you pass `onLanguageToggle`.
   */
  language?: 'en' | 'ar'
  /**
   * Override the language toggle handler.
   * If omitted, AuthFlow toggles internally between 'en' and 'ar'.
   * If `null`, the toggle button is hidden.
   */
  onLanguageToggle?: (() => void) | null
  /** Brand customisation forwarded to AuthCard. */
  brand?: AuthCardBrand
  /**
   * AuthCard layout variant forwarded to AuthCard.
   * 'split' | 'split-reverse' | 'centered' | 'minimal'. Default: 'split'.
   * Lets Fort pick a brand-panel layout (or a panel-less centered card).
   */
  layout?: AuthLayout
  /** If true, wraps the flow in an AuthCard (brand panel + card). Default: true. */
  withCard?: boolean
  /**
   * Whether to show the "Remember me" checkbox on the login step.
   *
   * Forwarded directly to `LoginForm`.  Set to `false` when the server's
   * `session.remember_me_enabled` setting is disabled so the checkbox is
   * hidden and `login` is always called with `rememberMe = false`.
   *
   * Default: `true`.
   */
  showRememberMe?: boolean
  /**
   * @deprecated — Email-first is now the default and only flow.
   * This prop is accepted but ignored; kept for back-compat so existing
   * callers that pass `emailFirst={true}` continue to compile.
   */
  emailFirst?: boolean
}

const AuthFlow = ({
  authClient,
  resetToken,
  onSuccess,
  language: languageProp = 'en',
  onLanguageToggle,
  brand,
  layout = 'split',
  withCard = true,
  showRememberMe = true,
  // emailFirst is accepted but ignored — email-first is now always on
  emailFirst: _emailFirst = false,
}: AuthFlowProps) => {
  // Language is rendered from internal state so the built-in toggle actually
  // switches the UI (uncontrolled mode). When the caller drives language via the
  // `language` prop (controlled mode, e.g. Fort's FortProvider), the effect below
  // syncs the prop into internal state. Previously `effectiveLanguage` read the
  // prop directly (default 'en'), so the internal toggle was a no-op — the
  // language switch did nothing. This restores it for both modes.
  const [internalLanguage, setInternalLanguage] = useState<'en' | 'ar'>(languageProp)
  useEffect(() => {
    setInternalLanguage(languageProp)
  }, [languageProp])
  const effectiveLanguage = internalLanguage

  const [step, setStep] = useState<FlowStep>(
    resetToken ? { name: 'reset', token: resetToken } : { name: 'login' }
  )

  // Terminal "signing you in" state. After the auth API succeeds, the caller's
  // onSuccess typically triggers a router navigation whose destination can take
  // a long time to compile/load (20-50s in dev). Without this state the form
  // snaps back to idle and the screen "looks stuck" until the new page paints.
  // Once set, this is never reset — the navigation unmounts the component, so
  // the spinner persists exactly until the page actually unloads.
  const [isRedirecting, setIsRedirecting] = useState(false)

  const handleAuthSuccess = () => {
    setIsRedirecting(true)
    onSuccess?.()
  }

  const handleToggleLanguage = () => {
    setInternalLanguage(prev => (prev === 'en' ? 'ar' : 'en'))
  }

  const languageToggleCallback =
    onLanguageToggle === null
      ? undefined
      : onLanguageToggle ?? handleToggleLanguage

  const content = (() => {
    // Full-form post-login state — replaces the form (button included) so
    // nothing on screen looks idle while the destination page loads (Rule 8:
    // bilingual). aria-live announces the transition to screen readers.
    if (isRedirecting) {
      return (
        <div
          className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-foreground">
              {effectiveLanguage === 'ar' ? 'جارٍ تسجيل الدخول...' : 'Signing you in...'}
            </p>
            <p className="text-sm text-muted-foreground">
              {effectiveLanguage === 'ar'
                ? 'لحظات من فضلك — يتم تجهيز لوحتك.'
                : 'One moment — preparing your dashboard.'}
            </p>
          </div>
        </div>
      )
    }

    if (step.name === 'reset' && step.token) {
      return (
        <ResetForm
          token={step.token}
          authClient={authClient}
          language={effectiveLanguage}
          onSuccess={() => setStep({ name: 'login' })}
          onRequestNewLink={() => setStep({ name: 'forgot' })}
        />
      )
    }

    if (step.name === 'forgot') {
      return (
        <ForgotForm
          authClient={authClient}
          language={effectiveLanguage}
          onBack={() => setStep({ name: 'login' })}
        />
      )
    }

    if (step.name === 'twofa') {
      return (
        <TwoFAForm
          authClient={authClient}
          challengeToken={step.challengeToken}
          language={effectiveLanguage}
          onSuccess={handleAuthSuccess}
          onTooManyAttempts={() => setStep({ name: 'login' })}
        />
      )
    }

    // default: 'login'
    return (
      <LoginForm
        authClient={authClient}
        language={effectiveLanguage}
        onSuccess={handleAuthSuccess}
        on2FA={(challengeToken) => setStep({ name: 'twofa', challengeToken })}
        onForgotPassword={() => setStep({ name: 'forgot' })}
        showRememberMe={showRememberMe}
      />
    )
  })()

  if (!withCard) return <>{content}</>

  return (
    <AuthCard
      language={effectiveLanguage}
      layout={layout}
      onLanguageToggle={languageToggleCallback}
      brand={brand}
    >
      {content}
    </AuthCard>
  )
}
AuthFlow.displayName = 'AuthFlow'

export default AuthFlow