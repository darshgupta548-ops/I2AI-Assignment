import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  ArrowLeft, 
  Sparkles, 
  Sliders, 
  Printer, 
  HelpCircle,
  GitBranch,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell 
} from 'recharts';
import { api, DatasetProfile, SingleAlgorithmTrainResponse, effectiveColumnType, NUMERIC_COLUMN_TYPES } from '../../services/api';
import { AiResearchCompanion } from '../../components/AiResearchCompanion';
import { DecisionTreeDiagram } from '../../components/DecisionTreeDiagram';
import { MathEquation } from '../../components/MathEquation';

interface DTWorkspaceProps {
  datasetId: number;
  datasetProfile: DatasetProfile;
  onBackToMethods: () => void;
  onMarkVisited: () => void;
  onMarkResolved: (succeeded: boolean) => void;
}

export const DecisionTreeWorkspace: React.FC<DTWorkspaceProps> = ({
  datasetId,
  datasetProfile,
  onBackToMethods,
  onMarkVisited,
  onMarkResolved,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 7;

  // Selected features for splitting demonstration
  const [featureCol, setFeatureCol] = useState<string>('');
  const [targetCol, setTargetCol] = useState<string>('');
  const [threshold, setThreshold] = useState<number>(30.0);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [targetIsRegression, setTargetIsRegression] = useState(false);

  // Tree growth simulation state (Step 4)
  const [growthLevel, setGrowthLevel] = useState<number>(1);

  // Scikit-learn execution state
  const [training, setTraining] = useState<boolean>(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [mlOutput, setMlOutput] = useState<SingleAlgorithmTrainResponse | null>(null);
  useEffect(() => { if (currentStep === totalSteps && (mlOutput || trainingError)) onMarkResolved(Boolean(mlOutput)); }, [currentStep, mlOutput, trainingError, onMarkResolved]);

  useEffect(() => {
    onMarkVisited();
    const cols = datasetProfile.columns;
    const target = cols.find(c => c.is_target)?.name || '';
    const feat = cols.find(c => c.name !== target && NUMERIC_COLUMN_TYPES.includes(effectiveColumnType(c)))?.name || cols[0].name;

    api.invalidateWorkspaceExperimentIfTargetChanged(datasetId, 'decision_tree', target);
    setMlOutput(previous => previous?.target_column !== target ? null : previous);
    setTrainingError(null);
    setTargetCol(target);
    setFeatureCol(feat);
    const targetProfile = cols.find(c => c.name === target);
    setTargetIsRegression(Boolean(targetProfile && NUMERIC_COLUMN_TYPES.includes(effectiveColumnType(targetProfile)) && (targetProfile.unique_count ?? 0) > 10));

    const rows = datasetProfile.preview_rows.map(r => ({
      featVal: r[feat] == null || r[feat] === '' ? NaN : Number(r[feat]),
      targetVal: r[target]
    })).filter(r => Number.isFinite(r.featVal) && r.targetVal != null && r.targetVal !== '');

    setSampleData(rows);
    if (rows.length > 0) {
      const vals = rows.map(r => r.featVal);
      setThreshold(Number(((Math.min(...vals) + Math.max(...vals)) / 2).toFixed(1)));
    }
  }, [datasetProfile, datasetId]);

  const runPythonDecisionTree = async () => {
    setTraining(true);
    try {
      setTrainingError(null);
      const response = await api.trainSingleAlgorithm(datasetId, 'decision_tree', targetCol);
      setMlOutput(response);
    } catch (err) {
      console.error(err);
      setTrainingError(err instanceof Error ? err.message : 'Decision Tree could not be run for this target.');
    } finally {
      setTraining(false);
    }
  };

  useEffect(() => {
    if (currentStep >= 5 && targetCol && !mlOutput && !training && !trainingError) {
      runPythonDecisionTree();
    }
  }, [currentStep, targetCol, mlOutput, training, trainingError]);

  // Compute live Gini impurity for left and right partitions based on interactive threshold
  const leftSamples = sampleData.filter(d => d.featVal <= threshold);
  const rightSamples = sampleData.filter(d => d.featVal > threshold);

  const calculateImpurity = (subset: typeof sampleData) => {
    if (!subset.length) return 0;
    if (targetIsRegression) {
      const values = subset.map(s => Number(s.targetVal)).filter(Number.isFinite);
      if (!values.length) return 0;
      const mean = values.reduce((a,b)=>a+b,0) / values.length;
      return Number((values.reduce((sum,v)=>sum+(v-mean)**2,0) / values.length).toFixed(3));
    }
    const counts: Record<string, number> = {};
    subset.forEach(s => { counts[s.targetVal] = (counts[s.targetVal] || 0) + 1; });
    let sumSq = 0;
    Object.values(counts).forEach(c => {
      const p = c / subset.length;
      sumSq += p * p;
    });
    return Number((1 - sumSq).toFixed(3));
  };

  const leftGini = calculateImpurity(leftSamples);
  const rightGini = calculateImpurity(rightSamples);
  const totalGini = calculateImpurity(sampleData);
  const weightedGini = Number(((leftSamples.length / (sampleData.length || 1)) * leftGini + (rightSamples.length / (sampleData.length || 1)) * rightGini).toFixed(3));
  const impurityGain = Number((totalGini - weightedGini).toFixed(3));

  const currentStage = currentStep <= 2 ? 'UNDERSTAND' : (currentStep <= 4 ? 'EXPERIMENT' : 'ANALYSE');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToMethods}
            className="clay-button px-3 py-1.5 text-xs text-[#777985] hover:text-[#292B32] flex items-center space-x-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Methods</span>
          </button>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-600 font-bold block">
              METHOD 02 · INTERACTIVE LABORATORY
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-[#292B32]">Decision Tree (CART)</h1>
          </div>
        </div>

        {/* 3-Stage Progress Indicator */}
        <div className="flex items-center space-x-2 self-start sm:self-center">
          {['UNDERSTAND', 'EXPERIMENT', 'ANALYSE'].map((stage, idx) => {
            const isCurrent = currentStage === stage;
            const isPast = (idx === 0 && currentStep > 2) || (idx === 1 && currentStep > 4);
            return (
              <div key={stage} className="flex items-center space-x-1.5">
                <span className={`text-[10px] font-mono px-3 py-1 rounded-full font-bold transition-all ${
                  isCurrent 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm' 
                    : (isPast ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-400')
                }`}>
                  {idx + 1}. {stage}
                </span>
                {idx < 2 && <span className="text-slate-300 font-mono">→</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP PROGRESS CONTROL */}
      <div className="clay-card p-4 flex items-center justify-between text-xs font-mono text-[#777985]">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-[#292B32]">Step {currentStep} of {totalSteps}:</span>
          <span className="text-emerald-700 font-semibold">
            {currentStep === 1 && 'Classification vs. Regression Targets'}
            {currentStep === 2 && 'Binary Splitting Questions'}
            {currentStep === 3 && 'Gini Impurity & Information Gain'}
            {currentStep === 4 && 'Animated Progressive Tree Growth'}
            {currentStep === 5 && 'Scikit-Learn CART Execution'}
            {currentStep === 6 && 'Interpreting Decision Rules & MDI Importances'}
            {currentStep === 7 && 'Final Analysis & AI Research Companion'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="clay-button px-3 py-1 text-xs disabled:opacity-40 cursor-pointer"
          >
            Back
          </button>
          <button
            onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
            disabled={currentStep === totalSteps}
            className="clay-button-primary px-4 py-1 text-xs disabled:opacity-40 cursor-pointer"
          >
            Next Step →
          </button>
        </div>
      </div>

      {/* WORKSPACE CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Interactive Tree & Split Surface */}
        <div className="lg:col-span-7 clay-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-bold text-slate-500">
              Interactive Decision Tree Diagram
            </span>
            <span className="text-xs font-mono text-emerald-700">
              Split Feature: {featureCol}
            </span>
          </div>

          {/* Tree Node Interactive Diagram */}
          <div className="clay-inset p-6 rounded-2xl min-h-[300px] flex flex-col items-center justify-center space-y-6">
            {/* Root Node */}
            <div className="clay-surface px-5 py-3 rounded-2xl text-center border-2 border-emerald-300 shadow-sm max-w-xs animate-scaleUp">
              <span className="text-[10px] font-mono text-[#777985] uppercase block">Root Decision Node</span>
              <span className="text-sm font-bold text-[#292B32]">
                Is {featureCol} ≤ {threshold}?
              </span>
              <div className="text-[10px] font-mono text-emerald-800 mt-1">
                Samples: {sampleData.length} · {targetIsRegression ? 'Variance' : 'Gini'}: {totalGini}
              </div>
            </div>

            {/* Branches and Children (Shown in Steps 3 through 7) */}
            {currentStep >= 3 && (
              <div className="w-full space-y-4">
                {/* Branch Connectors */}
                <div className="grid grid-cols-2 gap-4 text-center text-xs font-mono font-bold text-[#777985]">
                  <div className="flex flex-col items-center">
                    <span className="text-emerald-700">Yes (True)</span>
                    <div className="w-0.5 h-6 bg-emerald-400" />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-amber-700">No (False)</span>
                    <div className="w-0.5 h-6 bg-amber-400" />
                  </div>
                </div>

                {/* Child Nodes */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Left Child Node */}
                  <div className="clay-surface p-4 rounded-xl text-center border border-emerald-200">
                    <span className="text-[10px] font-mono text-emerald-800 block">Left Branch</span>
                    <span className="text-xs font-bold text-[#292B32]">{leftSamples.length} samples</span>
                    <div className="text-[11px] font-mono text-[#777985] mt-1">
                      Impurity ({targetIsRegression ? 'variance' : 'Gini'}): <span className="font-bold text-emerald-700">{leftGini}</span>
                    </div>
                  </div>

                  {/* Right Child Node */}
                  <div className="clay-surface p-4 rounded-xl text-center border border-amber-200">
                    <span className="text-[10px] font-mono text-amber-800 block">Right Branch</span>
                    <span className="text-xs font-bold text-[#292B32]">{rightSamples.length} samples</span>
                    <div className="text-[11px] font-mono text-[#777985] mt-1">
                      Impurity ({targetIsRegression ? 'variance' : 'Gini'}): <span className="font-bold text-amber-700">{rightGini}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Threshold Slider in Step 3 */}
          {currentStep === 3 && (
            <div className="clay-surface p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#292B32]">
                <span className="flex items-center space-x-1 text-emerald-700">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Adjust Splitting Threshold:</span>
                </span>
                <span className="font-mono">{threshold}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.5}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-[#777985] pt-1">
                <span>Total Impurity Gain: <span className="font-bold text-emerald-700">+{impurityGain}</span></span>
                <span>Weighted Child {targetIsRegression ? 'Variance' : 'Gini'}: <span className="font-bold text-[#292B32]">{weightedGini}</span></span>
              </div>
            </div>
          )}
        </div>

        {/* Right Pedagogical Column */}
        <div className="lg:col-span-5 clay-card p-6 space-y-5">
          {/* STEP 1 */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">1. Classification vs. Regression</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                Unlike linear regression, which assumes smooth straight lines, a <span className="font-bold text-emerald-700">Decision Tree</span> creates step-like hierarchical rules.
              </p>
              <div className="p-3.5 rounded-xl clay-inset space-y-2 text-xs">
                <div className="p-2 rounded bg-white/80">
                  <span className="font-bold font-mono text-emerald-800 block">Classifier:</span>
                  <span className="text-[#777985]">Predicts distinct categories (e.g., High Consumption vs Normal).</span>
                </div>
                <div className="p-2 rounded bg-white/80">
                  <span className="font-bold font-mono text-blue-800 block">Regressor:</span>
                  <span className="text-[#777985]">Predicts continuous numeric values by averaging leaf samples.</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">2. Binary Question Splits</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                At every internal node, the decision tree asks a simple binary true/false question:
              </p>
              <div className="p-4 rounded-xl clay-inset text-center font-mono font-bold text-sm text-emerald-800">
                Is Feature_X ≤ Threshold_T ?
              </div>
              <p className="text-xs text-[#777985]">
                Samples answering "Yes" flow down the left branch; samples answering "No" flow down the right branch. How does the algorithm choose the best question?
              </p>
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">3. {targetIsRegression ? 'Squared-error impurity' : 'Gini Impurity and Entropy'}</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                {targetIsRegression ? 'For a numeric target, the regression tree measures the mean squared spread of target values within a node:' : 'For a class target, a node impurity score measures how mixed its labels are. The fitted classifier uses Gini impurity:'}
              </p>
              {targetIsRegression ? <MathEquation tex="I(S)=\\frac{1}{|S|}\\sum_{i\\in S}(y_i-\\bar{y}_S)^2" className="text-emerald-800" /> : <>
                <MathEquation tex="Gini(S)=1-\\sum_{c=1}^{C}p_c^2" className="text-emerald-800" />
                <MathEquation tex="H(S)=-\\sum_{c=1}^{C}p_c\\log_2(p_c)" className="text-emerald-800" />
              </>}
              <p className="text-xs text-slate-600">{targetIsRegression ? 'S is the records at this node; yᵢ is a target value; ȳ is the node mean. The score is the average squared deviation, so a split is useful when children are more consistent.' : 'pᶜ is the share of records in class c, and C is the number of classes. With two equally represented classes, Gini is 0.5 and entropy is 1 bit; pure nodes score 0.'}</p>
              <p className="text-xs text-[#292B32]">
                A Gini of <span className="font-bold font-mono">0.0</span> represents perfect purity (all samples belong to the exact same class).
              </p>
              <p className="text-[11px] text-[#777985]">
                Move the threshold slider on the left. The tree tests hundreds of possible thresholds to find the one that produces the maximum <span className="font-bold text-emerald-700">Impurity Gain</span>!
              </p>
            </div>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">4. Progressive Tree Growth</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                Once the root node is split, the algorithm repeats the exact same splitting process recursively on each child branch until a stopping condition is reached.
              </p>
              <div className="p-3.5 rounded-xl clay-inset space-y-1.5 text-xs font-mono">
                <span className="text-[#777985] block font-bold">Stopping Criteria:</span>
                <p className="text-[#292B32]">• Maximum allowed tree depth reached (e.g. max_depth = 4)</p>
                <p className="text-[#292B32]">• Node becomes 100% pure (Gini = 0.0)</p>
                <p className="text-[#292B32]">• Node sample count drops below minimum threshold</p>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {currentStep === 5 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">5. Actual Scikit-Learn Training</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                Python's <span className="font-mono font-bold text-emerald-700">DecisionTreeClassifier / Regressor</span> has evaluated all candidate features in the dataset.
              </p>

              {training ? (
                <div className="p-4 text-center font-mono text-xs text-emerald-600 animate-pulse">
                  Growing decision tree in Python...
                </div>
              ) : mlOutput && (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs font-mono space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#777985]">Task Mode:</span>
                    <span className="font-bold text-emerald-800 capitalize">{mlOutput.result.task_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#777985]">Top Split Feature:</span>
                    <span className="font-bold text-emerald-800">{mlOutput.result.feature_importances?.[0]?.feature}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#777985]">Importance Share:</span>
                    <span className="font-bold text-emerald-800">{mlOutput.result.feature_importances?.[0]?.importance_pct}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 6 */}
          {currentStep === 6 && mlOutput && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">6. Interpretable Decision Rules</h3>
              <DecisionTreeDiagram nodes={mlOutput.result.tree_nodes ?? []} observations={mlOutput.result.tree_observations ?? []} />
            </div>
          )}
          {currentStep >= 5 && trainingError && !mlOutput && <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">Model unavailable: {trainingError}</div>}

          {/* STEP 7 */}
          {currentStep === 7 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">7. Tree Analysis Complete</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                Decision trees provide complete transparency and can model non-linear threshold jumps, but must be constrained to avoid memorizing sample noise (overfitting).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* FINAL ANALYSIS STAGE (STEP 7 EXPANDED VIEW WITH AI COMPANION) */}
      {currentStep === 7 && mlOutput && (
        <div className="space-y-8 animate-fadeIn pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#292B32] flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <span>Comprehensive Decision Tree Briefing</span>
            </h2>
            <button
              onClick={() => window.print()}
              className="clay-button px-4 py-2 text-xs text-[#292B32] flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF Report</span>
            </button>
          </div>

          {/* Feature Importances Bar Chart */}
          <div className="clay-card p-6 space-y-3">
            <h3 className="text-xs font-mono uppercase font-bold text-[#777985]">
              Feature Importances (Mean Decrease in Impurity - MDI)
            </h3>
            <p className="text-xs text-slate-600">Values are Scikit-learn impurity-reduction shares, shown as percentages. They describe this fitted tree only and do not show causation. {mlOutput.result.feature_importances?.filter((item: any) => item.importance > 0).length === 1 ? `In this fit, ${mlOutput.result.feature_importances.find((item: any) => item.importance > 0)?.feature} accounts for ${mlOutput.result.feature_importances.find((item: any) => item.importance > 0)?.importance_pct}% of the importance; the other fitted features did not reduce impurity.` : 'Features are shown in model-ranked order; zero-importance features are retained for context.'}</p>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mlOutput.result.feature_importances} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" stroke="#6B7280" tick={{ fontSize: 10 }} unit="%" />
                  <YAxis dataKey="feature" type="category" stroke="#6B7280" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: '#FAFAF8', borderRadius: '12px', borderColor: '#E2E8F0', fontSize: '11px' }} />
                  <Bar dataKey="importance_pct" fill="#059669" radius={[0, 4, 4, 0]} name="Importance %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Research Companion */}
          <AiResearchCompanion 
            companionData={mlOutput?.ai_companion ?? null}
            algorithmName="Decision Tree"
          />
        </div>
      )}
    </div>
  );
};
