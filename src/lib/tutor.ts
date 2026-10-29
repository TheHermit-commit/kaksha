import { systemPrompt, type TutorContext, type TutorTurn } from './tutorPrompt';

export interface TutorImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  /** Base64 without the data: prefix */
  data: string;
}

export interface TutorRequest {
  ctx: TutorContext;
  turns: TutorTurn[];
  images: TutorImage[];
  onText: (text: string) => void;
  signal: AbortSignal;
}

export class TutorError extends Error {}

// Inside a Claude artifact viewer the page can ask Claude through the viewer's own account.
interface SampleFn {
  (input: { role: 'user' | 'assistant'; content: string }[], options: Record<string, unknown>): Promise<{ text: string; truncated: boolean }>;
  limits(): Promise<{ images?: { maxCount: number } }>;
}
declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

const SAMPLE_ERRORS: Record<string, string> = {
  not_granted: 'Allow this page to use Claude when asked, then try again.',
  sampling_disabled: 'Claude is not available for this account.',
  rate_limited: 'Too many doubts in a short time. Wait a little and try again.',
  session_expired: 'Sign in to Claude again, then retry.',
  image_rejected: 'One of the photos could not be read. Try a clearer JPEG or PNG.',
  images_unavailable: 'Photos cannot be sent from this view. Type the question instead.',
  refused: 'The tutor could not answer this one. Try rephrasing the question.',
};

async function viaArtifact(req: TutorRequest): Promise<string> {
  const sample = (await window.claude!.use('sample')) as SampleFn | null;
  if (!sample) throw new TutorError('The doubt tutor is not available here.');
  if (req.images.length) {
    const limits = await sample.limits().catch(() => null);
    if (!limits?.images) throw new TutorError(SAMPLE_ERRORS.images_unavailable);
  }
  const images = req.images.map((img) => {
    const bytes = Uint8Array.from(atob(img.data), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: img.mediaType });
  });
  // No system role here: the rules go in a leading user turn.
  const input = [{ role: 'user' as const, content: systemPrompt(req.ctx) }, ...req.turns.map((t) => ({ role: t.role, content: t.text }))];
  try {
    const { text, truncated } = await sample(input, {
      onText: ({ text }: { text: string }) => req.onText(text),
      signal: req.signal,
      cache: false,
      ...(images.length ? { images } : {}),
    });
    return truncated ? `${text}\n\n[The answer was cut off. Ask for the rest.]` : text;
  } catch (e) {
    const err = e as { code?: string; text?: string };
    if (err.code === 'cancelled') throw new TutorError('Stopped.');
    throw new TutorError(SAMPLE_ERRORS[err.code ?? ''] ?? 'The tutor could not be reached. Please try again.');
  }
}

async function viaServer(req: TutorRequest): Promise<string> {
  let res: Response;
  try {
    res = await fetch('/api/doubt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        exam: req.ctx.examName,
        grade: req.ctx.gradeName,
        subject: req.ctx.subjectName,
        chapter: req.ctx.chapterName,
        turns: req.turns,
        images: req.images,
      }),
      signal: req.signal,
    });
  } catch (e) {
    if (req.signal.aborted) throw new TutorError('Stopped.');
    throw new TutorError('Could not reach the doubt tutor. Check your internet connection.');
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new TutorError(body?.error ?? 'The doubt tutor is not set up on this website yet.');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      req.onText(text);
    }
  } catch {
    if (req.signal.aborted) return text ? `${text}\n\n[Stopped.]` : Promise.reject(new TutorError('Stopped.'));
    throw new TutorError('The connection dropped. Please try again.');
  }
  return text;
}

/** Streams the tutor's answer. Uses the Claude viewer when the page runs inside one, else the site's server. */
export function askTutor(req: TutorRequest): Promise<string> {
  return window.claude ? viaArtifact(req) : viaServer(req);
}
