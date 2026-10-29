// Kaksha server: serves the built site from dist/ and answers doubts at POST /api/doubt.
// Run with: GEMINI_API_KEY=... node server/index.ts   (Node 22.18+ runs TypeScript directly)
// The tutor uses Google Gemini when GEMINI_API_KEY is set, or Claude when ANTHROPIC_API_KEY is set.

import Anthropic from '@anthropic-ai/sdk';
import { ApiError, FinishReason, GoogleGenAI, type Content } from '@google/genai';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { systemPrompt, type TutorTurn } from '../src/lib/tutorPrompt.ts';

const PORT = Number(process.env.PORT ?? 8787);
const DOUBTS_PER_HOUR = Number(process.env.DOUBTS_PER_HOUR ?? 30);
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const PROVIDER: 'gemini' | 'claude' | null =
  process.env.TUTOR_PROVIDER === 'claude' || process.env.TUTOR_PROVIDER === 'gemini'
    ? process.env.TUTOR_PROVIDER
    : process.env.GEMINI_API_KEY
      ? 'gemini'
      : process.env.ANTHROPIC_API_KEY
        ? 'claude'
        : null;
const MODEL = process.env.KAKSHA_MODEL ?? (PROVIDER === 'claude' ? 'claude-opus-5-5' : 'gemini-flash-latest');

const gemini = PROVIDER === 'gemini' ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const claude = PROVIDER === 'claude' ? new Anthropic() : null;

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

interface DoubtRequest {
  exam: string;
  grade: string;
  subject: string;
  chapter: string | null;
  turns: TutorTurn[];
  images: { mediaType: MediaType; data: string }[];
}

const EXAMS = ['JEE Main', 'JEE Advanced', 'NEET UG'];
const GRADES = ['Class 11', 'Class 12', 'Passed Class 12 (dropper)'];
const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

/** Checks the body field by field so nothing unexpected reaches the prompt. */
function parseRequest(body: unknown): DoubtRequest | string {
  const b = body as Partial<DoubtRequest>;
  if (!b || typeof b !== 'object') return 'Request body must be JSON.';
  if (!EXAMS.includes(String(b.exam)) || !GRADES.includes(String(b.grade)) || !SUBJECTS.includes(String(b.subject))) {
    return 'Unknown exam, class or subject.';
  }
  if (b.chapter !== null && (typeof b.chapter !== 'string' || b.chapter.length > 80)) return 'Chapter name is invalid.';
  if (!Array.isArray(b.turns) || b.turns.length === 0 || b.turns.length > 30) return 'A doubt needs between 1 and 30 messages.';
  for (const [i, t] of b.turns.entries()) {
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (!t || t.role !== expected || typeof t.text !== 'string' || !t.text.trim() || t.text.length > 20_000) {
      return 'Messages must alternate between student and tutor, starting with the student.';
    }
  }
  if (b.turns[b.turns.length - 1].role !== 'user') return 'The last message must be from the student.';
  const images = b.images ?? [];
  if (!Array.isArray(images) || images.length > 3) return 'Attach at most 3 photos.';
  for (const img of images) {
    if (!MEDIA_TYPES.includes(img?.mediaType) || typeof img.data !== 'string' || img.data.length > 3_000_000) {
      return 'Each photo must be a JPEG, PNG, WebP or GIF under about 2 MB.';
    }
  }
  return { exam: b.exam!, grade: b.grade!, subject: b.subject!, chapter: b.chapter ?? null, turns: b.turns, images };
}

// Simple per-IP limit so one visitor cannot run up the API bill.
const recent = new Map<string, number[]>();
function allow(ip: string): boolean {
  const hourAgo = Date.now() - 3_600_000;
  const times = (recent.get(ip) ?? []).filter((t) => t > hourAgo);
  if (times.length >= DOUBTS_PER_HOUR) return false;
  times.push(Date.now());
  recent.set(ip, times);
  return true;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 10_000_000) throw new Error('too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendError(res: ServerResponse, status: number, message: string) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

async function handleDoubt(req: IncomingMessage, res: ServerResponse) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return sendError(res, 400, 'Could not read the request. Photos may be too large.');
  }
  const parsed = parseRequest(body);
  if (typeof parsed === 'string') return sendError(res, 400, parsed);
  if (!allow(ip)) return sendError(res, 429, `You have asked ${DOUBTS_PER_HOUR} doubts in the last hour. Take a short break and try again later.`);

  if (!PROVIDER) return sendError(res, 503, 'The doubt tutor is not set up on this website yet (no API key on the server).');

  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
  let wrote = false;
  const write = (text: string) => {
    wrote = true;
    res.write(text);
  };
  try {
    const note = PROVIDER === 'gemini' ? await answerWithGemini(parsed, write) : await answerWithClaude(parsed, write);
    if (note) res.write(wrote ? `\n\n[${note}]` : note);
  } catch (err) {
    console.error('doubt failed:', err);
    const message = describeError(err);
    res.write(wrote ? `\n\n[${message}]` : `[${message}]`);
  }
  res.end();
}

