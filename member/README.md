# apps/fresh

Deno **Fresh 2.3** frontend, scaffolded alongside the existing Next.js
`apps/web`. Demonstrates:

- File-system routing with route groups (`routes/(saas)/app/dashboard`)
- Preact islands (the ported `MemberDashboardV2`)
- **Svelte 5 islands** via `@sveltejs/vite-plugin-svelte` + a thin Preact
  wrapper that mounts the Svelte component on the client (`islands/SvelteCounter.tsx` → `components/Counter.svelte`)
- CSS Modules (the dashboard styles are copied verbatim from `apps/web`)

## Run locally

```sh
cd apps/fresh
deno task dev          # vite dev server with HMR
# or, to test the production build:
deno task preview      # build + serve _fresh/server.js
```

## Deploy to Deno Deploy

The repo is configured exactly the way the Fresh 2.3 docs prescribe:

- `deno task build` → emits `_fresh/server.js`
- `deno task start` → `deno serve -A _fresh/server.js`

Deno Deploy auto-detects the `build` task; set the entry point to
`_fresh/server.js` if it doesn't auto-detect.

## What's stubbed

The original `apps/web/app/(saas)/app/layout.tsx` runs `getSession()`,
`getOrganizationList()`, `getPurchases()` and redirects unauthenticated /
unbilled users. None of that is wired here yet — the layout renders straight
through and `main.ts` injects a fake user via middleware. Replace that with a
Deno-compatible session check (e.g. a Better Auth port or JWT cookie) when
porting auth.

## Ports done so far

| Next.js source                                                          | Fresh equivalent                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| `apps/web/app/(saas)/app/layout.tsx`                                    | `routes/(saas)/app/_layout.tsx`                                |
| `apps/web/app/(saas)/app/(account)/dashboard/page.tsx`                  | `routes/(saas)/app/dashboard/index.tsx`                        |
| `apps/web/modules/saas/member-dashboard-v2/components/MemberDashboardV2.tsx` | `islands/MemberDashboardV2.tsx`                            |
| `…/MemberDashboardV2.module.css`                                        | `islands/MemberDashboardV2.module.css` (copied verbatim)       |
| `…/data.ts`                                                             | `islands/dashboard-data.ts` (copied verbatim)                  |

## Adding more Svelte islands

1. Drop a `Foo.svelte` file in `components/`.
2. Create `islands/Foo.tsx` that imports it via the `mount()` pattern in
   `islands/SvelteCounter.tsx`.
3. Use `<Foo … />` from any route or other island.
