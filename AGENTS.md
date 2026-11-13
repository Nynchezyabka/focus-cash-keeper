<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- App is local-first: each person's budget lives only in localStorage via src/lib/budget.ts, no login — user requirement for privacy and instant start.
- Family sharing (src/lib/family.ts + family-api.ts) sends only a whitelisted snapshot (`snapshotOf`, optional `sharedTxs`) via SECURITY DEFINER Postgres RPCs called with the publishable key; code/token are checked inside the RPCs, tables have RLS with no policies; keep supabase/family-setup.sql in sync with migrations — no app server is needed, so it runs on static hosting (Layero) and the app must keep working without the cloud.
- Foreign-currency spending is stored in rubles with `Tx.orig`; rates from cbr-xml-daily.ru cached in localStorage (src/lib/fx.ts) — works offline and without VPN.
- Family numbers are always recomputed by `familyTotals` from members' snapshots, never stored — they must stay correct as dates move.
- AI expense parsing runs in the browser with the user’s own key (BYOK) and falls back to a local parser — no server is involved in AI.
- Money is split into card (`balance`) and `cash`; every tx carries `method`, and `calc` uses their sum — keeps card/cash consistent everywhere.
- Category colors default to stable group shades; optional palette IDs are stored on categories/goals, with CSS tokens resolving their display and whitelisted colors accompanying shared data.
- BYOK model selection is resolved centrally in parse.ts: parsing uses model, the advisor uses advisorModel with parsing/default fallback; all calls remain browser-only.
- One `CategoryPicker` (src/components/Pickers.tsx) is used on every screen that chooses a category — the same chooser everywhere.
- Offline/updates: hand-written cache-first-with-background-refresh `public/sw.js` registered by `src/lib/pwa.ts`, disabled in editor previews — opens instantly on weak networks, update check (`?_v=`) bypasses cache.
- AI economy mode: local keyword parse first, AI only for unknown words; saved items teach keywords via `learnKeys` — saves the user's AI requests.
- App version lives in APP_VERSION (src/lib/pwa.ts); bump it and prepend a CHANGELOG entry (src/lib/whatsnew.ts) with every user-visible change — drives the «Что нового» popup after updates.
- Savings goals (src/lib/goals.ts) are labels on part of `cushion`: a goal's money is derived from txs tagged `goal` (kind "goal" = move inside savings), never stored — undo and export work as for any tx.
- Family goals sync via the separate RPC `family_goals_push` (supabase/family-goals.sql) and only my own contribution leaves the phone; a missing RPC on an old database is ignored.
- Anonymous RPCs always validate input size; tables are REVOKEd from anon/authenticated and helper functions are not executable from outside — the publishable key is public.
- Feedback owner key is set only in SQL Editor (`feedback_set_owner`); checks go through `_fb_check`, which never raises so the failure counter survives (5 fails → 15 min lock).
- Fonts are bundled via @fontsource and a CSP meta tag is emitted in production builds only (dev needs Vite websockets) — no third-party origins besides DB, CBR and the AI provider.
