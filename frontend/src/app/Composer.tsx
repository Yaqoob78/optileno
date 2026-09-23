import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import type { Project } from '../lib/model';

const EXAMPLES = [
  'Can we add a pricing page too?',
  'Could the logo be a touch bigger?',
  'Quick one: a vertical version for Reels?',
  'Could you write the About page copy?',
  'Can we try one more color option?',
];

interface ComposerProps {
  projects: Project[];
  projectId: string | null;
  onProjectChange?: (id: string) => void;
  onSubmit: (projectId: string, text: string) => void;
  /** Hide the project picker (inside a project page). */
  fixedProject?: boolean;
  autoFocus?: boolean;
}

/** "What did they ask?" The one action Optileno is built around. */
export function Composer({ projects, projectId, onProjectChange, onSubmit, fixedProject, autoFocus }: ComposerProps) {
  const [text, setText] = useState('');
  const [example, setExample] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const current = projects.find((p) => p.id === projectId) ?? projects[0];

  useEffect(() => {
    if (text) return undefined;
    const t = window.setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), 3600);
    return () => window.clearInterval(t);
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  // Press "/" anywhere to jump here
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.querySelector('.sheet')) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = () => {
    const clean = text.trim();
    if (!clean || !current) return;
    onSubmit(current.id, clean);
    setText('');
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="composer-label" htmlFor="composer-input">
        <span className="serif">What did they ask for?</span>
        {!fixedProject && projects.length > 1 && (
          <span className="composer-project">
            <span className="muted">for</span>
            <select
              className="composer-select"
              aria-label="Project"
              value={current?.id}
              onChange={(e) => onProjectChange?.(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.client ? `${p.client} · ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </span>
        )}
        {!fixedProject && projects.length === 1 && current && (
          <span className="composer-project muted">for {current.client || current.name}</span>
        )}
      </label>
      <div className="composer-box">
        <textarea
          id="composer-input"
          ref={ref}
          className="composer-input"
          rows={1}
          value={text}
          autoFocus={autoFocus}
          placeholder={`Paste their message, e.g. “${EXAMPLES[example]}”`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="submit" className="composer-send" disabled={!text.trim()} aria-label="Check against scope">
          <span className="composer-send-label">Check scope</span>
          <ArrowUp size={18} strokeWidth={2.2} />
        </button>
      </div>
      <p className="composer-hint">
        Optileno reads it against what you agreed. You decide what happens next. <kbd>/</kbd> to jump here
      </p>
    </form>
  );
}
