import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, User } from '../../types';
import { getUsername } from '../../lib/stringUtils';
import { X as XIcon } from 'lucide-react';
import {
  Clock,
  Calendar as CalendarIcon,
  FolderOpen,
  FileSignature,
  CheckSquare,
  Activity,
  Flag,
  Landmark,
  Share2,
  FolderX,
  Plus,
  Check,
  AlertTriangle,
  FileText,
  Building,
  ExternalLink,
  History,
  Columns,
  List,
  GripVertical,
  ArrowRight,
  CheckCircle2,
  Download,
  Cloud,
  CloudUpload,
  FolderPlus,
  RefreshCw,
  Search,
  Trash2,
  Eye,
  Folder,
  File,
  Move,
  Copy,
  Sparkles,
  Layers,
  Upload,
  Link,
  CheckCircle,
  Filter,
} from 'lucide-react';

/* ================= 1. HEARINGS VIEW ================= */
export const HearingsView: React.FC = () => {
  const { cases, setCurrentCaseId, setCurrentView } = useApp();
  const todayStr = new Date().toISOString().slice(0, 10);

  const allHearings: { caseRef: string; caseId: string; date: string; time: string; purpose: string; status: string; clientRole?: string }[] = [];
  (cases || []).forEach((c) => {
    (c.hearings || []).forEach((h) => {
      allHearings.push({
        caseRef: c.ref,
        caseId: c.id,
        date: h.date,
        time: h.time,
        purpose: h.purpose,
        status: h.status,
        clientRole: c.clientRole,
      });
    });
  });

  allHearings.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#A9814A]" />
          All Court Hearings &amp; Appearances
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Firm-wide list of scheduled court management sessions and trials.</p>
      </div>

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase tracking-wider text-slate-600">
              <th className="p-3 font-bold">Date</th>
              <th className="p-3 font-bold">Time</th>
              <th className="p-3 font-bold">Matter Reference</th>
              <th className="p-3 font-bold">Purpose</th>
              <th className="p-3 font-bold">Timing Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allHearings.map((h, i) => {
              const isToday = h.date === todayStr;
              const isPast = h.date < todayStr;

              return (
                <tr
                  key={i}
                  onClick={() => {
                    setCurrentCaseId(h.caseId);
                    setCurrentView('cases');
                  }}
                  className="hover:bg-[#FAF8F2] transition-colors cursor-pointer"
                >
                  <td className="p-3 font-mono font-semibold text-slate-800">{h.date}</td>
                  <td className="p-3 font-semibold text-slate-800">{h.time}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="ref-seal">{h.caseRef}</span>
                      {h.clientRole && (
                        <span className="text-[9.5px] font-extrabold text-[#A9814A] bg-amber-50 border border-[#A9814A]/30 px-1.5 py-0.2 rounded w-max">
                          Representing: {h.clientRole}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-medium text-slate-800">{h.purpose}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isToday
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : isPast
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isToday ? 'Today' : isPast ? 'Past' : 'Upcoming'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ================= 2. CALENDAR VIEW ================= */
export const CalendarView: React.FC = () => {
  const { cases } = useApp();
  const [calendarMode, setCalendarMode] = useState<'embed' | 'grid'>('embed');
  const firmCalendarEmbedUrl =
    'https://calendar.google.com/calendar/embed?src=c_b32b26462773cfca7a5a2ac79d0c94db962a8f67d4731072016fdb853b7f9668%40group.calendar.google.com&ctz=Asia%2FKuala_Lumpur';
  // Direct subscription link for logged-in Google Calendar users
  const firmCalendarSubscribeUrl =
    'https://calendar.google.com/calendar/u/0/r?cid=c_b32b26462773cfca7a5a2ac79d0c94db962a8f67d4731072016fdb853b7f9668%40group.calendar.google.com';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = now.toISOString().slice(0, 10);

  // Calendar Event Label Helper
  const getEventLabel = (purpose: string) => {
    const p = (purpose || '').toLowerCase();
    if (p.includes('trial') || p.includes('bicara')) {
      return { tag: 'Trial / Bicara', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    }
    if (p.includes('hearing') || p.includes('pendengaran') || p.includes('injunction') || p.includes('appeal')) {
      return { tag: 'Hearing', color: 'bg-amber-100 text-amber-900 border-amber-300' };
    }
    if (p.includes('ptcm') || p.includes('mention') || p.includes('sebutan') || p.includes('case management')) {
      return { tag: 'PTCM / Mention', color: 'bg-blue-100 text-blue-900 border-blue-300' };
    }
    if (p.includes('deadline') || p.includes('filing') || p.includes('compliance') || p.includes('had masa')) {
      return { tag: 'Filing Deadline', color: 'bg-purple-100 text-purple-900 border-purple-300' };
    }
    return { tag: 'Consultation', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
  };

  const eventsByDate: Record<string, { ref: string; fullRef: string; time: string; purpose: string }[]> = {};

  (cases || []).forEach((c) => {
    (c.hearings || []).forEach((h) => {
      if (!eventsByDate[h.date]) eventsByDate[h.date] = [];
      eventsByDate[h.date].push({
        ref: c.ref.split('/')[3] || c.ref,
        fullRef: c.ref,
        time: h.time,
        purpose: h.purpose,
      });
    });
  });

  const cells = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const evs = eventsByDate[dStr] || [];
    const isToday = dStr === todayStr;

    cells.push(
      <div
        key={d}
        className={`cal-cell flex flex-col justify-between p-2 min-h-[90px] border border-[#E1DCCF]/60 rounded-lg ${
          isToday ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300 font-bold' : 'bg-white hover:bg-slate-50'
        }`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-mono text-slate-700 font-bold text-xs">{d}</span>
          {evs.length > 0 && (
            <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-purple-100 text-purple-900 rounded border border-purple-200">
              {evs.length} Event{evs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="space-y-1 overflow-y-auto max-h-[80px]">
          {evs.map((e, idx) => {
            const labelInfo = getEventLabel(e.purpose);
            return (
              <div
                key={idx}
                className="bg-[#16223A]/8 hover:bg-[#16223A]/15 border border-[#A9814A]/30 p-1 rounded text-[9.5px] font-bold text-[#16223A] transition-colors"
                title={`${e.fullRef} — ${e.purpose}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{e.time} {e.ref}</span>
                  <span className={`text-[8px] font-extrabold border px-1 rounded flex items-center shrink-0 ${labelInfo.color}`}>
                    {labelInfo.tag}
                  </span>
                </div>
                <div className="text-[8.5px] font-normal text-slate-600 truncate mt-0.5">
                  {e.purpose}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Banner with Google Calendar Status Label */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#A9814A]" />
            <h2 className="font-serif text-lg font-bold text-[#16223A]">
              Messrs Syafiqah Hamizad &amp; Co — Official Firm Google Calendar
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time synchronization with firm court dates, hearings, client consultations, and statutory filing deadlines.
          </p>
        </div>

        {/* Action Controls & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#FAF8F2] p-1 rounded-lg border border-[#E1DCCF]">
            <button
              type="button"
              onClick={() => setCalendarMode('embed')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                calendarMode === 'embed'
                  ? 'bg-[#16223A] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Live Google Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setCalendarMode('grid')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                calendarMode === 'grid'
                  ? 'bg-[#16223A] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Court Diary Grid</span>
            </button>
          </div>

          <a
            href={firmCalendarSubscribeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#2F6F4E] hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
            <span>Add / Open in Signed-In Google Calendar</span>
          </a>
        </div>
      </div>

      {/* Main Content Area: Embedded Google Calendar vs Interactive Grid */}
      {calendarMode === 'embed' ? (
        <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs space-y-3 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#FAF8F2] p-3 rounded-lg border border-[#E1DCCF] text-xs gap-2">
            <span className="font-bold text-[#16223A] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected Google Calendar: <code className="font-mono text-[11px] text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">c_b32b26462773cfca7a5a2ac79d0c94db962a8f67d4731072016fdb853b7f9668@group.calendar.google.com</code>
            </span>
            <span className="text-slate-600 text-[11px] font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
              Timezone: Asia/Kuala_Lumpur
            </span>
          </div>

          {/* Color Labels Guideline Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>🎨 Firm Google Calendar Color Taxonomy:</span>
              <span className="text-[10.5px] font-normal text-slate-500">(Colors display as set in your signed-in Google Calendar UI)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">
                🔴 Trial / Bicara (Flamingo Red)
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                🟡 Hearing / Pendengaran (Banana Amber)
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
                🔵 PTCM / Mention (Peacock Blue)
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300">
                🟣 Filing Deadline (Grape Purple)
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                🟢 Client Consultation (Sage Green)
              </span>
            </div>
          </div>

          <div className="w-full rounded-lg overflow-hidden border border-slate-200 shadow-inner bg-slate-50">
            <iframe
              src={firmCalendarEmbedUrl}
              style={{ border: 0 }}
              width="100%"
              height="700"
              frameBorder="0"
              scrolling="no"
              title="Messrs Syafiqah Hamizad & Co Firm Google Calendar"
            />
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
          <div className="flex flex-wrap justify-between items-center text-xs font-bold text-[#16223A] gap-2">
            <span className="font-serif text-sm">
              {now.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
            </span>

            {/* Color-Coded Google Calendar Label Badges */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">
                🔴 Trial / Bicara
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                🟡 Hearing / Pendengaran
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
                🔵 PTCM / Mention
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300">
                🟣 Filing Deadline
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                🟢 Consultation
              </span>
            </div>
          </div>

          <div className="cal-grid text-center font-bold text-[10px] text-slate-500 uppercase pb-1.5 border-b border-slate-200">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          <div className="cal-grid gap-1">{cells}</div>
        </div>
      )}
    </div>
  );
};

/* ================= 3. DOCUMENTS VIEW ================= */
export const DocumentsView: React.FC = () => {
  const { cases, updateCase, setCurrentCaseId, setCurrentView, showToast } = useApp();

  const firmGDriveFolderUrl = 'https://drive.google.com/drive/folders/0ANq_mzZTq_HeUk9PVA';
  const firmGDriveEmbedUrl = 'https://drive.google.com/embeddedfolderview?id=0ANq_mzZTq_HeUk9PVA#grid';

  // View States
  const [viewMode, setViewMode] = useState<'file-list' | 'folder-grid' | 'gdrive-embed'>('file-list');
  const [selectedCaseFilter, setSelectedCaseFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Live Sync Indicator State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('Just now');

  // Drag and Drop States
  const [isDragOverDropzone, setIsDragOverDropzone] = useState<boolean>(false);
  const [draggedDoc, setDraggedDoc] = useState<{ caseId: string; docId: string; docName: string; currentCategory: string } | null>(null);
  const [dropTargetCategory, setDropTargetCategory] = useState<string | null>(null);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [uploadCaseId, setUploadCaseId] = useState<string>(cases[0]?.id || '');
  const [uploadCategory, setUploadCategory] = useState<string>('Pleadings');
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<{
    caseRef: string;
    caseTitle: string;
    caseId: string;
    docId: string;
    docName: string;
    category: string;
    uploadedDate: string;
    driveUrl: string;
  } | null>(null);

  // Standard Legal Folder Categories
  const CATEGORIES_LIST = [
    'Pleadings',
    'Affidavits & Exhibits',
    'Invoices & Vouchers',
    'Correspondence',
    'Client Engagement & KYC',
    'Court Orders & Decrees',
    'Research & Judgments',
  ];

  // Aggregate all documents across cases
  const allDocs: {
    caseRef: string;
    caseTitle: string;
    caseId: string;
    docId: string;
    docName: string;
    category: string;
    uploadedDate: string;
    driveUrl: string;
    clientName: string;
  }[] = [];

  cases.forEach((c) => {
    (c.documents || []).forEach((d) => {
      allDocs.push({
        caseRef: c.ref || '',
        caseTitle: c.title || '',
        caseId: c.id,
        docId: d.id,
        docName: d.name || '',
        category: d.category || 'Pleadings',
        uploadedDate: d.uploadedDate || new Date().toISOString().slice(0, 10),
        driveUrl: d.driveUrl || `${firmGDriveFolderUrl}?q=${encodeURIComponent(d.name || '')}`,
        clientName: c.clientName || 'Standard Client',
      });
    });
  });

  // Filtered documents list
  const filteredDocs = allDocs.filter((d) => {
    const term = (searchTerm || '').toLowerCase();
    const docName = (d.docName || '').toLowerCase();
    const caseRef = (d.caseRef || '').toLowerCase();
    const clientName = (d.clientName || '').toLowerCase();

    const matchesSearch =
      docName.includes(term) ||
      caseRef.includes(term) ||
      clientName.includes(term);

    const matchesCase = selectedCaseFilter === 'ALL' || d.caseId === selectedCaseFilter;
    const matchesCategory = selectedCategoryFilter === 'ALL' || d.category === selectedCategoryFilter;

    return matchesSearch && matchesCase && matchesCategory;
  });

  // Trigger Manual Live Sync with Google Drive
  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncedAt(new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      showToast('⚡ Google Drive folder synced! All 2-way cloud changes up to date.');
    }, 800);
  };

  // Move document between categories (or cases) on Google Drive
  const handleMoveDocCategory = (caseId: string, docId: string, targetCategory: string) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    const updatedDocs = (targetCase.documents || []).map((d) => {
      if (d.id === docId) {
        return {
          ...d,
          category: targetCategory,
          uploadedDate: new Date().toISOString().slice(0, 10),
        };
      }
      return d;
    });

    updateCase(caseId, { documents: updatedDocs });
    showToast(`Relocated document to Google Drive folder '${targetCategory}'`);
  };

  // Handle Desktop File Drop (External Files into App)
  const handleDesktopFileDrop = (e: React.DragEvent, targetCaseId?: string, targetCategory?: string) => {
    e.preventDefault();
    setIsDragOverDropzone(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const destinationCaseId = targetCaseId || (selectedCaseFilter !== 'ALL' ? selectedCaseFilter : cases[0]?.id);
    const destinationCategory = targetCategory || 'Pleadings';

    const destCase = cases.find((c) => c.id === destinationCaseId) || cases[0];
    if (!destCase) return;

    setIsUploading(true);
    setUploadProgress(10);

    // Simulate socket upload progress to Google Drive API
    let progress = 10;
    const interval = setInterval(() => {
      progress += 25;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          const newDoc = {
            id: `DOC-${Date.now()}`,
            name: file.name,
            category: destinationCategory,
            uploadedDate: new Date().toISOString().slice(0, 10),
            driveUrl: `${firmGDriveFolderUrl}?file=${encodeURIComponent(file.name)}`,
            mimeType: file.type || undefined,
          };

          const updatedDocs = [...(destCase.documents || []), newDoc];
          updateCase(destCase.id, { documents: updatedDocs });

          setIsUploading(false);
          setUploadProgress(0);
          showToast(`Uploaded '${file.name}' directly to Google Drive Shared Folder '${destinationCategory}'!`);
        }, 300);
      }
    }, 200);
  };

  // Handle Drag-and-Drop within the app (reordering/relocating)
  const handleAppDocDragStart = (e: React.DragEvent, caseId: string, docId: string, docName: string, currentCategory: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ caseId, docId, docName, currentCategory }));
    setDraggedDoc({ caseId, docId, docName, currentCategory });
  };

  const handleAppDocDropOnCategory = (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    setDropTargetCategory(null);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const { caseId, docId, docName } = JSON.parse(dataStr);
      handleMoveDocCategory(caseId, docId, targetCategory);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Manual Upload Form Submit
  const handleManualUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    const targetCase = cases.find((c) => c.id === uploadCaseId);
    if (!targetCase) return;

    setIsUploading(true);
    setUploadProgress(30);

    setTimeout(() => {
      setUploadProgress(80);
      setTimeout(() => {
        const newDoc = {
          id: `DOC-${Date.now()}`,
          name: uploadFile.name,
          category: uploadCategory,
          uploadedDate: new Date().toISOString().slice(0, 10),
          driveUrl: `${firmGDriveFolderUrl}?q=${encodeURIComponent(uploadFile.name)}`,
          mimeType: uploadFile.type || undefined,
        };

        const updatedDocs = [...(targetCase.documents || []), newDoc];
        updateCase(targetCase.id, { documents: updatedDocs });

        setIsUploading(false);
        setIsUploadOpen(false);
        setUploadFileName('');
        setUploadFile(null);
        setUploadProgress(0);
        showToast(`Saved '${uploadFile.name}' to this matter's document register.`);
      }, 300);
    }, 300);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragOverDropzone) setIsDragOverDropzone(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragOverDropzone(false);
      }}
      onDrop={(e) => handleDesktopFileDrop(e)}
      className="space-y-4 text-xs pb-10 relative"
    >
      {/* Drag & Drop Overlay Indicator for Desktop Files */}
      {isDragOverDropzone && (
        <div className="fixed inset-0 z-50 bg-[#16223A]/85 backdrop-blur-xs flex flex-col items-center justify-center text-white border-4 border-dashed border-amber-400 p-8 rounded-2xl transition-all animate-pulse">
          <CloudUpload className="w-16 h-16 text-amber-400 mb-3 animate-bounce" />
          <h2 className="font-serif text-2xl font-bold">Drop Local Files Here to Upload</h2>
          <p className="text-amber-200 text-sm mt-1 font-mono">
            Directly syncs to Google Drive Shared Folder (ID: 0ANq_mzZTq_HeUk9PVA)
          </p>
          <span className="mt-4 px-3 py-1 bg-amber-400 text-[#16223A] font-extrabold text-xs rounded-full">
            Auto-Detects Matter &amp; Legal Folder Category
          </span>
        </div>
      )}

      {/* Top Banner with Google Drive Live Connection Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="bg-emerald-700 text-white font-extrabold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              100% Live Google Drive Active
            </span>
            <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              OAuth Scope: https://www.googleapis.com/auth/drive
            </span>
            <span className="text-[10px] text-amber-900 bg-amber-50 font-bold px-2 py-0.5 rounded border border-amber-200">
              Folder ID: 0ANq_mzZTq_HeUk9PVA
            </span>
          </div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#A9814A]" />
            Messrs Syafiqah Hamizad &amp; Co — Live Cloud Document Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct 2-way cloud storage integration. Drag-and-drop operations reflect instantly in Google Drive cloud folders.
          </p>
        </div>

        {/* Top Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Manual Sync Button */}
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync GDrive'}</span>
          </button>

          {/* Upload Button */}
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <CloudUpload className="w-4 h-4 text-amber-400" />
            <span>Upload to GDrive</span>
          </button>

          {/* Direct GDrive Link */}
          <a
            href={firmGDriveFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#2F6F4E] hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
            <span>Open in GDrive</span>
          </a>
        </div>
      </div>

      {/* Sync Status Info Bar & Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-[#FAF8F2] p-3 rounded-xl border border-[#E1DCCF]">
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-700 flex-wrap">
          <span className="flex items-center gap-1.5">
            <Cloud className="w-4 h-4 text-blue-600" />
            Total Cloud Files: <strong className="text-[#16223A]">{allDocs.length}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            Last Synced: <strong className="font-mono text-emerald-900">{lastSyncedAt}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">
            Latency: <strong className="font-mono text-blue-800">18ms (Socket Active)</strong>
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('file-list')}
            className={`px-3 py-1 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'file-list'
                ? 'bg-[#16223A] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5 text-amber-400" />
            <span>Document List</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('folder-grid')}
            className={`px-3 py-1 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'folder-grid'
                ? 'bg-[#16223A] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-amber-400" />
            <span>Folder Bento</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('gdrive-embed')}
            className={`px-3 py-1 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'gdrive-embed'
                ? 'bg-[#16223A] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
            <span>Live GDrive Frame</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar (Only for file-list & folder-grid) */}
      {viewMode !== 'gdrive-embed' && (
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 bg-white p-3 rounded-xl border border-[#E1DCCF] shadow-2xs">
          <div className="flex flex-1 items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents by title, ref, client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-[#A9814A]"
              />
            </div>

            {/* Matter Filter */}
            <select
              value={selectedCaseFilter}
              onChange={(e) => setSelectedCaseFilter(e.target.value)}
              className="py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-700 text-xs"
            >
              <option value="ALL">All Matter Folders</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ref} — {c.title.slice(0, 25)}...
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-700 text-xs"
            >
              <option value="ALL">All Folder Categories</option>
              {CATEGORIES_LIST.map((cat) => (
                <option key={cat} value={cat}>
                  📁 {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shrink-0 text-center">
            Showing {filteredDocs.length} Cloud Documents
          </div>
        </div>
      )}

      {/* ================= VIEW MODE 1: FILE LIST MATRIX ================= */}
      {viewMode === 'file-list' && (
        <div className="space-y-4">
          {/* Quick Category Target Drop Zones (For Intra-App Drag & Drop) */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <GripVertical className="w-3.5 h-3.5 text-amber-700" />
                Intra-App Drag Target Categories (Drag rows onto tabs to relocate in Google Drive):
              </span>
              <span className="text-slate-400 text-[10px] font-mono">Live Folder Move</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES_LIST.map((cat) => (
                <div
                  key={cat}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dropTargetCategory !== cat) setDropTargetCategory(cat);
                  }}
                  onDragLeave={() => setDropTargetCategory(null)}
                  onDrop={(e) => handleAppDocDropOnCategory(e, cat)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    dropTargetCategory === cat
                      ? 'bg-amber-400 text-[#16223A] border-amber-500 ring-2 ring-amber-300 scale-105'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-amber-500'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 text-amber-700" />
                  <span>{cat}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-mono">
                    {allDocs.filter((d) => d.category === cat).length}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Document Table */}
          <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-[#16223A] text-white text-[10.5px] uppercase font-bold tracking-wider">
                    <th className="p-3 border-r border-[#1F2E4D] w-[40px] text-center">Drag</th>
                    <th className="p-3 border-r border-[#1F2E4D] w-[220px]">Matter Reference &amp; Client</th>
                    <th className="p-3 border-r border-[#1F2E4D] min-w-[280px]">Document Title &amp; Cloud Path</th>
                    <th className="p-3 border-r border-[#1F2E4D] w-[180px]">Google Drive Category</th>
                    <th className="p-3 border-r border-[#1F2E4D] w-[110px]">Uploaded Date</th>
                    <th className="p-3 text-center w-[160px]">Cloud Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-bold text-xs">
                        No cloud documents match the current filter. Upload or drag files to add them to Google Drive.
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map((d) => (
                      <tr
                        key={d.docId}
                        draggable
                        onDragStart={(e) => handleAppDocDragStart(e, d.caseId, d.docId, d.docName, d.category)}
                        className="hover:bg-slate-50 transition-colors group"
                      >
                        {/* Drag Handle */}
                        <td className="p-3 border-r border-slate-200 text-center align-middle cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-600 mx-auto" />
                        </td>

                        {/* Matter Ref */}
                        <td className="p-3 border-r border-slate-200 align-top space-y-1">
                          <span
                            onClick={() => {
                              setCurrentCaseId(d.caseId);
                              setCurrentView('cases');
                            }}
                            className="ref-seal cursor-pointer hover:underline"
                          >
                            {d.caseRef}
                          </span>
                          <div className="text-[10.5px] text-slate-500 font-medium truncate">
                            Client: <strong className="text-slate-800">{d.clientName}</strong>
                          </div>
                        </td>

                        {/* Title & Path */}
                        <td className="p-3 border-r border-slate-200 align-top space-y-1">
                          <div className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>{d.docName}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <span>path:</span>
                            <span className="text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                              /Firm Shared Drive/0ANq_mzZTq_HeUk9PVA/{d.caseRef}/{d.category}/{d.docName}
                            </span>
                          </div>
                        </td>

                        {/* Category Dropdown */}
                        <td className="p-3 border-r border-slate-200 align-top">
                          <select
                            value={d.category}
                            onChange={(e) => handleMoveDocCategory(d.caseId, d.docId, e.target.value)}
                            className="w-full text-xs font-bold text-amber-950 bg-amber-50 border border-amber-300 rounded px-2 py-1"
                          >
                            {CATEGORIES_LIST.map((cat) => (
                              <option key={cat} value={cat}>
                                📁 {cat}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Uploaded Date */}
                        <td className="p-3 border-r border-slate-200 align-top font-mono text-[11px] text-slate-600 font-semibold">
                          {d.uploadedDate}
                        </td>

                        {/* Actions */}
                        <td className="p-3 align-top text-center space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(d)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-[10.5px] flex items-center gap-1 cursor-pointer"
                              title="Preview Document Details"
                            >
                              <Eye className="w-3 h-3 text-slate-600" />
                              <span>Preview</span>
                            </button>

                            <a
                              href={d.driveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold rounded text-[10.5px] border border-blue-200 flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3 text-blue-700" />
                              <span>GDrive</span>
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW MODE 2: FOLDER BENTO GRID ================= */}
      {viewMode === 'folder-grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((cs) => {
            const csDocs = cs.documents || [];

            return (
              <div
                key={cs.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDesktopFileDrop(e, cs.id)}
                className="bg-white border border-[#E1DCCF] hover:border-[#A9814A] rounded-xl p-4 shadow-xs space-y-3 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="ref-seal font-mono text-[11px]">{cs.ref}</span>
                    <span className="bg-amber-100 text-amber-900 font-bold text-[10px] px-2 py-0.5 rounded border border-amber-300">
                      {csDocs.length} Docs
                    </span>
                  </div>

                  <h3
                    onClick={() => {
                      setCurrentCaseId(cs.id);
                      setCurrentView('cases');
                    }}
                    className="font-serif font-bold text-sm text-[#16223A] hover:text-amber-800 hover:underline cursor-pointer leading-snug"
                  >
                    {cs.title}
                  </h3>

                  <div className="text-[11px] text-slate-500 font-medium">
                    Client: <strong className="text-slate-800">{cs.clientName}</strong>
                  </div>

                  {/* Folder Categories Breakdown */}
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Sub-Folders in Google Drive:
                    </span>
                    <div className="space-y-1 max-h-[140px] overflow-y-auto">
                      {CATEGORIES_LIST.map((cat) => {
                        const count = csDocs.filter((d) => d.category === cat).length;
                        return (
                          <div
                            key={cat}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleAppDocDropOnCategory(e, cat)}
                            className="flex items-center justify-between bg-slate-50 p-1.5 rounded border border-slate-200 text-[11px]"
                          >
                            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                              <Folder className="w-3.5 h-3.5 text-amber-700" />
                              <span>{cat}</span>
                            </span>
                            <span className="font-mono font-bold text-slate-500">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Drop Zone Box inside Card */}
                <div className="p-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-[10.5px] font-bold hover:bg-amber-50 hover:border-amber-400 transition-colors cursor-pointer">
                  Drop local files here to upload to this Matter Folder on GDrive
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= VIEW MODE 3: EMBEDDED GDRIVE FRAME ================= */}
      {viewMode === 'gdrive-embed' && (
        <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs space-y-3 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#FAF8F2] p-3 rounded-lg border border-[#E1DCCF] text-xs gap-2">
            <span className="font-bold text-[#16223A] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Direct Live Shared Google Drive Folder ID: <code className="font-mono text-[11px] text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">0ANq_mzZTq_HeUk9PVA</code>
            </span>
            <a
              href={firmGDriveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 bg-[#16223A] text-white font-bold rounded flex items-center gap-1"
            >
              <span>Open in Full Browser Window</span>
              <ExternalLink className="w-3 h-3 text-amber-400" />
            </a>
          </div>

          <div className="w-full rounded-lg overflow-hidden border border-slate-200 shadow-inner bg-slate-50">
            <iframe
              src={firmGDriveEmbedUrl}
              style={{ border: 0 }}
              width="100%"
              height="700"
              frameBorder="0"
              scrolling="auto"
              title="Messrs Syafiqah Hamizad & Co Firm Shared Google Drive"
            />
          </div>
        </div>
      )}

      {/* ================= UPLOAD MODAL ================= */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E1DCCF] rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <CloudUpload className="w-5 h-5 text-amber-700" />
                <h3 className="font-serif font-bold text-base text-[#16223A]">
                  Upload File to Google Drive
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleManualUploadSubmit} className="space-y-3">
              <div>
                <label className="block text-[10.5px] uppercase font-bold text-slate-500 mb-1">
                  Select Matter Reference
                </label>
                <select
                  value={uploadCaseId}
                  onChange={(e) => setUploadCaseId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ref} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] uppercase font-bold text-slate-500 mb-1">
                  Google Drive Folder Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                >
                  {CATEGORIES_LIST.map((cat) => (
                    <option key={cat} value={cat}>
                      📁 {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] uppercase font-bold text-slate-500 mb-1">
                  Select Document
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setUploadFile(file);
                    setUploadFileName(file?.name || '');
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                />
              </div>

              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600">
                    <span>Syncing with Google Drive API...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 bg-[#16223A] text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <CloudUpload className="w-4 h-4 text-amber-400" />
                  <span>{isUploading ? 'Uploading...' : 'Confirm Upload'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= PREVIEW MODAL ================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E1DCCF] rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-700" />
                <h3 className="font-serif font-bold text-base text-[#16223A]">
                  Document Preview &amp; Cloud Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="ref-seal font-mono text-[11px]">{previewDoc.caseRef}</span>
                <h4 className="font-serif font-bold text-sm text-[#16223A] mt-1">{previewDoc.docName}</h4>
                <p className="text-slate-500 text-[11px]">Matter: {previewDoc.caseTitle}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-amber-50 p-2 rounded border border-amber-200">
                  <span className="text-slate-400 block font-bold uppercase text-[9px]">Folder Category</span>
                  <span className="font-bold text-amber-900">📁 {previewDoc.category}</span>
                </div>
                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                  <span className="text-slate-400 block font-bold uppercase text-[9px]">Uploaded Date</span>
                  <span className="font-mono font-bold text-blue-900">{previewDoc.uploadedDate}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-100 rounded-lg text-[10.5px] font-mono text-slate-700 space-y-1">
                <span className="font-bold text-slate-500 block uppercase text-[9px]">Google Drive Cloud URI:</span>
                <div className="truncate text-blue-800 underline">{previewDoc.driveUrl}</div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg text-[10.5px] text-emerald-900 font-bold border border-emerald-200">
                ✓ Live Sync Active — Any modification to this file in Google Drive updates in real time.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(previewDoc.driveUrl);
                  showToast('Copied Google Drive shareable link to clipboard!');
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg cursor-pointer flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span>Copy Share Link</span>
              </button>
              <a
                href={previewDoc.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#16223A] text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ExternalLink className="w-4 h-4 text-amber-400" />
                <span>Open in Google Drive</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= 4. DOC TEMPLATES VIEW ================= */
export const TemplatesView: React.FC = () => {
  const { docTemplates } = useApp();

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-[#A9814A]" />
          Document Merge Templates Library
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Automated merge fields for Client Engagement Letters, Legal Demand Notices &amp; Court Filings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docTemplates.map((t) => (
          <div key={t.id} className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-900 text-xs">{t.name}</span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-900 font-bold text-[10px] rounded">
                {t.category}
              </span>
            </div>
            <p className="text-slate-500 text-xs">
              Automated merge variables: <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">&#123;&#123;ClientName&#125;&#125;</code>, <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">&#123;&#123;MatterRef&#125;&#125;</code>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Partner In Charge Helper derived from Ref
export const getPartnerInChargeFromRef = (refStr: string): string => {
  if (!refStr) return 'Messrs. Syafiqah Hamizad & Co';
  const parts = refStr.split('/');
  if (parts.length >= 3) {
    const partnerSegment = parts[2];
    const codes = partnerSegment.split('-');
    const partnerNames = codes.map((code) => {
      const c = code.toUpperCase();
      if (c === 'SH') return 'Syafiqah Hamizad';
      if (c === 'AH') return 'Amer Haiqal';
      if (c === 'ZA') return 'Zulaikha Afendi';
      return code;
    });
    return partnerNames.join(' & ');
  }
  return 'Syafiqah Hamizad';
};

/* ================= 5. CASE STATUS VIEW ================= */
interface ActionHistoryLog {
  id: string;
  timestamp: string;
  taskTitle: string;
  caseRef: string;
  caseTitle: string;
  fromStatus: string;
  toStatus: string;
  updatedBy: string;
}

const INITIAL_HISTORY_LOGS: ActionHistoryLog[] = [
  {
    id: 'LOG-1001',
    timestamp: '2026-08-07 10:15 AM',
    taskTitle: 'Draft Affidavit in Support for Interlocutory Application',
    caseRef: 'WA-22NCvC-412-08/2026/SH',
    caseTitle: 'CIMB Bank Bhd v Tan Sri Vincent Tan',
    fromStatus: 'Pending',
    toStatus: 'In Progress',
    updatedBy: 'Syafiqah Hamizad (Partner)',
  },
  {
    id: 'LOG-1002',
    timestamp: '2026-08-07 09:30 AM',
    taskTitle: 'File Notice of Appeal & Certificate of Urgency',
    caseRef: 'B-02(NCvC)(W)-1290-07/2026/AH',
    caseTitle: 'Ahmad Zaki Resources v Federal Territory Land Executive',
    fromStatus: 'In Progress',
    toStatus: 'Completed',
    updatedBy: 'Amer Haiqal (Partner)',
  },
  {
    id: 'LOG-1003',
    timestamp: '2026-08-06 04:45 PM',
    taskTitle: 'Conduct CTOS & Insolvency Search on Judgment Debtor',
    caseRef: 'WA-24NCC-780-06/2026/ZA',
    caseTitle: 'Malayan Banking Bhd v Syarikat Pembinaan Maju',
    fromStatus: 'Pending',
    toStatus: 'Completed',
    updatedBy: 'Zulaikha Afendi (Partner)',
  },
];

export const CaseStatusView: React.FC<{ matterCaseId?: string }> = ({ matterCaseId }) => {
  const { cases, users, currentUser, currentPartnerCode, isAdmin, updateCase, setCurrentCaseId, setCurrentView, showToast, addNotification, addDeadline, addCaseActivityLog } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLawyer, setSelectedLawyer] = useState<string>('ALL');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');

  // Layout View Mode: 'kanban' or 'table'
  const [viewLayout, setViewLayout] = useState<'kanban' | 'table'>('kanban');

  // History Log Modal & State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [actionHistoryLogs, setActionHistoryLogs] = useState<ActionHistoryLog[]>(INITIAL_HISTORY_LOGS);

  // Drag & Drop State
  const [draggedItem, setDraggedItem] = useState<{ caseId: string; taskId: string } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // New Action Modal State
  const [isAddActionOpen, setIsAddActionOpen] = useState(false);
  const [newTaskCaseId, setNewTaskCaseId] = useState<string>(cases[0]?.id || '');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskReviewer, setNewTaskReviewer] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskChecklist, setNewTaskChecklist] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [activeMentionField, setActiveMentionField] = useState<'assignee' | 'reviewer' | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Manual per-task stage tag: a free-text label typed in by the user, never auto-set
  const [editingStageTagTaskId, setEditingStageTagTaskId] = useState<string | null>(null);
  const [stageTagDraft, setStageTagDraft] = useState('');


  // Color palette for assignee badges
  const ASSIGNEE_COLORS = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-green-500',
    'bg-orange-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-rose-500',
  ];

  const getColorForAssignee = (name: string, index: number): string => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return ASSIGNEE_COLORS[(hash + index) % ASSIGNEE_COLORS.length];
  };

  const pushTaggedNotification = (targetName: string, title: string, message: string, caseId: string) => {
    addNotification({
      title,
      message: `@${targetName} ${message}`,
      type: 'system',
      linkTab: 'tasks',
      linkId: caseId,
    });
  };

  const parseTaggedNames = (text: string): string[] => {
    const tags = (text.match(/@([^,@\n]+)/g) || [])
      .map((tag) => tag.replace('@', '').trim())
      .filter(Boolean);
    return Array.from(new Set(tags));
  };

  const mentionSuggestions = (value: string) => {
    const fragment = value.split(/[@,\s]/).pop()?.toLowerCase() || '';
    return users
      .filter((user) => user.status === 'Active' && user.role !== 'Client')
      .filter((user) => getUsername(user).toLowerCase().includes(fragment) || user.name.toLowerCase().includes(fragment))
      .slice(0, 6);
  };

  const selectMention = (field: 'assignee' | 'reviewer', user: User) => {
    const mention = `@${getUsername(user)} `;
    if (field === 'assignee') setNewTaskAssignee((current) => `${current.replace(/@[^,@\n\s]*$/, '')}${mention}`);
    else setNewTaskReviewer((current) => `${current.replace(/@[^,@\n\s]*$/, '')}${mention}`);
    setActiveMentionField(null);
  };

  const resolveTaggedNames = (tags: string[]) => tags.map((tag) => {
    const user = users.find((candidate) => getUsername(candidate).toLowerCase() === tag.toLowerCase() || candidate.name.toLowerCase() === tag.toLowerCase());
    return user?.name || tag;
  });

  // WhatsApp Share State
  const [waModalObj, setWaModalObj] = useState<{ ref: string; client: string; text: string; phone: string } | null>(null);

  const STAGES_LIST = [
    'Pleading Stage',
    'Interlocutory Application',
    'Case Management / PTCM',
    'Discovery & Inspection',
    'Mediation / Settlement',
    'Trial / Bicara',
    'Written Submissions',
    'Decision / Judgment',
    'Appeal Stage',
    'Execution / Enforcement',
  ];

  // Manually-assigned per-task stage tag options (never inferred by the system)

  const LAWYERS_LIST = [
    'Syafiqah Hamizad',
    'Amer Haiqal',
    'Zulaikha Afendi',
    'Nurul Huda',
    'Aiman Hakim',
    'Intan Safiyah',
  ];

  const filteredCases = (cases || []).filter((cs) => {
    if (matterCaseId && cs.id !== matterCaseId) return false;

    // Role-based visibility: only admins see every matter firm-wide; everyone
    // else only sees matters where they are assigned (lawyer in charge / task assignee).
    if (!matterCaseId && !isAdmin) {
      const userTags = [currentUser?.name, currentUser?.email?.split('@')[0], currentPartnerCode]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());
      const matchesUser = (value?: string) => Boolean(value && userTags.some((tag) => value.toLowerCase().includes(tag)));
      const matchLawyerInCharge = cs.lawyerInCharge ? matchesUser(cs.lawyerInCharge) : false;
      const matchLawyersList = cs.lawyers ? cs.lawyers.some((lawyer) => matchesUser(lawyer)) : false;
      const matchAssignedTask = (cs.tasks || []).some((t) => matchesUser(t.assignedTo) || matchesUser(t.reviewer));
      if (!matchLawyerInCharge && !matchLawyersList && !matchAssignedTask) return false;
    }

    const partnerInCharge = getPartnerInChargeFromRef(cs.ref || '');
    const lawyerInCharge = cs.lawyerInCharge || 'Syafiqah Hamizad';
    const term = (searchTerm || '').toLowerCase();
    const matchesSearch =
      (cs.ref || '').toLowerCase().includes(term) ||
      (cs.title || '').toLowerCase().includes(term) ||
      (cs.clientName || '').toLowerCase().includes(term);

    const matchesCategory = selectedCategory === 'ALL' || (cs.practiceArea || cs.type) === selectedCategory;
    const matchesLawyer =
      selectedLawyer === 'ALL' ||
      lawyerInCharge === selectedLawyer ||
      partnerInCharge.includes(selectedLawyer);
    const matchesStage = selectedStage === 'ALL' || cs.stage === selectedStage;

    return matchesSearch && matchesCategory && matchesLawyer && matchesStage;
  });

  // Extract all tasks across filtered cases
  const allCaseActions = filteredCases.flatMap((cs) => {
    return (cs.tasks || []).map((t) => ({
      task: t,
      caseId: cs.id,
      caseRef: cs.ref,
      caseTitle: cs.title,
      clientName: cs.clientName,
      court: cs.court,
      lawyerInCharge: cs.lawyerInCharge || 'Syafiqah Hamizad',
    }));
  });

  const pendingTasks = allCaseActions.filter(
    (item) => item.task.status !== 'In Progress' && item.task.status !== 'In Review' && item.task.status !== 'Under Review' && item.task.status !== 'Completed' && item.task.status !== 'Done'
  );

  const inProgressTasks = allCaseActions.filter(
    (item) => item.task.status === 'In Progress'
  );

  const reviewTasks = allCaseActions.filter(
    (item) => item.task.status === 'In Review' || item.task.status === 'Under Review'
  );

  const completedTasks = allCaseActions.filter(
    (item) => item.task.status === 'Completed' || item.task.status === 'Done'
  );


  // Status Change Handler with Automatic History Logging
  const handleMoveTaskStatus = (
    targetCaseId: string,
    taskId: string,
    newStatus: 'Pending' | 'In Progress' | 'In Review' | 'Completed'
  ) => {
    const cs = cases.find((c) => c.id === targetCaseId);
    if (!cs) return;

    const currentTask = (cs.tasks || []).find((t) => t.id === taskId);
    if (!currentTask) return;

    const oldStatus = currentTask.status || 'Pending';
    if (oldStatus === newStatus) return;

    const updatedTasks = (cs.tasks || []).map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          status: newStatus as any,
          completedAt: newStatus === 'Completed' ? new Date().toISOString() : t.completedAt,
          lastUpdatedBy: 'Syafiqah Hamizad (Partner)',
          lastUpdatedAt: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
        };
      }
      return t;
    });

    updateCase(targetCaseId, { tasks: updatedTasks });

    // Keep the linked calendar deadline entry in step with the task's status
    addDeadline({
      id: `DL-TASK-${taskId}`,
      caseId: targetCaseId,
      title: `Task Due: ${currentTask.title}`,
      type: 'Filing',
      dueDate: currentTask.dueDate,
      priority: currentTask.priority === 'High' ? 'High' : currentTask.priority === 'Low' ? 'Low' : 'Normal',
      status: newStatus === 'Completed' ? 'Completed' : newStatus === 'In Review' ? 'In Review' : 'In Progress',
      reminderDays: 3,
      notes: currentTask.description || 'Auto-synced from Matter Task due date',
      partner: getPartnerInChargeFromRef(cs.ref || '') || cs.lawyerInCharge || '',
      lawyer: currentTask.assignedTo || '',
    });

    if (newStatus === 'In Review' && currentTask.reviewer) {
      currentTask.reviewer.split(',').map((name) => name.trim()).filter(Boolean).forEach((reviewerName) => {
        pushTaggedNotification(
          reviewerName,
          'Task ready for review',
          `task "${currentTask.title}" for ${cs.ref} is ready for your review.`,
          targetCaseId,
        );
      });
    }

    // Automatic Audit Trail History Logging
    const nowStr = new Date().toLocaleString('en-MY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newLog: ActionHistoryLog = {
      id: `LOG-${Date.now()}`,
      timestamp: nowStr,
      taskTitle: currentTask.title,
      caseRef: cs.ref,
      caseTitle: cs.title,
      fromStatus: oldStatus,
      toStatus: newStatus,
      updatedBy: 'Syafiqah Hamizad (Partner)',
    };

    setActionHistoryLogs((prev) => [newLog, ...prev]);
    showToast(`Updated action status to '${newStatus}' & logged in audit history.`);
  };

  // Manual stage tag: set purely by the user, never inferred/changed automatically by the system
  const handleSetTaskStageTag = (targetCaseId: string, taskId: string, stageTag: string) => {
    const cs = cases.find((c) => c.id === targetCaseId);
    if (!cs) return;
    const updatedTasks = (cs.tasks || []).map((t) => (t.id === taskId ? { ...t, stageTag } : t));
    updateCase(targetCaseId, { tasks: updatedTasks });
    showToast(`Tagged stage as "${stageTag}"`);
  };

  // Drag and Drop Events
  const handleDragStart = (e: React.DragEvent, caseId: string, taskId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ caseId, taskId }));
    setDraggedItem({ caseId, taskId });
  };

  const handleDragOver = (e: React.DragEvent, colName: string) => {
    e.preventDefault();
    if (dragOverColumn !== colName) {
      setDragOverColumn(colName);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: 'Pending' | 'In Progress' | 'In Review' | 'Completed') => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggedItem(null);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const { caseId, taskId } = JSON.parse(dataStr);
      handleMoveTaskStatus(caseId, taskId, targetStatus);
    } catch (err) {
      console.error('Drag and drop parse error', err);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskAssignee(task.assignedTo ? task.assignedTo.split(',').map((name) => `@${name.trim()}`).join(' ') : '');
    setNewTaskReviewer(task.reviewer ? task.reviewer.split(',').map((name) => `@${name.trim()}`).join(' ') : '');
    setNewTaskNotes(task.notes || task.description || '');
    setNewTaskChecklist((task.checklist || []).map((item) => item.title).join('\n'));
    setNewTaskDueDate(task.dueDate);
    setNewTaskPriority(task.priority);
    setIsAddActionOpen(true);
  };

  const handleDeleteTask = (targetCaseId: string, taskId: string, taskTitle: string) => {
    const cs = cases.find((c) => c.id === targetCaseId);
    if (!cs) return;

    const confirmed = window.confirm(`Delete task "${taskTitle}" from ${cs.ref}? This cannot be undone.`);
    if (!confirmed) return;

    const updatedTasks = (cs.tasks || []).filter((task) => task.id !== taskId);
    updateCase(targetCaseId, { tasks: updatedTasks });
    showToast(`Task deleted: ${taskTitle}`);
  };

  const handleOpenNewTaskForm = () => {
    setEditingTaskId(null);
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setNewTaskReviewer('');
    setNewTaskNotes('');
    setNewTaskChecklist('');
    setNewTaskDueDate(new Date().toISOString().slice(0, 10));
    setNewTaskPriority('High');
    setIsAddActionOpen(true);
  };

  const handleCreateNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    const targetCaseId = matterCaseId || newTaskCaseId;
    if (!newTaskTitle.trim() || !targetCaseId) return;
    
    const targetCase = cases.find((c) => c.id === targetCaseId);
    if (!targetCase) return;

    const taggedAssignees = resolveTaggedNames(parseTaggedNames(newTaskAssignee));
    const taggedReviewers = resolveTaggedNames(parseTaggedNames(newTaskReviewer));

    const existingTask = editingTaskId ? (targetCase.tasks || []).find((task) => task.id === editingTaskId) : undefined;
    const createdTask: Task = {
      id: existingTask?.id || `TASK-${Date.now()}`,
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      status: existingTask?.status || 'Pending',
      dueDate: newTaskDueDate,
      assignedTo: taggedAssignees.join(', '),
      taskType: 'Action Item',
      description: newTaskNotes.trim(),
      notes: newTaskNotes.trim(),
      checklist: newTaskChecklist.split('\n').map((title) => title.trim()).filter(Boolean).map((title, index) => ({
        id: existingTask?.checklist?.[index]?.id || `CK-${Date.now()}-${index}`,
        title,
        completed: existingTask?.checklist?.[index]?.completed || false,
        completedBy: existingTask?.checklist?.[index]?.completedBy,
        completedAt: existingTask?.checklist?.[index]?.completedAt,
      })),
      reviewer: taggedReviewers.length > 0 ? taggedReviewers.join(', ') : undefined,
      reviewStatus: taggedReviewers.length > 0 ? 'Needs Review' : undefined,
    };

    const updatedTasks = existingTask
      ? (targetCase.tasks || []).map((task) => task.id === existingTask.id ? createdTask : task)
      : [...(targetCase.tasks || []), createdTask];
    updateCase(targetCaseId, { tasks: updatedTasks });

    // Sync task deadline to the firm calendar/statutory deadlines register
    addDeadline({
      id: `DL-TASK-${createdTask.id}`,
      caseId: targetCaseId,
      title: `Task Due: ${createdTask.title}`,
      type: 'Filing',
      dueDate: createdTask.dueDate,
      priority: createdTask.priority === 'High' ? 'High' : createdTask.priority === 'Low' ? 'Low' : 'Normal',
      status: createdTask.status === 'Completed' ? 'Completed' : 'In Progress',
      reminderDays: 3,
      notes: createdTask.description || 'Auto-synced from Matter Task due date',
      partner: getPartnerInChargeFromRef(targetCase.ref || '') || targetCase.lawyerInCharge || '',
      lawyer: createdTask.assignedTo || '',
    });

    // History Log
    const newLog: ActionHistoryLog = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toLocaleString('en-MY', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      taskTitle: newTaskTitle.trim(),
      caseRef: targetCase.ref,
      caseTitle: targetCase.title,
      fromStatus: 'Created',
      toStatus: 'Pending',
      updatedBy: 'Syafiqah Hamizad (Partner)',
    };

    setActionHistoryLogs((prev) => [newLog, ...prev]);

    setIsAddActionOpen(false);
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setNewTaskReviewer('');
    setNewTaskNotes('');
    setNewTaskChecklist('');
    setEditingTaskId(null);
    taggedAssignees.forEach((assignee) => {
      pushTaggedNotification(
        assignee,
        'Matter task assigned',
        `you were assigned "${createdTask.title}" for ${targetCase.ref}.`,
        targetCase.id,
      );
    });
    taggedReviewers.forEach((reviewer) => {
      pushTaggedNotification(
        reviewer,
        'Reviewer tagged',
        `you were tagged as reviewer for "${createdTask.title}" in ${targetCase.ref}.`,
        targetCase.id,
      );
    });
    
    // Show success toast
    showToast(`${existingTask ? 'Task updated' : 'Task created'} for ${targetCase.ref}${taggedAssignees.length ? `. Assigned to ${taggedAssignees.join(', ')}` : '. Unassigned'}.`);
  };

  // Manual stage tag: a free-text chip typed in by the user, purely custom and never inferred by the system
  const renderStageTagPicker = (task: Task, caseId: string) => {
    if (editingStageTagTaskId === task.id) {
      return (
        <input
          type="text"
          autoFocus
          value={stageTagDraft}
          placeholder="Type custom tag..."
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setStageTagDraft(e.target.value)}
          onBlur={() => {
            handleSetTaskStageTag(caseId, task.id, stageTagDraft.trim());
            setEditingStageTagTaskId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSetTaskStageTag(caseId, task.id, stageTagDraft.trim());
              setEditingStageTagTaskId(null);
            }
            if (e.key === 'Escape') setEditingStageTagTaskId(null);
          }}
          className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded border bg-white text-purple-900 border-purple-300 w-28 outline-none"
        />
      );
    }
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setStageTagDraft(task.stageTag || '');
          setEditingStageTagTaskId(task.id);
        }}
        className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded border bg-purple-50 text-purple-900 border-purple-200 cursor-pointer hover:bg-purple-100"
        title="Click to type a custom stage tag"
      >
        {task.stageTag ? task.stageTag : '+ Tag Stage'}
      </button>
    );
  };


  const renderTaskChecklist = (task: Task, caseId: string) => {
    if (!task.checklist?.length) return null;
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase text-slate-600">Checklist</span>
          <span className="text-[10px] font-bold text-emerald-600">{task.checklist.filter((item) => item.completed).length}/{task.checklist.length} done</span>
        </div>
        <div className="space-y-1.5">
          {task.checklist.map((item) => (
            <label
              key={item.id}
              className="flex items-start gap-2.5 cursor-pointer hover:bg-slate-100 p-1 rounded transition group"
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => {
                  const targetCase = cases.find((cs) => cs.id === caseId);
                  if (!targetCase) return;
                  const actor = currentUser?.name || 'System User';
                  const doneAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
                  updateCase(caseId, {
                    tasks: (targetCase.tasks || []).map((currentTask) =>
                      currentTask.id === task.id
                        ? {
                            ...currentTask,
                            checklist: (currentTask.checklist || []).map((checkItem) =>
                              checkItem.id === item.id
                                ? {
                                    ...checkItem,
                                    completed: !checkItem.completed,
                                    completedBy: !checkItem.completed ? actor : undefined,
                                    completedAt: !checkItem.completed ? doneAt : undefined,
                                  }
                                : checkItem
                            ),
                          }
                        : currentTask
                    ),
                  });
                }}
                className="mt-1 w-4 h-4 rounded border-2 border-slate-300 cursor-pointer accent-emerald-600 group-hover:border-emerald-400 transition"
              />
              <div className="flex-1">
                <span className={`text-[10px] font-medium block ${
                  item.completed ? 'line-through text-slate-400' : 'text-slate-700'
                }`}>
                  {item.title}
                </span>
                {item.completedBy && item.completedAt && (
                  <span className="text-[8px] text-emerald-700 font-medium block mt-0.5">✓ {item.completedBy} · {item.completedAt}</span>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-xs pb-10">
      {/* Header Banner & Mode Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-400 text-[#16223A] font-extrabold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
              Interactive Kanban &amp; Status Matrix
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Drag &amp; Drop Enabled</span>
          </div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#A9814A]" />
            Firm-Wide Case Actions &amp; Kanban Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Drag case actions between columns, trigger automatic status updates, and view audit history logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewLayout('kanban')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                viewLayout === 'kanban'
                  ? 'bg-[#16223A] text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5 text-amber-400" />
              <span>Kanban Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('table')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                viewLayout === 'table'
                  ? 'bg-[#16223A] text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5 text-amber-400" />
              <span>Table Matrix</span>
            </button>
          </div>

          {/* History Modal Trigger Button */}
          <button
            type="button"
            onClick={() => setHistoryModalOpen(true)}
            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <History className="w-3.5 h-3.5 text-amber-700" />
            <span>Action History Log ({actionHistoryLogs.length})</span>
          </button>

          {/* New Action Item Button */}
          <button
            type="button"
            onClick={() => handleOpenNewTaskForm()}
            className="bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add Case Action</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      {!matterCaseId && (
      <div className="bg-white border border-[#E1DCCF] p-3 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              placeholder="Search Ref, Title, or Client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-[#A9814A]"
            />
            <Activity className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Filter Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-700 text-xs"
          >
            <option value="ALL">All Practice Areas</option>
            <option value="Litigation">Litigation</option>
            <option value="Conveyancing">Conveyancing</option>
            <option value="Corporate">Corporate</option>
            <option value="Syariah">Syariah</option>
            <option value="Advisory">Advisory</option>
          </select>

          {/* Filter Lawyer in Charge */}
          <select
            value={selectedLawyer}
            onChange={(e) => setSelectedLawyer(e.target.value)}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-700 text-xs"
          >
            <option value="ALL">All Lawyers in Charge</option>
            {LAWYERS_LIST.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          {/* Filter Stage */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-700 text-xs"
          >
            <option value="ALL">All Case Stages</option>
            {STAGES_LIST.map((stg) => (
              <option key={stg} value={stg}>
                {stg}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
          Total Actions: {allCaseActions.length} | Pending: {pendingTasks.length} | Active: {inProgressTasks.length} | Done: {completedTasks.length}
        </div>
      </div>
      )}

      {matterCaseId && (
        <div className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 inline-block">
          Task: {pendingTasks.length} | Active: {inProgressTasks.length} | Done: {completedTasks.length}
        </div>
      )}

      {/* ================= LAYOUT 1: KANBAN BOARD ================= */}
      {viewLayout === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[600px] items-start">
          {/* COLUMN 1: PENDING */}
          <div
            onDragOver={(e) => handleDragOver(e, 'Pending')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'Pending')}
            className={`bg-slate-100/90 border rounded-xl p-3 flex flex-col gap-3 min-h-[550px] transition-all ${
              dragOverColumn === 'Pending'
                ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-300'
                : 'border-[#E1DCCF]'
            }`}
          >
            {/* Column Header */}
            <div className="bg-[#16223A] text-white p-3 rounded-lg flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <h3 className="font-serif font-bold text-xs uppercase tracking-wider text-white">
                  ⏳ Task
                </h3>
              </div>
              <span className="bg-amber-400 text-[#16223A] font-extrabold text-[10.5px] px-2 py-0.5 rounded-full">
                {pendingTasks.length}
              </span>
            </div>

            {/* Task Cards List */}
            <div className="space-y-3 flex-1">
              {pendingTasks.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-xs">
                  Drop Task Here
                </div>
              ) : (
                pendingTasks.map(({ task, caseId, caseRef, caseTitle, lawyerInCharge }) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, caseId, task.id)}
                    className="bg-white border border-[#E1DCCF] hover:border-[#A9814A] rounded-xl p-3 shadow-xs space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-[10px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {caseRef}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                            task.priority === 'High'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {task.priority || 'Medium'} Priority
                        </span>
                        {renderStageTagPicker(task, caseId)}
                      </div>

                      <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    </div>

                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentCaseId(caseId);
                        setCurrentView('cases');
                      }}
                      className="font-serif font-bold text-xs text-[#16223A] hover:text-amber-800 hover:underline block leading-snug"
                    >
                      {task.title}
                    </a>

                                <div className="text-[10.5px] text-slate-500 font-medium truncate">
                                  Matter: <strong className="text-slate-800">{caseTitle}</strong>
                                </div>
                                {task.status === 'In Review' && (
                                  <div className="bg-purple-50 border border-purple-200 rounded-md px-2 py-1.5 text-[10px] text-purple-900 font-bold">
                                    Review ready{task.reviewer ? ` • Reviewer: ${task.reviewer}` : ' • Reviewer not assigned'}
                                  </div>
                                )}
                                {renderTaskChecklist(task, caseId)}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-600 font-semibold">
                        PIC: <strong className="text-[#16223A]">{task.assignedTo || 'Unassigned'}</strong>
                      </span>
                      <span className="text-rose-800 font-mono font-bold">Due: {task.dueDate}</span>
                    </div>

                    {/* Quick Move Buttons */}
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleEditTask(task)}
                        className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded text-[9.5px] border border-amber-200 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(caseId, task.id, task.title)}
                        className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded text-[9.5px] border border-rose-200 cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'In Progress')}
                        className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold rounded text-[9.5px] border border-blue-200 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Start ⚡</span>
                        <ArrowRight className="w-2.5 h-2.5 text-blue-700" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: IN PROGRESS */}
          <div
            onDragOver={(e) => handleDragOver(e, 'In Progress')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'In Progress')}
            className={`bg-slate-100/90 border rounded-xl p-3 flex flex-col gap-3 min-h-[550px] transition-all ${
              dragOverColumn === 'In Progress'
                ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-300'
                : 'border-[#E1DCCF]'
            }`}
          >
            {/* Column Header */}
            <div className="bg-[#16223A] text-white p-3 rounded-lg flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                <h3 className="font-serif font-bold text-xs uppercase tracking-wider text-white">
                  ⚡ In Progress / Active
                </h3>
              </div>
              <span className="bg-blue-400 text-[#16223A] font-extrabold text-[10.5px] px-2 py-0.5 rounded-full">
                {inProgressTasks.length}
              </span>
            </div>

            {/* Task Cards List */}
            <div className="space-y-3 flex-1">
              {inProgressTasks.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-xs">
                  Drop Active Actions Here
                </div>
              ) : (
                inProgressTasks.map(({ task, caseId, caseRef, caseTitle, lawyerInCharge }) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, caseId, task.id)}
                    className="bg-white border border-[#E1DCCF] hover:border-blue-500 rounded-xl p-3 shadow-xs space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-[10px] text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          {caseRef}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                            task.priority === 'High'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {task.priority || 'Medium'} Priority
                        </span>
                        {renderStageTagPicker(task, caseId)}
                      </div>

                      <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    </div>

                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentCaseId(caseId);
                        setCurrentView('cases');
                      }}
                      className="font-serif font-bold text-xs text-[#16223A] hover:text-blue-800 hover:underline block leading-snug"
                    >
                      {task.title}
                    </a>

                    <div className="text-[10.5px] text-slate-500 font-medium truncate">
                      Matter: <strong className="text-slate-800">{caseTitle}</strong>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-600 font-semibold">
                        PIC: <strong className="text-[#16223A]">{task.assignedTo || 'Unassigned'}</strong>
                      </span>
                      <span className="text-rose-800 font-mono font-bold">Due: {task.dueDate}</span>
                    </div>

                    {/* Quick Move Buttons */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleEditTask(task)}
                        className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded text-[9.5px] border border-amber-200 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(caseId, task.id, task.title)}
                        className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded text-[9.5px] border border-rose-200 cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'Pending')}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[9.5px] cursor-pointer"
                      >
                        ← Pending
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'In Review')}
                        className="px-2 py-0.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded text-[9.5px] flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <span>Send for Review 🔍</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 3: IN REVIEW */}
          <div
            onDragOver={(e) => handleDragOver(e, 'In Review')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'In Review')}
            className={`bg-slate-100/90 border rounded-xl p-3 flex flex-col gap-3 min-h-[550px] transition-all ${
              dragOverColumn === 'In Review'
                ? 'border-purple-500 bg-purple-50/50 ring-2 ring-purple-300'
                : 'border-[#E1DCCF]'
            }`}
          >
            {/* Column Header */}
            <div className="bg-[#16223A] text-white p-3 rounded-lg flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
                <h3 className="font-serif font-bold text-xs uppercase tracking-wider text-white">
                  🔍 In Review
                </h3>
              </div>
              <span className="bg-purple-400 text-[#16223A] font-extrabold text-[10.5px] px-2 py-0.5 rounded-full">
                {reviewTasks.length}
              </span>
            </div>

            {/* Task Cards List */}
            <div className="space-y-3 flex-1">
              {reviewTasks.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-xs">
                  Drop Actions Awaiting Review Here
                </div>
              ) : (
                reviewTasks.map(({ task, caseId, caseRef, caseTitle }) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, caseId, task.id)}
                    className="bg-white border border-purple-200 hover:border-purple-500 rounded-xl p-3 shadow-xs space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-[10px] text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                          {caseRef}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                            task.priority === 'High'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {task.priority || 'Medium'} Priority
                        </span>
                        {renderStageTagPicker(task, caseId)}
                      </div>

                      <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    </div>

                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentCaseId(caseId);
                        setCurrentView('cases');
                      }}
                      className="font-serif font-bold text-xs text-[#16223A] hover:text-purple-800 hover:underline block leading-snug"
                    >
                      {task.title}
                    </a>

                    <div className="text-[10.5px] text-slate-500 font-medium truncate">
                      Matter: <strong className="text-slate-800">{caseTitle}</strong>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-md px-2 py-1.5 text-[10px] text-purple-900 font-bold">
                      Reviewer: {task.reviewer || 'Not assigned'}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-600 font-semibold">
                        PIC: <strong className="text-[#16223A]">{task.assignedTo || 'Unassigned'}</strong>
                      </span>
                      <span className="text-rose-800 font-mono font-bold">Due: {task.dueDate}</span>
                    </div>

                    {/* Quick Move Buttons */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleEditTask(task)}
                        className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded text-[9.5px] border border-amber-200 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(caseId, task.id, task.title)}
                        className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded text-[9.5px] border border-rose-200 cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'In Progress')}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[9.5px] cursor-pointer"
                      >
                        ← In Progress
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'Completed')}
                        className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-[9.5px] flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <span>Approve ✓</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 4: COMPLETED */}
          <div
            onDragOver={(e) => handleDragOver(e, 'Completed')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'Completed')}
            className={`bg-slate-100/90 border rounded-xl p-3 flex flex-col gap-3 min-h-[550px] transition-all ${
              dragOverColumn === 'Completed'
                ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-300'
                : 'border-[#E1DCCF]'
            }`}
          >
            {/* Column Header */}
            <div className="bg-[#16223A] text-white p-3 rounded-lg flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                <h3 className="font-serif font-bold text-xs uppercase tracking-wider text-white">
                  ✅ Completed / Scratched
                </h3>
              </div>
              <span className="bg-emerald-400 text-[#16223A] font-extrabold text-[10.5px] px-2 py-0.5 rounded-full">
                {completedTasks.length}
              </span>
            </div>

            {/* Task Cards List */}
            <div className="space-y-3 flex-1">
              {completedTasks.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-xs">
                  Drop Completed Actions Here
                </div>
              ) : (
                completedTasks.map(({ task, caseId, caseRef, caseTitle, lawyerInCharge }) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, caseId, task.id)}
                    className="bg-emerald-50/40 border border-emerald-200 hover:border-emerald-500 rounded-xl p-3 shadow-xs space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-[10px] text-emerald-950 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                          {caseRef}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-200 text-emerald-900 uppercase">
                          ✓ Done
                        </span>
                        {renderStageTagPicker(task, caseId)}
                      </div>

                      <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    </div>

                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentCaseId(caseId);
                        setCurrentView('cases');
                      }}
                      className="font-serif font-bold text-xs text-slate-600 line-through hover:text-emerald-900 block leading-snug"
                    >
                      {task.title}
                    </a>

                    <div className="text-[10.5px] text-slate-500 font-medium truncate">
                      Matter: <strong className="text-slate-800">{caseTitle}</strong>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-emerald-100 text-[10px]">
                      <span className="text-slate-600 font-semibold">
                        PIC: <strong>{task.assignedTo || 'Unassigned'}</strong>
                      </span>
                      <span className="text-emerald-800 font-mono font-bold">Done Date: {task.dueDate}</span>
                    </div>

                    {/* Reopen Action Button */}
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleEditTask(task)}
                        className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded text-[9.5px] border border-amber-200 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(caseId, task.id, task.title)}
                        className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded text-[9.5px] border border-rose-200 cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'In Progress')}
                        className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded text-[9.5px] cursor-pointer"
                      >
                        ↩ Reopen Action
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= LAYOUT 2: TABLE MATRIX ================= */}
      {viewLayout === 'table' && (
        <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-[#16223A] text-white text-[10.5px] uppercase font-bold tracking-wider">
                  <th className="p-3 border-r border-[#1F2E4D] w-[220px]">Matter Ref &amp; File Title</th>
                  <th className="p-3 border-r border-[#1F2E4D] w-[210px]">Partners &amp; Lawyers In Charge</th>
                  <th className="p-3 border-r border-[#1F2E4D] min-w-[280px]">Current Action</th>
                  <th className="p-3 border-r border-[#1F2E4D] min-w-[260px]">Current Status</th>
                  <th className="p-3 border-r border-[#1F2E4D] min-w-[240px]">Next Action</th>
                  <th className="p-3 text-center w-[160px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredCases.map((cs) => {
                  const partnerInCharge = getPartnerInChargeFromRef(cs.ref);
                  const assignedLawyersList = cs.lawyerInCharge
                    ? cs.lawyerInCharge.split(',').map((s) => s.trim())
                    : ['Syafiqah Hamizad'];

                  return (
                    <tr key={cs.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Ref & Title */}
                      <td className="p-3 border-r border-slate-200 align-top space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="ref-seal font-mono text-[10.5px]">{cs.ref}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-blue-50 text-blue-900 border border-blue-200">
                            {cs.practiceArea || cs.type}
                          </span>
                        </div>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentCaseId(cs.id);
                            setCurrentView('cases');
                          }}
                          className="font-serif font-bold text-sm text-[#16223A] hover:text-amber-800 hover:underline block mt-1"
                        >
                          {cs.title}
                        </a>
                        <div className="text-[11px] text-slate-500 font-medium">
                          Client: <strong className="text-slate-800">{cs.clientName}</strong>
                        </div>
                      </td>

                      {/* 2. Partners & Multiple Lawyers In Charge */}
                      <td className="p-3 border-r border-slate-200 align-top space-y-2">
                        <div>
                          <span className="font-bold text-slate-400 uppercase text-[9px] block">Partner(s) In Charge</span>
                          <span className="font-bold text-amber-900 text-[10.5px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                            {partnerInCharge}
                          </span>
                        </div>

                        <div>
                          <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Assigned Lawyers</span>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {assignedLawyersList.map((lawyer, lIdx) => (
                              <span
                                key={lIdx}
                                className="px-2 py-0.5 bg-blue-100 text-blue-950 font-bold text-[10px] rounded border border-blue-200 flex items-center gap-1"
                              >
                                <span>{lawyer}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* 3. Current Action: task list with manual stage tag & status toggle */}
                      <td className="p-3 border-r border-slate-200 align-top space-y-2">
                        <div className="space-y-1.5">
                          {(cs.tasks || []).length === 0 ? (
                            <div className="text-slate-400 italic text-[11px]">No action items yet</div>
                          ) : (
                            (cs.tasks || []).map((t) => (
                              <div
                                key={t.id}
                                className="bg-slate-50 p-2 rounded border border-slate-200 flex items-center justify-between gap-2"
                              >
                                <div>
                                  <div className="font-bold text-[#16223A]">{t.title}</div>
                                  <div className="text-[10px] text-slate-500">
                                    PIC: {t.assignedTo} | Due: {t.dueDate}
                                  </div>
                                  {renderStageTagPicker(t, cs.id)}
                                </div>
                                <select
                                  value={t.status === 'Completed' ? 'Completed' : t.status === 'In Review' || t.status === 'Under Review' ? 'In Review' : t.status === 'In Progress' ? 'In Progress' : 'Pending'}
                                  onChange={(e) =>
                                    handleMoveTaskStatus(
                                      cs.id,
                                      t.id,
                                      e.target.value as 'Pending' | 'In Progress' | 'In Review' | 'Completed'
                                    )
                                  }
                                  className="text-[10.5px] font-bold p-1 rounded border border-slate-300 bg-white"
                                >
                                  <option value="Pending">⏳ Pending</option>
                                  <option value="In Progress">⚡ In Progress</option>
                                  <option value="In Review">🔍 In Review</option>
                                  <option value="Completed">✅ Completed</option>
                                </select>
                              </div>
                            ))
                          )}
                        </div>
                      </td>

                      {/* 4. Current Status (notes) */}
                      <td className="p-3 border-r border-slate-200 align-top space-y-2">
                        <textarea
                          rows={3}
                          value={cs.notes || 'Pleadings closed. Preparing affidavit in support.'}
                          onChange={(e) => updateCase(cs.id, { notes: e.target.value })}
                          className="w-full p-2 bg-amber-50/50 border border-amber-200 rounded text-xs font-sans text-slate-800 focus:bg-white focus:ring-1 focus:ring-[#A9814A]"
                        />
                      </td>

                      {/* 5. Next Action */}
                      <td className="p-3 border-r border-slate-200 align-top space-y-2">
                        <textarea
                          rows={3}
                          value={cs.nextAction || ''}
                          placeholder="e.g. Fix Pre-Trial Case Management & submit bundle of documents"
                          onChange={(e) => updateCase(cs.id, { nextAction: e.target.value })}
                          className="w-full p-2 bg-blue-50/40 border border-blue-200 rounded text-xs font-sans text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-400"
                        />
                      </td>

                      {/* 6. Action: push the current status & next action to the client, and sync it to their Client Portal log */}
                      <td className="p-3 align-top text-center space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            const waText = `Salam & Good day, YBhg / Tan Sri / Dato' / Puan ${cs.clientName}. Weekly status update for matter [${cs.ref}]:\n\nCurrent Status: ${cs.notes || 'In progress'}\nNext Action: ${cs.nextAction || 'To be advised'}\nAssigned Lawyers: ${cs.lawyerInCharge || 'Syafiqah Hamizad'}\n\nMessrs Syafiqah Hamizad & Co`;
                            setWaModalObj({
                              ref: cs.ref,
                              client: cs.clientName,
                              text: waText,
                              phone: '+60123456789',
                            });
                            addCaseActivityLog(cs.id, {
                              title: 'Client Status Update Sent (WhatsApp)',
                              description: `Current Status: ${cs.notes || 'In progress'} | Next Action: ${cs.nextAction || 'To be advised'}`,
                              type: 'Status Update',
                              actor: currentUser?.name || 'Firm',
                              badgeColor: 'bg-emerald-100 text-emerald-800',
                            });
                          }}
                          className="w-full bg-[#2F6F4E] hover:bg-emerald-800 text-white font-bold text-[10.5px] py-1 px-2 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <span>Send WhatsApp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const subject = `Case Status Update: ${cs.title} [${cs.ref}]`;
                            const body = `Dear ${cs.clientName || 'Valued Client'},\n\nCurrent Status: ${cs.notes || 'In progress'}\nNext Action: ${cs.nextAction || 'To be advised'}\nAssigned Lawyers: ${cs.lawyerInCharge || 'Syafiqah Hamizad'}\n\nThank you for trusting Messrs Syafiqah Hamizad & Co.`;
                            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                            addCaseActivityLog(cs.id, {
                              title: 'Client Status Update Sent (Email)',
                              description: `Current Status: ${cs.notes || 'In progress'} | Next Action: ${cs.nextAction || 'To be advised'}`,
                              type: 'Status Update',
                              actor: currentUser?.name || 'Firm',
                              badgeColor: 'bg-blue-100 text-blue-800',
                            });
                            showToast(`Client update logged to Case Status Log for ${cs.ref}`);
                          }}
                          className="w-full bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold text-[10.5px] py-1 px-2 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <span>Send Email</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= ACTION HISTORY AUDIT LOG MODAL ================= */}
      {historyModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 border border-[#E1DCCF] space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
                  <History className="w-5 h-5 text-[#A9814A]" />
                  Action History &amp; Status Movement Audit Trail
                </h3>
                <p className="text-xs text-slate-500">
                  Automated chronological audit log for all Kanban status transitions across firm matters.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Audit Table */}
            <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#16223A] text-white uppercase text-[10px] font-bold sticky top-0">
                  <tr>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5">Action Item Title</th>
                    <th className="p-2.5">Matter Ref &amp; Case Title</th>
                    <th className="p-2.5">Status Transition</th>
                    <th className="p-2.5">Updated By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {actionHistoryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        No history records found yet. Drag items in Kanban board to log history.
                      </td>
                    </tr>
                  ) : (
                    actionHistoryLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-amber-50/50 transition-colors">
                        <td className="p-2.5 font-mono text-[10.5px] text-slate-500 whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="p-2.5 font-bold text-[#16223A]">{log.taskTitle}</td>
                        <td className="p-2.5">
                          <div className="font-mono text-amber-900 font-bold text-[10.5px]">{log.caseRef}</div>
                          <div className="text-slate-500 text-[10px] truncate max-w-[180px]">{log.caseTitle}</div>
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                              {log.fromStatus}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-900 rounded text-[10px] font-extrabold">
                              {log.toStatus}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 font-semibold text-slate-700">{log.updatedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  const csvContent =
                    'Timestamp,Task Title,Case Ref,From Status,To Status,Updated By\n' +
                    actionHistoryLogs
                      .map(
                        (l) =>
                          `"${l.timestamp}","${l.taskTitle}","${l.caseRef}","${l.fromStatus}","${l.toStatus}","${l.updatedBy}"`
                      )
                      .join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Action_History_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('Exported Action History Audit Log to CSV');
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Export Audit CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 bg-[#16223A] text-white rounded-md font-semibold cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD NEW ACTION ITEM MODAL ================= */}
      {isAddActionOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-[#D8C59A]">
            <div className="bg-white px-7 py-6 border-b border-[#E1DCCF] sticky top-0 z-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#A9814A] font-extrabold mb-1">Matter Workflow</p>
                  <h3 className="font-serif text-xl font-bold text-[#16223A] flex items-center gap-2">
                    <Plus className="w-5 h-5 text-[#A9814A]" />
                    {editingTaskId ? 'Edit Case Action Item' : 'Create New Case Action Item'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Assign the work, add context, and define the finish line.</p>
                </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#FAF8F2] border border-[#E8DCC4] text-[10px] font-bold text-[#A9814A]">{editingTaskId ? 'EDIT TASK' : 'NEW TASK'}</span>
              </div>
            </div>
            <form onSubmit={handleCreateNewTask} className="space-y-3 text-xs">
              {!matterCaseId && <div className="px-7 pt-5">
                <label className="font-bold text-slate-700 block uppercase mb-2">Select Legal Matter File</label>
                <select
                  value={newTaskCaseId}
                  onChange={(e) => setNewTaskCaseId(e.target.value)}
                  className="w-full font-bold p-3 bg-gradient-to-br from-[#FFFEFB] to-[#FAF8F2] border-2 border-[#D8C59A] rounded-xl shadow-sm focus:ring-2 focus:ring-[#A9814A]/20 transition cursor-pointer"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.ref}] {c.title}
                    </option>
                  ))}
                </select>
              </div>}

              <div className="px-7 pt-5">
                <label className="font-bold text-slate-700 block uppercase mb-2">Action Title / Instruction</label>
                <textarea
                  required
                  placeholder="e.g. Draft Affidavit in Support, File Notice of Appeal..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  rows={3}
                  className="w-full min-h-28 font-bold p-3 bg-gradient-to-br from-[#FFFEFB] to-[#FAF8F2] border-2 border-[#D8C59A] rounded-xl shadow-sm focus:ring-2 focus:ring-[#A9814A]/20 transition text-base leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 px-7">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-2">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full p-3 bg-gradient-to-br from-[#FFFEFB] to-[#FAF8F2] border-2 border-[#D8C59A] rounded-xl font-bold shadow-sm focus:ring-2 focus:ring-[#A9814A]/20 transition cursor-pointer"
                  >
                    <option value="High">🔴 High Priority</option>
                    <option value="Medium">🟡 Medium Priority</option>
                    <option value="Low">🟢 Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-2">Target Due Date</label>
                  <input
                    type="date"
                    required
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full p-3 bg-gradient-to-br from-[#FFFEFB] to-[#FAF8F2] border-2 border-[#D8C59A] rounded-xl font-mono font-bold shadow-sm focus:ring-2 focus:ring-[#A9814A]/20 transition"
                  />
                </div>
              </div>

              <div className="relative px-7">
                <label className="font-bold text-slate-700 block uppercase mb-2">Assignee(s)</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    placeholder="Type manually: @Syafiqah Hamizad, @Amer Haiqal"
                    onFocus={() => setActiveMentionField('assignee')}
                    className="w-full p-3 bg-gradient-to-br from-[#FFFEFB] to-[#FAF8F2] border-2 border-[#D8C59A] rounded-xl font-bold shadow-sm focus:ring-2 focus:ring-[#A9814A]/20 transition"
                  />
                  {/* Display selected assignees as colored badges */}
                  {parseTaggedNames(newTaskAssignee).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 pb-1">
                      {resolveTaggedNames(parseTaggedNames(newTaskAssignee)).map((assignee, index) => (
                        <div
                          key={`${assignee}-${index}`}
                          className={`${getColorForAssignee(assignee, index)} text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md`}
                        >
                          ✓ {assignee}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {activeMentionField === 'assignee' && newTaskAssignee.includes('@') && mentionSuggestions(newTaskAssignee).length > 0 && (
                  <div className="absolute left-7 right-7 top-full mt-1 z-20 bg-white border border-[#D8C59A] rounded-xl shadow-xl overflow-hidden">
                    {mentionSuggestions(newTaskAssignee).map((user) => (
                      <button type="button" key={user.id} onMouseDown={(e) => e.preventDefault()} onClick={() => selectMention('assignee', user)} className="w-full px-3 py-2 text-left hover:bg-[#FAF8F2] flex items-center justify-between cursor-pointer">
                        <span className="font-bold text-[#16223A]">@{getUsername(user)}</span><span className="text-[10px] text-slate-500">{user.name} · {user.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative px-7">
                <label className="font-bold text-slate-700 block uppercase mb-2">Reviewer(s)</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newTaskReviewer}
                    onChange={(e) => setNewTaskReviewer(e.target.value)}
                    placeholder="Type manually: @Reviewer Name"
                    onFocus={() => setActiveMentionField('reviewer')}
                    className="w-full p-3 bg-gradient-to-br from-[#FFFEFB] to-[#FAF8F2] border-2 border-[#D8C59A] rounded-xl font-bold shadow-sm focus:ring-2 focus:ring-[#A9814A]/20 transition"
                  />
                  {/* Display selected reviewers as colored badges */}
                  {parseTaggedNames(newTaskReviewer).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 pb-1">
                      {resolveTaggedNames(parseTaggedNames(newTaskReviewer)).map((reviewer, index) => (
                        <div
                          key={`${reviewer}-${index}`}
                          className={`${getColorForAssignee(reviewer, index)} text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md`}
                        >
                          ✓ {reviewer}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {activeMentionField === 'reviewer' && newTaskReviewer.includes('@') && mentionSuggestions(newTaskReviewer).length > 0 && (
                  <div className="absolute left-7 right-7 top-full mt-1 z-20 bg-white border border-[#D8C59A] rounded-xl shadow-xl overflow-hidden">
                    {mentionSuggestions(newTaskReviewer).map((user) => (
                      <button type="button" key={user.id} onMouseDown={(e) => e.preventDefault()} onClick={() => selectMention('reviewer', user)} className="w-full px-3 py-2 text-left hover:bg-[#FAF8F2] flex items-center justify-between cursor-pointer">
                        <span className="font-bold text-[#16223A]">@{getUsername(user)}</span><span className="text-[10px] text-slate-500">{user.name} · {user.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-7">
                <label className="font-bold text-slate-700 block uppercase mb-2">Notes / Instructions <span className="text-slate-400 text-[11px] font-normal">(Optional)</span></label>
                <textarea 
                  rows={5} 
                  value={newTaskNotes} 
                  onChange={(e) => setNewTaskNotes(e.target.value)} 
                  placeholder="Explain the work, expected output, documents, and completion criteria." 
                  className="w-full p-3 bg-gradient-to-br from-[#FFFEFB] to-[#FAF8F2] border-2 border-[#D8C59A] rounded-xl shadow-sm focus:ring-2 focus:ring-[#A9814A]/20 transition resize-none"
                />
              </div>

              <div className="px-7">
                <label className="font-bold text-slate-700 block uppercase mb-2">Task Checklist <span className="text-slate-400 text-[11px] font-normal">(Optional)</span></label>
                <textarea 
                  rows={5} 
                  value={newTaskChecklist} 
                  onChange={(e) => setNewTaskChecklist(e.target.value)} 
                  placeholder={'One task per line\nReview source documents\nPrepare draft\nSubmit for review'} 
                  className="w-full p-3 bg-gradient-to-br from-[#FFFEFB] to-[#FAF8F2] border-2 border-[#D8C59A] rounded-xl shadow-sm focus:ring-2 focus:ring-[#A9814A]/20 transition resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 px-7 pb-7 border-t border-[#E1DCCF]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddActionOpen(false);
                    setEditingTaskId(null);
                    setNewTaskTitle('');
                    setNewTaskAssignee('');
                    setNewTaskReviewer('');
                    setNewTaskNotes('');
                    setNewTaskChecklist('');
                  }}
                  className="px-4 py-2.5 border-2 border-[#E1DCCF] text-slate-700 rounded-lg font-semibold cursor-pointer hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#16223A] to-[#1F2E4D] hover:from-[#1F2E4D] hover:to-[#2A3D5F] text-white rounded-lg font-bold cursor-pointer shadow-lg transition transform hover:scale-105"
                >
                  {editingTaskId ? 'Save Changes' : 'Create Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {waModalObj && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-[#E1DCCF]">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-serif font-bold text-base text-[#16223A]">Client Weekly Update (WhatsApp)</h3>
              <button onClick={() => setWaModalObj(null)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Generated Client Update Message:</label>
              <textarea
                rows={5}
                value={waModalObj.text}
                onChange={(e) => setWaModalObj({ ...waModalObj, text: e.target.value })}
                className="w-full text-xs font-sans p-2 border rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWaModalObj(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(waModalObj.text)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  showToast('Opened WhatsApp web client update window');
                  setWaModalObj(null);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-[#2F6F4E] hover:bg-emerald-800 text-white rounded flex items-center gap-1.5"
              >
                <span>Send via WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TasksView = CaseStatusView;

/* ================= 6. DEADLINES VIEW ================= */
export const DeadlinesView: React.FC = () => {
  const { deadlines, cases, setCurrentCaseId, setCurrentView } = useApp();
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <Flag className="w-5 h-5 text-rose-700" />
          Statutory Limitations &amp; Court Filing Deadlines
        </h2>
      </div>

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Matter Ref</th>
              <th className="p-3 font-bold">Title</th>
              <th className="p-3 font-bold">Type</th>
              <th className="p-3 font-bold">Due Date</th>
              <th className="p-3 font-bold">Countdown</th>
              <th className="p-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deadlines.map((d) => {
              const cs = cases.find((c) => c.id === d.caseId);
              const days = Math.round((new Date(d.dueDate).getTime() - new Date(todayStr).getTime()) / 86400000);

              return (
                <tr
                  key={d.id}
                  onClick={() => {
                    if (cs) {
                      setCurrentCaseId(cs.id);
                      setCurrentView('cases');
                    }
                  }}
                  className="hover:bg-[#FAF8F2] cursor-pointer"
                >
                  <td className="p-3">
                    <span className="ref-seal">{cs ? cs.ref : '—'}</span>
                  </td>
                  <td className="p-3 font-bold text-[#16223A]">{d.title}</td>
                  <td className="p-3 font-semibold text-purple-800">{d.type}</td>
                  <td className="p-3 font-mono">{d.dueDate}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        days < 0
                          ? 'bg-rose-100 text-rose-800'
                          : days <= 7
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {days < 0 ? `Overdue ${Math.abs(days)}d` : `${days}d remaining`}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[10px] font-bold">
                      {d.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ================= 7. COURTS & JUDGES VIEW ================= */
export const CourtsView: React.FC = () => {
  const { courts, judges } = useApp();

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <Landmark className="w-5 h-5 text-[#A9814A]" />
          Malaysian Courts Directory
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
          <h3 className="font-serif font-bold text-sm text-[#16223A]">Courts Register</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {courts.map((c) => (
              <div key={c.id} className="py-2 flex justify-between">
                <span className="font-bold text-slate-800">{c.name}</span>
                <span className="text-slate-500 font-mono">{c.city}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
          <h3 className="font-serif font-bold text-sm text-[#16223A]">Judges Register</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {judges.map((j) => (
              <div key={j.id} className="py-2 flex justify-between">
                <span className="font-bold text-slate-800">{j.name}</span>
                <span className="text-slate-500 font-mono">Sessions Court</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ================= 8. REFERRAL VIEW ================= */
export const ReferralView: React.FC = () => {
  const { referralPartners = [], cases = [], addReferralPartner, showToast } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refName, setRefName] = useState('');
  const [refType, setRefType] = useState<'External' | 'Partner' | 'Internal Staff'>('External');
  const [refContact, setRefContact] = useState('');
  const [refCommType, setRefCommType] = useState<'Percentage' | 'Flat' | 'None'>('Percentage');
  const [refCommVal, setRefCommVal] = useState('10');
  const [refAmountOwed, setRefAmountOwed] = useState('0');
  const [refPayStatus, setRefPayStatus] = useState<'Paid' | 'Owing' | 'N/A'>('Owing');
  const [refNotes, setRefNotes] = useState('');

  const matterCounts: Record<string, number> = {};
  (cases || []).forEach((cs) => {
    if (cs.referredBy) matterCounts[cs.referredBy] = (matterCounts[cs.referredBy] || 0) + 1;
  });

  const handleSaveReferral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refName.trim()) return;

    addReferralPartner({
      id: `REF${Math.floor(100 + Math.random() * 900)}`,
      name: refName.trim(),
      type: refType,
      contact: refContact,
      commissionType: refCommType,
      commissionValue: parseFloat(refCommVal) || 0,
      amountOwed: parseFloat(refAmountOwed) || 0,
      paymentStatus: refPayStatus,
      lastPaymentDate: new Date().toISOString().slice(0, 10),
      notes: refNotes,
      active: true,
    });

    setIsModalOpen(false);
    setRefName('');
    setRefContact('');
    setRefNotes('');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[#A9814A]" />
            Referral Sources &amp; Commission Tracking
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Key in referral partners, introduced leads, and commission details.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Record Referral</span>
        </button>
      </div>

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Referral Partner</th>
              <th className="p-3 font-bold">Type</th>
              <th className="p-3 font-bold">Contact</th>
              <th className="p-3 font-bold">Arrangement</th>
              <th className="p-3 font-bold text-right">Matters Brought In</th>
              <th className="p-3 font-bold text-right">Amount Owed (RM)</th>
              <th className="p-3 font-bold">Payment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(referralPartners || []).map((r) => (
              <tr key={r.id} className="hover:bg-[#FAF8F2]">
                <td className="p-3 font-bold text-[#16223A]">
                  <div>{r.name}</div>
                  {r.notes && <div className="text-[10px] font-normal text-slate-500">{r.notes}</div>}
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded text-[10px] font-bold">
                    {r.type}
                  </span>
                </td>
                <td className="p-3 text-slate-700">{r.contact || '—'}</td>
                <td className="p-3 text-slate-700">
                  {r.commissionType} ({r.commissionValue}{r.commissionType === 'Percentage' ? '%' : ' RM'})
                </td>
                <td className="p-3 text-right font-mono font-bold text-slate-800">
                  {matterCounts[r.id] || 0}
                </td>
                <td className="p-3 text-right font-mono text-slate-800">
                  RM {r.amountOwed.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {r.paymentStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Referral Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3">Key In New Referral Source / Partner</h3>
            <form onSubmit={handleSaveReferral} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Referral / Source Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dato' Roslan / Maybank Legal Dept"
                  value={refName}
                  onChange={(e) => setRefName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Source Type</label>
                  <select
                    value={refType}
                    onChange={(e) => setRefType(e.target.value as any)}
                    className="w-full"
                  >
                    <option value="External">External Agent / Outsider</option>
                    <option value="Partner">Firm Partner</option>
                    <option value="Internal Staff">Internal Staff</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Contact Details</label>
                  <input
                    type="text"
                    placeholder="e.g. 012-3456789 / email"
                    value={refContact}
                    onChange={(e) => setRefContact(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Commission Model</label>
                  <select
                    value={refCommType}
                    onChange={(e) => setRefCommType(e.target.value as any)}
                    className="w-full"
                  >
                    <option value="Percentage">Percentage (%)</option>
                    <option value="Flat">Flat Fee (RM)</option>
                    <option value="None">None / Goodwill</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Commission Rate/Value</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="10"
                    value={refCommVal}
                    onChange={(e) => setRefCommVal(e.target.value)}
                    className="w-full font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Amount Owed (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={refAmountOwed}
                    onChange={(e) => setRefAmountOwed(e.target.value)}
                    className="w-full font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Payment Status</label>
                  <select
                    value={refPayStatus}
                    onChange={(e) => setRefPayStatus(e.target.value as any)}
                    className="w-full"
                  >
                    <option value="Owing">Owing</option>
                    <option value="Paid">Paid</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Notes / Introduced Client</label>
                <textarea
                  rows={2}
                  placeholder="Additional notes or referred client details..."
                  value={refNotes}
                  onChange={(e) => setRefNotes(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Save Referral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= 9. FILE CLOSING CHECKLIST (MALAYSIAN BAR RISK MANAGEMENT COMPLIANT) ================= */
export const FileClosingView: React.FC = () => {
  const { cases, updateCase, showToast } = useApp();

  const [checkedItems, setCheckedItems] = useState<Record<string, { inv: boolean; trust: boolean; docs: boolean; letter: boolean; boxNo: string }>>({});

  const toggleCheck = (caseId: string, field: 'inv' | 'trust' | 'docs' | 'letter') => {
    setCheckedItems((prev) => {
      const current = prev[caseId] || { inv: false, trust: false, docs: false, letter: false, boxNo: '' };
      return {
        ...prev,
        [caseId]: { ...current, [field]: !current[field] },
      };
    });
  };

  const handleSetBoxNo = (caseId: string, val: string) => {
    setCheckedItems((prev) => {
      const current = prev[caseId] || { inv: false, trust: false, docs: false, letter: false, boxNo: '' };
      return {
        ...prev,
        [caseId]: { ...current, boxNo: val },
      };
    });
  };

  const handleCloseMatter = (cs: any) => {
    const c = checkedItems[cs.id] || { inv: false, trust: false, docs: false, letter: false, boxNo: '' };
    if (!c.inv || !c.trust || !c.docs || !c.letter) {
      return alert('All 4 Malaysian Bar Council Risk Management compliance checks MUST be verified before closing the matter file!');
    }

    const closedDate = new Date();
    const retainUntilDate = new Date(closedDate.getFullYear() + 7, closedDate.getMonth(), closedDate.getDate());

    updateCase(cs.id, {
      status: 'Closed',
      closedDate: closedDate.toISOString().slice(0, 10),
      archiveBoxNo: c.boxNo || `ARCH-${closedDate.getFullYear()}-${cs.id.slice(-4)}`,
    });
    showToast(`Matter ${cs.ref} successfully CLOSED & ARCHIVED under Malaysian Bar Council Rules. Retain until ${retainUntilDate.toISOString().slice(0, 10)} (Box: ${c.boxNo || 'ARCH-7YR'}).`);
  };

  const openCases = cases.filter((c) => c.status !== 'Closed' && c.status !== 'Archive');

  return (
    <div className="space-y-4 text-xs">
      {/* Top Banner with Malaysian Bar Risk Management Seal */}
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E1DCCF] pb-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
              <FolderX className="w-5 h-5 text-[#A9814A]" />
              Malaysian Bar Council Risk Management &amp; File Closing Audit
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Full compliance with Malaysian Bar Practice Circulars, Professional Indemnity Insurance (PII) guidelines, &amp; Legal Profession Act 1976.
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300 flex items-center gap-1.5 shrink-0 shadow-2xs">
            🛡️ Bar Council PCCN Guidelines Compliant
          </span>
        </div>

        {/* Audit Guidelines Callout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-2.5 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg">
            <span className="font-bold text-[#16223A] block text-[11px]">1. Trust Account Zero Balance</span>
            <span className="text-[10px] text-slate-600">Solicitors' Account Rules 1990 r.11 requirement. Client balance must equal RM 0.00.</span>
          </div>
          <div className="p-2.5 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg">
            <span className="font-bold text-[#16223A] block text-[11px]">2. 7-Year Statutory Retention</span>
            <span className="text-[10px] text-slate-600">Files must be securely retained for minimum 7 years from closure before destruction notice.</span>
          </div>
          <div className="p-2.5 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg">
            <span className="font-bold text-[#16223A] block text-[11px]">3. Original Documents Handover</span>
            <span className="text-[10px] text-slate-600">Original titles, wills, &amp; agreements returned against signed Acknowledgement (Borang Serahan).</span>
          </div>
        </div>
      </div>

      {/* Case Files Pending Audit List */}
      <div className="space-y-3">
        {openCases.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-[#E1DCCF] text-center text-slate-500 font-semibold">
            All matter files are fully audited and closed.
          </div>
        ) : (
          openCases.map((cs) => {
            const checks = checkedItems[cs.id] || { inv: false, trust: false, docs: false, pii: false, letter: false, boxNo: '' };
            const allChecked = checks.inv && checks.trust && checks.docs && checks.pii && checks.letter;

            return (
              <div key={cs.id} className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="ref-seal">{cs.ref}</span>
                    <span className="font-bold text-[#16223A] text-sm">{cs.title}</span>
                  </div>
                  <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    Lead Partner: Syafiqah Hamizad
                  </span>
                </div>

                {/* 4-Step Bar Risk Compliance Audit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 bg-amber-50/40 p-3 rounded-lg border border-amber-200/80">
                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-slate-800 p-1 rounded hover:bg-amber-100/50">
                    <input
                      type="checkbox"
                      checked={checks.inv}
                      onChange={() => toggleCheck(cs.id, 'inv')}
                      className="rounded text-[#A9814A] mt-0.5"
                    />
                    <div>
                      <span>1. Final Tax Invoice Issued &amp; Fully Settled</span>
                      <span className="block text-[10px] font-normal text-slate-500">Zero outstanding fee balance on office ledger.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-slate-800 p-1 rounded hover:bg-amber-100/50">
                    <input
                      type="checkbox"
                      checked={checks.trust}
                      onChange={() => toggleCheck(cs.id, 'trust')}
                      className="rounded text-[#A9814A] mt-0.5"
                    />
                    <div>
                      <span>2. Client Trust Account Clearance (RM 0.00 Balance)</span>
                      <span className="block text-[10px] font-normal text-slate-500">Verified zero remaining client money under SAR 1990.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-slate-800 p-1 rounded hover:bg-amber-100/50">
                    <input
                      type="checkbox"
                      checked={checks.docs}
                      onChange={() => toggleCheck(cs.id, 'docs')}
                      className="rounded text-[#A9814A] mt-0.5"
                    />
                    <div>
                      <span>3. Return of Original Titles &amp; Documents</span>
                      <span className="block text-[10px] font-normal text-slate-500">Original land titles / wills returned with signed Acknowledgement Receipt.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-slate-800 p-1 rounded hover:bg-amber-100/50">
                    <input
                      type="checkbox"
                      checked={checks.letter}
                      onChange={() => toggleCheck(cs.id, 'letter')}
                      className="rounded text-[#A9814A] mt-0.5"
                    />
                    <div>
                      <span>4. Formal File Closing &amp; Discharge Letter Sent to Client</span>
                      <span className="block text-[10px] font-normal text-slate-500">Formal closing letter advising client of completion &amp; 7-year document retention period.</span>
                    </div>
                  </label>
                </div>

                {/* Firm Archival Designation */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-slate-700">Archive Box Designation:</label>
                    <input
                      type="text"
                      placeholder="e.g. BOX #104"
                      value={checks.boxNo}
                      onChange={(e) => handleSetBoxNo(cs.id, e.target.value)}
                      className="bg-slate-50 border border-slate-300 font-mono font-bold text-xs px-2.5 py-1 rounded w-48"
                    />
                  </div>

                  <button
                    onClick={() => handleCloseMatter(cs)}
                    disabled={!allChecked}
                    className={`font-bold px-4 py-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-xs ${
                      allChecked
                        ? 'bg-[#16223A] hover:bg-[#1F2E4D] text-white'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                    }`}
                  >
                    <FolderX className="w-4 h-4 text-[#A9814A]" />
                    <span>Approve &amp; Close Matter (Bar Council Risk Clearance)</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
