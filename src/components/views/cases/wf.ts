import type { Case, CaseActivityLog, MatterClientUpdate, MatterParty, Task } from '../../../types';
import type { TaskDraft } from '../../ui/TaskFormModal';
import type { Person, matterMoney } from './caseModel';
import { stamp } from './caseModel';

/** Everything a Working File tab needs, passed down from WorkingFile. */
export interface WF {
  c: Case;
  staff: Person[];
  me: string;
  meCode: string;
  isPartner: boolean;
  /** Role 'Assistant' is treated as the design's "Clerk": no Money tab / money strip. */
  isClerk: boolean;
  seeFin: boolean;
  /** Closed / archived files are read-only until a partner reopens them. */
  ro: boolean;
  parties: MatterParty[];
  money: ReturnType<typeof matterMoney>;
  /** One updateCase call per action. `what` adds a line to the file history. */
  save: (patch: Partial<Case>, what?: string, type?: CaseActivityLog['type']) => void;
  /** Like save, but builds the patch from the LATEST case (use after an await). */
  saveWith: (fn: (latest: Case) => Partial<Case>, what?: string, type?: CaseActivityLog['type']) => void;
  /** Signed-in user's id (Google Tasks ids are kept per user). */
  meId: string;
  toast: (m: string) => void;
  setTab: (t: string) => void;
  openTask: (t?: Task, preset?: Partial<TaskDraft>) => void;
  openWeekly: () => void;
  /** Court tab: open the change-of-coram / change-of-solicitors form. */
  courtChange: '' | 'coram' | 'sol';
  setCourtChange: (k: '' | 'coram' | 'sol') => void;
}

export const histEntry = (title: string, actor: string, type: CaseActivityLog['type'] = 'Status Update'): CaseActivityLog => ({
  id: 'CAL-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
  timestamp: stamp().replace('T', ' '),
  type,
  title,
  description: title,
  actor,
});

/** A client update prepared on the file. Messaging isn't connected: it is never marked sent. */
export const prepUpdate = (u: Pick<MatterClientUpdate, 'trigger' | 'title' | 'message'>, by: string, channels: MatterClientUpdate['channels'] = ['whatsapp', 'email']): MatterClientUpdate => ({
  id: 'CU-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
  at: stamp(),
  channels,
  deliveryStatus: 'Prepared — not sent' as const,
  by,
  ...u,
});

export const newId = (p: string) => p + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
