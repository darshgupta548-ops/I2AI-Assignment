import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Layers, 
  Network, 
  BarChart2, 
  AlertTriangle, 
  BrainCircuit, 
  ArrowRight, 
  CheckCircle2, 
  FileText,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ScatterChart, 
  Scatter, 
  Cell 
} from 'recharts';
import { api, AnalysisDetail } from '../services/api';

interface ResultsProps {
  analysisId: number | null;
  onNavigateToAiAdvisor: (analysisId: number) => void;
  onNavigateToUpload: () => void;
}

export const ResultsPage: React.FC<ResultsProps> = ({
  analysisId,
  onNavigateToAiAdvisor,
  onNavigateToUpload,
}) => {
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'lr' | 'dt' | 'km' | 'pca'>('lr');

  useEffect(() => {
    if (analysisId) {
      setLoading(true);
      api.getAnalysisDetail(analysisId)
        .then(data => {
          setDetail(data);
          // Set first available model as active tab
          if (data.linear_regression) setActiveTab('lr');
          else if (data.decision_tree) setActiveTab('dt');
          else if (data.kmeans) setActiveTab('km');
          else if (data.pca) setActiveTab('pca');
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [analysisId]);

  if (!analysisId) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <Info className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">No Analysis Execution Selected</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Run the machine learning pipeline from the Readiness Gate or select a previous run from History.
        </p>
        <button
          onClick={onNavigateToUpload}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
        >
          Ingest & Run Dataset
        </button>
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center font-mono text-cyan-400 animate-pulse text-sm">
        Retrieving validated Scikit-learn analytical metrics...
      </div>
    );
  }

  const lr = detail.linear_regression;
  const dt = detail.decision_tree;
  const km = detail.kmeans;
  const pca = detail.pca;
  const skipped = detail.skipped_models || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Overview Card */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono mb-1">
              <Sparkles className="w-4 h-4" />
              <span>STATISTICAL MACHINE LEARNING RESULTS</span>
            </div>
            <h1 className="text-2xl font-bold text-white">{detail.run_name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Dataset: <span className="text-slate-200">{detail.dataset_name}</span> · Executed at {new Date(detail.created_at).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigateToAiAdvisor(detail.analysis_id)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-2 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>View Gemini AI Synthesis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick summary badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[11px]">TARGET VARIABLE</span>
            <span className="text-cyan-300 font-semibold truncate block">{detail.target_column || 'Unsupervised'}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[11px]">DATA QUALITY</span>
            <span className="text-emerald-300 font-semibold">{detail.data_quality_score} / 100</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[11px]">RUN STATUS</span>
            <span className="text-emerald-400 font-semibold">{detail.status}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[11px]">ACTIVE MODELS</span>
            <span className="text-slate-200 font-semibold">
              {[lr, dt, km, pca].filter(Boolean).length} of 4 Executed
            </span>
          </div>
        </div>
      </div>

      {/* Skipped Models Notification if any */}
      {Object.keys(skipped).length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-mono">
            <AlertTriangle className="w-4 h-4" />
            <span>TRANSPARENT ALGORITHM GATING (MODELS SKIPPED)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {Object.entries(skipped).map(([mName, reason]) => (
              <div key={mName} className="p-2 rounded bg-slate-950 border border-slate-800/80 text-slate-300">
                <span className="text-amber-400 capitalize">{mName.replace('_', ' ')}:</span> {reason}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Selection Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('lr')}
          disabled={!lr}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'lr' 
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
              : (lr ? 'text-slate-400 hover:text-white bg-slate-900/60' : 'text-slate-600 bg-slate-950/40 cursor-not-allowed')
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Linear Regression {lr ? '' : '(Skipped)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('dt')}
          disabled={!dt}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'dt' 
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
              : (dt ? 'text-slate-400 hover:text-white bg-slate-900/60' : 'text-slate-600 bg-slate-950/40 cursor-not-allowed')
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Decision Tree {dt ? '' : '(Skipped)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('km')}
          disabled={!km}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'km' 
              ? 'bg-amber-950 text-amber-300 border border-amber-800/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
              : (km ? 'text-slate-400 hover:text-white bg-slate-900/60' : 'text-slate-600 bg-slate-950/40 cursor-not-allowed')
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>K-Means Clustering {km ? '' : '(Skipped)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('pca')}
          disabled={!pca}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'pca' 
              ? 'bg-sky-950 text-sky-300 border border-sky-800/80 shadow-[0_0_12px_rgba(56,189,248,0.15)]'
              : (pca ? 'text-slate-400 hover:text-white bg-slate-900/60' : 'text-slate-600 bg-slate-950/40 cursor-not-allowed')
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>PCA Decomposition {pca ? '' : '(Skipped)'}</span>
        </button>
      </div>

      {/* TAB 1: LINEAR REGRESSION */}
      {activeTab === 'lr' && lr && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">COEFFICIENT OF DETERMINATION (R²)</span>
              <span className="text-2xl font-bold font-mono text-cyan-300">{lr.r2_score}</span>
              <span className="text-[11px] text-slate-500 block mt-1">Explained target variance</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">ROOT MEAN SQ ERROR (RMSE)</span>
              <span className="text-2xl font-bold font-mono text-white">{lr.rmse}</span>
              <span className="text-[11px] text-slate-500 block mt-1">Standard error of regression</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">MEAN ABSOLUTE ERROR (MAE)</span>
              <span className="text-2xl font-bold font-mono text-white">{lr.mae}</span>
              <span className="text-[11px] text-slate-500 block mt-1">Average deviation</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">TRAIN / TEST PARTITION</span>
              <span className="text-xl font-bold font-mono text-emerald-400">{lr.train_size} / {lr.test_size}</span>
              <span className="text-[11px] text-slate-500 block mt-1">80/20 train/test split</span>
            </div>
          </div>

          {/* Charts Grid: Actual vs Predicted & Normalized Coefficients */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Actual vs Predicted Scatter */}
            <div className="lg:col-span-7 p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase text-slate-300">Actual vs Predicted Target Response (Test Set)</h3>
                <span className="text-[11px] font-mono text-cyan-400">Target: {lr.target_variable}</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lr.actual_vs_predicted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="index" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="actual" stroke="#06b6d4" name="Actual Measured" strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="predicted" stroke="#10b981" name="Predicted OLS" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Normalized Coefficients Bar Chart */}
            <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-mono uppercase text-slate-300">Feature Weights (Normalized β Coefficients)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lr.coefficients} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="feature" type="category" stroke="#64748b" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', fontSize: '11px' }} />
                    <Bar dataKey="coefficient" fill="#06b6d4">
                      {lr.coefficients.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.coefficient >= 0 ? '#06b6d4' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Residual Distribution */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-xs font-mono uppercase text-slate-300">Residual Error Distribution (Normality Check)</h3>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lr.residuals_distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="bin" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', fontSize: '11px' }} />
                  <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DECISION TREE */}
      {activeTab === 'dt' && dt && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">MODEL TASK MODE</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 capitalize">{dt.task_type} Tree</span>
              <span className="text-[11px] text-slate-500 block mt-1">Constrained depth = 4</span>
            </div>
            {dt.task_type === 'regression' ? (
              <>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block">TREE R² SCORE</span>
                  <span className="text-2xl font-bold font-mono text-white">{dt.metrics.r2_score}</span>
                  <span className="text-[11px] text-slate-500 block mt-1">Non-linear variance fit</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block">RMSE / MAE</span>
                  <span className="text-xl font-bold font-mono text-white">{dt.metrics.rmse} / {dt.metrics.mae}</span>
                  <span className="text-[11px] text-slate-500 block mt-1">Error metric</span>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block">TEST ACCURACY</span>
                  <span className="text-2xl font-bold font-mono text-white">{dt.metrics.accuracy * 100}%</span>
                  <span className="text-[11px] text-slate-500 block mt-1">Categorical precision</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block">WEIGHTED F1 SCORE</span>
                  <span className="text-2xl font-bold font-mono text-white">{dt.metrics.f1_score}</span>
                  <span className="text-[11px] text-slate-500 block mt-1">Balanced metric</span>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Feature Importances Bar Chart */}
            <div className="lg:col-span-6 p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-mono uppercase text-slate-300">Feature Importance Ranking (Gini / MDI)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dt.feature_importances} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="feature" type="category" stroke="#64748b" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', fontSize: '11px' }} />
                    <Bar dataKey="importance_pct" fill="#10b981" radius={[0, 4, 4, 0]} name="Importance %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Hierarchical Decision Rules Viewer */}
            <div className="lg:col-span-6 p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-mono uppercase text-slate-300">Interpretable Decision Split Rules</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Threshold branch decisions computed by CART algorithm:</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-emerald-300 h-56 overflow-y-auto space-y-1">
                {dt.tree_rules.map((rule: string, idx: number) => (
                  <div key={idx} className="whitespace-pre">{rule}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: K-MEANS CLUSTERING */}
      {activeTab === 'km' && km && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">OPTIMAL CLUSTERS (K)</span>
              <span className="text-2xl font-bold font-mono text-amber-400">k = {km.optimal_k}</span>
              <span className="text-[11px] text-slate-500 block mt-1">Optimal operational regimes</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">SILHOUETTE COEFFICIENT</span>
              <span className="text-2xl font-bold font-mono text-white">{km.silhouette_score}</span>
              <span className="text-[11px] text-slate-500 block mt-1">Cluster cohesion & separation</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">FEATURES CLUSTERED</span>
              <span className="text-xl font-bold font-mono text-white">{km.features_used.length} metrics</span>
              <span className="text-[11px] text-slate-500 block mt-1">Standardized Euclidean space</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Elbow Method Line Chart */}
            <div className="lg:col-span-6 p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-mono uppercase text-slate-300">Elbow Method Curve (Inertia vs. k)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={km.elbow_curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="k" stroke="#64748b" tick={{ fontSize: 10 }} label={{ value: 'Number of Clusters (k)', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#64748b' }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', fontSize: '11px' }} />
                    <Line type="monotone" dataKey="inertia" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="Inertia (SSE)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2D Cluster Projection Scatter */}
            <div className="lg:col-span-6 p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-mono uppercase text-slate-300">2D Operational Regime Clusters Projection</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="x" stroke="#64748b" tick={{ fontSize: 10 }} name="Dimension 1" />
                    <YAxis dataKey="y" stroke="#64748b" tick={{ fontSize: 10 }} name="Dimension 2" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', fontSize: '11px' }} />
                    <Scatter name="Observations" data={km.cluster_scatter_points}>
                      {km.cluster_scatter_points.map((entry: any, index: number) => {
                        const colors = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
                        return <Cell key={`cell-${index}`} fill={colors[(entry.cluster - 1) % colors.length]} />;
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Cluster Profiles Table with Physical Centroids */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-xs font-mono uppercase text-slate-300">
              Cluster Regime Profiles (Unscaled Physical Engineering Centroids)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {km.cluster_profiles.map((cp: any) => (
                <div key={cp.cluster_id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-400">Cluster {cp.cluster_id}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300">
                      {cp.sample_percentage}% ({cp.sample_count} samples)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 italic">{cp.objective_description}</p>
                  <div className="pt-2 border-t border-slate-900 space-y-1 font-mono text-[11px] text-slate-400">
                    {Object.entries(cp.centroids).slice(0, 4).map(([fName, val]: any) => (
                      <div key={fName} className="flex justify-between">
                        <span className="truncate max-w-[140px]">{fName}:</span>
                        <span className="text-slate-200">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PCA DECOMPOSITION */}
      {activeTab === 'pca' && pca && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">TOTAL COMPONENTS</span>
              <span className="text-2xl font-bold font-mono text-sky-400">{pca.n_components} PCs</span>
              <span className="text-[11px] text-slate-500 block mt-1">Orthogonal projections</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">PC1 EXPLAINED VARIANCE</span>
              <span className="text-2xl font-bold font-mono text-white">{(pca.explained_variance_ratio[0] * 100).toFixed(1)}%</span>
              <span className="text-[11px] text-slate-500 block mt-1">Primary variance driver</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">CUMULATIVE (PC1 + PC2)</span>
              <span className="text-2xl font-bold font-mono text-white">
                {((pca.cumulative_explained_variance[1] || pca.cumulative_explained_variance[0]) * 100).toFixed(1)}%
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">2D subspace preservation</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Scree Plot */}
            <div className="lg:col-span-6 p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-mono uppercase text-slate-300">Scree Plot: Individual & Cumulative Variance</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pca.explained_variance_ratio.map((v: number, i: number) => ({
                    component: `PC${i + 1}`,
                    individual: (v * 100).toFixed(1),
                    cumulative: (pca.cumulative_explained_variance[i] * 100).toFixed(1)
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="component" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="individual" fill="#38bdf8" name="Individual Var %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PC1 vs PC2 Scatter Projection */}
            <div className="lg:col-span-6 p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-mono uppercase text-slate-300">PC1 vs PC2 Subspace Coordinate Map</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="pc1" stroke="#64748b" tick={{ fontSize: 10 }} name="PC1" />
                    <YAxis dataKey="pc2" stroke="#64748b" tick={{ fontSize: 10 }} name="PC2" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', fontSize: '11px' }} />
                    <Scatter name="Observations" data={pca.scatter_points} fill="#0ea5e9" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Factor Loadings Matrix Table */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-xs font-mono uppercase text-slate-300">Factor Loadings Matrix (Eigenvector Weights)</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Feature Name</th>
                    <th className="px-3 py-2">PC1 Loading</th>
                    <th className="px-3 py-2">PC2 Loading</th>
                    {pca.n_components > 2 && <th className="px-3 py-2">PC3 Loading</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {pca.loadings.map((load: any) => (
                    <tr key={load.feature} className="hover:bg-slate-900/30">
                      <td className="px-3 py-2 font-medium text-white">{load.feature}</td>
                      <td className="px-3 py-2 text-cyan-300">{load.PC1}</td>
                      <td className="px-3 py-2 text-emerald-300">{load.PC2}</td>
                      {pca.n_components > 2 && <td className="px-3 py-2 text-slate-400">{load.PC3}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
