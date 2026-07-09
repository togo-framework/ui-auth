/**
 * Auth.stories.tsx
 *
 * Full auth flow stories: AuthCard, LoginForm, OTPForm (6-box), ForgotForm,
 * ResetForm, TwoFAForm, and the AuthFlow convenience wrapper.
 *
 * Uses a MOCK authClient whose methods resolve/reject on a configurable timer
 * so the full interactive flow is clickable in isolation — no network required.
 *
 * Theme toggle (dark/light) and Direction toggle (LTR/RTL) in the Storybook
 * toolbar prove the Arabic auth screens.
 */

import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import type { AuthClient, LoginResult, OtpResult, Verify2FAResult } from '../components/auth/index'
import { AuthFlow } from '../components/auth/index'
import AuthCard from '../components/auth/AuthCard'
import LoginForm from '../components/auth/LoginForm'
import ForgotForm from '../components/auth/ForgotForm'
import ResetForm from '../components/auth/ResetForm'
import TwoFAForm from '../components/auth/TwoFAForm'
import OTPBoxGroup from '../components/auth/OTPBoxGroup'
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter'
import AuthErrorAlert from '../components/auth/AuthErrorAlert'

// ─── Mock authClient factory ──────────────────────────────────────────────────
// delay: simulates network latency
// scenario: controls which branch the mock returns
type Scenario =
  | 'success'        // login → success
  | 'otp-then-done'  // login → otp challenge → verify otp → success
  | '2fa-then-done'  // login → 2fa challenge → verify → success
  | 'bad-creds'      // login → error "incorrect"
  | 'locked'         // login → error "locked"
  | 'otp-expired'    // verifyOtp → expired error
  | 'reset-invalid'  // resetPassword → invalid token

// Email-first method sets for targeted stories
type MethodSet = 'password-only' | 'passwordless-only' | 'all-methods' | 'blocked'

function makeMockAuthClient(
  delay = 800,
  scenario: Scenario = 'success',
  methodSet?: MethodSet
): AuthClient {
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

  const methodsForSet = (set?: MethodSet): string[] => {
    if (set === 'password-only') return ['email_password']
    if (set === 'passwordless-only') return ['magic_link', 'otp']
    if (set === 'all-methods') return ['email_password', 'magic_link', 'otp', 'google_oauth', 'github', 'azure']
    if (set === 'blocked') return []
    // default: password + google + magic link
    return ['email_password', 'google_oauth', 'magic_link']
  }

  return {
    async login(_email, _password, rememberMe): Promise<LoginResult> {
      await wait(delay)
      // eslint-disable-next-line no-console
      console.log('[MockAuthClient] login called — rememberMe:', rememberMe)
      if (scenario === 'bad-creds') throw { status: 401, message: 'Invalid credentials.' }
      if (scenario === 'locked') throw { status: 423, message: 'Account locked for 5 minutes.' }
      if (scenario === 'otp-then-done') return { challenge: 'otp', challenge_token: 'mock-otp-token' }
      if (scenario === '2fa-then-done') return { challenge: '2fa', challenge_token: 'mock-2fa-token' }
      return { challenge: 'none' }
    },

    async sendOtp(_email): Promise<void> {
      await wait(delay)
    },

    async sendLoginOtp(_email): Promise<void> {
      await wait(delay)
      // eslint-disable-next-line no-console
      console.log('[MockAuthClient] sendLoginOtp — dispatching passwordless code')
    },

    async verifyOtp(_email, code, _token): Promise<OtpResult> {
      await wait(delay)
      if (scenario === 'otp-expired') throw { message: 'Code expired.' }
      // Accept any 6-digit code in the mock
      if (code.length === 6) return { challenge: 'none' }
      throw { message: 'Incorrect code.' }
    },

    async forgotPassword(_email): Promise<void> {
      await wait(delay)
    },

    async resetPassword(_token, _newPassword): Promise<void> {
      await wait(delay)
      if (scenario === 'reset-invalid') throw { status: 401, message: 'invalid token' }
    },

    async verify2FA(code, _token): Promise<Verify2FAResult> {
      await wait(delay)
      if (code.length === 6) return { challenge: 'none' }
      throw { message: 'Code incorrect.' }
    },

    getOAuthUrl(provider) {
      return `https://auth.example.com/oauth/${provider}?redirect=mock`
    },

    async getLoginMethods(_email) {
      await wait(200)
      return { methods: methodsForSet(methodSet) }
    },
  }
}

// ─── Story meta shared across all auth stories ────────────────────────────────
// Individual stories use a render function so they can hold their own state.

