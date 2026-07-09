'use client'

// PasswordInput — password field with show/hide toggle.
// Forwarded ref so react-hook-form can register it directly.
// language prop replaces useLanguage context — callers inject from props.

import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@togo-framework/ui-core'
import { cn } from '@togo-framework/ui-core'

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  language?: 'en' | 'ar'
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, language = 'en', dir, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)

    const ariaLabelShow = language === 'ar' ? 'إظهار كلمة المرور' : 'Show password'
    const ariaLabelHide = language === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password'

    const handleToggle = () => setShowPassword(prev => !prev)

    return (
      <div className="relative">
        {/* No hardcoded dir — the password field follows the form direction so
            its text + placeholder + the trailing eye button all align in RTL.
            The eye button uses `end-3` + the input `pe-10` (logical), so it sits
            on the correct side in both LTR and RTL. A caller may still force a
            dir via the `dir` prop. */}
        <Input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          dir={dir}
          className={cn('pe-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={handleToggle}
          aria-label={showPassword ? ariaLabelHide : ariaLabelShow}
          aria-controls={props.id}
          aria-pressed={showPassword}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          tabIndex={0}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = 'PasswordInput'

export default PasswordInput