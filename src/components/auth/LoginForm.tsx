'use client'

// LoginForm — email-first / progressive flow.
//
// Step A 'email':        Email field + Continue button.
// Step B 'credentials':  Methods resolved via getLoginMethods(email).
//                        Renders exactly the options the platform allows:
//                          email_password → PasswordInput + Sign-in + Remember me
//                          magic_link     → "Send magic link" button
//                          otp            → "Email me a code" button
//                          google_oauth   → Google button
//                          github         → GitHub button
//                          azure          → Microsoft button
//                        + "Use a different email" back link.
// Step C 'otp':          OTPBoxGroup verification (reused for both post-password OTP
//                        and passwordless email-code path).
//
// Fail-open: if getLoginMethods is undefined or throws, methods defaults to
// DEFAULT_LOGIN_METHODS — which includes magic-link and email-OTP alongside
// password, so those flows stay visible on the auth page even when the server
// can't resolve per-email methods. The server still rejects any method a given
// user isn't actually allowed to use.

import { useState, useEffect, useRef, useCallback } from 'react'
import { Mail, ArrowLeft, Loader2, Github, Terminal } from 'lucide-react'
import { Button } from '@togo-framework/ui-core'
import { Checkbox } from '@togo-framework/ui-core'
import { Input } from '@togo-framework/ui-core'
import { Label } from '@togo-framework/ui-core'
import { Separator } from '@togo-framework/ui-core'
import type { AuthClient } from './AuthClient'
import AuthErrorAlert from './AuthErrorAlert'
import AuthStepHeader from './AuthStepHeader'
import PasswordInput from './PasswordInput'
import OTPBoxGroup from './OTPBoxGroup'

type Step = 'email' | 'credentials' | 'otp'

// Where did the OTP step originate?
// 'post-password'  → server returned otp challenge after password login
// 'passwordless'   → user clicked "Email me a code" or "Send magic link"
// Both back-links return to 'credentials' (email already resolved).
type OtpSource = 'post-password' | 'passwordless'

// Fail-open default — keeps password + magic-link + email-OTP visible when the
// server can't resolve per-email methods. The server enforces what's actually
// allowed for each user; this only governs which buttons the UI offers.
const DEFAULT_LOGIN_METHODS = ['email_password', 'magic_link', 'otp']

interface LoginFormProps {
  authClient: AuthClient
  onSuccess?: () => void
  on2FA?: (challengeToken?: string) => void
  onOAuthRedirect?: (url: string) => void
  onForgotPassword?: () => void
  language?: 'en' | 'ar'
  showRememberMe?: boolean
}

// ─── OAuth provider icons ──────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)
GoogleIcon.displayName = 'GoogleIcon'

const MicrosoftIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022" />
    <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00" />
    <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF" />
    <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900" />
  </svg>
)
MicrosoftIcon.displayName = 'MicrosoftIcon'

// ─── Component ─────────────────────────────────────────────────────────────────

