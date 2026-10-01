<!-- togo-header -->
# @togo-framework/ui-auth

> [!WARNING]
> **Deprecated.** This package is no longer maintained. togo now uses
> [Nasaq](https://nasaq.fadymondy.com) (`@fadymondy/nasaq`) as its default UI kit:
> new apps from `create-togo-app` and the official plugins are built on it.
> Install it with `npm i @fadymondy/nasaq` and import from `@fadymondy/nasaq/web`.

Auth flow components from the togo UI kit — `AuthCard`, `LoginForm`,
`ForgotForm`, `ResetForm`, `TwoFAForm`, `LockScreen`, `PasswordLockScreen`,
`PasswordInput`, `AuthClient` types. Depends on `@togo-framework/ui-core`.

```bash
npm install @togo-framework/ui-core @togo-framework/ui-auth
```

```tsx
import { AuthCard, LoginForm } from "@togo-framework/ui-auth";
```

Split out of the former monolithic `@togo-framework/ui` package.
<!-- togo-sponsors -->
