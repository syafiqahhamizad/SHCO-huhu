import React, { useState } from 'react';
import {
  RotateCcw,
  Trash2,
  X,
  Search,
  ShieldAlert,
  Folder,
  Users,
  UserCheck,
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Archive,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DeletedRecord } from '../types';

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({ isOpen, onClose }) => {
  const {
    deletedRecords,
    restoreDeletedRecord,
    purgeDeletedRecordPermanently,
    emptyTrashRecycleBin,
    showToast,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');

  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState<boolean>(false);

  if (!isOpen) return null;

  // Filter records
  const filtered = deletedRecords.filter((r) => {
    const matchesSearch =
      (r.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.recordId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.deletedBy || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEntity =
      selectedEntity === 'ALL' || r.entityType.toUpperCase() === selectedEntity.toUpperCase();

    return matchesSearch && matchesEntity;
  });

  const handleRestore = (item: DeletedRecord) => {
    restoreDeletedRecord(item.id);
    showToast(`Restored ${item.entityType} "${item.title}" to active database!`, 'success');
  };

  const handlePurgeClick = (e: React.MouseEvent, item: DeletedRecord) => {
    e.stopPropagation();
    if (purgingId === item.id) {
      purgeDeletedRecordPermanently(item.id);
      setPurgingId(null);
      showToast(`Permanently deleted record "${item.title}".`, 'info');
    } else {
      setPurgingId(item.id);
      // Auto-reset confirmation after 4 seconds
      setTimeout(() => {
        setPurgingId((current) => (current === item.id ? null : current));
      }, 4000);
    }
  };

  const handleEmptyAllClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmEmpty) {
      emptyTrashRecycleBin();
      setConfirmEmpty(false);
      showToast('Recycle Bin emptied completely.', 'info');
    } else {
      setConfirmEmpty(true);
      setTimeout(() => setConfirmEmpty(false), 5000);
    }
  };

  const getEntityBadge = (entityType: string) => {
    switch (entityType.toUpperCase()) {
      case 'CASE':
      case 'MATTER':
        return { label: 'Case / Matter', color: 'bg-[#16223A] text-amber-300 border-[#A9814A]', icon: Folder };
      case 'CLIENT':
        return { label: 'Client', color: 'bg-emerald-800 text-emerald-100 border-emerald-600', icon: Users };
      case 'LEAD':
        return { label: 'Lead', color: 'bg-purple-800 text-purple-100 border-purple-600', icon: UserCheck };
      case 'INVOICE':
      case 'QUOTATION':
      case 'RECEIPT':
        return { label: 'Financial Doc', color: 'bg-amber-800 text-amber-100 border-amber-600', icon: DollarSign };
      default:
        return { label: entityType, color: 'bg-slate-700 text-slate-100 border-slate-500', icon: Database };
    }
  };

  return (
    <div className="fixed inset-0 bg-[#16223A]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-[#E1DCCF] my-8 flex flex-col max-h-[90vh] overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="bg-[#16223A] p-5 text-white flex items-center justify-between border-b border-[#A9814A]/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 border border-rose-400/40 rounded-xl text-rose-300">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-lg text-amber-300">
                  Data Recovery Vault &amp; Audit Recycle Bin
                </h3>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  {deletedRecords.length} Deleted Items
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Retrieve or purge deleted matters, clients, leads, and firm records across the entire system.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deletedRecords.length > 0 && (
              <button
                type="button"
                onClick={handleEmptyAllClick}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                  confirmEmpty
                    ? 'bg-red-700 text-white border-red-500 animate-pulse'
                    : 'bg-rose-600/80 hover:bg-rose-600 text-white border-rose-400/40'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmEmpty ? 'Confirm Empty All?' : 'Empty Trash'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-[#FAF8F2] border-b border-[#E1DCCF] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search deleted records by title, ref ID, or deleted by..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#A9814A]"
            />
          </div>

          {/* Entity Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg text-xs overflow-x-auto">
            {['ALL', 'CASE', 'CLIENT', 'LEAD', 'INVOICE', 'OTHER'].map((entity) => (
              <button
                key={entity}
                onClick={() => setSelectedEntity(entity)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedEntity === entity
                    ? 'bg-[#16223A] text-amber-300 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-300/60'
                }`}
              >
                {entity}
              </button>
            ))}
          </div>
        </div>

        {/* Content List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-slate-50">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 opacity-80" />
              <div className="font-bold text-slate-700 text-sm">No Deleted Records Found</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {deletedRecords.length === 0
                  ? 'Your system audit bin is clear. Any items deleted from cases, leads, clients, or invoices will appear here for recovery.'
                  : 'No records matched your search query or selected entity filter.'}
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const badge = getEntityBadge(item.entityType);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 hover:border-[#A9814A]/60 p-4 rounded-xl shadow-2xs transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 uppercase ${badge.color}`}>
                        <BadgeIcon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-[#16223A]">
                        {item.title}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600">{item.details}</div>

                    <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-slate-500 font-mono pt-1">
                      <span>Deleted On: <strong className="text-slate-700">{item.deletedAt}</strong></span>
                      <span>•</span>
                      <span>Deleted By: <strong className="text-slate-700">{item.deletedBy}</strong></span>
                      {item.recordId && (
                        <>
                          <span>•</span>
                          <span>Ref ID: <strong className="text-slate-700">{item.recordId}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => handleRestore(item)}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Restore item back to active database"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Restore Record</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handlePurgeClick(e, item)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                        purgingId === item.id
                          ? 'bg-red-700 text-white border-red-800 animate-pulse'
                          : 'border-rose-200 hover:bg-rose-100 text-rose-700'
                      }`}
                      title={purgingId === item.id ? 'Click again to permanently erase' : 'Permanently remove from disk'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{purgingId === item.id ? 'Confirm Purge?' : 'Purge'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#FAF8F2] border-t border-[#E1DCCF] text-slate-500 text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-[#A9814A]" />
            <span>Audit History Active • All data modifications tracked under Bar Council Compliance</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 font-bold rounded-lg text-xs cursor-pointer"
          >
            Close Vault
          </button>
        </div>
      </div>
    </div>
  );
};
