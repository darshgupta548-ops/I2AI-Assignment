import React from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  Lightbulb, 
  AlertTriangle, 
  ShieldCheck,
  Activity,
  WifiOff
} from 'lucide-react';
import type { AiCompanionResult } from '../services/api';

interface AiCompanionProps {
  /** Pass the ai_companion object from trainSingleAlgorithm, or null while loading */
  companionData: AiCompanionResult | null;
  loading?: boolean;
  algorithmName?: string;
}

export const AiResearchCompanion: React.FC<AiCompanionProps> = ({
  companionData,
  loading = false,
  algorithmName = 'Algorithm',
}) => {
  if (loading && !companionData) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#292B32]/5 flex items-center justify-center space-x-4 text-sm text-[#777985]">
        <Activity className="w-5 h-5 text-[#581C87] animate-spin" />
        <span>AI Research Companion is interpreting the results…</span>
      </div>
    );
  }

  if (!companionData) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#292B32]/5 flex items-center space-x-4 text-sm text-[#777985]">
        <WifiOff className="w-5 h-5 text-[#777985]" />
        <span>AI Companion output not available. Run the algorithm to generate insights.</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-7 shadow-sm border border-[#292B32]/5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#292B32]/5 pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E8E2F4] flex items-center justify-center text-[#581C87]">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#292B32]">AI Research Companion</h3>
            <p className="text-xs text-[#777985]">
              Evidence-based interpretation of verified {algorithmName} computations
            </p>
          </div>
        </div>

        {/* Live Service Status */}
        <div className="flex items-center space-x-2 self-start sm:self-center">
          <span className={`w-2 h-2 rounded-full ${companionData.is_ai_generated ? 'bg-[#10B981] animate-pulse' : 'bg-[#F59E0B]'}`} />
          <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-[#F4F3EF] text-[#292B32] border border-[#292B32]/10">
            {companionData.model_used ?? (companionData.is_ai_generated ? 'Gemini Live' : 'Local Heuristic')}
          </span>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="space-y-2 p-4 rounded-2xl bg-[#F4F3EF] border border-[#292B32]/5">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#581C87] font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>SYNTHESIS FOR INTRO TO AI LEARNERS</span>
        </div>
        <p className="text-xs sm:text-sm text-[#292B32] leading-relaxed">
          {companionData.executive_summary}
        </p>
      </div>

      {/* Major Discoveries */}
      {companionData.major_discoveries?.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#777985]">
            Empirical Findings Grounded in Model Output
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {companionData.major_discoveries.map((disc, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-[#FAFAF8] border border-[#292B32]/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#292B32]">{disc.topic}</span>
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
                    disc.impact === 'HIGH' ? 'bg-red-100 text-red-800' :
                    disc.impact === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {disc.impact === 'LOW' ? 'Low impact' : disc.impact === 'MEDIUM' ? 'Medium impact' : 'High impact'}
                  </span>
                </div>
                <p className="text-xs text-[#292B32] leading-relaxed">{disc.finding}</p>
                <div className="text-[10px] font-mono text-[#581C87] pt-1 border-t border-[#292B32]/5">
                  Evidence: {disc.evidence_source}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Practical Recommendations */}
      {companionData.practical_recommendations?.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#777985]">
            Practical Applications &amp; Engineering Actions
          </h4>
          <div className="space-y-2">
            {companionData.practical_recommendations.map((rec, idx) => (
              <div key={idx} className="p-3 rounded-2xl bg-[#FAFAF8] border border-[#292B32]/5 flex items-start space-x-3">
                <div className="w-6 h-6 rounded-lg bg-[#DCEDE5] text-[#065F46] flex items-center justify-center shrink-0 mt-0.5">
                  <Lightbulb className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-bold text-[#292B32]">{rec.action}</span>
                    {'expected_savings' in rec && (
                      <span className="text-[10px] font-mono text-[#065F46] font-semibold">{rec.expected_savings}</span>
                    )}
                  </div>
                  {'evidence_basis' in rec && (
                    <p className="text-[11px] text-[#777985] font-mono">{rec.evidence_basis}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence & Limitations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {companionData.confidence_and_evidence && (
          <div className="p-3 rounded-2xl bg-[#DCEDE5]/50 border border-[#065F46]/10 space-y-1">
            <span className="font-semibold text-[#065F46] flex items-center space-x-1 text-[11px] font-mono">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>STATISTICAL CONFIDENCE</span>
            </span>
            <p className="text-[11px] text-[#292B32]">{companionData.confidence_and_evidence}</p>
          </div>
        )}
        {companionData.limitations && (
          <div className="p-3 rounded-2xl bg-[#FEF3C7]/50 border border-[#F59E0B]/10 space-y-1">
            <span className="font-semibold text-[#92400E] flex items-center space-x-1 text-[11px] font-mono">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>ALGORITHMIC LIMITATIONS</span>
            </span>
            <p className="text-[11px] text-[#292B32]">{companionData.limitations}</p>
          </div>
        )}
      </div>
    </div>
  );
};
