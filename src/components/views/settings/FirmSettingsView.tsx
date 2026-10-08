import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { PracticeSettings } from '../../../services/templateService';
import { css, usePracticeSettings, type SettingsCtx } from './settingsShared';
import { isSuper } from './permissionModel';
import { UsersTab } from './UsersTab';
import { PermissionsTab } from './PermissionsTab';
import { ApproversTab } from './ApproversTab';
import { DriveStorageCard } from './DriveStorageCard';
import { FirmTab } from './FirmTab';
import { BanksTab } from './BanksTab';
import { AreasTab } from './AreasTab';
import { FeeTemplatesTab } from './FeeTemplatesTab';
import { ListsTab } from './ListsTab';

/**
 * Firm & Practice Settings — design pack `firm-settings.dc.html` (COPY, DO NOT REDESIGN).
 * Tabs in the design's order (plus Google, e-mail & backup); inline styles are the design's own via css(). Users & Roles
 * replaces the old Users & Permissions page (routes 'users' / 'roles' open it here). Every change
 * is written to the Activity Log. Managing Partner (admin / super admin) only.
 */
const TABS: [string, string][] = [['users', 'Users & Roles'], ['perms', 'Permissions & limits'], ['apv', 'Who approves'], ['firm', 'Firm & Letterhead'], ['google', 'Google, e-mail & backup'], ['bank', 'Banks, Numbering & SST'], ['areas', 'Practice areas & codes'], ['tpl', 'Fee templates'], ['src', 'Lists & sources']];
const tabForView = (v: string) => (v === 'users' ? 'users' : v === 'roles' ? 'perms' : null);

export const FirmSettingsView = () => {
  const { currentUser, currentView, users = [], addActivityLog } = useApp();
  const [settings, saveSettings] = usePracticeSettings();
  const [tab, setTab] = useState<string>(() => tabForView(currentView) || 'users');
  const [permView, setPermView] = useState<'role' | 'person'>('role');
  const [who, setWho] = useState<string>(() => currentUser?.id || users[0]?.id || '');
  const [toast, setToast] = useState('');
  const tm = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { const t = tabForView(currentView); if (t) setTab(t); }, [currentView]);
  useEffect(() => () => clearTimeout(tm.current), []);

  const allowed = Boolean(currentUser?.isAdmin || isSuper(currentUser));
  if (!allowed) {
    return (
      <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:24px;max-width:640px;margin:24px auto;text-align:center;color:#16223A;font-family:Inter,system-ui,-apple-system,sans-serif')}>
        <strong style={css('font-family:ui-serif, Georgia, serif;font-size:16px')}>Admins only</strong>
        <p style={css('margin:6px 0 0;font-size:12px;line-height:1.5;color:#5B6478')}>Firm &amp; Practice Settings, Users &amp; Roles and permissions are managed by admins. Ask an admin if something here needs to change.</p>
      </div>
    );
  }

  const msg = (m: string) => { setToast(m); clearTimeout(tm.current); tm.current = setTimeout(() => setToast(''), 2400); };
  const C: SettingsCtx = {
    settings,
    save: (patch: Partial<PracticeSettings>, action: string, details: string) => { saveSettings(patch); addActivityLog('Settings · ' + action, details); },
    msg,
    log: (action: string, details: string) => addActivityLog(action, details),
    isSuperAdmin: isSuper(currentUser),
    go: (t, extra) => { if (extra?.who) { setWho(extra.who); setPermView('person'); } setTab(t); },
    who,
    setWho,
  };

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px;font-size:12px;color:#1E293B;font-family:Inter,system-ui,-apple-system,sans-serif')}>
      <section style={css('display:flex;gap:4px;border-bottom:1px solid #DDE3EB;overflow-x:auto')}>
        {TABS.map(([k, label]) => { const on = tab === k; return <button key={k} type="button" onClick={() => setTab(k)} style={css(`border:0;background:none;padding:9px 14px;margin-bottom:-1px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;color:${on ? '#16223A' : '#5B6478'};border-bottom:2px solid ${on ? '#16223A' : 'transparent'}`)}>{label}</button>; })}
      </section>
      {tab === 'users' && <UsersTab C={C} />}
      {tab === 'perms' && <PermissionsTab C={C} view={permView} setView={setPermView} />}
      {tab === 'apv' && <ApproversTab C={C} />}
      {tab === 'firm' && <FirmTab C={C} />}
      {tab === 'google' && <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start')}><DriveStorageCard C={C} /></div>}
      {tab === 'bank' && <BanksTab C={C} />}
      {tab === 'areas' && <AreasTab C={C} />}
      {tab === 'tpl' && <FeeTemplatesTab C={C} />}
      {tab === 'src' && <ListsTab C={C} />}
      {!!toast && <div style={css('position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:80;border-radius:8px;padding:10px 16px;background:#16223A;color:#fff;font-size:12px;font-weight:600')}>{toast}</div>}
    </div>
  );
};

