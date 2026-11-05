import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadConfig } from "./lib/config.mjs";
import { fetchProfile, renderMarkdown } from "./lib/github.mjs";
import { buildCards } from "./lib/cards.mjs";
import { assetBase, renderReadme } from "./lib/readme.mjs";
import { previewPage } from "./lib/preview.mjs";

const USAGE = `Usage: node scripts/build-readme.mjs [--check] [--preview]

  (no flags)  validate the config, fetch GitHub data, write README.md and dist/*.svg
  --check     validate profile.config.json only (no network, no token)
  --preview   also write dist/preview.html (open it, or serve dist/ and visit /preview.html)

GITHUB_TOKEN must be set for anything but --check. Locally: GITHUB_TOKEN=$(gh auth token)`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const args = new Set(process.argv.slice(2));

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (args.has("--help") || args.has("-h")) {
  console.log(USAGE);
  process.exit(0);
}
const unknown = [...args].filter((a) => !["--check", "--preview"].includes(a));
if (unknown.length) fail(`Unknown option ${unknown.join(" ")}\n\n${USAGE}`);

const config = await loadConfig(root).catch((err) => fail(err.message));

const owner = process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY_OWNER;
if (owner && owner.toLowerCase() !== config.username.toLowerCase())
  fail(`profile.config.json is still set up for "${config.username}", but this repo belongs to "${owner}". See SETUP.md, or open the repo in Claude Code and run /setup-profile.`);

if (args.has("--check")) {
  console.log(`✔ profile.config.json is valid (${config.sections.length} sections, ${config.projects.length} projects)`);
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN;
if (!token) fail("GITHUB_TOKEN is not set. Locally, run: GITHUB_TOKEN=$(gh auth token) node scripts/build-readme.mjs");

const data = await fetchProfile(config, token).catch((err) => fail(err.message));
const readme = renderReadme(config, data);
const cards = buildCards(config, data);

await mkdir(distDir, { recursive: true });
for (const [name, svg] of Object.entries(cards)) await writeFile(path.join(distDir, name), svg);
await writeFile(path.join(root, "README.md"), readme);
console.log(`✔ README.md and ${Object.keys(cards).length} cards in dist/`);

if (args.has("--preview")) {
  const html = await renderMarkdown(token, readme, `${config.username}/${config.username}`).catch((err) => fail(err.message));
  await writeFile(path.join(distDir, "preview.html"), previewPage(html, assetBase(config), config.username, Object.keys(cards)));
  console.log("✔ dist/preview.html (add ?theme=dark or ?theme=light to force a theme)");
}
