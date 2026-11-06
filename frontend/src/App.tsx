import React, { useState, useEffect } from 'react';
import { HomeScreen } from './pages/HomeScreen';
import { MethodSelectionPage } from './pages/MethodSelectionPage';
import { LinearRegressionWorkspace } from './pages/workspaces/LinearRegressionWorkspace';
import { DecisionTreeWorkspace } from './pages/workspaces/DecisionTreeWorkspace';
import { KMeansWorkspace } from './pages/workspaces/KMeansWorkspace';
import { PCAWorkspace } from './pages/workspaces/PCAWorkspace';
import { FloatingMethodNav } from './components/FloatingMethodNav';
import { api, DatasetProfile } from './services/api';
import { FinalAIAnalysisPage } from './pages/FinalAIAnalysisPage';
import { Sparkles, Database, Home } from 'lucide-react';
import { MathDiagnosticsPage } from './pages/MathDiagnosticsPage';

type AppView = 'home' | 'methods' | 'linear_regression' | 'decision_tree' | 'kmeans' | 'pca' | 'final_analysis';

export function App() {
  const [view, setView] = useState<AppView>('home');
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);
  const [datasetProfile, setDatasetProfile] = useState<DatasetProfile | null>(null);
  const [visitedMethods, setVisitedMethods] = useState<Set<string>>(new Set());
  const [completedMethods, setCompletedMethods] = useState<Set<string>>(new Set());
  const [resolvedMethods, setResolvedMethods] = useState<Set<string>>(new Set());
  const [progressDatasetId, setProgressDatasetId] = useState<number | null>(null);
  const [loadingDataset, setLoadingDataset] = useState<boolean>(false);

  useEffect(() => {
    if (!activeDatasetId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`hostel-energy-progress-${activeDatasetId}`) || '{}');
      setVisitedMethods(new Set(saved.visited || []));
      setCompletedMethods(new Set(saved.completed || []));
      setResolvedMethods(new Set(saved.resolved || saved.completed || []));
    } catch { setVisitedMethods(new Set()); setCompletedMethods(new Set()); setResolvedMethods(new Set()); }
    setProgressDatasetId(activeDatasetId);
  }, [activeDatasetId]);

  useEffect(() => {
    if (activeDatasetId && progressDatasetId === activeDatasetId) localStorage.setItem(`hostel-energy-progress-${activeDatasetId}`, JSON.stringify({ visited: [...visitedMethods], completed: [...completedMethods], resolved: [...resolvedMethods] }));
  }, [activeDatasetId, progressDatasetId, visitedMethods, completedMethods, resolvedMethods]);

  // Load dataset profile when activeDatasetId changes
  const fetchProfile = async (id: number) => {
    setLoadingDataset(true);
    try {
      const prof = await api.getDatasetProfile(id);
      setDatasetProfile(prof);
      return prof;
    } catch (err) {
      console.error('Failed to load dataset profile:', err);
      return null;
    } finally {
      setLoadingDataset(false);
    }
  };

  const handleSelectDatasetAndNavigate = async (datasetId: number, targetMethod?: string) => {
    setActiveDatasetId(datasetId);
    const prof = await fetchProfile(datasetId);
    if (prof) {
      if (targetMethod && ['linear_regression', 'decision_tree', 'kmeans', 'pca'].includes(targetMethod)) {
        setView(targetMethod as AppView);
      } else {
        setView('methods');
      }
    }
  };

  const handleNavigateToMethods = async (datasetId: number) => {
    setActiveDatasetId(datasetId);
    const prof = await fetchProfile(datasetId);
    if (prof) {
      setView('methods');
    }
  };

  const handleMarkMethodVisited = (method: string) => {
    setVisitedMethods(prev => {
      const next = new Set(prev);
      next.add(method);
      return next;
    });
  };
  const handleMarkMethodResolved = (method: string, succeeded: boolean) => {
    setResolvedMethods(prev => prev.has(method) ? prev : new Set([...prev, method]));
    if (succeeded) setCompletedMethods(prev => prev.has(method) ? prev : new Set([...prev, method]));
  };

  const currentMethodForNav = (
      view === 'linear_regression' || view === 'decision_tree' || view === 'kmeans' || view === 'pca'
      ? view
      : view === 'methods'
      ? 'selection'
      : 'home'
  );

  if (import.meta.env.DEV && window.location.pathname === '/__math-diagnostics') return <MathDiagnosticsPage />;

  return (
    <div className="min-h-screen bg-[#F4F3EF] text-[#292B32] flex flex-col font-sans selection:bg-[#DCEAF4] selection:text-[#1E3A8A]">
      {/* Educational Header Banner (Subtle Apple-style bar) */}
      <header className="sticky top-0 z-40 bg-[#FAFAF8]/80 backdrop-blur-md border-b border-[#292B32]/5 px-6 py-3 print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-[#292B32]">
                Smart Hostel Energy Advisor
              </span>
              <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#DCEAF4] text-[#1E3A8A]">
                AI & ML Educational Laboratory
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {datasetProfile && (
              <button
                onClick={() => setView('methods')}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#292B32]/10 text-xs font-semibold text-[#292B32] shadow-sm hover:bg-[#FAFAF8] flex items-center space-x-1.5 transition-all"
              >
                <Database className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span className="max-w-[150px] truncate">{datasetProfile.original_name}</span>
              </button>
            )}

            {view !== 'home' && (
              <button
                onClick={() => setView('home')}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#292B32]/10 text-xs font-semibold text-[#777985] hover:text-[#292B32] shadow-sm hover:bg-[#FAFAF8] flex items-center space-x-1.5 transition-all"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main View Port */}
      <main className="flex-1 pb-24 print:pb-0">
        {loadingDataset && (
          <div className="max-w-md mx-auto my-20 p-8 rounded-3xl bg-white shadow-sm border border-[#292B32]/5 text-center space-y-4">
            <div className="w-10 h-10 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-[#292B32]">Preparing Educational Dataset Laboratory...</p>
            <p className="text-xs text-[#777985]">Profiling telemetry data points and configuring Scikit-learn environment.</p>
          </div>
        )}

        {!loadingDataset && view === 'home' && (
          <HomeScreen
            onSelectDatasetAndNavigate={handleSelectDatasetAndNavigate}
            onNavigateToMethods={handleNavigateToMethods}
          />
        )}

        {!loadingDataset && view === 'methods' && activeDatasetId && datasetProfile && (
          <MethodSelectionPage
            datasetId={activeDatasetId}
            datasetName={datasetProfile.original_name}
            rowCount={datasetProfile.row_count}
            colCount={datasetProfile.col_count}
            targetColumn={datasetProfile.columns.find(column => column.is_target)?.name || null}
            visitedMethods={visitedMethods}
            completedMethods={completedMethods}
            resolvedMethods={resolvedMethods}
            onOpenFinalAnalysis={() => setView('final_analysis')}
            onSelectMethod={(method) => setView(method)}
            onChangeDataset={() => setView('home')}
          />
        )}

        {!loadingDataset && view === 'linear_regression' && activeDatasetId && datasetProfile && (
          <LinearRegressionWorkspace
            datasetId={activeDatasetId}
            datasetProfile={datasetProfile}
            onBackToMethods={() => setView('methods')}
            onMarkVisited={() => handleMarkMethodVisited('linear_regression')}
            onMarkResolved={(succeeded) => handleMarkMethodResolved('linear_regression', succeeded)}
          />
        )}

        {!loadingDataset && view === 'decision_tree' && activeDatasetId && datasetProfile && (
          <DecisionTreeWorkspace
            datasetId={activeDatasetId}
            datasetProfile={datasetProfile}
            onBackToMethods={() => setView('methods')}
            onMarkVisited={() => handleMarkMethodVisited('decision_tree')}
            onMarkResolved={(succeeded) => handleMarkMethodResolved('decision_tree', succeeded)}
          />
        )}

        {!loadingDataset && view === 'kmeans' && activeDatasetId && datasetProfile && (
          <KMeansWorkspace
            datasetId={activeDatasetId}
            datasetProfile={datasetProfile}
            onBackToMethods={() => setView('methods')}
            onMarkVisited={() => handleMarkMethodVisited('kmeans')}
            onMarkResolved={(succeeded) => handleMarkMethodResolved('kmeans', succeeded)}
          />
        )}

        {!loadingDataset && view === 'pca' && activeDatasetId && datasetProfile && (
          <PCAWorkspace
            datasetId={activeDatasetId}
            datasetProfile={datasetProfile}
            onBackToMethods={() => setView('methods')}
            onMarkVisited={() => handleMarkMethodVisited('pca')}
            onMarkResolved={(succeeded) => handleMarkMethodResolved('pca', succeeded)}
          />
        )}
        {!loadingDataset && view === 'final_analysis' && activeDatasetId && datasetProfile && resolvedMethods.size === 4 && (
          <FinalAIAnalysisPage datasetId={activeDatasetId} datasetProfile={datasetProfile} completedMethods={completedMethods} resolvedMethods={resolvedMethods} visitedMethods={visitedMethods} onBack={() => setView('methods')} onSelectMethod={method => setView(method)} />
        )}
      </main>

      {/* Floating Liquid-Glass Method Navigation Pill */}
      {view !== 'home' && (
        <FloatingMethodNav
          currentMethod={currentMethodForNav}
          visitedMethods={visitedMethods}
          completedMethods={completedMethods}
          resolvedMethods={resolvedMethods}
          onSelectMethod={(m) => setView(m)}
          onReturnToDashboard={() => setView('methods')}
          onOpenFinalAnalysis={resolvedMethods.size === 4 ? () => setView('final_analysis') : undefined}
        />
      )}
    </div>
  );
}
export default App;
