import React, { useState } from 'react';
import { Mail, ArrowRight, ShieldCheck, Globe, Check, AlertCircle, Loader2 } from 'lucide-react';
import { store } from '../lib/store';

interface FooterProps {
  currentLocale: string;
  onTabChange: (tab: 'home' | 'finance' | 'tech' | 'discussion' | 'admin') => void;
  onOpenAuth?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ currentLocale, onTabChange, onOpenAuth }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message?: string }>({ type: 'idle' });
  const [email, setEmail] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setStatus({ type: 'idle' });

    const res = await store.subscribeNewsletter(email, 'footer', 'all', currentLocale);
    setLoading(false);

    if (res.success) {
      setStatus({ type: 'success', message: '✓ Recorded in Supabase database!' });
      setEmail('');
      setTimeout(() => {
        setStatus({ type: 'idle' });
      }, 5000);
    } else {
      setStatus({ 
        type: 'error', 
        message: res.error || 'Database subscription failed.' 
      });
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-300 py-16 px-4 border-t border-slate-800">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10">
        {/* Column 1: Brand & Tagline */}
        <div className="md:col-span-5">
          <div 
            onClick={() => onTabChange('home')}
            className="flex items-center gap-2.5 cursor-pointer mb-4"
          >
            <img 
              src="/logo.jpg" 
              alt="StartupCrème Logo" 
              className="w-8 h-8 object-cover rounded-lg shadow-xs border border-slate-700" 
            />
            <span className="font-serif text-2xl font-bold text-white tracking-tight">
              Startup <span className="text-emerald-400">Crème</span>
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed mb-6 font-sans">
            Startup Crème is the definitive multinational publication delivering non-sponsored institutional intelligence on private credit, venture capital liquidity, autonomous AI architectures, and GPU cluster engineering.
          </p>

          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
            <ShieldCheck className="w-4 h-4" />
            <span>Strict YMYL & Google Topical Authority Siloing</span>
          </div>
        </div>

        {/* Column 2: Topical Subpath Silos */}
        <div className="md:col-span-3 space-y-3">
          <h4 className="font-serif text-sm font-bold text-white tracking-wider">Topical Silos</h4>
          <ul className="space-y-2 text-xs font-mono">
            <li>
              <button 
                onClick={() => onTabChange('finance')}
                className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Finance & Debt</span>
              </button>
            </li>
            <li>
              <button 
                onClick={() => onTabChange('tech')}
                className="hover:text-cyan-400 transition-colors flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                <span>Tech Systems</span>
              </button>
            </li>
            <li>
              <button 
                onClick={() => onTabChange('discussion')}
                className="hover:text-teal-300 transition-colors flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                <span>Community Forum</span>
              </button>
            </li>
          </ul>
        </div>

        {/* Column 3: Newsletter */}
        <div className="md:col-span-4">
          <h4 className="font-serif text-sm font-bold text-white tracking-wider mb-2">Institutional Intelligence Dispatch</h4>
          <p className="text-xs text-slate-400 mb-4">
            Join 45,000+ VCs, software architects, and founders receiving our weekly deep-dives.
          </p>

          <form onSubmit={handleSubscribe} className="space-y-2">
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="subscriber@vc-fund.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-24 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-900" />
                ) : status.type === 'success' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span>Join</span>
                )}
              </button>
            </div>
          </form>

          {status.type === 'success' && (
            <p className="text-[11px] text-emerald-400 font-mono mt-2">
              {status.message}
            </p>
          )}

          {status.type === 'error' && (
            <div className="mt-2 text-[11px] text-amber-300 bg-amber-950/70 border border-amber-800/80 rounded-xl p-3 space-y-1 font-sans">
              <div className="font-semibold flex items-center gap-1.5 text-amber-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Database Connection Notice:</span>
              </div>
              <p className="text-amber-300/90 leading-normal">{status.message}</p>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="mt-1.5 text-cyan-400 hover:text-cyan-300 font-bold text-[10px] uppercase tracking-wider underline cursor-pointer block"
                >
                  Configure Supabase Project Keys & Setup →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-400 gap-4">
        <div>
          © {new Date().getFullYear()} Startup Crème. All rights reserved.
        </div>
        <div className="flex items-center gap-4">
          <span>Privacy Policy</span>
          <span>Terms of Editorial Service</span>
          <span>Sitemap XML</span>
        </div>
      </div>
    </footer>
  );
};
