import {
  getDateKeyInTimezone,
  getNextLocalDateForWeekday,
  addDaysToLocalDateKey,
} from './timezone';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = 'work' | 'personal' | 'health' | 'learning' | 'routine' | 'meeting' | 'break';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type HabitFrequency = 'daily' | 'weekly' | 'custom';

export interface ParsedToken {
  type: 'date' | 'time' | 'priority' | 'category' | 'duration' | 'tag' | 'energy' | 'frequency';
  rawText: string;
  label: string;
  value: any;
}

export interface ParsedQuickAdd {
  raw: string;
  cleanTitle: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  dateLabel?: string; // e.g., "Tomorrow at 3:00 PM"
  priority?: TaskPriority;
  category?: TaskCategory;
  duration?: number; // minutes
  energy?: EnergyLevel;
  tags: string[];
  habitFrequency?: HabitFrequency;
  isHabit: boolean;
  tokens: ParsedToken[];
}

const WEEKDAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const CATEGORY_MAP: Record<string, TaskCategory> = {
  work: 'work',
  job: 'work',
  project: 'work',
  personal: 'personal',
  life: 'personal',
  health: 'health',
  fitness: 'health',
  gym: 'health',
  learning: 'learning',
  study: 'learning',
  routine: 'routine',
  chore: 'routine',
  meeting: 'meeting',
  call: 'meeting',
  break: 'break',
};

/**
 * Parses a single line of text into structured task/habit properties with token tracking.
 */
