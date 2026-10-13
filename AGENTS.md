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

- App is local-first: all data lives in localStorage via src/lib/budget.ts (no backend, no login) — user requirement for privacy and instant start.
- AI expense parsing runs in the browser with the user’s own key (BYOK) and falls back to a local parser — keeps the app backend-free.
