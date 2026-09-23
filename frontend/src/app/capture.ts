/* Requests can arrive from outside the app: the "Check with Optileno"
   bookmark, the Android share sheet, or any link to /app?text=…
   The text waits here until the composer picks it up. */

let pending = '';

if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
  const q = new URLSearchParams(window.location.search);
  pending = [q.get('text'), q.get('title'), q.get('url')]
    .filter((v): v is string => !!v && !!v.trim())
    .join('\n')
    .trim()
    .slice(0, 2000);
  if (q.has('text') || q.has('title') || q.has('url')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }
}

export function peekCaptured(): string {
  return pending;
}

export function clearCaptured() {
  pending = '';
}

/** A bookmark that sends the selected text (or a typed one) into Optileno. */
export function bookmarkletSource(origin: string): string {
  return `javascript:(function(){var s=String(window.getSelection()).trim();if(!s){s=prompt('What did the client ask for?')||'';}if(s){window.open('${origin}/app?text='+encodeURIComponent(s.slice(0,1800)),'optileno');}})();`;
}
