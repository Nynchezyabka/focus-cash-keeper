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
- Family sharing (src/lib/family.ts + family.functions.ts) sends only a whitelisted snapshot (`snapshotOf`, optional `sharedTxs`) to Lovable Cloud; access is by hashed family code + per-member token checked in server functions, tables have RLS with no policies — the cloud is optional and the app must keep working without it.
- Family numbers are always recomputed by `familyTotals` from members' snapshots, never stored — they must stay correct as dates move.
- AI expense parsing runs in the browser with the user’s own key (BYOK) and falls back to a local parser — no server is involved in AI.
- Money is split into card (`balance`) and `cash`; every tx carries `method`, and `calc` uses their sum — keeps card/cash consistent everywhere.
- Category colors are derived from their group's shade family (`GROUP_SHADES`), not picked by the user — fewer decisions for the user.
- One `CategoryPicker` (src/components/Pickers.tsx) is used on every screen that chooses a category — the same chooser everywhere.
- Offline/updates: hand-written network-first `public/sw.js` registered by `src/lib/pwa.ts`, disabled in editor previews — fresh version whenever online.
- AI economy mode: local keyword parse first, AI only for unknown words; saved items teach keywords via `learnKeys` — saves the user's AI requests.
- App version lives in APP_VERSION (src/lib/pwa.ts); bump it and prepend a CHANGELOG entry (src/lib/whatsnew.ts) with every user-visible change — drives the «Что нового» popup after updates.
