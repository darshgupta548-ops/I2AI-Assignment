import React from 'react';

export function finiteChartRows<T extends Record<string, unknown>>(rows: unknown, numericKeys: (keyof T)[]): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is T => !!row && typeof row === 'object' && numericKeys.every(key => {
    const value = (row as Record<string, unknown>)[String(key)];
    return typeof value === 'number' && Number.isFinite(value);
  }));
}

export function GraphEmptyState({ message, loading = false }: { message: string; loading?: boolean }) {
  return <div className="h-full min-h-36 flex items-center justify-center text-center text-xs text-slate-500 px-5" role={loading ? 'status' : undefined}>{message}</div>;
}
