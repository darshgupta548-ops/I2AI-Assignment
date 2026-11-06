import React, { useMemo, useState } from 'react';

type ProjectedPoint = { id: number; pc1: number; pc2?: number; pc3?: number };

export function PCA3DProjection({ points }: { points: ProjectedPoint[] }) {
  const [azimuth, setAzimuth] = useState(38);
  const [elevation, setElevation] = useState(25);
  const projected = useMemo(() => {
    const a = azimuth * Math.PI / 180, e = elevation * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e);
    const values = points.filter(p => Number.isFinite(p.pc1) && Number.isFinite(p.pc2) && Number.isFinite(p.pc3)).map(p => {
      const x = p.pc1 * ca - p.pc2! * sa;
      const y = p.pc1 * sa * se + p.pc2! * ca * se - p.pc3! * ce;
      const z = p.pc1 * sa * ce + p.pc2! * ca * ce + p.pc3! * se;
      return { ...p, px: x, py: y, depth: z };
    });
    if (!values.length) return { points: [], axes: [] as { id: string; x: number; y: number; color: string }[] };
    const maxX = Math.max(1, ...values.map(p => Math.abs(p.px))), maxY = Math.max(1, ...values.map(p => Math.abs(p.py)));
    const axes = [
      { id: 'PC1', x: ca, y: sa * se, color: '#2563eb' },
      { id: 'PC2', x: -sa, y: ca * se, color: '#059669' },
      { id: 'PC3', x: 0, y: -ce, color: '#7c3aed' },
    ].map(axis => ({ ...axis, x: 400 + axis.x / maxX * 330, y: 220 - axis.y / maxY * 175 }));
    return { points: values.map(p => ({ ...p, sx: 400 + p.px / maxX * 330, sy: 220 - p.py / maxY * 175 })), axes };
  }, [points, azimuth, elevation]);
  return <section className="space-y-3">
    <div><h4 className="font-semibold text-sm">Three-component PCA projection</h4><p className="text-xs text-slate-600">Each point is a real observation projected onto PC1, PC2, and PC3; drag the controls to change the viewing angle.</p></div>
    <div className="rounded-2xl bg-white/80 p-3 overflow-hidden">
      <svg viewBox="0 0 800 460" className="w-full h-auto" role="img" aria-label="Three component PCA projection">
        {projected.axes.map(axis=><g key={axis.id}><path d={`M400 220 L${axis.x} ${axis.y}`} stroke={axis.color} strokeWidth="2"/><text x={axis.x+5} y={axis.y+5} fontSize="12" fill={axis.color}>{axis.id}</text></g>)}
        {[...projected.points].sort((a,b) => a.depth-b.depth).map(p => <circle key={p.id} cx={p.sx} cy={p.sy} r="4" fill={`hsl(${250 + 70 * (p.pc3! / Math.max(1, ...projected.points.map(q => Math.abs(q.pc3!))))}, 62%, 54%)`} fillOpacity=".72"><title>{`Observation ${p.id} · PC1 ${p.pc1} · PC2 ${p.pc2} · PC3 ${p.pc3}`}</title></circle>)}
      </svg>
      <div className="grid sm:grid-cols-2 gap-4 px-2 pb-2 text-xs"><label>Azimuth {azimuth}°<input className="w-full" type="range" min="0" max="360" value={azimuth} onChange={e=>setAzimuth(Number(e.target.value))}/></label><label>Elevation {elevation}°<input className="w-full" type="range" min="-80" max="80" value={elevation} onChange={e=>setElevation(Number(e.target.value))}/></label></div>
    </div>
  </section>;
}
