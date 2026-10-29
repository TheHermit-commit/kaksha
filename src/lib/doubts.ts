import type { SubjectId } from '../types';
import type { TutorImage } from './tutor';
import type { TutorTurn } from './tutorPrompt';

export type DoubtMessageKind = 'question' | 'hint' | 'next-hint' | 'solution' | 'followup' | 'answer';

export interface DoubtMessage {
  role: 'student' | 'tutor';
  kind: DoubtMessageKind;
  /** What the student sees */
  text: string;
  /** What was sent to the tutor, when it differs from the displayed text */
  prompt?: string;
}

export interface Doubt {
  id: string;
  createdAt: string; // ISO timestamp
  date: string; // YYYY-MM-DD
  subject: SubjectId;
  chapterId: string | null;
  question: string;
  /** Compressed JPEG data URLs */
  images: string[];
  imagesRemoved?: boolean;
  messages: DoubtMessage[];
  solutionShown: boolean;
  resolved: boolean;
}

const KEY = 'kaksha:doubts:v1';

export function loadDoubts(): Doubt[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Doubt[]) : [];
  } catch {
    return [];
  }
}

/** Saves doubts; if storage is full, drops photos from the oldest doubts until it fits. */
export function saveDoubts(doubts: Doubt[]): Doubt[] {
  let list = doubts;
  for (;;) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return list;
    } catch {
      const oldest = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find((d) => d.images.length);
      if (!oldest) return list; // nothing left to trim; keep working in memory
      list = list.map((d) => (d.id === oldest.id ? { ...d, images: [], imagesRemoved: true } : d));
    }
  }
}

/** Conversation for the tutor: student and tutor turns in order, ending on the student. */
export function tutorTurns(doubt: Doubt): TutorTurn[] {
  return doubt.messages.map((m) => ({ role: m.role === 'student' ? 'user' : 'assistant', text: m.prompt ?? m.text }));
}

export function toTutorImages(dataUrls: string[]): TutorImage[] {
  return dataUrls.map((url) => {
    const [head, data] = url.split(',');
    const mediaType = (head.match(/data:(.*?);/)?.[1] ?? 'image/jpeg') as TutorImage['mediaType'];
    return { mediaType, data };
  });
}

/** Shrinks a photo to at most 1280px on its longest side as a JPEG, to save storage and upload time. */
export async function compressImage(file: File, maxSide = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('This file is not an image we can read.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function newDoubtId(): string {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
