import React from 'react';
import { 
  ArrowRight, 
  Database, 
  Sparkles, 
  TrendingUp, 
  Layers, 
  Network, 
  BarChart2, 
  RotateCcw 
} from 'lucide-react';
import { 
  LinearRegressionIllustration, 
  DecisionTreeIllustration, 
  KMeansIllustration, 
  PCAIllustration 
} from '../three/ClayIllustrations';

interface MethodSelectionPageProps {
  datasetId: number;
  datasetName: string;
  rowCount: number;
  colCount: number;
  targetColumn?: string | null;
  visitedMethods: Set<string>;
  completedMethods: Set<string>;
  resolvedMethods: Set<string>;
  onOpenFinalAnalysis: () => void;
  onSelectMethod: (method: 'linear_regression' | 'decision_tree' | 'kmeans' | 'pca') => void;
  onChangeDataset: () => void;
}

export const MethodSelectionPage: React.FC<MethodSelectionPageProps> = ({
  datasetId,
  datasetName,
  rowCount,
  colCount,
  targetColumn,
  visitedMethods,
  completedMethods,
  resolvedMethods,
  onOpenFinalAnalysis,
  onSelectMethod,
  onChangeDataset,
}) => {
  const methods = [
    {
      id: 'linear_regression' as const,
      num: '01',
      title: 'Linear Regression',
      subtitle: 'Parametric Continuous Prediction',
      description: 'Discover how a model finds the best-fitting line, minimizes squared residual errors, and predicts continuous physical values.',
      buttonText: 'Explore Linear Regression',
      badge: 'Supervised',
      colorBg: 'bg-[#DCEAF4]/60',
      colorBorder: 'border-[#93C5FD]',
      colorText: 'text-blue-700',
      illustration: LinearRegressionIllustration,
      concepts: ['Slope β₁ & Intercept β₀', 'Residual Lines (e = y - ŷ)', 'Sum of Squared Errors', 'R² Variance Fit']
    },
    {
      id: 'decision_tree' as const,
      num: '02',
      title: 'Decision Tree',
      subtitle: 'Hierarchical Rule Splitting',
      description: 'Understand how machines split data into binary questions, calculate Gini impurity reduction, and build interpretable decision paths.',
      buttonText: 'Explore Decision Trees',
      badge: 'Supervised',
      colorBg: 'bg-[#DCEDE5]/60',
      colorBorder: 'border-[#86EFAC]',
      colorText: 'text-emerald-700',
      illustration: DecisionTreeIllustration,
      concepts: ['Impurity & Entropy', 'Orthogonal Decision Splits', 'Branch Growth Animation', 'Feature Importance (MDI)']
    },
    {
      id: 'kmeans' as const,
      num: '03',
      title: 'K-Means Clustering',
      subtitle: 'Unsupervised Group Discovery',
      description: 'See how data points organise themselves into natural clusters based on Euclidean similarity through iterative centroid convergence.',
      buttonText: 'Explore K-Means',
      badge: 'Unsupervised',
      colorBg: 'bg-[#FEF3C7]/60',
      colorBorder: 'border-[#FCD34D]',
      colorText: 'text-amber-700',
      illustration: KMeansIllustration,
      concepts: ['Centroid Initialization', 'Euclidean Distances', 'Iterative Mean Updates', 'Elbow & Silhouette']
    },
    {
      id: 'pca' as const,
      num: '04',
      title: 'Principal Component Analysis',
      subtitle: 'Dimensionality Reduction',
      description: 'Discover how orthogonal coordinate rotation captures maximum data variance and projects high-dimensional physics into a 2D map.',
      buttonText: 'Explore PCA',
      badge: 'Unsupervised',
      colorBg: 'bg-[#E8E2F4]/60',
      colorBorder: 'border-[#C4B5FD]',
      colorText: 'text-purple-700',
      illustration: PCAIllustration,
      concepts: ['Feature Standardisation', 'Covariance Matrix Σ', 'Rotating 3D Eigen-Axes', 'Scree Plot & Loadings']
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Active Dataset Context Banner */}
      <div className="clay-surface p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-700">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono uppercase text-[#777985] font-semibold">Active Laboratory Dataset</span>
              {targetColumn && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                  Target: {targetColumn}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-[#292B32] truncate max-w-md sm:max-w-xl">{datasetName}</h2>
            <p className="text-xs text-[#777985] font-mono mt-0.5">
              {rowCount} observations · {colCount} features loaded into memory
            </p>
          </div>
        </div>

        <button
          onClick={onChangeDataset}
          className="clay-button px-4 py-2 text-xs text-[#777985] hover:text-[#292B32] flex items-center space-x-1.5 self-start sm:self-center cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Switch Dataset</span>
        </button>
      </div>

      {/* Header */}
      <div className="space-y-1 text-center max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292B32] tracking-tight">
          Select a Machine Learning Laboratory
        </h1>
        <p className="text-xs sm:text-sm text-[#777985]">
          Each laboratory guides you through mathematical principles, interactive visual experiments, and real Scikit-learn computations.
        </p>
      </div>

      {/* 2 × 2 CLAYMORPHIC METHOD CARDS GRID */}
      {resolvedMethods.size === 4 && <button onClick={onOpenFinalAnalysis} className="w-full clay-button py-4 text-sm font-bold text-emerald-800 flex items-center justify-center gap-2"><Sparkles className="w-4 h-4"/>Open Hostel Energy Assessment</button>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {methods.map((m) => {
          const isVisited = visitedMethods.has(m.id);
          const isCompleted = completedMethods.has(m.id);
          const isResolved = resolvedMethods.has(m.id);
          const Illustration = m.illustration;

          return (
            <div
              key={m.id}
              className={`clay-card p-7 flex flex-col justify-between space-y-6 relative overflow-hidden group hover:border-slate-300 transition-all`}
            >
              {/* Subtle Pastel Top Glow */}
              <div className={`absolute top-0 left-0 right-0 h-2 ${m.colorBg} border-b ${m.colorBorder}`} />

              {/* Card Header & 3D Illustration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-slate-400">{m.num}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase ${m.colorBg} ${m.colorText}`}>
                      {m.badge}
                    </span>
                  </div>

                  {isVisited && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center space-x-1">
                      <span>✓</span>
                      <span>{isCompleted ? 'Model completed' : isResolved ? 'Reviewed · unavailable' : 'Visited'}</span>
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-[#292B32] group-hover:text-blue-600 transition-colors">
                    {m.title}
                  </h3>
                  <p className="text-xs font-medium text-[#777985] font-mono">{m.subtitle}</p>
                </div>

                {/* 3D Clay Illustration */}
                <div className="rounded-2xl clay-inset p-1 flex items-center justify-center">
                  <Illustration />
                </div>

                <p className="text-xs text-[#292B32] leading-relaxed">
                  {m.description}
                </p>

                {/* Key Concepts Pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {m.concepts.map((concept, cIdx) => (
                    <span
                      key={cIdx}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-white/80 text-[#777985] border border-slate-200/80"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onSelectMethod(m.id)}
                className="w-full clay-button py-3.5 text-xs text-[#292B32] hover:text-blue-600 font-bold flex items-center justify-center space-x-2 cursor-pointer group-hover:bg-[#292B32] group-hover:text-white transition-all"
              >
                <span>{m.buttonText}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
