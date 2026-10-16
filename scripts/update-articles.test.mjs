import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArticles, updateReadme, START, END } from './update-articles.mjs';

const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item><title>記事A &amp; B</title><link>https://chicchi.work/articles/2026-10-10-testing/</link></item>
  <item><title>危険な外部リンク</title><link>https://evil.example/articles/2026-10-10-other/</link></item>
  <item><title>ニュース</title><link>https://chicchi.work/news/2026-10-10/</link></item>
  <item><title>記事C <![CDATA[<memo>]]></title><link>https://chicchi.work/articles/2026-10-08-testing/</link></item>
  <item><title>重複記事</title><link>https://chicchi.work/articles/2026-10-10-testing/</link></item>
</channel></rss>`;

test('技術記事のみ抽出し、外部URLと重複を除外する', () => {
  const posts = parseArticles(xml);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, '記事A &amp; B');
  assert.equal(posts[1].link, 'https://chicchi.work/articles/2026-10-08-testing/');
});

test('READMEの指定領域以外を変更しない', () => {
  const original = `# プロフィール\n\n${START}\n- 古い記事\n${END}\n\n## 開発作品\n作品の説明`;
  const changed = updateReadme(original, parseArticles(xml));
  assert.match(changed, /\[記事A &amp; B\]/);
  assert.match(changed, /## 開発作品\n作品の説明$/);
  assert.doesNotMatch(changed, /古い記事/);
});

test('フォーマット不正のfeedは拒否する', () => {
  assert.throws(() => parseArticles('<html>error</html>'));
  assert.throws(() => parseArticles('<rss><channel></channel></rss>'));
});

test('更新位置の重複や欠落があるREADMEを拒否する', () => {
  assert.throws(() => updateReadme(`${START}${START}${END}`, [{title:'A',link:'https://chicchi.work/articles/a/'}]));
  assert.throws(() => updateReadme('READMEのみ', [{title:'A',link:'https://chicchi.work/articles/a/'}]));
});

function feed(items) { return `<rss><channel>${items}</channel></rss>`; }
function item(title, link) { return `<item><title>${title}</title><link>${link}</link></item>`; }

test('最新の並びを維持して最大3件まで掲載する', () => {
  const posts = parseArticles(feed([1, 2, 3, 4, 5].map(n => item(`記事${n}`, `https://chicchi.work/articles/post-${n}/`)).join('')));
  assert.equal(posts.length, 3);
  assert.equal(posts[2].link, 'https://chicchi.work/articles/post-3/');
});

test('HTMLタグとMarkdown記法をタイトルとして安全に表示する', () => {
  const [post] = parseArticles(feed(item('&lt;img src=x&gt; [test]', 'https://chicchi.work/articles/safe/')));
  assert.equal(post.title, String.raw`&lt;img src=x&gt; \[test\]`);
  assert.doesNotMatch(post.title, /<img/);
});

test('認証情報・外部ポート・クエリ・ニュースのURLを拒否する', () => {
  for (const link of ['http://chicchi.work/articles/a/', 'https://user@chicchi.work/articles/a/', 'https://chicchi.work:444/articles/a/', 'https://chicchi.work/articles/a/?q=1', 'https://chicchi.work/news/a/']) {
    assert.throws(() => parseArticles(feed(item('無効', link))));
  }
});

test('空の記事一覧で既存記事を消さない', () => {
  assert.throws(() => updateReadme(`${START}既存記事${END}`, []));
});
