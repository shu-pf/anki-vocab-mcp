# anki-vocab-mcp

**English** | [日本語](./README.ja.md)

MCP server that turns an English word into a fully-formed Anki card on the fly: Azure TTS for the word audio, ElevenLabs for the example sentence audio, and AnkiConnect to add the card.

## Features

- A single MCP tool, `create_anki_card(word, meaning, example, deck?)`, handles the whole flow
- Word audio: Azure TTS (`en-US-SteffanNeural`, `rate=slow`) as MP3
- Sentence audio: ElevenLabs (`eleven_turbo_v2_5`) as MP3
- Card layout:
  - Front: word + word audio
  - Back: Japanese meaning + example sentence (italic) + sentence audio

## Requirements

- [Bun](https://bun.sh/) 1.3+
- [Anki](https://apps.ankiweb.net/) with the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on (listening on `http://localhost:8765`)
- An Azure Speech Services API key
- An ElevenLabs API key

## Environment variables

Place a `.env` at the project root (it is loaded from `<repo>/.env` at startup). The easiest path is to copy `.env.example`.

```env
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=japaneast
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=cjVigY5qzO86Huf0OWal
```

Optional:

| Variable | Default | Description |
| --- | --- | --- |
| `ANKI_PROFILE` | `User 1` | Anki profile name |
| `ANKI_DECK` | `English Vocabulary` | Default deck name |
| `AZURE_VOICE` | `en-US-SteffanNeural` | Azure TTS voice |

## Setup

```bash
git clone https://github.com/shu-pf/anki-vocab-mcp.git
cd anki-vocab-mcp
bun install
cp .env.example .env   # fill in the values
```

## Claude Desktop example

Add to `claude_desktop_config.json`:

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

Or run it straight from GitHub via `bunx` (no global install needed):

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

## Claude Code example

### 1. Register the MCP server

```bash
claude mcp add -s user anki-vocab -- bun /absolute/path/to/anki-vocab-mcp/src/index.ts
```

Prefer absolute paths for `bun` when launching from a GUI runner that doesn't inherit your shell PATH. Confirm with `claude mcp list` — you should see `anki-vocab: ... - ✓ Connected`.

### 2. (Optional) Slash command

Save the following to `~/.claude/commands/anki.md` and you can create a card with `/anki <word>`. The meaning and example sentence are inferred by Claude.

```markdown
---
description: Generate an Anki card from an English word (meaning & example are inferred)
argument-hint: <english word>
allowed-tools: mcp__anki-vocab__create_anki_card
---

Add the English word "$ARGUMENTS" as an Anki card.

Steps:
1. Pick the most common Japanese translation (concise, one entry)
2. Compose a natural, practical English example sentence (about 10–20 words)
3. Call the `create_anki_card` MCP tool with:
   - `word`: $ARGUMENTS
   - `meaning`: the translation from step 1
   - `example`: the sentence from step 2
4. Report the result (including the Note ID) in 1–2 lines
```

Usage: `/anki ephemeral`

## Development

```bash
bun --watch src/index.ts   # watch mode
bun run typecheck          # type-check
```

## License

MIT
