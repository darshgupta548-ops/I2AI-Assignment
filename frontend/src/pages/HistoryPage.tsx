import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Database, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  CheckCircle, 
  Layers, 
  Columns, 
  RotateCcw,
  Info
} from 'lucide-react';
import { api, AnalysisSummary, AnalysisDetail } from '../services/api';

interface HistoryProps {
  onSelectAnalysis: (analysisId: number) => void;
  onNavigateToUpload: () => void;
}

export const HistoryPage: React.FC<HistoryProps> = ({
  onSelectAnalysis,
  onNavigateToUpload,
}) => {
  const [runs, setRuns] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareIdA, setCompareIdA] = useState<number | null>(null);
  const [compareIdB, setCompareIdB] = useState<number | null>(null);
  const [detailA, setDetailA] = useState<AnalysisDetail | null>(null);
  const [detailB, setDetailB] = useState<AnalysisDetail | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const data = await api.getAnalyses();
      setRuns(data || []);
      if (data && data.length >= 2) {
        setCompareIdA(data[0].id);
        setCompareIdB(data[1].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  // Fetch details when compare IDs change
  useEffect(() => {
    if (compareIdA && compareIdB) {
      setLoadingCompare(true);
      Promise.all([
        api.getAnalysisDetail(compareIdA),
        api.getAnalysisDetail(compareIdB)
      ])
        .then(([dA, dB]) => {
          setDetailA(dA);
          setDetailB(dB);
        })
        .catch(console.error)
        .finally(() => setLoadingCompare(false));
    }
  }, [compareIdA, compareIdB]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center font-mono text-cyan-400 animate-pulse text-sm">
        Loading historical analytical archives...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono mb-1">
            <Clock className="w-4 h-4" />
            <span>PERSISTENT ANALYTICAL LEDGER</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Analysis Run History & Run Comparison
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Revisit historical Scikit-learn model outputs, verify metrics reproducibility, and benchmark disparate campuses side-by-side.
          </p>
        </div>

        <button
          onClick={fetchRuns}
          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center space-x-1.5 transition-colors self-start cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh History</span>
        </button>
      </div>

      {runs.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Info className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No Previous Analysis Executions</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Uploaded datasets and completed runs are saved into SQLite. Ingest a dataset to populate your ledger.
          </p>
          <button
            onClick={onNavigateToUpload}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs cursor-pointer"
          >
            Ingest Dataset
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Historical Runs Table */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white font-mono flex items-center space-x-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Persisted Runs Ledger ({runs.length} Runs Recorded)</span>
            </h2>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Run Name & Dataset</th>
                    <th className="px-4 py-3">Target Variable</th>
                    <th className="px-4 py-3">Quality Score</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Execution Timestamp</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {runs.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{r.run_name}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[220px]">{r.dataset_name}</div>
                      </td>
                      <td className="px-4 py-3 text-cyan-300">{r.target_column || 'Unsupervised'}</td>
                      <td className="px-4 py-3 text-emerald-400">{r.data_quality_score}/100</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40 text-[10px]">
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onSelectAnalysis(r.id)}
                          className="px-3 py-1 rounded bg-slate-900 hover:bg-cyan-950/80 border border-slate-700 hover:border-cyan-700 text-cyan-300 text-xs transition-colors cursor-pointer"
                        >
                          Reopen Run
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIDE-BY-SIDE COMPARISON MODULE */}
          {runs.length >= 2 && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono">
                    <Columns className="w-4 h-4" />
                    <span>SIDE-BY-SIDE CROSS-RUN BENCHMARK</span>
                  </div>
                  <h3 className="text-base font-bold text-white">Compare Two Analytical Executions</h3>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400 font-mono">Run A:</span>
                    <select
                      value={compareIdA || ''}
                      onChange={(e) => setCompareIdA(Number(e.target.value))}
                      className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-cyan-300 font-mono"
                    >
                      {runs.map(r => (
                        <option key={r.id} value={r.id}>{r.run_name}</option>
                      ))}
                    </select>
                  </div>

                  <span className="text-slate-600 font-mono">vs</span>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400 font-mono">Run B:</span>
                    <select
                      value={compareIdB || ''}
                      onChange={(e) => setCompareIdB(Number(e.target.value))}
                      className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-emerald-300 font-mono"
                    >
                      {runs.map(r => (
                        <option key={r.id} value={r.id}>{r.run_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {detailA && detailB && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Card A */}
                  <div className="p-5 rounded-xl bg-slate-950 border border-cyan-800/40 space-y-4">
                    <div className="border-b border-slate-900 pb-3">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold block">RUN SPECIFICATION A</span>
                      <h4 className="text-sm font-bold text-white">{detailA.run_name}</h4>
                      <p className="text-xs text-slate-400">{detailA.dataset_name}</p>
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">Target Column:</span>
                        <span className="text-cyan-300">{detailA.target_column || 'None'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">Linear Reg (R²):</span>
                        <span className="text-white font-bold">{detailA.linear_regression?.r2_score ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">Linear Reg (RMSE):</span>
                        <span className="text-white">{detailA.linear_regression?.rmse ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">K-Means Optimal k:</span>
                        <span className="text-amber-400 font-bold">{detailA.kmeans?.optimal_k ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">Silhouette Score:</span>
                        <span className="text-white">{detailA.kmeans?.silhouette_score ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">PCA Components:</span>
                        <span className="text-sky-300">{detailA.pca?.n_components ?? 'N/A'} PCs</span>
                      </div>
                    </div>
                  </div>

                  {/* Card B */}
                  <div className="p-5 rounded-xl bg-slate-950 border border-emerald-800/40 space-y-4">
                    <div className="border-b border-slate-900 pb-3">
                      <span className="text-[10px] font-mono text-emerald-400 font-bold block">RUN SPECIFICATION B</span>
                      <h4 className="text-sm font-bold text-white">{detailB.run_name}</h4>
                      <p className="text-xs text-slate-400">{detailB.dataset_name}</p>
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">Target Column:</span>
                        <span className="text-emerald-300">{detailB.target_column || 'None'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">Linear Reg (R²):</span>
                        <span className="text-white font-bold">{detailB.linear_regression?.r2_score ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">Linear Reg (RMSE):</span>
                        <span className="text-white">{detailB.linear_regression?.rmse ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">K-Means Optimal k:</span>
                        <span className="text-amber-400 font-bold">{detailB.kmeans?.optimal_k ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">Silhouette Score:</span>
                        <span className="text-white">{detailB.kmeans?.silhouette_score ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-500">PCA Components:</span>
                        <span className="text-sky-300">{detailB.pca?.n_components ?? 'N/A'} PCs</span>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
