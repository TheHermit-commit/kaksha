import type { CheckInAnswers } from '../types';

export interface CheckInContext {
  name: string;
  hoursPerDay: number;
  /** Share of last week's tasks that were ticked off, or null if there is no last week */
  lastWeekCompletion: number | null;
  weakChapterNames: string[];
}

export interface CheckInOutcome {
  /** Multiplier on usual study time for the next 7 days */
  factor: number;
  /** Also lighten the week after */
  extendNextWeek: boolean;
  reply: string[];
  changes: string[];
  showHelpline: boolean;
}

const CRISIS = /(suicid|kill myself|end my life|want to die|no reason to live|self[- ]?harm|hurt myself)/i;
const DISTRESS = /(hopeless|give up|giving up|burn(ed|t)? ?out|can'?t cope|cannot cope|overwhelm|panic|anxious|anxiety|depress|crying)/i;
const SICK = /\b(sick|ill|fever|unwell|hospital|injur|covid|dengue|typhoid)/i;
const EVENTS = /\b(wedding|function|festival|diwali|holi|eid|travel|trip|shifting|moving)\b/i;

export function evaluateCheckIn(a: CheckInAnswers, ctx: CheckInContext): CheckInOutcome {
  const reply: string[] = [];
  const changes: string[] = [];
  let factor = Math.min(1.5, Math.max(0.2, a.hoursAvailable / ctx.hoursPerDay));
  let extendNextWeek = false;
  let showHelpline = false;
  const note = a.note.trim();

  if (CRISIS.test(note)) {
    showHelpline = true;
    factor = Math.min(factor, 0.5);
    extendNextWeek = true;
    reply.push(
      `${ctx.name}, thank you for telling me. What you wrote matters more than any exam. Please talk to someone today, a parent, a teacher or a friend you trust, or call Tele-MANAS on 14416. It is free, confidential and open 24 hours. I have made your plan much lighter for the next two weeks, so the plan is not something to worry about right now.`,
    );
  }

  if (a.hoursAvailable !== ctx.hoursPerDay) {
    changes.push(`Study time for the next 7 days: ${a.hoursAvailable} h a day (usually ${ctx.hoursPerDay} h).`);
  }

  if (SICK.test(note)) {
    factor = Math.min(factor, 0.5);
    reply.push('Get well first. I have halved your study load so you can rest. Lost days can be made up later; an illness that drags on cannot.');
    changes.push('Study load halved while you recover.');
  }

  if (a.school === 'heavy') {
    factor *= 0.6;
    reply.push('School exams come first this week. I have cut back new chapters so you can prepare for them, and much of the school syllabus overlaps with your entrance exam anyway.');
    changes.push('New chapters reduced by 40% for school work.');
  } else if (a.school === 'some') {
    factor *= 0.85;
    changes.push('Slightly lighter load to make room for school work.');
  }

  if (EVENTS.test(note) && !SICK.test(note)) {
    factor *= 0.8;
    reply.push('Enjoy the time with family. I have made the week lighter around it, so short, focused sessions on those days will be enough.');
    changes.push('Lighter week for the family event.');
  }

  if (a.stress >= 5 && !showHelpline) {
    factor *= 0.7;
    extendNextWeek = true;
    showHelpline = true;
    reply.push(
      'You sound very stressed, and that is common in exam years. I have reduced your load for the next two weeks. Short breaks, sleep and a daily walk will help your scores more than an extra hour of study. If the stress does not ease, talk to someone you trust or call Tele-MANAS on 14416 (free, 24 hours).',
    );
    changes.push('Load reduced for the next two weeks because of high stress.');
  } else if (a.stress === 4) {
    factor *= 0.85;
    reply.push('It sounds like a heavy week. I have taken some pressure off. Try to stop studying at a fixed time each night so your mind gets real rest.');
    changes.push('Load reduced by about 15% because of stress.');
  } else if (DISTRESS.test(note) && !showHelpline) {
    factor *= 0.85;
    showHelpline = true;
    reply.push('Thank you for sharing how you feel. Feeling overwhelmed does not mean you are falling behind. I have made next week lighter. If these feelings stay, please talk to someone you trust.');
    changes.push('Load reduced by about 15%.');
  }

  if (a.sleep === 'under6') {
    factor *= 0.9;
    reply.push('Less than 6 hours of sleep makes it harder to remember what you study. I have trimmed the plan so you can aim for 7–8 hours. Avoid studying past midnight.');
    changes.push('Slightly shorter days so you can sleep more.');
  }

  if (a.pace === 'fast') {
    factor *= 0.9;
    reply.push('If chapters feel rushed, it is better to understand fewer of them well. I have slowed the pace a little; the plan will spread the rest across the coming weeks.');
    changes.push('Pace slowed by about 10%.');
  } else if (a.pace === 'slow' && a.stress <= 3 && a.school === 'none') {
    factor *= 1.1;
    reply.push('Good energy. I have added a little more to next week. Keep an eye on sleep so it stays sustainable.');
    changes.push('About 10% more study next week.');
  }

  if (ctx.lastWeekCompletion !== null) {
    const pct = Math.round(ctx.lastWeekCompletion * 100);
    if (ctx.lastWeekCompletion < 0.5) {
      if (factor >= 0.9) factor *= 0.9;
      reply.push(`You finished ${pct}% of last week’s tasks. That is fine. Anything unfinished has been moved into the coming weeks, and I have kept next week a bit more realistic.`);
      changes.push('Unfinished work moved into the coming weeks.');
    } else if (ctx.lastWeekCompletion >= 0.9) {
      reply.push(`You finished ${pct}% of last week’s tasks. That is excellent consistency.`);
    } else {
      reply.push(`You finished ${pct}% of last week’s tasks. Anything left over has been moved into the coming weeks.`);
    }
  }

  if (ctx.weakChapterNames.length) {
    const names = ctx.weakChapterNames.slice(0, 3).join(', ');
    reply.push(`Your recent mocks showed gaps in ${names}. These now come first in your daily revision slots.`);
    changes.push(`Revision priority: ${names}.`);
  }

  factor = Math.round(Math.min(1.3, Math.max(0.2, factor)) * 20) / 20;
  if (!reply.length) reply.push(`Thanks for checking in, ${ctx.name}. Everything looks on track, so your plan stays as it is.`);
  if (Math.abs(factor - 1) >= 0.05) {
    changes.unshift(`Next 7 days: about ${Math.round(ctx.hoursPerDay * factor * 10) / 10} h of study a day.`);
  }
  return { factor, extendNextWeek, reply, changes, showHelpline };
}
