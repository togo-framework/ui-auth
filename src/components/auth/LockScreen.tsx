'use client'

/**
 * LockScreen — full-screen PIN unlock overlay.
 *
 * Used when a user has locked their session (manually or via idle timeout).
 * Renders as a full-screen overlay matching the AuthCard/centered aesthetic:
 *  - User avatar + display name + email
 *  - PIN entry via OTPBoxGroup (4-6 digits; auto-submits on 6 digits)
 *  - "Unlock" action button
 *  - Wrong-PIN error state with attempt counter; hard lockout after maxAttempts
 *  - "Not you? Sign out" escape hatch
 *
 * Bilingual EN/AR with full RTL support (Rule 8/16).
 * Accessible: ARIA labels, focus management, role="alert" for errors.
 *
 * Props:
 *   user           — { name, email, avatarUrl } for the avatar row.
 *   onUnlock       — async callback given the entered PIN; should throw on failure
 *                    (the component catches and shows error + increments attempts).
 *   onSignOut      — called when the user clicks "Not you? Sign out".
 *   language       — 'en' | 'ar'. Default: 'en'.
 *   pinLength      — exact PIN length expected. Default: 6. Accepts 4-6.
 *   maxAttempts    — failed attempts before "too many attempts" lockout. Default: 5.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, LogOut } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@togo-framework/ui-core'
import { Button } from '@togo-framework/ui-core'
import OTPBoxGroup from './OTPBoxGroup'
import { cn } from '@togo-framework/ui-core'

// ── i18n ──────────────────────────────────────────────────────────────────────

const STRINGS = {
  locked: { en: 'Screen Locked', ar: 'الشاشة مقفلة' },
  enterPin: { en: 'Enter your PIN to continue', ar: 'أدخل رمز PIN للمتابعة' },
  unlock: { en: 'Unlock', ar: 'فتح القفل' },
  unlocking: { en: 'Verifying…', ar: 'جارٍ التحقق…' },
  wrongPin: { en: 'Incorrect PIN. Please try again.', ar: 'رمز PIN غير صحيح. حاول مجددًا.' },
  attemptsLeft: {
    en: (n: number) => `${n} attempt${n === 1 ? '' : 's'} remaining.`,
    ar: (n: number) => `متبقٍ ${n} ${n === 1 ? 'محاولة' : 'محاولات'}.`,
  },
  tooManyAttempts: {
    en: 'Too many failed attempts. Please sign out and sign in again.',
    ar: 'محاولات خاطئة كثيرة. يُرجى تسجيل الخروج وإعادة تسجيل الدخول.',
  },
  signOut: { en: 'Not you? Sign out', ar: 'لست أنت؟ تسجيل الخروج' },
} as const

type Lang = 'en' | 'ar'

function tr(key: keyof typeof STRINGS, lang: Lang): string {
  const val = STRINGS[key][lang]
  return typeof val === 'string' ? val : ''
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LockScreenUser {
  /** Display name (language-resolved by caller). */
  name?: string | null
  email: string
  avatarUrl?: string | null
}

