import os
import re
import csv
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple
from pathlib import Path

def sniff_delimiter_and_decimal(filepath: Path) -> Tuple[str, str]:
    """
    Intelligently sniffs the CSV delimiter (',', ';', '\t', '|') and 
    whether decimals are formatted as commas (e.g. '1,53') or periods ('1.53').
    """
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        sample_lines = [f.readline() for _ in range(25)]
        sample_text = "".join(sample_lines)

    # Sniff delimiter
    try:
        dialect = csv.Sniffer().sniff(sample_text, delimiters=";,|\t")
        delimiter = dialect.delimiter
    except Exception:
        # Fallback heuristic
        delimiters = [';', ',', '\t', '|']
        counts = {d: sample_text.count(d) for d in delimiters}
        delimiter = max(counts, key=counts.get) if counts else ','

    # Sniff decimal character
    # If commas are enclosed inside numbers like ' 1,53 ' or '418,2' and delimiter is ';', decimal is ','
    comma_as_decimal = False
    if delimiter != ',':
        if re.search(r'\d+,\d+', sample_text):
            comma_as_decimal = True
    else:
        # If delimiter is comma, check if numbers have commas or periods
        if re.search(r'\d+\.\d+', sample_text) and not re.search(r'"\d+,\d+"', sample_text):
            comma_as_decimal = False

    decimal = ',' if comma_as_decimal else '.'
    return delimiter, decimal

def load_clean_dataframe(filepath: Path) -> Tuple[pd.DataFrame, str]:
    """
    Loads CSV into Pandas handling delimiters, thousands separators, and decimal conventions.
    """
    delimiter, decimal = sniff_delimiter_and_decimal(filepath)
    
    try:
        if decimal == ',':
            df = pd.read_csv(filepath, sep=delimiter, decimal=',', thousands='.')
        else:
            df = pd.read_csv(filepath, sep=delimiter)
    except Exception:
        # Fallback with python engine
        df = pd.read_csv(filepath, sep=delimiter, engine='python')

    # Strip column names
    df.columns = [str(col).strip() for col in df.columns]

    # Convert string columns that look like floats to numeric if possible
    for col in df.columns:
        if df[col].dtype == object:
            normalized_name = re.sub(r"[^a-z0-9]+", "_", str(col).lower()).strip("_")
            compact_name = normalized_name.replace("_", "")
            if re.search(r"(^|_)(id|uid|uuid|index|roll|postal|postcode|zip|registration|serial|code)(_|$)", normalized_name) or compact_name.endswith(("id", "index", "zipcode", "postalcode", "rollnumber")):
                continue
            # Check if majority of values are numeric with commas or periods
            try:
                sample_s = df[col].dropna().astype(str).str.strip().str.replace(' ', '')
                if decimal == ',':
                    sample_s = sample_s.str.replace('.', '', regex=False).str.replace(',', '.', regex=False)
                else:
                    sample_s = sample_s.str.replace(r"(?<=\d),(?=\d{3}(?:\D|$))", "", regex=True)
                parsed = pd.to_numeric(sample_s, errors='coerce')
                # Require near-complete parse success to avoid coercing mixed text.
                if len(sample_s) and parsed.notna().mean() >= 0.95:
                    df[col] = parsed
            except Exception:
                pass

    return df, delimiter

