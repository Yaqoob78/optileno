import type { ReactNode } from 'react';
import { formatMoney, type Currency } from '../lib/money';
import type { RequestItem } from '../lib/model';

type Variant = 'included' | 'revision' | 'extra' | 'gift' | 'muted';

export function Stamp({ variant, children, large, press }: { variant: Variant; children: ReactNode; large?: boolean; press?: boolean }) {
  return <span className={`stamp stamp-${variant}${large ? ' stamp-lg' : ''}${press ? ' pressing' : ''}`}>{children}</span>;
}

/** The stamp a logged request wears everywhere in the app. */
export function ItemStamp({ item, currency, roundsIncluded, large, press }: { item: RequestItem; currency: Currency; roundsIncluded: number; large?: boolean; press?: boolean }) {
  switch (item.kind) {
    case 'included':
      return <Stamp variant="included" large={large} press={press}>Included</Stamp>;
    case 'revision':
      return (
        <Stamp variant="revision" large={large} press={press}>
          Round {item.round} of {roundsIncluded}
        </Stamp>
      );
    case 'gift':
      return (
        <Stamp variant="gift" large={large} press={press}>
          Gift · {formatMoney(item.amount, currency)}
        </Stamp>
      );
    default:
      return (
        <Stamp variant={item.status === 'declined' ? 'muted' : 'extra'} large={large} press={press}>
          {item.status === 'approved' ? 'Paid extra' : item.status === 'declined' ? 'Declined' : 'Extra'} · {formatMoney(item.amount, currency)}
        </Stamp>
      );
  }
}

export function Pips({ used, included }: { used: number; included: number }) {
  const total = Math.max(included, used);
  if (total === 0) return <span className="hint">No rounds included</span>;
  return (
    <span className="pips" role="img" aria-label={`${Math.min(used, included)} of ${included} revision rounds used`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`pip${i < used ? (i < included ? ' used' : ' over') : ''}`} />
      ))}
    </span>
  );
}
