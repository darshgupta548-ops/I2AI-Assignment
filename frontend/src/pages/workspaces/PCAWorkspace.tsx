import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Printer, CheckCircle2, Activity, Layers, Sliders,
} from 'lucide-react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, BarChart, Bar,
} from 'recharts';
import { api, DatasetProfile, SingleAlgorithmTrainResponse, effectiveColumnType, NUMERIC_COLUMN_TYPES } from '../../services/api';
import { AiResearchCompanion } from '../../components/AiResearchCompanion';
import { MathEquation } from '../../components/MathEquation';
import { PCA3DProjection } from '../../components/PCA3DProjection';
import { finiteChartRows, GraphEmptyState } from '../../components/charts';

interface PCAWorkspaceProps {
  datasetId: number;
  datasetProfile: DatasetProfile;
  onBackToMethods: () => void;
  onMarkVisited: () => void;
  onMarkResolved: (succeeded: boolean) => void;
}

export const PCAWorkspace: React.FC<PCAWorkspaceProps> = ({
  datasetId, datasetProfile, onBackToMethods, onMarkVisited, onMarkResolved,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 8;

  const [featX, setFeatX] = useState<string>('');
  const [featY, setFeatY] = useState<string>('');
  const [pcaFeatures, setPcaFeatures] = useState<string[]>([]);
  const [standardizedPoints, setStandardizedPoints] = useState<{ id: number; x: number; y: number }[]>([]);
  const [angleDeg, setAngleDeg] = useState<number>(35);
  const [training, setTraining] = useState<boolean>(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [mlOutput, setMlOutput] = useState<SingleAlgorithmTrainResponse | null>(null);
  useEffect(() => { if (currentStep === totalSteps && (mlOutput || trainingError)) onMarkResolved(Boolean(mlOutput)); }, [currentStep, mlOutput, trainingError, onMarkResolved]);

  useEffect(() => {
    onMarkVisited();
    const numCols = datasetProfile.columns.filter(c => NUMERIC_COLUMN_TYPES.includes(effectiveColumnType(c)));
    const likelyTarget = datasetProfile.potential_targets[0];
    setPcaFeatures(numCols.map(c => c.name).filter(name => name !== likelyTarget));
    if (numCols.length >= 2) {
      const fX = numCols[0].name;
      const fY = numCols[1].name;
      setFeatX(fX);
      setFeatY(fY);
      const raw = datasetProfile.preview_rows
        .map((row, idx) => ({ id: idx + 1, x: row[fX] == null || row[fX] === '' ? NaN : Number(row[fX]), y: row[fY] == null || row[fY] === '' ? NaN : Number(row[fY]) }))
        .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
      if (raw.length > 1) {
        const xVals = raw.map(p => p.x);
        const yVals = raw.map(p => p.y);
        const meanX = xVals.reduce((a, b) => a + b, 0) / xVals.length;
        const meanY = yVals.reduce((a, b) => a + b, 0) / yVals.length;
        const stdX = Math.sqrt(xVals.reduce((a, b) => a + (b - meanX) ** 2, 0) / xVals.length) || 1;
        const stdY = Math.sqrt(yVals.reduce((a, b) => a + (b - meanY) ** 2, 0) / yVals.length) || 1;
        setStandardizedPoints(raw.map(p => ({
          id: p.id,
          x: Number(((p.x - meanX) / stdX).toFixed(2)),
          y: Number(((p.y - meanY) / stdY).toFixed(2)),
        })));
      }
    }
  }, [datasetProfile]);

  const angleRad = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(angleRad);
  const uy = Math.sin(angleRad);
  const projectedValues = standardizedPoints.map(p => p.x * ux + p.y * uy);
  const meanProj = projectedValues.length ? projectedValues.reduce((a, b) => a + b, 0) / projectedValues.length : 0;
  const varianceCaptured = projectedValues.length > 1
    ? projectedValues.reduce((a, b) => a + (b - meanProj) ** 2, 0) / projectedValues.length
    : 0;
  const axisLinePoints = [{ x: -3 * ux, y: -3 * uy }, { x: 3 * ux, y: 3 * uy }];

  const runPythonPCA = async () => {
    setTraining(true);
    try { setTrainingError(null); const r = await api.trainSingleAlgorithm(datasetId, 'pca', undefined, undefined, pcaFeatures); setMlOutput(r); }
    catch (err) { console.error(err); setTrainingError(err instanceof Error ? err.message : 'PCA could not be run on these features.'); }
    finally { setTraining(false); }
  };

  useEffect(() => {
    if (currentStep >= 6 && !mlOutput && !training) runPythonPCA();
  }, [currentStep, pcaFeatures]);

  const getStageLabel = (s: number) =>
    s <= 3 ? 'Stage 1: UNDERSTAND' : s <= 5 ? 'Stage 2: EXPERIMENT' : 'Stage 3: ANALYSE';
  const actualProjection = finiteChartRows(mlOutput?.result?.scatter_points, ['pc1', 'pc2']);

  const stepLabels = ['Multi-Sensor Challenge','Z-Score Standardisation','Covariance Matrix','Rotating Eigenvector','Orthogonal Projection','Scikit-learn Execution','Scree Plot & Variance','Loadings & AI'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 print:max-w-none print:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#292B32]/10 pb-6 print:border-none">
        <div className="flex items-center space-x-4">
          <button onClick={onBackToMethods} className="p-2.5 rounded-2xl bg-white shadow-sm border border-[#292B32]/5 text-[#777985] hover:text-[#292B32] transition-all print:hidden">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-[#E8E2F4] text-[#581C87]">Dimensionality Reduction</span>
              <span className="text-xs font-medium text-[#777985] tracking-wide uppercase">{getStageLabel(currentStep)}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#292B32] mt-1">Principal Component Analysis Laboratory</h1>
          </div>
        </div>
        <button onClick={() => window.print()} className="px-4 py-2.5 rounded-2xl bg-white border border-[#292B32]/10 text-sm font-semibold text-[#292B32] shadow-sm hover:bg-[#FAFAF8] flex items-center space-x-2 print:hidden">
          <Printer className="w-4 h-4 text-[#777985]" />
          <span>Print Report</span>
        </button>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#292B32]/5 print:hidden">
        <div className="flex items-center overflow-x-auto pb-2 gap-2">
          {stepLabels.map((label, idx) => {
            const s = idx + 1;
            return (
              <button key={s} onClick={() => setCurrentStep(s)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 ${
                  currentStep === s ? 'bg-[#581C87] text-white shadow-md'
                  : currentStep > s ? 'bg-[#DCEDE5] text-[#065F46]'
                  : 'bg-[#FAFAF8] text-[#777985] hover:bg-[#F4F3EF]'}`}>
                <span>{s}. {label}</span>
                {currentStep > s && <CheckCircle2 className="w-3.5 h-3.5 text-[#065F46]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid */}
      {currentStep >= 6 && <section className="clay-card p-4 space-y-3">
        <div><h2 className="font-bold">PCA input measurements</h2><p className="text-xs text-slate-600">Choose numerical columns. Numeric binary indicators are allowed. If you explicitly select a categorical column, it is one-hot encoded. Dates, identifiers, and constants stay excluded.</p></div>
        <div className="flex flex-wrap gap-2">{datasetProfile.columns.filter(c => NUMERIC_COLUMN_TYPES.includes(effectiveColumnType(c)) || effectiveColumnType(c) === 'categorical').map(c => <label key={c.name} className="rounded-full border px-3 py-1.5 text-xs bg-white"><input className="mr-2" type="checkbox" checked={pcaFeatures.includes(c.name)} onChange={e => setPcaFeatures(old => e.target.checked ? [...old, c.name] : old.filter(n => n !== c.name))}/>{c.name}{effectiveColumnType(c) === 'categorical' ? ' (one-hot)' : ''}</label>)}</div>
        <div className="flex flex-wrap items-center gap-3"><p className="text-xs text-slate-500">{pcaFeatures.length} selected. Run again after changing inputs.</p><button disabled={training || pcaFeatures.length < 2} onClick={() => { setMlOutput(null); void runPythonPCA(); }} className="clay-button-primary px-4 py-2 text-xs disabled:opacity-50">Run PCA with selected inputs</button></div>
      </section>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Visualizations */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#292B32]/5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#292B32]">
                  {currentStep <= 5 ? 'Preview rows in standardized feature space' : 'Actual Scikit-learn PCA projection'}
                </h3>
                <p className="text-xs text-[#777985]">
                  {currentStep <= 5 ? `Teaching preview; standardised ${featX} and ${featY} values` : 'Projection coordinates calculated from the selected dataset'}
                </p>
              </div>
              {currentStep >= 4 && currentStep <= 5 && (
                <div className="bg-[#F4F3EF] px-3 py-1.5 rounded-2xl">
                  <span className="text-xs font-bold text-[#581C87]">Variance Captured: {varianceCaptured.toFixed(3)}</span>
                </div>
              )}
            </div>

            {currentStep <= 5 ? (
              <div className="space-y-4">
                <p className="text-xs text-amber-800">Preview-row experiment only; the fitted PCA results are shown in the Analysis stage.</p>
                <div className="h-80 w-full bg-[#FAFAF8] rounded-2xl p-4 border border-[#292B32]/5">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis type="number" dataKey="x" name={featX} stroke="#777985" fontSize={11} domain={[-3, 3]} />
                      <YAxis type="number" dataKey="y" name={featY} stroke="#777985" fontSize={11} domain={[-3, 3]} />
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const d = payload[0].payload;
                          return <div className="bg-white p-2.5 rounded-xl shadow-lg border border-[#292B32]/10 text-xs"><p className="font-bold">Sample #{d.id}</p><p className="text-[#777985]">z1: {d.x}, z2: {d.y}</p></div>;
                        }
                        return null;
                      }} />
                      <Scatter name="Standardized Data" data={standardizedPoints} fill="#8B5CF6" fillOpacity={0.7} />
                      {currentStep >= 4 && (
                        <Scatter name="PC Axis" data={axisLinePoints} line={{ stroke: '#581C87', strokeWidth: 3 }} shape={() => <></>} />
                      )}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                {currentStep >= 4 && (
                  <div className="bg-[#F4F3EF] p-4 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#292B32]">
                      <span className="flex items-center space-x-1.5"><Sliders className="w-3.5 h-3.5 text-[#581C87]" /><span>Interactive Principal Direction Angle</span></span>
                      <span className="font-mono text-[#581C87] text-sm">{angleDeg}&deg;</span>
                    </div>
                    <input type="range" min="0" max="180" value={angleDeg} onChange={e => setAngleDeg(Number(e.target.value))} className="w-full accent-[#581C87] cursor-pointer" />
                    <div className="flex justify-between text-[10px] text-[#777985]">
                      <span>0&deg; Horizontal</span><span>90&deg; Vertical</span><span>180&deg;</span>
                    </div>
                  </div>
                )}
              </div>
            ) : currentStep === 7 ? (
              <div className="space-y-6">
                <div className="h-64 w-full bg-[#FAFAF8] rounded-2xl p-4 border border-[#292B32]/5">
                  <h4 className="text-xs font-bold text-[#292B32] mb-2 uppercase tracking-wide">Scree Plot — Explained Variance by Component</h4>
                  {mlOutput?.result?.explained_variance_ratio ? (
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={mlOutput.result.explained_variance_ratio.map((v: number, i: number) => ({ component: `PC${i + 1}`, ratio: v }))} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="component" stroke="#777985" fontSize={11} />
                        <YAxis stroke="#777985" fontSize={11} domain={[0, 1]} tickFormatter={v => `${(Number(v) * 100).toFixed(0)}%`} />
                        <Tooltip formatter={(v: unknown) => [`${(Number(v) * 100).toFixed(1)}%`, 'Variance']} />
                        <Bar dataKey="ratio" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-xs text-[#777985]">Computing...</div>}
                </div>
                <div className="h-44 w-full bg-[#FAFAF8] rounded-2xl p-4 border border-[#292B32]/5">
                  <h4 className="text-xs font-bold text-[#292B32] mb-2 uppercase tracking-wide">Cumulative Explained Variance (Pareto)</h4>
                  {mlOutput?.result?.cumulative_explained_variance ? (
                    <ResponsiveContainer width="100%" height="80%">
                      <LineChart data={mlOutput.result.cumulative_explained_variance.map((v: number, i: number) => ({ component: `PC${i + 1}`, cumVar: v }))} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="component" stroke="#777985" fontSize={11} />
                        <YAxis stroke="#777985" fontSize={11} domain={[0, 1]} tickFormatter={v => `${(Number(v) * 100).toFixed(0)}%`} />
                        <Tooltip formatter={(v: unknown) => [`${(Number(v) * 100).toFixed(1)}%`, 'Cumulative']} />
                        <Line type="monotone" dataKey="cumVar" stroke="#10B981" strokeWidth={3} dot={{ r: 5, fill: '#10B981' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-xs text-[#777985]">Computing...</div>}
                </div>
              </div>
            ) : (
              <>
              <div className="h-80 w-full bg-[#FAFAF8] rounded-2xl p-4 border border-[#292B32]/5">
                {actualProjection.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis type="number" dataKey="pc1" name="PC1" stroke="#777985" fontSize={11} label={{ value: 'PC1 score', position: 'insideBottom', offset: -8 }}/>
                      <YAxis type="number" dataKey="pc2" name="PC2" stroke="#777985" fontSize={11} label={{ value: 'PC2 score', angle: -90, position: 'insideLeft' }}/>
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const d = payload[0].payload;
                          return <div className="bg-white p-2.5 rounded-xl shadow-lg border border-[#292B32]/10 text-xs"><p className="font-bold">Sample #{d.id}</p><p className="text-[#581C87]">PC1: {d.pc1}</p><p className="text-[#777985]">PC2: {d.pc2}</p></div>;
                        }
                        return null;
                      }} />
                      <Scatter name="Projected observations" data={actualProjection} fill="#8B5CF6" fillOpacity={0.7} />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-xs text-[#777985] space-y-2">
                    <Activity className="w-6 h-6 text-[#581C87] animate-spin" />
                    <span>{training ? 'Executing Scikit-learn PCA…' : trainingError || mlOutput?.result?.projection_unavailable_reason || 'No valid two-component projection is available.'}</span>
                  </div>
                )}
              </div>
              {currentStep >= 6 && mlOutput?.result?.n_components > 2 && <PCA3DProjection points={mlOutput?.result?.scatter_points ?? []} />}
              </>
            )}
          </div>

          {/* Factor Loadings in Step 8 */}
          {currentStep === 8 && mlOutput?.result?.loadings && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#292B32]/5 space-y-4">
              <h4 className="text-sm font-bold text-[#292B32] uppercase tracking-wide flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#581C87]" />
                <span>Factor Loadings Matrix (Eigenvector Weights)</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#292B32]/10 text-[#777985]">
                      <th className="py-2 px-3 font-semibold">Feature</th>
                      <th className="py-2 px-3 font-semibold text-[#581C87]">PC1</th>
                      <th className="py-2 px-3 font-semibold">PC2</th>
                      {mlOutput.result.n_components > 2 && <th className="py-2 px-3 font-semibold">PC3</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {mlOutput.result.loadings.map((row: Record<string, number | string>) => (
                      <tr key={String(row.feature)} className="border-b border-[#292B32]/5 hover:bg-[#FAFAF8]">
                        <td className="py-2.5 px-3 font-medium text-[#292B32]">{String(row.feature)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#581C87]">{Number(row.PC1) > 0 ? `+${row.PC1}` : row.PC1}</td>
                        <td className="py-2.5 px-3 font-mono text-[#777985]">{Number(row.PC2) > 0 ? `+${row.PC2}` : row.PC2}</td>
                        {mlOutput.result.n_components > 2 && (
                          <td className="py-2.5 px-3 font-mono text-[#777985]">{Number(row.PC3) > 0 ? `+${row.PC3}` : row.PC3}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right: Educational Explanations */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#292B32]/5 space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-[#777985] mb-2 uppercase tracking-wide">
                <span>Step {currentStep} of {totalSteps}</span>
                <span className="text-[#581C87] font-semibold">{getStageLabel(currentStep)}</span>
              </div>
              <h2 className="text-xl font-bold text-[#292B32]">
                {currentStep === 1 && '1. High-Dimensional Redundancy'}
                {currentStep === 2 && '2. Z-Score Standardisation'}
                {currentStep === 3 && '3. Covariance & Eigenvectors'}
                {currentStep === 4 && '4. Maximizing Projected Variance'}
                {currentStep === 5 && '5. Orthogonal Projection'}
                {currentStep === 6 && '6. Scikit-learn Python Execution'}
                {currentStep === 7 && '7. Scree Plot & Explained Variance'}
                {currentStep === 8 && '8. Loadings Matrix & AI Insights'}
              </h2>
            </div>

            <div className="space-y-4 text-sm text-[#777985] leading-relaxed">
              {currentStep === 1 && (
                <>
                    <p>This dataset contains multiple numeric measurements. PCA summarizes how those recorded measurements vary together.</p>
                    <p>The preview on the left shows two selected fields; the fitted model uses the eligible numeric features listed in the technical details.</p>
                  <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-[#292B32]/5">
                    <p className="text-xs font-bold text-[#292B32] uppercase tracking-wide mb-1">Objective</p>
                    <p className="text-xs">Compress D dimensions into k uncorrelated principal components while retaining maximum variance and information.</p>
                  </div>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <p>PCA is sensitive to feature scales. For example, a field recorded in hundreds can dominate one recorded between zero and one unless the features are standardized first.</p>
                  <MathEquation tex="z_j=\\frac{x_j-\\mu_j}{\\sigma_j}" className="text-[#581C87]" />
                  <p>xⱼ is one recorded value, μⱼ and σⱼ are that feature’s mean and standard deviation, and zⱼ is its standardized value. Standardization makes units comparable; zero-variance features cannot be standardized usefully.</p>
                </>
              )}

              {currentStep === 3 && (
                <>
                  <p>PCA computes the empirical <strong>Covariance Matrix</strong> of the standardized data matrix Z:</p>
                  <MathEquation tex="\\Sigma=\\frac{1}{n-1}Z^\\mathsf{T}Z" />
                  <p>We then solve the fundamental eigenvalue problem:</p>
                  <MathEquation tex="\\Sigma v_i=\\lambda_i v_i" className="text-[#581C87]" />
                  <p className="text-xs">Z has one row per observation and one column per standardized feature; n is the number of observations. vᵢ is a principal direction and λᵢ is the variance along that direction. The eigensolver orders directions from larger to smaller variance.</p>
                </>
              )}

              {currentStep === 4 && (
                <>
                  <p>The first principal component v1 is the unit vector that <strong>maximizes</strong> the variance of projected points:</p>
                  <MathEquation tex="\\max_{\\|v\\|=1}v^\\mathsf{T}\\Sigma v" />
                  <p>Drag the <strong>Principal Direction Angle</strong> slider to explore a two-feature preview. The final directions are computed from all eligible selected features by Scikit-learn.</p>
                </>
              )}

              {currentStep === 5 && (
                <>
                  <p>Subsequent components are constrained to be strictly <strong>orthogonal</strong> (v1 dot v2 = 0), guaranteeing zero correlation between components.</p>
                  <p>We transform high-dimensional samples into new low-dimensional coordinates via matrix multiplication:</p>
                  <MathEquation tex="Z_{\\mathrm{PCA}}=ZV_k" />
                </>
              )}

              {currentStep === 6 && (
                <>
                  <p>Executing <code>sklearn.decomposition.PCA</code> on the backend server across all eligible numerical features.</p>
                  {training ? (
                    <div className="p-4 rounded-2xl bg-[#E8E2F4]/40 flex items-center space-x-3 text-xs text-[#581C87]">
                      <Activity className="w-4 h-4 animate-spin" />
                      <span>Computing Singular Value Decomposition (SVD)...</span>
                    </div>
                  ) : mlOutput ? (
                    <div className="p-4 rounded-2xl bg-[#DCEDE5]/60 border border-[#065F46]/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[#065F46] font-bold">
                        <span>Execution Status</span><span>{mlOutput.result.status}</span>
                      </div>
                      <p className="text-[#292B32]">Retained Components: <strong>{mlOutput.result.n_components}</strong></p>
                      <p className="text-[#777985]">Time: {mlOutput.result.execution_time_ms} ms</p>
                    </div>
                  ) : (
                    <button onClick={runPythonPCA} className="w-full py-2.5 rounded-xl bg-[#581C87] text-white text-xs font-bold">
                      Execute Scikit-learn PCA
                    </button>
                  )}
                </>
              )}

              {currentStep === 7 && (
                <>
                  <p>The <strong>Scree Plot</strong> shows the share of measured feature variation represented by each component.</p>
                  <MathEquation tex="EVR_i=\\frac{\\lambda_i}{\\sum_{j=1}^{p}\\lambda_j}" />
                  <p className="text-xs">λᵢ is the variance captured by component i; the denominator sums variance over p retained components. EVR is a descriptive share, not predictive accuracy or energy importance.</p>
                  {mlOutput?.result && (
                    <div className="p-3 rounded-2xl bg-[#FAFAF8] border border-[#292B32]/5 text-xs space-y-1">
                      <p><span className="text-[#777985]">PC1 Explained: </span><strong className="text-[#581C87]">{(mlOutput.result.explained_variance_ratio[0] * 100).toFixed(1)}%</strong></p>
                      {mlOutput.result.n_components > 1 && (
                        <p><span className="text-[#777985]">PC1 + PC2 Cumulative: </span><strong className="text-[#065F46]">{(mlOutput.result.cumulative_explained_variance[1] * 100).toFixed(1)}%</strong></p>
                      )}
                    </div>
                  )}
                  <p className="text-xs">How many components are useful depends on the purpose and validation. A variance threshold alone does not prove that the compressed data is adequate for an operational decision.</p>
                </>
              )}

              {currentStep === 8 && (
                <>
                  <p>The <strong>Loadings Matrix</strong> shows how each selected numeric feature contributes to each principal direction.</p>
                  <p>Large absolute loadings indicate stronger contribution to that component. The sign marks direction on the component axis; it is not a causal effect or measure of operating importance.</p>
                </>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-[#292B32]/5">
              <button onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))} disabled={currentStep === 1}
                className="px-4 py-2 rounded-xl bg-[#F4F3EF] text-xs font-semibold text-[#777985] hover:text-[#292B32] disabled:opacity-40">
                Previous
              </button>
              {currentStep < totalSteps ? (
                <button onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
                  className="px-5 py-2 rounded-xl bg-[#581C87] text-white text-xs font-bold shadow-sm hover:bg-[#581C87]/90">
                  Next Step
                </button>
              ) : (
                <button onClick={onBackToMethods}
                  className="px-5 py-2 rounded-xl bg-[#065F46] text-white text-xs font-bold shadow-sm hover:bg-[#065F46]/90">
                  Return to Methods
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Companion in Step 8 */}
      {currentStep === 8 && (
        <div className="mt-8">
          <AiResearchCompanion companionData={mlOutput?.ai_companion ?? null} loading={training} algorithmName="PCA" />
        </div>
      )}
    </div>
  );
};
