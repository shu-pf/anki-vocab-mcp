# anki-vocab-mcp

[English](./README.md) | **日本語**

英単語を Anki カードとして自動生成する MCP サーバー。単語音声を Azure TTS、例文音声を ElevenLabs で生成し、AnkiConnect 経由でカードを追加します。

## 特長

- MCP の 1 ツール `create_anki_card(word, meaning, example, deck?)` でカード作成が完結
- 単語音声: Azure TTS (`en-US-SteffanNeural`, `rate=slow`) で MP3
- 例文音声: ElevenLabs (`eleven_turbo_v2_5`) で MP3
- カード形式:
  - 表: 単語 + 単語音声
  - 裏: 日本語訳 + 例文 (イタリック) + 例文音声

## 必要なもの

- [Bun](https://bun.sh/) 1.3 以降
- [Anki](https://apps.ankiweb.net/) + [AnkiConnect](https://ankiweb.net/shared/info/2055492159) アドオン (`http://localhost:8765` で待ち受け)
- Azure Speech Services の API キー
- ElevenLabs の API キー

## 環境変数

プロジェクトルートの `.env` に以下を記述します (起動時に `<repo>/.env` から読み込まれます)。`.env.example` をコピーして使うのが楽です。

```env
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=japaneast
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=cjVigY5qzO86Huf0OWal
```

オプション:

| 変数 | デフォルト | 説明 |
| --- | --- | --- |
| `ANKI_PROFILE` | `User 1` | Anki のプロファイル名 |
| `ANKI_DECK` | `英語学習` | 既定のデッキ名 |
| `AZURE_VOICE` | `en-US-SteffanNeural` | Azure TTS の voice |

## セットアップ

```bash
git clone https://github.com/shu-pf/anki-vocab-mcp.git
cd anki-vocab-mcp
bun install
cp .env.example .env   # 値を埋める
```

## Claude Desktop での設定例

`claude_desktop_config.json` に追加:

```json
{
  "mcpServers": {
    "anki-vocab": {
      "command": "bun",
      "args": ["/absolute/path/to/anki-vocab-mcp/src/index.ts"]
    }
  }
}
```

もしくは bunx で直接 (グローバルインストール不要):

```json
{
  "mcpServers": {
    "anki-vocab": {
      "command": "bunx",
      "args": ["github:shu-pf/anki-vocab-mcp"]
    }
  }
}
```

## Claude Code での設定例

### 1. MCP サーバーを登録

```bash
claude mcp add -s user anki-vocab -- bun /absolute/path/to/anki-vocab-mcp/src/index.ts
```

`bun` が PATH に無い環境 (GUI ランチャーなど) では絶対パスでの指定を推奨します。確認は `claude mcp list` で `anki-vocab: ... - ✓ Connected` が出ればOK。

### 2. (任意) スラッシュコマンドを用意

`~/.claude/commands/anki.md` に以下を保存すると `/anki <英単語>` 1発でカード作成までできます。意味と例文は Claude が推論して埋めます。

```markdown
---
description: 英単語を Anki カードとして自動生成する (意味と例文は推論)
argument-hint: <英単語>
allowed-tools: mcp__anki-vocab__create_anki_card
---

英単語「$ARGUMENTS」を Anki カードとして追加します。

手順:
1. 与えられた単語の最も一般的な日本語訳を簡潔に1つ考える
2. その単語の用法が分かる、自然で実用的な英語例文を1つ作る (10〜20語程度)
3. MCP ツール `create_anki_card` を呼び出してカードを追加する
   - `word`: $ARGUMENTS
   - `meaning`: 手順1で考えた日本語訳
   - `example`: 手順2で考えた例文
4. 結果 (Note ID を含む) を1〜2行で報告する
```

使用例: `/anki ephemeral`

## 開発

```bash
bun --watch src/index.ts   # ウォッチ起動
bun run typecheck          # 型チェック
```

## ライセンス

MIT
