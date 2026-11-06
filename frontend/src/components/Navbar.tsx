import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  BarChart3, 
  UploadCloud, 
  CheckCircle2, 
  BrainCircuit, 
  Clock, 
  Cpu, 
  ExternalLink 
} from 'lucide-react';
import { api } from '../services/api';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeDatasetId: number | null;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, activeDatasetId }) => {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [geminiActive, setGeminiActive] = useState<boolean>(false);

  useEffect(() => {
    api.getHealth()
      .then(res => {
        setBackendOnline(res.status === 'online');
        setGeminiActive(Boolean(res.gemini_configured));
      })
      .catch(() => {
        setBackendOnline(false);
      });
  }, []);

  const navItems = [
    { id: 'landing', label: 'Platform', icon: Zap },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'upload', label: 'Data & Profiler', icon: UploadCloud },
    { id: 'readiness', label: 'Model Readiness', icon: CheckCircle2, badge: activeDatasetId ? 'Active' : undefined },
    { id: 'results', label: 'ML Analytics', icon: Cpu },
    { id: 'ai-advisor', label: 'AI Advisor', icon: BrainCircuit },
    { id: 'history', label: 'History & Runs', icon: Clock },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div 
          onClick={() => setActiveTab('landing')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-white font-mono">
                ENERGY<span className="text-cyan-400">.ADVISOR</span>
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                SaaS v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Smart Hostel AI Intelligence</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
                  isActive
                    ? 'text-cyan-300 bg-cyan-950/40 border border-cyan-800/50 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Backend & AI Status Pill */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs font-mono px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800">
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300 text-[11px]">
                {backendOnline === null ? 'Connecting...' : (backendOnline ? 'FastAPI Online' : 'Backend Offline')}
              </span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center space-x-1">
              <BrainCircuit className={`w-3 h-3 ${geminiActive ? 'text-cyan-400' : 'text-amber-400'}`} />
              <span className={`text-[11px] ${geminiActive ? 'text-cyan-300' : 'text-amber-300'}`}>
                {geminiActive ? 'Gemini 2.5' : 'Local Heuristics'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile nav drawer */}
      <div className="md:hidden flex overflow-x-auto px-3 py-2 space-x-2 border-t border-slate-800/60 scrollbar-none bg-slate-950">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap flex items-center space-x-1.5 ${
                isActive ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