export interface LockScreenProps {
  user: LockScreenUser
  /**
   * Called with the entered PIN when the user submits.
   * Should throw (or reject) if the PIN is wrong so the component can count
   * failed attempts. On success it should resolve without throwing.
   */
  onUnlock: (pin: string) => Promise<void>
  /** Called when the user clicks "Not you? Sign out". */
  onSignOut: () => void
  /** Current UI language. Default: 'en'. */
  language?: Lang
  /**
   * Exact PIN length expected. Accepts 4-6. Default: 6.
   * NOTE: OTPBoxGroup always renders 6 slots; when pinLength < 6 the component
   * auto-submits on the Nth digit instead of the 6th.
   */
  pinLength?: 4 | 5 | 6
  /** Max failed attempts before the lockout state. Default: 5. */
  maxAttempts?: number
  /** Optional extra class on the outer wrapper. */
  className?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeInitials(name?: string | null, email?: string): string {
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

// ── Component ─────────────────────────────────────────────────────────────────

const LockScreen = ({
  user,
  onUnlock,
  onSignOut,
  language = 'en',
  pinLength = 6,
  maxAttempts = 5,
  className,
}: LockScreenProps) => {
  const isRTL = language === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  const [pin, setPin] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const isLockedOut = failedAttempts >= maxAttempts

  // Focus the OTP input when the lock screen mounts.
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      const firstInput = containerRef.current?.querySelector<HTMLInputElement>(
        'input[type="text"], input[inputmode="numeric"]',
      )
      firstInput?.focus()
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  // ── Submit handler ────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (submittedPin: string) => {
      if (isLockedOut || isSubmitting) return
      if (submittedPin.length < pinLength) return

      setIsSubmitting(true)
      setErrorMsg(null)

      try {
        await onUnlock(submittedPin)
        // onUnlock resolved → caller will clear the lock; no local state change needed.
      } catch {
        const newFailed = failedAttempts + 1
        setFailedAttempts(newFailed)
        setPin('')

        if (newFailed >= maxAttempts) {
          setErrorMsg(tr('tooManyAttempts', language))
        } else {
          const left = maxAttempts - newFailed
          const attemptsStr =
            language === 'en'
              ? STRINGS.attemptsLeft.en(left)
              : STRINGS.attemptsLeft.ar(left)
          setErrorMsg(`${tr('wrongPin', language)} ${attemptsStr}`)
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [isLockedOut, isSubmitting, pinLength, onUnlock, failedAttempts, maxAttempts, language],
  )

  const handlePinComplete = useCallback(
    (value: string) => {
      void handleSubmit(value)
    },
    [handleSubmit],
  )

  const handleUnlockClick = useCallback(() => {
    void handleSubmit(pin)
  }, [handleSubmit, pin])

  // ── Render ────────────────────────────────────────────────────────────────

  const initials = computeInitials(user.name, user.email)
  const displayName = user.name ?? user.email

  return (
    // Full-screen overlay — sits above everything via z-[9999].
    <div
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={tr('locked', language)}
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center',
        'bg-background/95 backdrop-blur-sm',
        className,
      )}
      ref={containerRef}
    >
      {/* Inner card */}
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-border bg-background-surface p-8 shadow-2xl">

        {/* Lock icon header */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
          <Lock className="h-7 w-7" strokeWidth={1.75} />
        </div>

        {/* Title */}
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-xl font-bold text-foreground">
            {tr('locked', language)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tr('enterPin', language)}
          </p>
        </div>

        {/* User identity row */}
        <div className="flex items-center gap-3" aria-label={`${displayName} ${user.email}`}>
          <Avatar className="h-11 w-11 shrink-0">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={displayName} />
            )}
            <AvatarFallback className="text-sm font-semibold" aria-hidden="true">
              {initials}
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

        {/* PIN input */}
        <div className="w-full">
          <OTPBoxGroup
            value={pin}
            onChange={setPin}
            onComplete={handlePinComplete}
            disabled={isSubmitting || isLockedOut}
            ariaLabel={tr('enterPin', language)}
            autoFocus
          />
        </div>

        {/* Error message */}
        {errorMsg && (
          <p
            role="alert"
            className={cn(
              'text-center text-sm',
              isLockedOut ? 'font-medium text-destructive' : 'text-destructive',
            )}
          >
            {errorMsg}
          </p>
        )}

        {/* Unlock button */}
        {!isLockedOut && (
          <Button
            type="button"
            className="w-full"
            onClick={handleUnlockClick}
            disabled={pin.length < pinLength || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? tr('unlocking', language) : tr('unlock', language)}
          </Button>
        )}

        {/* Sign-out escape hatch — always visible */}
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          {tr('signOut', language)}
        </button>
      </div>
    </div>
  )
}

LockScreen.displayName = 'LockScreen'

export default LockScreen
