import React, { useState } from 'react';
import {
  X,
  Printer,
  Scale,
  Building,
  User,
  Users,
  Briefcase,
  Calendar,
  FileText,
  MapPin,
  Clock,
  Shield,
  CheckCircle2,
  Bookmark,
  Edit3,
  Check
} from 'lucide-react';
import { Case, Client } from '../../types';

interface FileCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCase: Case;
  client?: Client;
  onUpdateCase?: (caseId: string, updates: Partial<Case>) => void;
}

export const FileCoverModal: React.FC<FileCoverModalProps> = ({
  isOpen,
  onClose,
  selectedCase,
  client,
  onUpdateCase,
}) => {
  // Editable fields for physical folder archival
  const [isEditing, setIsEditing] = useState(false);
  const [cabinetLocation, setCabinetLocation] = useState(
    selectedCase?.cabinetLocation || 'Cabinet B — Shelf 3 (Litigation)'
  );
  const [archiveBoxNo, setArchiveBoxNo] = useState(
    selectedCase?.archiveBoxNo || `BOX-${new Date().getFullYear()}-SH${selectedCase?.id?.slice(-3) || '001'}`
  );
  const [courtCaseNo, setCourtCaseNo] = useState(
    selectedCase?.courtCaseNo || 'TA-A51NCvC-16-10/2025'
  );
  const [judge, setJudge] = useState(selectedCase?.judge || "YA Puan Hakim Zarina");
  const [subjectSummary, setSubjectSummary] = useState(
    selectedCase?.subjectSummary || selectedCase?.title || ''
  );

  if (!isOpen || !selectedCase) return null;

  const handleSaveEdits = () => {
    if (onUpdateCase) {
      onUpdateCase(selectedCase.id, {
        cabinetLocation,
        archiveBoxNo,
        courtCaseNo,
        judge,
        subjectSummary,
      });
    }
    setIsEditing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  // Compile list of represented clients (Our Side)
  const representedClients =
    selectedCase.clientParties && selectedCase.clientParties.length > 0
      ? selectedCase.clientParties
      : [
          {
            id: 'client-primary',
            name: client?.name || selectedCase.clientName || 'Primary Client',
            role: selectedCase.clientRole || '1st Plaintiff / Claimant',
            icOrRegNo: client?.icNumber || client?.companyRegNo || '',
            phone: client?.phone || '',
            email: client?.email || '',
          },
        ];

  // Compile list of opposing parties (Their Side)
  const opposingParties =
    selectedCase.opposingPartiesList && selectedCase.opposingPartiesList.length > 0
      ? selectedCase.opposingPartiesList
      : [
          {
            id: 'op-primary',
            name: selectedCase.opposingParty || 'Opposing Party',
            role: '1st Defendant / Respondent',
            icOrRegNo: '',
          },
        ];

  // Opposing solicitors registry
  const opposingSolicitors =
    selectedCase.opposingSolicitorsRegistry && selectedCase.opposingSolicitorsRegistry.length > 0
      ? selectedCase.opposingSolicitorsRegistry
      : [
          {
            id: 'sol-primary',
            partyRepresented: 'Opposing Party',
            firmName:
              selectedCase.opposingSolicitorsFirm ||
              (selectedCase.opposingCounsel && selectedCase.opposingCounsel.length > 0
                ? selectedCase.opposingCounsel.join(', ')
                : 'Messrs. Opposing & Co'),
            solicitors: selectedCase.opposingSolicitorsName || 'Attending Advocates',
            firmRef: selectedCase.opposingSolicitorsRef || '—',
            contactNumber: selectedCase.opposingSolicitorsPhone || '—',
            email: selectedCase.opposingSolicitorsEmail || '—',
          },
        ];

  return (
    <div className="fixed inset-0 bg-[#16223A]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-[#E1DCCF] my-auto overflow-hidden print:shadow-none print:border-none print:rounded-none print:max-w-none print:w-full print:m-0">
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="bg-[#16223A] text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#A9814A]/40 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#A9814A] text-white flex items-center justify-center font-bold font-serif text-sm">
              SH
            </div>
            <div>
              <h2 className="font-serif font-bold text-base text-white tracking-wide">
                Physical Legal File Cover (Manila Jacket View)
              </h2>
              <p className="text-xs text-amber-200/80 font-mono">
                Ref: {selectedCase.ref}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isEditing ? (
              <button
                type="button"
                onClick={handleSaveEdits}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Save Cover Updates</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                <span>Edit Folder Details</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="bg-[#A9814A] hover:bg-[#8E6B3B] text-white px-4 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 File Cover</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE LEGAL FILE COVER JACKET CANVAS */}
        <div className="p-6 sm:p-8 bg-[#FAF7F0] text-[#16223A] print:p-6 print:bg-white relative">
          
          {/* Authentic Double Border Legal Frame */}
          <div className="border-4 border-[#16223A] p-5 sm:p-6 rounded-xl bg-[#FAF8F3] relative shadow-2xs print:shadow-none print:border-4 print:border-[#16223A]">
            
            {/* Top Gold & Navy Accent Line */}
            <div className="h-2 bg-[#16223A] rounded-t mb-4 border-b-2 border-[#A9814A]" />

            {/* HEADER SECTION: FIRM NAME & FILE REF STAMP */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b-2 border-[#16223A]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#16223A] text-amber-300 rounded-xl flex items-center justify-center font-serif font-black text-xl border-2 border-[#A9814A] shadow-xs shrink-0">
                  SH
                </div>
                <div>
                  <h1 className="font-serif font-black text-xl sm:text-2xl text-[#16223A] tracking-wider uppercase">
                    MESSRS SYAFIQAH HAMIZAD &amp; CO
                  </h1>
                  <p className="text-xs font-bold text-[#A9814A] tracking-widest uppercase mt-0.5">
                    Advocates &amp; Solicitors
                  </p>
                  <p className="text-[10.5px] text-slate-600 font-medium">
                    No. 12-A, Jalan Sulaimani, 24000 Kemaman, Terengganu Darul Iman • Tel: 09-859 1234
                  </p>
                </div>
              </div>

              {/* Master File Reference Box */}
              <div className="bg-white border-2 border-[#16223A] p-3 rounded-lg text-center font-mono shrink-0 shadow-2xs min-w-[200px]">
                <span className="block text-[9px] uppercase font-black tracking-widest text-[#A9814A] border-b border-[#E1DCCF] pb-1 mb-1">
                  OFFICIAL FILE REFERENCE
                </span>
                <span className="font-black text-base sm:text-lg text-[#16223A] block">
                  {selectedCase.ref}
                </span>
              </div>
            </div>

            {/* CASE MATTER SECTION */}
            <div className="bg-white border-2 border-[#16223A] rounded-lg p-4 space-y-2 my-4">
              <div className="font-serif font-bold text-xs text-[#16223A] uppercase tracking-wider flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#A9814A]" />
                  Case Matter
                </span>
                <span className="text-[10px] font-extrabold text-[#16223A] bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                  {selectedCase.practiceArea || selectedCase.type}
                </span>
              </div>

              {isEditing ? (
                <textarea
                  rows={2}
                  value={subjectSummary}
                  onChange={(e) => setSubjectSummary(e.target.value)}
                  className="w-full text-xs font-serif font-bold p-2 border border-slate-300 rounded"
                />
              ) : (
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#16223A] leading-snug">
                  {subjectSummary}
                </h3>
              )}
            </div>

            {/* MAIN COVER GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 text-xs">
              
              {/* LEFT COLUMN: COURT PARTICULARS & CLIENT ROSTER */}
              <div className="space-y-4">
                
                {/* Court & Forum Details Box */}
                <div className="bg-white border-2 border-slate-300 rounded-lg p-3.5 space-y-2.5">
                  <div className="font-serif font-bold text-xs text-[#16223A] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <Scale className="w-4 h-4 text-[#A9814A]" />
                    <span>Court Particulars &amp; Forum</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="font-bold text-slate-500 text-[10px] block uppercase">Court Level:</span>
                      <span className="font-bold text-slate-900">{selectedCase.court || 'High Court of Malaya'}</span>
                    </div>

                    <div>
                      <span className="font-bold text-slate-500 text-[10px] block uppercase">Court Case / Suit No:</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={courtCaseNo}
                          onChange={(e) => setCourtCaseNo(e.target.value)}
                          className="w-full text-xs font-mono font-bold border border-slate-300 rounded px-1.5 py-0.5"
                        />
                      ) : (
                        <span className="font-mono font-bold text-rose-800 text-xs block">{courtCaseNo}</span>
                      )}
                    </div>

                    <div className="col-span-2">
                      <span className="font-bold text-slate-500 text-[10px] block uppercase">Presiding Corum / Judge:</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={judge}
                          onChange={(e) => setJudge(e.target.value)}
                          className="w-full text-xs font-bold border border-slate-300 rounded px-1.5 py-0.5"
                        />
                      ) : (
                        <span className="font-semibold text-slate-800">{judge}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Our Side: Represented Client(s) Roster */}
                <div className="bg-white border-2 border-blue-200 rounded-lg p-3.5 space-y-2">
                  <div className="font-serif font-bold text-xs text-blue-950 uppercase tracking-wider flex items-center justify-between border-b border-blue-100 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-700" />
                      Client(s) / Represented Parties (Our Side)
                    </span>
                    <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                      SHCO Counsel
                    </span>
                  </div>

                  <div className="space-y-2">
                    {representedClients.map((cp, idx) => (
                      <div key={cp.id || idx} className="bg-blue-50/50 p-2.5 rounded border border-blue-200 text-[11px]">
                        <div className="flex justify-between items-start font-bold text-blue-950">
                          <span>{cp.name}</span>
                          <span className="text-[9.5px] font-extrabold text-blue-900 bg-blue-100 border border-blue-300 px-1.5 py-0.2 rounded">
                            {cp.role}
                          </span>
                        </div>
                        {cp.icOrRegNo && (
                          <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                            NRIC / Reg No: {cp.icOrRegNo}
                          </div>
                        )}
                        {(cp.phone || cp.email) && (
                          <div className="text-[10px] text-slate-600 font-medium mt-0.5">
                            Tel: {cp.phone || '—'} | Email: {cp.email || '—'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: OPPOSING PARTIES & SOLICITORS */}
              <div className="space-y-4">
                
                {/* Opposing Parties Roster */}
                <div className="bg-white border-2 border-rose-200 rounded-lg p-3.5 space-y-2">
                  <div className="font-serif font-bold text-xs text-rose-950 uppercase tracking-wider flex items-center justify-between border-b border-rose-100 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-rose-700" />
                      Opposing Parties (Their Side)
                    </span>
                    <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                      Opponents
                    </span>
                  </div>

                  <div className="space-y-2">
                    {opposingParties.map((op, idx) => (
                      <div key={op.id || idx} className="bg-rose-50/50 p-2.5 rounded border border-rose-200 text-[11px]">
                        <div className="flex justify-between items-start font-bold text-rose-950">
                          <span>{op.name}</span>
                          <span className="text-[9.5px] font-extrabold text-rose-900 bg-rose-100 border border-rose-300 px-1.5 py-0.2 rounded">
                            {op.role}
                          </span>
                        </div>
                        {op.icOrRegNo && (
                          <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                            IC / Reg No: {op.icOrRegNo}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opposing Solicitors Registry */}
                <div className="bg-white border-2 border-amber-300/80 rounded-lg p-3.5 space-y-2">
                  <div className="font-serif font-bold text-xs text-amber-950 uppercase tracking-wider flex items-center justify-between border-b border-amber-200 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-[#A9814A]" />
                      Opposing Solicitors on Record
                    </span>
                  </div>

                  <div className="space-y-2">
                    {opposingSolicitors.map((sol) => (
                      <div key={sol.id} className="bg-amber-50/40 p-2.5 rounded border border-amber-200 text-[11px] space-y-1">
                        <div className="font-bold text-slate-900 flex items-center justify-between">
                          <span>{sol.firmName}</span>
                          <span className="text-[9px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded">
                            {sol.partyRepresented}
                          </span>
                        </div>
                        {sol.solicitors && (
                          <div className="text-[10.5px] text-slate-800 font-semibold">
                            Counsel: {sol.solicitors}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-600 font-mono flex items-center gap-3">
                          <span>Ref: {sol.firmRef || '—'}</span>
                          <span>Tel: {sol.contactNumber || '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* INTERNAL FIRM ASSIGNMENT */}
            <div className="pt-3 border-t-2 border-[#16223A]">
              <div className="space-y-1 text-xs">
                <div className="font-bold text-[#16223A] uppercase text-[10px]">Parties / Partners in Charge:</div>
                <div className="font-mono font-extrabold text-slate-900">
                  Partner(s): {selectedCase.partners.join(', ')}
                </div>
                <div className="text-slate-600 text-[11px]">
                  Assigned Advocates: Syafiqah Hamizad, Advocates &amp; Solicitors
                </div>
              </div>
            </div>

            {/* Bottom Footer Stamp */}
            <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[9.5px] font-bold text-slate-500 uppercase tracking-widest">
              Confidential Property of Messrs Syafiqah Hamizad &amp; Co • Advocates &amp; Solicitors
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
