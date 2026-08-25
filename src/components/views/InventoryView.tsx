import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { InventoryItem } from '../../types';
import {
  BookMarked,
  Package,
  Plus,
  Search,
  BookOpen,
  Archive,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Sparkles,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { inventoryItems, addInventoryItem, updateInventoryItem } = useApp();

  const [activeTab, setActiveTab] = useState<'All' | 'Law Library' | 'IT Equipment' | 'Stationery'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Law Library' | 'IT Equipment' | 'Stationery' | 'Office Supply' | 'Pleadings Bundle'>('Law Library');
  const [location, setLocation] = useState('Partner Room / Main Shelf');
  const [quantity, setQuantity] = useState<number>(1);
  const [minThreshold, setMinThreshold] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(150);
  const [unit, setUnit] = useState('Units');
  const [isbnOrSerial, setIsbnOrSerial] = useState('');
  const [borrowedBy, setBorrowedBy] = useState('');
  const [itemStatus, setItemStatus] = useState<'In Stock' | 'Low Stock' | 'Out of Stock'>('In Stock');
  const [notes, setNotes] = useState('');

  const filteredItems = inventoryItems.filter((item) => {
    if (activeTab !== 'All' && item.category !== activeTab) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        item.location.toLowerCase().includes(term) ||
        (item.isbnOrSerial || '').toLowerCase().includes(term) ||
        (item.borrowedBy || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  const libraryCount = inventoryItems.filter((i) => i.category === 'Law Library').length;
  const equipmentCount = inventoryItems.filter((i) => i.category === 'IT Equipment' || i.category === 'Office Supply').length;
  const lowStockCount = inventoryItems.filter((i) => i.quantity <= i.minThreshold).length;

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('Malayan Law Journal (MLJ) 2026 Volume 1');
    setCategory('Law Library');
    setLocation('Main Library Shelf A2');
    setQuantity(1);
    setMinThreshold(1);
    setUnitPrice(850);
    setUnit('Volumes');
    setIsbnOrSerial('MLJ-2026-VOL1');
    setBorrowedBy('');
    setItemStatus('In Stock');
    setNotes('Reference book for litigation & conveyancing precedent searches.');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setLocation(item.location);
    setQuantity(item.quantity);
    setMinThreshold(item.minThreshold);
    setUnitPrice(item.unitPrice);
    setUnit(item.unit || 'Units');
    setIsbnOrSerial(item.isbnOrSerial || '');
    setBorrowedBy(item.borrowedBy || '');
    setItemStatus(item.status);
    setNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateInventoryItem(editingItem.id, {
        name,
        category,
        location,
        quantity,
        minThreshold,
        unitPrice,
        unit,
        isbnOrSerial,
        borrowedBy,
        status: itemStatus,
        notes,
      });
    } else {
      addInventoryItem({
        name,
        category,
        location,
        quantity,
        unit,
        minThreshold,
        unitPrice,
        lastRestocked: new Date().toISOString().slice(0, 10),
        status: itemStatus,
        isbnOrSerial,
        borrowedBy,
        notes,
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 text-xs animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="bg-[#16223A] text-white p-6 rounded-2xl shadow-xl border border-amber-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-[#A9814A]/20 text-[#A9814A] font-bold text-[10px] rounded-full uppercase tracking-wider border border-[#A9814A]/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Office Assets &amp; Legal Resource Management
            </span>
          </div>
          <h1 className="text-xl font-bold font-serif flex items-center gap-2">
            <BookMarked className="w-6 h-6 text-[#A9814A]" />
            Office Inventory &amp; Law Library System
          </h1>
          <p className="text-slate-300 text-xs mt-1 max-w-2xl">
            Track firm law books, statutory compilations, office IT hardware, stationery stock levels, and book checkout records.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-[#A9814A] hover:bg-[#8F6A37] text-white font-bold rounded-xl cursor-pointer flex items-center gap-2 shadow-md shrink-0 transition-all text-xs"
        >
          <Plus className="w-4 h-4" />
          Add Asset / Book
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
          <div className="text-[10.5px] uppercase font-bold text-slate-500">Law Library Volumes</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{libraryCount} Titles</div>
          <div className="text-[10px] text-slate-500">Reports, Precedents &amp; Acts</div>
        </div>

        <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
          <div className="text-[10.5px] uppercase font-bold text-slate-500">IT &amp; Office Hardware</div>
          <div className="text-2xl font-bold font-mono text-[#16223A]">{equipmentCount} Units</div>
          <div className="text-[10px] text-slate-500">Laptops, Printers, Scanners</div>
        </div>

        <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
          <div className="text-[10.5px] uppercase font-bold text-slate-500">Stock Alerts</div>
          <div className="text-2xl font-bold font-mono text-amber-700">{lowStockCount} Low Stock</div>
          <div className="text-[10px] text-amber-800 font-medium">Re-order threshold triggers</div>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 bg-[#F7F5F0] border-b border-[#E1DCCF] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by title, location, serial or borrower..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#A9814A]"
              />
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('All')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                  activeTab === 'All' ? 'bg-[#16223A] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab('Law Library')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                  activeTab === 'Law Library' ? 'bg-[#A9814A] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Law Library
              </button>
              <button
                onClick={() => setActiveTab('IT Equipment')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                  activeTab === 'IT Equipment' ? 'bg-[#16223A] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                IT Equipment
              </button>
              <button
                onClick={() => setActiveTab('Stationery')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                  activeTab === 'Stationery' ? 'bg-[#16223A] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Stationery
              </button>
            </div>
          </div>

          <span className="text-[11px] font-bold text-slate-500">
            Showing {filteredItems.length} inventory records
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredItems.map((item) => (
            <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.category === 'Law Library'
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {item.category}
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <strong>Location:</strong> {item.location}
                  </span>
                  {item.isbnOrSerial && <span><strong>ISBN/Serial:</strong> <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{item.isbnOrSerial}</code></span>}
                  <span><strong>Unit Price:</strong> RM {item.unitPrice.toFixed(2)}</span>
                </div>

                {item.borrowedBy && (
                  <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200 inline-block">
                    📌 Borrowed by <strong>{item.borrowedBy}</strong>
                  </div>
                )}

                {item.notes && <p className="text-[11px] text-slate-500 italic">{item.notes}</p>}
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Stock Qty</div>
                  <div className={`font-bold font-mono text-sm ${item.quantity <= item.minThreshold ? 'text-rose-700' : 'text-slate-900'}`}>
                    {item.quantity} units {item.quantity <= item.minThreshold && '(Low Stock)'}
                  </div>
                </div>

                <button
                  onClick={() => handleOpenEdit(item)}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                  title="Edit Item"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No inventory or law library items found matching your filters.
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E1DCCF] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#16223A] text-white flex items-center justify-between">
              <h3 className="font-bold font-serif text-sm flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-[#A9814A]" />
                {editingItem ? 'Edit Asset / Library Item' : 'Add New Asset / Library Book'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-300 hover:text-white text-xs font-bold px-2 py-1 bg-white/10 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Item Title / Asset Description *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#A9814A]"
                  placeholder="e.g. Malayan Law Journal (MLJ) 2026 Volume 1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#A9814A]"
                  >
                    <option value="Law Library">Law Library / Textbooks</option>
                    <option value="IT Equipment">IT Hardware / Laptops</option>
                    <option value="Stationery">Stationery &amp; Paper</option>
                    <option value="Office Supply">Office Supply</option>
                    <option value="Pleadings Bundle">Pleadings Bundle</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Physical Location *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#A9814A]"
                    placeholder="e.g. Main Shelf A2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono outline-none focus:ring-1 focus:ring-[#A9814A]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Min Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(parseInt(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono outline-none focus:ring-1 focus:ring-[#A9814A]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit Price (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono outline-none focus:ring-1 focus:ring-[#A9814A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ISBN / Serial Number</label>
                  <input
                    type="text"
                    value={isbnOrSerial}
                    onChange={(e) => setIsbnOrSerial(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono outline-none focus:ring-1 focus:ring-[#A9814A]"
                    placeholder="e.g. MLJ-2026-VOL1"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Borrowed By (If Checked Out)</label>
                  <input
                    type="text"
                    value={borrowedBy}
                    onChange={(e) => setBorrowedBy(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#A9814A]"
                    placeholder="e.g. Lawyer 1 (Return: 18 Aug)"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#A9814A]"
                  placeholder="Additional asset notes..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#A9814A] hover:bg-[#8F6A37] text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Add Inventory Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
