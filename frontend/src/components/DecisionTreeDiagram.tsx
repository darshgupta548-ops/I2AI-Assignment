import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, Maximize2, Crosshair } from 'lucide-react';

type TreeNode = {
  id: number; parent_id: number | null; left_child_id: number | null; right_child_id: number | null;
  depth: number; feature: string | null; threshold: number | null; sample_count: number;
  impurity: number; predicted_value: string | number; class_distribution: number[];
  is_leaf: boolean;
};

type TreeObservation = { id: number; path_node_ids: number[]; feature_values: Record<string, number>; actual_value: string | number; predicted_value: string | number };

export function DecisionTreeDiagram({ nodes, observations = [] }: { nodes: TreeNode[]; observations?: TreeObservation[] }) {
  const [selected, setSelected] = useState<number | null>(nodes[0]?.id ?? null);
  const [selectedObservationId, setSelectedObservationId] = useState<number | null>(observations[0]?.id ?? null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const autoCollapsed = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(900);
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => setViewportWidth(entries[0]?.contentRect.width || 900));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!autoCollapsed.current && nodes.length) {
      setCollapsed(new Set(nodes.filter(n => n.depth >= 2 && !n.is_leaf).map(n => n.id)));
      autoCollapsed.current = true;
    }
  }, [nodes]);
  const layout = useMemo(() => {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const root = nodes.find(n => n.parent_id === null);
    if (!root) return { points: [] as { node: TreeNode; x: number; y: number }[], edges: [] as { from: number; to: number; left: boolean }[] };
    let leafOrder = 0;
    const points: { node: TreeNode; x: number; y: number }[] = [];
    const edges: { from: number; to: number; left: boolean }[] = [];
    const walk = (id: number): number => {
      const node = byId.get(id)!;
      const childIds = collapsed.has(id) ? [] : [node.left_child_id, node.right_child_id].filter((v): v is number => v !== null);
      let x: number;
      if (!childIds.length) x = 100 + leafOrder++ * 190;
      else {
        const childX = childIds.map(child => { edges.push({ from: id, to: child, left: child === node.left_child_id }); return walk(child); });
        x = childX.reduce((a, b) => a + b, 0) / childX.length;
      }
      points.push({ node, x, y: 80 + node.depth * 155 });
      return x;
    };
    walk(root.id);
    return { points, edges };
  }, [nodes, collapsed]);
  if (!nodes.length) return <p className="text-sm text-slate-500">The model did not return its tree structure.</p>;
  const width = Math.max(760, ...layout.points.map(p => p.x + 170));
  const height = Math.max(220, ...layout.points.map(p => p.y + 130));
  const fitZoom = Math.min(1, Math.max(0.28, (viewportWidth - 28) / width));
  const renderZoom = fitZoom * zoom;
  const selectedNode = nodes.find(n => n.id === selected);
  const selectedObservation = observations.find(o => o.id === selectedObservationId);
  const pathIds = new Set<number>(selectedObservation?.path_node_ids ?? []);
  if (!selectedObservation) {
    let cursor = selectedNode;
    while (cursor) { pathIds.add(cursor.id); cursor = cursor.parent_id === null ? undefined : nodes.find(n => n.id === cursor!.parent_id); }
  }
  const pointById = new Map(layout.points.map(p => [p.node.id, p]));
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-600">Actual Scikit-learn tree · deeper splits start collapsed to keep the root and main branches readable. Expand nodes to inspect the complete fitted structure.</p>
      {observations.length > 0 && <label className="text-xs flex items-center gap-2">Test observation<select className="clay-inset rounded-lg px-2 py-1" value={selectedObservationId ?? ''} onChange={e => setSelectedObservationId(Number(e.target.value))}>{observations.map(o=><option key={o.id} value={o.id}>Row {o.id}</option>)}</select></label>}
      <div className="flex gap-2">
        <button className="clay-button p-2" title="Zoom out" onClick={() => setZoom(z => Math.max(.55, z - .15))}><Minus size={16}/></button>
        <button className="clay-button p-2" title="Zoom in" onClick={() => setZoom(z => Math.min(1.8, z + .15))}><Plus size={16}/></button>
        <button className="clay-button p-2" title="Fit tree to viewport" onClick={() => setZoom(1)}><Maximize2 size={16}/></button>
        <button className="clay-button p-2" title="Centre tree" onClick={() => { if (viewportRef.current) { viewportRef.current.scrollTop = 0; viewportRef.current.scrollLeft = Math.max(0, (viewportRef.current.scrollWidth - viewportRef.current.clientWidth) / 2); } }}><Crosshair size={16}/></button>
        <button className="clay-button p-2" title="Expand all and reset zoom" onClick={() => { setZoom(1); setCollapsed(new Set()); }}><RotateCcw size={16}/></button>
      </div>
    </div>
    <div ref={viewportRef} className="overflow-auto rounded-2xl clay-inset p-3" style={{ maxHeight: 570, touchAction: 'pan-x pan-y' }}>
      <svg width={width * renderZoom} height={height * renderZoom} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Hierarchical decision tree" preserveAspectRatio="xMidYMin meet">
        {layout.edges.map(e => { const a = pointById.get(e.from)!, b = pointById.get(e.to)!; const active = pathIds.has(e.from) && pathIds.has(e.to); return <g key={`${e.from}-${e.to}`}><path d={`M ${a.x+72} ${a.y+96} C ${a.x+72} ${a.y+130}, ${b.x+72} ${b.y-35}, ${b.x+72} ${b.y}`} fill="none" stroke={active ? '#059669' : '#a7b6ae'} strokeWidth={active ? 4 : 2.5}/><text x={(a.x+b.x+144)/2} y={(a.y+b.y+96)/2} textAnchor="middle" fontSize="12" fill="#475569">{e.left ? '≤' : '>'}</text></g>; })}
        {layout.points.map(({node:n,x,y}) => <g key={n.id} onClick={() => setSelected(n.id)} style={{ cursor:'pointer' }}>
          <rect x={x} y={y} width="146" height="96" rx="22" fill={n.is_leaf ? '#fff1d7' : '#dcefe6'} stroke={selected === n.id ? '#059669' : '#b8cfc4'} strokeWidth={selected === n.id ? 4 : 2} style={{ filter:'drop-shadow(0 5px 5px #22332222)' }}/>
          <text x={x+73} y={y+24} textAnchor="middle" fontSize="12" fontWeight="700" fill="#243b32">{n.is_leaf ? `Leaf ${n.id}` : `${n.feature} ≤ ${n.threshold}`}</text>
          <text x={x+73} y={y+48} textAnchor="middle" fontSize="11" fill="#40554c">n = {n.sample_count} · impurity {n.impurity}</text>
          <text x={x+73} y={y+70} textAnchor="middle" fontSize="11" fill="#40554c">Predict: {String(n.predicted_value).slice(0,15)}</text>
          {!n.is_leaf && <g onClick={ev => { ev.stopPropagation(); setCollapsed(old => { const next = new Set(old); next.has(n.id) ? next.delete(n.id) : next.add(n.id); return next; }); }}><circle cx={x+134} cy={y+10} r="13" fill="#fff" stroke="#9ab5a7"/><text x={x+134} y={y+14} textAnchor="middle" fontSize="13">{collapsed.has(n.id) ? '+' : '−'}</text></g>}
        </g>)}
      </svg>
    </div>
    {selectedNode && <div className="clay-card p-4 text-sm grid grid-cols-2 md:grid-cols-4 gap-3">
      <div><b>Node {selectedNode.id}</b><p>Depth {selectedNode.depth}</p></div>
      <div><b>{selectedNode.is_leaf ? 'Leaf prediction' : 'Split feature'}</b><p>{selectedNode.feature ?? 'Terminal node'}</p><p>{selectedNode.threshold !== null ? `≤ ${selectedNode.threshold}` : ''}</p></div>
      <div><b>Samples / impurity</b><p>{selectedNode.sample_count} / {selectedNode.impurity}</p></div>
      <div><b>Prediction</b><p>{String(selectedNode.predicted_value)}</p>{selectedNode.class_distribution.length > 0 && <p>Class counts: {selectedNode.class_distribution.join(', ')}</p>}</div>
    </div>}
    {selectedObservation && <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs grid md:grid-cols-3 gap-3"><p><b>Selected test row {selectedObservation.id}</b><br/>Actual: {selectedObservation.actual_value}<br/>Tree prediction: {selectedObservation.predicted_value}</p><p><b>Values used by the fitted tree</b><br/>{Object.entries(selectedObservation.feature_values).slice(0,6).map(([name,value])=><span className="block" key={name}>{name}: {value}</span>)}</p><p><b>Highlighted route</b><br/>{selectedObservation.path_node_ids.join(' → ')}</p></div>}
  </section>;
}
