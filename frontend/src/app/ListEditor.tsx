import { useRef } from 'react';
import { Plus, X } from 'lucide-react';

interface ListEditorProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
  variant?: 'included' | 'excluded';
}

/** An editable list where Enter adds the next line, the way you'd write it on paper. */
export function ListEditor({ label, items, onChange, placeholder, addLabel, variant = 'included' }: ListEditorProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const focusRow = (i: number) => {
    window.requestAnimationFrame(() => listRef.current?.querySelectorAll<HTMLInputElement>('input')[i]?.focus());
  };

  const update = (i: number, value: string) => onChange(items.map((x, j) => (j === i ? value : x)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const add = (after = items.length - 1) => {
    const next = [...items];
    next.splice(after + 1, 0, '');
    onChange(next);
    focusRow(after + 1);
  };

  return (
    <div className={`list-editor list-editor-${variant}`}>
      <span className="label">{label}</span>
      <ul ref={listRef}>
        {items.map((item, i) => (
          <li key={i}>
            <span className="list-bullet" aria-hidden="true" />
            <input
              className="list-input"
              value={item}
              placeholder={placeholder}
              aria-label={`${label} ${i + 1}`}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add(i);
                } else if (e.key === 'Backspace' && !item && items.length > 0) {
                  e.preventDefault();
                  remove(i);
                  focusRow(Math.max(0, i - 1));
                }
              }}
            />
            <button type="button" className="icon-btn list-remove" onClick={() => remove(i)} aria-label={`Remove ${item || 'line'}`}>
              <X size={15} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="list-add" onClick={() => add()}>
        <Plus size={15} /> {addLabel}
      </button>
    </div>
  );
}
