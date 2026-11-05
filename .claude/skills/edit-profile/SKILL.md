---
name: edit-profile
description: Change anything on this GitHub profile README after setup, such as wording, colours, sections, projects, badges, stack icons or highlights, or review it and suggest improvements. Use for requests like "change my tagline", "add my new project", "make it purple", "hide the snake", "add a section about my talks" or "how can I make my profile better".
---

# Edit the profile

Read `CLAUDE.md` first. Every change goes through `profile.config.json`, never `README.md`.

## Where each request lands

| Request | Config path |
| --- | --- |
| Name, tagline in banner | `name`, `tagline` |
| Colours | `theme.gradient` (banner and cards), `theme.accent`, `snake.*` |
| Animated lines | `typing.lines` |
| Contact links | `badges.links[]`: `{label, url, logo, color}`; logo is a simpleicons.org slug |
| About block | `about.items[]`, `about.style` (`code` or `list`), `about.variable` |
| Tech icons | `stack.icons` (skillicons.dev ids), `stack.perLine` |
| Featured projects | `projects[]`: `repo`, `title`, `description`, `highlights` (highlights make a wide spotlight card) |
| Hide, show or reorder a section | `sections` |
| A new free-form section | Add `{ "heading": "🎤 Talks", "markdown": "…" }` to `sections` where it should appear |
| Section headings | `headings.*` (empty string drops the heading) |
| Stats cards | `stats.overview`, `stats.languages`, `activity.weeks` |
| Recent PR list | `recent.count`, `recent.exclude` |
| Footer | `footer.quote`, `footer.credit` |

If a request needs something the config can't do, extend `scripts/lib/readme.mjs` or `cards.mjs`, and add the new field to `profile.config.schema.json` with a `default` and a `description`, so the next person (or Claude) can find it.

## Loop

1. Edit the config. When the change uses facts (a new project, a metric), verify them with `gh api` or the repo first.
2. `npm run check`
3. `GITHUB_TOKEN=$(gh auth token) npm run preview`. Serve with `python3 -m http.server -d dist 8765` and look at `/preview.html?theme=dark` and `?theme=light` for any visual change.
4. Tell the user what changed. Commit and push only when they ask. The push triggers the Action, which refreshes the live cards.

## "Make it better" reviews

Check the preview against "Writing content that lands" in `CLAUDE.md` and report the 3–5 changes with the most impact. Typical ones:

- Vague tagline or typing lines
- A project with no highlights, or highlights without proof
- Thin or empty featured repos
- Missing contact links
- Repo descriptions on GitHub that undersell the work (suggest the text; changing them is the user's call)
- About lines long enough to scroll

Offer to apply them.
