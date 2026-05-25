# ClearCRM

A modern SaaS CRM for small businesses to manage customers, invoices, and company settings — built with React, Firebase Auth, and Firestore.

## Run & Operate

- `pnpm --filter @workspace/crm run dev` — run the CRM frontend (reads PORT from env)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000, health check only)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter
- Auth & DB: Firebase Auth + Firestore (all data ops happen client-side via Firebase SDK)
- PDF: jsPDF + jsPDF-AutoTable (invoice PDF export)
- API: Express 5 (health check only — no backend data layer needed)
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `artifacts/crm/src/` — React frontend (main app)
- `artifacts/crm/src/lib/firebase.ts` — Firebase app init (auth + db exports)
- `artifacts/crm/src/contexts/AuthContext.tsx` — Auth provider, user state
- `artifacts/crm/src/pages/` — All pages (login, signup, dashboard, customers, invoices, settings)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (dashboard/customers/invoices/settings endpoints)
- `artifacts/api-server/src/routes/` — Express route handlers

## Architecture decisions

- **Firebase-first data layer**: All data (customers, invoices, settings) lives in Firestore and is accessed directly from the React frontend using the Firebase SDK. No backend proxy for data.
- **Multi-tenant by companyId**: Every Firestore document has a `companyId` field. All queries filter by the authenticated user's companyId, stored in `users/{uid}`.
- **Settings-driven invoice logic**: Tax and discount are toggles in `settings/{companyId}`. Invoice forms read settings at runtime — no hardcoded tax/discount logic anywhere.
- **Role model**: Users have `role: "owner" | "admin" | "staff"` stored in Firestore `users/{uid}`. Owners are created at signup; additional users can be invited later.
- **PDF generation client-side**: jsPDF + jsPDF-AutoTable generate invoice PDFs entirely in the browser.

## Product

- Authentication: Signup (creates company + owner user in Firestore), Login, Logout, Forgot Password
- Dashboard: Summary cards — total customers, total invoices, pending invoices, total revenue
- Customers: Add / Edit / Delete / Search customers; WhatsApp and Call quick-action buttons
- Invoices: Create invoice with line items, tax (if enabled), discount (if enabled); status workflow; PDF download
- Settings: Company profile, logo, tax toggle + rate, discount toggle, currency, invoice prefix

## Firestore Collections

- `companies/{companyId}` — name, createdAt, ownerId
- `users/{userId}` — email, companyId, role, displayName, createdAt
- `customers/{customerId}` — companyId, name, email, phone, address, notes, createdAt
- `invoices/{invoiceId}` — companyId, customerId, customerName, invoiceNumber, status, items[], subtotal, tax*, discount*, total, notes, dueDate, createdAt
- `settings/{companyId}` — companyName, companyLogo, currency, invoicePrefix, taxEnabled, taxRate, discountEnabled, address, phone, email, website

## User preferences

- Configuration-driven settings — never hardcode tax or invoice logic
- Modular architecture

## Gotchas

- Firebase secrets are prefixed `VITE_FIREBASE_*` and must be present for the frontend to load
- Firestore security rules need to be set up in the Firebase console to restrict access by companyId/userId
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
