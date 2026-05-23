#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { join } from "node:path";
import { homedir } from "node:os";

async function loadEnvFile(path: string): Promise<void> {
  const text = await Bun.file(path).text().catch(() => "");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

await loadEnvFile(join(import.meta.dir, "..", ".env"));

const ANKI_PROFILE = process.env.ANKI_PROFILE ?? "User 1";
const ANKI_MEDIA_DIR = join(
  homedir(),
  "Library",
  "Application Support",
  "Anki2",
  ANKI_PROFILE,
  "collection.media",
);
const ANKI_CONNECT_URL = "http://localhost:8765";
const DEFAULT_DECK = process.env.ANKI_DECK ?? "English Vocabulary";

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY ?? "";
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION ?? "japaneast";
const AZURE_VOICE = process.env.AZURE_VOICE ?? "en-US-SteffanNeural";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? "";
const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID ?? "cjVigY5qzO86Huf0OWal";

async function getAzureToken(): Promise<string> {
  const res = await fetch(
    `https://${AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
    {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY },
    },
  );
  if (!res.ok) throw new Error(`Azure token: ${res.status} ${await res.text()}`);
  return res.text();
}

async function generateWordAudio(word: string): Promise<string> {
  const safe = word.toLowerCase().replace(/\s+/g, "_");
  const filename = `word_${safe}.mp3`;
  const filepath = join(ANKI_MEDIA_DIR, filename);

  const token = await getAzureToken();
  const ssml = `<speak version='1.0' xml:lang='en-US'>
    <voice name='${AZURE_VOICE}'>
      <prosody rate='slow'>${word}</prosody>
    </voice>
  </speak>`;

  const res = await fetch(
    `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "AnkiVocabMCP",
      },
      body: ssml,
    },
  );
  if (!res.ok) throw new Error(`Azure TTS: ${res.status} ${await res.text()}`);

  await Bun.write(filepath, await res.arrayBuffer());
  return filename;
}

async function generateSentenceAudio(
  sentence: string,
  word: string,
): Promise<string> {
  const safe = word.toLowerCase().replace(/\s+/g, "_");
  const hash = new Bun.CryptoHasher("md5")
    .update(sentence)
    .digest("hex")
    .slice(0, 8);
  const vid = ELEVENLABS_VOICE_ID.slice(0, 8);
  const filename = `sentence_${safe}_${vid}_${hash}.mp3`;
  const filepath = join(ANKI_MEDIA_DIR, filename);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: sentence,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );
  if (!res.ok)
    throw new Error(`ElevenLabs: ${res.status} ${await res.text()}`);

  await Bun.write(filepath, await res.arrayBuffer());
  return filename;
}

async function addAnkiCard(
  word: string,
  meaning: string,
  example: string,
  wordAudio: string,
  sentenceAudio: string,
  deck: string,
): Promise<number> {
  const note = {
    deckName: deck,
    modelName: "Basic",
    fields: {
      Front: `${word}<br>[sound:${wordAudio}]`,
      Back: `${meaning}<br><br><i>${example}</i><br>[sound:${sentenceAudio}]`,
    },
    tags: ["english-vocab"],
  };

  const res = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addNote", version: 6, params: { note } }),
  });
  if (!res.ok) throw new Error(`AnkiConnect: ${res.status} ${await res.text()}`);

  const json = (await res.json()) as { result: number; error: string | null };
  if (json.error) throw new Error(`AnkiConnect: ${json.error}`);
  return json.result;
}

const server = new Server(
  { name: "anki-vocab-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_anki_card",
      description:
        "英単語のAnkiカードを作成します。単語音声(Azure TTS)と例文音声(ElevenLabs)を自動生成します。",
      inputSchema: {
        type: "object",
        properties: {
          word: { type: "string", description: "英単語" },
          meaning: { type: "string", description: "日本語の意味" },
          example: { type: "string", description: "英語の例文" },
          deck: {
            type: "string",
            description: `デッキ名 (デフォルト: ${DEFAULT_DECK})`,
          },
        },
        required: ["word", "meaning", "example"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== "create_anki_card") {
    throw new Error(`Unknown tool: ${req.params.name}`);
  }

  const { word, meaning, example, deck = DEFAULT_DECK } = req.params
    .arguments as {
    word: string;
    meaning: string;
    example: string;
    deck?: string;
  };

  const wordAudio = await generateWordAudio(word);
  const sentenceAudio = await generateSentenceAudio(example, word);
  const noteId = await addAnkiCard(
    word,
    meaning,
    example,
    wordAudio,
    sentenceAudio,
    deck,
  );

  return {
    content: [
      {
        type: "text",
        text: `✓ カード作成完了\n単語: ${word}\n音声: ${wordAudio}, ${sentenceAudio}\nNote ID: ${noteId}`,
      },
    ],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