export function parseQuickAdd(
  input: string,
  timezone: string = 'UTC',
  forceMode?: 'task' | 'habit'
): ParsedQuickAdd {
  const text = (input || '').trim();
  if (!text) {
    return {
      raw: '',
      cleanTitle: '',
      tags: [],
      isHabit: forceMode === 'habit',
      tokens: [],
    };
  }

  let workingText = text;
  const tokens: ParsedToken[] = [];
  const tags: string[] = [];

  let priority: TaskPriority | undefined;
  let category: TaskCategory | undefined;
  let duration: number | undefined;
  let energy: EnergyLevel | undefined;
  let habitFrequency: HabitFrequency | undefined;
  let dueDate: string | undefined;
  let dueTime: string | undefined;
  let dateTextSegment: string | undefined;
  let timeTextSegment: string | undefined;

  const now = new Date();
  const todayKey = getDateKeyInTimezone(now, timezone);

  // 1. Habit Mode Detection
  let isHabit = forceMode === 'habit';
  if (!forceMode) {
    const habitPrefixRegex = /^(?:habit:|daily\s+habit:|track\s+habit:|build\s+habit:)\s*/i;
    if (habitPrefixRegex.test(workingText)) {
      isHabit = true;
      workingText = workingText.replace(habitPrefixRegex, '');
    }
  }

  // 2. Frequency Detection (for habits or repeating tasks)
  const dailyRegex = /\b(?:every\s+day|daily|everyday)\b/i;
  const weeklyRegex = /\b(?:every\s+week|weekly|every\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;

  if (dailyRegex.test(workingText)) {
    const match = workingText.match(dailyRegex)!;
    habitFrequency = 'daily';
    isHabit = true;
    tokens.push({ type: 'frequency', rawText: match[0], label: 'Daily', value: 'daily' });
    workingText = workingText.replace(dailyRegex, ' ');
  } else if (weeklyRegex.test(workingText)) {
    const match = workingText.match(weeklyRegex)!;
    habitFrequency = 'weekly';
    isHabit = true;
    tokens.push({ type: 'frequency', rawText: match[0], label: match[0], value: 'weekly' });
    workingText = workingText.replace(weeklyRegex, ' ');
  }

  // 3. Priority Detection: !urgent, !high, !medium, !low, !1, !2, !3, !4, p1, p2, p3, p4
  const priorityRegex = /(?:^|\s)(?:!([a-zA-Z]+|[1-4])|\b([pP][1-4])\b)/;
  const prioMatch = workingText.match(priorityRegex);
  if (prioMatch) {
    const matchedToken = prioMatch[0].trim();
    const val = (prioMatch[1] || prioMatch[2]).toLowerCase();

    if (val === 'urgent' || val === '1' || val === 'p1') priority = 'urgent';
    else if (val === 'high' || val === '2' || val === 'p2') priority = 'high';
    else if (val === 'medium' || val === 'med' || val === '3' || val === 'p3') priority = 'medium';
    else if (val === 'low' || val === '4' || val === 'p4') priority = 'low';

    if (priority) {
      tokens.push({
        type: 'priority',
        rawText: matchedToken,
        label: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
        value: priority,
      });
      workingText = workingText.replace(priorityRegex, ' ');
    }
  }

  // 4. Energy Level Detection: ⚡high, ⚡low, ⚡medium, energy:high
  const energyRegex = /(?:^|\s)(?:⚡(high|med|medium|low)|energy:(high|med|medium|low))\b/i;
  const energyMatch = workingText.match(energyRegex);
  if (energyMatch) {
    const matchedToken = energyMatch[0].trim();
    const val = (energyMatch[1] || energyMatch[2]).toLowerCase();
    energy = val === 'high' ? 'high' : (val === 'low' ? 'low' : 'medium');
    tokens.push({
      type: 'energy',
      rawText: matchedToken,
      label: `⚡ ${energy.charAt(0).toUpperCase() + energy.slice(1)} Energy`,
      value: energy,
    });
    workingText = workingText.replace(energyRegex, ' ');
  }

  // 5. Category Detection (#work, #personal, #health, etc.)
  const categoryRegex = /(?:^|\s)#([a-zA-Z0-9_-]+)/g;
  workingText = workingText.replace(categoryRegex, (match, catName) => {
    const lower = catName.toLowerCase();
    if (CATEGORY_MAP[lower]) {
      category = CATEGORY_MAP[lower];
      tokens.push({
        type: 'category',
        rawText: match.trim(),
        label: `#${category}`,
        value: category,
      });
      return ' ';
    }
    // Otherwise, treat as general tag
    tags.push(catName);
    tokens.push({
      type: 'tag',
      rawText: match.trim(),
      label: `#${catName}`,
      value: catName,
    });
    return ' ';
  });

  // 6. Tags Detection (@label, @client, etc.)
  const tagRegex = /(?:^|\s)@([a-zA-Z0-9_-]+)/g;
  workingText = workingText.replace(tagRegex, (match, tagName) => {
    tags.push(tagName);
    tokens.push({
      type: 'tag',
      rawText: match.trim(),
      label: `@${tagName}`,
      value: tagName,
    });
    return ' ';
  });

  // 7. Duration Detection: 15m, 30min, 1h, 1.5h, 2hrs, 90m, ~45m
  const durationRegex = /(?:^|\s)(?:~|for\s+)?(\d+(?:\.\d+)?)\s*(mins?|minutes?|m|hours?|hrs?|h)\b/i;
  const durMatch = workingText.match(durationRegex);
  if (durMatch) {
    const amount = parseFloat(durMatch[1]);
    const unit = durMatch[2].toLowerCase();
    const matchedToken = durMatch[0].trim();

    if (unit.startsWith('h')) {
      duration = Math.round(amount * 60);
    } else {
      duration = Math.round(amount);
    }

    if (duration > 0) {
      tokens.push({
        type: 'duration',
        rawText: matchedToken,
        label: duration >= 60 ? `${duration / 60}h` : `${duration}m`,
        value: duration,
      });
      workingText = workingText.replace(durationRegex, ' ');
    }
  }

  // 8. Time Detection (e.g. at 3pm, at 14:30, 9am, 5:00 PM, noon, morning, evening, night)
  // First check combined phrases like "today morning", "tomorrow evening", "at morning", "in the afternoon"
  const timeNamedRegex = /(?:(?:\b(?:at|in\s+the|this|today|tomorrow)\s+)?(morning|afternoon|evening|night|tonight|noon|midnight))\b/i;

  // Check explicit times first (e.g., "at 4pm", "10:30am", "16:00", "9am")
  const explicitTimeRegex = /(?:^|\s)(?:at\s+)?([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)\b/i;
  const militaryTimeRegex = /(?:^|\s)at\s+([01]?\d|2[0-3]):([0-5]\d)\b/i;

  const timeMatch = workingText.match(explicitTimeRegex) || workingText.match(militaryTimeRegex);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

    if (meridiem === 'pm' && hours < 12) hours += 12;
    else if (meridiem === 'am' && hours === 12) hours = 0;

    dueTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    timeTextSegment = timeMatch[0].trim();
    tokens.push({
      type: 'time',
      rawText: timeTextSegment,
      label: formatTimeLabel(dueTime),
      value: dueTime,
    });
    workingText = workingText.replace(timeMatch[0], ' ');
  } else {
    // Check named times with context (e.g., "in the morning", "this evening", "at noon")
    const namedTimeMatch = workingText.match(/(?:\b(?:at|in\s+the|this)\s+(morning|afternoon|evening|night|tonight|noon|midnight)\b|\b(tonight|noon|midnight)\b)/i) ||
                           workingText.match(/(?:\b(?:today|tomorrow)\s+(morning|afternoon|evening|night)\b)/i);
    if (namedTimeMatch) {
      const name = (namedTimeMatch[1] || namedTimeMatch[2]).toLowerCase();
      timeTextSegment = namedTimeMatch[0].trim();
      if (name === 'morning') dueTime = '09:00';
      else if (name === 'afternoon') dueTime = '14:00';
      else if (name === 'evening') dueTime = '18:00';
      else if (name === 'night' || name === 'tonight') dueTime = '20:00';
      else if (name === 'noon') dueTime = '12:00';
      else if (name === 'midnight') dueTime = '00:00';

      if (dueTime) {
        tokens.push({
          type: 'time',
          rawText: timeTextSegment,
          label: formatTimeLabel(dueTime),
          value: dueTime,
        });
        workingText = workingText.replace(namedTimeMatch[0], ' ');
      }
    }
  }

  // 9. Date Detection: today, tomorrow, tmrw, next monday, in X days, Oct 15
  const relativeDateRegex = /\b(today|tomorrow|tmrw)\b/i;
  const inDaysRegex = /\bin\s+(\d+)\s+(days?|weeks?|months?)\b/i;
  const weekdayRegex = /\b(?:on\s+|next\s+|this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;
  const explicitDateRegex = /\b(?:(?:on\s+)?([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?|(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+))\b/i;
  const isoDateRegex = /\b(\d{4}-\d{2}-\d{2})\b/;

  if (relativeDateRegex.test(workingText)) {
    const match = workingText.match(relativeDateRegex)!;
    dateTextSegment = match[0];
    const lower = match[1].toLowerCase();
    dueDate = lower === 'today' ? todayKey : addDaysToLocalDateKey(todayKey, 1);
    tokens.push({
      type: 'date',
      rawText: dateTextSegment,
      label: lower === 'today' ? 'Today' : 'Tomorrow',
      value: dueDate,
    });
    workingText = workingText.replace(relativeDateRegex, ' ');
  } else if (inDaysRegex.test(workingText)) {
    const match = workingText.match(inDaysRegex)!;
    dateTextSegment = match[0];
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    let daysToAdd = amount;
    if (unit.startsWith('week')) daysToAdd = amount * 7;
    else if (unit.startsWith('month')) daysToAdd = amount * 30;

    dueDate = addDaysToLocalDateKey(todayKey, daysToAdd);
    tokens.push({
      type: 'date',
      rawText: dateTextSegment,
      label: `In ${amount} ${unit}`,
      value: dueDate,
    });
    workingText = workingText.replace(inDaysRegex, ' ');
  } else if (isoDateRegex.test(workingText)) {
    const match = workingText.match(isoDateRegex)!;
    dateTextSegment = match[1];
    dueDate = dateTextSegment;
    tokens.push({
      type: 'date',
      rawText: dateTextSegment,
      label: dateTextSegment,
      value: dueDate,
    });
    workingText = workingText.replace(isoDateRegex, ' ');
  } else if (explicitDateRegex.test(workingText)) {
    const match = workingText.match(explicitDateRegex)!;
    dateTextSegment = match[0];
    const monthStr = (match[1] || match[4]).toLowerCase();
    const dayNum = parseInt(match[2] || match[3], 10);

    if (MONTH_NAMES[monthStr] !== undefined && dayNum >= 1 && dayNum <= 31) {
      const monthIdx = MONTH_NAMES[monthStr];
      const currentYear = now.getFullYear();
      let targetDate = new Date(currentYear, monthIdx, dayNum);
      if (targetDate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
        // If date has passed this year, assume next year
        targetDate = new Date(currentYear + 1, monthIdx, dayNum);
      }
      dueDate = getDateKeyInTimezone(targetDate, timezone);
      tokens.push({
        type: 'date',
        rawText: dateTextSegment,
        label: `${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)} ${dayNum}`,
        value: dueDate,
      });
      workingText = workingText.replace(explicitDateRegex, ' ');
    }
  } else if (weekdayRegex.test(workingText)) {
    const match = workingText.match(weekdayRegex)!;
    const dayName = match[1].toLowerCase();
    if (WEEKDAY_NAMES[dayName] !== undefined) {
      dateTextSegment = match[0];
      const targetDayIndex = WEEKDAY_NAMES[dayName];
      dueDate = getNextLocalDateForWeekday(timezone, targetDayIndex, now);
      tokens.push({
        type: 'date',
        rawText: dateTextSegment,
        label: `Next ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}`,
        value: dueDate,
      });
      workingText = workingText.replace(weekdayRegex, ' ');
    }
  }

  // 10. Compute Clean Title
  const cleanTitle = workingText
    .replace(/\s+/g, ' ')
    .replace(/^[-:,.\s]+|[-:,.\s]+$/g, '')
    .trim() || text;

  // 11. Human-Readable Date Label
  let dateLabel: string | undefined;
  if (dueDate) {
    if (dueDate === todayKey) {
      dateLabel = dueTime ? `Today at ${formatTimeLabel(dueTime)}` : 'Today';
    } else if (dueDate === addDaysToLocalDateKey(todayKey, 1)) {
      dateLabel = dueTime ? `Tomorrow at ${formatTimeLabel(dueTime)}` : 'Tomorrow';
    } else {
      const parts = dueDate.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateLabel = dueTime ? `${formattedDate} at ${formatTimeLabel(dueTime)}` : formattedDate;
    }
  } else if (dueTime) {
    dateLabel = `Today at ${formatTimeLabel(dueTime)}`;
  }

  return {
    raw: text,
    cleanTitle,
    dueDate,
    dueTime,
    dateLabel,
    priority,
    category,
    duration,
    energy,
    tags,
    habitFrequency,
    isHabit,
    tokens,
  };
}

function formatTimeLabel(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const displayHours = h % 12 || 12;
  return m === 0 ? `${displayHours} ${meridiem}` : `${displayHours}:${m.toString().padStart(2, '0')} ${meridiem}`;
}
