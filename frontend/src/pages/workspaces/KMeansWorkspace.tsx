import React, { useState, useEffect } from 'react';
import { 
  Network, 
  ArrowLeft, 
  Sparkles, 
  Sliders, 
  Printer, 
  RotateCcw,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Activity,
  Layers,
  Compass
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { api, DatasetProfile, SingleAlgorithmTrainResponse, effectiveColumnType, NUMERIC_COLUMN_TYPES } from '../../services/api';
import { AiResearchCompanion } from '../../components/AiResearchCompanion';
import { MathEquation } from '../../components/MathEquation';
import { finiteChartRows, GraphEmptyState } from '../../components/charts';

interface KMeansWorkspaceProps {
  datasetId: number;
  datasetProfile: DatasetProfile;
  onBackToMethods: () => void;
  onMarkVisited: () => void;
  onMarkResolved: (succeeded: boolean) => void;
}

interface Point2D {
  id: number;
  x: number;
  y: number;
  cluster: number;
}

interface Centroid {
  k: number;
  x: number;
  y: number;
  color: string;
}

const CLUSTER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export const KMeansWorkspace: React.FC<KMeansWorkspaceProps> = ({
  datasetId,
  datasetProfile,
  onBackToMethods,
  onMarkVisited,
  onMarkResolved,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 8;

  // Selected features for 2D visualization
  const [featureX, setFeatureX] = useState<string>('');
  const [featureY, setFeatureY] = useState<string>('');
  const [rawPoints, setRawPoints] = useState<Point2D[]>([]);

  // Interactive clustering state
  const [kCount, setKCount] = useState<number>(3);
  const [centroids, setCentroids] = useState<Centroid[]>([]);
  const [assignedPoints, setAssignedPoints] = useState<Point2D[]>([]);
  const [iteration, setIteration] = useState<number>(0);
  const [wcssHistory, setWcssHistory] = useState<{ iter: number; wcss: number }[]>([]);
  const [isConverged, setIsConverged] = useState<boolean>(false);

  // Scikit-learn execution state
  const [training, setTraining] = useState<boolean>(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [mlOutput, setMlOutput] = useState<SingleAlgorithmTrainResponse | null>(null);
  useEffect(() => { if (currentStep === totalSteps && (mlOutput || trainingError)) onMarkResolved(Boolean(mlOutput)); }, [currentStep, mlOutput, trainingError, onMarkResolved]);

  useEffect(() => {
    onMarkVisited();
    const numCols = datasetProfile.columns.filter(c => NUMERIC_COLUMN_TYPES.includes(effectiveColumnType(c)));
    if (numCols.length >= 2) {
      const fX = numCols[0].name;
      const fY = numCols[1].name;
      setFeatureX(fX);
      setFeatureY(fY);

      const pts: Point2D[] = datasetProfile.preview_rows.map((row, idx) => ({
        id: idx + 1,
        x: row[fX] == null || row[fX] === '' ? NaN : Number(row[fX]),
        y: row[fY] == null || row[fY] === '' ? NaN : Number(row[fY]),
        cluster: 0
      })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

      setRawPoints(pts);
      resetCentroids(kCount, pts);
    }
  }, [datasetProfile]);

  const resetCentroids = (k: number, pts: Point2D[] = rawPoints) => {
    if (!pts.length) return;
    const xVals = pts.map(p => p.x);
    const yVals = pts.map(p => p.y);
    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const minY = Math.min(...yVals);
    const maxY = Math.max(...yVals);

    const initialCentroids: Centroid[] = [];
    for (let i = 0; i < k; i++) {
      const factor = (i + 1) / (k + 1);
      initialCentroids.push({
        k: i + 1,
        x: Number((minX + (maxX - minX) * factor).toFixed(2)),
        y: Number((minY + (maxY - minY) * (factor + (i % 2 === 0 ? 0.1 : -0.1))).toFixed(2)),
        color: CLUSTER_COLORS[i % CLUSTER_COLORS.length]
      });
    }

    setCentroids(initialCentroids);
    setIteration(0);
    setIsConverged(false);

    // Initial assignment
    const { assigned, wcss } = assignPointsToCentroids(pts, initialCentroids);
    setAssignedPoints(assigned);
    setWcssHistory([{ iter: 0, wcss: Math.round(wcss) }]);
  };

  const assignPointsToCentroids = (pts: Point2D[], cents: Centroid[]) => {
    let totalWcss = 0;
    const assigned = pts.map(p => {
      let minDist = Infinity;
      let closestK = 1;
      cents.forEach(c => {
        const distSq = Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2);
        if (distSq < minDist) {
          minDist = distSq;
          closestK = c.k;
        }
      });
      totalWcss += minDist;
      return { ...p, cluster: closestK };
    });
    return { assigned, wcss: totalWcss };
  };

  // Perform one step of Expectation-Maximization (E-step + M-step)
  const stepIteration = () => {
    if (isConverged || !centroids.length) return;

    // M-step: calculate new centroid positions as mean of assigned points
    let maxShift = 0;
    const updatedCentroids = centroids.map(c => {
      const clusterPts = assignedPoints.filter(p => p.cluster === c.k);
      if (clusterPts.length === 0) return c;
      const avgX = clusterPts.reduce((acc, p) => acc + p.x, 0) / clusterPts.length;
      const avgY = clusterPts.reduce((acc, p) => acc + p.y, 0) / clusterPts.length;
      const shift = Math.sqrt(Math.pow(avgX - c.x, 2) + Math.pow(avgY - c.y, 2));
      if (shift > maxShift) maxShift = shift;
      return {
        ...c,
        x: Number(avgX.toFixed(2)),
        y: Number(avgY.toFixed(2))
      };
    });

    // E-step: reassign points to updated centroids
    const { assigned, wcss } = assignPointsToCentroids(assignedPoints, updatedCentroids);
    const nextIter = iteration + 1;
    setCentroids(updatedCentroids);
    setAssignedPoints(assigned);
    setIteration(nextIter);
    setWcssHistory(prev => [...prev, { iter: nextIter, wcss: Math.round(wcss) }]);

    if (maxShift < 0.05 || nextIter >= 15) {
      setIsConverged(true);
    }
  };

  // Run actual Scikit-learn model
  const runPythonKMeans = async (requestedK = kCount) => {
    setTraining(true);
    try {
      setTrainingError(null);
      const response = await api.trainSingleAlgorithm(datasetId, 'kmeans', undefined, undefined, undefined, requestedK);
      setMlOutput(response);
    } catch (err) {
      console.error(err);
      setTrainingError(err instanceof Error ? err.message : 'K-Means could not be run on this dataset.');
    } finally {
      setTraining(false);
    }
  };

  useEffect(() => {
    if (currentStep >= 6 && !mlOutput && !training) {
      runPythonKMeans();
    }
  }, [currentStep, kCount]);

  // Handle K change
  const handleKChange = (newK: number) => {
    setKCount(newK);
    setMlOutput(null);
    setTrainingError(null);
    resetCentroids(newK);
  };

  const getStageTitle = (step: number) => {
    if (step <= 3) return 'Stage 1: UNDERSTAND';
    if (step <= 5) return 'Stage 2: EXPERIMENT';
    return 'Stage 3: ANALYSE';
  };
  const actualClusterPoints = finiteChartRows(mlOutput?.result?.cluster_scatter_points, ['x', 'y', 'cluster']);
  const actualCentroids = finiteChartRows(mlOutput?.result?.cluster_centroids_2d, ['x', 'y']);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 print:max-w-none print:p-0">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#292B32]/10 pb-6 print:border-none">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToMethods}
            className="p-2.5 rounded-2xl bg-white shadow-sm border border-[#292B32]/5 text-[#777985] hover:text-[#292B32] hover:bg-[#FAFAF8] transition-all print:hidden"
            title="Return to Methods"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-[#DCEAF4] text-[#1E3A8A]">
                Unsupervised Learning
              </span>
              <span className="text-xs font-medium text-[#777985] tracking-wide uppercase">
                {getStageTitle(currentStep)}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#292B32] mt-1 flex items-center space-x-2">
              <span>K-Means Clustering Laboratory</span>
            </h1>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center space-x-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-2xl bg-white border border-[#292B32]/10 text-sm font-semibold text-[#292B32] shadow-sm hover:bg-[#FAFAF8] flex items-center space-x-2 transition-all"
          >
            <Printer className="w-4 h-4 text-[#777985]" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Sequential Stepper Navigation */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#292B32]/5 print:hidden">
        <div className="flex items-center justify-between overflow-x-auto pb-2 scrollbar-none gap-2">
          {[
            { step: 1, title: 'Unlabelled Data' },
            { step: 2, title: 'Euclidean Space' },
            { step: 3, title: 'Initial Centroids' },
            { step: 4, title: 'E-M Iteration' },
            { step: 5, title: 'WCSS Convergence' },
            { step: 6, title: 'Scikit-learn Execution' },
            { step: 7, title: 'Elbow & Silhouette' },
            { step: 8, title: 'Centroid Profiles & AI' },
          ].map((s) => (
            <button
              key={s.step}
              onClick={() => setCurrentStep(s.step)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 ${
                currentStep === s.step
                  ? 'bg-[#1E3A8A] text-white shadow-md'
                  : currentStep > s.step
                  ? 'bg-[#DCEDE5] text-[#065F46]'
                  : 'bg-[#FAFAF8] text-[#777985] hover:bg-[#F4F3EF]'
              }`}
            >
              <span>{s.step}. {s.title}</span>
              {currentStep > s.step && <CheckCircle2 className="w-3.5 h-3.5 text-[#065F46]" />}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Interactive Canvas & Visualizations */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#292B32]/5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#292B32]">
                  {currentStep <= 5 ? 'Interactive 2D Feature Space' : 'Clustering Visualization'}
                </h3>
                <p className="text-xs text-[#777985]">
                  {currentStep <= 5 
                    ? `Features: X = ${featureX}, Y = ${featureY}` 
                    : 'Multidimensional projection and cluster metrics'}
                </p>
              </div>

              {currentStep <= 5 && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-[#777985]">Clusters (k):</span>
                  {[2, 3, 4, 5].map((k) => (
                    <button
                      key={k}
                      onClick={() => handleKChange(k)}
                      className={`w-7 h-7 rounded-xl text-xs font-bold transition-all ${
                        kCount === k
                          ? 'bg-[#1E3A8A] text-white shadow-sm'
                          : 'bg-[#F4F3EF] text-[#777985] hover:bg-white'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Visualization Body depending on Step */}
            {currentStep <= 5 ? (
              <div className="space-y-4">
                <p className="text-xs text-amber-800">Teaching simulation using the displayed dataset preview; these assignments and centroids are separate from the Scikit-learn results shown in Analysis.</p>
                <div className="h-80 w-full bg-[#FAFAF8] rounded-2xl p-4 border border-[#292B32]/5 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis type="number" dataKey="x" name={featureX} stroke="#777985" fontSize={11} label={{ value: `${featureX} (preview values)`, position: 'insideBottom', offset: -8 }}/>
                      <YAxis type="number" dataKey="y" name={featureY} stroke="#777985" fontSize={11} label={{ value: featureY, angle: -90, position: 'insideLeft' }}/>
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }} 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-2.5 rounded-xl shadow-lg border border-[#292B32]/10 text-xs">
                                <p className="font-bold text-[#292B32]">
                                  {data.color ? `Centroid μ_${data.k}` : `Sample #${data.id}`}
                                </p>
                                <p className="text-[#777985]">{featureX}: {data.x}</p>
                                <p className="text-[#777985]">{featureY}: {data.y}</p>
                                {data.cluster > 0 && (
                                  <p className="font-semibold text-[#1E3A8A]">Assigned: Cluster {data.cluster}</p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {/* Data Points */}
                      <Scatter 
                        name="Hostel Data Points" 
                        data={assignedPoints.length ? assignedPoints : rawPoints} 
                      >
                        {(assignedPoints.length ? assignedPoints : rawPoints).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.cluster > 0 ? CLUSTER_COLORS[(entry.cluster - 1) % CLUSTER_COLORS.length] : '#9CA3AF'} 
                            fillOpacity={0.75}
                          />
                        ))}
                      </Scatter>

                      {/* Cluster centroids */}
                      {currentStep >= 3 && (
                        <Scatter 
                          name="Centroids" 
                          data={centroids} 
                          shape="cross"
                        >
                          {centroids.map((c, idx) => (
                            <Cell key={`cent-${idx}`} stroke="#1E3A8A" strokeWidth={3} fill="#1E3A8A" />
                          ))}
                        </Scatter>
                      )}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                {/* Step 4-5 Controls: Iteration Stepper */}
                {currentStep >= 4 && (
                  <div className="flex items-center justify-between bg-[#F4F3EF] p-4 rounded-2xl">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-bold text-[#292B32] uppercase tracking-wide">
                        Iteration: <span className="text-[#1E3A8A] font-extrabold text-sm">{iteration}</span>
                      </span>
                      {isConverged && (
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-[#DCEDE5] text-[#065F46] flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Converged (centre movement ≈ 0)</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => resetCentroids(kCount)}
                        className="px-3 py-1.5 rounded-xl bg-white text-xs font-semibold text-[#777985] hover:text-[#292B32] shadow-sm flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                      <button
                        onClick={stepIteration}
                        disabled={isConverged}
                        className="px-4 py-1.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold shadow-sm hover:bg-[#1E3A8A]/90 disabled:opacity-50 flex items-center space-x-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Step Next Iteration (E-M)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : currentStep === 7 ? (
              /* Step 7: Real Scikit-learn Elbow & Silhouette Curve */
              <div className="space-y-6">
                <div className="h-64 w-full bg-[#FAFAF8] rounded-2xl p-4 border border-[#292B32]/5">
                  <h4 className="text-xs font-bold text-[#292B32] mb-2 uppercase tracking-wide">
                    Elbow Curve (Inertia / WCSS vs. Number of Clusters K)
                  </h4>
                  {mlOutput?.result?.elbow_curve ? (
                    <ResponsiveContainer width="100%" height="90%">
                      <LineChart data={mlOutput.result.elbow_curve} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="k" stroke="#777985" fontSize={11} label={{ value: 'Number of Clusters (k)', position: 'insideBottom', offset: -5 }} />
                        <YAxis stroke="#777985" fontSize={11} />
                        <Tooltip />
                        <Line type="monotone" dataKey="inertia" stroke="#1E3A8A" strokeWidth={3} dot={{ r: 5, fill: '#1E3A8A' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-[#777985]">
                      Computing Elbow Curve...
                    </div>
                  )}
                </div>

                <div className="h-44 w-full bg-[#FAFAF8] rounded-2xl p-4 border border-[#292B32]/5">
                  <h4 className="text-xs font-bold text-[#292B32] mb-2 uppercase tracking-wide">
                    Silhouette Coefficients by K (Higher is Better)
                  </h4>
                  {mlOutput?.result?.elbow_curve ? (
                    <ResponsiveContainer width="100%" height="80%">
                      <BarChart data={mlOutput.result.elbow_curve} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="k" stroke="#777985" fontSize={11} />
                        <YAxis stroke="#777985" fontSize={11} domain={[0, 1]} />
                        <Tooltip />
                        <Bar dataKey="silhouette" fill="#3B82F6" radius={[6, 6, 0, 0]}>
                          {mlOutput.result.elbow_curve.map((entry: any, index: number) => (
                            <Cell 
                              key={`sil-${index}`} 
                              fill={entry.k === mlOutput.result.optimal_k ? '#10B981' : '#93C5FD'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-[#777985]">
                      Computing Silhouette Scores...
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Step 6 & 8: 2D Projected Cluster Scatter */
              <div className="h-80 w-full bg-[#FAFAF8] rounded-2xl p-4 border border-[#292B32]/5">
                {actualClusterPoints.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis type="number" dataKey="x" name="Principal Component 1" stroke="#777985" fontSize={11} label={{ value: 'PC1 projection (scaled features)', position: 'insideBottom', offset: -8 }} />
                      <YAxis type="number" dataKey="y" name="Principal Component 2" stroke="#777985" fontSize={11} label={{ value: 'PC2 projection', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-2.5 rounded-xl shadow-lg border border-[#292B32]/10 text-xs">
                                <p className="font-bold text-[#292B32]">Cluster {data.cluster}</p>
                                <p className="text-[#777985]">PC1: {data.x}, PC2: {data.y}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter name="Assigned observations" data={actualClusterPoints}>
                        {actualClusterPoints.map((entry: any, index: number) => (
                          <Cell 
                            key={`c-scat-${index}`} 
                            fill={CLUSTER_COLORS[(entry.cluster - 1) % CLUSTER_COLORS.length]} 
                            fillOpacity={0.8}
                          />
                        ))}
                      </Scatter>
                      <Scatter name="Fitted centroids" data={actualCentroids} shape="cross" fill="#111827">
                        {actualCentroids.map((entry: any, index: number) => <Cell key={`center-${index}`} stroke={CLUSTER_COLORS[(entry.cluster - 1) % CLUSTER_COLORS.length]} strokeWidth={4} fill={CLUSTER_COLORS[(entry.cluster - 1) % CLUSTER_COLORS.length]}/>)}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <GraphEmptyState loading={training} message={training ? 'Executing Scikit-learn K-Means in Python…' : trainingError || 'No valid projected observation points were returned.'}/>
                )}
              </div>
            )}
          </div>

          {/* Iteration Inertia Drop in Step 5 */}
          {currentStep === 5 && wcssHistory.length > 1 && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#292B32]/5">
              <h4 className="text-xs font-bold text-[#292B32] mb-3 uppercase tracking-wide">
                Within-Cluster Sum of Squares (Inertia) vs. Interactive Iterations
              </h4>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={wcssHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="iter" stroke="#777985" fontSize={11} label={{ value: 'Iteration', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#777985" fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="wcss" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Physical Centroids Profiles in Step 8 */}
          {currentStep === 8 && mlOutput?.result?.cluster_profiles && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#292B32]/5 space-y-4">
              <h4 className="text-sm font-bold text-[#292B32] uppercase tracking-wide flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#1E3A8A]" />
                <span>Unscaled Cluster Centroids (Physical Hostel Units)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mlOutput.result.cluster_profiles.map((profile: any) => (
                  <div 
                    key={profile.cluster_id} 
                    className="p-4 rounded-2xl border border-[#292B32]/5 bg-[#FAFAF8] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: CLUSTER_COLORS[(profile.cluster_id - 1) % CLUSTER_COLORS.length] }} 
                        />
                        <span className="font-bold text-sm text-[#292B32]">Cluster {profile.cluster_id}</span>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#DCEAF4] text-[#1E3A8A]">
                        {profile.sample_count} pts ({profile.sample_percentage}%)
                      </span>
                    </div>
                    <p className="text-xs text-[#777985] italic">{profile.objective_description}</p>
                    <div className="text-xs space-y-1 pt-2 border-t border-[#292B32]/5 font-mono">
                      {Object.entries(profile.centroids).slice(0, 4).map(([f, v]: any) => (
                        <div key={f} className="flex justify-between">
                          <span className="text-[#777985]">{f}:</span>
                          <span className="font-semibold text-[#292B32]">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Mathematical Explanations & Step Content */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#292B32]/5 space-y-6">
            
            {/* Step Header */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-[#777985] mb-2 uppercase tracking-wide">
                <span>Step {currentStep} of {totalSteps}</span>
                <span className="text-[#1E3A8A] font-semibold">{getStageTitle(currentStep)}</span>
              </div>
              <h2 className="text-xl font-bold text-[#292B32]">
                {currentStep === 1 && '1. The Unlabelled Data Problem'}
                {currentStep === 2 && '2. Euclidean Distance Metric'}
                {currentStep === 3 && '3. Centroid Initialization'}
                {currentStep === 4 && '4. Assignment and centroid update'}
                {currentStep === 5 && '5. Within-Cluster Sum of Squares'}
                {currentStep === 6 && '6. Scikit-learn Python Execution'}
                {currentStep === 7 && '7. Elbow Method & Silhouette'}
                {currentStep === 8 && '8. Physical Interpretation & AI'}
              </h2>
            </div>

            {/* Step Content & Formulas */}
            <div className="space-y-4 text-sm text-[#777985] leading-relaxed">
              {currentStep === 1 && (
                <>
                  <p>
                    K-Means is unsupervised: the rows are described by numeric measurements, with no target label required.
                  </p>
                  <p>
                    Similarity groups may help staff compare records, but their practical meaning must be checked against facilities context.
                  </p>
                  <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-[#292B32]/5 space-y-2">
                    <p className="text-xs font-bold text-[#292B32] uppercase tracking-wide">Objective</p>
                    <p className="text-xs">
                      Discover natural, geometric groupings in the data purely by measuring similarities across numerical features.
                    </p>
                  </div>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <p>
                    K-Means measures the distance between observation <MathEquation tex="x_i" block={false}/> and cluster centre <MathEquation tex="\\mu_k" block={false}/> using <strong>Euclidean distance</strong>:
                  </p>
                  <MathEquation tex="d(x_i,\\mu_k)=\\sqrt{\\sum_{j=1}^{p}(x_{ij}-\\mu_{kj})^2}" className="text-[#1E3A8A]" />
                  <p className="text-xs">Here j indexes the p measured features. For example, the distance from (3, 4) to (0, 0) is 5. The model standardizes features first so larger units do not dominate.</p>
                  <p>
                    Because Euclidean distance treats every axis equally, features with larger numeric scales (e.g., total Watts vs. Power Factor 0-1) would unfairly dominate the distance calculations.
                  </p>
                  <div className="p-3 rounded-xl bg-[#DCEDE5]/60 text-xs text-[#065F46] font-medium">
                    Scikit-learn automatically applies StandardScaler to guarantee fair geometric comparisons.
                  </div>
                </>
              )}

              {currentStep === 3 && (
                <>
                  <p>
                    K-Means begins with k candidate centres (centroids), one for each proposed group.
                  </p>
                  <p>
                    Choose k (2 to 5). The Scikit-learn model uses this cluster count and initializes centres with k-means++.
                  </p>
                  <div className="p-3 rounded-2xl bg-[#FAFAF8] border border-[#292B32]/5 text-xs">
                    Each sample point calculates its distance to all centroids and joins the nearest cluster.
                  </div>
                </>
              )}

              {currentStep === 4 && (
                <>
                  <p>
                    K-Means iterates through two alternating steps until coordinates stop changing:
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-xl bg-[#DCEAF4]/50 border border-[#1E3A8A]/10">
                      <strong className="text-[#1E3A8A]">1. E-Step (Assignment):</strong>
                      <MathEquation tex="c(i)=\\operatorname*{argmin}_{k}\\|x_i-\\mu_k\\|^2" />
                      <p className="text-[#777985] mt-1">Assign each data point to its closest centroid.</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#DCEDE5]/50 border border-[#065F46]/10">
                      <strong className="text-[#065F46]">2. M-Step (Update Centroids):</strong>
                      <MathEquation tex="\\mu_k=\\frac{1}{|C_k|}\\sum_{x_i\\in C_k}x_i" />
                      <p className="text-[#777985] mt-1">Move each centroid to the mathematical mean of its assigned cluster.</p>
                    </div>
                  </div>
                  <p className="text-xs">
                    Click <strong>Step Next Iteration (E-M)</strong> on the left to watch the centroids move physically toward their cluster centers!
                  </p>
                </>
              )}

              {currentStep === 5 && (
                <>
                  <p>
                    The overall optimization goal of K-Means is minimizing the <strong>Within-Cluster Sum of Squares (Inertia)</strong>:
                  </p>
                  <MathEquation tex="J=\\sum_{k=1}^{K}\\sum_{x_i\\in C_k}\\|x_i-\\mu_k\\|^2" />
                  <p>
                    J adds each record's squared distance to its assigned centre. Smaller J means tighter groups, but it normally falls when k increases, so it is not proof of useful groups. Convergence occurs when centres stop moving materially.
                  </p>
                </>
              )}

              {currentStep === 6 && (
                <>
                  <p>
                    Now executing the real <code>sklearn.cluster.KMeans</code> model directly on the backend server using the loaded dataset.
                  </p>
                  {training ? (
                    <div className="p-4 rounded-2xl bg-[#DCEAF4]/40 flex items-center space-x-3 text-xs text-[#1E3A8A]">
                      <Activity className="w-4 h-4 animate-spin" />
                      <span>Running Scikit-learn with 10 random restarts...</span>
                    </div>
                  ) : mlOutput ? (
                    <div className="p-4 rounded-2xl bg-[#DCEDE5]/60 border border-[#065F46]/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[#065F46] font-bold">
                        <span>Python Execution Status</span>
                        <span>{mlOutput.result.status}</span>
                      </div>
                      <p className="text-[#292B32]">
                        Optimal Clusters Selected: <strong>k = {mlOutput.result.optimal_k}</strong>
                      </p>
                      <p className="text-[#777985]">
                        Execution Time: {mlOutput.result.execution_time_ms} ms
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => void runPythonKMeans()}
                      className="w-full py-2.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold"
                    >
                      Execute Scikit-learn K-Means
                    </button>
                  )}
                </>
              )}

              {currentStep === 7 && (
                <>
                  <p>
                    How did Scikit-learn decide the optimal number of clusters?
                  </p>
                  <div className="space-y-2 text-xs">
                    <p>
                      <strong>1. The Elbow Method:</strong> Compare within-group squared distances across tested k values. A bend can suggest diminishing returns; it is a visual guide, not a guaranteed optimum.
                    </p>
                    <p>
                      <strong>2. Silhouette score:</strong> Values near 1 indicate better separation in this feature space; near 0 indicates overlap; negative values can indicate questionable assignments. It does not validate real-world meaning.
                    </p>
                  </div>
                  {mlOutput?.result && (
                    <div className="p-3 rounded-2xl bg-[#FAFAF8] border border-[#292B32]/5 text-xs">
                      <span className="text-[#777985]">Highest Silhouette Score: </span>
                      <strong className="text-[#1E3A8A]">{mlOutput.result.silhouette_score}</strong>
                      <span className="text-[#777985]"> at k = {mlOutput.result.optimal_k}</span>
                    </div>
                  )}
                </>
              )}

              {currentStep === 8 && (
                <>
                  <p>
                    To make cluster centroids useful for campus facilities managers, we <strong>unscale</strong> the standardized values back into real physical engineering units (kW, °C, occupancy count).
                  </p>
                  <p>
                    Review the cluster profiles on the left to see operational hostel archetypes (e.g., Night Standby vs. Midday Peak).
                  </p>
                </>
              )}
            </div>

            {/* Stepper Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-[#292B32]/5">
              <button
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                disabled={currentStep === 1}
                className="px-4 py-2 rounded-xl bg-[#F4F3EF] text-xs font-semibold text-[#777985] hover:text-[#292B32] disabled:opacity-40"
              >
                Previous
              </button>

              {currentStep < totalSteps ? (
                <button
                  onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
                  className="px-5 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold shadow-sm hover:bg-[#1E3A8A]/90"
                >
                  Next Step
                </button>
              ) : (
                <button
                  onClick={onBackToMethods}
                  className="px-5 py-2 rounded-xl bg-[#065F46] text-white text-xs font-bold shadow-sm hover:bg-[#065F46]/90"
                >
                  Return to Methods
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Research Companion Integration in Step 8 */}
      {currentStep === 8 && (
        <div className="mt-8">
          <AiResearchCompanion 
            companionData={mlOutput?.ai_companion || null} 
            loading={training} 
          />
        </div>
      )}
    </div>
  );
};