const defaultAuthClient = makeMockAuthClient(700, 'success', 'all-methods')

// ── AuthFlow — full flow wrapper ──────────────────────────────────────────────

const AuthFlowMeta: Meta<typeof AuthFlow> = {
  title: "Pages/Auth Flow",
  component: AuthFlow,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    fullBleed: true,
    docs: {
      story: { inline: false, height: "640px" },
      description: {
        component:
          'Convenience wrapper that orchestrates login → OTP → 2FA → forgot → reset in one component. ' +
          'Pass `authClient` backed by Fort\'s /v1/auth/* endpoints. ' +
          'Use the Toolbar direction toggle to verify Arabic RTL screens.',
      },
    },
  },
}
export default AuthFlowMeta
type AuthFlowStory = StoryObj<typeof AuthFlow>

// ── Full flow: success path ───────────────────────────────────────────────────
export const FullFlowSuccess: AuthFlowStory = {
  name: 'Full Flow — success',
  render: (args) => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en')
    const [done, setDone] = useState(false)
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-lg font-semibold">Authenticated — onSuccess fired.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(700, 'success')}
        language={language}
        onLanguageToggle={() => setLanguage(l => (l === 'en' ? 'ar' : 'en'))}
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── Full flow: post-login "Signing you in…" redirect state ────────────────────
// After a successful login AuthFlow swaps the form for a persistent bilingual
// "Signing you in…" spinner panel that stays up until the caller's navigation
// unloads the page — so slow destination loads (dev compiles) never look stuck.
// In Storybook nothing navigates, so completing the login leaves the panel
// visible permanently: that frozen state is exactly what this story demos.
export const SigningInRedirect: AuthFlowStory = {
  name: 'Full Flow — signing-in redirect state',
  render: (args) => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en')
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(700, 'success')}
        language={language}
        onLanguageToggle={() => setLanguage(l => (l === 'en' ? 'ar' : 'en'))}
        // Intentionally no redirect: the built-in redirecting panel persists.
        onSuccess={() => {}}
      />
    )
  },
}

