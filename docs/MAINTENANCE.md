# プロフィールの保守

プロフィール表示の正本は、公開リポジトリ `sponge841841/sponge841841` の `main` ブランチ直下の `README.md` です。製品のソースコードや非公開データは、このリポジトリには置きません。

## 自動更新

| 機能 | ワークフロー | 毎日の予定時刻（日本時間） | 更新先 |
| --- | --- | --- | --- |
| 技術記事の最新3件 | `.github/workflows/articles.yml` | 11:27 | `main` の README の記事欄のみ |
| Snakeアニメーション | `.github/workflows/snake.yml` | 10:43 | `output` ブランチのSVG2枚 |

スケジュールはUTCで設定しています。GitHubの混雑等で遅延する場合があります。両方ともActions画面の「Run workflow」から手動実行できます。

技術記事は `https://chicchi.work/articles/rss.xml` の並びから最大3件を取得します。日次ニュースのRSSは使用しません。取得失敗・記事ゼロ・更新マーカー異常ではエラー終了し、既存の記事一覧を残します。

記事欄の前後にある `SELECTED-ARTICLES:START` / `SELECTED-ARTICLES:END` コメントは削除しないでください。コメントの外側はスクリプトによって書き換えません。

## テスト

```bash
node --test scripts/update-articles.test.mjs
```

`node` はJavaScriptを実行するプログラム、`--test` は標準のテスト機能で実行する指定、末尾はテストファイルです。Node.js 22を使用します。外部通信なしで8件を検証します。

```bash
node scripts/update-articles.mjs
```

公開RSSを実際に取得し、現在のディレクトリの `README.md` の記事欄を更新します。GitHubへのコミットやpushは、このコマンド単体では行いません。

## 失敗時の確認

Actionsの該当実行を開き、失敗したステップのログを確認します。RSS更新はサイトの応答と記事URL、SnakeはGitHub API取得とoutputへの書き込みを確認します。公開リポジトリで60日間活動がない場合、GitHubが定期実行を無効化することがあります。

## セキュリティ

外部ActionはコミットSHAで固定しています。更新時は上流の変更を確認してSHAを差し替えます。定期処理はリポジトリ標準の `GITHUB_TOKEN` と `contents: write` を使用し、個人用アクセストークンやAIのAPIキーは不要です。記事取得自体に認証情報は渡しません。README更新のpushはforceを使いません。

## 公式資料

- https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://docs.github.com/en/actions/concepts/security/github_token
- https://github.com/Platane/snk
