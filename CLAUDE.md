# GitHub profile README generator

This repo is a GitHub profile README (`<username>/<username>`). Everything on the profile comes from `profile.config.json`. `scripts/build-readme.mjs` turns it into `README.md` plus SVG cards, and a scheduled Action publishes them. Anyone can copy the repo and make it theirs. See `SETUP.md`.

## Files

| Path | What |
| --- | --- |
| `profile.config.json` | The only file to edit for content, colours and section order |
| `profile.config.schema.json` | Every field, its default and its limits. Read it before editing the config |
| `README.md` | Generated. Never hand-edit; the next build overwrites it |
| `scripts/build-readme.mjs` | CLI: validates the config, fetches GitHub data, writes `README.md` and `dist/` |
| `scripts/lib/` | `config` (schema validation + defaults), `github` (GraphQL), `cards` (SVG stats/language/project/activity cards), `readme` (sections), `preview` |
| `.github/workflows/refresh-profile.yml` | Every 6 hours, and on config/script pushes: build, render the snake, push `dist/` to the `output` branch, commit `README.md` if it changed |
| `.claude/skills/` | `/setup-profile` (first-time setup for a new account) and `/edit-profile` (any change after that) |

## Commands

Node 20+ and no dependencies, so there is nothing to install.

| Command | Does |
| --- | --- |
| `npm run check` | Validate the config (offline, instant). Run after every config edit |
| `GITHUB_TOKEN=$(gh auth token) npm run build` | Write `README.md` and `dist/*.svg` |
| `GITHUB_TOKEN=$(gh auth token) npm run preview` | Same, plus `dist/preview.html` rendered by GitHub's own Markdown API |

To look at the preview in Claude's browser pane, serve it: `python3 -m http.server -d dist 8765` (in the background), then open `http://127.0.0.1:8765/preview.html?theme=dark` and `?theme=light`. Check both themes, and check at 375 px wide too. Profiles are often viewed on phones.

Cards in `dist/` only reach the live profile after the Action pushes them to the `output` branch. Until the first run, images on github.com are broken. That is expected.

## Rules

- **Edit `profile.config.json`, never `README.md`.** For a layout change the config can't express, change `scripts/lib/readme.mjs` or `cards.mjs`, and add any new field to the schema with a `default` and a `description`.
- **Only state facts you can source.** Use the GitHub API (`gh api`), the user's repos and READMEs, or what the user tells you. Never invent links, emails, employers, metrics or achievements. If a badge URL is unknown, leave `url` empty; empty badges are hidden.
- **Personal data is the user's call.** Only add an email, location or employer if it is already public on their GitHub profile or they give it to you.
- **Run `npm run check` after every edit**, and preview before you call a visual change done.
- **Respect the length limits in the schema.** Typing lines ≤ 48 chars, about texts ≤ 80 (aim for ≤ 65 so the code block doesn't scroll), project descriptions ≤ 230.
- **Commit and push only when the user asks.** Pushing to `main` publishes to their public profile.

## Writing content that lands

- Tagline: what they build and for whom, in one line. Not a list of buzzwords.
- Typing lines: 3–5 short lines. Mix a greeting, what they do, and what they're on right now.
- Highlights: 3–5 per spotlight project. Lead with a bold claim, then the concrete proof from the repo: an architecture choice, a constraint they enforced, a number. For example: `**Tenant isolation in Postgres.** Row-level security on every table, with a generated test that fails if a new table skips it.`
- Prefer numbers that come from the repo itself (ADRs, merged PRs, test counts) over adjectives.
- Feature 1–4 projects. A repo with almost nothing in it hurts more than it helps; suggest dropping it.
- Stack icons must be valid skillicons.dev ids (see the link in the schema). An invalid id breaks the whole icon strip.
