
import React, { useState, useEffect } from 'react';
import { fetchSystemUsers, createSystemUser, deleteSystemUser, SystemUser } from '../services/firebase';
import { UserPlus, Trash2, Shield, User, Loader2, Key } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = async () => {
    try {
      const list = await fetchSystemUsers();
      setUsers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) return;
    
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      await createSystemUser(newUserEmail, newUserPassword);
      setNewUserEmail('');
      setNewUserPassword('');
      setSuccess('User created successfully.');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm('Are you sure you want to remove this user? This cannot be undone.')) return;
    try {
      await deleteSystemUser(uid);
      loadUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* Header */}
      <div className="bg-white rounded-3xl p-10 border border-slate-200 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-sky-500/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-4">
            <div className="bg-sky-600 p-3.5 rounded-2xl text-white shadow-md shadow-sky-600/20">
              <UserPlus size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">User Directory</h3>
              <p className="text-slate-500 text-sm font-medium">Manage access credentials for system operators.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create User Form */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-fit">
          <h4 className="text-xl font-bold text-slate-800 tracking-tight mb-6 flex items-center gap-2">
            <Shield size={20} className="text-sky-600" /> Grant Access
          </h4>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-2 mb-1 block">User Email</label>
              <input 
                type="email" 
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-2 mb-1 block">Password</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 pl-10 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white font-mono"
                  placeholder="Password"
                />
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              </div>
            </div>

            {error && <div className="text-rose-600 text-xs font-bold p-3 bg-rose-50 border border-rose-200 rounded-xl">{error}</div>}
            {success && <div className="text-emerald-700 text-xs font-bold p-3 bg-emerald-50 border border-emerald-200 rounded-xl">{success}</div>}

            <button 
              type="submit" 
              disabled={creating}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white p-3.5 rounded-xl font-bold uppercase text-xs tracking-wider shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {creating ? <Loader2 className="animate-spin" size={16} /> : "Create User"}
            </button>
          </form>
        </div>

        {/* User List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
             <div className="flex justify-center p-12"><Loader2 className="animate-spin text-sky-600" /></div>
          ) : (
            users.map(u => (
              <div key={u.uid} className="bg-white border border-slate-200 p-6 rounded-2xl flex items-center justify-between group hover:border-sky-300 hover:shadow-sm transition-all">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${u.role === 'admin' ? 'bg-sky-50 text-sky-600' : 'bg-slate-100 text-slate-600'}`}>
                    {u.role === 'admin' ? <Shield size={20} /> : <User size={20} />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{u.email}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{u.role}</div>
                  </div>
                </div>
                {u.role !== 'admin' && (
                  <button 
                    onClick={() => handleDelete(u.uid)}
                    className="p-2.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all"
                    title="Remove User"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                {u.role === 'admin' && (
                  <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full uppercase tracking-wider">Protected</span>
                )}
              </div>
            ))
          )}
          {!loading && users.length === 0 && (
             <div className="text-center text-slate-400 font-bold py-12">No users found.</div>
          )}
        </div>

      </div>
    </div>
  );
};
