// Auth components barrel export.
// Fort's web imports from '@prism/ui' (via the root index.ts re-export).

// ── Transport seam (implement this to wire Fort's API) ────────────────────────
export type {
  AuthClient,
  LoginResult,
  OtpResult,
  Verify2FAResult,
} from './AuthClient'

// ── Convenience flow wrapper ───────────────────────────────────────────────────
export { default as AuthFlow } from './AuthFlow'

// ── Brand customisation + layout types (used by AuthCard + AuthFlow) ──────────
export type { AuthCardBrand, AuthLayout } from './AuthCard'

// ── Individual form components ────────────────────────────────────────────────
export { default as AuthCard } from './AuthCard'
export { default as LoginForm } from './LoginForm'
export { default as ForgotForm } from './ForgotForm'
export { default as ResetForm } from './ResetForm'
export { default as TwoFAForm } from './TwoFAForm'

// ── Shared sub-components (reusable in Fort's own screens) ────────────────────
export { default as AuthErrorAlert } from './AuthErrorAlert'
export { default as AuthStepHeader } from './AuthStepHeader'
export { default as OTPBoxGroup } from './OTPBoxGroup'
export { default as PasswordInput } from './PasswordInput'
export { default as PasswordStrengthMeter } from './PasswordStrengthMeter'
export { computeRules, computeScore } from './PasswordStrengthMeter'
export type { PasswordRule } from './PasswordStrengthMeter'

// ── Lock screen ───────────────────────────────────────────────────────────────
export { default as LockScreen } from './LockScreen'
export type { LockScreenProps, LockScreenUser } from './LockScreen'

// Password-based lock screen (requires POST /v1/auth/unlock; supports TOTP).
export { default as PasswordLockScreen } from './PasswordLockScreen'
export type { PasswordLockScreenProps, PasswordLockScreenUser, UnlockCredentials } from './PasswordLockScreen'
