
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Download, FileSpreadsheet, FileText, CheckSquare, Square, MinusSquare, Check, X, SlidersHorizontal } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DataRow } from '../types';

interface DataTableProps {
  headers: string[];
  rows: DataRow[];
  highlightTerm?: string;
  tableName?: string;
}

const HighlightedText: React.FC<{ text: string; term: string }> = ({ text, term }) => {
  if (!term) return <>{text}</>;
  const parts = text.split(new RegExp(`(${term})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 font-bold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const DataTable: React.FC<DataTableProps> = ({ headers, rows, highlightTerm = "", tableName = "Harmonized_Records" }) => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ index: string; startX: number; startWidth: number } | null>(null);

  // Row selection state: Set of row indices
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [customFilename, setCustomFilename] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');

  // Clear or reset selections when rows dataset changes substantially
  useEffect(() => {
    setSelectedRowIndices(new Set());
  }, [rows.length]);

  const allSelected = rows.length > 0 && selectedRowIndices.size === rows.length;
  const isIndeterminate = selectedRowIndices.size > 0 && selectedRowIndices.size < rows.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRowIndices(new Set());
    } else {
      const all = new Set<number>();
      rows.forEach((_, idx) => all.add(idx));
      setSelectedRowIndices(all);
    }
  };

  const toggleSelectRow = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRowIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectOnlyHighlighted = () => {
    if (!highlightTerm) return;
    const term = highlightTerm.toLowerCase();
    const matches = new Set<number>();
    rows.forEach((row, idx) => {
      const hasMatch = Object.values(row).some(v => String(v).toLowerCase().includes(term));
      if (hasMatch) matches.add(idx);
    });
    setSelectedRowIndices(matches);
  };

  const clearSelection = () => {
    setSelectedRowIndices(new Set());
  };

  const invertSelection = () => {
    const next = new Set<number>();
    rows.forEach((_, idx) => {
      if (!selectedRowIndices.has(idx)) {
        next.add(idx);
      }
    });
    setSelectedRowIndices(next);
  };

  // Determine export rows: if specific rows are checked, export those; otherwise export all currently visible rows
  const getRowsToExport = (onlySelected: boolean = false): DataRow[] => {
    if (onlySelected || selectedRowIndices.size > 0) {
      return rows.filter((_, idx) => selectedRowIndices.has(idx));
    }
    return rows;
  };

  const resolveFilename = (format: 'xlsx' | 'csv'): string => {
    const base = customFilename.trim() || `${tableName}_${new Date().toISOString().slice(0, 10)}`;
    const cleanBase = base.replace(/[\\/:*?"<>|]/g, '_');
    return cleanBase.endsWith(`.${format}`) ? cleanBase : `${cleanBase}.${format}`;
  };

  const executeExport = (format: 'xlsx' | 'csv', onlySelected: boolean) => {
    const dataToExport = getRowsToExport(onlySelected);
    if (dataToExport.length === 0) {
      alert("No rows selected for export.");
      return;
    }

    const filename = resolveFilename(format);
    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Exported_Data");
      XLSX.writeFile(wb, filename);
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setShowExportModal(false);
  };

  const onMouseDown = (header: string, e: React.MouseEvent) => {
    const startX = e.pageX;
    const startWidth = columnWidths[header] || 200;
    resizingRef.current = { index: header, startX, startWidth };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { index, startX, startWidth } = resizingRef.current;
    const diff = e.pageX - startX;
    const newWidth = Math.max(100, startWidth + diff);
    setColumnWidths((prev) => ({ ...prev, [index]: newWidth }));
  };

  const onMouseUp = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  const selectedCount = selectedRowIndices.size;

  return (
    <div className="space-y-4">
      {/* Table Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 px-6 py-4 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Rows:</span>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full font-mono text-xs font-bold">
              {rows.length.toLocaleString()}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Selection Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Selected:</span>
            <span className={`px-3 py-1 rounded-full font-mono text-xs font-bold border transition-colors ${
              selectedCount > 0 
                ? 'bg-sky-50 text-sky-700 border-sky-300 shadow-sm' 
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              {selectedCount.toLocaleString()} / {rows.length.toLocaleString()}
            </span>
          </div>

          {highlightTerm && (
            <span className="text-xs text-sky-800 font-medium bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
              Filter: "{highlightTerm}"
            </span>
          )}

          {/* Quick Selection Shortcuts */}
          {rows.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={toggleSelectAll}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors border border-slate-200"
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
              {selectedCount > 0 && (
                <>
                  <button
                    onClick={invertSelection}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-[11px] font-bold rounded-lg transition-colors border border-slate-200"
                    title="Invert current row selection"
                  >
                    Invert
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg transition-colors border border-rose-200"
                  >
                    Clear ({selectedCount})
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-3">
          {selectedCount > 0 ? (
            <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl animate-in fade-in">
              <span className="text-xs font-bold text-sky-800 hidden md:inline">
                Bulk Export ({selectedCount}):
              </span>
              <button
                onClick={() => {
                  setExportFormat('xlsx');
                  setShowExportModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                title={`Export ${selectedCount} selected rows to Excel`}
              >
                <FileSpreadsheet size={14} />
                Export Selected (.xlsx)
              </button>
              <button
                onClick={() => {
                  setExportFormat('csv');
                  setShowExportModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                title={`Export ${selectedCount} selected rows to CSV`}
              >
                <FileText size={14} />
                Export Selected (.csv)
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setExportFormat('xlsx');
                  setShowExportModal(true);
                }}
                disabled={rows.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                title="Download table as Excel .xlsx"
              >
                <FileSpreadsheet size={15} />
                Export All (.xlsx)
              </button>
              <button
                onClick={() => {
                  setExportFormat('csv');
                  setShowExportModal(true);
                }}
                disabled={rows.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                title="Download table as CSV"
              >
                <FileText size={15} />
                Export All (.csv)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Table with Checkboxes */}
      <div className="overflow-auto max-h-[650px] border border-slate-200 rounded-2xl shadow-sm bg-white custom-scrollbar select-text">
        <table className="w-full text-sm text-left border-collapse table-fixed" style={{ width: 'max-content', minWidth: '100%' }}>
          <thead className="bg-slate-100 sticky top-0 z-20 shadow-sm">
            <tr>
              {/* Checkbox Header Column */}
              <th 
                className="px-4 py-4 w-12 text-center border-b border-slate-200 bg-slate-100 sticky left-0 z-30 select-none"
                style={{ width: '56px' }}
              >
                <div 
                  onClick={toggleSelectAll}
                  className="cursor-pointer inline-flex items-center justify-center p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                  title={allSelected ? "Deselect All Rows" : "Select All Rows"}
                >
                  {allSelected ? (
                    <CheckSquare size={17} className="text-sky-600" />
                  ) : isIndeterminate ? (
                    <MinusSquare size={17} className="text-sky-600" />
                  ) : (
                    <Square size={17} className="text-slate-400" />
                  )}
                </div>
              </th>

              {/* Row Index Column */}
              <th 
                className="px-3 py-4 w-12 font-mono text-[10px] font-bold text-slate-400 border-b border-slate-200 text-center uppercase tracking-wider"
                style={{ width: '50px' }}
              >
                #
              </th>

              {/* Data Headers */}
              {headers.map((h, i) => {
                const isSplit = h.includes('(');
                const width = columnWidths[h] || 200;
                return (
                  <th 
                    key={i} 
                    className={`relative px-6 py-4 font-bold text-slate-700 border-b border-slate-200 whitespace-nowrap uppercase tracking-wider text-[11px] ${isSplit ? 'bg-sky-50/70' : ''}`}
                    style={{ width: `${width}px` }}
                  >
                    <div className="flex flex-col truncate pr-4">
                      <span className={isSplit ? 'text-sky-700 truncate' : 'truncate'}>{h.split('(')[0]}</span>
                      {isSplit && <span className="text-[9px] font-black text-sky-500 mt-0.5">[{h.split('(')[1].replace(')', '')}]</span>}
                    </div>
                    {/* Resize Handle */}
                    <div 
                      onMouseDown={(e) => onMouseDown(h, e)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-sky-400/50 transition-colors z-30"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => {
              const isSelected = selectedRowIndices.has(rowIndex);
              return (
                <tr 
                  key={rowIndex} 
                  onClick={(e) => toggleSelectRow(rowIndex, e)}
                  className={`transition-colors cursor-pointer group ${
                    isSelected ? 'bg-sky-50/70 hover:bg-sky-100/50' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Row Checkbox Cell */}
                  <td 
                    className={`px-4 py-4 text-center border-b border-slate-100 sticky left-0 z-10 transition-colors ${
                      isSelected ? 'bg-sky-100/70' : 'bg-white group-hover:bg-slate-50'
                    }`}
                    onClick={(e) => toggleSelectRow(rowIndex, e)}
                  >
                    <div className="inline-flex items-center justify-center">
                      {isSelected ? (
                        <CheckSquare size={17} className="text-sky-600 transition-transform scale-110" />
                      ) : (
                        <Square size={17} className="text-slate-300 group-hover:text-slate-400" />
                      )}
                    </div>
                  </td>

                  {/* Row Number */}
                  <td className="px-3 py-4 text-center font-mono text-[10px] text-slate-400 border-b border-slate-100">
                    {rowIndex + 1}
                  </td>

                  {/* Data Cells */}
                  {headers.map((h, colIndex) => {
                    const isSplit = h.includes('(');
                    const val = row[h] !== undefined ? String(row[h]) : "";
                    const width = columnWidths[h] || 200;
                    return (
                      <td 
                        key={colIndex} 
                        className={`px-6 py-4 text-slate-700 border-b border-slate-100 break-words leading-relaxed ${
                          isSplit ? (isSelected ? 'bg-sky-100/40' : 'bg-sky-50/20') : ''
                        }`}
                        style={{ width: `${width}px` }}
                      >
                        {val ? (
                          <HighlightedText text={val} term={highlightTerm} />
                        ) : (
                          <span className="text-slate-300 italic font-light">empty</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length + 2} className="px-6 py-20 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🔍</span>
                    </div>
                    <p className="font-bold uppercase tracking-widest text-xs">No records matching the filter criteria.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Floating Selection Bar for Fast Export when scrolling */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white text-slate-800 px-6 py-3.5 rounded-full border border-sky-300 shadow-2xl flex items-center gap-5 animate-in slide-in-from-bottom-5 duration-300 ring-4 ring-sky-500/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-700">
              <strong className="text-sky-600 font-black">{selectedCount}</strong> row{selectedCount > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setExportFormat('xlsx');
                setShowExportModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold transition-all shadow-sm"
            >
              <FileSpreadsheet size={13} />
              Excel (.xlsx)
            </button>
            <button
              onClick={() => {
                setExportFormat('csv');
                setShowExportModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-full text-xs font-bold transition-all shadow-sm"
            >
              <FileText size={13} />
              CSV (.csv)
            </button>
            <button
              onClick={clearSelection}
              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full transition-colors ml-1"
              title="Clear selection"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Export Modal with Custom Filename */}
      {showExportModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  exportFormat === 'xlsx' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'
                }`}>
                  {exportFormat === 'xlsx' ? <FileSpreadsheet size={22} /> : <FileText size={22} />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">Export to {exportFormat.toUpperCase()}</h3>
                  <p className="text-xs text-slate-500">Configure file settings</p>
                </div>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scope Info */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Export Scope:</span>
                <span className="font-bold text-slate-800">
                  {selectedCount > 0 ? `${selectedCount} Selected Rows` : `All ${rows.length} Rows`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Total Columns:</span>
                <span className="font-mono text-sky-600 font-bold">{headers.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Format:</span>
                <span className="font-mono text-emerald-600 font-bold">.{exportFormat}</span>
              </div>
            </div>

            {/* Format Switcher */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">File Format</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportFormat('xlsx')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    exportFormat === 'xlsx'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet size={15} />
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('csv')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    exportFormat === 'csv'
                      ? 'bg-sky-50 border-sky-500 text-sky-700 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileText size={15} />
                  CSV (.csv)
                </button>
              </div>
            </div>

            {/* Custom Filename Input */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Custom File Name</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={`${tableName}_${new Date().toISOString().slice(0, 10)}`}
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 pointer-events-none">
                  .{exportFormat}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 ml-1">
                Leave blank to use default timestamped name.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-3 text-slate-500 hover:text-slate-800 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeExport(exportFormat, selectedCount > 0)}
                className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2"
              >
                <Download size={15} />
                Download {exportFormat.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

