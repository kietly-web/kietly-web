import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const config = JSON.parse(await readFile(path.join(root, "profile.config.json"), "utf8"));
const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error("GITHUB_TOKEN is required (the GraphQL API rejects anonymous calls).");
  process.exit(1);
}

const [gradFrom, gradTo] = config.theme.gradient.map((c) => `#${c}`);
const accent = `#${config.theme.accent}`;

const palettes = {
  dark: { bg: "#0d1117", card: "#161b22", border: "#30363d", text: "#e6edf3", muted: "#8b949e", grid: "#21262d", track: "#21262d" },
  light: { bg: "#ffffff", card: "#ffffff", border: "#d0d7de", text: "#1f2328", muted: "#656d76", grid: "#eaeef2", track: "#eaeef2" },
};

const enc = encodeURIComponent;
const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const fmt = (n) => Number(n).toLocaleString("en-US");
const assetUrl = (file) => `https://raw.githubusercontent.com/${config.username}/${config.username}/${config.assetsBranch}/${file}`;

async function graphql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": config.username },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`GraphQL failed: ${JSON.stringify(body.errors ?? body)}`);
  return body.data;
}

async function fetchProfile() {
  const projectFields = config.projects
    .map(
      (p, i) => `p${i}: repository(owner: $login, name: ${JSON.stringify(p.repo)}) {
        name description url homepageUrl stargazerCount forkCount
        primaryLanguage { name color }
        pullRequests(states: MERGED) { totalCount }
        defaultBranchRef { target { ... on Commit { history { totalCount } } } }
      }`,
    )
    .join("\n");

  const data = await graphql(
    `query($login: String!, $search: String!) {
      user(login: $login) {
        contributionsCollection {
          totalCommitContributions
          totalPullRequestReviewContributions
          contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
        }
        pullRequests(states: MERGED) { totalCount }
        repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100) {
          totalCount
          nodes { stargazerCount languages(first: 20) { edges { size node { name color } } } }
        }
      }
      ${projectFields}
      search(query: $search, type: ISSUE, first: 40) {
        nodes { ... on PullRequest { title url mergedAt repository { name nameWithOwner } } }
      }
    }`,
    { login: config.username, search: `author:${config.username} is:pr is:merged is:public sort:updated-desc` },
  );

  return {
    user: data.user,
    projects: config.projects.map((p, i) => ({ ...p, data: data[`p${i}`] })),
    mergedPrs: data.search.nodes.filter((n) => n?.mergedAt),
  };
}

function streaks(days) {
  const today = new Date().toISOString().slice(0, 10);
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) current++;
    else if (days[i].date === today && current === 0) continue;
    else break;
  }
  return { current, longest };
}

function topLanguages(repos, limit = 6) {
  const totals = new Map();
  for (const repo of repos) {
    for (const { size, node } of repo.languages.edges) {
      const prev = totals.get(node.name) ?? { size: 0, color: node.color ?? "#8b949e" };
      totals.set(node.name, { size: prev.size + size, color: prev.color });
    }
  }
  const sorted = [...totals].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.size - a.size);
  const sum = sorted.reduce((s, l) => s + l.size, 0) || 1;
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((s, l) => s + l.size, 0);
  if (rest > 0) top.push({ name: "Other", size: rest, color: "#8b949e" });
  return top.map((l) => ({ ...l, pct: (l.size / sum) * 100 }));
}

function wrap(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [""];
  for (const w of words) {
    const line = lines[lines.length - 1];
    if ((line + " " + w).trim().length > maxChars) {
      if (lines.length === maxLines) {
        lines[lines.length - 1] = line.replace(/\s*\S*$/, "") + "…";
        return lines;
      }
      lines.push(w);
    } else lines[lines.length - 1] = (line + " " + w).trim();
  }
  return lines;
}

