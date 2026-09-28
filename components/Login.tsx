
import React, { useState } from 'react';
import { login } from '../services/firebase';
import { ShieldCheck, Lock, Mail, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError("Invalid credentials. Please verify your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[32px] p-10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 blur-[80px] rounded-full -mr-20 -mt-20"></div>
        
        <div className="relative z-10">
          <div className="flex justify-center mb-8">
            <div className="bg-sky-50 p-4 rounded-2xl border border-sky-200 shadow-sm">
              <ShieldCheck className="text-sky-600" size={40} />
            </div>
          </div>
          
          <h2 className="text-3xl font-black text-slate-800 text-center tracking-tight mb-2">Secure Access</h2>
          <p className="text-slate-500 text-center text-xs font-bold uppercase tracking-widest mb-10">DataHarmonizer Pro</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase ml-2">Email Identity</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-4 pl-12 pr-4 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 focus:bg-white outline-none transition-all text-sm"
                  placeholder="admin@empmas.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase ml-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-4 pl-12 pr-4 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 focus:bg-white outline-none transition-all text-sm"
                  placeholder="admin123"
                  required
                />
              </div>
            </div>

            {error && <div className="text-rose-600 text-xs font-bold text-center bg-rose-50 py-3 rounded-lg border border-rose-200">{error}</div>}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-md shadow-sky-600/20 active:scale-95 flex items-center justify-center gap-2 text-xs"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Authenticate"}
            </button>
          </form>
          
          <div className="mt-8 text-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">Default Admin Credentials</p>
            <p className="text-xs text-sky-700 font-mono font-bold">admin@empmas.com • admin123</p>
            <button
              type="button"
              onClick={() => { setEmail('admin@empmas.com'); setPassword('admin123'); }}
              className="mt-2 text-[10px] text-sky-600 hover:text-sky-800 underline uppercase tracking-wider font-bold cursor-pointer transition-colors"
            >
              Fill Credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
