# Make this profile yours

This is a free template for a GitHub profile README. Use it for anything (it's [MIT licensed](LICENSE)). You get:

- an animated banner and typing intro
- a tech-stack strip and spotlight cards for your projects
- self-hosted stats, languages and activity cards in light and dark
- a list of your recently merged PRs and a contribution snake

An Action refreshes everything every 6 hours. Everything you see comes from one file, `profile.config.json`, and Claude can fill that file in for you.

The code and design are free to reuse. The text in `profile.config.json` describes the original author, so replace it with your own.

## 1. Create your profile repo

GitHub shows a repo's README on your profile only when the repo is **public** and named **exactly your username**.

- **On github.com:** open this repo, click **Use this template → Create a new repository**, name it your username, and make it public.
- **Or with the GitHub CLI** (replace `YOUR-USERNAME`):

  ```bash
  gh repo create YOUR-USERNAME --public --clone --template kietly-web/kietly-web
  ```

Use the template rather than a fork. Forks start with Actions turned off, and they can't be named after you if you already starred or forked something under that name.

## 2. Let Claude set it up (recommended)

```bash
cd YOUR-USERNAME
claude
```

Then type `/setup-profile`. Claude will:

- read your public GitHub profile, repos and merged PRs
- ask you a few questions it can't answer from those (which projects to feature, which links to show, colours)
- write the config and show you a preview in light and dark
- publish when you say so

Later, `/edit-profile` handles any change: "add my new project", "make it teal", "hide the snake", "how can I make this better?"

## 3. Or edit it yourself

1. Edit `profile.config.json`. Every field is documented in `profile.config.schema.json`, and editors like VS Code autocomplete it.
2. Check it: `npm run check` (Node 20+, nothing to install).
3. Optionally preview it: `GITHUB_TOKEN=$(gh auth token) npm run preview`, then open `dist/preview.html`.
4. Commit and push. The **Refresh profile** Action builds the cards and publishes them to the `output` branch. Images appear on your profile once its first run finishes.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Action fails with "still set up for …" | `username` in the config isn't yours yet. Run `/setup-profile` or edit it |
| Action fails on push / permission denied | Settings → Actions → General → Workflow permissions → **Read and write permissions** |
| Images broken right after setup | The first Action run hasn't finished yet. Check the Actions tab |
| Only some tech icons show | An id in `stack.icons` isn't a valid [skillicons.dev](https://github.com/tandpfun/skill-icons#icons-list) id |
| Profile doesn't show the README | The repo must be public and named exactly your username |

## How it works

`scripts/build-readme.mjs` validates the config against the schema, fetches your stats with GitHub's GraphQL API, and writes `README.md` and the SVG cards. The workflow in `.github/workflows/refresh-profile.yml` runs it on a schedule, adds the snake with [Platane/snk](https://github.com/Platane/snk), and pushes the images to the `output` branch, so `main` stays clean.

The banner, typing line, badges and icons come from capsule-render, readme-typing-svg, shields.io and skillicons.dev.
