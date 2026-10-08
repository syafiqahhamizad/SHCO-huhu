import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import type { Case } from '../../../types';
import { getPracticeSettings } from '../../../services/templateService';
import { isCourtDiaryConfigured } from '../../../services/googleCalendarService';
import { getGoogleClientId, hasValidGoogleToken } from '../../../services/googleWorkspaceAuth';
import { openedOf } from '../cases/caseModel';
import { dMonY } from '../staff/staffPortalShared';

const OK = '#2F6F4E';
const OFF = '#B23A2E';

/**
 * Bottom strip of My Dashboard (design: "Connected data"). Every status is what the portal
 * really has: the firm's own lists are live in the database; Google Calendar / Tasks show
 * whether they are set up; channels the portal has no link to yet say "not connected".
 */
export const ConnectedDataBar: React.FC = () => {
  const { cases, canViewModule, setCurrentView, isAdmin, currentUser } = useApp() as any;
  const settings = getPracticeSettings();
  const google = getGoogleClientId().source !== 'none';

  const sources: [string, string, string][] = [
    ['Finance & Billing', 'live', OK],
    ['Matters', 'live', OK],
    ['Staff Portal', 'live', OK],
    ['Leads & Referrals', 'live', OK],
    ['Google Calendar', isCourtDiaryConfigured() ? 'court diary set up' : 'not set up', isCourtDiaryConfigured() ? OK : OFF],
    ['Google Tasks', !google ? 'not set up' : hasValidGoogleToken('tasks') ? 'signed in' : 'set up', google ? OK : OFF],
    ['Google Business Profile', 'not connected', OFF],
    ['Meta (FB & IG)', 'not connected', OFF],
    ['TikTok', 'not connected', OFF],
    ['Google Analytics', 'not connected', OFF],
  ];

  const firstYear = useMemo(() => {
    const years = (cases || []).map((c: Case) => Number(openedOf(c).slice(0, 4))).filter((y: number) => y > 1900);
    return years.length ? Math.min(...years) : null;
  }, [cases]);

  const canSettings = canViewModule('practiceSettings');
  const admin = Boolean(isAdmin || currentUser?.isSuperAdmin);
  const last = settings.lastBackup;

  return (
    <section className="flex flex-wrap items-center gap-2 rounded-xl border border-[#DDE3EB] bg-white px-3.5 py-2.5">
      <span className="mr-1 text-[9.5px] font-bold uppercase tracking-[.1em] text-[#5B6478]">Connected data</span>
      {sources.map(([name, when, dot]) => (
        <span key={name} className="flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-[20px] border border-[#DDE3EB] px-2.5 py-[3px] text-[10.5px] font-semibold text-[#16223A]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
          {name}
          <span className="font-normal text-[#5B6478]"> · {when}</span>
        </span>
      ))}
      {canSettings && (
        <button type="button" onClick={() => setCurrentView('practiceSettings')} className="ml-auto whitespace-nowrap text-[10.5px] font-bold text-[#8A6D3B]">Manage connections</button>
      )}
      <div className="mt-1.5 flex w-full flex-wrap items-center gap-2.5 border-t border-[#EEF1F5] pt-2">
        <span className="flex items-center gap-1.5 text-[10.5px] text-[#16223A]">
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: last ? OK : OFF }} />
          {last ? (
            <>
              <strong>Backed up</strong> {dMonY(last.at)}{last.by ? ' · by ' + last.by : ''} · {last.webViewLink ? 'copy in Google Drive' : 'downloaded copy'}
            </>
          ) : (
            <strong>No firm backup taken yet</strong>
          )}
        </span>
        {firstYear && <span className="text-[10.5px] text-[#5B6478]">History from {firstYear}</span>}
        {admin && canSettings && (
          <button type="button" onClick={() => setCurrentView('practiceSettings')} className="ml-auto whitespace-nowrap rounded-md bg-[#16223A] px-2.5 py-[5px] text-[10.5px] font-bold text-white">
            Export all firm data
          </button>
        )}
      </div>
    </section>
  );
};
