# IRIAMボーダー予測

IRIAM のランクボーダーを、今日から 1 週間先まで予測するサイトです。
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

データを差し替えなくても、ブラウザが 0 時 0 分 1 秒に「今日 / 明日 / 明後日」の日付表示だけは自動で切り替えます。
ただし数値は更新されないので、`forecast.json` が 2 日以上古くなると、画面に更新が止まっている旨の警告が出ます。

## データ提供

ボーダーの数値は [なまずつーるず ボーダー集計](https://namazu-tools.net/border-guardian/) に登録されたデータを利用しています。
本サイトは IRIAM 公式のものではありません。

&copy; はなだツール
