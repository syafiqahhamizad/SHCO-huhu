import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { identityTokens } from '../../../lib/identity';
import { buildFileDirectory, buildMyClaimRows } from './staffPortalShared';
import { StaffClaimsTab } from './StaffClaimsTab';

/** Sidebar → My Claims: the signed-in person's own claims and payment requests. */
export const MyClaimsView: React.FC = () => {
  const { currentUser, users, travelClaims, expenses, paymentVouchers, cases, clients } = useApp();
  const me = useMemo(() => identityTokens(currentUser), [currentUser]);
  const dir = useMemo(() => buildFileDirectory(cases || [], clients || [], users || []), [cases, clients, users]);
  const rows = useMemo(
    () => buildMyClaimRows(me, travelClaims || [], expenses || [], paymentVouchers || [], dir),
    [me, travelClaims, expenses, paymentVouchers, dir]
  );

  if (currentUser.role === 'Client') return <div style={{ padding: 32, textAlign: 'center' }}>My Claims is available to staff accounts only.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: '#1E293B', fontSize: 12, lineHeight: 'normal' }}>
      <StaffClaimsTab rows={rows} dir={dir} />
    </div>
  );
};
