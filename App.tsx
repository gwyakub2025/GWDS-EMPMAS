import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileUp, 
  Table, 
  LayoutGrid, 
  Sparkles, 
  Search,
  Database,
  PieChart,
  LogOut,
  FileSpreadsheet,
  Trash2,
  ShieldCheck,
  Eye,
  Layers,
  FileText,
  CalendarDays,
  FileSearch,
  RefreshCw,
  X,
  Building2,
  ChevronDown,
  Users,
  Plus,
  AlertCircle
} from 'lucide-react';
import { DataRow, ProcessedData } from './types';
import { harmonizeData } from './utils/dataProcessor';
import { DataTable } from './components/DataTable';
import { PivotView } from './components/PivotView';
import { Dashboard } from './components/Dashboard';
import { ReportExtractor } from './components/ReportExtractor';
import { UserManagement } from './components/UserManagement';
import { generateDataSummary } from './services/gemini';
import { Login } from './components/Login';
import { 
  CompanyMeta, 
  fetchCompanies, 
  uploadCompanyData, 
  createCompanyEntity,
  deleteCompanyData, 
  downloadCompanyFile, 
  logout, 
  subscribeToAuth 
} from './services/firebase';

const ADMIN_EMAIL = "admin@empmas.com"; 

const App: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Data State
  const [companies, setCompanies] = useState<CompanyMeta[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [currentData, setCurrentData] = useState<ProcessedData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // App UI State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'preview' | 'pivot' | 'extract' | 'ai' | 'users'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [drillDownData, setDrillDownData] = useState<{ title: string; rows: DataRow[] } | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Upload/Create State
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Forms
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [targetUploadCompanyId, setTargetUploadCompanyId] = useState<string>('');
  const [newCompanyName, setNewCompanyName] = useState('');

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const adminStatus = currentUser.email === ADMIN_EMAIL;
        setIsAdmin(adminStatus);
        if (!adminStatus && activeTab === 'users') {
          setActiveTab('dashboard');
        }
        loadCompanyList();
      } else {
        setIsAdmin(false);
        setCompanies([]);
        setCurrentData(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load Company List
  const loadCompanyList = async () => {
    try {
      const list = await fetchCompanies();
      setCompanies(list);
    } catch (error) {
      console.error("Failed to load companies", error);
    }
  };

  // 3. Load Selected Company Data
  useEffect(() => {
    if (!selectedCompanyId) {
      setCurrentData(null);
      return;
    }
    const loadFile = async () => {
      setIsLoadingData(true);
      const company = companies.find(c => c.id === selectedCompanyId);
      if (company) {
        if (!company.hasData || !company.storagePath) {
            setCurrentData(null);
            setIsLoadingData(false);
            return; // Company exists but no file uploaded yet
        }

        try {
          const arrayBuffer = await downloadCompanyFile(company.storagePath);
          const wb = XLSX.read(arrayBuffer, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(ws) as DataRow[];
          const harmonized = harmonizeData(jsonData);
          setCurrentData(harmonized);
          setActiveTab('dashboard'); 
        } catch (err) {
          console.error(err);
          alert("Failed to load company data.");
        }
      }
      setIsLoadingData(false);
    };
    loadFile();
  }, [selectedCompanyId, companies]);

  // 4. Handle Create Entity (Admin)
  const handleCreateCompany = async () => {
    if (!newCompanyName.trim() || !user) return;
    setIsUploading(true); // Reuse loading state
    try {
        await createCompanyEntity(newCompanyName, user.uid);
        await loadCompanyList();
        setNewCompanyName('');
        setShowCreateModal(false);
    } catch (e) {
        alert("Failed to create entity");
    } finally {
        setIsUploading(false);
    }
  };

  // 5. Handle File Upload (Admin)
  const handleUploadSubmit = async () => {
    if (!uploadFile || !targetUploadCompanyId || !user) return;
    setIsUploading(true);
    try {
      await uploadCompanyData(uploadFile, targetUploadCompanyId, user.uid);
      await loadCompanyList();
      
      // If we uploaded to the currently selected company, reload the data
      if (selectedCompanyId === targetUploadCompanyId) {
         // Trigger reload by momentarily clearing selection or forcing update (handled by deps in useEffect)
         // For simplicity, just let the user see the success message
      }
      
      setUploadFile(null);
      setTargetUploadCompanyId('');
      setShowUploadModal(false);
      alert("Company Data Updated Successfully. Old data has been overwritten.");
    } catch (e: any) {
      alert("Upload Failed: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleDeleteCompany = async (id: string, path: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Permanently delete this company and its data?")) return;
    try {
      await deleteCompanyData(id, path);
      if (selectedCompanyId === id) setSelectedCompanyId(null);
      await loadCompanyList();
    } catch (err) {
      alert("Delete failed.");
    }
  };

  // Filter Logic
  const filteredRows = useMemo(() => {
    if (!currentData) return [];
    if (!searchTerm) return currentData.rows;
    const s = searchTerm.toLowerCase();
    return currentData.rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(s)));
  }, [currentData, searchTerm]);

  const drillDownFiltered = useMemo(() => {
    if (!drillDownData) return [];
    if (!dateRange.start && !dateRange.end) return drillDownData.rows;
    return drillDownData.rows.filter(row => {
      const dateKey = Object.keys(row).find(k => k.includes('(Date)'));
      if (!dateKey) return true;
      const dateStr = String(row[dateKey]).split(';')[0].trim();
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const rowDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (dateRange.start && rowDate < new Date(dateRange.start)) return false;
        if (dateRange.end && rowDate > new Date(dateRange.end)) return false;
      }
      return true;
    });
  }, [drillDownData, dateRange]);

  const handleDrillDown = (title: string, rows: DataRow[]) => {
    setDrillDownData({ title, rows });
    setDateRange({ start: '', end: '' });
  };

  if (loadingAuth) return <div className="h-screen bg-slate-50 flex items-center justify-center"><RefreshCw className="animate-spin text-sky-600" size={40} /></div>;
  if (!user) return <Login />;

  const selectedCompanyMeta = companies.find(c => c.id === selectedCompanyId);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50 text-slate-800 overflow-hidden h-screen">
      {/* Top Bar */}
      <div className={`px-8 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider z-[100] border-b ${
        isAdmin 
          ? 'bg-sky-50 text-sky-800 border-sky-200' 
          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
      }`}>
        <div className="flex items-center gap-3">
          {isAdmin ? <ShieldCheck size={15} className="text-sky-600" /> : <Eye size={15} className="text-emerald-600" />} 
          <span>{isAdmin ? 'Administrator Console' : 'Viewer Access'}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-600 font-mono text-xs">{user.email}</span>
          <button 
            onClick={() => logout()} 
            className="hover:text-rose-600 text-slate-600 flex items-center gap-1.5 transition-colors font-medium text-xs normal-case"
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </div>

      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-sky-500 to-cyan-600 p-2.5 rounded-2xl text-white shadow-md shadow-sky-500/20">
            <Database size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
              GW <span className="text-sky-600">Harmonizer</span>
            </h1>
            <span className="text-[11px] font-mono text-slate-500 tracking-wider">gwdelivery.ae intelligence portal</span>
          </div>
        </div>
        
        {/* Company Selector Dropdown */}
        <div className="flex items-center gap-5">
          <div className="relative z-50">
            <div className="relative group">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-sky-600 transition-colors" size={16} />
              <select 
                value={selectedCompanyId || ''}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-300 hover:border-sky-500 rounded-xl pl-10 pr-9 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white w-64 cursor-pointer transition-all shadow-sm"
              >
                <option value="" disabled>Select Company Entity</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {!c.hasData ? '(Empty)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-600 transition-colors" size={15} />
            <input 
              type="text" 
              placeholder="Global Filter..." 
              className="bg-slate-50 border border-slate-300 focus:bg-white hover:border-slate-400 rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-sky-500 outline-none transition-all w-60 text-slate-800 font-medium placeholder:text-slate-400 shadow-sm" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-white border-r border-slate-200 p-6 flex flex-col space-y-6 hidden md:flex shrink-0 shadow-sm">
          
          {/* Admin Upload Section */}
          {isAdmin && (
            <div className="space-y-3">
              <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] px-2">Data Ingestion</div>
              <button 
                onClick={() => setShowUploadModal(true)} 
                className="w-full flex items-center gap-3 p-3.5 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 rounded-2xl cursor-pointer transition-all shadow-md shadow-sky-600/20 group text-left"
              >
                <FileUp size={18} className="text-white" />
                <span className="text-xs font-black text-white uppercase tracking-wider">Update Data</span>
              </button>
            </div>
          )}

          {/* Company List (Sidebar) */}
          <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between px-2 mb-2">
               <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">Entities</div>
               {isAdmin && (
                   <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-sky-50 hover:bg-sky-100 text-sky-700 p-1.5 rounded-lg transition-all border border-sky-200"
                    title="Add Entity"
                   >
                       <Plus size={13} />
                   </button>
               )}
            </div>
            
            {companies.map(c => (
              <div 
                key={c.id} 
                onClick={() => setSelectedCompanyId(c.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all cursor-pointer group ${
                  selectedCompanyId === c.id 
                    ? 'bg-sky-50 text-sky-900 border border-sky-300 shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <FileText size={15} className={!c.hasData ? 'text-slate-300' : selectedCompanyId === c.id ? 'text-sky-600' : 'text-slate-400'} />
                  <div className="flex flex-col truncate">
                    <span className="truncate">{c.name}</span>
                    <span className="text-[10px] font-normal text-slate-400">
                        {c.hasData ? new Date(c.uploadDate!).toLocaleDateString() : 'No Data'}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={(e) => handleDeleteCompany(c.id, c.storagePath, e)} className="p-1 hover:bg-rose-100 hover:text-rose-600 text-slate-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            {companies.length === 0 && <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest py-8">No Entities Configured</div>}
          </div>

          <nav className="space-y-1 pt-4 border-t border-slate-200">
            {/* Standard Tabs */}
            {[
              { id: 'dashboard', label: 'Analysis Hub', icon: PieChart },
              { id: 'extract', label: 'Query Hub', icon: FileSearch },
              { id: 'pivot', label: 'Pivot Table', icon: LayoutGrid },
              { id: 'preview', label: 'Data Grid', icon: Table },
              { id: 'ai', label: 'AI Narrative', icon: Sparkles },
            ].map(item => (
              <button 
                key={item.id} 
                onClick={() => setActiveTab(item.id as any)} 
                disabled={!currentData}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === item.id 
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                } ${!currentData ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <item.icon size={17} className={activeTab === item.id ? 'text-white' : 'text-slate-500'} /> {item.label}
              </button>
            ))}

            {/* Admin Only Tab */}
            {isAdmin && (
               <button 
               onClick={() => setActiveTab('users')} 
               className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                 activeTab === 'users' 
                   ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20' 
                   : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
               }`}
             >
               <Users size={17} className={activeTab === 'users' ? 'text-white' : 'text-slate-500'} /> User Management
             </button>
            )}
          </nav>
        </aside>

        <section className="flex-1 overflow-auto bg-slate-50 p-8 md:p-12 custom-scrollbar relative">
          
          {/* Loading State */}
          {isLoadingData && (
            <div className="h-full flex flex-col items-center justify-center space-y-6 animate-in fade-in">
              <RefreshCw className="animate-spin text-sky-600" size={50} />
              <p className="text-slate-600 font-bold uppercase tracking-wider text-xs">Loading Personnel Data...</p>
            </div>
          )}

          {/* Special Case for User Management Tab */}
          {!isLoadingData && activeTab === 'users' && isAdmin && (
             <div className="max-w-7xl mx-auto animate-in fade-in">
                <UserManagement />
             </div>
          )}

          {/* Empty State / No Data for Selected Company */}
          {!isLoadingData && activeTab !== 'users' && (!currentData || !selectedCompanyId) && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-lg mx-auto">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center border border-slate-200 shadow-md">
                <Layers size={36} className="text-sky-600" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {selectedCompanyId ? (selectedCompanyMeta?.hasData ? 'Loading...' : 'Empty Entity') : 'Select an Entity'}
              </h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                {selectedCompanyId && !selectedCompanyMeta?.hasData 
                    ? "This company entity has been created but contains no data records. As an Admin, use the 'Update Data' button to upload an Excel sheet."
                    : "Choose a company from the dropdown or sidebar to load its operational dashboard."
                }
              </p>
              {selectedCompanyId && !selectedCompanyMeta?.hasData && isAdmin && (
                  <button 
                    onClick={() => { setTargetUploadCompanyId(selectedCompanyId); setShowUploadModal(true); }}
                    className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs shadow-md shadow-sky-600/20"
                  >
                      Upload Data Now
                  </button>
              )}
              {!selectedCompanyId && companies.length === 0 && isAdmin && (
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs shadow-md shadow-sky-600/20 flex items-center gap-2"
                  >
                      <Plus size={16} /> Add Company Entity
                  </button>
              )}
            </div>
          )}

          {/* Content for Data Tabs */}
          {currentData && !isLoadingData && activeTab !== 'users' && (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 text-slate-600 font-bold text-xs uppercase tracking-wider bg-white w-fit px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div> Live Operational Stream: <span className="text-slate-900 font-black">{companies.find(c => c.id === selectedCompanyId)?.name}</span>
              </div>

              {activeTab === 'dashboard' && <Dashboard rows={currentData.rows} onDrillDown={handleDrillDown} />}
              {activeTab === 'extract' && <ReportExtractor rows={currentData.rows} headers={currentData.headers} />}
              {activeTab === 'pivot' && <PivotView rows={currentData.rows} headers={currentData.headers} />}
              {activeTab === 'preview' && (
                <DataTable 
                  headers={currentData.headers} 
                  rows={filteredRows} 
                  highlightTerm={searchTerm} 
                  tableName={companies.find(c => c.id === selectedCompanyId)?.name?.replace(/\s+/g, '_') || "Harmonized_Records"} 
                />
              )}
              {activeTab === 'ai' && (
                <div className="bg-white rounded-3xl border border-slate-200 p-10 md:p-14 relative overflow-hidden shadow-lg">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 relative z-10">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-sky-600">Machine Synthesis</span>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight mt-1">Narrative Executive Summary</h3>
                    </div>
                    <button 
                      onClick={async () => { setIsGeneratingAi(true); const s = await generateDataSummary(currentData.rows); setAiSummary(s); setIsGeneratingAi(false); }} 
                      disabled={isGeneratingAi} 
                      className="bg-sky-600 hover:bg-sky-500 text-white px-8 py-4 rounded-2xl font-bold text-sm transition-all shadow-md shadow-sky-600/20 flex items-center gap-2"
                    >
                      {isGeneratingAi ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />} {aiSummary ? 'Regenerate' : 'Initiate Summary'}
                    </button>
                  </div>
                  <div className="prose max-w-none text-base leading-relaxed text-slate-700 relative z-10 whitespace-pre-wrap bg-slate-50 p-8 rounded-2xl border border-slate-200 font-normal">
                    {aiSummary || "Awaiting intelligence trigger. Click the button above to generate an executive synopsis of all personnel, visa expiries, and department metrics."}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* CREATE COMPANY MODAL */}
      {showCreateModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 p-8 space-y-6 shadow-2xl">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-sky-50 text-sky-600 border border-sky-100 rounded-2xl flex items-center justify-center mx-auto"><Building2 size={28} /></div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">New Entity</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Register Company Entity</p>
            </div>
            
            <div className="space-y-4">
               <div>
                 <label className="text-xs font-bold text-slate-600 uppercase ml-1 mb-1.5 block">Entity Name</label>
                 <input autoFocus type="text" className="w-full p-3.5 bg-slate-50 border border-slate-300 focus:bg-white rounded-xl text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-sky-500 transition-all" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="e.g. GW Express Deliveries" />
               </div>
               <p className="text-xs text-slate-500 italic text-center">Data can be uploaded to this entity after creation.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowCreateModal(false); setNewCompanyName(''); }} className="flex-1 py-3 text-slate-600 hover:text-slate-900 font-bold uppercase text-xs transition-colors">Cancel</button>
              <button onClick={handleCreateCompany} disabled={isUploading || !newCompanyName.trim()} className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold uppercase text-xs shadow-md shadow-sky-600/20 flex items-center justify-center gap-2">
                 {isUploading ? <RefreshCw className="animate-spin" size={14} /> : "Create Entity"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 p-8 space-y-6 shadow-2xl">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-sky-50 text-sky-600 border border-sky-100 rounded-2xl flex items-center justify-center mx-auto"><FileSpreadsheet size={28} /></div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Update Data</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Cloud Data Ingestion</p>
            </div>
            
            <div className="space-y-4">
               <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-2.5">
                   <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                   <p className="text-xs text-amber-800 leading-relaxed font-medium">
                       Uploading a new file will replace existing records for this entity.
                   </p>
               </div>

               <div>
                 <label className="text-xs font-bold text-slate-600 uppercase ml-1 mb-1.5 block">Target Entity</label>
                 <div className="relative">
                    <select 
                        className="w-full p-3.5 bg-slate-50 border border-slate-300 focus:bg-white rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-sky-500 appearance-none cursor-pointer"
                        value={targetUploadCompanyId}
                        onChange={(e) => setTargetUploadCompanyId(e.target.value)}
                    >
                        <option value="" disabled>Select Company...</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name} {c.hasData ? '(Has Data)' : '(Empty)'}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                 </div>
               </div>
               
               <div>
                 <label className="text-xs font-bold text-slate-600 uppercase ml-1 mb-1.5 block">Source File (.xlsx, .csv)</label>
                 <input type="file" onChange={handleFileSelect} accept=".xlsx,.csv" className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer" />
               </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowUploadModal(false); setUploadFile(null); setTargetUploadCompanyId(''); }} className="flex-1 py-3 text-slate-600 hover:text-slate-900 font-bold uppercase text-xs transition-colors">Cancel</button>
              <button onClick={handleUploadSubmit} disabled={isUploading || !targetUploadCompanyId || !uploadFile} className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold uppercase text-xs shadow-md shadow-sky-600/20 flex items-center justify-center gap-2">
                 {isUploading ? <RefreshCw className="animate-spin" size={14} /> : "Upload & Harmonize"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill Down Modal */}
      {drillDownData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-7xl h-[90vh] rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-200 flex flex-col space-y-6 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-sky-600">Personnel Drill-Down</span>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{drillDownData.title}</h3>
                </div>
                <button onClick={() => setDrillDownData(null)} className="p-2.5 hover:bg-slate-200 rounded-xl text-slate-500 hover:text-slate-900 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <CalendarDays className="text-sky-600" size={16} />
                  <span className="text-xs font-bold text-slate-500">From:</span>
                  <input type="date" className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">To:</span>
                  <input type="date" className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-6 md:p-8 bg-slate-50">
              <DataTable 
                headers={currentData?.headers || []} 
                rows={drillDownFiltered} 
                tableName={drillDownData.title.replace(/\s+/g, '_')} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;