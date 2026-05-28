# Threat Model

## Project Overview

Marwo is a public, browser-based SaaS CRM for small businesses. The main production application is a React + Vite frontend in `artifacts/crm/src/` that authenticates users with Firebase Auth and reads/writes business data directly from the browser to Firestore via the Firebase Web SDK. The deployment is public, so all public routes and any publicly exposed Firestore permissions must be treated as internet-reachable.

## Assets

- **Tenant business data** — companies, customers, invoices, quotations, tasks, technicians, work orders, contracts, finance records, and settings. Exposure or tampering affects both privacy and business integrity.
- **User identities and roles** — Firebase-authenticated users plus Firestore user profiles that carry `companyId`, role, and onboarding state. Compromise allows impersonation or privilege escalation.
- **Billing and payment state** — invoice payment status, invoice portal links, payment records, and any subscription/billing metadata. Tampering can falsify debt, revenue, or entitlement state.
- **Administrative configuration** — global promo/admin config and any super-admin-only views. Compromise affects the whole product, not just one tenant.

## Trust Boundaries

- **Browser ↔ Firestore** — the browser is untrusted, so Firestore Security Rules are the real enforcement boundary for tenant isolation, authorization, and portal access. Client-side filters and UI role checks are not security controls.
- **Authenticated user ↔ other authenticated users** — Marwo is multi-tenant and role-based. One signed-in user must not gain access to another company's data or owner/admin-only capabilities.
- **Public visitor ↔ invoice portal** — `/portal/:invoiceId` is intentionally public. Any public reads or writes allowed for invoice documents must be narrowly scoped and validated against explicit portal requirements.
- **Frontend ↔ auxiliary payment/subscription endpoints** — any `/api` or server-side payment endpoint must treat all request parameters as attacker-controlled and must not trust client-provided identifiers, URLs, or amounts without verification.
- **Production ↔ dev-only artifacts** — `artifacts/mockup-sandbox/` is treated as dev-only and should usually be ignored unless production reachability is demonstrated.

## Scan Anchors

- **Primary production entry point:** `artifacts/crm/src/main.tsx` → `artifacts/crm/src/App.tsx`
- **Primary enforcement surface:** `firestore.rules`
- **Highest-risk code areas:** `artifacts/crm/src/lib/firestore.ts`, `artifacts/crm/src/contexts/AuthContext.tsx`, `artifacts/crm/src/hooks/usePermissions.ts`, `artifacts/crm/src/pages/portal.tsx`, `artifacts/crm/src/pages/admin.tsx`
- **Public surfaces:** `/pricing`, `/terms`, `/privacy`, `/refund`, `/portal/:invoiceId`, plus any root-level `api/` routes if deployed
- **Authenticated surfaces:** all CRM routes behind `ProtectedRoute`
- **Admin surface:** `/admin` in the frontend, but admin-only behavior must still be enforced outside the UI
- **Usually ignore:** `artifacts/mockup-sandbox/` unless production reachability is shown

## Threat Categories

### Spoofing

Marwo relies on Firebase Auth for identity, but the application also trusts Firestore user documents for `companyId` and role information. The system must ensure that only the authenticated principal can act as that user and that public portal users cannot impersonate internal staff or gain write access to internal records.

Required guarantees:
- Firestore rules MUST bind protected reads and writes to `request.auth.uid` and the caller's company membership.
- Public invoice portal operations MUST not rely solely on document IDs as bearer secrets for sensitive write actions.

### Tampering

Because business records are written directly from the browser, any rule mistake turns client input into authoritative state. Invoice status, amount paid, settings, role permissions, and tenant data must not be mutable by users outside the owning company or outside the intended role.

Required guarantees:
- Every business collection MUST enforce company scoping in Firestore rules.
- Sensitive fields such as invoice payment state, admin config, settings, and role permissions MUST have explicit authorization and value-validation rules.
- Client-side role checks and UI hiding MUST never be the only protection for privileged actions.

### Information Disclosure

The dataset includes customer contact details, invoice history, finance data, and user profiles. Any overly broad Firestore read access would expose tenant data directly to any signed-in user, and any public invoice access must be limited to the minimum fields and records needed for the portal.

Required guarantees:
- Signed-in users MUST only read documents belonging to their own company.
- User profile and admin/config data MUST not be readable across tenants.
- Public invoice access MUST be limited to the intended invoice record and must not expose broader tenant data.

### Denial of Service

Public routes and Firestore-backed writes can be abused for spam or repeated state changes if they are anonymously writable. The invoice portal and feedback collection are the most likely public abuse points.

Required guarantees:
- Any public write path MUST be tightly scoped, validated, and resilient to abuse.
- Public endpoints and server-side payment helpers MUST avoid attacker-controlled operations that can create unbounded cost or state churn.

### Elevation of Privilege

The application has owner/admin/manager/technician/viewer concepts, but permissions are primarily modeled in frontend code and settings documents. A low-privilege user must not be able to bypass UI checks through direct Firestore access, stored script injection, or direct object access by document ID.

Required guarantees:
- Role-based permissions MUST be enforced in Firestore rules or trusted server-side code, not only in React components.
- Direct `getDoc`/`updateDoc` access by document ID MUST still be constrained by rules tied to company ownership and role.
- Untrusted data rendered into HTML/DOM sinks MUST be escaped or sanitized before display.
