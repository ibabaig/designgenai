# Task: wire Google auth into this Next.js app

You are working in an existing Next.js app that is deployed on Vercel and already
talks to Supabase. Your job is to integrate Google OAuth, a profiles table, a
profile editor, and one gated route.

**All Supabase and Google console configuration is already done.** Do not ask the
user to create OAuth clients, enable providers, or run SQL. Specifically, these
already exist and you should assume they work:

- A Supabase project, with `NEXT_PUBLIC_SUPABASE_URL` and the anon/publishable key
  already in `.env.local` and in Vercel's environment variables.
- A `public.artworks` table (from a previous assignment) holding MoMA artwork rows.
- A `public.profiles` table: `id uuid` (PK, FK to `auth.users`), `email text`,
  `first_name text` (nullable), `last_name text` (nullable), `avatar_path text`,
  `updated_at timestamptz`.
- A trigger `on_auth_user_created` on `auth.users` that inserts a `profiles` row
  with NULL names whenever a user signs up.
- A public Storage bucket named `avatars`, with policies allowing an authenticated
  user to write only inside a folder named after their own user id.
- Google OAuth enabled in Supabase, with redirect URLs allow-listed for both
  `http://localhost:3000/**` and the Vercel domain.

Row Level Security is intentionally OFF on `public.profiles`. Do not enable it.

## Source files

The accompanying `app/`, `lib/`, and `middleware.ts` files are the implementation.
Copy them into the project at the matching paths. Two of them (`lib/artworks.ts`,
`lib/supabase/server.ts`) already exist in the project unchanged — overwrite them
only if they differ; otherwise leave them alone.

```
middleware.ts                       <- project root
lib/supabase/client.ts              <- browser client
lib/supabase/server.ts              <- server client (may already exist)
lib/supabase/middleware.ts          <- updateSession + protected path list
lib/profiles.ts                     <- ProfileRepository + auth gates
lib/artworks.ts                     <- may already exist
app/login/page.tsx
app/login/google-button.tsx
app/auth/callback/route.ts
app/auth/signout/route.ts
app/auth/auth-code-error/page.tsx
app/onboarding/page.tsx
app/profile/page.tsx
app/profile/profile-form.tsx
app/profile/actions.ts
app/collection/page.tsx
```

## Steps

### 1. Install dependencies

```
npm install @supabase/supabase-js @supabase/ssr
```

### 2. Inspect the project before copying anything

Read `package.json`, `tsconfig.json` (or `jsconfig.json`), and `.env.local`, and
check whether a `src/` directory exists. Then adapt as follows.

**If the project uses `src/`:** everything above goes inside `src/`, including
`middleware.ts` (so `src/middleware.ts`, `src/lib/...`, `src/app/...`).

**Path alias.** The files import with `@/lib/...`. Confirm `tsconfig.json` maps
`"@/*"` to `"./*"` (or `"./src/*"` with a src dir). If there is no such alias,
either add one or rewrite the imports to relative paths. Do not leave broken
imports.

**Environment variable name.** The provided files read
`process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`. Open `.env.local` and check the
actual name — projects scaffolded from the Supabase starter use
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead. Whichever name is really there,
make **every** file use that same one. This is the single most likely cause of a
silent failure, so verify it explicitly rather than assuming.

**Next.js version.** Check the `next` version in `package.json`.

- **16 or later:** rename `middleware.ts` to `proxy.ts` and change
  `export async function middleware` to `export async function proxy`. Leave the
  Supabase code inside unchanged.
- **15.x:** keep `middleware.ts` exactly as provided.
- **14 or earlier:** keep `middleware.ts`, and in `app/login/page.tsx` change
  `searchParams` from `Promise<{ next?: string }>` to a plain
  `{ next?: string }` and drop the `await`.

If a `middleware.ts` or `proxy.ts` already exists, merge rather than replace:
call `updateSession(request)` first and return its response, preserving whatever
the existing file does.

**JavaScript projects.** If the app is plain JS with no TypeScript, convert the
`.ts`/`.tsx` files to `.js`/`.jsx` and strip the type annotations. Do not add
TypeScript to a project that isn't using it.

### 3. Match the existing visual style

The provided pages are structurally correct but deliberately unstyled. The site is
a typographic "Museum of Digital Art" gallery with a strong existing aesthetic.

Look at how the current pages are styled (Tailwind utility classes, CSS modules, or
a global stylesheet) and apply the **same** approach to the new pages so they don't
look bolted on. Reuse existing components, spacing scale, type treatment, and color
tokens.

Do not redesign, restructure, or restyle any existing page. Do not introduce a new
styling library.

### 4. Link the new routes from the existing site

- Point the existing "Enter the collection" call-to-action at `/collection`.
- Add a small sign-in / profile affordance in the header or nav, consistent with
  the current design.

### 5. Verify

Run `npm run build` and fix every type error and build failure. Then run
`npm run dev` and confirm this flow by actually loading the pages:

1. `/collection` while signed out redirects to `/login`.
2. `/login` shows a "Continue with Google" button.
3. After Google sign-in, the browser lands on `/onboarding` (because the trigger
   created the profile row with NULL names).
4. Submitting first and last name redirects to `/collection`, which lists the
   artworks and greets the user by name.
5. `/profile` loads, accepts a photo upload, saves, and the photo survives a reload.
6. Signing out and revisiting `/collection` redirects to `/login` again.

## Hard constraints

- **Never hardcode the Supabase URL or key.** They come from environment variables
  only. Do not print them, commit them, or inline them as fallbacks.
- **Confirm `.gitignore` contains `.env*`** before any commit.
- **The OAuth callback route must stay at exactly `/auth/callback`.** Do not move
  it, rename it, or add query parameters to `redirectTo` beyond the `next` param
  already in the code. This path is a fixed requirement.
- **Use `getClaims()` for auth checks, never `getSession()`.** `getSession()` reads
  the cookie without verifying its signature, so it cannot be trusted server-side.
  This applies to any new code you write too.
- **Do not put image bytes in Postgres.** Avatars upload from the browser directly
  to Supabase Storage; only the path string is written to `profiles.avatar_path`.
  Keep it that way — routing the file through a Server Action would also hit the
  ~1MB request body limit.
- **Do not run `supabase` CLI commands, create migrations, or modify the database.**
  The schema is already in place.
- **Do not add an auth provider other than Google**, and do not add email/password
  sign-in.
- In `lib/supabase/middleware.ts`, do not insert any code between
  `createServerClient(...)` and `supabase.auth.getClaims()`. Code in that gap causes
  intermittent random sign-outs that are very hard to diagnose.

## If something is genuinely ambiguous

Make the smallest reasonable choice, implement it, and note it in your summary.
Do not stop and ask unless a decision would be destructive or irreversible.

## When done

Report: which files you added, anything you had to adapt (env var name, src dir,
Next version, JS conversion), any build errors you fixed, and the result of each
of the six verification steps.
