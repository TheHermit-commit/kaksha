import type { ReactNode } from 'react';

/** Renders the tutor's light Markdown (bold, numbered steps, bullets, headings) as React elements. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export default function TutorText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    if (ordered || bullet) {
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flush();
      if (!list) list = { ordered: isOrdered, items: [] };
      list.items.push((ordered ?? bullet)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      blocks.push(<h4 key={blocks.length}>{inline(heading[1])}</h4>);
    } else if (/^\**(Answer|Watch out):/i.test(line)) {
      blocks.push(<p key={blocks.length} className="tutor-key">{inline(line)}</p>);
    } else {
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="tutor-text">{blocks}</div>;
}
