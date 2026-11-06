import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ArrowRight, 
  ArrowLeft, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles, 
  Printer, 
  Sliders, 
  Info, 
  Layers 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  Line, 
  ReferenceLine,
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { api, DatasetProfile, SingleAlgorithmTrainResponse, effectiveColumnType, NUMERIC_COLUMN_TYPES } from '../../services/api';
import { AiResearchCompanion } from '../../components/AiResearchCompanion';
import { MathEquation } from '../../components/MathEquation';
import { finiteChartRows, GraphEmptyState } from '../../components/charts';

interface LRWorkspaceProps {
  datasetId: number;
  datasetProfile: DatasetProfile;
  onBackToMethods: () => void;
  onMarkVisited: () => void;
  onMarkResolved: (succeeded: boolean) => void;
}

export const LinearRegressionWorkspace: React.FC<LRWorkspaceProps> = ({
  datasetId,
  datasetProfile,
  onBackToMethods,
  onMarkVisited,
  onMarkResolved,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 9;

  // Selected features for 2D visualization
  const [xCol, setXCol] = useState<string>('');
  const [yCol, setYCol] = useState<string>('');
  const [points, setPoints] = useState<{ x: number; y: number; id: number }[]>([]);

  // Interactive line sliders in Experiment stage
  const [manualSlope, setManualSlope] = useState<number>(1.0);
  const [manualIntercept, setManualIntercept] = useState<number>(0.0);

  // Scikit-learn execution state
  const [training, setTraining] = useState<boolean>(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [mlOutput, setMlOutput] = useState<SingleAlgorithmTrainResponse | null>(null);
  useEffect(() => { if (currentStep === totalSteps && (mlOutput || trainingError)) onMarkResolved(Boolean(mlOutput)); }, [currentStep, mlOutput, trainingError, onMarkResolved]);

  useEffect(() => {
    onMarkVisited();
    // Initialize X and Y from dataset profile
    const numCols = datasetProfile.columns.filter(c => NUMERIC_COLUMN_TYPES.includes(effectiveColumnType(c)));
    if (numCols.length >= 2) {
      const target = datasetProfile.columns.find(c => c.is_target)?.name || '';
      const feat = numCols.find(c => c.name !== target)?.name || numCols[0].name;
      api.invalidateWorkspaceExperimentIfTargetChanged(datasetId, 'linear_regression', target);
      setMlOutput(previous => previous?.target_column !== target ? null : previous);
      setTrainingError(null);
      setYCol(target);
      setXCol(feat);

      // Extract preview sample points
      const samplePts = datasetProfile.preview_rows
        .map((row, idx) => ({ x: row[feat] == null || row[feat] === '' ? NaN : Number(row[feat]), y: row[target] == null || row[target] === '' ? NaN : Number(row[target]), id: idx + 1 }))
        .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

      setPoints(samplePts);

      // Compute rough initial slope and intercept for interactive slider
      if (samplePts.length > 1) {
        const xVals = samplePts.map(p => p.x);
        const yVals = samplePts.map(p => p.y);
        const meanX = xVals.reduce((a, b) => a + b, 0) / xVals.length;
        const meanY = yVals.reduce((a, b) => a + b, 0) / yVals.length;
        const roughSlope = (Math.max(...yVals) - Math.min(...yVals)) / (Math.max(...xVals) - Math.min(...xVals) || 1);
        setManualSlope(Number(roughSlope.toFixed(2)) || 1.0);
        setManualIntercept(Number((meanY - roughSlope * meanX).toFixed(1)) || 0.0);
      }
    }
  }, [datasetProfile, datasetId]);

  // Train actual Scikit-learn model on Step 7
  const runPythonLinearRegression = async () => {
    setTraining(true);
    try {
      setTrainingError(null);
      const response = await api.trainSingleAlgorithm(datasetId, 'linear_regression', yCol, xCol);
      setMlOutput(response);
    } catch (err) {
      console.error(err);
      setTrainingError(err instanceof Error ? err.message : 'The selected predictor and target could not be fitted.');
    } finally {
      setTraining(false);
    }
  };

  useEffect(() => {
    if (currentStep >= 7 && yCol && !mlOutput && !training && !trainingError) {
      runPythonLinearRegression();
    }
  }, [currentStep, yCol, mlOutput, training, trainingError]);

  // Compute live residuals for candidate line in step 5 & 6
  const computedResiduals = points.map(pt => {
    const yHat = manualIntercept + manualSlope * pt.x;
    const residual = pt.y - yHat;
    const squaredError = residual * residual;
    return { ...pt, yHat, residual, squaredError };
  });

  const sumSquaredResiduals = computedResiduals.reduce((acc, curr) => acc + curr.squaredError, 0);

  // Generate line points for rendering candidate or fitted regression line
  const minX = points.length ? Math.min(...points.map(p => p.x)) : 0;
  const maxX = points.length ? Math.max(...points.map(p => p.x)) : 100;
  
  const candidateLineData = [
    { x: minX, y: Number((manualIntercept + manualSlope * minX).toFixed(4)) },
    { x: maxX, y: Number((manualIntercept + manualSlope * maxX).toFixed(4)) }
  ];
  const chartPoints = currentStep >= 7
    ? (mlOutput?.result?.plot_feature === xCol ? finiteChartRows(mlOutput.result.plot_observations, ['x', 'y']) : [])
    : points;

  // Stage indicator logic:
  // Steps 1-3: UNDERSTAND
  // Steps 4-6: EXPERIMENT
  // Steps 7-9: ANALYSE
  const currentStage = currentStep <= 3 ? 'UNDERSTAND' : (currentStep <= 6 ? 'EXPERIMENT' : 'ANALYSE');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb & Progress Control */}
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
            <span className="text-[10px] font-mono uppercase tracking-widest text-blue-600 font-bold block">
              METHOD 01 · INTERACTIVE LABORATORY
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-[#292B32]">Linear Regression</h1>
          </div>
        </div>

        {/* 3-Stage Progress Indicator */}
        <div className="flex items-center space-x-2 self-start sm:self-center">
          {['UNDERSTAND', 'EXPERIMENT', 'ANALYSE'].map((stage, idx) => {
            const isCurrent = currentStage === stage;
            const isPast = (idx === 0 && currentStep > 3) || (idx === 1 && currentStep > 6);
            return (
              <div key={stage} className="flex items-center space-x-1.5">
                <span className={`text-[10px] font-mono px-3 py-1 rounded-full font-bold transition-all ${
                  isCurrent 
                    ? 'bg-blue-100 text-blue-800 border border-blue-300 shadow-sm' 
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

      {/* STEP PROGRESS BAR */}
      <div className="clay-card p-4 flex items-center justify-between text-xs font-mono text-[#777985]">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-[#292B32]">Step {currentStep} of {totalSteps}:</span>
          <span className="text-blue-700 font-semibold">
            {currentStep === 1 && 'Meet the Dataset & Variables'}
            {currentStep === 2 && 'The Mathematical Equation (ŷ = β₀ + β₁X)'}
            {currentStep === 3 && 'Plotting Observations in Coordinate Space'}
            {currentStep === 4 && 'The Candidate Regression Line'}
            {currentStep === 5 && 'Computing Residual Deviations (e = y - ŷ)'}
            {currentStep === 6 && 'Sum of Squared Errors (Least Squares)'}
            {currentStep === 7 && 'Scikit-Learn Model Training'}
            {currentStep === 8 && 'Evaluation Metrics (R², RMSE, MAE)'}
            {currentStep === 9 && 'Final Statistical Analysis & AI Companion'}
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

      {/* MAIN STEP CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Interactive / Visual Canvas */}
        <div className="lg:col-span-7 clay-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-bold text-slate-500">
              Interactive 2D Observation Plane
            </span>
            <span className="text-xs font-mono text-blue-600">
              X: {xCol} ➔ Y: {yCol}
            </span>
          </div>

          {/* Coordinate Plane Render */}
          <div className="h-80 w-full clay-inset p-2 rounded-2xl">
            {currentStep >= 3 && chartPoints.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
                  <XAxis type="number" dataKey="x" name={xCol} stroke="#6B7280" tick={{ fontSize: 10 }} label={{ value: xCol, position: 'insideBottom', offset: -10, fontSize: 11, fill: '#6B7280' }} />
                  <YAxis type="number" dataKey="y" name={yCol} stroke="#6B7280" tick={{ fontSize: 10 }} label={{ value: yCol, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6B7280' }} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }} 
                    contentStyle={{ backgroundColor: '#FAFAF8', borderRadius: '12px', borderColor: '#E2E8F0', boxShadow: '0 8px 16px rgba(0,0,0,0.08)', fontSize: '11px' }} 
                  />
                  <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
                  
                  {/* Observation Points */}
                  <Scatter name={currentStep >= 7 ? 'Dataset observations' : 'Preview observations'} data={chartPoints} fill="#3B82F6">
                    {chartPoints.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill="#3B82F6" />
                    ))}
                  </Scatter>

                  {/* Render Regression Line in Steps 4 through 9 */}
                  {currentStep >= 7 && mlOutput?.result?.fitted_line?.length === 2 ? (
                    <Scatter name="Actual fitted line (Scikit-learn)" data={mlOutput.result.fitted_line} line={{ stroke: '#059669', strokeWidth: 3 }} lineType="joint" shape={() => <></>} />
                  ) : currentStep >= 4 && currentStep <= 6 ? (
                    <Scatter name="Candidate line (slider experiment)" data={candidateLineData} line={{ stroke: '#F59E0B', strokeWidth: 2, strokeDasharray: '6 4' }} lineType="joint" shape={() => <></>} />
                  ) : null}
                </ScatterChart>
              </ResponsiveContainer>
            ) : currentStep >= 3 && training ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">Fitting the model and preparing measured chart values…</div>
            ) : currentStep >= 3 ? (
              <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 p-4">{currentStep >= 7 ? trainingError || 'The fitted plot is unavailable; the backend did not return a single-feature line.' : `No finite preview observations are available for ${xCol} and ${yCol}.`}</div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-[#777985]">
                <TrendingUp className="w-8 h-8 text-blue-400" />
                <p className="text-xs">Observations will populate the coordinate plane in Step 3.</p>
              </div>
            )}
          </div>

          {/* Step 4 & 5: Interactive Line Sliders */}
          {currentStep >= 4 && currentStep <= 6 && (
            <div className="clay-surface p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-[#292B32]">
                <span className="flex items-center space-x-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  <span>Adjust Candidate Line Parameters:</span>
                </span>
                <span className="font-mono text-amber-700">
                  ŷ = {manualIntercept} + {manualSlope}X
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-[#777985]">
                    <span>Slope (β₁):</span>
                    <span>{manualSlope}</span>
                  </div>
                  <input
                    type="range"
                    min={-10.0}
                    max={15.0}
                    step={0.1}
                    value={manualSlope}
                    onChange={(e) => setManualSlope(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-[#777985]">
                    <span>Intercept (β₀):</span>
                    <span>{manualIntercept}</span>
                  </div>
                  <input
                    type="range"
                    min={-100.0}
                    max={300.0}
                    step={1.0}
                    value={manualIntercept}
                    onChange={(e) => setManualIntercept(parseFloat(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>
              </div>

              {currentStep >= 6 && (
                <div className="p-3 rounded-lg clay-inset flex items-center justify-between text-xs font-mono">
                  <span className="text-[#777985]">Sum of Squared Residuals (SSR):</span>
                  <span className="font-bold text-amber-800">{sumSquaredResiduals.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Pedagogical Explanation Column */}
        <div className="lg:col-span-5 clay-card p-6 space-y-5">
          {/* STEP 1 */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">1. Meet the Dataset</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                In supervised linear regression, we have paired observations: an independent variable <span className="font-mono font-bold text-blue-600">X</span> (predictor) and a continuous dependent variable <span className="font-mono font-bold text-blue-600">Y</span> (response).
              </p>
              <div className="p-3.5 rounded-xl clay-inset space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#777985]">Predictor (X):</span>
                  <span className="font-bold text-[#292B32]">{xCol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777985]">Target Response (Y):</span>
                  <span className="font-bold text-blue-700">{yCol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777985]">Total Samples:</span>
                  <span className="font-bold text-[#292B32]">{datasetProfile.row_count}</span>
                </div>
              </div>
              <p className="text-xs text-[#777985]">
                Our goal is to discover the continuous mathematical relationship connecting X to Y so that we can predict energy demand for any new scenario.
              </p>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">2. Understand the Equation</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                Linear regression assumes the relationship between X and Y can be modeled as a straight line:
              </p>
              
              <div className="p-5 rounded-2xl clay-inset text-center space-y-2">
                <MathEquation tex="\\hat{y}=\\beta_0+\\beta_1x" className="text-blue-700" />
                <div className="text-[11px] font-mono text-[#777985]">
                  (Predicted Value = Baseline Intercept + Slope × Predictor)
                </div>
              </div>

              <div className="space-y-2 text-xs text-[#292B32]">
                <div className="p-2.5 rounded-xl clay-surface space-y-0.5">
                  <span className="font-bold font-mono text-blue-600">β₁ (Slope):</span>
                  <p className="text-[#777985]">How much ŷ increases for every 1-unit increase in X.</p>
                </div>
                <div className="p-2.5 rounded-xl clay-surface space-y-0.5">
                  <span className="font-bold font-mono text-amber-600">β₀ (Intercept):</span>
                  <p className="text-[#777985]">The baseline predicted value when X equals 0.</p>
                </div>
                <div className="p-2.5 rounded-xl clay-surface space-y-0.5">
                  <span className="font-bold font-mono text-slate-700">ŷ (Y-hat):</span>
                  <p className="text-[#777985]">The estimated prediction generated by the mathematical model.</p>
                </div>
              </div>
              <p className="text-xs text-slate-600">x is the selected predictor, y is the measured target, ŷ is the model estimate, β₀ is the estimated baseline, and β₁ is the estimated change in y for a one-unit increase in x. The equation describes a line; it does not establish a causal effect.</p>
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">3. Observations in Space</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                Look at the left coordinate plane. Each blue clay sphere represents a measured historical observation <span className="font-mono font-bold">(xᵢ, yᵢ)</span>.
              </p>
              <div className="p-4 rounded-xl clay-inset space-y-2 text-xs">
                <p className="text-[#292B32]">
                  Hover over any data point to inspect its exact coordinates. Notice that real-world measurements do not form a perfectly straight line—noise, sensor variation, and external factors create natural scatter.
                </p>
              </div>
              <p className="text-xs text-[#777985]">
                In the next step, we will draw a candidate line through this point cloud.
              </p>
            </div>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">4. The Candidate Line</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                We have drawn a candidate line (shown in amber). Use the sliders below the plot to adjust its slope <span className="font-mono font-bold">β₁</span> and intercept <span className="font-mono font-bold">β₀</span>.
              </p>
              <p className="text-xs text-[#777985]">
                Observe how the line tilts and shifts as you change the numbers. How do we determine which line is scientifically the "best" fit?
              </p>
            </div>
          )}

          {/* STEP 5 */}
          {currentStep === 5 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">5. Residual Deviations</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                The difference between an actual measured value <span className="font-mono font-bold">yᵢ</span> and the line's prediction <span className="font-mono font-bold">ŷᵢ</span> is called the <span className="font-bold text-rose-600">residual error</span>:
              </p>
              
              <MathEquation tex="e_i=y_i-\\hat{y}_i" className="text-rose-600" />

              <p className="text-xs text-[#777985]">
                Points above the line have positive residuals; points below the line have negative residuals. If we just added residuals up, positive and negative errors would cancel out to zero!
              </p>
            </div>
          )}

          {/* STEP 6 */}
          {currentStep === 6 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">6. Ordinary Least Squares (OLS)</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                To prevent positive and negative residuals from cancelling, we square each residual: <span className="font-mono font-bold text-amber-700">eᵢ²</span>.
              </p>
              
              <div className="p-4 rounded-xl clay-inset text-center space-y-1">
                <MathEquation tex="SSE=\\sum_{i=1}^{n}(y_i-\\hat{y}_i)^2" />
                <div className="text-[11px] font-mono text-[#777985]">
                  (Sum of Squared Residuals)
                </div>
              </div>

              <p className="text-xs text-[#292B32]">
                Try moving the sliders now. Notice how the SSR value changes! The optimal regression line is mathematically defined as the unique line that <span className="font-bold text-blue-700">minimizes SSR</span>.
              </p>
            </div>
          )}

          {/* STEP 7 */}
          {currentStep === 7 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">7. Scikit-Learn Model Training</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                Instead of guessing with sliders, Python's <span className="font-mono font-bold text-blue-700">scikit-learn LinearRegression</span> solves the closed-form normal equation:
              </p>
              
              <div className="p-3.5 rounded-xl clay-inset text-center text-xs font-mono text-[#292B32]">
                β = (XᵀX)⁻¹ Xᵀy
              </div>

              {training ? (
                <div className="p-4 text-center font-mono text-xs text-blue-600 animate-pulse">
                  Executing Scikit-learn OLS in Python...
                </div>
              ) : mlOutput && (
                <div className="space-y-2 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#777985]">Computed Optimal β₁ (Slope):</span>
                    <span className="font-bold text-blue-800">{mlOutput.result.coefficients?.[0]?.coefficient}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#777985]">Computed Optimal β₀ (Intercept):</span>
                    <span className="font-bold text-blue-800">{mlOutput.result.intercept}</span>
                  </div>
                  <div className="text-[10px] text-blue-700 pt-1 border-t border-blue-200">
                    The blue line on the plot now represents the exact mathematical best fit.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 8 */}
          {currentStep === 8 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">8. Model Evaluation Metrics</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                We evaluate regression accuracy on an out-of-sample 20% test split:
              </p>

              {mlOutput && (
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-3 rounded-xl clay-surface space-y-0.5">
                    <span className="text-[10px] text-[#777985] block">R² SCORE</span>
                    <span className="text-lg font-bold text-blue-700">{mlOutput.result.r2_score}</span>
                    <span className="text-[10px] text-slate-500 block">Proportion of variance explained</span>
                  </div>
                  <div className="p-3 rounded-xl clay-surface space-y-0.5">
                    <span className="text-[10px] text-[#777985] block">RMSE</span>
                    <span className="text-lg font-bold text-[#292B32]">{mlOutput.result.rmse}</span>
                    <span className="text-[10px] text-slate-500 block">Root mean squared error</span>
                  </div>
                  <div className="p-3 rounded-xl clay-surface space-y-0.5">
                    <span className="text-[10px] text-[#777985] block">MAE</span>
                    <span className="text-lg font-bold text-[#292B32]">{mlOutput.result.mae}</span>
                    <span className="text-[10px] text-slate-500 block">Mean absolute deviation</span>
                  </div>
                  <div className="p-3 rounded-xl clay-surface space-y-0.5">
                    <span className="text-[10px] text-[#777985] block">TRAIN/TEST</span>
                    <span className="text-lg font-bold text-emerald-700">80% / 20%</span>
                    <span className="text-[10px] text-slate-500 block">No data leakage</span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-[#777985]">
                An R² of 1.0 means perfect prediction; an R² of 0.0 means the model performs no better than the sample mean.
              </p>
            </div>
          )}

          {/* STEP 9 */}
          {currentStep === 9 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#292B32]">9. Final Analysis Complete</h3>
              <p className="text-xs text-[#292B32] leading-relaxed">
                You have completed the entire Linear Regression lifecycle—from scatterplot formulation to OLS minimization and out-of-sample evaluation.
              </p>
              <div className="p-3.5 rounded-xl clay-inset text-xs space-y-1">
                <span className="font-semibold text-blue-800 font-mono block">Key Learning Takeaway:</span>
                <p className="text-[#292B32]">
                  Linear Regression provides transparent, physically interpretable slope weights (rate of change), but assumes a strictly straight-line relationship and is sensitive to extreme outliers.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FINAL ANALYSIS STAGE (STEP 9 EXPANDED VIEW WITH AI COMPANION) */}
      {currentStep === 9 && mlOutput && (
        <div className="space-y-8 animate-fadeIn pt-4 border-t border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="clay-card p-5 space-y-2"><h3 className="font-bold text-sm">Test-set actual versus predicted</h3><p className="text-xs text-slate-600">Each point is an unseen test observation; closeness to the diagonal indicates better predictions.</p>
              {finiteChartRows(mlOutput.result.actual_vs_predicted, ['actual', 'predicted']).length ? <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><ScatterChart><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="actual" name={`Actual ${yCol}`} label={{ value: `Actual ${yCol}`, position: 'insideBottom', offset: -4 }}/><YAxis type="number" dataKey="predicted" name={`Predicted ${yCol}`}/><Tooltip formatter={(v: unknown) => Number(v).toFixed(3)}/><Scatter name="Test observations" data={finiteChartRows(mlOutput.result.actual_vs_predicted, ['actual', 'predicted'])} fill="#2563EB"/></ScatterChart></ResponsiveContainer></div> : <GraphEmptyState message="No valid test predictions were returned."/>}
            </section>
            <section className="clay-card p-5 space-y-2"><h3 className="font-bold text-sm">Test-set residuals</h3><p className="text-xs text-slate-600">Residuals are actual minus predicted values. A centered, narrow distribution indicates smaller errors.</p>
              {finiteChartRows(mlOutput.result.residuals_distribution, ['bin', 'count']).length ? <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={finiteChartRows(mlOutput.result.residuals_distribution, ['bin', 'count'])}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="bin" name="Residual bin"/><YAxis name="Observations"/><Tooltip/><Bar dataKey="count" name="Count" fill="#F59E0B"/></BarChart></ResponsiveContainer></div> : <GraphEmptyState message="Residual distribution is unavailable for this split."/>}
            </section>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#292B32] flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <span>Comprehensive Linear Regression Briefing</span>
            </h2>
            <button
              onClick={() => window.print()}
              className="clay-button px-4 py-2 text-xs text-[#292B32] flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF Report</span>
            </button>
          </div>

          {/* AI Research Companion */}
          <AiResearchCompanion 
            companionData={mlOutput?.ai_companion ?? null}
            algorithmName="Linear Regression"
          />
        </div>
      )}
    </div>
  );
};
