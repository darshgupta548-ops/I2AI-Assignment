import React, { useState } from 'react';
import { 
  TrendingUp, 
  Layers, 
  Network, 
  BarChart2, 
  Grid, Sparkles,
  Check 
} from 'lucide-react';

interface FloatingMethodNavProps {
  currentMethod: 'linear_regression' | 'decision_tree' | 'kmeans' | 'pca' | 'selection' | 'home';
  visitedMethods: Set<string>;
  completedMethods?: Set<string>;
  resolvedMethods?: Set<string>;
  onSelectMethod: (method: 'linear_regression' | 'decision_tree' | 'kmeans' | 'pca') => void;
  onReturnToDashboard: () => void;
  onOpenFinalAnalysis?: () => void;
}

export const FloatingMethodNav: React.FC<FloatingMethodNavProps> = ({
  currentMethod,
  visitedMethods,
  completedMethods = new Set(),
  resolvedMethods = new Set(),
  onSelectMethod,
  onReturnToDashboard,
  onOpenFinalAnalysis,
}) => {
  const [hoveredMethod, setHoveredMethod] = useState<string | null>(null);

  const methods = [
    {
      id: 'linear_regression' as const,
      label: 'Linear Regression',
      icon: TrendingUp,
      bg: 'bg-[#DCEAF4]',
      border: 'border-blue-400',
      activeText: 'text-blue-700',
    },
    {
      id: 'decision_tree' as const,
      label: 'Decision Tree',
      icon: Layers,
      bg: 'bg-[#DCEDE5]',
      border: 'border-emerald-400',
      activeText: 'text-emerald-700',
    },
    {
      id: 'kmeans' as const,
      label: 'K-Means Clustering',
      icon: Network,
      bg: 'bg-[#FEF3C7]',
      border: 'border-amber-400',
      activeText: 'text-amber-700',
    },
    {
      id: 'pca' as const,
      label: 'Principal Component Analysis',
      icon: BarChart2,
      bg: 'bg-[#E8E2F4]',
      border: 'border-purple-400',
      activeText: 'text-purple-700',
    },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 floating-nav print:hidden">
      <div className="liquid-glass-pill p-2 rounded-full flex items-center space-x-2 shadow-xl border border-white/90">
        
        {/* Return to 2x2 Dashboard Button */}
        <button
          onClick={onReturnToDashboard}
          title="Return to Method Dashboard"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#777985] hover:text-[#292B32] hover:bg-white/80 transition-all cursor-pointer"
        >
          <Grid className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-6 bg-slate-200" />

        {/* 4 Circular Clay Icons */}
        {methods.map((m) => {
          const Icon = m.icon;
          const isActive = currentMethod === m.id;
          const isVisited = visitedMethods.has(m.id);
          const isHovered = hoveredMethod === m.id;

          return (
            <button
              key={m.id}
              onClick={() => onSelectMethod(m.id)}
              onMouseEnter={() => setHoveredMethod(m.id)}
              onMouseLeave={() => setHoveredMethod(null)}
              className={`relative h-10 rounded-full flex items-center transition-all duration-300 ease-out cursor-pointer ${
                isActive
                  ? `${m.bg} ${m.activeText} border-2 ${m.border} px-3.5 shadow-md`
                  : 'bg-white/90 text-[#777985] hover:text-[#292B32] hover:bg-white px-2.5 border border-slate-200/80'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Icon className="w-4 h-4 shrink-0" />
                  {isVisited && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-[7px] text-white">
                      ✓
                    </span>
                  )}
                  {completedMethods.has(m.id) && <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" title="Analysis complete" />}
                </div>

                {/* Smooth horizontal expansion showing title on hover or when active */}
                {(isHovered || isActive) && (
                  <span className="text-xs font-semibold whitespace-nowrap overflow-hidden transition-all duration-300">
                    {m.label}
                  </span>
                )}
              </div>
            </button>
          );
        })}
        {resolvedMethods.size === 4 && onOpenFinalAnalysis && <button onClick={onOpenFinalAnalysis} className="h-10 px-3 rounded-full bg-violet-100 text-violet-800 flex items-center gap-2 text-xs font-semibold hover:bg-violet-200" title="Open Hostel Energy Assessment"><Sparkles className="w-4 h-4"/><span className="hidden sm:inline">Assessment</span></button>}
      </div>
    </div>
  );
};
