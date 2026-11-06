import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Upload, 
  FileText, 
  ArrowRight, 
  Sparkles,
  TrendingUp,
  BrainCircuit,
  Plus
} from 'lucide-react';
import { api, AnalysisSummary, DatasetProfile } from '../services/api';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onSelectDataset: (id: number) => void;
  onSelectAnalysis: (id: number) => void;
  onLoadSample: (type: 'gujarat' | 'himalayan' | 'campus_original') => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({
  onNavigate,
  onSelectDataset,
  onSelectAnalysis,
  onLoadSample,
}) => {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dsList, anList] = await Promise.all([
        api.getDatasets(),
        api.getAnalyses(),
      ]);
      setDatasets(dsList || []);
      setAnalyses(anList || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalDatasets = datasets.length;
  const totalRuns = analyses.length;
  const latestRun = analyses[0] || null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Hostel Operations Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Telemetry ingestion overview, ML pipeline readiness, and analytical run records.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('upload')}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload New CSV</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TOTAL DATASETS</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-white">{totalDatasets}</span>
            <span className="text-xs text-slate-500">managed files</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TOTAL ANALYSIS RUNS</span>
            <Play className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-white">{totalRuns}</span>
            <span className="text-xs text-slate-500">pipeline executions</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>LATEST RUN STATUS</span>
            <CheckCircle className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3">
            {latestRun ? (
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-semibold font-mono text-white">{latestRun.status}</span>
                <span className="text-xs text-slate-400 truncate max-w-[120px]">({latestRun.run_name})</span>
              </div>
            ) : (
              <span className="text-sm text-slate-500 font-mono">No runs yet</span>
            )}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>QUALITY BENCHMARK</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-white">
              {latestRun?.data_quality_score ? `${latestRun.data_quality_score}` : '—'}
            </span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
        </div>
      </div>

      {/* Empty State / Fast Demonstration Banner */}
      {totalDatasets === 0 && (
        <div className="p-8 rounded-2xl border border-dashed border-cyan-800/60 bg-slate-900/40 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center mx-auto text-cyan-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">No Energy Datasets Ingested Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Upload your institution's CSV telemetry or immediately load one of our verified campus datasets to explore the four ML engines.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('upload')}
              className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
            >
              Upload Custom CSV
            </button>
            <button
              onClick={() => onLoadSample('gujarat')}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-mono transition-colors cursor-pointer"
            >
              Load Gujarat Solar Campus
            </button>
            <button
              onClick={() => onLoadSample('himalayan')}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-mono transition-colors cursor-pointer"
            >
              Load Himalayan Thermal Campus
            </button>
            <button
              onClick={() => onLoadSample('campus_original')}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-mono transition-colors cursor-pointer"
            >
              Load DATA_170225.csv
            </button>
          </div>
        </div>
      )}

      {/* Main Content Grid: Recent Datasets & Recent Analysis Runs */}
      {totalDatasets > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Recent Datasets List */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center space-x-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>Available Campus Datasets</span>
              </h2>
              <button
                onClick={() => onNavigate('upload')}
                className="text-xs text-cyan-400 hover:underline font-mono"
              >
                + Ingest More
              </button>
            </div>

            <div className="space-y-3">
              {datasets.map((ds) => (
                <div
                  key={ds.id}
                  onClick={() => onSelectDataset(ds.id)}
                  className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition-all cursor-pointer group flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors">
                        {ds.original_name}
                      </span>
                      {ds.is_sample && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                          Synthetic Sample
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
                      <span>{ds.row_count} rows</span>
                      <span>·</span>
                      <span>{ds.col_count} columns</span>
                      <span>·</span>
                      <span>sep: '{ds.delimiter}'</span>
                    </div>
                  </div>
                  <div className="flex items-center text-xs text-cyan-400 font-mono group-hover:translate-x-1 transition-transform">
                    <span>Inspect</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Analysis Runs */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Recent Analysis Runs</span>
              </h2>
              <button
                onClick={() => onNavigate('history')}
                className="text-xs text-emerald-400 hover:underline font-mono"
              >
                View History
              </button>
            </div>

            {analyses.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 text-center text-xs text-slate-400">
                No analyses run yet. Select a dataset and execute the ML pipeline to populate model outputs.
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.slice(0, 5).map((an) => (
                  <div
                    key={an.id}
                    onClick={() => onSelectAnalysis(an.id)}
                    className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-800/80 transition-all cursor-pointer group flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                          {an.run_name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                          {an.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
                        <span>Target: {an.target_column || 'Unsupervised'}</span>
                        <span>·</span>
                        <span>Quality: {an.data_quality_score}/100</span>
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-emerald-400 font-mono group-hover:translate-x-1 transition-transform">
                      <span>View Results</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
