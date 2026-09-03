import { Case, Client } from '../types';

/**
 * Matter Service & Data Sync Utility
 * Manages '001'-based auto-incrementing matter numbers and bidirectional client-matter linking.
 */

/**
 * Computes the next 3-digit auto-incrementing matter sequence number (e.g. '001', '002', '003').
 * It checks existing cases in the registry to determine the highest existing sequence
 * and compares it against sequenceCounter to ensure consistent, non-duplicating sequence IDs.
 */
export const generateNextMatterSequenceNumber = (
  cases: Case[] = [],
  sequenceCounter: number = 1
): string => {
  let highestFound = 0;

  cases.forEach((c) => {
    if (!c.ref) return;
    const segments = c.ref.split('/').map((segment) => segment.trim());
    const dateIndex = segments.findIndex((segment) => /^\d{2}-\d{2}(?:\d{2})?$/.test(segment));

    if (dateIndex > 0) {
      const runningNumber = Number(segments[dateIndex - 1]);
      if (Number.isInteger(runningNumber) && runningNumber >= 0 && runningNumber < 1000 && runningNumber > highestFound) {
        highestFound = runningNumber;
      }
      return;
    }

    // Legacy references may end with a standalone year, e.g. .../001/2025.
    if (/^\d{4}$/.test(segments.at(-1) || '')) {
      const runningNumber = Number(segments.at(-2));
      if (Number.isInteger(runningNumber) && runningNumber >= 0 && runningNumber < 1000 && runningNumber > highestFound) {
        highestFound = runningNumber;
      }
      return;
    }

    // Preserve support for legacy references such as CS-001 without reading years.
    const legacyMatch = c.ref.match(/CS-(\d{3,4})(?:$|\/)/i);
    if (legacyMatch) {
      const runningNumber = Number(legacyMatch[1]);
      if (runningNumber > highestFound) highestFound = runningNumber;
    }
  });

  // Older parsing treated a trailing year such as 2028 as the running number.
  // Ignore year-sized persisted counters so existing browser data self-corrects.
  const usableCounter = sequenceCounter >= 1000 ? 1 : sequenceCounter || 1;
  const nextSeq = Math.max(highestFound + 1, usableCounter, 1);
  return String(nextSeq).padStart(3, '0');
};

/**
 * Unified Data-Sync Utility
 * Ensures every case created or updated in the registry automatically links the client's master record
 * to their specific matter list (associatedCases & associatedCaseRefs), and vice-versa.
 */
export const syncClientMatterLinks = (
  allCases: Case[],
  allClients: Client[]
): Client[] => {
  if (!allClients || allClients.length === 0) return [];

  // Build map of client ID -> Set of case IDs and Set of case Refs
  const clientCaseMap = new Map<string, { caseIds: Set<string>; caseRefs: Set<string> }>();

  // Populate map based on all registered cases
  allCases.forEach((cs) => {
    const linkedClientIds = new Set<string>();

    // 1. Check cs.clientId (single or comma separated)
    if (cs.clientId) {
      cs.clientId.split(',').forEach((id) => {
        const cleanId = id.trim();
        if (cleanId) linkedClientIds.add(cleanId);
      });
    }

    // 2. Check cs.clientsList
    if (cs.clientsList && Array.isArray(cs.clientsList)) {
      cs.clientsList.forEach((cl) => {
        if (cl.clientId) linkedClientIds.add(cl.clientId.trim());
        if (cl.id && cl.id.startsWith('HQ-C')) linkedClientIds.add(cl.id.trim());
      });
    }

    // 3. Fallback: match by clientName if ID not explicit
    if (cs.clientName) {
      const lowerCsName = cs.clientName.toLowerCase();
      allClients.forEach((client) => {
        if (client.name && lowerCsName.includes(client.name.toLowerCase())) {
          linkedClientIds.add(client.id);
        }
      });
    }

    // Associate case ID & Ref to each matched client
    linkedClientIds.forEach((cid) => {
      if (!clientCaseMap.has(cid)) {
        clientCaseMap.set(cid, { caseIds: new Set(), caseRefs: new Set() });
      }
      const entry = clientCaseMap.get(cid)!;
      entry.caseIds.add(cs.id);
      if (cs.ref) entry.caseRefs.add(cs.ref);
    });
  });

  // Update client master records with synced matter lists
  return allClients.map((client) => {
    const syncedData = clientCaseMap.get(client.id);
    const updatedCaseIds = Array.from(syncedData?.caseIds || []);
    const updatedCaseRefs = Array.from(syncedData?.caseRefs || []);

    // Return updated client record if changed
    const currentCaseIdsStr = [...(client.associatedCases || [])].sort().join(',');
    const newCaseIdsStr = [...updatedCaseIds].sort().join(',');
    const currentCaseRefsStr = [...(client.associatedCaseRefs || [])].sort().join(',');
    const newCaseRefsStr = [...updatedCaseRefs].sort().join(',');

    if (currentCaseIdsStr !== newCaseIdsStr || currentCaseRefsStr !== newCaseRefsStr) {
      return {
        ...client,
        associatedCases: updatedCaseIds,
        associatedCaseRefs: updatedCaseRefs,
      };
    }

    return client;
  });
};
