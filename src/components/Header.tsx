import React, { useState } from 'react';
import { 
  Globe, 
  MessageSquare, 
  ShieldAlert, 
  User as UserIcon, 
  Bookmark, 
  LogOut, 
  ChevronDown, 
  Search,
  SlidersHorizontal,
  Plus
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';
import { getTabUrl } from '../lib/router';

interface HeaderProps {
  currentLocale: string;
  onLocaleChange: (locale: string) => void;
  activeTab: 'home' | 'finance' | 'tech' | 'discussion' | 'admin';
  onTabChange: (tab: 'home' | 'finance' | 'tech' | 'discussion' | 'admin') => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onSwitchRole: (role: 'admin' | 'user' | 'guest') => void;
  bookmarkedCount: number;
  onOpenBookmarks: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const LOCALES = [
  { code: 'en-us', label: 'English (US)', flag: '🇺🇸' },
  { code: 'en-gb', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'de-de', label: 'Deutsch (DE)', flag: '🇩🇪' },
  { code: 'ja-jp', label: '日本語 (JP)', flag: '🇯🇵' },
  { code: 'fr-fr', label: 'Français (FR)', flag: '🇫🇷' },
];

export const Header: React.FC<HeaderProps> = ({
  currentLocale,
  onLocaleChange,
  activeTab,
  onTabChange,
  currentUser,
  onOpenAuth,
  onSwitchRole,
  bookmarkedCount,
  onOpenBookmarks,
  searchQuery,
  onSearchChange,
}) => {
  const [showLocaleMenu, setShowLocaleMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const selectedLocale = LOCALES.find(l => l.code === currentLocale) || LOCALES[0];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-900 shadow-sm">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <a 
          href={getTabUrl('home', currentLocale)}
          onClick={(e) => {
            e.preventDefault();
            onTabChange('home');
          }}
          className="cursor-pointer flex items-center gap-2.5 select-none group block text-left"
        >
          <img 
            src="/logo.jpg" 
            alt="StartupCrème Logo" 
            className="w-9 h-9 object-cover rounded-lg shadow-xs border border-slate-200 group-hover:scale-105 transition-transform" 
          />
          <div>
            <div className="flex items-center gap-1 font-serif text-xl font-bold tracking-tight">
              <span className="text-slate-900">Startup</span>
              <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">Crème</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono tracking-wider uppercase flex items-center gap-1">
              <span>Finance</span>
              <span className="text-emerald-600">•</span>
              <span>Tech</span>
              <span className="text-cyan-600">•</span>
              <span>Global Intelligence</span>
            </div>
          </div>
        </a>

        {/* Search Bar */}
        <div className="hidden md:flex items-center relative flex-1 max-w-md mx-6">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search financial analysis, tech trends, or discussions..."
            className="w-full bg-slate-100 border border-slate-200 rounded-full pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-3">
          {/* Locale Switcher Subpath */}
          <div className="relative">
            <button
              onClick={() => setShowLocaleMenu(!showLocaleMenu)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
            >
              <span>{selectedLocale.flag}</span>
              <span className="hidden sm:inline uppercase text-[11px] tracking-wider">{selectedLocale.code}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>
            {showLocaleMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  Topical Subpath Locale
                </div>
                {LOCALES.map(loc => (
                  <button
                    key={loc.code}
                    onClick={() => {
                      onLocaleChange(loc.code);
                      setShowLocaleMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                      currentLocale === loc.code 
                        ? 'bg-cyan-50 text-cyan-800 font-medium' 
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{loc.flag}</span>
                      <span>{loc.label}</span>
                    </span>
                    <span className="font-mono text-[10px] opacity-60">/{loc.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bookmarks */}
          <button
            onClick={onOpenBookmarks}
            className="relative p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
            title="Saved Articles"
          >
            <Bookmark className="w-4 h-4" />
            {bookmarkedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-600 text-white font-bold text-[10px] flex items-center justify-center shadow">
                {bookmarkedCount}
              </span>
            )}
          </button>

          {/* User Auth & Role Selector */}
          <div className="relative">
            {currentUser ? (
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 transition-colors"
              >
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <UserIcon className="w-4 h-4 text-cyan-600" />
                )}
                <span className="hidden sm:inline font-medium max-w-[100px] truncate">{currentUser.full_name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-semibold ${
                  currentUser.role === 'admin' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-200 text-slate-700'
                }`}>
                  {currentUser.role}
                </span>
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shadow transition-all"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Role Dropdown */}
            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <div className="text-xs font-semibold text-slate-900">{currentUser?.full_name}</div>
                  <div className="text-[11px] text-slate-500">{currentUser?.email}</div>
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => { onSwitchRole('guest'); setShowRoleMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Subpath Bar */}
      <nav className="bg-slate-50 border-t border-slate-200 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 py-1">
            <a
              href={getTabUrl('home', currentLocale)}
              onClick={(e) => {
                e.preventDefault();
                onTabChange('home');
              }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'home'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Home</span>
            </a>

            {/* Finance Silo Link */}
            <a
              href={getTabUrl('finance', currentLocale)}
              onClick={(e) => {
                e.preventDefault();
                onTabChange('finance');
              }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                activeTab === 'finance'
                  ? 'bg-emerald-100/80 border-emerald-300 text-emerald-900 shadow-sm'
                  : 'border-transparent text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Finance</span>
            </a>

            {/* Tech Silo Link */}
            <a
              href={getTabUrl('tech', currentLocale)}
              onClick={(e) => {
                e.preventDefault();
                onTabChange('tech');
              }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                activeTab === 'tech'
                  ? 'bg-cyan-100/80 border-cyan-300 text-cyan-900 shadow-sm'
                  : 'border-transparent text-slate-600 hover:text-cyan-700 hover:bg-cyan-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              <span>Tech</span>
            </a>

            {/* Discussion Forum */}
            <a
              href={getTabUrl('discussion', currentLocale)}
              onClick={(e) => {
                e.preventDefault();
                onTabChange('discussion');
              }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                activeTab === 'discussion'
                  ? 'bg-teal-100/80 border-teal-300 text-teal-900 shadow-sm'
                  : 'border-transparent text-slate-600 hover:text-teal-700 hover:bg-teal-50'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
              <span>Discussion Forum</span>
            </a>

            {/* Admin CMS */}
            {currentUser?.role === 'admin' && (
              <a
                href={getTabUrl('admin', currentLocale)}
                onClick={(e) => {
                  e.preventDefault();
                  onTabChange('admin');
                }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                  activeTab === 'admin'
                    ? 'bg-amber-100/80 border-amber-300 text-amber-900 shadow-sm'
                    : 'border-transparent text-amber-700 hover:bg-amber-50'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Admin CMS</span>
                <span className="text-[10px] font-mono text-amber-700">/admin</span>
              </a>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};
