import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle, 
  Sliders, 
  Check, 
  X, 
  ArrowRight, 
  Sparkles,
  Info,
  ShieldAlert,
  Save,
  HelpCircle
} from 'lucide-react';
import { api, DatasetProfile, ColumnProfile, COLUMN_TYPES, effectiveColumnType, FEATURE_COLUMN_TYPES } from '../services/api';

interface UploadProps {
  onDatasetLoaded: (datasetId: number) => void;
  onProceedToReadiness: (datasetId: number) => void;
}

export const DatasetUploadPage: React.FC<UploadProps> = ({ 
  onDatasetLoaded, 
  onProceedToReadiness 
}) => {
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [targetCol, setTargetCol] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnProfile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFile = async (file: File) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.uploadDataset(file);
      setProfile(data);
      setColumns(data.columns);
      const initialTarget = data.potential_targets[0] || null;
      setTargetCol(initialTarget);
      onDatasetLoaded(data.dataset_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload and parse CSV.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = async (type: 'gujarat' | 'himalayan' | 'campus_original') => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.loadSample(type);
      setProfile(data);
      setColumns(data.columns);
      const initialTarget = data.potential_targets[0] || null;
      setTargetCol(initialTarget);
      onDatasetLoaded(data.dataset_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load sample dataset.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const updateColumnConfig = (colName: string, updates: Partial<ColumnProfile>) => {
    setColumns(prev => prev.map(c => c.name === colName ? { ...c, ...updates } : c));
  };

  const handleSaveConfiguration = async () => {
    if (!profile) return;
    setSavingConfig(true);
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
      await api.configureDataset(profile.dataset_id, targetCol, payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setErrorMsg('Failed to persist column configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  const commonUnits = ['kWh', 'kW', 'kVARh', '°C', '%', 'hours', 'occupants', 'currency', 'unitless'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Dataset Ingestion & Adaptive Profiler
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Universal delimiter sniffer, schema auto-detection, and contextual engineering units configuration.
          </p>
        </div>
      </div>

      {/* Error Message Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Dropzone & Sample Loaders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload Dropzone */}
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="lg:col-span-8 p-8 rounded-2xl border-2 border-dashed border-slate-800 hover:border-cyan-600/80 bg-slate-900/40 transition-colors text-center flex flex-col items-center justify-center space-y-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Drag and Drop Your Energy CSV</h3>
            <p className="text-xs text-slate-400 mt-1">
              Supports comma (,), semicolon (;), or tab-delimited files. Auto-detects decimal formats.
            </p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
            accept=".csv,.txt"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Analyzing Telemetry...' : 'Browse CSV File'}
          </button>
        </div>

        {/* Quick Sample Selector */}
        <div className="lg:col-span-4 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>TEST ADAPTIVE SCHEMAS</span>
            </div>
            <h3 className="text-sm font-semibold text-white">Load Demonstration Datasets</h3>
            <p className="text-xs text-slate-400 mt-1">
              Demonstrate the application immediately with disparate climatic and sensor schemas.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => handleLoadSample('gujarat')}
              disabled={loading}
              className="w-full text-left p-3 rounded-xl bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-700/60 transition-all text-xs group cursor-pointer"
            >
              <div className="font-semibold text-white group-hover:text-cyan-300">Gujarat Solar Campus</div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">Hot climate · Solar PV · AC hours · Grid import</div>
            </button>

            <button
              onClick={() => handleLoadSample('himalayan')}
              disabled={loading}
              className="w-full text-left p-3 rounded-xl bg-slate-950/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-700/60 transition-all text-xs group cursor-pointer"
            >
              <div className="font-semibold text-white group-hover:text-emerald-300">Himalayan Thermal Campus</div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">Sub-zero climate · Space heating · Geysers · Batteries</div>
            </button>

            <button
              onClick={() => handleLoadSample('campus_original')}
              disabled={loading}
              className="w-full text-left p-3 rounded-xl bg-slate-950/80 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-700/60 transition-all text-xs group cursor-pointer"
            >
              <div className="font-semibold text-white group-hover:text-amber-300">Campus DATA_170225.csv</div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">Semicolon-separated · European Decimals · Sub-metering</div>
            </button>
          </div>
        </div>
      </div>

      {/* Profiler Results Section */}
      {profile && (
        <div className="space-y-8 animate-fadeIn">
          {/* Metadata & Data Quality Scorecard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Dimensions Card */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <span className="text-xs font-mono text-cyan-400">FILE METADATA</span>
              <h3 className="text-base font-semibold text-white truncate">{profile.original_name}</h3>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block">OBSERVATIONS</span>
                  <span className="text-sm font-bold text-white">{profile.row_count} rows</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block">FEATURES</span>
                  <span className="text-sm font-bold text-white">{profile.col_count} columns</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Detected Delimiter: <span className="text-cyan-300 px-1.5 py-0.5 bg-slate-950 rounded">'{profile.delimiter}'</span>
              </div>
            </div>

            {/* Data Quality Score Card */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-emerald-400">DATA INTEGRITY SCORE</span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                  profile.data_quality_score >= 80 ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
                }`}>
                  {profile.data_quality_score >= 80 ? 'HIGH QUALITY' : 'MODERATE QUALITY'}
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold font-mono text-white">{profile.data_quality_score}</span>
                <span className="text-slate-500 text-sm">/ 100</span>
              </div>
              <p className="text-xs text-slate-400">
                Calculated across missing value penalties, sample size ratio, and column variability.
              </p>
            </div>

            {/* Target Variable Selector Card */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <span className="text-xs font-mono text-cyan-400 flex items-center space-x-1">
                <span>ANALYSIS TARGET VARIABLE</span>
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              </span>
              <p className="text-xs text-slate-400">
                Select the continuous variable to predict in Linear Regression & Decision Tree:
              </p>
              <select
                value={targetCol || ''}
                onChange={(e) => setTargetCol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="">-- No Target (Pure Unsupervised Analysis) --</option>
                {columns
                  .filter(c => ['continuous_numerical', 'discrete_numerical', 'binary'].includes(effectiveColumnType(c)))
                  .map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.unit || 'unitless'}) {profile.potential_targets.includes(c.name) ? '★ Suggested' : ''}
                    </option>
                  ))}
              </select>
              <div className="text-[11px] text-slate-400">
                Unsupervised models (K-Means, PCA) will run regardless of target selection.
              </div>
            </div>

          </div>

          {/* Quality Indicators Breakdown */}
          <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <h4 className="text-xs font-mono uppercase text-slate-400">Data Quality Diagnostic Checkpoints</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {profile.data_quality_indicators.map((ind, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-300 capitalize">{ind.category.replace('_', ' ')}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      ind.status === 'PASS' ? 'bg-emerald-950 text-emerald-400' : (ind.status === 'WARNING' ? 'bg-amber-950 text-amber-400' : 'bg-rose-950 text-rose-400')
                    }`}>
                      {ind.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">{ind.details}</p>
                </div>
              ))}
            </div>
          </div>

          {/* High Correlation Alert if present */}
          {profile.high_correlation_pairs.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-300 text-xs space-y-2">
              <div className="flex items-center space-x-2 font-semibold">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Multicollinearity Alert (|r| ≥ 0.85 Detected)</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                {profile.high_correlation_pairs.map((pair, idx) => (
                  <span key={idx} className="px-2 py-1 rounded bg-amber-950/80 border border-amber-800/80">
                    {pair.col1} ↔ {pair.col2} (r = {pair.correlation})
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-amber-400/80">
                Highly correlated features may cause collinear variance inflation in Linear Regression. PCA will gracefully collapse these into shared orthogonal components.
              </p>
            </div>
          )}

          {/* First 10 Rows Data Preview */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white font-mono flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
              <span>Dataset Preview (First 10 Observations)</span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-slate-500">#</th>
                    {columns.map(c => (
                      <th key={c.name} className="px-3 py-2 whitespace-nowrap">
                        {c.name}
                        {c.unit && <span className="text-slate-500 font-normal ml-1">({c.unit})</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {profile.preview_rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-900/40">
                      <td className="px-3 py-1.5 text-slate-600">{rIdx + 1}</td>
                      {columns.map(c => (
                        <td key={c.name} className="px-3 py-1.5 whitespace-nowrap">
                          {row[c.name] !== null && row[c.name] !== undefined ? String(row[c.name]) : <span className="text-rose-400 italic">null</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Column Mapper & Units Configuration */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white font-mono flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>Interactive Column Role & Unit Mapper</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Never assume a column means kWh without confirmation. Clarify meanings, units, and feature exclusion.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleSaveConfiguration}
                  disabled={savingConfig}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingConfig ? 'Saving...' : (saveSuccess ? 'Saved!' : 'Save Configuration')}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Column Name</th>
                    <th className="px-3 py-2.5">Inferred / Selected Type</th>
                    <th className="px-3 py-2.5">Custom Meaning</th>
                    <th className="px-3 py-2.5">Physical Unit</th>
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5">Distribution (Min / Mean / Max)</th>
                    <th className="px-3 py-2.5">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {columns.map(c => {
                    const isTarget = c.name === targetCol;
                    return (
                      <tr key={c.name} className={`${isTarget ? 'bg-cyan-950/20' : ''} hover:bg-slate-900/30`}>
                        {/* Column Name */}
                        <td className="px-3 py-2 font-medium text-white whitespace-nowrap">
                          {c.name}
                        </td>

                        {/* Inferred Type */}
                        <td className="px-3 py-2 space-y-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono block w-fit ${
                            c.inferred_type === 'numerical' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/40' :
                            (c.inferred_type === 'categorical' ? 'bg-purple-950 text-purple-300 border border-purple-800/40' :
                            (c.inferred_type === 'datetime' ? 'bg-blue-950 text-blue-300 border border-blue-800/40' : 'bg-slate-800 text-slate-400'))
                          }`}>
                            {c.inferred_type}
                          </span>
                          <select aria-label={`Type override for ${c.name}`} value={c.selected_type || ''} onChange={e => updateColumnConfig(c.name, { selected_type: e.target.value || null })} className="max-w-40 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-300">
                            <option value="">Use inferred</option>{COLUMN_TYPES.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
                          </select>
                          <span className="block text-[9px] text-slate-500">Selected: {effectiveColumnType(c).replaceAll('_', ' ')}</span>
                        </td>

                        {/* Custom Meaning Input */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={c.custom_meaning || ''}
                            onChange={(e) => updateColumnConfig(c.name, { custom_meaning: e.target.value })}
                            placeholder="Describe parameter"
                            className="w-48 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-600"
                          />
                        </td>

                        {/* Physical Unit Select */}
                        <td className="px-3 py-2">
                          <select
                            value={c.unit || 'unitless'}
                            onChange={(e) => updateColumnConfig(c.name, { unit: e.target.value })}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-600"
                          >
                            {commonUnits.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>

                        {/* Role Radio / Checkboxes */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setTargetCol(isTarget ? null : c.name)}
                              className={`px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                                isTarget 
                                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold' 
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {isTarget ? '★ Target' : 'Set Target'}
                            </button>

                            <button
                              type="button"
                              onClick={() => updateColumnConfig(c.name, { is_excluded: !c.is_excluded })}
                              className={`px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                                c.is_excluded
                                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {c.is_excluded ? 'Excluded' : 'Include'}
                            </button>
                          </div>
                        </td>

                        {/* Distribution Stats */}
                        <td className="px-3 py-2 text-slate-400 text-[11px] whitespace-nowrap">
                          {c.min_val !== null && c.max_val !== null ? (
                            <span>{c.min_val} / {c.mean_val?.toFixed(1)} / {c.max_val}</span>
                          ) : (
                            <span className="text-slate-600">{c.unique_count} distinct levels</span>
                          )}
                        </td>

                        {/* Missing % */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`${c.missing_percentage > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                            {c.missing_percentage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Bar: Proceed to Model Readiness Assessment */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Dataset Configuration Complete</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Target designated: <span className="font-mono text-cyan-300">{targetCol || 'None (Unsupervised only)'}</span>
              </p>
            </div>
            <button
              onClick={() => onProceedToReadiness(profile.dataset_id)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-2 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              <span>Assess Model Readiness</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
