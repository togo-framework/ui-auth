'use client'

// PasswordStrengthMeter — visual password strength bar + rules checklist.
// Shared between ResetForm and any change-password flow.
// Score 0–4 = count of rules passed (length gate is required; others are bonus).
// language prop replaces useLanguage context — callers inject from props.

import { Check, Minus } from 'lucide-react'

export interface PasswordRule {
  id: string
  label_en: string
  label_ar: string
  met: boolean
}

interface PasswordStrengthMeterProps {
  password: string
  language?: 'en' | 'ar'
}

export function computeRules(password: string): PasswordRule[] {
  return [
    {
      id: 'rule-length',
      label_en: 'At least 12 characters',
      label_ar: '12 حرفاً على الأقل',
      met: password.length >= 12,
    },
    {
      id: 'rule-upper',
      label_en: 'Uppercase letter',
      label_ar: 'حرف كبير',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'rule-lower',
      label_en: 'Lowercase letter',
      label_ar: 'حرف صغير',
      met: /[a-z]/.test(password),
    },
    {
      id: 'rule-digit',
      label_en: 'Number',
      label_ar: 'رقم',
      met: /[0-9]/.test(password),
    },
    {
      id: 'rule-symbol',
      label_en: 'Symbol',
      label_ar: 'رمز',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ]
}

export function computeScore(rules: PasswordRule[]): number {
  // Length rule is mandatory; additional rules each add 1 point up to 4.
  const lengthMet = rules.find(r => r.id === 'rule-length')?.met ?? false
  if (!lengthMet) return 0
  const bonusMet = rules.filter(r => r.id !== 'rule-length' && r.met).length
  return Math.min(4, 1 + bonusMet)
}

const SCORE_CONFIG = [
  { width: 'w-0',    color: 'bg-destructive', label_en: 'Too weak',    label_ar: 'ضعيفة جداً' },
  { width: 'w-1/4',  color: 'bg-destructive', label_en: 'Weak',        label_ar: 'ضعيفة' },
  { width: 'w-2/4',  color: 'bg-yellow-500',  label_en: 'Fair',        label_ar: 'مقبولة' },
  { width: 'w-3/4',  color: 'bg-accent',      label_en: 'Strong',      label_ar: 'قوية' },
  { width: 'w-full', color: 'bg-green-500',   label_en: 'Very strong', label_ar: 'قوية جداً' },
]

const PasswordStrengthMeter = ({ password, language = 'en' }: PasswordStrengthMeterProps) => {
  const rules = computeRules(password)
  const score = computeScore(rules)
  const cfg = SCORE_CONFIG[score]
  const strengthLabel = language === 'ar' ? cfg.label_ar : cfg.label_en
  const ariaLabel = language === 'ar' ? 'قوة كلمة المرور' : 'Password strength'

  return (
    <div className="flex flex-col gap-2 mt-1">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ease-in-out ${cfg.width} ${cfg.color}`}
            role="progressbar"
            aria-valuenow={score * 25}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={ariaLabel}
          />
        </div>
        <span className="text-xs text-muted-foreground text-end shrink-0 min-w-[4.5rem]">
          {strengthLabel}
        </span>
      </div>

      {/* Rules checklist */}
      <ul
        className="flex flex-col gap-0.5 mt-1"
        aria-live="polite"
        aria-label={language === 'ar' ? 'متطلبات كلمة المرور' : 'Password requirements'}
      >
        {rules.map(rule => (
          <li
            key={rule.id}
            className={`flex items-center gap-1.5 text-xs ${rule.met ? 'text-green-600' : 'text-muted-foreground'}`}
            aria-checked={rule.met}
          >
            {rule.met ? (
              <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <Minus className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            {language === 'ar' ? rule.label_ar : rule.label_en}
          </li>
        ))}
      </ul>
    </div>
  )
}
PasswordStrengthMeter.displayName = 'PasswordStrengthMeter'

export default PasswordStrengthMeter
