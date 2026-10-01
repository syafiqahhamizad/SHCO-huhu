import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CasesListPage } from './cases/CasesListPage';
import { NewFilePage } from './cases/NewFilePage';
import { WorkingFile } from './cases/WorkingFile';

/**
 * Cases module (design: Cases List → Working File, New File Form, Case Flow).
 *  - New file being opened (isNewCaseModalOpen) → New File page
 *  - A file selected (currentCaseId)             → Working File
 *  - otherwise                                   → Cases List
 */
export const CasesView: React.FC = () => {
  const { cases = [], currentCaseId, setCurrentCaseId, isNewCaseModalOpen } = useApp();
  const selected = currentCaseId ? cases.find((c) => c.id === currentCaseId) : undefined;
  // A file that no longer exists (deleted elsewhere) drops back to the list.
  useEffect(() => { if (currentCaseId && !selected && cases.length) setCurrentCaseId(null); }, [currentCaseId, selected, cases.length, setCurrentCaseId]);
  if (isNewCaseModalOpen) return <NewFilePage />;
  if (selected) return <WorkingFile key={selected.id} c={selected} />;
  return <CasesListPage />;
};
