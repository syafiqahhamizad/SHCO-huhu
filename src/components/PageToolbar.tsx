import React from 'react';
import { Eye, PencilLine } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { PartnerCode, Role } from '../types';

/* Toolbar row directly under the Header (navigation shell design pack). Page actions that used
   to sit in the Header — "View as" user preview, the Super Admin role / partner switcher (moved
   from the sidebar footer) and Firm Start Centre "Edit content" — live here, right-aligned.
   Renders nothing when the viewer has no actions on this page. */

const selectCls = 'max-w-[230px] cursor-pointer rounded-md border border-[#DDE3EB] bg-white px-2 py-1 text-[11.5px] font-semibold text-[#16223A] focus:outline-none focus:ring-2 focus:ring-[#3D6B9C]/40';
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
  } = useApp();

  const canPreviewUsers = Boolean(currentUser?.isSuperAdmin) || (currentUser?.email || '').toLowerCase() === 'syafiqahhamizad@shcolaw.com';
  const showRoleSwitcher = Boolean(currentUser?.isSuperAdmin) && !isUserPreview;
  const showEditContent = currentView === 'firmStartCentre' && canEditFirmStartCentre;

  if (!isUserPreview && !canPreviewUsers && !showEditContent) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2" role="toolbar" aria-label="Page actions">
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
              <option value="SH">SH — Syafiqah Hamizad</option>
              <option value="AH">AH — Amer Haiqal</option>
              <option value="ZA">ZA — Zulaikha Afendi</option>
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
      ) : canPreviewUsers ? (
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
