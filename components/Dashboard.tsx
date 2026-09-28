
import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  Users, CreditCard, Globe, ShieldX, UserX, Activity, ArrowUpRight, Zap, 
  Bike, ShieldCheck, MoreHorizontal, Download, Calendar, ShieldAlert, 
  BarChart4, Loader2, FileSpreadsheet, DownloadCloud
} from 'lucide-react';
import { DataRow, DashboardMetrics } from '../types';
import { extractDashboardMetrics } from '../utils/dataProcessor';

interface DashboardProps {
  rows: DataRow[];
  onDrillDown: (title: string, filteredRows: DataRow[]) => void;
}

const BRAND_COLORS = ['#0284c7', '#0ea5e9', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#3b82f6', '#14b8a6', '#0ea5e9'];

export const Dashboard: React.FC<DashboardProps> = ({ rows, onDrillDown }) => {
  const [isExporting, setIsExporting] = useState(false);
  
  const metrics = useMemo(() => extractDashboardMetrics(rows), [rows]) as DashboardMetrics;

  // Helper to download specific subset immediately
  const directDownload = (filename: string, data: DataRow[], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}_${new Date().getTime()}.xlsx`);
  };

  const workforceSplit = useMemo(() => {
    const jobKey = Object.keys(rows[0] || {}).find(k => 
      k.toLowerCase().includes('job') || k.toLowerCase().includes('description') || k.toLowerCase().includes('designation')
    );
    const motorcyclistRows: DataRow[] = [];
    const staffSupportRows: DataRow[] = [];
    rows.forEach(row => {
      const job = String(row[jobKey || ''] || '').toLowerCase();
      if (job.includes('motorcycle') || job.includes('bike') || job.includes('motorcyclist')) motorcyclistRows.push(row);
      else staffSupportRows.push(row);
    });
    return { motorcyclist: motorcyclistRows, staffSupport: staffSupportRows };
  }, [rows]);

  const renewalForecast = useMemo(() => {
    const today = new Date();
    const months = [];
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    let totalProjected = 0;
    
    // Helper to get rows for a specific month (Year, Month Index 0-11)
    const getMonthRows = (targetYear: number, targetMonth: number) => {
        return rows.filter(row => {
            const dateKey = Object.keys(row).find(k => k.includes('(Date)'));
            if (!dateKey) return false;
            const val = String(row[dateKey]).split(';')[0].trim();
            const parts = val.split('/');
            if (parts.length === 3) {
                 const d = parseInt(parts[0]);
                 const m = parseInt(parts[1]) - 1;
                 const y = parseInt(parts[2]);
                 return y === targetYear && m === targetMonth;
            }
            return false;
        });
    };

    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const count = (metrics.monthlyRenewals[key] || 0) as number;
      const escapeCount = (metrics.monthlyEscapes[key] || 0) as number;
      
      const monthRows = getMonthRows(d.getFullYear(), d.getMonth());

      totalProjected += count;
      months.push({ 
          key, 
          month: monthNames[d.getMonth()] || "MONTH", // Full 12-month array ensures correct lookup across all months
          year: d.getFullYear(), 
          count, 
          escapeCount,
          rows: monthRows 
      });
    }
    
    // Calculate intensity for UI
    const maxMonthCount = Math.max(...months.map(m => m.count as number), 1);
    
    return months.map(m => ({
      ...m,
      intensity: ((m.count as number) / maxMonthCount) * 100
    }));
  }, [metrics, rows]);

  const handleFullExport = async () => {
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 500)); 

    const wb = XLSX.utils.book_new();

    // 1. Executive Summary Sheet
    const summaryData = [
      ["METRIC", "VALUE", "NOTES"],
      ["Total Personnel", metrics.total, "Full census count"],
      ["Active Credentials", metrics.activeCount, "Valid visas/labor cards"],
      ["Expired Credentials", metrics.expiredCardCount, "Requires immediate attention"],
      ["Escape Reports", metrics.escapeCount, "Absconding/Legal issues"],
      ["Upcoming Renewals", metrics.upcomingRenewals, "Due this month"],
      ["Motorcyclists", workforceSplit.motorcyclist.length, "Role-based count"],
      ["Support Staff", workforceSplit.staffSupport.length, "Role-based count"],
      [],
      ["NATIONALITY BREAKDOWN", "COUNT"],
      ...Object.entries(metrics.nationalityData),
      [],
      ["STATUS BREAKDOWN", "COUNT"],
      ...Object.entries(metrics.statusData)
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

    // 2. Registries
    if (metrics.escapeRecords.length) {
      const ws = XLSX.utils.json_to_sheet(metrics.escapeRecords);
      XLSX.utils.book_append_sheet(wb, ws, "Escape Registry");
    }

    if (metrics.expiredRecords.length) {
      const ws = XLSX.utils.json_to_sheet(metrics.expiredRecords);
      XLSX.utils.book_append_sheet(wb, ws, "Expired Cards");
    }

    if (metrics.upcomingRecords.length) {
      const ws = XLSX.utils.json_to_sheet(metrics.upcomingRecords);
      XLSX.utils.book_append_sheet(wb, ws, "Renewals Due");
    }

    if (workforceSplit.motorcyclist.length) {
       const ws = XLSX.utils.json_to_sheet(workforceSplit.motorcyclist);
       XLSX.utils.book_append_sheet(wb, ws, "Motorcyclists");
    }
    
    if (workforceSplit.staffSupport.length) {
       const ws = XLSX.utils.json_to_sheet(workforceSplit.staffSupport);
       XLSX.utils.book_append_sheet(wb, ws, "Support Staff");
    }

    XLSX.writeFile(wb, `EMPMAS_Intelligence_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsExporting(false);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 w-full">
      {/* EXECUTIVE COMMAND HEADER */}
      <div className="bg-white rounded-3xl p-8 md:p-10 shadow-sm relative overflow-hidden flex flex-col xl:flex-row items-center justify-between gap-8 border border-slate-200">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/5 blur-[120px] -mr-40 -mt-40 rounded-full pointer-events-none"></div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2.5 text-sky-600 font-bold text-xs uppercase tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            <Zap size={15} /> Operational Command Hub
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Workforce Intelligence <span className="text-sky-600">Sync</span>
          </h2>
          <p className="text-slate-600 font-medium text-sm max-w-2xl leading-relaxed">
            Auditing <strong className="text-slate-900 font-bold">{metrics.total}</strong> active personnel records, visa credentials, and compliance deadlines.
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 relative z-10 w-full xl:w-auto items-center">
          <div className="grid grid-cols-3 gap-4 w-full md:w-auto bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
             <div className="flex flex-col items-center px-3">
                <div className="text-emerald-600 font-black text-2xl">
                  {metrics.total ? ((((metrics.total as number) - (metrics.expiredCardCount as number) - (metrics.escapeCount as number)) / (metrics.total as number)) * 100).toFixed(0) : 0}%
                </div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-0.5">Health</div>
             </div>
             <div className="flex flex-col items-center px-3 border-x border-slate-200">
                <div className="text-rose-600 font-black text-2xl">
                  {(metrics.expiredCardCount as number) + (metrics.escapeCount as number)}
                </div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-0.5">Risks</div>
             </div>
             <div className="flex flex-col items-center px-3">
                <div className="text-sky-600 font-black text-2xl">{metrics.total}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-0.5">Total</div>
             </div>
          </div>

          <button 
            onClick={handleFullExport}
            disabled={isExporting}
            className="bg-sky-600 hover:bg-sky-500 text-white px-7 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-sky-600/20 hover:-translate-y-0.5 active:scale-95 flex items-center gap-2.5 whitespace-nowrap min-w-[200px] justify-center"
          >
            {isExporting ? <Loader2 className="animate-spin text-white" size={17} /> : <FileSpreadsheet size={17} />}
            Export Full Report
          </button>
        </div>
      </div>

      {/* CORE OPERATIONAL KPIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <ProKpi 
          icon={<UserX />} 
          label="Escape Reports" 
          value={metrics.escapeCount} 
          color="rose" 
          onClick={() => onDrillDown("Escape Registry", metrics.escapeRecords)} 
          onDownload={(e) => directDownload("Escape_Reports", metrics.escapeRecords, e)}
        />
        <ProKpi 
          icon={<ShieldX />} 
          label="Expired Credentials" 
          value={metrics.expiredCardCount} 
          color="amber" 
          onClick={() => onDrillDown("Expired Registry", metrics.expiredRecords)} 
          onDownload={(e) => directDownload("Expired_Credentials", metrics.expiredRecords, e)}
        />
        <ProKpi 
          icon={<Bike />} 
          label="Motorcyclists / Riders" 
          value={workforceSplit.motorcyclist.length} 
          color="sky" 
          onClick={() => onDrillDown("Motorcyclists", workforceSplit.motorcyclist)} 
          onDownload={(e) => directDownload("Motorcyclists", workforceSplit.motorcyclist, e)}
        />
        <ProKpi 
          icon={<MoreHorizontal />} 
          label="Staff & Operations" 
          value={workforceSplit.staffSupport.length} 
          color="slate" 
          onClick={() => onDrillDown("Support Staff", workforceSplit.staffSupport)} 
          onDownload={(e) => directDownload("Support_Staff", workforceSplit.staffSupport, e)}
        />
        <ProKpi 
          icon={<CreditCard />} 
          label="Active Personnel" 
          value={metrics.activeCount} 
          color="emerald" 
          onClick={() => onDrillDown("Active", rows.filter(r => !metrics.expiredRecords.includes(r)))} 
          onDownload={(e) => directDownload("Active_Personnel", rows.filter(r => !metrics.expiredRecords.includes(r)), e)}
        />
        <ProKpi 
          icon={<Activity />} 
          label="Renewals (This Month)" 
          value={metrics.upcomingRenewals} 
          color="sky" 
          onClick={() => onDrillDown("Upcoming (Current Month)", metrics.upcomingRecords)} 
          onDownload={(e) => directDownload("Upcoming_Renewals", metrics.upcomingRecords, e)}
        />
      </div>

      {/* OPERATIONAL PIPELINE: 6-MONTH EXPIRY FORECAST */}
      <div className="bg-white rounded-3xl p-8 md:p-10 shadow-sm relative overflow-hidden border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-sky-600 font-bold text-xs uppercase tracking-wider mb-1.5">
              <Calendar size={16} /> Expiry Timeline
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              6-Month Expiry Forecast
            </h3>
            <p className="text-slate-500 font-medium text-xs mt-1">
              Projected workforce labor card & visa renewal requirements by month.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3.5 py-1.5 rounded-lg border border-slate-200 w-fit">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Click any month card to view or drill down records</span>
          </div>
        </div>

        {/* 6-Month Cards with visible Month, Year and Water-Blue styling */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 relative z-10">
          {renewalForecast.map((item) => (
            <div 
              key={item.key} 
              className="group relative bg-slate-50/70 hover:bg-white rounded-2xl p-5 border border-slate-200 hover:border-sky-400 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between min-h-[300px]" 
              onClick={() => onDrillDown(`Forecast: ${item.month} ${item.year}`, item.rows)}
            >
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex justify-between items-start mb-5">
                    {/* Month and Year Badge */}
                    <div className="px-3.5 py-2 bg-sky-50 border border-sky-200 rounded-xl flex flex-col items-center justify-center min-w-[62px] group-hover:bg-sky-100 group-hover:border-sky-300 transition-colors">
                      <span className="text-[10px] font-bold tracking-wider text-sky-600 uppercase leading-none mb-1">
                        {item.year}
                      </span>
                      <span className="text-lg font-black text-slate-900 tracking-tight leading-none">
                        {item.month}
                      </span>
                    </div>

                    {/* Download Button on Card */}
                    <button 
                      onClick={(e) => directDownload(`Forecast_${item.month}_${item.year}`, item.rows, e)}
                      className="p-2 bg-white hover:bg-sky-50 hover:text-sky-600 text-slate-400 rounded-lg transition-all border border-slate-200 shadow-xs"
                      title={`Download ${item.month} ${item.year} report`}
                    >
                      <DownloadCloud size={15} />
                    </button>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                      Renewals Due
                    </p>
                    <div className="text-4xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
                      {item.count}
                    </div>
                    
                    {item.escapeCount > 0 ? (
                      <div className="mt-3 inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                        <ShieldAlert size={12} className="text-rose-600 shrink-0" />
                        <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wide">
                          {item.escapeCount} Escape{item.escapeCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                        <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                        <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wide">
                          0 Escapes
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-200">
                   <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      <span>Workload</span>
                      <span className="text-sky-600 font-mono">{Math.round(item.intensity)}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          item.intensity > 70 
                            ? 'bg-rose-500' 
                            : 'bg-sky-500'
                        }`} 
                        style={{ width: `${Math.max(item.intensity, 6)}%` }} 
                      />
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ProKpiProps {
  icon: React.ReactElement<any>;
  label: string;
  value: number;
  color: 'rose' | 'amber' | 'emerald' | 'sky' | 'slate';
  onClick: () => void;
  onDownload: (e: React.MouseEvent) => void;
}

const ProKpi: React.FC<ProKpiProps> = ({ icon, label, value, color, onClick, onDownload }) => {
  const themes = { 
    rose: {
      badge: 'bg-rose-50 text-rose-600 border-rose-200',
      hover: 'hover:border-rose-300',
    },
    amber: {
      badge: 'bg-amber-50 text-amber-600 border-amber-200',
      hover: 'hover:border-amber-300',
    },
    emerald: {
      badge: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      hover: 'hover:border-emerald-300',
    },
    sky: {
      badge: 'bg-sky-50 text-sky-600 border-sky-200',
      hover: 'hover:border-sky-300',
    },
    slate: {
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      hover: 'hover:border-slate-300',
    }
  };

  const currentTheme = themes[color] || themes.sky;
  
  return (
    <div 
      onClick={onClick} 
      className={`p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[210px] ${currentTheme.hover}`}
    >
      <div className="flex items-start justify-between">
         <div className={`p-3.5 rounded-2xl w-fit border ${currentTheme.badge}`}>
           {React.cloneElement(icon, { size: 24 })}
         </div>
         <button 
           onClick={onDownload} 
           className="p-2.5 bg-slate-50 hover:bg-sky-50 hover:text-sky-600 text-slate-400 rounded-xl transition-all border border-slate-200"
           title="Download Report"
         >
           <DownloadCloud size={16} />
         </button>
      </div>

      <div className="mt-5">
        <h4 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">{label}</h4>
        <div className="text-4xl font-black text-slate-900 tracking-tight leading-none flex items-baseline gap-2">
          <span>{value.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
