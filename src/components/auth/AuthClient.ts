/**
 * AuthClient — the transport seam that all auth form components call.
 *
 * Fort's web layer passes a concrete implementation backed by Fort's
 * /v1/auth/* API endpoints + the Fort SDK.  The forms themselves own NO
 * transport logic — they only call methods on this interface.
 *
 * Design constraints:
 * - Every method returns a plain discriminated result so forms can branch on
 *   `challenge` without importing any SDK types.
 * - All methods throw on network / server errors (forms catch and surface the
 *   message via AuthErrorAlert).
 * - The interface is intentionally narrow — only what the auth flow screens need.
 *
 * ─── Integration contract for Fort's web (F1) ────────────────────────────────
 *
 *   import type { AuthClient } from '@prism/ui'
 *   import { fortAuthClient } from './fort-auth-client'  // Fort's concrete impl
 *
 *   <AuthFlow authClient={fortAuthClient} onSuccess={() => router.push('/dashboard')} />
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type LoginResult =
  | { challenge: 'otp';  challenge_token?: string }
  | { challenge: '2fa';  challenge_token?: string }
  | { challenge: 'none' }

export type OtpResult =
  | { challenge: '2fa'; challenge_token?: string }
  | { challenge: 'none' }

export type Verify2FAResult =
  | { challenge: 'none' }

export interface AuthClient {
  /**
   * Sign in with email + password.
   *
   * Returns the next challenge the server requires:
   *   - `otp`  — email OTP sent; call `verifyOtp` next.
   *   - `2fa`  — TOTP required; call `verify2FA` next with the challenge_token.
   *   - `none` — session established; call `onSuccess`.
   *
   * Throws on bad credentials, locked account, or network error.
   * The error object may carry a `status` number (HTTP status) and a `message`.
   *
   * @param rememberMe - When `true`, the server should issue a long-lived
   *   persistent session cookie whose lifetime is determined by the server's
   *   `session.remember_me_duration` setting.  When `false` or omitted, the
   *   server issues a session-scoped cookie that expires on browser close.
   *   This parameter is optional so existing concrete implementations that
   *   ignore it continue to satisfy the interface without modification.
   */
  login(email: string, password: string, rememberMe?: boolean): Promise<LoginResult>

  /**
   * Send (or resend) a one-time password to the given email.
   * Used for both magic-link flows and the OTP step after credentials.
   * Throws on network error.
   */
  sendOtp(email: string): Promise<void>

  /**
   * Verify a 6-digit OTP code.
   *
   * `challenge_token` is the opaque token returned by `login()` — pass it
   * back verbatim so the server can correlate the session.
   *
   * Returns the next challenge:
   *   - `2fa`  — TOTP still required.
   *   - `none` — session established; call `onSuccess`.
   *
   * Throws on bad/expired code or too many attempts.
   */
  verifyOtp(email: string, code: string, challengeToken?: string): Promise<OtpResult>

  /**
   * Request a password-reset email.
   * The server always responds the same way regardless of whether the account
   * exists (no enumeration).  Throws only on network errors.
   */
  forgotPassword(email: string): Promise<void>

  /**
   * Set a new password using the reset token extracted from the magic link URL.
   * Throws with status 401/400 when the token is invalid or expired.
   */
  resetPassword(token: string, newPassword: string): Promise<void>

  /**
   * Verify a TOTP or recovery code for the 2FA challenge step.
   * The challenge_token should be stored in memory (e.g. component state) after
   * login returns `challenge: '2fa'`.
   *
   * Throws on bad code, already-used recovery code, or too many attempts.
   */
  verify2FA(code: string, challengeToken?: string): Promise<Verify2FAResult>

  /**
   * (Optional) Return the OAuth redirect URL for the given provider.
   * Used by the "Sign in with Google" button.  Return `undefined` / `null` to
   * hide the button.
   */
  getOAuthUrl?(provider: 'google' | string): string | null | undefined

  /**
   * (Optional) Look up which login methods are allowed for a given email.
   *
   * The email-first flow calls this after the user clicks "Continue" on Step A.
   * The returned `methods` array drives which credential options are rendered:
   *
   *   'email_password' — reveal the password field + Sign in button
   *   'magic_link'     — show "Send magic link" button (calls sendOtp / sendLoginOtp)
   *   'otp'            — show "Email me a code" button (calls sendLoginOtp / sendOtp)
   *   'google_oauth'   — show Google sign-in button
   *   'github'         — show GitHub sign-in button
   *   'azure'          — show Microsoft/Azure sign-in button
   *
   * Fail-open: if this method is undefined OR throws, the form falls back to
   * showing the password field (email_password) so login always works.
   *
   * Return `undefined` to skip role-gating (all methods shown by default).
   */
  getLoginMethods?(email: string): Promise<{ methods: string[] } | undefined>

  /**
   * (Optional) Send a passwordless login OTP / magic-link code to the given email.
   *
   * Used by the email-first flow when the user selects "Email me a code" (otp
   * method) or "Send magic link" (magic_link method) on the methods step.
   *
   * When absent, the form falls back to `sendOtp(email)` which already exists
   * on all concrete implementations, so back-compat is preserved — callers that
   * have not yet added this method continue to satisfy the interface.
   *
   * The distinction from `sendOtp` is semantic: `sendLoginOtp` is the initial
   * unauthenticated OTP dispatch triggered by the user choosing a passwordless
   * path; `sendOtp` is the resend call on the OTP verification screen.
   * Implementations may delegate one to the other.
   */
  sendLoginOtp?(email: string): Promise<void>

  /**
   * (Optional) One-click developer login.
   *
   * Present only when APP_ENV=development AND the platform has providers.dev=true.
   * The server mints a session for admin@sentra.local without requiring credentials.
   *
   * When this method is defined on the client, LoginForm renders a prominent
   * "Continue as dev" button ABOVE the email form with a divider. It is rendered
   * ONLY when this method is present — concrete implementations in non-dev
   * environments must omit it entirely.
   *
   * Throws on server error (server always 404s in production — rule 14 hard gate).
   */
  devLogin?(): Promise<void>
}
