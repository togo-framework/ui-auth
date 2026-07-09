'use client'

// AuthErrorAlert — role="alert" error banner shared across all auth screens.
// Renders nothing when error is falsy — conditionally mount at call site.

interface AuthErrorAlertProps {
  error: string | null | undefined
}

const AuthErrorAlert = ({ error }: AuthErrorAlertProps) => {
  if (!error) return null
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive text-start"
    >
      {error}
    </div>
  )
}
AuthErrorAlert.displayName = 'AuthErrorAlert'

export default AuthErrorAlert