def infer_column_type(series: pd.Series, col_name: str) -> str:
    """Infer a useful semantic type using values first and names as weak hints.

    Return values are stable API identifiers: datetime, continuous_numerical,
    discrete_numerical, binary, categorical, text_identifier, unknown, constant.
    """
    clean = series.dropna()
    if clean.empty:
        return "unknown"
    unique_count = int(clean.nunique())
    if unique_count <= 1:
        return "constant"

    name = re.sub(r"[^a-z0-9]+", "_", str(col_name).lower()).strip("_")
    id_name = bool(re.search(r"(^|_)(id|uid|uuid|index|roll|postal|postcode|zip|registration|serial|code)(_|$)", name))
    id_name = id_name or name.replace("_", "").endswith(("id", "index", "zipcode", "postalcode", "rollnumber"))
    binary_name = any(token in name for token in ("flag", "is_", "has_", "weekend", "enabled", "active"))
    continuous_name = any(token in name for token in ("energy", "kwh", "power", "kw", "temperature", "temp", "percent", "pct", "ratio", "fraction", "hours", "duration", "irradiance", "voltage", "current"))
    discrete_name = any(token in name for token in ("resident", "occupant", "student", "count", "rooms", "beds", "headcount"))

    # Parse numeric-looking text without converting arbitrary text categories.
    text_values = clean.astype(str).str.strip()
    numeric_values = pd.to_numeric(text_values.str.replace(",", ".", regex=False), errors="coerce")
    numeric_ratio = float(numeric_values.notna().mean()) if len(numeric_values) else 0.0
    is_numeric = pd.api.types.is_numeric_dtype(series) or numeric_ratio >= 0.95
    if is_numeric:
        values = (pd.to_numeric(clean, errors="coerce") if pd.api.types.is_numeric_dtype(series)
                  else numeric_values.dropna())
        values = values.replace([np.inf, -np.inf], np.nan).dropna()
        if values.empty:
            return "unknown"
        if id_name:
            return "text_identifier"
        unique_values = set(values.unique().tolist())
        if unique_values.issubset({0, 1}) and len(unique_values) <= 2:
            return "binary"
        if binary_name and len(unique_values) == 2:
            return "binary"
        unique_ratio = values.nunique() / max(len(values), 1)
        if id_name and unique_ratio >= 0.8:
            return "text_identifier"
        integral = bool(np.all(np.isclose(values.to_numpy(dtype=float), np.round(values.to_numpy(dtype=float)))))
        if discrete_name:
            return "discrete_numerical"
        if continuous_name:
            return "continuous_numerical"
        return "discrete_numerical" if integral else "continuous_numerical"

    # Date parsing applies only to non-numeric text, never to numeric flags or
    # measurements. Require broad parse success so a few date-like labels do not win.
    name_suggests_date = any(token in name for token in ("date", "time", "timestamp", "datetime"))
    try:
        parsed_dates = pd.to_datetime(clean.astype(str), errors="coerce", format="mixed")
        date_ratio = float(parsed_dates.notna().mean())
    except (ValueError, TypeError, OverflowError):
        date_ratio = 0.0
    if date_ratio >= (0.8 if name_suggests_date else 0.95):
        return "datetime"

    normalized_values = set(text_values.str.lower().unique().tolist())
    textual_binary_values = ({"true", "false"}, {"yes", "no"}, {"y", "n"}, {"on", "off"})
    if len(normalized_values) == 2 and (normalized_values in textual_binary_values or binary_name):
        return "binary"

    unique_ratio = unique_count / max(len(clean), 1)
    if id_name or unique_ratio >= 0.8:
        return "text_identifier"
    if unique_count <= 100 or unique_ratio <= 0.2:
        return "categorical"
    return "unknown"

def infer_column_unit(col_name: str) -> str:
    """
    Infers energy engineering unit from column naming heuristics.
    Never assumes energy means kWh without confirmation, but gives an educated guess.
    """
    name = col_name.lower()
    if 'kwh' in name or 'energy' in name or 'electricity' in name:
        return "kWh"
    if 'kvarh' in name:
        return "kVARh"
    if 'kw' in name or 'power' in name or 'demand' in name:
        return "kW"
    if 'temp' in name or '_c' in name or 'celsius' in name:
        return "°C"
    if 'humidity' in name or '%' in name or 'rh' in name:
        return "%"
    if 'hour' in name or 'hrs' in name:
        return "hours"
    if 'occupan' in name or 'student' in name or 'capacity' in name or 'person' in name:
        return "occupants"
    if 'price' in name or 'cost' in name or 'tariff' in name:
        return "currency"
    if 'solar' in name:
        return "kWh"
    if 'voltage' in name or 'volt' in name:
        return "V"
    if 'current' in name or 'amp' in name:
        return "A"
    return "unitless"

