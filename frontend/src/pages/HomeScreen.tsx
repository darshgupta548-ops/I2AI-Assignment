import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  Database, 
  Sparkles, 
  ArrowRight, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  Sliders,
  TrendingUp,
  Network,
  BarChart2,
  BookOpen
} from 'lucide-react';
import { api, DatasetProfile, EducationalCatalog, ColumnProfile, COLUMN_TYPES, effectiveColumnType, FEATURE_COLUMN_TYPES, NUMERIC_COLUMN_TYPES } from '../services/api';

interface HomeScreenProps {
  onSelectDatasetAndNavigate: (datasetId: number, targetMethod?: string) => void;
  onNavigateToMethods: (datasetId: number) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectDatasetAndNavigate,
  onNavigateToMethods,
}) => {
  const [catalog, setCatalog] = useState<EducationalCatalog | null>(null);
  const [recentDatasets, setRecentDatasets] = useState<any[]>([]);
  const [selectedMethodTab, setSelectedMethodTab] = useState<'linear_regression' | 'decision_tree' | 'kmeans' | 'pca'>('linear_regression');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Upload state
  const [uploadedProfile, setUploadedProfile] = useState<DatasetProfile | null>(null);
  const [targetCol, setTargetCol] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnProfile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load educational catalog and recent datasets
    api.getEducationalCatalog()
      .then(setCatalog)
      .catch(console.error);
    api.getDatasets()
      .then(setRecentDatasets)
      .catch(console.error);
  }, []);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const profile = await api.uploadDataset(file);
      setUploadedProfile(profile);
      setColumns(profile.columns);
      const initialTarget = profile.potential_targets[0] || null;
      setTargetCol(initialTarget);
      // Refresh recent list
      api.getDatasets().then(setRecentDatasets).catch(console.error);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse CSV dataset.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleLoadEducational = async (method: string, id: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const profile = await api.loadEducationalDataset(method, id);
      onSelectDatasetAndNavigate(profile.dataset_id, method);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load educational dataset.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCustomUpload = async () => {
    if (!uploadedProfile) return;
    setLoading(true);
    try {
      const payload = columns.map(c => ({
        name: c.name,
        selected_type: c.selected_type ?? '',
        custom_meaning: c.custom_meaning,
        unit: c.unit,
        is_target: c.name === targetCol,
        is_feature: c.name !== targetCol && FEATURE_COLUMN_TYPES.includes(effectiveColumnType(c)),
        is_excluded: !FEATURE_COLUMN_TYPES.includes(effectiveColumnType(c)),
        exclusion_reason: !FEATURE_COLUMN_TYPES.includes(effectiveColumnType(c)) ? `Excluded by selected type: ${effectiveColumnType(c)}` : ''
      }));
      await api.configureDataset(uploadedProfile.dataset_id, targetCol, payload);
      onNavigateToMethods(uploadedProfile.dataset_id);
    } catch (err: any) {
      setErrorMsg('Failed to save configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSavedDataset = async (datasetId: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const profile = await api.getDatasetProfile(datasetId);
      setUploadedProfile(profile);
      setColumns(profile.columns);
      setTargetCol(profile.columns.find(c => c.is_target)?.name || profile.potential_targets[0] || null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not load this dataset profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Editorial Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full liquid-glass text-xs font-semibold text-[#292B32]">
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span>Interactive Machine Learning Laboratory</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#292B32] leading-tight">
          Let’s understand how machines learn.
        </h1>
        <p className="text-base sm:text-lg text-[#777985] font-normal leading-relaxed">
          Explore four machine learning methods through real datasets, interactive demonstrations, mathematical explanations, and visual experiments.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2.5 max-w-2xl mx-auto">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TWO PRIMARY ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ACTION A: Upload Your Dataset */}
        <div className="lg:col-span-5 clay-card p-8 space-y-6">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-600 font-bold block">
              ACTION 01 · EXPERIMENT WITH YOUR DATA
            </span>
            <h2 className="text-xl font-bold text-[#292B32]">Upload Your Dataset</h2>
            <p className="text-xs text-[#777985]">
              Upload any energy or scientific CSV. The engine automatically adapts to delimiters, thousands separators, and column structures.
            </p>
          </div>

          {!uploadedProfile ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="clay-inset p-8 text-center flex flex-col items-center justify-center space-y-4 cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-14 h-14 rounded-2xl clay-surface flex items-center justify-center text-blue-600">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#292B32]">Drag & drop your CSV here</p>
                <p className="text-xs text-[#777985] mt-0.5">Supports comma, semicolon, tab, and European decimals</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                accept=".csv,.txt"
                className="hidden"
              />
              <button
                type="button"
                className="clay-button px-4 py-2 text-xs text-blue-600"
              >
                Browse CSV File
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 truncate max-w-[200px]">{uploadedProfile.original_name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-200/60 text-blue-800">
                    {uploadedProfile.row_count} rows × {uploadedProfile.col_count} cols
                  </span>
                </div>
                <div className="text-[11px] text-blue-700/80">
                  Data Quality: <span className="font-semibold">{uploadedProfile.data_quality_score}/100</span> · Delimiter: '{uploadedProfile.delimiter}'
                </div>
              </div>

              <div className="space-y-2">
                <div><h3 className="text-xs font-bold text-[#292B32]">Review inferred column types</h3><p className="text-[11px] text-[#777985]">Inferred types are automatic. Use the second selector to override a type; choices persist with this dataset.</p></div>
                <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[680px] text-left text-[10px]"><thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="p-2">Column</th><th className="p-2">Inferred type</th><th className="p-2">User-selected type</th><th className="p-2">Missing / unique</th><th className="p-2">Examples</th></tr></thead><tbody>{columns.map(c => <tr key={c.name} className="border-t border-slate-100"><td className="p-2 font-medium text-slate-800">{c.name}</td><td className="p-2 text-slate-600">{c.inferred_type.replaceAll('_', ' ')}</td><td className="p-2"><select aria-label={`Type override for ${c.name}`} value={c.selected_type || ''} onChange={e => { const selected = e.target.value; setColumns(prev => prev.map(col => col.name === c.name ? { ...col, selected_type: selected || null } : col)); }} className="max-w-[190px] rounded border border-slate-300 bg-white px-2 py-1"><option value="">Use inferred</option>{COLUMN_TYPES.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></td><td className="p-2 text-slate-600">{c.missing_count} / {c.unique_count}</td><td className="p-2 text-slate-600">{c.sample_values.slice(0, 3).map(String).join(', ')}</td></tr>)}</tbody></table>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-600">Eligible numerical predictors: {columns.filter(c => NUMERIC_COLUMN_TYPES.includes(effectiveColumnType(c))).length} · Categorical fields for supervised encoding: {columns.filter(c => effectiveColumnType(c) === 'categorical').length}</div>
              </div>

              {/* Quick Target Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#292B32] block">Select Target Column (for Supervised Learning):</label>
                <select
                  value={targetCol || ''}
                  onChange={(e) => setTargetCol(e.target.value)}
                  className="w-full clay-inset px-3 py-2 text-xs text-[#292B32] font-mono focus:outline-none"
                >
                  <option value="">-- No Target (Pure Unsupervised) --</option>
                  {columns.filter(c => ['continuous_numerical', 'discrete_numerical', 'binary', 'categorical'].includes(effectiveColumnType(c))).map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.inferred_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={handleConfirmCustomUpload}
                  disabled={loading}
                  className="flex-1 clay-button-primary py-3 text-xs flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Proceed to 4 Algorithms</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setUploadedProfile(null); setColumns([]); setTargetCol(null); }}
                  className="clay-button px-3 py-3 text-xs text-[#777985]"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          {/* Quick links to recent uploads */}
          {recentDatasets.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200/80">
              <span className="text-[11px] font-semibold text-[#777985] block uppercase font-mono">
                Recent Saved Datasets
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {recentDatasets.slice(0, 4).map(ds => (
                  <div
                    key={ds.id}
                    onClick={() => void handleReviewSavedDataset(ds.id)}
                    className="p-2.5 rounded-xl hover:bg-slate-100 flex items-center justify-between text-xs cursor-pointer transition-colors"
                  >
                    <div className="truncate max-w-[220px]">
                      <span className="font-medium text-[#292B32] block truncate">{ds.original_name}</span>
                      <span className="text-[10px] text-[#777985] font-mono">{ds.row_count} rows · {ds.col_count} cols</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#777985]" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ACTION B: Explore Educational Datasets Library */}
        <div className="lg:col-span-7 clay-card p-8 space-y-6">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-600 font-bold block">
              ACTION 02 · 2 SHARED HOSTEL DATASETS
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-xl font-bold text-[#292B32]">Explore Educational Datasets</h2>
              <span className="text-xs text-[#777985] font-mono">Shared Across All Four Methods</span>
            </div>
            <p className="text-xs text-[#777985]">
              Explore the same hostel energy datasets with each of the four methods, then compare their results.
            </p>
          </div>

          {/* Method Filter Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'linear_regression', label: 'Linear Reg', icon: TrendingUp, color: 'text-blue-600 bg-blue-50 border-blue-200' },
              { id: 'decision_tree', label: 'Decision Tree', icon: Layers, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              { id: 'kmeans', label: 'K-Means', icon: Network, color: 'text-amber-600 bg-amber-50 border-amber-200' },
              { id: 'pca', label: 'PCA', icon: BarChart2, color: 'text-purple-600 bg-purple-50 border-purple-200' },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = selectedMethodTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedMethodTab(tab.id as any)}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    isActive 
                      ? `${tab.color} border shadow-sm` 
                      : 'clay-surface text-[#777985] hover:text-[#292B32]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Educational Dataset Cards Grid */}
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {catalog && catalog[selectedMethodTab] ? (
              catalog[selectedMethodTab].map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => handleLoadEducational(selectedMethodTab, item.id)}
                  className="p-4 rounded-2xl clay-surface hover:border-slate-300 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-slate-400">0{idx + 1}</span>
                      <h4 className="text-sm font-semibold text-[#292B32] group-hover:text-blue-600 transition-colors">
                        {item.name}
                      </h4>
                    </div>
                    <p className="text-xs text-[#777985] line-clamp-1">{item.context}</p>
                    <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-500">
                      <span>&middot;</span>
                      <span>·</span>
                      <span>Target: {item.target_column || 'Unsupervised'}</span>
                    </div>
                  </div>

                  <div className="flex items-center self-end sm:self-center">
                    <span className="text-xs font-semibold text-blue-600 font-mono group-hover:translate-x-1 transition-transform flex items-center space-x-1">
                      <span>Load & Explore</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-[#777985]">Loading educational catalog...</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
