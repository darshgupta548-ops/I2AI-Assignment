import React, { useState, useEffect } from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Download, 
  Printer, 
  Database,
  ArrowRight,
  TrendingDown,
  Info
} from 'lucide-react';
import { api, AiInsights } from '../services/api';

interface AiAdvisorProps {
  analysisId: number | null;
  onNavigateToUpload: () => void;
  onNavigateToResults: (analysisId: number) => void;
}

export const AiAdvisorPage: React.FC<AiAdvisorProps> = ({
  analysisId,
  onNavigateToUpload,
  onNavigateToResults,
}) => {
  const [insights, setInsights] = useState<AiInsights | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (analysisId) {
      setLoading(true);
      api.getInsights(analysisId)
        .then(data => setInsights(data))
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
        <h2 className="text-xl font-bold text-white">No Analysis Run Available For AI Interpretation</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Execute an analysis pipeline from the Model Readiness page or choose a completed analysis from the History tab.
        </p>
        <button
          onClick={onNavigateToUpload}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
        >
          Select or Upload Dataset
        </button>
      </div>
    );
  }

  if (loading || !insights) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center font-mono text-cyan-400 animate-pulse text-sm">
        Synthesizing scientific insights with Gemini Evidence Engine...
      </div>
    );
  }

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print:p-0 print:max-w-none">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono">
            <BrainCircuit className="w-4 h-4" />
            <span>AI INTERPRETATION & ENERGY EFFICIENCY STUDIO</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Evidence-Grounded Synthesis
          </h1>
          <p className="text-xs text-slate-400">
            Engineered interpretations derived exclusively from verified Scikit-learn outputs.
          </p>
        </div>

        <div className="flex items-center space-x-3 print:hidden">
          <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300">
            Model: {insights.model_used}
          </span>
          <button
            onClick={handlePrintReport}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 1. EXECUTIVE SUMMARY */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 flex items-center space-x-2">
          <Sparkles className="w-4 h-4" />
          <span>1. Executive Summary</span>
        </h2>
        <p className="text-sm text-slate-200 leading-relaxed font-normal">
          {insights.executive_summary}
        </p>
      </div>

      {/* 2. MAJOR DISCOVERIES (EVIDENCE-GROUNDED) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>2. Major Empirical Discoveries</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">Ranked by operational impact</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.major_discoveries.map((disc, idx) => (
            <div 
              key={idx}
              className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{disc.topic}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    disc.impact === 'HIGH' ? 'bg-rose-950 text-rose-300' :
                    (disc.impact === 'MEDIUM' ? 'bg-amber-950 text-amber-300' : 'bg-cyan-950 text-cyan-300')
                  }`}>
                    {disc.impact} IMPACT
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{disc.finding}</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-mono text-slate-500 block">EVIDENCE SOURCE</span>
                <span className="text-[11px] font-mono text-cyan-300 truncate block">{disc.evidence_source}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. CROSS-MODEL INSIGHTS */}
      {insights.cross_model_insights && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-widest text-emerald-400">
            3. Cross-Model Synthesis & Alignment
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            {insights.cross_model_insights}
          </p>
        </div>
      )}

      {/* 4. POTENTIAL INEFFICIENCIES */}
      {insights.potential_inefficiencies.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>4. Identified Operational Inefficiencies</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {insights.potential_inefficiencies.map((ineff, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300">{ineff.anomaly_type}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/60">
                    Severity: {ineff.estimated_severity}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{ineff.description}</p>
                <div className="text-[11px] text-slate-400 font-mono">
                  Affected Circuits: <span className="text-slate-200">{ineff.affected_nodes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. PRACTICAL ENERGY-SAVING RECOMMENDATIONS */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
          <Lightbulb className="w-4 h-4 text-cyan-400" />
          <span>5. Actionable Energy-Saving Interventions</span>
        </h2>

        <div className="space-y-3">
          {insights.practical_recommendations.map((rec, idx) => (
            <div 
              key={idx}
              className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="space-y-1 sm:max-w-xl">
                <h3 className="text-sm font-semibold text-white">{rec.action}</h3>
                <p className="text-xs text-slate-400 font-mono">{rec.evidence_basis}</p>
              </div>

              <div className="flex items-center space-x-4 shrink-0">
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-400 block">{rec.expected_savings}</span>
                  <span className="text-[10px] text-slate-500 font-mono">Expected Savings</span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-1 rounded font-semibold ${
                  rec.implementation_complexity === 'LOW' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40' :
                  (rec.implementation_complexity === 'MEDIUM' ? 'bg-amber-950 text-amber-300 border border-amber-800/40' : 'bg-rose-950 text-rose-300 border border-rose-800/40')
                }`}>
                  Complexity: {rec.implementation_complexity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. DATA IMPROVEMENT ADVISOR */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-cyan-800/60 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono">
            <Database className="w-4 h-4" />
            <span>DATA IMPROVEMENT ADVISOR</span>
          </div>
          <h2 className="text-base font-bold text-white">
            What Additional Data Should This College Collect?
          </h2>
          <p className="text-xs text-slate-400">
            Targeted sensor and telemetry logging enhancements tied strictly to actual dataset limitations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.data_collection_recommendations.map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-cyan-300 block">{item.missing_parameter}</span>
              <p className="text-xs text-slate-300">{item.analytical_impact}</p>
              <div className="text-[11px] font-mono text-emerald-400 pt-1 border-t border-slate-900">
                Recommended Log/Sensor: {item.recommended_sensor_or_log}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. CONFIDENCE & LIMITATIONS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <span className="text-xs font-mono text-emerald-400 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CONFIDENCE & EVIDENCE BASES</span>
          </span>
          <p className="text-xs text-slate-300 leading-relaxed font-mono">
            {insights.confidence_and_evidence}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <span className="text-xs font-mono text-amber-400 flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>ANALYTICAL LIMITATIONS</span>
          </span>
          <p className="text-xs text-slate-300 leading-relaxed font-mono">
            {insights.limitations}
          </p>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800 print:hidden">
        <button
          onClick={() => onNavigateToResults(analysisId)}
          className="text-xs text-slate-400 hover:text-white font-mono flex items-center space-x-1.5"
        >
          <span>← Back to ML Metrics</span>
        </button>

        <button
          onClick={handlePrintReport}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center space-x-2 transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Summary PDF / Print</span>
        </button>
      </div>
    </div>
  );
};