def profile_dataset(df: pd.DataFrame, dataset_id: int, original_name: str, delimiter: str) -> Dict[str, Any]:
    """
    Profiles entire dataset with comprehensive statistical and data quality metrics.
    """
    row_count, col_count = df.shape
    columns_profile = []
    potential_targets = []
    
    # Calculate Data Quality Metrics
    total_cells = row_count * col_count if (row_count and col_count) else 1
    total_missing = int(df.isna().sum().sum())
    missing_ratio = total_missing / total_cells
    
    duplicate_rows = int(df.duplicated().sum())
    dup_ratio = duplicate_rows / row_count if row_count else 0
    
    constant_columns = []
    high_cardinality_categoricals = []

    for col in df.columns:
        series = df[col]
        missing_count = int(series.isna().sum())
        missing_pct = round((missing_count / row_count) * 100, 2) if row_count else 0.0
        unique_cnt = int(series.nunique())
        
        inferred = infer_column_type(series, col)
        unit = infer_column_unit(col)
        
        if inferred == "constant":
            constant_columns.append(col)
        if inferred == "categorical" and unique_cnt > 50:
            high_cardinality_categoricals.append(col)

        sample_vals = series.dropna().head(5).tolist()
        min_v, max_v, mean_v, std_v = None, None, None, None
        
        if pd.api.types.is_numeric_dtype(series):
            clean_s = series.dropna()
            if len(clean_s) > 0:
                min_v = float(clean_s.min())
                max_v = float(clean_s.max())
                mean_v = float(clean_s.mean())
                std_v = float(clean_s.std()) if len(clean_s) > 1 else 0.0

        # Heuristic for potential targets (energy, total, used, kwh, consumption)
        col_l = col.lower()
        if inferred in {"continuous_numerical", "discrete_numerical"} and any(k in col_l for k in ['total', 'energy', 'electric', 'kwh', 'consumption', 'used']):
            potential_targets.append(col)

        columns_profile.append({
            "name": col,
            "original_dtype": str(series.dtype),
            "inferred_type": inferred,
            "selected_type": None,
            "effective_type": inferred,
            "custom_meaning": f"Recorded {col.replace('_', ' ')}",
            "unit": unit,
            "is_target": False, # set during user configuration or fallback
            "is_feature": inferred in ["continuous_numerical", "discrete_numerical", "binary", "categorical"],
            "is_excluded": inferred in ["constant", "text_identifier", "datetime", "unknown"],
            "exclusion_reason": ("Constant column (zero variance)" if inferred == "constant" else
                                 "Date/time column; transform deliberately before modeling" if inferred == "datetime" else
                                 "Likely identifier or high-cardinality text" if inferred == "text_identifier" else
                                 "Could not infer a reliable type" if inferred == "unknown" else ""),
            "missing_count": missing_count,
            "missing_percentage": missing_pct,
            "unique_count": unique_cnt,
            "sample_values": sample_vals,
            "min_val": min_v,
            "max_val": max_v,
            "mean_val": mean_v,
            "std_val": std_v
        })

    # If no target matched by keywords, pick numerical column with highest variance
    if not potential_targets:
        num_cols = [c for c in columns_profile if c["inferred_type"] in {"continuous_numerical", "discrete_numerical"}]
        if num_cols:
            potential_targets.append(num_cols[-1]["name"])

    # High correlation pairs between numerical features
    num_df = df.select_dtypes(include=[np.number])
    high_corr_pairs = []
    if num_df.shape[1] >= 2:
        try:
            corr_mat = num_df.corr().abs()
            cols = num_df.columns
            for i in range(len(cols)):
                for j in range(i + 1, len(cols)):
                    c1, c2 = cols[i], cols[j]
                    val = corr_mat.loc[c1, c2]
                    if not np.isnan(val) and val >= 0.85:
                        high_corr_pairs.append({
                            "col1": c1,
                            "col2": c2,
                            "correlation": round(float(val), 3)
                        })
        except Exception:
            pass

    # Overall Data Quality Score computation
    indicators = []
    quality_score = 100.0

    # 1. Missing values indicator
    if missing_ratio == 0:
        indicators.append({"category": "missing_values", "status": "PASS", "score": 100, "details": "No missing values detected."})
    elif missing_ratio < 0.05:
        penalty = missing_ratio * 100 * 2
        quality_score -= penalty
        indicators.append({"category": "missing_values", "status": "PASS", "score": round(100 - penalty, 1), "details": f"Minor missingness ({round(missing_ratio*100, 2)}% of cells)."})
    elif missing_ratio < 0.20:
        penalty = 25.0
        quality_score -= penalty
        indicators.append({"category": "missing_values", "status": "WARNING", "score": 75, "details": f"Moderate missingness ({round(missing_ratio*100, 2)}% of cells). Imputation required."})
    else:
        penalty = 45.0
        quality_score -= penalty
        indicators.append({"category": "missing_values", "status": "FAIL", "score": 40, "details": f"High missingness ({round(missing_ratio*100, 2)}% of cells). May compromise statistical reliability."})

    # 2. Duplicate rows indicator
    if duplicate_rows == 0:
        indicators.append({"category": "duplicate_rows", "status": "PASS", "score": 100, "details": "Zero duplicate rows found."})
    elif dup_ratio < 0.05:
        quality_score -= 10
        indicators.append({"category": "duplicate_rows", "status": "WARNING", "score": 85, "details": f"{duplicate_rows} duplicate rows ({round(dup_ratio*100, 2)}%)."})
    else:
        quality_score -= 25
        indicators.append({"category": "duplicate_rows", "status": "FAIL", "score": 50, "details": f"{duplicate_rows} duplicate rows ({round(dup_ratio*100, 2)}%). Likely logging re-entries."})

    # 3. Constant columns indicator
    if not constant_columns:
        indicators.append({"category": "constant_columns", "status": "PASS", "score": 100, "details": "All columns contain variable information."})
    else:
        quality_score -= len(constant_columns) * 5
        indicators.append({"category": "constant_columns", "status": "WARNING", "score": 70, "details": f"Found {len(constant_columns)} constant column(s): {', '.join(constant_columns)}."})

    # 4. Sample size check
    if row_count >= 100:
        indicators.append({"category": "sample_size", "status": "PASS", "score": 100, "details": f"Robust sample size ({row_count} observations)."})
    elif row_count >= 30:
        quality_score -= 15
        indicators.append({"category": "sample_size", "status": "WARNING", "score": 75, "details": f"Small sample size ({row_count} observations). Overfitting caution advised."})
    else:
        quality_score -= 35
        indicators.append({"category": "sample_size", "status": "FAIL", "score": 40, "details": f"Very low sample size ({row_count} rows). Insufficient for generalizable ML."})

    final_score = max(5.0, min(100.0, round(quality_score, 1)))

    # Preview rows
    preview_df = df.head(10).replace({np.nan: None})
    preview_rows = preview_df.to_dict(orient="records")

    return {
        "dataset_id": dataset_id,
        "original_name": original_name,
        "row_count": row_count,
        "col_count": col_count,
        "delimiter": delimiter,
        "preview_rows": preview_rows,
        "columns": columns_profile,
        "data_quality_score": final_score,
        "data_quality_indicators": indicators,
        "potential_targets": potential_targets,
        "high_correlation_pairs": high_corr_pairs
    }
