'use client'

// AuthStepHeader — icon + title + subtitle used across all auth form steps.
// Adapts to the `centered` flag for OTP / 2FA screens vs form screens.

import * as React from 'react'

interface AuthStepHeaderProps {
  icon?: React.ReactNode
  title: string
  subtitle?: React.ReactNode
  centered?: boolean
}

const AuthStepHeader = ({ icon, title, subtitle, centered = false }: AuthStepHeaderProps) => {
  return (
    <div className={`flex flex-col gap-1 ${centered ? 'items-center text-center' : ''}`}>
      {icon && (
        // Icon alignment must follow the text: centered when `centered`, else
        // aligned to the start (matches the start-aligned title) instead of mx-auto.
        <div
          className={`mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ${
            centered ? 'mx-auto' : 'me-auto'
          }`}
        >
          {icon}
        </div>
      )}
      <h2 className={`text-2xl font-bold text-foreground ${centered ? 'text-center' : 'text-start'}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`text-sm text-muted-foreground ${centered ? 'text-center' : 'text-start'}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
AuthStepHeader.displayName = 'AuthStepHeader'

export default AuthStepHeader
