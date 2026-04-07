export type DriveFileTypeFilter = 'doc' | 'slides' | 'sheet' | 'pdf';

export type CanvasCommand =
  | { kind: 'filterType';     fileType: DriveFileTypeFilter }
  | { kind: 'resetFilter' }
  | { kind: 'hideSource';     source: string }
  | { kind: 'showSource';     source: string }
  | { kind: 'sortRecent' }
  | { kind: 'highlightTitle'; keyword: string }
  | { kind: 'calendarDay';    date: Date }
  | { kind: 'nextEvent' }
  | { kind: 'youtubeSearch';  query: string };

export interface CanvasFilterState {
  fileType:      DriveFileTypeFilter | null;
  hiddenSources: Set<string>;
  sortByRecent:  boolean;
  titleKeyword:  string;
}

export const INITIAL_CANVAS_FILTER: CanvasFilterState = {
  fileType:      null,
  hiddenSources: new Set(),
  sortByRecent:  false,
  titleKeyword:  '',
};

export interface ParsedCommand {
  command:      CanvasCommand;
  confirmation: string;
}

export function parseCanvasCommand(raw: string): ParsedCommand | null {
  const t = raw.trim().toLowerCase();

  // ── Reset / show all ──────────────────────────────────────
  if (/^(show all|show everything|reset|clear|clear filter|all|everything)$/.test(t)) {
    return { command: { kind: 'resetFilter' }, confirmation: 'Showing all cards' };
  }

  // ── File-type filters ─────────────────────────────────────
  const typePatterns: [RegExp, DriveFileTypeFilter, string][] = [
    [/(show|pull up|find|filter)\s+(slides?|presentations?)/, 'slides', 'Showing your Slides'],
    [/(show|pull up|find|filter)\s+(docs?|documents?)/,       'doc',    'Showing your Docs'],
    [/(show|pull up|find|filter)\s+(sheets?|spreadsheets?)/,  'sheet',  'Showing your Sheets'],
    [/(show|pull up|find|filter)\s+(pdfs?)/,                  'pdf',    'Showing your PDFs'],
  ];
  for (const [re, fileType, confirmation] of typePatterns) {
    if (re.test(t)) return { command: { kind: 'filterType', fileType }, confirmation };
  }

  // ── Sort recent ───────────────────────────────────────────
  if (/\brecent\b/.test(t) || /^recent files?$/.test(t)) {
    return { command: { kind: 'sortRecent' }, confirmation: 'Filtered to recent files' };
  }

  // ── Hide source ───────────────────────────────────────────
  const hideMatch = t.match(/^hide\s+(youtube|notion|figma|drive)/);
  if (hideMatch) {
    const source = hideMatch[1];
    return {
      command: { kind: 'hideSource', source },
      confirmation: `Hiding ${source.charAt(0).toUpperCase() + source.slice(1)} cards`,
    };
  }

  // ── Show source ───────────────────────────────────────────
  const showSrc = t.match(/^show\s+(youtube|notion|figma|drive)$/);
  if (showSrc) {
    const source = showSrc[1];
    return {
      command: { kind: 'showSource', source },
      confirmation: `Showing ${source.charAt(0).toUpperCase() + source.slice(1)} cards`,
    };
  }

  // ── Calendar: today ───────────────────────────────────────
  if (/\btoday\b/.test(t) && !/draft|email|write|ask|send/.test(t)) {
    return { command: { kind: 'calendarDay', date: new Date() }, confirmation: "Opening today's schedule" };
  }

  // ── Calendar: tomorrow ────────────────────────────────────
  if (/\btomorrow\b/.test(t)) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return { command: { kind: 'calendarDay', date: d }, confirmation: "Opening tomorrow's schedule" };
  }

  // ── Calendar: day names (only when schedule-intent is present) ──
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const;
  if (/\bschedule\b|what.?s on\b|on\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/.test(t)) {
    for (let i = 0; i < dayNames.length; i++) {
      if (t.includes(dayNames[i])) {
        const d = new Date();
        const diff = ((i - d.getDay()) + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        const label = dayNames[i].charAt(0).toUpperCase() + dayNames[i].slice(1);
        return { command: { kind: 'calendarDay', date: d }, confirmation: `Opening ${label}'s schedule` };
      }
    }
  }

  // ── Next event ────────────────────────────────────────────
  if (/\bnext event\b|what.?s next\b/.test(t)) {
    return { command: { kind: 'nextEvent' }, confirmation: 'Checking next event...' };
  }

  // ── YouTube topic search ──────────────────────────────────
  const ytSearch = t.match(
    /(?:show\s+me|find|i\s+want\s+to\s+see|pull\s+up|search\s+for)\s+(.+?)\s+(?:videos?|clips?|footage)/
  );
  if (ytSearch) {
    const query = ytSearch[1].trim();
    return { command: { kind: 'youtubeSearch', query }, confirmation: `Searching for "${query}" videos…` };
  }

  // ── Drive file search ─────────────────────────────────────
  const driveSearch = t.match(/(?:find|show)\s+(?:my\s+)?(.+?)\s+files?/);
  if (driveSearch) {
    const keyword = driveSearch[1].trim();
    if (!['youtube','notion','figma','drive','all','everything','recent'].includes(keyword)) {
      return {
        command: { kind: 'highlightTitle', keyword },
        confirmation: `Filtering cards for "${keyword}"`,
      };
    }
  }

  // ── Title keyword highlight (catch-all for "show X") ──────
  const showKw = raw.trim().match(/^(?:show|find|search|pull up)\s+(.{2,})$/i);
  if (showKw) {
    const keyword = showKw[1].trim();
    // Don't catch single-word matches that could be source names
    if (!['youtube','notion','figma','drive','all','everything'].includes(keyword.toLowerCase())) {
      return {
        command: { kind: 'highlightTitle', keyword },
        confirmation: `Highlighting "${keyword}"`,
      };
    }
  }

  return null; // Not a canvas command — pass to Ollama
}