// ── Full flow: Remember me checkbox visible (default) ─────────────────────────
export const RememberMeVisible: AuthFlowStory = {
  name: 'Remember Me — checkbox visible (showRememberMe=true)',
  render: (args) => {
    const [done, setDone] = useState(false)
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-lg font-semibold">Authenticated — check console for rememberMe value.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(700, 'success')}
        language="en"
        showRememberMe={true}
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── Full flow: Remember me checkbox hidden (server disabled) ──────────────────
export const RememberMeHidden: AuthFlowStory = {
  name: 'Remember Me — checkbox hidden (showRememberMe=false)',
  render: (args) => {
    const [done, setDone] = useState(false)
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-lg font-semibold">Authenticated — rememberMe always false.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(700, 'success')}
        language="en"
        showRememberMe={false}
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── Full flow: OTP challenge ──────────────────────────────────────────────────
export const FullFlowOTP: AuthFlowStory = {
  name: 'Full Flow — OTP challenge (enter any 6 digits)',
  render: (args) => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en')
    const [done, setDone] = useState(false)
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-lg font-semibold">Authenticated via OTP.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(700, 'otp-then-done')}
        language={language}
        onLanguageToggle={() => setLanguage(l => (l === 'en' ? 'ar' : 'en'))}
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── Full flow: 2FA challenge ──────────────────────────────────────────────────
export const FullFlow2FA: AuthFlowStory = {
  name: 'Full Flow — 2FA challenge (enter any 6 digits)',
  render: (args) => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en')
    const [done, setDone] = useState(false)
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-lg font-semibold">Authenticated via 2FA.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(700, '2fa-then-done')}
        language={language}
        onLanguageToggle={() => setLanguage(l => (l === 'en' ? 'ar' : 'en'))}
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── Arabic RTL ────────────────────────────────────────────────────────────────
export const ArabicRTL: AuthFlowStory = {
  name: 'Arabic RTL (language="ar")',
  render: (args) => {
    const [done, setDone] = useState(false)
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground" dir="rtl">
          <p className="text-lg font-semibold">تم تسجيل الدخول بنجاح.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(700, 'success')}
        language="ar"
        onLanguageToggle={undefined}
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── Bad credentials error ─────────────────────────────────────────────────────
export const BadCredentials: AuthFlowStory = {
  name: 'Error — bad credentials',
  render: (args) => (
    <AuthFlow
      {...args}
      authClient={makeMockAuthClient(700, 'bad-creds')}
      language="en"
    />
  ),
}

// ── Locked account ────────────────────────────────────────────────────────────
export const LockedAccount: AuthFlowStory = {
  name: 'Error — locked account',
  render: (args) => (
    <AuthFlow
      {...args}
      authClient={makeMockAuthClient(700, 'locked')}
      language="en"
    />
  ),
}

// ── Reset password flow ───────────────────────────────────────────────────────
export const ResetPasswordFlow: AuthFlowStory = {
  name: 'Reset Password Flow (token from URL)',
  render: (args) => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en')
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(700, 'success')}
        resetToken="mock-reset-token-abc123"
        language={language}
        onLanguageToggle={() => setLanguage(l => (l === 'en' ? 'ar' : 'en'))}
      />
    )
  },
}

// ── Invalid reset token ───────────────────────────────────────────────────────
export const ResetPasswordInvalidToken: AuthFlowStory = {
  name: 'Reset Password — invalid/expired token',
  render: (args) => (
    <AuthFlow
      {...args}
      authClient={makeMockAuthClient(700, 'reset-invalid')}
      resetToken="expired-token"
      language="en"
    />
  ),
}

// ── Custom brand (Fort) ───────────────────────────────────────────────────────
export const CustomBrand: AuthFlowStory = {
  name: 'Custom Brand (Fort)',
  render: (args) => (
    <AuthFlow
      {...args}
      authClient={makeMockAuthClient(700, 'success')}
      language="en"
      brand={{
        initial: 'F',
        name: 'Fort Security Platform',
        tagline: { en: 'Zero-Trust Access Management', ar: 'إدارة الوصول بثقة صفرية' },
        bullets: [
          { en: 'Identity-first security', ar: 'أمن قائم على الهوية' },
          { en: 'Continuous verification', ar: 'التحقق المستمر' },
        ],
        secureNote: { en: 'Encrypted & Audited', ar: 'مشفّر ومدقّق' },
      }}
    />
  ),
}

// ── Email-first: password only ────────────────────────────────────────────────
// getLoginMethods returns ['email_password'] → password field reveals, no alt buttons.
export const EmailFirstPasswordOnly: AuthFlowStory = {
  name: 'Email-First — password only (email_password)',
  render: (args) => {
    const [done, setDone] = useState(false)
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-lg font-semibold">Authenticated.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(400, 'success', 'password-only')}
        language="en"
        showRememberMe={true}
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── Email-first: passwordless only ───────────────────────────────────────────
// getLoginMethods returns ['magic_link', 'otp'] → no password field; only magic-link
// and "Email me a code" buttons. Clicking either → OTP step.
export const EmailFirstPasswordlessOnly: AuthFlowStory = {
  name: 'Email-First — passwordless only (magic_link + otp)',
  render: (args) => {
    const [done, setDone] = useState(false)
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-lg font-semibold">Authenticated via email code.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(400, 'success', 'passwordless-only')}
        language="en"
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── Email-first: all methods ──────────────────────────────────────────────────
// getLoginMethods returns all six: email_password, magic_link, otp,
// google_oauth, github, azure.  Full methods grid visible on Step B.
export const EmailFirstAllMethods: AuthFlowStory = {
  name: 'Email-First — all methods (password + passwordless + social)',
  render: (args) => {
    const [done, setDone] = useState(false)
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-lg font-semibold">Authenticated.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(400, 'success', 'all-methods')}
        language="en"
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── Email-first: blocked account ──────────────────────────────────────────────
// getLoginMethods returns [] → "can't sign in here" hint shown, no method buttons.
export const EmailFirstBlocked: AuthFlowStory = {
  name: 'Email-First — blocked account (no methods)',
  render: (args) => (
    <AuthFlow
      {...args}
      authClient={makeMockAuthClient(400, 'success', 'blocked')}
      language="en"
    />
  ),
}

// ── Email-first: Arabic RTL, all methods ─────────────────────────────────────
export const EmailFirstArabicAllMethods: AuthFlowStory = {
  name: 'Email-First — Arabic RTL, all methods',
  render: (args) => {
    const [done, setDone] = useState(false)
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground" dir="rtl">
          <p className="text-lg font-semibold">تم تسجيل الدخول بنجاح.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={makeMockAuthClient(400, 'success', 'all-methods')}
        language="ar"
        onLanguageToggle={undefined}
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── AuthCard shell only ───────────────────────────────────────────────────────
export const AuthCardShell: AuthFlowStory = {
  name: 'AuthCard — brand panel shell',
  render: () => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en')
    return (
      <AuthCard
        language={language}
        onLanguageToggle={() => setLanguage(l => (l === 'en' ? 'ar' : 'en'))}
      >
        <div className="flex flex-col gap-4 p-2">
          <p className="text-sm text-muted-foreground text-center">
            Slot for any auth form content.
          </p>
          <div className="h-32 rounded-lg border border-dashed border-muted flex items-center justify-center text-muted-foreground text-xs">
            children go here
          </div>
        </div>
      </AuthCard>
    )
  },
}

// ── OTPBoxGroup standalone ────────────────────────────────────────────────────
export const OTPBoxGroupStory: AuthFlowStory = {
  name: 'OTPBoxGroup — 6-box standalone',
  render: () => {
    const [value, setValue] = useState('')
    const [submitted, setSubmitted] = useState('')
    return (
      <div className="flex flex-col items-center gap-6 p-8 bg-background min-h-screen">
        <p className="text-sm text-muted-foreground">
          Type 6 digits — auto-submits on completion.
        </p>
        <OTPBoxGroup
          value={value}
          onChange={(v) => { setValue(v); setSubmitted('') }}
          onComplete={v => setSubmitted(v)}
          ariaLabel="Enter 6-digit OTP"
        />
        {submitted && (
          <p className="text-sm font-mono text-primary">Submitted: {submitted}</p>
        )}
      </div>
    )
  },
}

// ── PasswordStrengthMeter standalone ─────────────────────────────────────────
export const PasswordStrengthMeterStory: AuthFlowStory = {
  name: 'PasswordStrengthMeter — standalone',
  render: () => {
    const [password, setPassword] = useState('')
    const [language, setLanguage] = useState<'en' | 'ar'>('en')
    return (
      <div className="flex flex-col gap-4 p-8 max-w-xs bg-background min-h-screen">
        <button
          type="button"
          onClick={() => setLanguage(l => (l === 'en' ? 'ar' : 'en'))}
          className="text-xs text-primary self-end"
        >
          {language === 'en' ? 'Switch to AR' : 'Switch to EN'}
        </button>
        <input
          type="password"
          placeholder="Type a password..."
          value={password}
          onChange={e => setPassword(e.target.value)}
          dir="ltr"
          className="border rounded px-3 py-2 text-sm bg-background text-foreground"
        />
        {password && <PasswordStrengthMeter password={password} language={language} />}
      </div>
    )
  },
}

// ── AuthErrorAlert standalone ─────────────────────────────────────────────────
export const AuthErrorAlertStory: AuthFlowStory = {
  name: 'AuthErrorAlert — standalone',
  render: () => (
    <div className="flex flex-col gap-4 p-8 max-w-xs bg-background">
      <AuthErrorAlert error="Email or password incorrect." />
      <AuthErrorAlert error="Account locked. Try again in 5 minutes." />
      <AuthErrorAlert error="Connection error. Please try again." />
      <AuthErrorAlert error={null} />
    </div>
  ),
}

// ── Without card (for modal use) ──────────────────────────────────────────────
export const AuthFlowWithoutCard: AuthFlowStory = {
  name: 'AuthFlow — withCard=false (modal/embedded)',
  parameters: { layout: 'centered' },
  render: (args) => {
    const [done, setDone] = useState(false)
    return (
      <div className="w-80 p-6 bg-background rounded-xl border shadow-md">
        {done ? (
          <p className="text-sm text-center text-muted-foreground">Signed in.</p>
        ) : (
          <AuthFlow
            {...args}
            authClient={makeMockAuthClient(700, 'success')}
            language="en"
            withCard={false}
            onSuccess={() => setDone(true)}
          />
        )}
      </div>
    )
  },
}

// ── Email-first progressive flow (EN) ────────────────────────────────────────
// Mock returns both methods so the story demonstrates the password reveal
// AND the "sign in with a magic link instead" secondary toggle.
export const EmailFirstEN: AuthFlowStory = {
  name: 'Email-First — progressive flow (EN, both methods)',
  render: (args) => {
    const [done, setDone] = useState(false)
    const mockClient: AuthClient = {
      ...makeMockAuthClient(600, 'success'),
      async getLoginMethods(_email) {
        await new Promise(r => setTimeout(r, 500))
        return { methods: ['email_password', 'magic_link'] }
      },
    }
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-lg font-semibold">Authenticated.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={mockClient}
        language="en"
        emailFirst
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── Email-first progressive flow (AR / RTL) ───────────────────────────────────
export const EmailFirstAR: AuthFlowStory = {
  name: 'Email-First — progressive flow (AR / RTL, both methods)',
  render: (args) => {
    const [done, setDone] = useState(false)
    const mockClient: AuthClient = {
      ...makeMockAuthClient(600, 'success'),
      async getLoginMethods(_email) {
        await new Promise(r => setTimeout(r, 500))
        return { methods: ['email_password', 'magic_link'] }
      },
    }
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground" dir="rtl">
          <p className="text-lg font-semibold">تم تسجيل الدخول بنجاح.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={mockClient}
        language="ar"
        emailFirst
        onLanguageToggle={undefined}
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── Email-first — magic-link only ─────────────────────────────────────────────
export const EmailFirstMagicLinkOnly: AuthFlowStory = {
  name: 'Email-First — magic-link only (no password)',
  render: (args) => {
    const [done, setDone] = useState(false)
    const mockClient: AuthClient = {
      ...makeMockAuthClient(600, 'otp-then-done'),
      async getLoginMethods(_email) {
        await new Promise(r => setTimeout(r, 500))
        return { methods: ['magic_link'] }
      },
    }
    if (done) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-lg font-semibold">Magic link sent.</p>
        </div>
      )
    }
    return (
      <AuthFlow
        {...args}
        authClient={mockClient}
        language="en"
        emailFirst
        onSuccess={() => setDone(true)}
      />
    )
  },
}

// ── LoginForm standalone (no card) ───────────────────────────────────────────
export const LoginFormStandalone: AuthFlowStory = {
  name: 'LoginForm — standalone form',
  parameters: { layout: 'centered' },
  render: () => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en')
    return (
      <div className="w-80 p-6 bg-background rounded-xl border shadow-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <button
          type="button"
          onClick={() => setLanguage(l => (l === 'en' ? 'ar' : 'en'))}
          className="text-xs text-primary mb-4 block"
        >
          {language === 'en' ? 'ع' : 'EN'}
        </button>
        <LoginForm
          authClient={defaultAuthClient}
          language={language}
          showRememberMe={true}
          onSuccess={() => alert('onSuccess fired')}
          on2FA={(token) => alert(`on2FA fired — token: ${token}`)}
          onForgotPassword={() => alert('onForgotPassword fired')}
        />
      </div>
    )
  },
}

// ── ForgotForm standalone ─────────────────────────────────────────────────────
export const ForgotFormStandalone: AuthFlowStory = {
  name: 'ForgotForm — standalone form',
  parameters: { layout: 'centered' },
  render: () => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en')
    return (
      <div className="w-80 p-6 bg-background rounded-xl border shadow-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <button
          type="button"
          onClick={() => setLanguage(l => (l === 'en' ? 'ar' : 'en'))}
          className="text-xs text-primary mb-4 block"
        >
          {language === 'en' ? 'ع' : 'EN'}
        </button>
        <ForgotForm
          authClient={defaultAuthClient}
          language={language}
          onBack={() => alert('onBack fired')}
        />
      </div>
    )
  },
}

// ── ResetForm standalone ──────────────────────────────────────────────────────
export const ResetFormStandalone: AuthFlowStory = {
  name: 'ResetForm — standalone form',
  parameters: { layout: 'centered' },
  render: () => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en')
    return (
      <div className="w-80 p-6 bg-background rounded-xl border shadow-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <button
          type="button"
          onClick={() => setLanguage(l => (l === 'en' ? 'ar' : 'en'))}
          className="text-xs text-primary mb-4 block"
        >
          {language === 'en' ? 'ع' : 'EN'}
        </button>
        <ResetForm
          token="mock-reset-token"
          authClient={makeMockAuthClient(700, 'success')}
          language={language}
          onSuccess={() => alert('Password reset — onSuccess fired')}
          onRequestNewLink={() => alert('onRequestNewLink fired')}
        />
      </div>
    )
  },
}

// ── TwoFAForm standalone ──────────────────────────────────────────────────────
export const TwoFAFormStandalone: AuthFlowStory = {
  name: 'TwoFAForm — standalone 2FA form',
  parameters: { layout: 'centered' },
  render: () => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en')
    return (
      <div className="w-80 p-6 bg-background rounded-xl border shadow-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <button
          type="button"
          onClick={() => setLanguage(l => (l === 'en' ? 'ar' : 'en'))}
          className="text-xs text-primary mb-4 block"
        >
          {language === 'en' ? 'ع' : 'EN'}
        </button>
        <TwoFAForm
          authClient={defaultAuthClient}
          challengeToken="mock-challenge-token"
          language={language}
          onSuccess={() => alert('2FA verified — onSuccess fired')}
          onTooManyAttempts={() => alert('Too many attempts — navigate to login')}
        />
      </div>
    )
  },
}
