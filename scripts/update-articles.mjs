/**
 * Update only the selected-articles region of the GitHub profile README.
 * No dependencies and no GitHub token required for fetching the public RSS.
 * Invalid/failed feed responses never overwrite the existing article list.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const START = '<!-- SELECTED-ARTICLES:START -->';
export const END = '<!-- SELECTED-ARTICLES:END -->';
export const FEED_URL = 'https://chicchi.work/articles/rss.xml';

function xmlText(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(?:amp|lt|gt|quot|apos|#(?:x[\da-fA-F]+|\d+));/g, (token) => {
      const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
      if (Object.hasOwn(named, token)) return named[token];
      try {
        const value = token[2].toLowerCase() === 'x'
          ? Number.parseInt(token.slice(3, -1), 16)
          : Number.parseInt(token.slice(2, -1), 10);
        return Number.isInteger(value) && value > 0 && value <= 0x10FFFF
          ? String.fromCodePoint(value) : '';
      } catch {
        return '';
      }
    })
    .trim();
}

function getTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
  return match ? xmlText(match[1]) : '';
}

function isArticleUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'chicchi.work'
      && url.username === '' && url.password === ''
      && url.port === '' && url.search === '' && url.hash === ''
      && /^\/articles\/[a-z0-9][a-z0-9_-]*\/$/.test(url.pathname);
  } catch {
    return false;
  }
}

function safeTitle(raw) {
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().slice(0, 130)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+.!|>~]/g, '\\$&');
}

export function parseArticles(xml) {
  if (!/<rss(?:\s|>)/i.test(xml)) {
    throw new Error('RSS形式の文書を受信できませんでした。');
  }
  const entries = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi)]
    .map((match) => match[1]);
  if (entries.length === 0) throw new Error('RSSのitemが見つかりません。');
  const seen = new Set();
  const articles = [];
  for (const item of entries) {
    const title = safeTitle(getTag(item, 'title'));
    const link = getTag(item, 'link');
    if (!title || !isArticleUrl(link) || seen.has(link)) continue;
    seen.add(link);
    articles.push({ title, link });
    if (articles.length === 3) break;
  }
  if (articles.length === 0) {
    throw new Error('公開技術記事を取得できませんでした。READMEは変更しません。');
  }
  return articles;
}

export function updateReadme(readme, articles) {
  if (!Array.isArray(articles) || articles.length === 0 || articles.some(({ title, link }) => !title || !isArticleUrl(link))) {
    throw new Error('更新する記事一覧が不正です。');
  }
  const first = readme.indexOf(START);
  const last = readme.indexOf(END);
  if (first === -1 || last === -1 || first >= last ||
      readme.indexOf(START, first + 1) !== -1 || readme.indexOf(END, last + 1) !== -1) {
    throw new Error('READMEの更新マーカーが不正です。');
  }
  const lines = articles.map(({ title, link }) => `- [${title}](${link})`).join('\n');
  return readme.slice(0, first + START.length) + '\n' + lines + '\n' + readme.slice(last);
}

async function main() {
  const url = process.env.ARTICLES_RSS_URL ?? FEED_URL;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'sponge841841-profile-readme/1.0' } });
  if (!response.ok) throw new Error(`RSSの取得に失敗しました: HTTP ${response.status}`);
  const xml = await response.text();
  const posts = parseArticles(xml);
  const readmePath = resolve(process.cwd(), 'README.md');
  const oldReadme = await readFile(readmePath, 'utf8');
  const nextReadme = updateReadme(oldReadme, posts);
  if (nextReadme !== oldReadme) {
    await writeFile(readmePath, nextReadme, 'utf8');
    process.stdout.write(`READMEを更新しました (${posts.length}件)\n`);
  } else {
    process.stdout.write('記事に変更はありません。\n');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`技術記事の更新を中止しました: ${error.message}`);
    process.exitCode = 1;
  });
}
