import type { ISODate } from './dates';
import type { Currency } from './money';
import type { TemplateId } from './templates';

export type Theme = 'system' | 'light' | 'dark';
export type Tone = 'warm' | 'brief';

/** How a client request was resolved. */
export type ItemKind = 'included' | 'revision' | 'extra' | 'gift';
export type ExtraStatus = 'proposed' | 'approved' | 'declined';

export interface Profile {
  /** The name clients see on scope pages and replies. */
  name: string;
  business: string;
  /** Where client approvals are sent. Optional. */
  email: string;
  rate: number;
  currency: Currency;
  /** Focused hours in a working day — turns hours of extra work into days of delay. */
  hoursPerDay: number;
}

export interface Deliverable {
  id: string;
  title: string;
  done: boolean;
}

export interface Project {
  id: string;
  client: string;
  /** First name of the person you talk to, for greetings in replies. */
  contact: string;
  name: string;
  template: TemplateId;
  fee: number;
  deadline: ISODate | null;
  deliverables: Deliverable[];
  excluded: string[];
  /** Revision rounds included in the fee. */
  revisions: number;
  createdAt: number;
  archivedAt: number | null;
}

export interface RequestItem {
  id: string;
  projectId: string;
  /** What the client actually said. */
  text: string;
  /** Short label, e.g. "Add a pricing page". */
  title: string;
  kind: ItemKind;
  hours: number;
  /** Price for extras, value for gifts, 0 otherwise. */
  amount: number;
  /** Working days this adds to delivery (extras only). */
  days: number;
  /** Only for extras. */
  status: ExtraStatus | null;
  /** Only for revisions: which included round this belongs to. */
  round: number | null;
  createdAt: number;
  decidedAt: number | null;
}
