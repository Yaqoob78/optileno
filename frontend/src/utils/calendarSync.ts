/**
 * Calendar Sync and Export Utilities for Optileno.
 * Supports Google Calendar 1-Click URLs and standard RFC-5545 .ics exports for Outlook / Apple Calendar.
 */

export interface CalendarEventData {
  title: string;
  description?: string;
  startDate: Date;
  durationMinutes: number;
  location?: string;
}

/**
 * Format a Date object to iCalendar UTC format (YYYYMMDDTHHMMSSZ).
 */
export function formatToICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Generate a direct 1-click Google Calendar web creation URL.
 */
export function getGoogleCalendarUrl(event: CalendarEventData): string {
  const startStr = formatToICSDate(event.startDate);
  const endDate = new Date(event.startDate.getTime() + event.durationMinutes * 60 * 1000);
  const endStr = formatToICSDate(endDate);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startStr}/${endStr}`,
    details: event.description || 'Scheduled via Optileno AI Calendar Planner (https://www.optileno.com)',
    location: event.location || 'Optileno Workspace',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate a standard RFC 5545 .ics string for a single or multiple events.
 */
export function generateICSContent(events: CalendarEventData[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Optileno//AI Calendar Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Optileno Planner',
  ];

  events.forEach((ev, idx) => {
    const startStr = formatToICSDate(ev.startDate);
    const endDate = new Date(ev.startDate.getTime() + ev.durationMinutes * 60 * 1000);
    const endStr = formatToICSDate(endDate);
    const uid = `optileno-${Date.now()}-${idx}@optileno.com`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatToICSDate(new Date())}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:${ev.title.replace(/\n/g, ' ')}`,
      `DESCRIPTION:${(ev.description || 'Scheduled via Optileno').replace(/\n/g, '\\n')}`,
      `LOCATION:${ev.location || 'Optileno'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers a browser download of an .ics file for direct import into Outlook or Apple Calendar.
 */
export function downloadICSFile(filename: string, events: CalendarEventData[]): void {
  const icsData = generateICSContent(events);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
