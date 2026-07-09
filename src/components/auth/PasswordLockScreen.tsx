'use client'

/**
 * PasswordLockScreen — full-screen password + TOTP unlock overlay.
 *
 * Used by FortProvider's idle-lock feature when the platform is configured with
 * lock_screen.enabled = true. Unlike the PIN-based LockScreen, this screen
 * verifies the user's account password (and TOTP code when 2FA is enrolled)
 * via POST /v1/auth/unlock.
 *
 * Design:
 *  - Full-screen overlay matching the AuthCard/centered aesthetic.
 *  - Platform brand icon + "Screen Locked" title.
 *  - Signed-in user's email shown for context.
 *  - Password field (PasswordInput component — show/hide toggle).
 *  - TOTP field (6-digit OTPBoxGroup) rendered only when hasTOTP=true or when
 *    the server returns a totp_required error on the first attempt.
 *  - "Unlock" button; loading state.
 *  - Error messages: wrong password, TOTP required, TOTP wrong, rate-limited.
 *  - "Switch account" (sign out) link — always visible.
 *  - 5 failed attempts → parent receives onForceLogout (server has already
 *    cleared the session via force-logout).
 *
 * Bilingual EN/AR + full RTL support (Rule 8/16).
 * Accessible: ARIA labels, role="alert" for errors, focus management.
 *
 * Props:
 *   user           — { name, email, avatarUrl }
 *   onUnlock       — async ({password, totp?}) → throws on failure with an
 *                    error code string as the message
 *   onSignOut      — called when the user clicks "Switch account"
 *   onForceLogout  — called when max attempts exceeded (session already cleared)
 *   language       — 'en' | 'ar'. Default: 'en'
 *   maxAttempts    — hard lock-out threshold. Default: 5
 *   hasTOTP        — whether the user has TOTP enrolled. Default: false.
 *                    When false, TOTP field is hidden until server says totp_required.
 *   className      — optional extra class on the outer wrapper
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, LogOut, ShieldCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@togo-framework/ui-core'
import { Button } from '@togo-framework/ui-core'
import { Label } from '@togo-framework/ui-core'
import OTPBoxGroup from './OTPBoxGroup'
import PasswordInput from './PasswordInput'
import { cn } from '@togo-framework/ui-core'

// ── i18n ──────────────────────────────────────────────────────────────────────

const STRINGS = {
  locked: { en: 'Screen Locked', ar: 'الشاشة مقفلة' },
  lockedDesc: {
    en: 'Enter your password to continue',
    ar: 'أدخل كلمة المرور للمتابعة',
  },
  password: { en: 'Password', ar: 'كلمة المرور' },
  totpLabel: { en: 'Two-factor code', ar: 'رمز التحقق الثنائي' },
  totpPlaceholder: { en: '6-digit code', ar: 'رمز مكوّن من 6 أرقام' },
  unlock: { en: 'Unlock', ar: 'فتح القفل' },
  unlocking: { en: 'Verifying…', ar: 'جارٍ التحقق…' },
  switchAccount: { en: 'Switch account', ar: 'تبديل الحساب' },
  // Error messages
  errInvalidCredentials: {
    en: 'Incorrect password. Please try again.',
    ar: 'كلمة المرور غير صحيحة. حاول مجددًا.',
  },
  errTotpRequired: {
    en: 'Enter your two-factor code to continue.',
    ar: 'أدخل رمز التحقق الثنائي للمتابعة.',
  },
  errInvalidTotp: {
    en: 'Incorrect two-factor code. Please try again.',
    ar: 'رمز التحقق الثنائي غير صحيح. حاول مجددًا.',
  },
  errTooMany: {
    en: 'Too many failed attempts. You have been signed out for security.',
    ar: 'محاولات فاشلة كثيرة. تم تسجيل خروجك لأسباب أمنية.',
  },
  errServer: {
    en: 'An error occurred. Please try again.',
    ar: 'حدث خطأ. حاول مجددًا.',
  },
  attemptsLeft: {
    en: (n: number) => `${n} attempt${n === 1 ? '' : 's'} remaining.`,
    ar: (n: number) => `متبقٍ ${n} ${n === 1 ? 'محاولة' : 'محاولات'}.`,
  },
} as const

type Lang = 'en' | 'ar'

function t(key: keyof typeof STRINGS, lang: Lang): string {
  const val = STRINGS[key][lang]
  return typeof val === 'string' ? val : ''
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PasswordLockScreenUser {
  name?: string | null
  email: string
  avatarUrl?: string | null
}

export interface UnlockCredentials {
  password: string
  totp?: string
}

export interface PasswordLockScreenProps {
  user: PasswordLockScreenUser
  /**
   * Called with the entered credentials. Should throw an Error whose message is
   * the server error code (e.g. "invalid_credentials", "totp_required",
   * "invalid_totp", "too_many_attempts").
   */
  onUnlock: (creds: UnlockCredentials) => Promise<void>
  /** Called when user clicks "Switch account". */
  onSignOut: () => void
  /**
   * Called when the server has force-logged-out after too many failures.
   * The session cookies are already cleared; the caller should redirect to login.
   */
  onForceLogout?: () => void
  /** UI language. Default: 'en'. */
  language?: Lang
  /** Max failed attempts before lockout state. Default: 5. */
  maxAttempts?: number
  /**
   * Whether the user has TOTP enrolled. When true the TOTP field is always
   * visible. When false (default), it appears only after a totp_required error.
   */
  hasTOTP?: boolean
  /** Optional extra class on the outer wrapper. */
  className?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name?: string | null, email?: string): string {
  if (name) {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  }
  return (email?.[0] ?? '?').toUpperCase()
}

