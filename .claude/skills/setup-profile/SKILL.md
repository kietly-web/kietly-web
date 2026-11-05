---
name: setup-profile
description: First-time setup of this GitHub profile README for a new account. Researches the user's public GitHub footprint, asks only for what it can't find, rewrites profile.config.json for them, previews it and publishes on their go-ahead. Use when someone has just copied this template, says "set up my profile", "make this mine", or the config still belongs to another person.
---

# Set up a profile for a new account

The goal is a profile that looks considered and is entirely true. Read `CLAUDE.md` and `profile.config.schema.json` first.

## 1. Find out whose profile this is

```bash
gh api user --jq '.login'
git remote get-url origin
```

- The repo must be named exactly the login (`<login>/<login>`), or GitHub won't show it on the profile. If it isn't, tell the user and stop until they rename it.
- If `profile.config.json` has a different `username`, it is the template author's content. Replace all of it: name, tagline, typing lines, about, projects, highlights, badges and quote. Keep nothing personal from the previous owner.

## 2. Research their public footprint

Run these in parallel and read the results:

```bash
gh api users/<login>
gh api users/<login>/social_accounts
gh repo list <login> --limit 100 --source --json name,description,primaryLanguage,stargazerCount,homepageUrl,repositoryTopics,updatedAt,isPrivate
gh api graphql -f query='{ user(login:"<login>"){ pinnedItems(first:6){ nodes{ ... on Repository{ name } } } contributionsCollection{ contributionCalendar{ totalContributions } } } }'
gh search prs --author <login> --merged --limit 30 --json title,repository,closedAt
```

For the 2–4 most substantial public repos (pinned first, then stars, recent activity and size), read the README and any `docs/`, `CLAUDE.md` or ADR folder with `gh api repos/<login>/<repo>/readme --jq .content | base64 -d`. Pull out what makes each one interesting: the problem, the users, notable design decisions, and numbers you can verify.

Derive the stack icons from languages, frameworks in the READMEs, and config files (package.json, go.mod, Dockerfile, workflows).

## 3. Ask only for the gaps

Use one AskUserQuestion with up to 4 questions. Typical gaps:

- Which projects to feature. Offer your top picks, with the strongest first.
- Links to show, if not public: LinkedIn, email, website, X or blog. "Skip" is fine; empty badges are hidden.
- Vibe and colours. Offer 2–3 gradient pairs, e.g. indigo→pink `6366F1,EC4899`, teal→blue `14B8A6,3B82F6`, amber→red `F59E0B,EF4444`, and set `accent` and the snake colours to match.
- Whether to keep the small footer line pointing to this free template (`footer.credit`).

Don't ask for anything the research already answered.

## 4. Write the config

Rewrite `profile.config.json` against the schema, following "Writing content that lands" in `CLAUDE.md`. Then:

```bash
npm run check
GITHUB_TOKEN=$(gh auth token) npm run preview
```

Fix every error `check` reports. A project that 404s means a wrong name or a private repo.

## 5. Show it

Serve and open the preview in both themes, and at phone width:

```bash
python3 -m http.server -d dist 8765
```

Open `http://127.0.0.1:8765/preview.html?theme=dark` and `?theme=light`. Look for overflowing code blocks, thin project cards and broken icons. Fix them, then show the user and iterate on their feedback.

## 6. Publish (only on the user's go-ahead)

```bash
git add -A && git commit -m "Set up profile for <login>" && git push
gh run watch "$(gh run list --workflow refresh-profile.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

If the run fails with a permissions error, the user needs Settings → Actions → General → Workflow permissions → "Read and write permissions". Once it passes, open `https://github.com/<login>` and check that every image loads.
