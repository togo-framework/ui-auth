'use client'

// TwoFAForm — 2FA login challenge.
// Two views: 'totp' (6-digit OTP boxes, auto-submit) and 'recovery' (plain text input).
// All transport removed: calls props.authClient.verify2FA.
// challengeToken is passed as a prop (callers store it in their own state after
// LoginForm fires on2FA — no sessionStorage dependency).

import { useState, useCallback } from 'react'
import { Shield, KeyRound, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@togo-framework/ui-core'
import { Input } from '@togo-framework/ui-core'
import { Label } from '@togo-framework/ui-core'
import type { AuthClient } from './AuthClient'
import AuthErrorAlert from './AuthErrorAlert'
import AuthStepHeader from './AuthStepHeader'
import OTPBoxGroup from './OTPBoxGroup'

type View = 'totp' | 'recovery'

interface TwoFAFormProps {
  /** Transport seam. */
  authClient: AuthClient
  /**
   * Opaque challenge token from LoginForm's on2FA callback.
   * Pass it directly — the form forwards it to authClient.verify2FA.
   */
  challengeToken?: string
  /** Called after successful 2FA verification. */
  onSuccess?: () => void
  /** Called when the server rejects the code with "too many attempts". */
  onTooManyAttempts?: () => void
  /** Display language. Default: 'en'. */
  language?: 'en' | 'ar'
}

const TwoFAForm = ({
  authClient,
  challengeToken,
  onSuccess,
  onTooManyAttempts,
  language = 'en',
}: TwoFAFormProps) => {
  const ar = language === 'ar'

  const [view, setView] = useState<View>('totp')
  const [totpValue, setTotpValue] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const submitVerify = useCallback(async (codeOverride?: string) => {
    const code = codeOverride ?? (view === 'totp' ? totpValue : recoveryCode)
    if (!code) return
    setError('')
    setIsVerifying(true)
    try {
      await authClient.verify2FA(code, challengeToken)
      onSuccess?.()
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || ''
      if (view === 'totp') setTotpValue('')
      else setRecoveryCode('')

      if (message.includes('too_many') || message.includes('attempts')) {
        setError(ar ? 'محاولات كثيرة جداً. يرجى تسجيل الدخول من جديد.' : 'Too many attempts. Please sign in again.')
        setTimeout(() => onTooManyAttempts?.(), 2500)
      } else if (message.includes('used')) {
        setError(ar ? 'تم استخدام هذا الرمز مسبقاً.' : 'This code has already been used.')
      } else if (view === 'recovery') {
        setError(ar ? 'رمز الاسترداد غير معروف.' : 'Recovery code not recognised.')
      } else {
        setError(ar ? 'الرمز غير صحيح. يرجى المحاولة مرة أخرى.' : 'Code incorrect. Please try again.')
      }
    } finally {
      setIsVerifying(false)
    }
  }, [view, totpValue, recoveryCode, challengeToken, ar, authClient, onSuccess, onTooManyAttempts])

  const handleTotpComplete = useCallback(async (value: string) => {
    await submitVerify(value)
  }, [submitVerify])

  // ── Recovery view ──────────────────────────────────────────────────────────
  if (view === 'recovery') {
    return (
      <div className="flex flex-col gap-6">
        <AuthStepHeader
          icon={<KeyRound className="h-7 w-7" aria-hidden="true" />}
          title={ar ? 'استخدام رمز الاسترداد' : 'Use a recovery code'}
          subtitle={ar
            ? 'أدخل أحد رموز الاسترداد المحفوظة. يمكن استخدام كل رمز مرة واحدة فقط.'
            : 'Enter one of your saved recovery codes. Each code can only be used once.'
          }
          centered
        />

        <AuthErrorAlert error={error} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="recovery-code" className="text-sm font-medium text-foreground text-start">
            {ar ? 'رمز الاسترداد' : 'Recovery code'}
          </Label>
          <Input
            id="recovery-code"
            type="text"
            /* Recovery codes are LTR/monospace, but right-align in RTL so the
               placeholder sits under the right-aligned label (Rule 8). */
            dir="ltr"
            autoComplete="off"
            placeholder="XXXX-XXXXXX"
            value={recoveryCode}
            onChange={e => setRecoveryCode(e.target.value)}
            disabled={isVerifying}
            className={`font-mono ${ar ? 'text-end' : ''}`}
          />
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={!recoveryCode.trim() || isVerifying}
          onClick={() => submitVerify()}
        >
          {isVerifying ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {ar ? 'جارٍ التحقق...' : 'Verifying...'}
            </span>
          ) : (
            ar ? 'تحقق' : 'Verify'
          )}
        </Button>

        <button
          type="button"
          onClick={() => { setView('totp'); setError(''); setRecoveryCode('') }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-fast ease-standard self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          {ar ? 'العودة إلى رمز المصادقة' : 'Back to authenticator code'}
        </button>
      </div>
    )
  }

  // ── TOTP view ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <AuthStepHeader
        icon={<Shield className="h-7 w-7" aria-hidden="true" />}
        title={ar ? 'التحقق بخطوتين' : 'Two-factor authentication'}
        subtitle={ar
          ? 'أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة.'
          : 'Enter the 6-digit code from your authenticator app.'
        }
        centered
      />

      <AuthErrorAlert error={error} />

      <div className="flex flex-col gap-2">
        <Label className="sr-only">
          {ar ? 'رمز المصادقة' : 'Authenticator code'}
        </Label>
        <OTPBoxGroup
          value={totpValue}
          onChange={setTotpValue}
          onComplete={handleTotpComplete}
          disabled={isVerifying}
          ariaLabel={ar ? 'التحقق بخطوتين' : 'Two-factor authentication'}
          autoFocus
        />
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={totpValue.length < 6 || isVerifying}
        onClick={() => submitVerify()}
      >
        {isVerifying ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {ar ? 'جارٍ التحقق...' : 'Verifying...'}
          </span>
        ) : (
          ar ? 'تحقق' : 'Verify'
        )}
      </Button>

      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          {ar ? 'فقدت الوصول إلى تطبيق المصادقة؟' : 'Lost access to your authenticator?'}
        </p>
        <button
          type="button"
          onClick={() => { setView('recovery'); setError(''); setTotpValue('') }}
          className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          {ar ? 'استخدام رمز الاسترداد بدلاً من ذلك' : 'Use a recovery code instead'}
        </button>
      </div>
    </div>
  )
}
TwoFAForm.displayName = 'TwoFAForm'

export default TwoFAForm