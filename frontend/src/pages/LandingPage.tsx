import React from 'react';
import { 
  ArrowRight, 
  Sparkles, 
  Cpu, 
  Layers, 
  Network, 
  TrendingUp, 
  CheckCircle, 
  ShieldCheck, 
  BrainCircuit, 
  Database,
  BarChart2,
  Sliders
} from 'lucide-react';
import { EnergyHeroGlobe } from '../three/EnergyHeroGlobe';

interface LandingPageProps {
  onStartAnalysing: () => void;
  onLoadSample: (type: 'gujarat' | 'himalayan' | 'campus_original') => void;
  onExplore: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onStartAnalysing, 
  onLoadSample, 
  onExplore 
}) => {
  return (
    <div className="relative min-h-screen bg-[#080c14] text-slate-100 overflow-hidden">
      {/* Background radial gradient mesh */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-gradient-to-b from-cyan-950/20 via-transparent to-transparent pointer-events-none blur-3xl -z-10" />

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Full-Stack AI + Scikit-Learn Energy Intelligence</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
              Understand Energy.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">
                Discover Inefficiencies.
              </span>{' '}
              Build Smarter Hostels.
            </h1>

            <p className="text-base sm:text-lg text-slate-300/90 max-w-2xl font-normal leading-relaxed">
              Empower university campuses and facility administrators to diagnose electrical loads, evaluate multi-modal machine learning models, and uncover actionable carbon and cost reductions with evidence-grounded AI synthesis.
            </p>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-wrap gap-3 sm:gap-4">
              <button
                onClick={onStartAnalysing}
                className="px-6 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all flex items-center space-x-2 group cursor-pointer"
              >
                <span>Start Analysing</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onExplore}
                className="px-6 py-3.5 rounded-xl font-medium text-sm bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 transition-all cursor-pointer"
              >
                Explore Platform
              </button>
            </div>

            {/* Instant Demonstration Badges */}
            <div className="pt-4 border-t border-slate-800/80">
              <div className="text-xs text-slate-400 mb-2.5 font-mono flex items-center space-x-1.5">
                <span>⚡ Instant Live Demonstration (Synthetic & Real Campus Data):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onLoadSample('gujarat')}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-cyan-950/60 border border-slate-700/80 hover:border-cyan-700 text-cyan-300 transition-all flex items-center space-x-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Gujarat Campus (Solar + Cooling)</span>
                </button>
                <button
                  onClick={() => onLoadSample('himalayan')}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-emerald-950/60 border border-slate-700/80 hover:border-emerald-700 text-emerald-300 transition-all flex items-center space-x-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Himalayan Campus (Thermal + Storage)</span>
                </button>
                <button
                  onClick={() => onLoadSample('campus_original')}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-amber-950/60 border border-slate-700/80 hover:border-amber-700 text-amber-300 transition-all flex items-center space-x-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Campus DATA_170225.csv</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Hero Visual (Three.js Energy Globe) */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="w-full relative rounded-2xl border border-slate-800/80 bg-slate-950/40 p-2 shadow-2xl backdrop-blur-sm">
              <div className="absolute top-3 left-4 flex items-center space-x-2 z-10 font-mono text-[11px] text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>ENERGY TOPOLOGY TELEMETRY</span>
              </div>
              <EnergyHeroGlobe />
            </div>
          </div>

        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-900">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-2">Architectural Workflow</h2>
          <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            How The Analytical Pipeline Operates
          </p>
          <p className="text-slate-400 text-sm mt-3">
            From raw delimiter-agnostic telemetry to scientifically defensible machine learning models.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              step: '01',
              title: 'Adaptive Ingestion',
              desc: 'Upload any CSV. The engine automatically detects delimiters, European/US decimal formats, and missing rates.',
              icon: Database
            },
            {
              step: '02',
              title: 'Contextual Profiling',
              desc: 'Confirm column units (kWh, kW, °C, hours) and designate target metrics without rigid schema lock-in.',
              icon: Sliders
            },
            {
              step: '03',
              title: 'Rigorous ML Gate',
              desc: 'Evaluates statistical prerequisites for each algorithm (Linear, Tree, K-Means, PCA). Skips unviable models safely.',
              icon: ShieldCheck
            },
            {
              step: '04',
              title: 'AI Synthesis',
              desc: 'Gemini interprets verified Scikit-learn outputs to provide evidence-backed efficiency interventions.',
              icon: BrainCircuit
            }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                className="relative p-6 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-cyan-800/60 transition-all group"
              >
                <div className="text-3xl font-mono font-bold text-slate-700/60 group-hover:text-cyan-500/30 transition-colors mb-3">
                  {item.step}
                </div>
                <div className="w-9 h-9 rounded-lg bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 mb-3">
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOUR MACHINE LEARNING CAPABILITIES */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-900">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-mono uppercase tracking-widest text-emerald-400 mb-2">Algorithmic Rigor</h2>
          <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Four Grounded Machine Learning Engines
          </p>
          <p className="text-slate-400 text-sm mt-3">
            Every statistic is calculated directly in Python via Scikit-learn on genuine train/test partitions—never fabricated.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 1. Linear Regression */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 hover:border-cyan-800/60 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Linear Regression</h3>
                  <span className="text-xs text-cyan-400/80 font-mono">Parametric Demand Modeling</span>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">Supervised</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Measures normalized coefficient sensitivities across predictors while evaluating out-of-sample R-squared, RMSE, MAE, and residual distributions.
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Train/Test Leakage Guard</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Standardized Coefficients</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Residual Normality</span>
            </div>
          </div>

          {/* 2. Decision Tree */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 hover:border-emerald-800/60 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Decision Tree (CART)</h3>
                  <span className="text-xs text-emerald-400/80 font-mono">Hierarchical Split Discovery</span>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">Regressor / Classifier</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Discovers non-linear threshold inflection points (e.g., temperatures exceeding 32°C triggering surging AC cooling regimes) with interpretable rule trees.
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Feature Importance (MDI)</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Pruned Split Explanations</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Dual Regression/Classification</span>
            </div>
          </div>

          {/* 3. K-Means Clustering */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 hover:border-amber-800/60 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-800/60 flex items-center justify-center text-amber-400">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">K-Means Clustering</h3>
                  <span className="text-xs text-amber-400/80 font-mono">Operational Regimes</span>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">Unsupervised</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Partitions multi-dimensional hostel behavior into clusters using the Elbow method and Silhouette scores. Unscales centroids back to real engineering units.
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Elbow Curve Inertia</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Silhouette Coefficient</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Physical Centroids</span>
            </div>
          </div>

          {/* 4. PCA */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 hover:border-sky-800/60 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-sky-950/70 border border-sky-800/60 flex items-center justify-center text-sky-400">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Principal Component Analysis</h3>
                  <span className="text-xs text-sky-400/80 font-mono">Dimensionality Subspace</span>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">Unsupervised</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Deconstructs multivariate collinearity into orthogonal principal axes. Computes explained variance ratios and factor loadings matrices.
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Eigenvalue Scree Plots</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Component Loadings</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">PC1 vs PC2 Biplot</span>
            </div>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
        <div>
          <span>Smart Hostel Energy Advisor · Academic & SaaS Analytics Platform</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>Python 3.13</span>
          <span>·</span>
          <span>FastAPI</span>
          <span>·</span>
          <span>Scikit-Learn</span>
          <span>·</span>
          <span>Google Gemini</span>
        </div>
      </footer>
    </div>
  );
};
