import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, PencilLine } from 'lucide-react';
import { canViewAs } from './views/settings/permissionModel';
import { useApp } from '../context/AppContext';
import { partnerCode } from '../lib/identity';
import type { PartnerCode, Role } from '../types';

/* Toolbar row directly under the Header (navigation shell design pack). Page actions that used
   to sit in the Header — "View as" user preview, the Super Admin role / partner switcher (moved
   from the sidebar footer) and Firm Start Centre "Edit content" — live here, right-aligned.
   Renders nothing when the viewer has no actions on this page. */

const selectCls = 'max-w-[230px] cursor-pointer rounded-md border border-[#DDE3EB] bg-white px-2 py-1 text-[11.5px] font-semibold text-[#16223A] focus:outline-none focus:ring-2 focus:ring-[#3D6B9C]/40';
const TOOLS_KEY = 'shco_view_tools';
const labelCls = 'flex items-center gap-1.5 text-[11px] font-semibold text-[#5B6478]';

export const PageToolbar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    currentUser,
    currentRole,
    setCurrentRole,
    currentPartnerCode,
    setCurrentPartnerCode,
    isAdmin,
    setIsAdmin,
    users,
    isUserPreview,
    previewUserId,
    startUserPreview,
    exitUserPreview,
    canEditFirmStartCentre,
    firmStartCentreEditMode,
    setFirmStartCentreEditMode,
    rolesMatrix,
  } = useApp();
  // Partner switcher: the real partners in Users & Roles (code — name).
  const partnerOptions: [string, string][] = (users || []).filter((u) => u.role === 'Partner' && u.status !== 'Inactive' && partnerCode(u)).map((u) => [partnerCode(u) as string, u.name]);

  // "View as" tools are off by default so the app looks exactly as it does for everyone else;
  // people allowed to use them (Settings › Permissions › View as) switch them on when needed.
  const canPreviewUsers = canViewAs(rolesMatrix, currentUser);
  const [toolsOn, setToolsOn] = useState(() => { try { return localStorage.getItem(TOOLS_KEY) === '1'; } catch { return false; } });
  const showTools = toolsOn || isUserPreview;
  const showRoleSwitcher = showTools && Boolean(currentUser?.isSuperAdmin) && !isUserPreview;
  const showEditContent = currentView === 'firmStartCentre' && canEditFirmStartCentre;

  /** Switching off returns to your own view: exits any preview and resets role, admin and partner. */
  const setTools = (on: boolean) => {
    setToolsOn(on);
    try { localStorage.setItem(TOOLS_KEY, on ? '1' : '0'); } catch { /* per-browser convenience only */ }
    if (on) return;
    if (isUserPreview) exitUserPreview();
    else if (currentUser) {
      setCurrentRole(currentUser.role);
      setIsAdmin(Boolean(currentUser.isAdmin || currentUser.isSuperAdmin));
      const own = (currentUser.code || currentUser.staffProfile?.staffId) as PartnerCode | undefined;
      if (own && ['SH', 'AH', 'ZA'].includes(own)) setCurrentPartnerCode(own);
      if (currentView === 'clientPortal' && currentUser.role !== 'Client') setCurrentView('dashboard');
    }
  };

  // With the tools off, a role/partner switch left over from an earlier session is undone.
  useEffect(() => {
    if (showTools || !currentUser?.role) return;
    if (currentRole !== currentUser.role) setCurrentRole(currentUser.role);
    const own = (currentUser.code || currentUser.staffProfile?.staffId) as PartnerCode | undefined;
    if (own && ['SH', 'AH', 'ZA'].includes(own) && currentPartnerCode !== own) setCurrentPartnerCode(own);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTools, currentUser?.id, currentUser?.role]);

  if (!isUserPreview && !canPreviewUsers && !showEditContent) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2" role="toolbar" aria-label="Page actions">
      {canPreviewUsers && !isUserPreview && (
        <button
          type="button"
          onClick={() => setTools(!toolsOn)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#DDE3EB] bg-white px-2 py-1 text-[11px] font-semibold text-[#5B6478] hover:bg-[#F6F8FA]"
          title={toolsOn ? 'Hide the View as tools and go back to your own view' : 'Show the View as tools'}
        >
          {toolsOn ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
          {toolsOn ? 'Hide view tools' : 'View as…'}
        </button>
      )}
      {showRoleSwitcher && (
        <>
          <label className={labelCls} title="Super Admin: view the app as another role">
            <span>Role</span>
            <select
              value={currentRole}
              onChange={(e) => {
                const newRole = e.target.value as Role;
                setCurrentRole(newRole);
                if (newRole === 'Client') setCurrentView('clientPortal');
                else if (currentView === 'clientPortal') setCurrentView('dashboard');
              }}
              className={selectCls}
              aria-label="Select your viewing role"
            >
              <option value="Partner">Partner (Full Firm Oversight)</option>
              <option value="Lawyer">Lawyer (Matters &amp; Practice Only)</option>
              <option value="Assistant">Assistant (Support &amp; Intake)</option>
              <option value="Accountant">Accountant (Bookkeeping / Data Entry)</option>
              <option value="Reviewer">Reviewer (External/Auditor)</option>
              <option value="Client">Client (Read-Only Portal)</option>
            </select>
          </label>
          <label className={`${labelCls} cursor-pointer`} title="Admin overlay reveals firm-wide cases and system views">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="cursor-pointer accent-[#3D6B9C]"
              aria-label="Enable admin overlay access"
            />
            <span>Admin overlay</span>
          </label>
          <label className={labelCls} title='Partner identity used for "My Cases"'>
            <span>Partner</span>
            <select
              value={currentPartnerCode}
              onChange={(e) => setCurrentPartnerCode(e.target.value as PartnerCode)}
              className={selectCls}
              aria-label="Select your partner identity"
            >
              {partnerOptions.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
            </select>
          </label>
        </>
      )}

      {isUserPreview ? (
        <span className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Viewing as {currentUser?.name}
          <button
            type="button"
            onClick={exitUserPreview}
            className="cursor-pointer rounded border border-amber-400 bg-white px-1.5 py-0.5 text-[10.5px] font-bold text-[#16223A] hover:bg-amber-100"
            title="Exit full-system user preview"
          >
            Exit preview
          </button>
        </span>
      ) : canPreviewUsers && showTools ? (
        <label className={labelCls}>
          <Eye className="h-3.5 w-3.5" aria-hidden />
          <span>View as</span>
          <select
            value={previewUserId || ''}
            onChange={(event) => { if (event.target.value) startUserPreview(event.target.value); }}
            className={selectCls}
            aria-label="Preview the app as another user"
          >
            <option value="">My view</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </label>
      ) : null}

      {showEditContent && (
        <button
          type="button"
          onClick={() => setFirmStartCentreEditMode((enabled) => !enabled)}
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold transition ${firmStartCentreEditMode ? 'border-[#16223A] bg-[#16223A] text-white' : 'border-[#DDE3EB] bg-white text-[#16223A] hover:bg-[#F6F8FA]'}`}
          title="Toggle Firm Start Centre content editing"
        >
          <PencilLine className="h-3.5 w-3.5" aria-hidden />
          {firmStartCentreEditMode ? 'Done editing' : 'Edit content'}
        </button>
      )}
    </div>
  );
};
