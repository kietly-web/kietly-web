async function graphql(token, query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-readme-builder" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (res.status === 401) throw new Error("GITHUB_TOKEN was rejected. Locally, run with GITHUB_TOKEN=$(gh auth token).");
  if (!res.ok || (body.errors && !body.data)) throw new Error(`GitHub GraphQL failed: ${JSON.stringify(body.errors ?? body)}`);
  return body.data;
}

export async function fetchProfile(config, token) {
  const projectFields = config.projects
    .map(
      (p, i) => `p${i}: repository(owner: $login, name: ${JSON.stringify(p.repo)}) {
        name description url homepageUrl stargazerCount forkCount isPrivate
        primaryLanguage { name color }
        pullRequests(states: MERGED) { totalCount }
        defaultBranchRef { target { ... on Commit { history { totalCount } } } }
      }`,
    )
    .join("\n");

  const data = await graphql(
    token,
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

  if (!data.user) throw new Error(`No GitHub user named "${config.username}". Check username in profile.config.json.`);
  const missing = config.projects.filter((p, i) => !data[`p${i}`] || data[`p${i}`].isPrivate).map((p) => p.repo);
  if (missing.length) throw new Error(`projects: ${missing.join(", ")} not found as public repos under ${config.username}.`);

  return {
    user: data.user,
    projects: config.projects.map((p, i) => ({ ...p, data: data[`p${i}`] })),
    mergedPrs: data.search.nodes.filter((n) => n?.mergedAt),
  };
}

export async function renderMarkdown(token, markdown, context) {
  const res = await fetch("https://api.github.com/markdown", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-readme-builder" },
    body: JSON.stringify({ text: markdown, mode: "gfm", context }),
  });
  if (!res.ok) throw new Error(`GitHub markdown render failed: ${res.status} ${await res.text()}`);
  return res.text();
}
