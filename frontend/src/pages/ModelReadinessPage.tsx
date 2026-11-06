import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  TrendingUp, 
  Layers, 
  Network, 
  BarChart2, 
  ArrowRight, 
  Play, 
  ShieldCheck, 
  AlertTriangle,
  Lightbulb,
  Info
} from 'lucide-react';
import { api, ReadinessResponse, SingleModelReadiness } from '../services/api';

interface ReadinessProps {
  datasetId: number | null;
  onNavigateToUpload: () => void;
  onRunAnalysis: (analysisId: number) => void;
}

export const ModelReadinessPage: React.FC<ReadinessProps> = ({
  datasetId,
  onNavigateToUpload,
  onRunAnalysis,
}) => {
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReadiness = async (id: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.checkReadiness(id);
      setReadiness(data);
    } catch (err: any) {
      setErrorMsg('Failed to evaluate model readiness rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (datasetId) {
      fetchReadiness(datasetId);
    }
  }, [datasetId]);

  const handleExecutePipeline = async () => {
    if (!datasetId) return;
    setExecuting(true);
    setErrorMsg(null);
    try {
      const result = await api.runAnalysis(datasetId);
      onRunAnalysis(result.analysis_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Execution error during ML pipeline execution.');
    } finally {
      setExecuting(false);
    }
  };

  if (!datasetId) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <Info className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">No Dataset Selected For Readiness Assessment</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Please upload a CSV or load a sample campus dataset first to evaluate algorithm suitability.
        </p>
        <button
          onClick={onNavigateToUpload}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
        >
          Go to Data Profiler
        </button>
      </div>
    );
  }

  const renderStatusBadge = (status: SingleModelReadiness['status']) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>READY</span>
          </span>
        );
      case 'CONDITIONAL':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800/80">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span>CONDITIONAL</span>
          </span>
        );
      case 'INSUFFICIENT':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-950 text-rose-400 border border-rose-800/80">
            <XCircle className="w-3 h-3 text-rose-400" />
            <span>INSUFFICIENT</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/80">
            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
            <span>COMPLETED</span>
          </span>
        );
    }
  };

  const modelIcons = {
    linear_regression: TrendingUp,
    decision_tree: Layers,
    kmeans: Network,
    pca: BarChart2,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>ALGORITHMIC PRECONDITION GATEWAY</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Four-Model Readiness Assessment
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Independently auditing whether the ingested telemetry satisfies the statistical prerequisites for each ML algorithm.
          </p>
        </div>

        {readiness && (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExecutePipeline}
              disabled={executing || readiness.recommended_models.length === 0}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-2 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{executing ? 'Executing ML Algorithms...' : 'Run Suitable Algorithms'}</span>
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Summary Scorecard */}
      {readiness && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono text-slate-400">OVERALL PIPELINE READINESS</div>
            <div className="flex items-center space-x-3">
              <span className="text-3xl font-extrabold font-mono text-white">
                {readiness.overall_readiness_score}%
              </span>
              <span className="text-xs text-slate-400">
                ({readiness.recommended_models.length} of 4 algorithms eligible for execution)
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Configured Target Variable:{' '}
              <span className="text-cyan-300 font-bold">{readiness.target_column || 'None Selected (Unsupervised Only)'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchReadiness(datasetId)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
            >
              Re-Assess Preconditions
            </button>
            <button
              onClick={onNavigateToUpload}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono transition-colors"
            >
              Edit Column Mappings
            </button>
          </div>
        </div>
      )}

      {/* Four Model Readiness Cards */}
      {readiness && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(readiness.models).map(([key, model]) => {
            const Icon = modelIcons[key as keyof typeof modelIcons] || TrendingUp;
            return (
              <div
                key={key}
                className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/90 flex flex-col justify-between space-y-5 hover:border-slate-700 transition-all"
              >
                {/* Header */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-base">{model.display_name}</h3>
                        <span className="text-xs text-slate-400 font-mono capitalize">{key.replace('_', ' ')}</span>
                      </div>
                    </div>
                    {renderStatusBadge(model.status)}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{model.summary}</p>
                </div>

                {/* Requirements Satisfied */}
                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>VERIFIED PREREQUISITES</span>
                  </div>
                  {model.requirements_met.length > 0 ? (
                    <ul className="space-y-1 text-xs text-slate-300 font-mono">
                      {model.requirements_met.map((req, idx) => (
                        <li key={idx} className="flex items-start space-x-1.5">
                          <span className="text-emerald-400">✓</span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-slate-500 italic">No prerequisites satisfied.</div>
                  )}
                </div>

                {/* Missing Criteria */}
                {model.missing_prerequisites.length > 0 && (
                  <div className="space-y-2 p-3 rounded-xl bg-rose-950/20 border border-rose-900/40">
                    <div className="text-[11px] font-mono text-rose-400 flex items-center space-x-1">
                      <XCircle className="w-3 h-3" />
                      <span>BLOCKING MISSING DATA</span>
                    </div>
                    <ul className="space-y-1 text-xs text-rose-300 font-mono">
                      {model.missing_prerequisites.map((miss, idx) => (
                        <li key={idx} className="flex items-start space-x-1.5">
                          <span className="text-rose-400">✗</span>
                          <span>{miss}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Statistical Risk Factors */}
                {model.risk_factors.length > 0 && (
                  <div className="space-y-2 p-3 rounded-xl bg-amber-950/20 border border-amber-900/40">
                    <div className="text-[11px] font-mono text-amber-400 flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>STATISTICAL RISK FACTORS</span>
                    </div>
                    <ul className="space-y-1 text-xs text-amber-300 font-mono">
                      {model.risk_factors.map((risk, idx) => (
                        <li key={idx} className="flex items-start space-x-1.5">
                          <span className="text-amber-400">!</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Data Collection Advice */}
                {model.data_collection_suggestions.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <div className="text-[11px] font-mono text-cyan-400 flex items-center space-x-1">
                      <Lightbulb className="w-3 h-3" />
                      <span>DATA COLLECTION RECOMMENDATIONS</span>
                    </div>
                    <ul className="space-y-1 text-[11px] text-slate-400">
                      {model.data_collection_suggestions.map((sug, idx) => (
                        <li key={idx} className="leading-tight">• {sug}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Execution Footer Callout */}
      {readiness && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-white">Ready for Algorithmic Execution</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Suitable models will execute on real Scikit-learn train/test splits. Unsuitable algorithms will be bypassed with transparent diagnostic explanations.
            </p>
          </div>
          <button
            onClick={handleExecutePipeline}
            disabled={executing || readiness.recommended_models.length === 0}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-2 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{executing ? 'Executing Pipeline...' : 'Run Suitable Algorithms'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
