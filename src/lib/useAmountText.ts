import { useApp } from '../context/AppContext';
import { canSeeClientBilling, finGrants, finRoleKey } from './financeAccess';
import { hideAmounts } from './hideAmounts';

/**
 * Logs and notifications are read by everyone, so amounts in them are shown only to people who
 * may see billing (Users & Roles › Billing & money); everyone else gets "RM •••".
 */
export function useAmountText(): (text: string) => string {
  const { currentRole, currentUser, isAdmin } = useApp();
  const sees = canSeeClientBilling(finRoleKey(currentRole, currentUser, isAdmin), finGrants(currentUser));
  return sees ? (t: string) => t : hideAmounts;
}