const CUT_OFF = 'The answer was too long and got cut off. Ask for the rest.';
const DECLINED = 'The tutor could not answer this one. Try rephrasing the question or asking about one part at a time.';

/** Streams a Gemini answer. Photos go with the first student message; the client resends them each time. */
async function answerWithGemini(r: DoubtRequest, write: (t: string) => void): Promise<string | null> {
  const contents: Content[] = r.turns.map((t, i) => ({
    role: t.role === 'user' ? 'user' : 'model',
    parts: [
      ...(i === 0 ? r.images.map((img) => ({ inlineData: { mimeType: img.mediaType, data: img.data } })) : []),
      { text: t.text },
    ],
  }));
  const stream = await gemini!.models.generateContentStream({
    model: MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt({ examName: r.exam, gradeName: r.grade, subjectName: r.subject, chapterName: r.chapter }),
      maxOutputTokens: 8192,
    },
  });
  let finish: FinishReason | undefined;
  let blocked = false;
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) write(text);
    finish = chunk.candidates?.[0]?.finishReason ?? finish;
    if (chunk.promptFeedback?.blockReason) blocked = true;
  }
  if (blocked || finish === FinishReason.SAFETY || finish === FinishReason.PROHIBITED_CONTENT || finish === FinishReason.RECITATION) return DECLINED;
  if (finish === FinishReason.MAX_TOKENS) return CUT_OFF;
  return null;
}

/** Streams a Claude answer. */
async function answerWithClaude(r: DoubtRequest, write: (t: string) => void): Promise<string | null> {
  const messages: Anthropic.Beta.BetaMessageParam[] = r.turns.map((t, i) => {
    if (i === 0 && r.images.length) {
      return {
        role: 'user',
        content: [
          ...r.images.map((img) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: img.mediaType, data: img.data } })),
          { type: 'text' as const, text: t.text },
        ],
      };
    }
    return { role: t.role, content: t.text };
  });
  const stream = claude!.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    // Re-run a declined request on Anthropic's recommended fallback model. Haiku has no server-side fallback.
    ...(MODEL.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
    output_config: { effort: 'medium' },
    system: systemPrompt({ examName: r.exam, gradeName: r.grade, subjectName: r.subject, chapterName: r.chapter }),
    messages,
  });
  stream.on('text', write);
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') return DECLINED;
  if (final.stop_reason === 'max_tokens') return CUT_OFF;
  return null;
}

function describeError(err: unknown): string {
  const status = err instanceof ApiError ? err.status : err instanceof Anthropic.APIError ? err.status : undefined;
  if (status === 429) {
    return PROVIDER === 'gemini'
      ? 'The free tutor has reached its limit for now. Please try again in a few minutes, or tomorrow if it keeps happening.'
      : 'The tutor is busy right now. Please try again in a minute.';
  }
  if (status === 401 || status === 403) return 'The tutor is not set up correctly on the server (API key).';
  if (status === 400) return 'The tutor could not read this request. A photo may be in an unsupported format.';
  return 'The tutor could not be reached. Please try again.';
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = path.join(DIST, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(DIST)) return sendError(res, 403, 'Forbidden');
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
  } catch {
    file = path.join(DIST, 'index.html');
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    sendError(res, 404, 'Not found. Run "npm run build" first.');
  }
}

createServer((req, res) => {
  if (req.url === '/api/doubt' && req.method === 'POST') {
    handleDoubt(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) sendError(res, 500, 'Server error.');
      else res.end();
    });
  } else if (req.method === 'GET') {
    serveStatic(req, res);
  } else {
    sendError(res, 405, 'Method not allowed');
  }
}).listen(PORT, () =>
  console.log(`Kaksha running at http://localhost:${PORT} · doubt tutor: ${PROVIDER ? `${PROVIDER} (${MODEL})` : 'off, set GEMINI_API_KEY'}`),
);
