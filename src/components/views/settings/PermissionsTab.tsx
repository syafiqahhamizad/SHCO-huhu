import React, { useState } from 'react';
import { askForm } from '../../ui/askForm';
import { useApp } from '../../../context/AppContext';
import { DEFAULT_APPROVAL_LIMITS, type ApprovalLimits } from '../../../services/templateService';
import { css, S, SideMenu, Txt, type SettingsCtx } from './settingsShared';
import { useRemembered } from '../../../lib/navHistory';
import { PERM_ROWS, FIXED_ROLE_COLS, parentOf, roleOwnBits, personBits, personRoleBits, personChanges, isManagingPartner, isSuper, designRole, fromBits, flipBit } from './permissionModel';

const BIT: [string, string, string, string][] = [['V', 'view', '#E6EFE9', '#2F6F4E'], ['A', 'add', '#E7EEF6', '#2F5680'], ['E', 'edit / approve', '#F7E9EE', '#8C2F4C']];
const pill = (on: boolean, bg: string, fg: string, cap: boolean) => `border:1px solid ${on ? fg + '55' : '#E6EAF0'};background:${on ? bg : '#fff'};color:${on ? fg : cap ? '#B8C1CE' : '#E1E6EC'}`;
const BOX = 'width:22px;height:20px;border-radius:5px;padding:0;font-size:9.5px;font-weight:800;cursor:pointer;font-family:inherit;';
const LIMITS: [keyof ApprovalLimits, string][] = [['anyPartnerUpTo', 'Any partner can approve below'], ['mpPlusOneAbove', 'Super Admin + 1 signatory at and above (per claim / PV form total)'], ['clientAccount', 'Client account payments'], ['writeOffs', 'Write-offs'], ['staffClaimsFlag', 'Staff claims per month (auto-flag above)']];
const RULES = ['Data is filtered on the server by role + assigned files', 'Every view, change and approval is written to Activity Logs', '2-step login required for the Super Admin, Partners, Accounts', 'Issued documents cannot be edited: cancel and reissue', 'Nothing is hard-deleted; admin delete is recoverable'];