function frame({ width, height, theme, body, label }) {
  const c = palettes[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(label)}">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${gradFrom}"/><stop offset="0.5" stop-color="${accent}"/><stop offset="1" stop-color="${gradTo}"/></linearGradient>
    <linearGradient id="brandFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>
  </defs>
  <style>
    text { font-family: "Segoe UI", Ubuntu, "Helvetica Neue", Helvetica, Arial, sans-serif; fill: ${c.text}; }
    .title { font-size: 17px; font-weight: 700; fill: url(#brand); }
    .sub { font-size: 11.5px; fill: ${c.muted}; }
    .label { font-size: 13px; fill: ${c.muted}; }
    .value { font-size: 14px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .fade { opacity: 0; animation: fade 0.6s ease-out forwards; }
    @keyframes fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .fade { animation: none; opacity: 1; } * { animation: none !important; } }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${c.card}" stroke="${c.border}"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="3" rx="1.5" fill="url(#brand)"/>
  ${body}
</svg>`;
}

function overviewCard(stats, theme) {
  const c = palettes[theme];
  const rows = [
    ["Contributions", stats.contributions],
    ["Commits", stats.commits],
    ["PRs merged", stats.prsMerged],
    ["Code reviews", stats.reviews],
    ["Public repos", stats.repos],
  ];
  const rowSvg = rows
    .map(
      ([label, value], i) => `<g class="fade" style="animation-delay:${0.1 + i * 0.1}s">
      <circle cx="31" cy="${78 + i * 24}" r="3.5" fill="url(#brand)"/>
      <text x="44" y="${82 + i * 24}" class="label">${label}</text>
      <text x="270" y="${82 + i * 24}" class="value" text-anchor="end">${fmt(value)}</text>
    </g>`,
    )
    .join("\n");

  const r = 52;
  const circ = 2 * Math.PI * r;
  const progress = stats.longest ? Math.min(stats.current / stats.longest, 1) : 0;
  const ring = `<g transform="translate(392 104)">
    <circle r="${r}" fill="none" stroke="${c.track}" stroke-width="9"/>
    <circle r="${r}" fill="none" stroke="url(#brand)" stroke-width="9" stroke-linecap="round" transform="rotate(-90)"
      stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${circ.toFixed(1)}">
      <animate attributeName="stroke-dashoffset" from="${circ.toFixed(1)}" to="${(circ * (1 - progress)).toFixed(1)}" dur="1.2s" begin="0.3s" fill="freeze" calcMode="spline" keySplines="0.3 0 0.2 1" keyTimes="0;1"/>
    </circle>
    <text y="6" text-anchor="middle" style="font-size:30px;font-weight:800;fill:url(#brand)">${stats.current}</text>
    <text y="26" text-anchor="middle" class="sub">day streak</text>
  </g>
  <text x="392" y="180" text-anchor="middle" class="sub">longest ${stats.longest} days</text>`;

  return frame({
    width: 495,
    height: 195,
    theme,
    label: `${config.name}'s GitHub stats`,
    body: `<text x="25" y="38" class="title">GitHub at a glance</text>
    <text x="25" y="55" class="sub">past 12 months</text>
    ${rowSvg}
    ${ring}`,
  });
}

function languagesCard(langs, theme) {
  const barX = 25;
  const barW = 445;
  let x = barX;
  const segments = langs
    .map((l) => {
      const w = (l.pct / 100) * barW;
      const seg = `<rect x="${x.toFixed(2)}" y="72" width="${Math.max(w, 0).toFixed(2)}" height="12" fill="${l.color}"/>`;
      x += w;
      return seg;
    })
    .join("");
  const legend = langs
    .map((l, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const lx = 25 + col * 230;
      const ly = 115 + row * 24;
      return `<g class="fade" style="animation-delay:${0.15 + i * 0.08}s">
        <circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${l.color}"/>
        <text x="${lx + 18}" y="${ly}" style="font-size:13px">${xml(l.name)}</text>
        <text x="${lx + 205}" y="${ly}" class="value" style="font-size:12.5px" text-anchor="end">${l.pct.toFixed(1)}%</text>
      </g>`;
    })
    .join("\n");

  return frame({
    width: 495,
    height: 195,
    theme,
    label: "Top languages",
    body: `<text x="25" y="38" class="title">Top languages</text>
    <text x="25" y="55" class="sub">by bytes of code across public repos</text>
    <clipPath id="bar"><rect x="${barX}" y="72" width="${barW}" height="12" rx="6"/></clipPath>
    <g clip-path="url(#bar)">${segments}</g>
    ${legend}`,
  });
}

function projectCard(project, theme) {
  const c = palettes[theme];
  const wide = Boolean(project.highlights?.length);
  const width = wide ? 830 : 495;
  const d = project.data;
  const title = project.title ?? d.name;
  const description = project.description ?? d.description ?? "";
  const lines = wrap(description, wide ? 115 : 66, wide ? 2 : 3);
  const commits = d.defaultBranchRef?.target?.history?.totalCount ?? 0;
  const facts = [
    d.primaryLanguage && `<tspan fill="${d.primaryLanguage.color}">●</tspan> ${xml(d.primaryLanguage.name)}`,
    commits && `${fmt(commits)} commits`,
    d.pullRequests.totalCount && `${fmt(d.pullRequests.totalCount)} PRs merged`,
    `★ ${fmt(d.stargazerCount)}`,
  ].filter(Boolean);

  return frame({
    width,
    height: wide ? 140 : 150,
    theme,
    label: title,
    body: `<text x="25" y="38" class="title">${xml(title)}</text>
    <text x="25" y="55" class="sub">${xml(config.username)}/${xml(d.name)}</text>
    ${lines.map((l, i) => `<text x="25" y="${80 + i * 18}" style="font-size:13px">${xml(l)}</text>`).join("\n")}
    <text x="25" y="${wide ? 124 : 132}" class="sub" style="font-size:12px">${facts.join(`<tspan fill="${c.border}">  ·  </tspan>`)}</text>`,
  });
}

function activityCard(weeks, theme) {
  const c = palettes[theme];
  const W = 830;
  const H = 260;
  const left = 50;
  const right = W - 25;
  const top = 80;
  const bottom = H - 40;
  const totals = weeks.map((w) => ({ start: w[0].date, count: w.reduce((s, d) => s + d.contributionCount, 0) }));
  const max = Math.max(...totals.map((t) => t.count), 1);
  const niceMax = Math.ceil(max / 4 / 5) * 5 * 4;
  const slot = (right - left) / totals.length;
  const barW = slot * 0.62;
  const total = totals.reduce((s, t) => s + t.count, 0);
  const best = totals.reduce((a, b) => (b.count > a.count ? b : a));
  const dayLabel = (iso) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  const grid = [0, 1, 2, 3, 4]
    .map((i) => {
      const y = bottom - (i / 4) * (bottom - top);
      return `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="${c.grid}" stroke-dasharray="${i ? "3 4" : "0"}"/>
      <text x="${left - 10}" y="${y + 4}" class="sub" text-anchor="end">${(niceMax * i) / 4}</text>`;
    })
    .join("\n");

  const bars = totals
    .map((t, i) => {
      const x = left + i * slot + (slot - barW) / 2;
      const h = (t.count / niceMax) * (bottom - top);
      const begin = (0.2 + i * 0.05).toFixed(2);
      const label = (totals.length - 1 - i) % 2 === 0
        ? `<text x="${(x + barW / 2).toFixed(1)}" y="${bottom + 22}" class="sub" text-anchor="middle">${dayLabel(t.start)}</text>`
        : "";
      if (!t.count) return `<rect x="${x.toFixed(1)}" y="${bottom - 2}" width="${barW.toFixed(1)}" height="2" rx="1" fill="${c.grid}"/>${label}`;
      return `<rect x="${x.toFixed(1)}" y="${bottom}" width="${barW.toFixed(1)}" height="0" rx="5" fill="url(#barFill)"><title>Week of ${t.start}: ${t.count}</title>
        <animate attributeName="height" from="0" to="${h.toFixed(1)}" dur="0.8s" begin="${begin}s" fill="freeze" calcMode="spline" keySplines="0.3 0 0.2 1" keyTimes="0;1"/>
        <animate attributeName="y" from="${bottom}" to="${(bottom - h).toFixed(1)}" dur="0.8s" begin="${begin}s" fill="freeze" calcMode="spline" keySplines="0.3 0 0.2 1" keyTimes="0;1"/>
      </rect>
      <text x="${(x + barW / 2).toFixed(1)}" y="${(bottom - h - 8).toFixed(1)}" text-anchor="middle" class="value fade" style="font-size:11.5px;animation-delay:${(Number(begin) + 0.7).toFixed(2)}s">${t.count}</text>${label}`;
    })
    .join("\n");

  return frame({
    width: W,
    height: H,
    theme,
    label: "Contribution activity",
    body: `<defs><linearGradient id="barFill" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${gradFrom}"/><stop offset="1" stop-color="${gradTo}"/></linearGradient></defs>
    <text x="25" y="38" class="title">Contribution activity</text>
    <text x="25" y="55" class="sub">last ${totals.length} weeks · ${fmt(total)} contributions · best week ${dayLabel(best.start)} with ${best.count}</text>
    ${grid}
    ${bars}`,
  });
}

function picture(name, alt, width) {
  return themedImg(assetUrl(`${name}-dark.svg`), assetUrl(`${name}-light.svg`), alt, width);
}

function themedImg(darkUrl, lightUrl, alt, width) {
  // srcset splits candidates on commas, so a raw comma in the URL truncates it.
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${darkUrl.replace(/,/g, "%2C")}"><img alt="${xml(alt)}" src="${lightUrl}"${width ? ` width="${width}"` : ""}></picture>`;
}

const capsule = (section, extra) =>
  `https://capsule-render.vercel.app/api?type=waving&color=0:${config.theme.gradient[0]},100:${config.theme.gradient[1]}&section=${section}&${extra}`;

const sections = {
  header: () =>
    `<a href="https://github.com/${config.username}"><img src="${capsule(
      "header",
      `height=210&text=${enc(config.name)}&fontSize=68&fontColor=ffffff&fontAlignY=36&desc=${enc(config.tagline)}&descSize=18&descAlignY=58&animation=fadeIn`,
    )}" width="100%" alt="${xml(config.name)}"></a>`,

  typing: () => {
    const src = `https://readme-typing-svg.demolab.com?font=${enc(config.theme.font)}&weight=600&size=22&duration=3200&pause=900&color=${config.theme.accent}&center=true&vCenter=true&width=640&lines=${config.typing.lines.map(enc).join(";")}`;
    return `<p align="center"><img src="${src}" alt="${xml(config.typing.lines.join(" · "))}"></p>`;
  },

  badges: () => {
    const links = config.badges.links
      .filter((b) => b.url)
      .map(
        (b) =>
          `<a href="${b.url}"><img src="https://img.shields.io/badge/${enc(b.label.replace(/-/g, "--"))}-${b.color}?style=for-the-badge&logo=${b.logo}&logoColor=white" alt="${xml(b.label)}"></a>`,
      );
    if (config.badges.viewsCounter)
      links.push(`<img src="https://komarev.com/ghpvc/?username=${config.username}&style=for-the-badge&color=${config.theme.accent}&label=PROFILE+VIEWS" alt="Profile views">`);
    return `<p align="center">\n  ${links.join("\n  ")}\n</p>`;
  },

  about: () => {
    const pad = Math.max(...config.about.items.map((i) => i.key.length));
    const values = config.about.items.map((i) => `"${i.text}",`);
    const width = Math.max(...values.map((v) => v.length));
    const body = config.about.items.map((i, n) => `  ${(i.key + ":").padEnd(pad + 1)} ${values[n].padEnd(width)} // ${i.emoji}`).join("\n");
    if (config.about.style !== "code") return `## About me\n\n${config.about.items.map((i) => `- ${i.emoji} **${i.key}:** ${i.text}`).join("\n")}`;
    return `## 👨‍💻 About me\n\n\`\`\`ts\nconst kiet = {\n${body}\n} as const;\n\`\`\``;
  },

  stack: () => {
    const base = `https://skillicons.dev/icons?i=${config.stack.icons.join(",")}&perline=${config.stack.perLine}`;
    return `## 🛠️ Tech stack\n\n<p align="center">\n  ${themedImg(`${base}&theme=dark`, `${base}&theme=light`, "Tech stack")}\n</p>`;
  },

  projects: (data) => {
    const card = (p, width) => `<a href="${p.data.url}">${picture(`project-${p.repo}`, p.title ?? p.repo, width)}</a>`;
    const spotlights = data.projects
      .filter((p) => p.highlights?.length)
      .map((p) => {
        const live = p.data.homepageUrl ? ` · [**Live demo →**](${p.data.homepageUrl})` : "";
        return `${card(p, "100%")}\n\n${p.highlights.map((h) => `- ${h}`).join("\n")}\n\n<sub>[Source](${p.data.url})${live}</sub>`;
      });
    const others = data.projects.filter((p) => !p.highlights?.length).map((p) => card(p, "49%"));
    const grid = others.length ? `<p align="center">\n  ${others.join("\n  ")}\n</p>` : "";
    return [`## 🚀 Featured work`, ...spotlights, grid].filter(Boolean).join("\n\n");
  },

  stats: () => {
    const cards = [];
    if (config.stats.overview) cards.push(picture("stats", "GitHub stats", "49%"));
    if (config.stats.languages) cards.push(picture("languages", "Top languages", "49%"));
    return `## 📊 By the numbers\n\n<p align="center">\n  ${cards.join("\n  ")}\n</p>`;
  },

  activity: () => `<p align="center">\n  ${picture("activity", "Contribution activity", "100%")}\n</p>`,

  recent: (data) => {
    const items = data.mergedPrs
      .filter((pr) => !config.recent.exclude.includes(pr.repository.name))
      .sort((a, b) => b.mergedAt.localeCompare(a.mergedAt))
      .slice(0, config.recent.count)
      .map((pr) => {
        const date = new Date(pr.mergedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const [, ticket, rest] = pr.title.match(/^([A-Z]+-\d+)\s+(.*)$/) ?? [null, null, pr.title];
        const label = ticket ? `<code>${ticket}</code> ${xml(rest)}` : xml(rest);
        return `- 🟣 <a href="${pr.url}">${label}</a> <sub>· ${pr.repository.name} · ${date}</sub>`;
      });
    if (!items.length) return "";
    return `## ⚡ ${config.recent.title}\n\n${items.join("\n")}`;
  },

  snake: () =>
    `<p align="center">\n  ${themedImg(assetUrl("snake-dark.svg"), assetUrl("snake-light.svg"), "Snake eating my contribution graph", "100%")}\n</p>`,

  footer: () =>
    `<p align="center"><i>“${xml(config.footer.quote)}”</i></p>\n\n<img src="${capsule("footer", "height=120")}" width="100%" alt="">`,
};

const data = await fetchProfile();
const calendarDays = data.user.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
const stats = {
  contributions: data.user.contributionsCollection.contributionCalendar.totalContributions,
  commits: data.user.contributionsCollection.totalCommitContributions,
  prsMerged: data.user.pullRequests.totalCount,
  reviews: data.user.contributionsCollection.totalPullRequestReviewContributions,
  repos: data.user.repositories.totalCount,
  ...streaks(calendarDays),
};
const langs = topLanguages(data.user.repositories.nodes);
const recentWeeks = data.user.contributionsCollection.contributionCalendar.weeks.slice(-config.activity.weeks).map((w) => w.contributionDays);

await mkdir(distDir, { recursive: true });
for (const theme of ["dark", "light"]) {
  await writeFile(path.join(distDir, `stats-${theme}.svg`), overviewCard(stats, theme));
  await writeFile(path.join(distDir, `languages-${theme}.svg`), languagesCard(langs, theme));
  await writeFile(path.join(distDir, `activity-${theme}.svg`), activityCard(recentWeeks, theme));
  for (const p of data.projects) await writeFile(path.join(distDir, `project-${p.repo}-${theme}.svg`), projectCard(p, theme));
}

const readme = [
  "<!-- Generated by scripts/build-readme.mjs from profile.config.json. Edit the config, not this file. -->",
  ...config.sections.map((s) => sections[s]?.(data)).filter(Boolean),
].join("\n\n");

await writeFile(path.join(root, "README.md"), `${readme}\n`);
console.log(`Wrote README.md and cards to ${path.relative(root, distDir)}/`);