function resolveError(
  code: string,
  lang: Lang,
  attemptsLeft: number,
  maxAttempts: number,
): string {
  const baseMsg = (() => {
    switch (code) {
      case 'invalid_credentials':
        return t('errInvalidCredentials', lang)
      case 'totp_required':
        return t('errTotpRequired', lang)
      case 'invalid_totp':
        return t('errInvalidTotp', lang)
      case 'too_many_attempts':
        return t('errTooMany', lang)
      default:
        return t('errServer', lang)
    }
  })()

  if (attemptsLeft > 0 && attemptsLeft < maxAttempts && code !== 'too_many_attempts' && code !== 'totp_required') {
    const suffix =
      lang === 'en'
        ? STRINGS.attemptsLeft.en(attemptsLeft)
        : STRINGS.attemptsLeft.ar(attemptsLeft)
    return `${baseMsg} ${suffix}`
  }
  return baseMsg
}

// ── Component ─────────────────────────────────────────────────────────────────

const PasswordLockScreen = ({
  user,
  onUnlock,
  onSignOut,
  onForceLogout,
  language = 'en',
  maxAttempts = 5,
  hasTOTP: hasTOTPProp = false,
  className,
}: PasswordLockScreenProps) => {
  const isRTL = language === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [showTOTP, setShowTOTP] = useState(hasTOTPProp)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [isForceLoggedOut, setIsForceLoggedOut] = useState(false)

  const isLockedOut = failedAttempts >= maxAttempts

  // Focus password field on mount.
  const passwordRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const timer = setTimeout(() => passwordRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [])

  // ── Submit handler ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (isLockedOut || isSubmitting || isForceLoggedOut) return
      if (!password) return

      setIsSubmitting(true)
      setErrorMsg(null)

      try {
        const creds: UnlockCredentials = { password }
        if (showTOTP && totp.length === 6) {
          creds.totp = totp
        }
        await onUnlock(creds)
        // onUnlock resolved → caller will clear the lock
      } catch (err) {
        const code = err instanceof Error ? err.message : 'server_error'

        if (code === 'totp_required') {
          // Server says TOTP is required — show the TOTP field without counting failure
          setShowTOTP(true)
          setErrorMsg(t('errTotpRequired', language))
          setIsSubmitting(false)
          return
        }

        if (code === 'too_many_attempts') {
          setIsForceLoggedOut(true)
          setErrorMsg(t('errTooMany', language))
          onForceLogout?.()
          setIsSubmitting(false)
          return
        }

        const newFailed = failedAttempts + 1
        setFailedAttempts(newFailed)
        setPassword('')
        setTotp('')

        const left = maxAttempts - newFailed
        setErrorMsg(resolveError(code, language, left, maxAttempts))
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      isLockedOut,
      isSubmitting,
      isForceLoggedOut,
      password,
      showTOTP,
      totp,
      onUnlock,
      failedAttempts,
      maxAttempts,
      language,
      onForceLogout,
    ],
  )

  const handleTOTPComplete = useCallback(
    (value: string) => {
      setTotp(value)
      // Auto-submit when TOTP is complete and password is filled.
      if (value.length === 6 && password) {
        void (async () => {
          setIsSubmitting(true)
          setErrorMsg(null)
          try {
            await onUnlock({ password, totp: value })
          } catch (err) {
            const code = err instanceof Error ? err.message : 'server_error'
            if (code === 'too_many_attempts') {
              setIsForceLoggedOut(true)
              setErrorMsg(t('errTooMany', language))
              onForceLogout?.()
              return
            }
            const newFailed = failedAttempts + 1
            setFailedAttempts(newFailed)
            setPassword('')
            setTotp('')
            setErrorMsg(resolveError(code, language, maxAttempts - newFailed, maxAttempts))
          } finally {
            setIsSubmitting(false)
          }
        })()
      }
    },
    [password, onUnlock, failedAttempts, maxAttempts, language, onForceLogout],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  const userInitials = initials(user.name, user.email)
  const displayName = user.name ?? user.email

  return (
    <div
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={t('locked', language)}
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center',
        'bg-background/95 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-border bg-background-surface p-8 shadow-2xl">

        {/* Lock icon */}
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Lock className="h-7 w-7" strokeWidth={1.75} />
        </div>

        {/* Title */}
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-xl font-bold text-foreground">
            {t('locked', language)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('lockedDesc', language)}
          </p>
        </div>

        {/* User identity row */}
        <div
          className="flex items-center gap-3"
          aria-label={displayName}
        >
          <Avatar className="h-11 w-11 shrink-0">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={displayName} />
            )}
            <AvatarFallback className="text-sm font-semibold" aria-hidden="true">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {displayName}
            </span>
            <span className="truncate text-xs text-muted-foreground" dir="ltr">
              {user.email}
            </span>
          </div>
        </div>

        {/* Form */}
        <form
          className="flex w-full flex-col gap-4"
          onSubmit={(e) => void handleSubmit(e)}
          aria-disabled={isForceLoggedOut || isLockedOut}
        >
          {/* Password field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unlock-password" className="text-sm font-medium">
              {t('password', language)}
            </Label>
            {/* PasswordInput is a sentra-ui component with show/hide toggle */}
            <PasswordInput
              id="unlock-password"
              ref={passwordRef}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting || isLockedOut || isForceLoggedOut}
              autoComplete="current-password"
              lang={language}
            />
          </div>

          {/* TOTP field — shown when hasTOTP=true or after totp_required error */}
          {showTOTP && (
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {t('totpLabel', language)}
              </Label>
              <OTPBoxGroup
                value={totp}
                onChange={setTotp}
                onComplete={handleTOTPComplete}
                disabled={isSubmitting || isLockedOut || isForceLoggedOut}
                ariaLabel={t('totpLabel', language)}
              />
            </div>
          )}

          {/* Error message */}
          {errorMsg && (
            <p
              role="alert"
              className={cn(
                'text-center text-sm',
                isLockedOut || isForceLoggedOut
                  ? 'font-medium text-destructive'
                  : 'text-destructive',
              )}
            >
              {errorMsg}
            </p>
          )}

          {/* Unlock button — hidden when force-logged out */}
          {!isLockedOut && !isForceLoggedOut && (
            <Button
              type="submit"
              className="w-full"
              disabled={!password || isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? t('unlocking', language) : t('unlock', language)}
            </Button>
          )}
        </form>

        {/* Switch account link — always visible */}
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          {t('switchAccount', language)}
        </button>
      </div>
    </div>
  )
}

PasswordLockScreen.displayName = 'PasswordLockScreen'

export default PasswordLockScreen
