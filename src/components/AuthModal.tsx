import React, { useState } from 'react';
import { X, User, Mail, Lock, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';
import { UserProfile } from '../types';
import { getSupabaseClient, getSupabaseCredentials } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
}) => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isSignUp && !fullName.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your Full Name for Sign Up.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    const userRole: 'admin' | 'user' = 'user';
    const computedName = fullName.trim() || email.split('@')[0];

    const supabase = getSupabaseClient();
    const currentCreds = getSupabaseCredentials();

    if (!currentCreds.isConfigured) {
      setStatusMessage({
        type: 'info',
        text: 'Supabase is not configured yet with live project credentials.',
      });
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Register User in Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              full_name: computedName,
              role: userRole,
              avatar_url: `https://picsum.photos/seed/${encodeURIComponent(email)}/100/100`,
            },
          },
        });

        if (error) {
          setStatusMessage({ type: 'error', text: `Supabase Auth Error: ${error.message}` });
          setLoading(false);
          return;
        }

        const userObj = data.user;
        const userProfile: UserProfile = {
          id: userObj?.id || `user-${Date.now()}`,
          email: email.trim(),
          full_name: computedName,
          avatar_url: `https://picsum.photos/seed/${encodeURIComponent(email)}/100/100`,
          role: userRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Insert record into startupcreme schema database table
        try {
          await supabase.schema('startupcreme').from('users').upsert({
            id: userProfile.id,
            email: userProfile.email,
            full_name: userProfile.full_name,
            avatar_url: userProfile.avatar_url,
            role: userProfile.role,
          });
        } catch (e) {
          console.warn('Startupcreme schema user upsert error:', e);
        }

        const emailConfirmText = data.session ? '' : ' (Check email inbox if confirmation is required)';

        setStatusMessage({
          type: 'success',
          text: `Account created successfully in Supabase with ${userRole.toUpperCase()} privilege!${emailConfirmText}`,
        });

        setTimeout(() => {
          onSelectUser(userProfile);
          onClose();
        }, 1200);

      } else {
        // Sign In Mode
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          setStatusMessage({ type: 'error', text: `Supabase Auth Error: ${error.message}` });
          setLoading(false);
          return;
        }

        const userObj = data.user;
        let fetchedRole: 'admin' | 'user' = userRole;
        let fetchedName = userObj?.user_metadata?.full_name || computedName;
        let fetchedAvatar = userObj?.user_metadata?.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(email)}/100/100`;

        try {
          const { data: scUser } = await supabase.schema('startupcreme').from('users').select('*').eq('id', userObj.id).maybeSingle();
          if (scUser) {
            if (scUser.role) fetchedRole = scUser.role as 'admin' | 'user';
            if (scUser.full_name) fetchedName = scUser.full_name;
            if (scUser.avatar_url) fetchedAvatar = scUser.avatar_url;
          }
        } catch (e) {
          console.warn('DB profile fetch error:', e);
        }

        const userProfile: UserProfile = {
          id: userObj?.id || `user-${Date.now()}`,
          email: email.trim(),
          full_name: fetchedName,
          avatar_url: fetchedAvatar,
          role: fetchedRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setStatusMessage({ type: 'success', text: 'Signed in successfully with Supabase!' });
        setTimeout(() => {
          onSelectUser(userProfile);
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Authentication request failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-2xl relative text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Branding */}
        <div className="text-center mb-5">
          <img 
            src="/logo.jpg" 
            alt="StartupCrème Logo" 
            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm mx-auto mb-3"
          />
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            {isSignUp 
              ? 'Register your account with Supabase to publish articles and manage topics.' 
              : 'Welcome back! Sign in to access your dashboard and publications.'
            }
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setStatusMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              isSignUp ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setStatusMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              !isSignUp ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div className={`mb-4 p-3 rounded-xl text-xs flex items-start gap-2 border ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            )}
            <span className="font-medium leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {/* Full Name field (Sign Up Only) */}
          {isSignUp && (
            <div>
              <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  required={isSignUp}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@email.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 min-h-[44px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
              </>
            ) : (
              <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
            )}
          </button>
        </form>

        {/* Toggle Mode Footer */}
        <div className="mt-5 text-center">
          <p className="text-xs text-slate-500">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setStatusMessage(null);
              }}
              className="text-cyan-600 font-bold hover:underline cursor-pointer"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
