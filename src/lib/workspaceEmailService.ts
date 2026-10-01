/* Google Workspace Gmail API Service for Finance Department Notifications */
import { clearGoogleTokens } from '../services/googleWorkspaceAuth';
import { sendEmail } from '../services/gmailService';
import { escapeHtml as esc } from './emailMime';

export interface EmailLogEntry {
  id: string;
  pvId: string;
  recipient: string;
  subject: string;
  sentAt: string;
  status: 'SENT' | 'PENDING' | 'FAILED';
  snippet: string;
  channel: 'Google Workspace Gmail API';
}

const STORAGE_KEY_EMAIL_LOGS = 'shco_workspace_email_logs';

/**
 * Gmail access now comes from the shared Google Workspace sign-in (services/googleWorkspaceAuth,
 * scope gmail.send), requested when the user clicks. These three functions are kept so older
 * imports still compile; tokens are no longer stored in sessionStorage.
 */
export function getGmailAccessToken(): string | null {
  return null;
}

/** @deprecated No-op: Gmail tokens come from googleWorkspaceAuth. */
export function setGmailAccessToken(_token: string): void {
  /* no-op */
}

export function clearGmailAccessToken(): void {
  clearGoogleTokens('gmail');
}

export function getEmailAuditLogs(): EmailLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMAIL_LOGS);
    if (!raw) return getDefaultInitialLogs();
    return JSON.parse(raw);
  } catch {
    return getDefaultInitialLogs();
  }
}

function saveEmailAuditLogs(logs: EmailLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_EMAIL_LOGS, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to save email logs', err);
  }
}

function getDefaultInitialLogs(): EmailLogEntry[] {
  // No made-up history: the log only ever shows what this device really tried to send.
  return [];
}

export interface PaymentVoucherNotificationPayload {
  pvId: string;
  date: string;
  accountSet: 'OFFICE' | 'CLIENT';
  voucherCategory: string;
  description: string;
  amount: number;
  fileRef?: string;
  preparedBy: string;
  recipientEmail?: string;
}

/**
 * Sends an email notification to the Finance Department when a Payment Voucher is generated
 */
export async function sendFinancePvNotificationEmail(
  payload: PaymentVoucherNotificationPayload
): Promise<{ success: boolean; message: string; logId: string }> {
  const recipient = payload.recipientEmail || 'finance@shcolaw.com';
  const subject = `[FINANCE ALERT] New Payment Voucher ${payload.pvId} Generated - Action Required`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; color: #1e293b;">
      <div style="background-color: #16223A; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">Syed Alwi, Syafiqah & Co.</h2>
        <p style="margin: 5px 0 0 0; font-size: 12px; color: #cbd5e1; text-transform: uppercase;">Finance & Accounts Department Notification</p>
      </div>

      <div style="padding: 24px; background-color: #ffffff;">
        <div style="background-color: #fef3c7; border-left: 4px solid #d97706; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
          <strong style="color: #92400e; font-size: 14px;">⚡ Automated Payment Voucher Notification</strong>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #78350f;">
            A new Payment Voucher <strong>${esc(payload.pvId)}</strong> has been generated and queued for Partner approval.
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Voucher ID:</td>
            <td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #0f172a;">${esc(payload.pvId)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Date Created:</td>
            <td style="padding: 8px 0; color: #0f172a;">${esc(payload.date)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Account Target:</td>
            <td style="padding: 8px 0; color: #0f172a;">${payload.accountSet === 'CLIENT' ? 'Client Trust Account' : 'Office Operating Account'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Category:</td>
            <td style="padding: 8px 0; color: #0f172a;">${esc(payload.voucherCategory)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Matter Ref:</td>
            <td style="padding: 8px 0; font-family: monospace; color: #0f172a;">${esc(payload.fileRef || 'General Firm Operations')}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Prepared By:</td>
            <td style="padding: 8px 0; color: #0f172a;">${esc(payload.preparedBy)}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #16223A; font-weight: bold; font-size: 15px;">Voucher Amount:</td>
            <td style="padding: 12px 0; font-family: monospace; font-weight: bold; font-size: 16px; color: #047857;">
              RM ${payload.amount.toFixed(2)}
            </td>
          </tr>
        </table>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
          <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; margin-bottom: 4px;">Particulars / Description</span>
          <p style="margin: 0; font-size: 13px; color: #334155;">${esc(payload.description)}</p>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <a href="#" style="background-color: #16223A; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">
            Open Firm Portal &amp; Review Payment Voucher
          </a>
        </div>
      </div>

      <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #64748b;">
        Automated Workspace Email Notification sent via Google Workspace Gmail API (Scope: gmail.send)
      </div>
    </div>
  `;

  const logId = `EML-${Date.now()}`;
  let sentSuccessfully = false;
  let statusMessage = '';

  try {
    const text = [
      'A new Payment Voucher ' + payload.pvId + ' has been generated and queued for Partner approval.',
      '',
      'Voucher ID: ' + payload.pvId,
      'Date: ' + payload.date,
      'Account: ' + payload.accountSet,
      'Category: ' + payload.voucherCategory,
      'File reference: ' + (payload.fileRef || 'General Firm Operations'),
      'Prepared by: ' + payload.preparedBy,
      'Amount: RM ' + payload.amount.toFixed(2),
      '',
      'Particulars: ' + payload.description,
    ].join('\n');
    await sendEmail({ to: recipient, subject, text, html: htmlBody });
    sentSuccessfully = true;
    statusMessage = `Sent to ${recipient} via Gmail`;
  } catch (err) {
    sentSuccessfully = false;
    statusMessage = `Not sent — ${err instanceof Error ? err.message : String(err)}`;
  }

  // Create audit log entry
  const newLog: EmailLogEntry = {
    id: logId,
    pvId: payload.pvId,
    recipient,
    subject,
    sentAt: new Date().toISOString(),
    status: sentSuccessfully ? 'SENT' : 'FAILED',
    snippet: `PV ${payload.pvId} (RM ${payload.amount.toFixed(2)}) for ${payload.voucherCategory}. Prepared by ${payload.preparedBy}`,
    channel: 'Google Workspace Gmail API',
  };

  const existingLogs = getEmailAuditLogs();
  saveEmailAuditLogs([newLog, ...existingLogs]);

  return {
    success: sentSuccessfully,
    message: statusMessage,
    logId,
  };
}
