from __future__ import annotations

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


def build_direct_observations(df: pd.DataFrame, target_col: Optional[str] = None) -> List[Dict[str, Any]]:
    """Calculate a small set of transparent record-level facts for the report."""
    observations: List[Dict[str, Any]] = []
    numeric = pd.DataFrame(index=df.index)
    for col in df.columns:
        values = pd.to_numeric(df[col], errors="coerce").replace([np.inf, -np.inf], np.nan)
        if values.notna().sum() >= 2 and values.nunique(dropna=True) > 1:
            numeric[col] = values

    if target_col and target_col in numeric:
        vals = numeric[target_col].dropna()
        if len(vals):
            observations.append({
                "kind": "target_summary", "column": target_col, "count": int(len(vals)),
                "missing_count": int(df[target_col].isna().sum()), "minimum": float(vals.min()),
                "median": float(vals.median()), "maximum": float(vals.max()), "mean": float(vals.mean()),
                "standard_deviation": float(vals.std(ddof=1)) if len(vals) > 1 else 0.0,
                "evidence_level": "direct_observation"
            })

    if target_col and target_col in numeric:
        target = numeric[target_col]
        # Time breakdowns only when real date-like values parse on most records.
        for col in df.columns:
            lname = str(col).lower()
            if not any(token in lname for token in ("date", "time", "timestamp")):
                continue
            parsed = pd.to_datetime(df[col], errors="coerce", format="mixed", utc=True)
            if parsed.notna().sum() < max(2, int(len(df) * 0.8)) or parsed.dt.strftime("%Y-%m").nunique() < 2:
                continue
            grouped = pd.DataFrame({"period": parsed.dt.strftime("%Y-%m"), "target": target}).dropna().groupby("period")["target"].agg(["mean", "count"]).reset_index()
            if len(grouped) >= 2:
                low, high = grouped.loc[grouped["mean"].idxmin()], grouped.loc[grouped["mean"].idxmax()]
                observations.append({"kind": "period_comparison", "column": target_col, "time_column": col,
                                     "low_period": str(low["period"]), "low_mean": float(low["mean"]), "low_count": int(low["count"]),
                                     "high_period": str(high["period"]), "high_mean": float(high["mean"]), "high_count": int(high["count"]),
                                     "evidence_level": "direct_observation"})
            break

        # Compare actual groups only where a plausible categorical grouping exists.
        for col in df.columns:
            if col == target_col:
                continue
            lname = str(col).lower()
            if not any(token in lname for token in ("block", "hostel", "building", "wing", "location")):
                continue
            levels = df[col].nunique(dropna=True)
            if levels < 2 or levels > 20:
                continue
            grouped = pd.DataFrame({"group": df[col].astype("string"), "target": target}).dropna().groupby("group")["target"].agg(["mean", "count"]).reset_index()
            if len(grouped) >= 2:
                low, high = grouped.loc[grouped["mean"].idxmin()], grouped.loc[grouped["mean"].idxmax()]
                observations.append({"kind": "group_comparison", "column": target_col, "group_column": col,
                                     "low_group": str(low["group"]), "low_mean": float(low["mean"]), "low_count": int(low["count"]),
                                     "high_group": str(high["group"]), "high_mean": float(high["mean"]), "high_count": int(high["count"]),
                                     "evidence_level": "direct_observation"})
            break

        correlations = []
        for col in numeric.columns:
            if col == target_col:
                continue
            paired = pd.concat([numeric[col], target], axis=1).dropna()
            if len(paired) >= 10:
                corr = paired.iloc[:, 0].corr(paired.iloc[:, 1])
                if pd.notna(corr):
                    correlations.append((col, float(corr), int(len(paired))))
        for col, corr, count in sorted(correlations, key=lambda x: abs(x[1]), reverse=True)[:3]:
            observations.append({"kind": "observed_association", "column": target_col, "feature": col,
                                 "correlation": corr, "count": count, "evidence_level": "direct_observation",
                                 "limitation": "An observed correlation is not evidence of cause."})

    missing = []
    for col in df.columns:
        count = int(df[col].isna().sum())
        if count:
            missing.append({"column": str(col), "missing_count": count, "missing_percentage": round(count / max(len(df), 1) * 100, 2)})
    for item in sorted(missing, key=lambda row: row["missing_count"], reverse=True)[:5]:
        observations.append({"kind": "missingness", **item, "evidence_level": "direct_observation"})

    for col in df.columns:
        lname = str(col).lower()
        if not any(token in lname for token in ("flag", "downtime", "outage")):
            continue
        values = df[col].dropna()
        if values.nunique() == 2:
            counts = values.astype(str).value_counts()
            observations.append({"kind": "binary_event_count", "column": str(col),
                                 "level_counts": [{"value": key, "count": int(value)} for key, value in counts.items()],
                                 "evidence_level": "direct_observation"})
    return observations
