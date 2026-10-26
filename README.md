# Courtroom Quest

A courtroom game: pick a side, build your case, question witnesses, argue to a jury and win the verdict.
Play against AI, online opponents, or a friend on the same device.

**Stack:** React + Vite + TypeScript + Tailwind, Supabase (auth, Postgres, storage, edge functions), Google Gemini (via edge functions only).

## Run locally

```sh
npm ci
npm run dev
```

The Supabase URL and public anon key are set in `src/integrations/supabase/client.ts` (the anon key is meant to be public; security comes from RLS and the signed-in checks in the edge functions).

Scripts: `npm run dev`, `npm run build`, `npm test`, `npm run typecheck`, `npm run lint`.

## 3D courtroom

The trial and the pre-trial draw a 3D courtroom (Three.js) wherever the browser supports WebGL, and fall back to the avatar tiles otherwise.
Add `?scene=avatars` to the URL to switch it off (remembered), `?scene=court3d` to switch it back on.

- `src/components/court3d/room.ts`: the room and every seat position (judge, bailiff, counsel, witness box, 12 jury seats, gallery).
- `src/components/court3d/character.ts`: people built from code, dressed from the same `AvatarConfig` as the 2D faces; walk, sit, stand, talk, gaze, blink.
- `src/components/court3d/stage.ts`: `CourtStage` owns the scene. React gives it plain state (`StageInput`); it moves the camera and the people.
- `src/components/stage/Court3DScene.tsx`: the trial scene, a normal `SceneProps` scene registered in `scenes.ts`.
- Pre-trial (`PreTrialScript.tsx`): walk to your chair, press START, the judge enters while the bailiff reads; the camera cuts judge, jury, gallery, prosecution, defense.

## Backend (Supabase)

- Apply everything in `supabase/migrations/` in order.
- Deploy the edge functions: `ai-generate` (all in-game AI) and `generate-case` (custom case builder).
- Secrets (Supabase project settings → Edge Functions): `GEMINI_API_KEY` (required);
  `ALLOWED_ORIGINS` (optional, comma-separated site URLs to lock browser access).
- AI is never called from the browser. `ai-generate` requires a signed-in user (guests are anonymous sign-ins),
  allows 30 calls/minute and 1,200/day per user (admins exempt), and caps request and output size.
- Recommended in Supabase Auth settings: enable CAPTCHA (e.g. Turnstile) for anonymous sign-ins, and keep the
  per-IP anonymous sign-in limit on, so guest accounts can't be mass-created to dodge per-user limits.

## Deploying (Vercel)

- Build command `npm run build`, output `dist`. `vercel.json` already rewrites all routes to the app.
- Share previews need the site's absolute URL: Vercel supplies it automatically; elsewhere set `VITE_SITE_URL`.
- Legal pages live in `public/privacy.html` and `public/terms.html`. Replace `CONTACT_EMAIL_HERE` in both
  before launch.

## Monitoring

The app logs crashes and unhandled errors to the `client_errors` table (admins can read it in Supabase,
e.g. `select created_at, message, context, url from client_errors order by created_at desc limit 50;`).

## Working in this repo

Changes may also arrive from other tools/sessions: pull and rebase before pushing.