export const PermissionsTab = ({ C, view, setView }: { C: SettingsCtx; view: 'role' | 'person'; setView: (v: 'role' | 'person') => void }) => {
  const { rolesMatrix = {}, users = [], customRoles = [], setRoleModulePermissions, setUserNavOverride, resetUserNavOverrides, addCustomRole } = useApp();
  const [, force] = useState(0);
  const [sec, setSec] = useRemembered('settings.perms', 'What each role can open');
  const cols: [string, string][] = [...FIXED_ROLE_COLS, ...customRoles.map((r) => [r, r] as [string, string])];
  const permCols = 'minmax(0,1fr) repeat(' + cols.length + ',88px)';
  const denied = () => { C.msg('Only the Super Admin can change permissions'); return false; };

  const addRole = () => {
    if (!C.isSuperAdmin) return denied();
    void askForm('Add a role', [{ key: 'n', label: 'Name of the role', value: 'Custom role ' + (customRoles.length + 1), required: true }], { note: 'It starts as a copy of Assistant; change its ticks after.' }).then((v) => { if (v) addRoleNamed(v.n.trim()); });
  };
  const addRoleNamed = (name: string) => {
    if (!addCustomRole(name)) return;
    PERM_ROWS.forEach(([k]) => setRoleModulePermissions(name, k, fromBits(roleOwnBits(rolesMatrix, 'Assistant', k))));
    C.log('Custom Role Created', name + ' (copy of Assistant)');
    C.msg(name + ' added as a copy of Assistant');
    force((x) => x + 1);
  };

  const u = users.find((x) => x.id === C.who) || users[0];
  const uMP = !!u && isManagingPartner(u);
  const nChg = u ? personChanges(rolesMatrix, u) : 0;

  return (
    <SideMenu items={[['What each role can open'], ['Approval limits', LIMITS.length], ['Always on', RULES.length]]} value={sec} onPick={setSec}>
      {sec === 'What each role can open' && <div style={css(S.card)}>
        <div style={css('display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>What each role can open</strong><span style={css(S.sub)}>every tab and sub-tab is one permission key · the sidebar, the sub-tabs and the server all read the same key, so switching it off here hides and blocks it everywhere</span><button type="button" onClick={addRole} style={css('margin-left:auto;flex:none;border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>+ Add custom role</button></div>
        <div style={css('display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid #EEF1F5;background:#fff')}>
          {([['role', 'By role'], ['person', 'By person']] as ['role' | 'person', string][]).map(([k, label]) => { const on = view === k; return <button key={k} type="button" onClick={() => setView(k)} style={css(`border-radius:14px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{label}</button>; })}
          <span style={css(S.sub)}>Step 1: set each role. Step 2: check each person and change only where needed. A person gets their role’s boxes plus their own changes.</span>
        </div>

        {view === 'person' && (
          !u ? <div style={css('padding:14px;font-size:11px;color:#5B6478')}>No users in the roster yet.</div> : <>
            <div style={css('display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #EEF1F5;background:#F6F8FA')}>
              <select value={u.id} onChange={(e) => C.setWho(e.target.value)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:12px;font-weight:700;color:#16223A;background:#fff;min-width:320px')}>
                {users.map((x) => <option key={x.id} value={x.id}>{x.name + ' · ' + designRole(x) + (isSuper(x) ? ' · Super admin' : x.isAdmin ? ' · Admin' : '') + (x.status === 'Inactive' ? ' · switched off' : '')}</option>)}
              </select>
              <span style={css('font-size:11px;color:#16223A')}>{'Role: ' + designRole(u) + ((u.isAdmin || isSuper(u)) && !uMP ? ' + admin' : '') + ' · ' + (nChg ? nChg + ' change' + (nChg > 1 ? 's' : '') + ' just for this person' : 'exactly the same as the role')}</span>
              <button type="button" onClick={() => { if (!C.isSuperAdmin) return denied(); resetUserNavOverrides(u.id); C.log('Permissions Reset', u.name + ' reset to ' + designRole(u)); C.msg(u.name + ' reset to ' + designRole(u)); }} style={css('margin-left:auto;border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#B23A2E;cursor:pointer;font-family:inherit')}>Reset to role</button>
            </div>
            <div style={css('display:grid;grid-template-columns:minmax(0,1fr) 110px 110px 170px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Tab · sub-tab · key</span><span style={css('text-align:center')}>Role gives</span><span style={css('text-align:center')}>This person</span><span>Status</span></div>
            {PERM_ROWS.map(([key, label, parent]) => {
              const rb = personRoleBits(rolesMatrix, u, key), me = personBits(rolesMatrix, u, key), cap = parent ? personBits(rolesMatrix, u, parent) : '111', chg = me !== rb;
              return (
                <div key={key} style={css(`display:grid;grid-template-columns:minmax(0,1fr) 110px 110px 170px;gap:10px;align-items:center;padding:5px 14px;border-bottom:1px solid #F0F2F5;background:${chg ? '#FFFBF3' : parent ? '#fff' : '#FAFBFC'}`)}>
                  <span style={css(`min-width:0;display:flex;align-items:baseline;gap:8px;padding-left:${parent ? '18px' : '0'}`)}><span style={css(`font-size:11.5px;font-weight:${parent ? 500 : 800};color:#16223A`)}>{label}</span><span style={css('font-family:ui-monospace, Menlo, monospace;font-size:9.5px;color:#94A3B8')}>{key}</span></span>
                  <span style={css('display:flex;gap:3px;justify-content:center')}>{BIT.map(([l, , bg, fg], bi) => <span key={l} style={css('width:22px;height:20px;border-radius:5px;display:grid;place-items:center;font-size:9.5px;font-weight:800;' + pill(rb[bi] === '1', bg, fg, true))}>{l}</span>)}</span>
                  <span style={css('display:flex;gap:3px;justify-content:center')}>{BIT.map(([l, tip, bg, fg], bi) => {
                    const c = cap[bi] === '1', onB = me[bi] === '1' && c;
                    const flip = () => {
                      if (uMP) return C.msg('The Super Admin always has full access');
                      if (!c) return C.msg('Switch on ' + l + ' for the main tab first');
                      if (!C.isSuperAdmin) return denied();
                      const nb = flipBit(me, bi);
                      setUserNavOverride(u.id, key, nb === rb ? null : fromBits(nb));
                      C.log('Permission Changed', u.name + ' · ' + label + ': ' + tip + (me[bi] === '1' ? ' off' : ' on') + ' (' + key + ')');
                      C.msg(u.name + ' · ' + label + ': ' + tip + (me[bi] === '1' ? ' off' : ' on') + ' (saved as their own ' + key + ')');
                    };
                    return <button key={l} type="button" onClick={flip} title={u.name + ' · ' + tip} style={css(BOX + pill(onB, bg, fg, c))}>{l}</button>;
                  })}</span>
                  <span style={css(`font-size:10.5px;font-weight:700;color:${chg ? '#8A6534' : '#94A3B8'}`)}>{chg ? 'Changed for this person' : 'Same as role'}</span>
                </div>
              );
            })}
          </>
        )}

        {view === 'role' && <>
          <div style={css(`display:grid;grid-template-columns:${permCols};gap:6px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5;align-items:end`)}><span>Tab · sub-tab · key</span>{cols.map(([name]) => <span key={name} style={css('display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center')}><span>{name}</span><span style={css('font-size:8.5px;letter-spacing:.2em;color:#94A3B8')}>V A E</span></span>)}</div>
          {PERM_ROWS.map(([key, label, parent]) => (
            <div key={key} style={css(`display:grid;grid-template-columns:${permCols};gap:6px;align-items:center;padding:5px 14px;border-bottom:1px solid #F0F2F5;background:${parent ? '#fff' : '#FAFBFC'}`)}>
              <span style={css(`min-width:0;display:flex;align-items:baseline;gap:8px;padding-left:${parent ? '18px' : '0'}`)}><span style={css(`font-size:11.5px;font-weight:${parent ? 500 : 800};color:#16223A`)}>{label}</span><span style={css('font-family:ui-monospace, Menlo, monospace;font-size:9.5px;color:#94A3B8')}>{key}</span></span>
              {cols.map(([name, role], ri) => {
                const own = ri === 0 ? '111' : roleOwnBits(rolesMatrix, role, key);
                const capB = ri === 0 || !parent ? '111' : roleOwnBits(rolesMatrix, role, parentOf(key) as string);
                return (
                  <span key={name} style={css('display:flex;gap:3px;justify-content:center')}>{BIT.map(([l, tip, bg, fg], bi) => {
                    const ownOn = own[bi] === '1', cap = capB[bi] === '1', onB = ownOn && cap;
                    const flip = () => {
                      if (ri === 0) return C.msg('The Super Admin always has full access');
                      if (!cap) return C.msg('Switch on ' + l + ' for the main tab first');
                      if (!C.isSuperAdmin) return denied();
                      setRoleModulePermissions(role, key, fromBits(flipBit(own, bi)));
                      C.log('Permission Changed', name + ' · ' + label + ': ' + tip + (ownOn ? ' off' : ' on') + ' (' + key + ')');
                      C.msg(name + ' · ' + label + ': ' + tip + (ownOn ? ' off' : ' on') + ' (saved as ' + key + ')');
                    };
                    return <button key={l} type="button" onClick={flip} title={name + ' · ' + tip + (cap ? '' : ' (blocked by the tab)')} style={css(BOX + pill(onB, bg, fg, cap))}>{l}</button>;
                  })}</span>
                );
              })}
            </div>
          ))}
        </>}
        <div style={css('display:flex;gap:14px;flex-wrap:wrap;padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}><span><strong style={css('color:#2F6F4E')}>V</strong> can see the tab</span><span><strong style={css('color:#2F5680')}>A</strong> can add / submit</span><span><strong style={css('color:#8C2F4C')}>E</strong> can edit / approve</span><span>A sub-tab can never have more than its tab (greyed = blocked by the tab).</span><span>Lawyers and Assistants only ever see files they are on.</span><span>The Super Admin always has everything.</span></div>
      </div>}

        {sec === 'Approval limits' && <div style={css(S.card + ';max-width:760px')}>
          <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Approval limits</strong></div>
          {LIMITS.map(([k, label]) => {
            const value = C.settings.approvalLimits?.[k] ?? DEFAULT_APPROVAL_LIMITS[k];
            return (
              <div key={k} style={css('display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5')}><span style={css('font-size:11.5px;color:#16223A')}>{label}</span><Txt value={value} onCommit={(v) => C.save({ approvalLimits: { ...(C.settings.approvalLimits || {}), [k]: v } }, 'Approval Limit Changed', label + ': ' + value + ' → ' + v)} style="border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A" /></div>
            );
          })}
        </div>}
        {sec === 'Always on' && <div style={css('max-width:760px;border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:12px 14px;display:flex;flex-direction:column;gap:6px')}>
          <strong style={css(S.h)}>Always on</strong>
          {RULES.map((r) => <span key={r} style={css('display:flex;gap:8px;font-size:11px;line-height:1.5;color:#16223A')}><span style={css('color:#2F6F4E;font-weight:800')}>✓</span>{r}</span>)}
        </div>}
    </SideMenu>
  );
};

