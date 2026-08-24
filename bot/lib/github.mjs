/**
 * The website's storage. The bot reads and writes the same two data files the
 * admin page uses, so a change made by message and a change made in a browser
 * are the same kind of change: a commit.
 */
const API = 'https://api.github.com';

async function gh(cfg, path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${cfg.github.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j.message) detail = j.message; } catch {}
    if (res.status === 401) detail = 'GitHub rejected the token. Check it in setup.';
    if (res.status === 403) detail = 'The token cannot write to the repo. It needs Contents: Read and write.';
    if (res.status === 409) detail = 'Someone edited at the same time. Try again.';
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

export async function readJson(cfg, path) {
  const file = await gh(cfg, `/repos/${cfg.github.repo}/contents/${path}?ref=${cfg.github.branch}`);
  const text = Buffer.from(file.content, 'base64').toString('utf8');
  return { data: JSON.parse(text), sha: file.sha };
}

export async function writeJson(cfg, path, data, sha, message) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64'),
    branch: cfg.github.branch,
  };
  if (sha) body.sha = sha;
  const res = await gh(cfg, `/repos/${cfg.github.repo}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.content.sha;
}

export async function writeBinary(cfg, path, buffer, message) {
  await gh(cfg, `/repos/${cfg.github.repo}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(buffer).toString('base64'),
      branch: cfg.github.branch,
    }),
  });
  return path;
}

/** Read, mutate, write. Retries once on a concurrent-edit conflict. */
export async function update(cfg, path, mutate, message) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, sha } = await readJson(cfg, path);
    const result = mutate(structuredClone(data));
    if (result === false) return null;          // mutate decided nothing to do
    result.updated = new Date().toISOString();
    try {
      await writeJson(cfg, path, result, sha, message);
      return result;
    } catch (err) {
      if (!/same time/i.test(err.message) || attempt === 1) throw err;
    }
  }
}
