'use client'

// ForgotForm — forgot password.
// State machine: 'form' → 'sent' (always, no enumeration — same response whether
// the account exists or not).
// All transport removed: calls props.authClient.forgotPassword.

import { useState } from 'react'
import { Mail, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@togo-framework/ui-core'
import { Input } from '@togo-framework/ui-core'
import { Label } from '@togo-framework/ui-core'
import type { AuthClient } from './AuthClient'
import AuthErrorAlert from './AuthErrorAlert'
import AuthStepHeader from './AuthStepHeader'

type ForgotState = 'form' | 'sent'

interface ForgotFormProps {
  /** Transport seam. */
  authClient: AuthClient
  /** Called when the user clicks "Back to sign in". Fort's router handles navigation. */
  onBack?: () => void
  /** Display language. Default: 'en'. */
  language?: 'en' | 'ar'
}

const ForgotForm = ({ authClient, onBack, language = 'en' }: ForgotFormProps) => {
  const ar = language === 'ar'

  const [formState, setFormState] = useState<ForgotState>('form')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setEmailError('')

    if (!email || !email.includes('@')) {
      setEmailError(ar ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.')
      return
    }

    setIsPending(true)
    try {
      await authClient.forgotPassword(email)
      setFormState('sent')
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || ''
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
        setError(ar ? 'خطأ في الاتصال. يرجى المحاولة مرة أخرى.' : 'Connection error. Please try again.')
      } else {
        // Even on server error show sent state (no enumeration)
        setFormState('sent')
      }
    } finally {
      setIsPending(false)
    }
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    }
  }

  // ── Sent state ─────────────────────────────────────────────────────────────
  if (formState === 'sent') {
    return (
      <div className="flex flex-col gap-6">
        <AuthStepHeader
          icon={<Mail className="h-7 w-7" aria-hidden="true" />}
          title={ar ? 'تحقق من بريدك الإلكتروني' : 'Check your email'}
          subtitle={
            ar
              ? 'إذا كان هناك حساب بهذا البريد، ستستلم رابط الإعادة قريباً.'
              : "If an account with that email exists, you'll receive a reset link shortly."
          }
          centered
        />
        <p className="text-xs text-muted-foreground text-center">
          {ar ? 'ينتهي الرابط خلال 15 دقيقة.' : 'The link expires in 15 minutes.'}
        </p>

        <Button variant="outline" className="w-full" asChild>
          <a href="mailto:" aria-label={ar ? 'فتح تطبيق البريد' : 'Open email app'}>
            {ar ? 'فتح تطبيق البريد' : 'Open email app'}
          </a>
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {ar ? 'لم تستلمه؟ تحقق من مجلد البريد غير المرغوب أو ' : "Didn't receive it? Check your spam folder or "}
          <button
            type="button"
            onClick={() => setFormState('form')}
            className="text-xs text-primary hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {ar ? 'حاول مجدداً' : 'try again'}
          </button>
        </p>

        {onBack && (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-fast ease-standard self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            {ar ? 'العودة إلى تسجيل الدخول' : 'Back to sign in'}
          </button>
        )}
      </div>
    )
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <AuthStepHeader
        title={ar ? 'نسيت كلمة المرور؟' : 'Forgot your password?'}
        subtitle={
          ar
            ? 'أدخل بريدك الإلكتروني وسنرسل رابط الإعادة إذا كان الحساب موجوداً.'
            : "Enter your email and we'll send a reset link if an account exists."
        }
      />

      <AuthErrorAlert error={error} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="forgot-email" className="text-sm font-medium text-foreground text-start">
          {ar ? 'البريد الإلكتروني' : 'Email address'}
        </Label>
        <Input
          id="forgot-email"
          type="email"
          /* LTR email content, but right-aligned in RTL so it matches the
             right-aligned label (Rule 8 — full RTL). */
          dir="ltr"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setEmailError('') }}
          disabled={isPending}
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'forgot-email-error' : undefined}
          className={`${ar ? 'text-end' : ''} ${emailError ? 'border-destructive ring-destructive/30' : ''}`}
        />
        {emailError && (
          <p id="forgot-email-error" role="alert" className="text-xs text-destructive mt-1">
            {emailError}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {ar ? 'جارٍ الإرسال...' : 'Sending...'}
          </span>
        ) : (
          ar ? 'إرسال رابط الإعادة' : 'Send reset link'
        )}
      </Button>

      {onBack && (
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-fast ease-standard self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          {ar ? 'العودة إلى تسجيل الدخول' : 'Back to sign in'}
        </button>
      )}
    </form>
  )
}
ForgotForm.displayName = 'ForgotForm'

export default ForgotForm