import React from 'react';
import { CourtDiaryEntry, Case } from '../../types';
import { X, Printer, Download } from 'lucide-react';

interface CourtMemoModalProps {
  entry: CourtDiaryEntry;
  caseObj?: Case;
  onClose: () => void;
}

export const CourtMemoModal: React.FC<CourtMemoModalProps> = ({ entry, caseObj, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const dayOfWeek = entry.date
    ? new Date(entry.date).toLocaleDateString('en-MY', { weekday: 'long' })
    : '';

  return (
    <div className="fixed inset-0 bg-[#16223A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-6 overflow-hidden border border-[#E1DCCF]">
        {/* Top Control Bar */}
        <div className="bg-[#16223A] text-white px-6 py-3 flex justify-between items-center print:hidden">
          <div className="font-serif font-bold text-sm tracking-wide">Court Memo Official Form</div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1 bg-[#A9814A] hover:bg-[#8e6b3b] text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Export PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Printable Area */}
        <div className="p-8 space-y-4 text-black font-serif bg-white" id="court-memo-print-area">
          {/* Header Branding */}
          <div className="flex justify-between items-end border-b-2 border-black pb-3">
            <div className="flex items-center gap-3">
              <div className="font-serif text-3xl font-extrabold tracking-tight border-r-2 border-black pr-3 leading-none">
                S<span className="text-sm font-sans font-normal uppercase">H</span>
              </div>
              <div>
                <h1 className="font-serif font-bold text-lg uppercase tracking-wider leading-tight">
                  Syafiqah Hamizad &amp; Co
                </h1>
                <p className="text-[10px] font-sans text-slate-700 tracking-tight">
                  Advocates &amp; Solicitors • Peguambela &amp; Peguamcara
                </p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="font-serif text-2xl font-black uppercase tracking-widest leading-none">
                Court Memo
              </h2>
            </div>
          </div>

          {/* Form Table */}
          <table className="w-full border-collapse border border-black text-xs font-sans">
            <tbody>
              {/* Row 1: Date/Day */}
              <tr className="border-b border-black">
                <td className="p-2 font-bold uppercase bg-slate-50 w-36 border-r border-black">DATE/DAY:</td>
                <td className="p-2 font-medium" colSpan={2}>
                  {entry.date} {dayOfWeek ? `(${dayOfWeek.toUpperCase()})` : ''}
                </td>
              </tr>

              {/* Row 2: Case No */}
              <tr className="border-b border-black">
                <td className="p-2 font-bold uppercase bg-slate-50 border-r border-black">CASE NO:</td>
                <td className="p-2 font-mono font-bold" colSpan={2}>
                  {entry.caseNo || (caseObj ? caseObj.courtCaseNo || caseObj.ref : '—')}
                </td>
              </tr>

              {/* Row 3: Court */}
              <tr className="border-b border-black">
                <td className="p-2 font-bold uppercase bg-slate-50 border-r border-black">COURT:</td>
                <td className="p-2 font-medium" colSpan={2}>
                  {entry.court || (caseObj ? caseObj.court : '—')}
                </td>
              </tr>

              {/* Row 4: Matter */}
              <tr className="border-b border-black">
                <td className="p-2 font-bold uppercase bg-slate-50 border-r border-black">MATTER:</td>
                <td className="p-2 font-medium" colSpan={2}>
                  {entry.matter || (caseObj ? caseObj.title : '—')}
                </td>
              </tr>

              {/* Row 4B: Represented Side / Client Role */}
              <tr className="border-b border-black bg-amber-50/50">
                <td className="p-2 font-bold uppercase bg-slate-100 border-r border-black">
                  WE REPRESENT (CLIENT SIDE):
                </td>
                <td className="p-2 font-bold text-[#16223A] uppercase tracking-wide" colSpan={2}>
                  <span className="bg-black text-white px-2 py-0.5 rounded font-mono text-xs">
                    {entry.clientRole || caseObj?.clientRole || 'PLAINTIFF'}
                  </span>
                  {caseObj?.type && <span className="ml-2 text-slate-600 text-xs font-normal">({caseObj.type})</span>}
                </td>
              </tr>

              {/* Row 5: Corum Before */}
              <tr className="border-b border-black">
                <td className="p-2 font-bold uppercase bg-slate-50 border-r border-black">
                  CORUM BEFORE:
                </td>
                <td className="p-2 font-medium" colSpan={2}>
                  {entry.corum || (caseObj ? caseObj.judge : '—')}
                </td>
              </tr>

              {/* Row 6: Medium */}
              <tr className="border-b border-black">
                <td className="p-2 font-bold uppercase bg-slate-50 border-r border-black">MEDIUM:</td>
                <td className="p-2 font-semibold tracking-wide" colSpan={2}>
                  <div className="flex gap-6">
                    <span className={entry.medium === 'OPEN COURT' ? 'font-bold underline' : 'text-slate-400'}>
                      OPEN COURT
                    </span>
                    <span>/</span>
                    <span className={entry.medium === 'IN CHAMBERS' ? 'font-bold underline' : 'text-slate-400'}>
                      IN CHAMBERS
                    </span>
                    <span>/</span>
                    <span className={entry.medium === 'E-REVIEW' ? 'font-bold underline' : 'text-slate-400'}>
                      E-REVIEW
                    </span>
                  </div>
                </td>
              </tr>

              {/* Row 7: Lawyer Attendance Header */}
              <tr className="border-b border-black bg-slate-100">
                <td colSpan={3} className="p-2 font-bold uppercase tracking-wider text-[11px]">
                  LAWYER ATTENDANCE
                </td>
              </tr>

              {/* Row 8: Plaintiff / Appellant */}
              <tr className="border-b border-black">
                <td className="p-2 font-bold uppercase bg-slate-50 border-r border-black">
                  PLAINTIFF / APPELLANT / JC / APPLICANT:
                </td>
                <td className="p-2 font-medium" colSpan={2}>
                  {entry.plaintifApplicant || entry.ourLawyerAttendance || '—'}
                </td>
              </tr>

              {/* Row 9: Defendant / Respondent / Opposing Solicitors */}
              <tr className="border-b border-black">
                <td className="p-2 font-bold uppercase bg-slate-50 border-r border-black">
                  DEFENDANT / RESPONDENT / OPPOSING SOLICITORS:
                </td>
                <td className="p-2 font-medium" colSpan={2}>
                  <div className="space-y-0.5">
                    {(entry.opposingFirm || caseObj?.opposingSolicitorsFirm || (caseObj?.opposingCounsel && caseObj.opposingCounsel.length > 0)) && (
                      <div className="font-bold text-[#16223A]">
                        FIRM: {entry.opposingFirm || caseObj?.opposingSolicitorsFirm || caseObj?.opposingCounsel?.join(', ')}
                        {caseObj?.opposingSolicitorsRef && (
                          <span className="font-mono text-[11px] text-slate-600 ml-2 font-normal">
                            (Ref: {caseObj.opposingSolicitorsRef})
                          </span>
                        )}
                      </div>
                    )}
                    <div>
                      ATTENDANCE: {entry.defendantRespondent || entry.opponentCounselAttendance || entry.opposingCounselName || caseObj?.opposingSolicitorsName || '—'}
                    </div>
                  </div>
                </td>
              </tr>

              {/* Row 10: Client Attendance */}
              <tr className="border-b border-black">
                <td className="p-2 font-bold uppercase bg-slate-50 border-r border-black">
                  CLIENT ( {entry.clientName || (caseObj ? caseObj.clientId : '')} ):
                </td>
                <td className="p-2 font-bold" colSpan={2}>
                  <span className={entry.clientAttendance === 'Present' ? 'bg-black text-white px-2 py-0.5 rounded' : 'text-slate-400'}>
                    PRESENT
                  </span>
                  {' / '}
                  <span className={entry.clientAttendance === 'Not Present' ? 'bg-black text-white px-2 py-0.5 rounded' : 'text-slate-400'}>
                    NOT PRESENT
                  </span>
                </td>
              </tr>

              {/* Row 11: Opponent Attendance */}
              <tr className="border-b border-black">
                <td className="p-2 font-bold uppercase bg-slate-50 border-r border-black">
                  OPPONENT ( {entry.opponentName || (caseObj ? caseObj.opposingParty : '')} ):
                </td>
                <td className="p-2 font-bold" colSpan={2}>
                  <span className={entry.opponentAttendance === 'Present' ? 'bg-black text-white px-2 py-0.5 rounded' : 'text-slate-400'}>
                    PRESENT
                  </span>
                  {' / '}
                  <span className={entry.opponentAttendance === 'Not Present' ? 'bg-black text-white px-2 py-0.5 rounded' : 'text-slate-400'}>
                    NOT PRESENT
                  </span>
                </td>
              </tr>

              {/* Row 12: Case Status & Instructions */}
              <tr className="border-b border-black">
                <td className="p-3 align-top border-r border-black w-1/2" colSpan={2}>
                  <div className="font-bold uppercase text-[11px] underline mb-1.5">CASE STATUS:</div>
                  <div className="whitespace-pre-wrap leading-relaxed min-h-32 text-slate-900">
                    {entry.caseStatus || '—'}
                  </div>
                </td>
                <td className="p-3 align-top w-1/2">
                  <div className="font-bold uppercase text-[11px] underline mb-1.5">INSTRUCTIONS:</div>
                  <div className="whitespace-pre-wrap leading-relaxed min-h-32 text-slate-900">
                    {entry.instructions || '—'}
                  </div>
                </td>
              </tr>

              {/* Row 13: Court's Direction & Next Date */}
              <tr>
                <td className="p-3 align-top border-r border-black w-1/2" colSpan={2}>
                  <div className="font-bold uppercase text-[11px] underline mb-1.5">COURT’S DIRECTION:</div>
                  <div className="whitespace-pre-wrap leading-relaxed min-h-20 text-slate-900">
                    {entry.courtDirections || '—'}
                  </div>
                </td>
                <td className="p-3 align-top w-1/2">
                  <div className="font-bold uppercase text-[11px] underline mb-1.5">NEXT DATE:</div>
                  <div className="font-mono text-base font-bold text-slate-900">
                    {entry.nextDate || '—'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