const LoginForm = ({
  authClient,
  onSuccess,
  on2FA,
  onOAuthRedirect,
  onForgotPassword,
  language = 'en',
  showRememberMe = true,
}: LoginFormProps) => {
  const ar = language === 'ar'

  const [step, setStep] = useState<Step>('email')
  const [otpSource, setOtpSource] = useState<OtpSource>('post-password')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpValue, setOtpValue] = useState('')
  const [challengeToken, setChallengeToken] = useState<string | undefined>()

  // Fail-open default: 'email_password' always works.
  const [resolvedMethods, setResolvedMethods] = useState<string[]>(DEFAULT_LOGIN_METHODS)
  const [isResolvingMethods, setIsResolvingMethods] = useState(false)

  const [emailError, setEmailError] = useState('')
  const [error, setError] = useState('')
  const [hideSocialButtons, setHideSocialButtons] = useState(false)

  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [rememberMe, setRememberMe] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false)

  const liveRef = useRef<HTMLParagraphElement | null>(null)

  const startCountdown = useCallback((seconds = 30) => {
    setCountdown(seconds)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  // sendLoginOtp with sendOtp fallback (back-compat)
  const dispatchLoginOtp = useCallback(async (emailAddr: string): Promise<void> => {
    if (authClient.sendLoginOtp) {
      return authClient.sendLoginOtp(emailAddr)
    }
    return authClient.sendOtp(emailAddr)
  }, [authClient])

  // ── Step A: Continue ──────────────────────────────────────────────────────────
  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setEmailError('')

    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setEmailError(ar ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.')
      return
    }

    setIsResolvingMethods(true)
    try {
      if (authClient.getLoginMethods) {
        const resp = await authClient.getLoginMethods(trimmed)
        const methods = resp?.methods
        if (Array.isArray(methods) && methods.length > 0) {
          setResolvedMethods(methods)
          setHideSocialButtons(false)
        } else {
          setResolvedMethods([])
          setHideSocialButtons(true)
        }
      } else {
        setResolvedMethods(DEFAULT_LOGIN_METHODS)
      }
    } catch {
      // Fail-open on error
      setResolvedMethods(DEFAULT_LOGIN_METHODS)
    } finally {
      setIsResolvingMethods(false)
    }

    setStep('credentials')
  }

  // ── Step B: Password submit ───────────────────────────────────────────────────
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const result = await authClient.login(email.trim(), password, showRememberMe ? rememberMe : false)
      if (result.challenge === 'otp') {
        setChallengeToken(result.challenge_token)
        setOtpSource('post-password')
        setStep('otp')
        startCountdown(30)
        setOtpValue('')
      } else if (result.challenge === '2fa') {
        on2FA?.(result.challenge_token)
      } else {
        onSuccess?.()
      }
    } catch (err: unknown) {
      const message = (err as { status?: number; message?: string })?.message || ''
      const status = (err as { status?: number })?.status
      if (status === 403) {
        setHideSocialButtons(true)
        setError(ar ? 'طريقة تسجيل الدخول هذه غير مفعّلة لحسابك.' : 'This login method is not enabled for your account.')
      } else if (message.includes('locked') || status === 423) {
        const minutes = message.match(/(\d+)/)?.[1] || '?'
        setError(ar ? `الحساب مقفل. حاول مجدداً بعد ${minutes} دقيقة.` : `Account locked. Try again in ${minutes} minutes.`)
      } else if (status === 0 || message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
        setError(ar ? 'خطأ في الاتصال. يرجى المحاولة مرة أخرى.' : 'Connection error. Please try again.')
      } else {
        setError(ar ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Email or password incorrect.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Step B → C: passwordless paths ───────────────────────────────────────────
  const handleSendEmailCode = async () => {
    setError('')
    setIsSendingOtp(true)
    try {
      await dispatchLoginOtp(email.trim())
      setChallengeToken(undefined)
      setOtpSource('passwordless')
      setStep('otp')
      startCountdown(30)
      setOtpValue('')
    } catch {
      setError(ar ? 'خطأ في الاتصال. يرجى المحاولة مرة أخرى.' : 'Connection error. Please try again.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleSendMagicLink = async () => {
    setError('')
    setIsSendingOtp(true)
    try {
      await dispatchLoginOtp(email.trim())
      setChallengeToken(undefined)
      setOtpSource('passwordless')
      setStep('otp')
      startCountdown(30)
      setOtpValue('')
    } catch {
      setError(ar ? 'خطأ في الاتصال. يرجى المحاولة مرة أخرى.' : 'Connection error. Please try again.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  // ── OTP step ──────────────────────────────────────────────────────────────────
  const handleOtpComplete = useCallback(async (value: string) => {
    if (liveRef.current) {
      liveRef.current.textContent = ar ? 'جارٍ إرسال الرمز...' : 'Submitting code...'
    }
    await handleOtpSubmit(value)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeToken, ar])

  const handleOtpSubmit = async (codeOverride?: string) => {
    const code = codeOverride ?? otpValue
    if (code.length < 6) return
    setError('')
    setIsVerifying(true)
    try {
      const result = await authClient.verifyOtp(email.trim(), code, challengeToken)
      if (result.challenge === '2fa') {
        on2FA?.(result.challenge_token)
      } else {
        onSuccess?.()
      }
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || ''
      setOtpValue('')
      if (message.includes('expired')) {
        setError(ar ? 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.' : 'Code has expired. Request a new one.')
      } else if (message.includes('too_many') || message.includes('attempts')) {
        setError(ar ? 'محاولات كثيرة جداً. يرجى تسجيل الدخول من جديد.' : 'Too many attempts. Please sign in again.')
        setTimeout(() => { setStep('email'); setOtpValue('') }, 2500)
      } else {
        setError(ar ? 'الرمز غير صحيح. يرجى المحاولة مرة أخرى.' : 'Incorrect code. Please try again.')
      }
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendOtp = async () => {
    if (countdown > 0) return
    setError('')
    setIsSendingOtp(true)
    try {
      await authClient.sendOtp(email.trim())
      startCountdown(30)
      setOtpValue('')
    } catch {
      setError(ar ? 'خطأ في الاتصال. يرجى المحاولة مرة أخرى.' : 'Connection error. Please try again.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  // ── Dev login (one-click, dev env only) ──────────────────────────────────────
  // Renders only when authClient.devLogin is defined. The concrete implementation
  // omits it entirely in non-dev environments — this is the UI gate.
  const handleDevLogin = async () => {
    if (!authClient.devLogin) return
    setError('')
    setIsDevLoggingIn(true)
    try {
      await authClient.devLogin()
      onSuccess?.()
    } catch {
      setError(ar ? 'خطأ في تسجيل الدخول كمطوّر. يرجى المحاولة مرة أخرى.' : 'Dev login failed. Please try again.')
    } finally {
      setIsDevLoggingIn(false)
    }
  }

  // ── OAuth helper ──────────────────────────────────────────────────────────────
  const handleOAuth = (provider: string) => {
    if (!authClient.getOAuthUrl) return
    const url = authClient.getOAuthUrl(provider)
    if (!url) return
    if (onOAuthRedirect) {
      onOAuthRedirect(url)
    } else {
      window.location.href = url
    }
  }

  // ── Derived flags ─────────────────────────────────────────────────────────────
  const hasEmailPassword = resolvedMethods.includes('email_password')
  const hasMagicLink     = resolvedMethods.includes('magic_link')
  const hasEmailOtp      = resolvedMethods.includes('otp')
  const hasGoogle        = !hideSocialButtons && resolvedMethods.includes('google_oauth') && !!authClient.getOAuthUrl
  const hasGitHub        = !hideSocialButtons && resolvedMethods.includes('github') && !!authClient.getOAuthUrl
  const hasAzure         = !hideSocialButtons && resolvedMethods.includes('azure') && !!authClient.getOAuthUrl
  const hasSocialButtons = hasGoogle || hasGitHub || hasAzure
  const isBlocked        = resolvedMethods.length === 0

  const resetToEmail = () => {
    setStep('email')
    setError('')
    setPassword('')
    setOtpValue('')
    setHideSocialButtons(false)
  }

  // ══ Step C: OTP ════════════════════════════════════════════════════════════════
  if (step === 'otp') {
    return (
      <div className="flex flex-col gap-6">
        <AuthStepHeader
          icon={<Mail className="h-7 w-7" aria-hidden="true" />}
          title={ar ? 'تحقق من بريدك الإلكتروني' : 'Check your email'}
          subtitle={
            <>
              {ar ? 'أرسلنا رمزاً مكوناً من 6 أرقام إلى ' : 'We sent a 6-digit code to '}
              <span className="font-medium text-foreground" dir="ltr">{email}</span>
            </>
          }
          centered
        />

        <p ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />

        <AuthErrorAlert error={error} />

        <div className="flex flex-col gap-2">
          <Label className="sr-only">{ar ? 'أدخل الرمز' : 'Enter code'}</Label>
          <OTPBoxGroup
            value={otpValue}
            onChange={setOtpValue}
            onComplete={handleOtpComplete}
            disabled={isVerifying}
            ariaLabel={ar ? 'أدخل الرمز' : 'Enter code'}
            autoFocus
          />
          <p className="text-xs text-muted-foreground text-center tabular-nums" aria-live="polite" aria-atomic="true">
            {ar ? 'ينتهي خلال 5:00' : 'Expires in 5:00'}
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={otpValue.length < 6 || isVerifying}
          onClick={() => handleOtpSubmit()}
        >
          {isVerifying ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {ar ? 'جارٍ التحقق...' : 'Verifying...'}
            </span>
          ) : (
            ar ? 'التحقق من الرمز' : 'Verify code'
          )}
        </Button>

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-xs text-muted-foreground">{ar ? 'لم تستلمه؟' : "Didn't receive it?"}</p>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={countdown > 0 || isSendingOtp}
            className="text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {ar ? 'إعادة إرسال الرمز' : 'Resend code'}
          </button>
          {countdown > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite" aria-atomic="true">
              {ar ? `إعادة إرسال بعد ${countdown} ثانية` : `Resend in ${countdown}s`}
            </p>
          )}
        </div>

        {/* Back to methods step — otpSource preserved for future extension */}
        <button
          type="button"
          onClick={() => { setStep('credentials'); setError(''); setOtpValue('') }}
          data-otp-source={otpSource}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-fast ease-standard self-center mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          {ar ? 'العودة' : 'Back'}
        </button>
      </div>
    )
  }

  // ══ Step B: Credentials / methods ══════════════════════════════════════════════
  if (step === 'credentials') {
    return (
      <div className="flex flex-col gap-6">
        <AuthStepHeader
          title={ar ? 'تسجيل الدخول' : 'Sign in'}
          subtitle={
            <>
              {ar ? 'كـ ' : 'as '}
              <span className="font-medium text-foreground" dir="ltr">{email}</span>
            </>
          }
        />

        <AuthErrorAlert error={error} />

        {isBlocked && (
          <p className="text-sm text-muted-foreground text-center py-2">
            {ar
              ? 'لا يمكن تسجيل الدخول بهذا الحساب هنا. تواصل مع المسؤول.'
              : "This account can't sign in here. Contact your administrator."}
          </p>
        )}

        {!isBlocked && hasEmailPassword && (
          <form noValidate onSubmit={handleCredentialsSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password" className="text-sm font-medium text-foreground text-start">
                  {ar ? 'كلمة المرور' : 'Password'}
                </Label>
                {onForgotPassword ? (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-xs text-primary hover:underline text-end self-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                  </button>
                ) : (
                  <a href="#" tabIndex={-1} className="text-xs text-primary hover:underline text-end self-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                    {ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                  </a>
                )}
              </div>
              <PasswordInput
                id="login-password"
                language={language}
                autoComplete="current-password"
                placeholder={ar ? 'أدخل كلمة المرور' : 'Enter your password'}
                value={password}
                onChange={e => setPassword((e as React.ChangeEvent<HTMLInputElement>).target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {showRememberMe && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="login-remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={isSubmitting}
                  aria-label={ar ? 'تذكرني' : 'Remember me'}
                />
                <Label htmlFor="login-remember-me" className="text-sm text-foreground cursor-pointer select-none ms-1">
                  {ar ? 'تذكرني' : 'Remember me'}
                </Label>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {ar ? 'جارٍ تسجيل الدخول...' : 'Signing in...'}
                </span>
              ) : (
                ar ? 'تسجيل الدخول' : 'Sign in'
              )}
            </Button>
          </form>
        )}

        {!isBlocked && hasEmailPassword && (hasMagicLink || hasEmailOtp || hasSocialButtons) && (
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground shrink-0">
              {ar ? 'أو تابع عبر' : 'or continue with'}
            </span>
            <Separator className="flex-1" />
          </div>
        )}

        {!isBlocked && !hasEmailPassword && (hasMagicLink || hasEmailOtp || hasSocialButtons) && (
          <p className="text-xs text-muted-foreground text-center">
            {ar ? 'اختر طريقة تسجيل الدخول' : 'Choose a sign-in method'}
          </p>
        )}

        {!isBlocked && (hasMagicLink || hasEmailOtp || hasSocialButtons) && (
          <div className="flex flex-col gap-2">
            {hasMagicLink && (
              <Button type="button" variant="outline" className="w-full gap-2" onClick={handleSendMagicLink} disabled={isSendingOtp || isSubmitting}>
                {isSendingOtp ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
                {ar ? 'إرسال رابط الدخول' : 'Send magic link'}
              </Button>
            )}

            {hasEmailOtp && (
              <Button type="button" variant="outline" className="w-full gap-2" onClick={handleSendEmailCode} disabled={isSendingOtp || isSubmitting}>
                {isSendingOtp ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
                {ar ? 'أرسل لي رمزاً عبر البريد' : 'Email me a code'}
              </Button>
            )}

            {hasGoogle && (
              <Button type="button" variant="outline" className="w-full gap-2" onClick={() => handleOAuth('google')} disabled={isSubmitting || isSendingOtp}>
                <GoogleIcon />
                {ar ? 'تسجيل الدخول عبر Google' : 'Sign in with Google'}
              </Button>
            )}

            {hasGitHub && (
              <Button type="button" variant="outline" className="w-full gap-2" onClick={() => handleOAuth('github')} disabled={isSubmitting || isSendingOtp}>
                <Github className="h-4 w-4" aria-hidden="true" />
                {ar ? 'تسجيل الدخول عبر GitHub' : 'Sign in with GitHub'}
              </Button>
            )}

            {hasAzure && (
              <Button type="button" variant="outline" className="w-full gap-2" onClick={() => handleOAuth('azure')} disabled={isSubmitting || isSendingOtp}>
                <MicrosoftIcon />
                {ar ? 'تسجيل الدخول عبر Microsoft' : 'Sign in with Microsoft'}
              </Button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={resetToEmail}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-fast ease-standard self-center mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          {ar ? 'استخدام بريد إلكتروني مختلف' : 'Use a different email'}
        </button>
      </div>
    )
  }

  // ══ Step A: Email ══════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col gap-6">
      {/* Dev login — one-click, shown only when authClient.devLogin is defined.
          The concrete implementation omits devLogin() in production, so this
          button is invisible to production users. Rule 14: server hard-gates on
          APP_ENV independently. */}
      {!!authClient.devLogin && (
        <>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-dashed text-muted-foreground hover:text-foreground hover:border-solid"
            onClick={handleDevLogin}
            disabled={isDevLoggingIn}
            aria-label={ar ? 'الدخول كمطوّر' : 'Continue as dev'}
          >
            {isDevLoggingIn ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Terminal className="h-4 w-4" aria-hidden="true" />
            )}
            {ar ? 'الدخول كمطوّر' : 'Continue as dev'}
          </Button>

          <div className="flex items-center gap-3" aria-hidden="true">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground shrink-0">
              {ar ? 'أو سجّل الدخول بالبريد الإلكتروني' : 'or sign in with email'}
            </span>
            <Separator className="flex-1" />
          </div>
        </>
      )}

    <form noValidate onSubmit={handleEmailContinue} className="flex flex-col gap-6">
      <AuthStepHeader
        title={ar ? 'تسجيل الدخول' : 'Sign in'}
        subtitle={ar ? 'أدخل بريدك الإلكتروني للمتابعة' : 'Enter your email to continue'}
      />

      <AuthErrorAlert error={error} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-email" className="text-sm font-medium text-foreground text-start">
          {ar ? 'البريد الإلكتروني' : 'Email address'}
        </Label>
        <Input
          id="login-email"
          type="email"
          /* Email text is LTR (addresses read left-to-right), but in an RTL form
             the field must visually match: right-align the LTR text + placeholder
             so it sits under the right-aligned label, not orphaned on the left. */
          dir="ltr"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setEmailError('') }}
          disabled={isResolvingMethods}
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'login-email-error' : undefined}
          className={`${ar ? 'text-end' : ''} ${emailError ? 'border-destructive ring-destructive/30' : ''}`}
          autoFocus
        />
        {emailError && (
          <p id="login-email-error" role="alert" className="text-xs text-destructive mt-1">
            {emailError}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isResolvingMethods}>
        {isResolvingMethods ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {ar ? 'جارٍ التحقق...' : 'Checking...'}
          </span>
        ) : (
          ar ? 'متابعة' : 'Continue'
        )}
      </Button>

      {/* Provider-level OAuth is available before the email is resolved, so the
          social buttons show on the email step too (magic-link / email-OTP need
          the resolved email, so those stay on the credentials step). */}
      {!hideSocialButtons && !!authClient.getOAuthUrl && (
        <>
          <div className="flex items-center gap-3" aria-hidden="true">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {ar ? 'أو تابع عبر' : 'or continue with'}
            </span>
            <Separator className="flex-1" />
          </div>

          <div className="flex flex-col gap-2.5">
            <Button type="button" variant="outline" className="w-full gap-2" onClick={() => handleOAuth('google')} disabled={isResolvingMethods}>
              <GoogleIcon />
              {ar ? 'تسجيل الدخول عبر Google' : 'Sign in with Google'}
            </Button>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {ar ? 'مستخدم جديد؟ تواصل مع المسؤول.' : 'New here? Contact your administrator.'}
      </p>
    </form>
    </div>
  )
}
LoginForm.displayName = 'LoginForm'

export default LoginForm
