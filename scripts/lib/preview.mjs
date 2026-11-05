export function previewPage(renderedHtml, assetBase, username, localFiles) {
  const body = localFiles.reduce((html, file) => html.replaceAll(assetBase + file, `./${file}`), renderedHtml);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Profile preview</title>
<link id="md-css" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown-light.min.css">
<style>
  :root { --bg: #ffffff; --bar: #f6f8fa; --line: #d0d7de; --ink: #1f2328; }
  :root[data-theme="dark"] { --bg: #0d1117; --bar: #161b22; --line: #30363d; --ink: #e6edf3; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px -apple-system, "Segoe UI", sans-serif; }
  header { position: sticky; top: 0; z-index: 1; display: flex; gap: 12px; align-items: center; justify-content: space-between;
    padding: 10px 16px; background: var(--bar); border-bottom: 1px solid var(--line); }
  button { font: inherit; color: inherit; background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 5px 12px; cursor: pointer; }
  .markdown-body { box-sizing: border-box; max-width: 878px; margin: 24px auto; padding: 24px; border: 1px solid var(--line); border-radius: 6px; }
  @media (max-width: 767px) { .markdown-body { margin: 0; padding: 16px; border: 0; } }
</style>
</head>
<body>
<header><span>Preview of <b>${username}/README.md</b>, rendered by the GitHub API. Cards load from dist/; the snake comes from the live output branch once the Action has run.</span><button id="toggle" type="button">Switch theme</button></header>
<article class="markdown-body">${body}</article>
<script>
  const pictures = [...document.querySelectorAll("picture")].map((p) => ({
    img: p.querySelector("img"),
    light: p.querySelector("img").getAttribute("src"),
    dark: p.querySelector("source")?.getAttribute("srcset"),
  }));
  document.querySelectorAll("picture source").forEach((s) => s.remove());
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    document.getElementById("md-css").href = "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown-" + theme + ".min.css";
    for (const p of pictures) p.img.src = theme === "dark" && p.dark ? p.dark : p.light;
  }
  let theme = new URLSearchParams(location.search).get("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  apply(theme);
  document.getElementById("toggle").onclick = () => apply((theme = theme === "dark" ? "light" : "dark"));
</script>
</body>
</html>
`;
}
