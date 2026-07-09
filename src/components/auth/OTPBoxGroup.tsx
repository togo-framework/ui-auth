'use client'

// OTPBoxGroup — 6-slot OTP input shared across login OTP step and 2FA challenge.
// Auto-submits once all 6 digits are filled (one-shot guard per fill cycle).

import { useEffect, useRef } from 'react'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@togo-framework/ui-core'
import { REGEXP_ONLY_DIGITS } from 'input-otp'

interface OTPBoxGroupProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  ariaLabel?: string
  autoFocus?: boolean
}

const OTPBoxGroup = ({
  value,
  onChange,
  onComplete,
  disabled = false,
  ariaLabel,
  autoFocus = false,
}: OTPBoxGroupProps) => {
  const hasCalledComplete = useRef(false)

  // Auto-submit guard: only fire once per fill cycle.
  useEffect(() => {
    if (value.length === 6 && !hasCalledComplete.current) {
      hasCalledComplete.current = true
      onComplete?.(value)
    }
    if (value.length < 6) {
      hasCalledComplete.current = false
    }
  }, [value, onComplete])

  return (
    <div className="flex justify-center my-2">
      <InputOTP
        maxLength={6}
        value={value}
        onChange={onChange}
        disabled={disabled}
        pattern={REGEXP_ONLY_DIGITS}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        containerClassName="gap-2"
        dir="ltr"
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <InputOTPSlot
              key={i}
              index={i}
              className="h-12 w-12 text-lg font-mono border-border first:rounded-s-md last:rounded-e-md sm:h-12 sm:w-12"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  )
}
OTPBoxGroup.displayName = 'OTPBoxGroup'

export default OTPBoxGroup