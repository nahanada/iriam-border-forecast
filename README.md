# IRIAMボーダー予測

IRIAM のランクボーダー (ランク × 上昇幅 +2/+4/+6) を、今日から 1 週間先まで予測するサイトです。
公開URL: https://nahanada.github.io/iriam-border-forecast/

ビルド不要の静的サイトです (HTML / CSS / JavaScript のみ)。GitHub Pages で、このリポジトリの内容をそのまま公開しています。

## 構成

```
├── index.html              # 本体 (OGP / Twitter Card / favicon / manifest の設定もここ)
├── manifest.webmanifest    # PWA 設定
├── robots.txt / sitemap.xml
├── .nojekyll               # GitHub Pages で Jekyll 処理を無効にする
├── assets/
│   ├── app.js              # 表示ロジック (予測ページ・精度ページ・日付の自動更新)
│   ├── style.css
│   └── Kame-Shiro-Noir.jpg # アイコン兼 OGP 画像 (favicon / apple-touch-icon / manifest / og:image)
└── data/
    └── forecast.json       # 予測データ (表示する数値はすべてここから読み込む)
```

## データの更新

予測データ `data/forecast.json` は、このリポジトリの外で作ります。このリポジトリには、予測を作る処理は含まれていません。
更新するときは、`data/forecast.json` を差し替えてコミットし、`main` に push します。GitHub Pages が自動で再公開します。

データを差し替えなくても、ブラウザが 0 時 0 分 1 秒に「今日 / 明日 / 明後日」の日付表示だけは自動で切り替えます。
ただし数値は更新されないので、`forecast.json` が 2 日以上古くなると、画面に更新が止まっている旨の警告が出ます。

## ローカルで確認する

```bash
python -m http.server 8123
```

http://localhost:8123 を開きます。

## 動作の要点

- **選択の記憶**: 最後に選んだランクと上昇幅を `localStorage` に保存し、次回開いたときに復元します。`#S3+2` のように URL で指定した場合はそちらを優先します。
- **ページ指定**: `?page=1` で精度ページを直接開けます。
- **解析**: Google Analytics と Cloudflare Web Analytics を `index.html` で読み込んでいます。

## 注意

`index.html` の `canonical` / `og:url` / `og:image` / `twitter:image` と、`robots.txt` / `sitemap.xml` に、公開URLを直接書いています。
リポジトリ名や GitHub ユーザー名を変えたときは、すべて直してください。

## データ提供

ボーダーの数値は [なまずつーるず ボーダー集計](https://namazu-tools.net/border-guardian/) に登録されたデータを利用しています。
本サイトは IRIAM 公式のものではありません。

&copy; はなだツール
