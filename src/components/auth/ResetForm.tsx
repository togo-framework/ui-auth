'use client'

// ResetForm — set a new password using the token from the reset magic link URL.
// States: 'form' | 'success' | 'invalid'.
// Token validity discovered on submit (no pre-check that would enumerate tokens).
// All transport removed: calls props.authClient.resetPassword.

import { useState } from 'react'
import { Lock, Check, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@togo-framework/ui-core'
import { Label } from '@togo-framework/ui-core'
import type { AuthClient } from './AuthClient'
import { computeRules, computeScore } from './PasswordStrengthMeter'
import AuthErrorAlert from './AuthErrorAlert'
import AuthStepHeader from './AuthStepHeader'
import PasswordInput from './PasswordInput'
import PasswordStrengthMeter from './PasswordStrengthMeter'

interface ResetFormProps {
  /** Reset token extracted from the magic link URL query param. */
  token: string
  /** Transport seam. */
  authClient: AuthClient
  /** Called after password is successfully reset. Fort's router may navigate to sign-in. */
  onSuccess?: () => void
  /** Called when the user clicks "Request a new link". */
  onRequestNewLink?: () => void
  /** Display language. Default: 'en'. */
  language?: 'en' | 'ar'
}

type ResetState = 'form' | 'success' | 'invalid'

const ResetForm = ({
  token,
  authClient,
  onSuccess,
  onRequestNewLink,
  language = 'en',
}: ResetFormProps) => {
  const ar = language === 'ar'

  const [state, setState] = useState<ResetState>('form')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)

  const rules = computeRules(newPassword)
  const score = computeScore(rules)
  void score // used by PasswordStrengthMeter via prop — suppress unused warning
  const allRulesMet = rules.every(r => r.met)
  const passwordsMatch = newPassword === confirmPassword
  const canSubmit = allRulesMet && passwordsMatch && newPassword.length > 0 && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setConfirmError('')

    if (!allRulesMet) {
      setError(ar ? 'كلمة المرور لا تستوفي متطلبات القوة.' : 'Password does not meet strength requirements.')
      return
    }
    if (!passwordsMatch) {
      setConfirmError(ar ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.')
      return
    }

    setIsPending(true)
    try {
      await authClient.resetPassword(token, newPassword)
      setState('success')
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      const message = (err as { message?: string })?.message || ''
      if (status === 401 || status === 400 || message.includes('invalid') || message.includes('expired')) {
        setState('invalid')
      } else if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
        setError(ar ? 'خطأ في الاتصال. يرجى المحاولة مرة أخرى.' : 'Connection error. Please try again.')
      } else {
        setError(ar ? 'حدث خطأ ما. يرجى المحاولة مرة أخرى.' : 'Something went wrong. Please try again.')
      }
    } finally {
      setIsPending(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <div className="flex flex-col gap-6">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-green-600">
          <Check className="h-7 w-7" aria-hidden="true" />
        </div>
        <AuthStepHeader
          title={ar ? 'تم تحديث كلمة المرور' : 'Password updated'}
          subtitle={ar
            ? 'تم تغيير كلمة مرورك بنجاح. يمكنك الآن تسجيل الدخول.'
            : 'Your password has been changed successfully. You can now sign in.'
          }
          centered
        />
        <Button className="w-full" onClick={onSuccess}>
          {ar ? 'الانتقال إلى تسجيل الدخول' : 'Go to sign in'}
        </Button>
      </div>
    )
  }

  // ── Invalid token state ────────────────────────────────────────────────────
  if (state === 'invalid') {
    return (
      <div className="flex flex-col gap-6">
        <AuthStepHeader
          icon={<Lock className="h-7 w-7" aria-hidden="true" />}
          title={ar ? 'تعيين كلمة مرور جديدة' : 'Set a new password'}
        />
        <AuthErrorAlert
          error={ar
            ? 'هذا الرابط غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.'
            : 'This link is invalid or has expired. Please request a new one.'
          }
        />
        {onRequestNewLink && (
          <button
            type="button"
            onClick={onRequestNewLink}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-fast ease-standard self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            {ar ? 'طلب رابط جديد' : 'Request a new link'}
          </button>
        )}
      </div>
    )
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <AuthStepHeader
        icon={<Lock className="h-7 w-7" aria-hidden="true" />}
        title={ar ? 'تعيين كلمة مرور جديدة' : 'Set a new password'}
        subtitle={ar ? 'اختر كلمة مرور قوية لحسابك.' : 'Choose a strong password for your account.'}
      />

      <AuthErrorAlert error={error} />

      {/* New password */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password" className="text-sm font-medium text-foreground text-start">
          {ar ? 'كلمة المرور الجديدة' : 'New password'}
        </Label>
        <PasswordInput
          id="new-password"
          language={language}
          autoComplete="new-password"
          value={newPassword}
          onChange={e => setNewPassword((e as React.ChangeEvent<HTMLInputElement>).target.value)}
          disabled={isPending}
          aria-invalid={newPassword.length > 0 && !allRulesMet}
        />
        {newPassword.length > 0 && (
          <PasswordStrengthMeter password={newPassword} language={language} />
        )}
      </div>

      {/* Confirm password */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground text-start">
          {ar ? 'تأكيد كلمة المرور' : 'Confirm password'}
        </Label>
        <PasswordInput
          id="confirm-password"
          language={language}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={e => {
            setConfirmPassword((e as React.ChangeEvent<HTMLInputElement>).target.value)
            setConfirmError('')
          }}
          disabled={isPending}
          aria-invalid={!!confirmError}
          aria-describedby={confirmError ? 'confirm-password-error' : undefined}
          className={confirmError ? 'border-destructive ring-destructive/30' : ''}
        />
        {confirmError && (
          <p id="confirm-password-error" role="alert" className="text-xs text-destructive mt-1">
            {confirmError}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={!canSubmit || isPending}>
        {isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {ar ? 'جارٍ التحديث...' : 'Updating...'}
          </span>
        ) : (
          ar ? 'تعيين كلمة المرور' : 'Set new password'
        )}
      </Button>
    </form>
  )
}
ResetForm.displayName = 'ResetForm'

export default ResetForm