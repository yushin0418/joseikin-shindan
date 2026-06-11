# PDF用 日本語フォントの配置

PDFKit の標準フォント（Helvetica）は日本語を描画できません。
このフォルダに **Noto Sans JP の TTF** を配置してください。

## 取得方法

1. https://fonts.google.com/noto/specimen/Noto+Sans+JP から「Download family」
2. 展開して `NotoSansJP-Regular.ttf`（static 版）を本フォルダに置く
   - 末尾が `.ttf` であること（可変フォント `.otf` の場合も `PDF_FONT_PATH` を合わせれば可）

最終パス例：

```
assets/fonts/NotoSansJP-Regular.ttf
```

`.env` の `PDF_FONT_PATH` がこのパスを指していれば、PDF に日本語が正しく描画されます。
未配置の場合、PDF生成は Helvetica にフォールバックし、日本語は文字化けします（処理自体は継続）。
