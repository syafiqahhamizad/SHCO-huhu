import { Lead, Deadline, ConflictMatch } from '../types';
import { normalizeClientName } from '../lib/stringUtils';

export interface GoogleFormSubmissionPayload {
  clientName: string;
  phone: string;
  email?: string;
  practiceArea?: string;
  preferredLawyer?: string;
  consultationDate: string; // YYYY-MM-DD
  consultationTime?: string; // e.g. "10:00 AM"
  consultationVenue?: string; // e.g. "In-Person (Firm Office)" or "Virtual (Google Meet)"
  caseSummary?: string;
  source?: string;
}

export interface GoogleFormIngestionContext {
  addLead: (lead: Lead) => void;
  addDeadline: (deadline: Deadline) => void;
  scanConflicts?: (term: string) => ConflictMatch[];
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Service Layer: Consumes Google Form submission payload data for new consultation requests.
 * Automatically populates a 'Leads' entry and adds a corresponding event to CalendarView.
 */
export function processGoogleFormSubmission(
  payload: GoogleFormSubmissionPayload,
  context: GoogleFormIngestionContext
): { lead: Lead; deadline: Deadline } {
  const normalizedName = normalizeClientName(payload.clientName || 'Prospective Client');
  const practiceArea = payload.practiceArea || 'Civil Litigation';
  const consultationDate = payload.consultationDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const timeSlot = payload.consultationTime || '10:00 AM';
  const lawyerPreference = payload.preferredLawyer || 'Syafiqah Hamizad (Partner)';
  const venue = payload.consultationVenue || 'In-Person (Firm Office)';

  // 1. Conflict screening
  const matches = context.scanConflicts ? context.scanConflicts(normalizedName) : [];

  // 2. Generate Lead record
  const leadId = `LD-GF-${Math.floor(1000 + Math.random() * 9000)}`;
  const leadObj: Lead = {
    id: leadId,
    name: normalizedName,
    phone: payload.phone || '',
    email: payload.email || '',
    practiceArea: practiceArea,
    source: payload.source || 'Google Form Consultation Link',
    referralSourceCategory: 'Website',
    referralDetail: `Consultation Booked for ${consultationDate} @ ${timeSlot}`,
    warmth: 'Hot',
    warmthLevel: 3,
    stage: 'Consultation',
    autoConflictMatches: matches,
    conflictCheck: {
      status: matches.length > 0 ? 'Flagged' : 'Clear',
      notes: matches.length > 0
        ? `Auto-flagged ${matches.length} conflict match(es) during Google Form intake`
        : 'Cleared upon online consultation intake',
      checkedBy: lawyerPreference,
      checkedDate: new Date().toISOString().split('T')[0],
    },
    quoteAmount: 0,
    followupDate: consultationDate,
  };

  // 3. Generate Calendar Event Deadline record
  const deadlineId = `DL-CONS-${Date.now()}`;
  const deadlineObj: Deadline = {
    id: deadlineId,
    caseId: '',
    title: `⚖️ Consultation: ${normalizedName} (${practiceArea}) [${timeSlot}]`,
    type: 'Compliance',
    dueDate: consultationDate,
    priority: 'High',
    status: 'In Progress',
    reminderDays: 1,
    notes: `Google Form Consultation Booking Intake\nClient Name: ${normalizedName}\nPhone: ${payload.phone}\nEmail: ${payload.email || 'N/A'}\nVenue: ${venue}\nSummary: ${payload.caseSummary || 'None provided'}`,
    partner: 'SH',
    lawyer: lawyerPreference,
  };

  // 4. Ingest into App state
  context.addLead(leadObj);
  context.addDeadline(deadlineObj);

  if (context.showToast) {
    context.showToast(
      `✅ Google Form intake processed! Created lead for "${normalizedName}" and scheduled on Calendar for ${consultationDate}.`
    );
  }

  return { lead: leadObj, deadline: deadlineObj };
}
