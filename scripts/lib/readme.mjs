const enc = encodeURIComponent;
const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const heading = (text) => (text ? `## ${text}\n\n` : "");

export function assetBase(config) {
  return `https://raw.githubusercontent.com/${config.username}/${config.username}/${config.assetsBranch}/`;
}

function themedImg(darkUrl, lightUrl, alt, width) {
  // srcset splits candidates on commas, so a raw comma in the URL truncates it.
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${darkUrl.replace(/,/g, "%2C")}"><img alt="${xml(alt)}" src="${lightUrl}"${width ? ` width="${width}"` : ""}></picture>`;
}

function sectionRenderers(config, data) {
  const asset = (file) => assetBase(config) + file;
  const picture = (name, alt, width) => themedImg(asset(`${name}-dark.svg`), asset(`${name}-light.svg`), alt, width);
  const capsule = (section, extra) =>
    `https://capsule-render.vercel.app/api?type=waving&color=0:${config.theme.gradient[0]},100:${config.theme.gradient[1]}&section=${section}&${extra}`;

  return {
    header: () =>
      `<a href="https://github.com/${config.username}"><img src="${capsule(
        "header",
        `height=210&text=${enc(config.name)}&fontSize=68&fontColor=ffffff&fontAlignY=36&desc=${enc(config.tagline)}&descSize=18&descAlignY=58&animation=fadeIn`,
      )}" width="100%" alt="${xml(config.name)}"></a>`,

    typing: () => {
      const { lines } = config.typing;
      if (!lines.length) return "";
      const src = `https://readme-typing-svg.demolab.com?font=${enc(config.theme.font)}&weight=600&size=22&duration=3200&pause=900&color=${config.theme.accent}&center=true&vCenter=true&width=640&lines=${lines.map(enc).join(";")}`;
      return `<p align="center"><img src="${src}" alt="${xml(lines.join(" · "))}"></p>`;
    },

    badges: () => {
      const shieldsText = (s) => enc(s.replace(/-/g, "--").replace(/_/g, "__"));
      const links = config.badges.links
        .filter((b) => b.url)
        .map(
          (b) =>
            `<a href="${xml(b.url)}"><img src="https://img.shields.io/badge/${shieldsText(b.label)}-${b.color}?style=for-the-badge${b.logo ? `&logo=${enc(b.logo)}&logoColor=white` : ""}" alt="${xml(b.label)}"></a>`,
        );
      if (config.badges.viewsCounter)
        links.push(`<img src="https://komarev.com/ghpvc/?username=${config.username}&style=for-the-badge&color=${config.theme.accent}&label=PROFILE+VIEWS" alt="Profile views">`);
      return links.length ? `<p align="center">\n  ${links.join("\n  ")}\n</p>` : "";
    },

    about: () => {
      const { items, style, variable } = config.about;
      if (!items.length) return "";
      if (style === "list") return `${heading(config.headings.about)}${items.map((i) => `- ${[i.emoji, `**${i.key}:**`, i.text].filter(Boolean).join(" ")}`).join("\n")}`;
      const pad = Math.max(...items.map((i) => i.key.length));
      const values = items.map((i) => `${JSON.stringify(i.text)},`);
      const width = Math.max(...values.map((v) => v.length));
      const body = items
        .map((i, n) => `  ${(i.key + ":").padEnd(pad + 1)} ${i.emoji ? `${values[n].padEnd(width)} // ${i.emoji}` : values[n]}`)
        .join("\n");
      return `${heading(config.headings.about)}\`\`\`ts\nconst ${variable} = {\n${body}\n} as const;\n\`\`\``;
    },

    stack: () => {
      if (!config.stack.icons.length) return "";
      const base = `https://skillicons.dev/icons?i=${config.stack.icons.join(",")}&perline=${config.stack.perLine}`;
      return `${heading(config.headings.stack)}<p align="center">\n  ${themedImg(`${base}&theme=dark`, `${base}&theme=light`, "Tech stack")}\n</p>`;
    },

    projects: () => {
      if (!data.projects.length) return "";
      const card = (p, width) => `<a href="${p.data.url}">${picture(`project-${p.repo}`, p.title ?? p.repo, width)}</a>`;
      const spotlights = data.projects
        .filter((p) => p.highlights?.length)
        .map((p) => {
          const live = p.data.homepageUrl ? ` · [**Live demo →**](${p.data.homepageUrl})` : "";
          return `${card(p, "100%")}\n\n${p.highlights.map((h) => `- ${h}`).join("\n")}\n\n<sub>[Source](${p.data.url})${live}</sub>`;
        });
      const others = data.projects.filter((p) => !p.highlights?.length).map((p) => card(p, "49%"));
      const grid = others.length ? `<p align="center">\n  ${others.join("\n  ")}\n</p>` : "";
      return `${heading(config.headings.projects)}${[...spotlights, grid].filter(Boolean).join("\n\n")}`;
    },

    stats: () => {
      const cards = [];
      if (config.stats.overview) cards.push(picture("stats", "GitHub stats", "49%"));
      if (config.stats.languages) cards.push(picture("languages", "Top languages", "49%"));
      return cards.length ? `${heading(config.headings.stats)}<p align="center">\n  ${cards.join("\n  ")}\n</p>` : "";
    },

    activity: () => `<p align="center">\n  ${picture("activity", "Contribution activity", "100%")}\n</p>`,

    recent: () => {
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
      return items.length ? `${heading(config.headings.recent)}${items.join("\n")}` : "";
    },

    snake: () =>
      `<p align="center">\n  ${themedImg(asset("snake-dark.svg"), asset("snake-light.svg"), "Snake eating my contribution graph", "100%")}\n</p>`,

    footer: () => {
      const quote = config.footer.quote ? `<p align="center"><i>“${xml(config.footer.quote)}”</i></p>\n\n` : "";
      const credit = config.footer.credit ? `<div align="center">\n\n<sub>${config.footer.credit}</sub>\n\n</div>\n\n` : "";
      return `${quote}${credit}<img src="${capsule("footer", "height=120")}" width="100%" alt="">`;
    },
  };
}

export function renderReadme(config, data) {
  const renderers = sectionRenderers(config, data);
  const blocks = config.sections.map((s) => (typeof s === "string" ? renderers[s]() : `${heading(s.heading)}${s.markdown}`));
  return [
    "<!-- Generated by scripts/build-readme.mjs from profile.config.json. Edit the config, not this file. -->",
    ...blocks.filter(Boolean),
  ].join("\n\n") + "\n";
}
