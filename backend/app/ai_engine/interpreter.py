import os
import json
import logging
import re
from typing import Dict, Any, Optional
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

WORKSPACE_METHOD_NAMES = {
    "linear_regression": "Linear Regression", "decision_tree": "Decision Tree",
    "kmeans": "K-Means", "pca": "PCA",
}


def _clean_finding_title(value: Any) -> str:
    """Keep impact as its own metadata field when an older title embeds it."""
    return re.sub(r"\s*(?:[-–—:]\s*)?(?:LOW|MEDIUM|HIGH)(?:\s+IMPACT)?\s*$", "", str(value), flags=re.IGNORECASE).strip()


def _metric_value(value: Any, places: int = 4) -> Optional[str]:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    return f"{value:.{places}f}"


def _original_feature_name(name: str, declared: list[str]) -> str:
    """Map encoded model columns back to an exact selected predictor name."""
    matches = [feature for feature in declared
               if name == feature or name.startswith(feature + "_") or name.startswith(feature + "category:")]
    return max(matches, key=len) if matches else name

def _readable_metrics(metrics: Any) -> str:
    if not isinstance(metrics, dict) or not metrics:
        return "No test metrics were returned."
    return ", ".join(f"{key.replace('_', ' ')}: {value:.4g}" if isinstance(value, (int, float)) and not isinstance(value, bool)
                       else f"{key.replace('_', ' ')}: {value}" for key, value in metrics.items())

def _numeric_claims_supported(parsed: Dict[str, Any], payload: Dict[str, Any]) -> bool:
    """Reject Gemini prose containing numeric claims absent from structured outputs."""
    supported = set()
    def collect(value: Any) -> None:
        if isinstance(value, bool) or value is None:
            return
        if isinstance(value, (int, float)):
            supported.add(float(value))
        elif isinstance(value, dict):
            for child in value.values(): collect(child)
        elif isinstance(value, (list, tuple)):
            for child in value: collect(child)
    collect(payload)
    # Only validate user-facing interpretation fields, not keys or opaque metadata.
    prose = [parsed.get("executive_summary", ""), parsed.get("cross_model_insights", "")]
    for collection in (parsed.get("major_discoveries", []), parsed.get("practical_recommendations", [])):
        prose.extend(json.dumps(item, ensure_ascii=False) for item in collection)
    if payload.get("verified_workspace_results"):
        # The report renders all figures from the immutable workspace artifacts.
        # Keep generated prose qualitative so Gemini cannot introduce or alter a metric.
        return not any(re.search(r"\d", str(text)) for text in prose)
    for text in prose:
        for token in re.findall(r"(?<![A-Za-z])[-+]?\d+(?:[,.]\d+)*(?:\.\d+)?%?", str(text)):
            raw = token.rstrip("%").replace(",", "")
            try: number = float(raw)
            except ValueError: continue
            candidates = (number, number / 100, number * 100)
            if not any(any(abs(candidate - value) <= max(1e-6, abs(value) * 0.0005) for value in supported) for candidate in candidates):
                return False
    return True

GEMINI_SYSTEM_PROMPT = """
You are the Chief Energy Data Scientist and Hostel Sustainability Engineer for Smart Hostel Energy Advisor.
Your objective is to provide a rigorous, evidence-grounded interpretation of an empirical energy analysis.

CRITICAL ANALYTICAL RULES:
1. NEVER INVENT OR FABRICATE METRICS: Rely exclusively on the numerical metrics, R², RMSE, coefficients, feature importances, cluster centroids, and PCA loadings supplied in the prompt.
2. DO NOT CONFUSE CORRELATION WITH CAUSATION: Clearly distinguish between observed mathematical correlations and physical causal mechanisms.
3. NEVER CLAIM A MODEL RAN IF IT WAS SKIPPED: Respect the model readiness and execution status. If a model was skipped, explain why and what data would enable it.
4. EVIDENCE GROUNDING: Every finding must cite exact supplied measurements or model outputs. Never infer an appliance, occupant, cause, period, or waste from a variable name alone.
5. Never claim savings, ROI, payback, or intervention effects unless those outcomes were measured in supplied outputs; otherwise explicitly say they are unquantified.
6. BE WILLING TO STATE 'INSUFFICIENT EVIDENCE': Give confidence and limitations honestly.
7. Recommend verification steps before interventions. Model associations are not causal findings.
8. RETURN ONLY VALID JSON complying exactly with the requested schema.
9. Write interpretations in plain English; do not include LaTeX source or equation markup in report text.
"""

def generate_local_heuristic_insights(
    analysis_payload: Dict[str, Any],
    reason: str = "Local Heuristic Engine (Gemini API key not configured)"
) -> Dict[str, Any]:
    """Dataset-specific synthesis using only verified record and model outputs."""
    summary = analysis_payload.get("dataset_summary", {})
    lr = analysis_payload.get("linear_regression")
    dt = analysis_payload.get("decision_tree")
    km = analysis_payload.get("kmeans")
    pca = analysis_payload.get("pca")
    skipped = analysis_payload.get("skipped_models", {})
    direct = analysis_payload.get("direct_observations", [])
    discoveries: list[Dict[str, Any]] = []
    completed: list[str] = []
    cross: list[str] = []
    recommendations: list[Dict[str, Any]] = []

    def add_finding(topic: str, finding: str, evidence: str, level: str, confidence: str, limitation: str, implication: str, verify: str) -> None:
        clean_topic = _clean_finding_title(topic)
        if any(item.get("topic") == clean_topic and item.get("finding") == finding for item in discoveries):
            return
        discoveries.append({"topic": clean_topic, "finding": finding, "evidence_source": evidence, "impact": "LOW",
                            "evidence_level": level, "plain_language_explanation": finding,
                            "operational_implication": implication, "recommended_verification": verify,
                            "confidence": confidence, "limitation": limitation})

    def add_action(action: str, reason: str, evidence: str, priority: str, category: str, verify: str, benefit: str) -> None:
        if any(item["action"] == action for item in recommendations):
            return
        recommendations.append({"action": action, "reason": reason,
                                 "evidence_basis": f"{evidence} No savings estimate is supported by the supplied results.", "priority": priority,
                                 "action_category": category, "verify_before": verify,
                                 "expected_benefit": f"{benefit} No savings estimate is supported by the supplied results.",
                                 "implementation_complexity": "LOW" if category == "Immediate verification" else "MEDIUM"})

    for item in direct:
        kind = item.get("kind")
        if kind == "target_summary":
            add_finding(f"Recorded range for {item['column']}",
                        f"Across {item['count']} non-missing records, {item['column']} averaged {item['mean']:.3g}; the median was {item['median']:.3g}, with values from {item['minimum']:.3g} to {item['maximum']:.3g}.",
                        f"Direct dataset calculation; missing records={item['missing_count']}.", "direct_observation",
                        "High for the supplied records; this is a summary, not a projection.",
                        "The range alone does not establish avoidable use or its cause.",
                        "Use this range to frame the observed outcome; compare unusual records with their source meter entries.",
                        "Confirm the unit, meter identity, and missing intervals for the target column.")
        elif kind == "period_comparison":
            add_finding(f"{item['column']} varied across recorded months",
                        f"The monthly mean was {item['high_mean']:.3g} in {item['high_period']} and {item['low_mean']:.3g} in {item['low_period']}, based on {item['high_count']} and {item['low_count']} records respectively.",
                        f"Direct aggregation by {item['time_column']} from the uploaded records.", "direct_observation",
                        "High for the records in those months.", "The comparison does not explain why values differed or adjust for occupancy or weather.",
                        "The months identify where a time-aligned review may be informative.",
                        f"Compare meter intervals and occupancy/weather logs for {item['high_period']} and {item['low_period']}.")
            add_action(f"Compare source readings for {item['high_period']} and {item['low_period']}.",
                       f"These months had different recorded means for {item['column']}.",
                       f"Monthly means {item['high_mean']:.3g} and {item['low_mean']:.3g} from direct records.", "Medium",
                       "Immediate verification", "Check meter continuity, units, occupancy, and weather for both periods.",
                       "Determine whether the difference is a real operating pattern; no savings are assumed.")
        elif kind == "group_comparison":
            add_finding(f"Recorded values differed between {item['group_column']} groups",
                        f"Mean {item['column']} was {item['high_mean']:.3g} for {item['high_group']} ({item['high_count']} records) and {item['low_mean']:.3g} for {item['low_group']} ({item['low_count']} records).",
                        f"Direct group aggregation by {item['group_column']}.", "direct_observation",
                        "High for these records; comparison is descriptive.", "Differences may reflect occupancy, meter scope, or other unmeasured conditions.",
                        "This identifies a comparison for facilities staff; it does not rank buildings by efficiency.",
                        f"Confirm equivalent meter coverage and compare occupancy and schedules for {item['high_group']} and {item['low_group']}.")
            add_action(f"Check meter coverage and occupancy comparability for {item['high_group']} and {item['low_group']}.",
                       f"Their recorded {item['column']} means differed.",
                       f"Direct group means {item['high_mean']:.3g} versus {item['low_mean']:.3g}.", "Medium",
                       "Immediate verification", "Verify submeter boundaries, units, occupancy, and operating schedules.",
                       "Establish whether the group difference remains after like-for-like comparison.")
        elif kind == "observed_association":
            direction = "higher" if item["correlation"] > 0 else "lower"
            add_finding(f"Observed association with {item['feature']}",
                        f"In {item['count']} paired records, {item['feature']} and {item['column']} moved together ({direction} values were associated; Pearson r={item['correlation']:.3f}).",
                        "Direct calculation from paired uploaded measurements.", "direct_observation",
                        "Moderate as a description of the supplied paired values.", item.get("limitation", "Correlation does not establish causation."),
                        "The variable may help segment records for review; it does not show that changing it will change consumption.",
                        f"Plot paired {item['feature']} and {item['column']} readings and verify units, dates, and outliers.")
            add_action(f"Review paired {item['feature']} and {item['column']} readings, including outliers.",
                       "A direct association was present in the uploaded records.",
                       f"Pearson r={item['correlation']:.3f} across {item['count']} pairs.", "Low",
                       "Immediate verification", "Check paired timestamps, meter units, and atypical observations.",
                       "Clarify whether the association is stable and operationally interpretable.")
        elif kind == "missingness":
            add_finding(f"Some {item['column']} records are missing",
                        f"{item['missing_count']} records ({item['missing_percentage']:.1f}%) have no value for {item['column']}.",
                        "Direct missing-value count in the uploaded data.", "direct_observation",
                        "High for the file as received.", "The missing values may not be random and can affect model fit or comparisons.",
                        "The field's coverage limits interpretation of any pattern that uses it.",
                        f"Check the source system for {item['column']} gaps and document whether they indicate outages or logging failures.")
            add_action(f"Review missing {item['column']} readings with the meter or logging owner.",
                       "Missing intervals can distort comparisons and model estimates.",
                       f"{item['missing_count']} missing values ({item['missing_percentage']:.1f}%).", "Medium",
                       "Short-term monitoring improvements", "Compare source logs with meter exports and record the reason for gaps.",
                       "Improve completeness of the next assessment; energy savings are not quantified.")
        elif kind == "binary_event_count":
            text_counts = ", ".join(f"{x['value']}: {x['count']}" for x in item["level_counts"])
            add_finding(f"Recorded states for {item['column']}",
                        f"The file contains these state counts: {text_counts}.",
                        "Direct count of the two recorded values.", "direct_observation",
                        "High for the values present in the file.", "The field's coding meaning and event duration are not established by counts alone.",
                        "The count can guide a check of corresponding maintenance or inverter logs.",
                        f"Confirm the coding definition and compare {item['column']} dates with maintenance records.")

    if lr and lr.get("status") == "COMPLETED":
        completed.append("Linear Regression")
        coefs = lr.get("coefficients", [])
        if coefs:
            coef = coefs[0]
            r2 = lr.get("r2_score")
            quality = "limited out-of-sample prediction" if not isinstance(r2, (int, float)) or r2 < .3 else "moderate out-of-sample predictive signal" if r2 < .7 else "stronger out-of-sample predictive signal"
            add_finding("Linear Regression predictive association",
                        f"{coef['feature']} had the largest standardized coefficient magnitude ({coef.get('standardized_coefficient')}); its unstandardized coefficient was {coef.get('coefficient')} in the original units. Test R² was {r2} and RMSE was {lr.get('rmse')}.",
                        f"Scikit-learn test split: {lr.get('test_size')} held-out observations; target={lr.get('target_variable')}.", "model_finding",
                        f"{quality}; assess alongside the held-out error and data coverage.",
                        "An association is not causal. Standardized coefficients compare scale-adjusted magnitude; raw coefficients retain source units.",
                        f"The model can estimate {lr.get('target_variable')} from the listed predictors under similar data conditions; it cannot explain a physical cause.",
                        "Compare predictions with unseen meter records before operational use.")
            if isinstance(r2, (int, float)) and r2 < .3:
                add_action(f"Do not use this regression as an operational forecasting rule for {lr.get('target_variable')} yet.",
                           f"Its test R² ({r2}) indicates limited predictive performance in the held-out records.",
                           f"Test R²={r2}; RMSE={lr.get('rmse')}; held-out n={lr.get('test_size')}.", "High",
                           "Immediate verification", "Check prediction errors on a later time period and review omitted predictors.",
                           "Avoid acting on unreliable predictions until out-of-sample performance improves.")

    if dt and dt.get("status") == "COMPLETED":
        completed.append("Decision Tree")
        nodes = dt.get("tree_nodes", [])
        root = next((n for n in nodes if n.get("parent_id") is None), None)
        imps = dt.get("feature_importances", [])
        if root and not root.get("is_leaf"):
            add_finding("Decision tree's first split", 
                        f"The fitted tree first split on {root.get('feature')} at {root.get('threshold')}; {root.get('sample_count')} training records reached that node. Test metrics: {_readable_metrics(dt.get('metrics'))}.",
                        "Actual Scikit-learn root node and held-out test metrics.", "model_finding",
                        "The split is a model rule; reliability depends on held-out performance and whether the rule repeats in later data.",
                        "The split does not identify a fault, waste, or causal threshold.",
                        "Records on either side of the threshold are candidates for a like-for-like check.",
                        f"Compare source records immediately above and below the fitted {root.get('feature')} threshold.")
        elif imps:
            add_finding("Decision tree's leading input", f"The largest tree importance was assigned to {imps[0]['feature']} ({imps[0].get('importance_pct')}%).",
                        f"Scikit-learn feature importance; test metrics: {_readable_metrics(dt.get('metrics'))}.", "model_finding",
                        "Model-specific; a split may vary with the sample and settings.", "Importance is not causal or a direct measure of operational value.",
                        "Use this variable to inspect the fitted tree rules, not as a standalone intervention target.",
                        "Check the tree's actual branch conditions against source meter and operating records.")

    if km and km.get("status") == "COMPLETED":
        completed.append("K-Means")
        k, sil = km.get("optimal_k"), km.get("silhouette_score")
        separation = "weak separation" if isinstance(sil, (int, float)) and sil < .25 else "limited separation" if isinstance(sil, (int, float)) and sil < .5 else "more distinct group separation" if isinstance(sil, (int, float)) else "separation could not be calculated"
        profiles = km.get("cluster_profiles", [])
        profile_text = "; ".join(f"Group {p['cluster_id']} ({p['sample_count']} records): " + ", ".join(f"{name} {value}" for name, value in list(p.get("centroids", {}).items())[:4]) for p in profiles[:4])
        add_finding("K-Means grouped similar records", f"The model selected {k} groups, with {separation} (silhouette={sil}). {profile_text}",
                    f"Scikit-learn K-Means on standardized inputs; physical-unit centroid profiles are shown above.", "model_finding",
                    "Limited when groups overlap; inspect silhouette and group sizes before using them operationally.",
                    "Groups are descriptive and do not mean efficient/inefficient or identify a cause.",
                    "Profiles can help staff select comparable periods for a meter or schedule review.",
                    "Compare each group's original-unit measurements with dates, occupancy, and operating logs.")

    if pca and pca.get("status") == "COMPLETED":
        completed.append("PCA")
        evr, cum = pca.get("explained_variance_ratio", []), pca.get("cumulative_explained_variance", [])
        loadings = pca.get("loadings", [])
        if evr:
            top1 = max(loadings, key=lambda x: abs(x.get("PC1", 0))) if loadings else None
            top2 = max(loadings, key=lambda x: abs(x.get("PC2", 0))) if len(evr) > 1 and loadings else None
            two = cum[1] if len(cum) > 1 else evr[0]
            loading_text = f" Largest absolute loadings: PC1—{top1['feature']} ({top1.get('PC1')});" if top1 else ""
            if top2:
                loading_text += f" PC2—{top2['feature']} ({top2.get('PC2')})."
            add_finding("PCA summarizes variation across measurements",
                        f"PC1 accounts for {evr[0] * 100:.2f}% and the first two components account for {two * 100:.2f}% of input variation.{loading_text}",
                        f"Scikit-learn PCA on: {', '.join(pca.get('features_used', []))}.", "model_finding",
                        "Calculated from the selected standardized inputs.", "The first two components omit the remaining variation; variance share is not energy use or importance.",
                        "The component pattern describes which measures vary together and is not a consumption prediction.",
                        "Review original-unit measurements for the features with the largest absolute loadings.")

    if lr and dt and lr.get("coefficients") and dt.get("feature_importances"):
        lr_features = (lr.get("provenance") or {}).get("predictor_variables", [])
        dt_features = (dt.get("provenance") or {}).get("predictor_variables", [])
        lr_names = [_original_feature_name(str(x.get("feature", "")), lr_features) for x in lr["coefficients"][:3]]
        dt_names = [_original_feature_name(str(x.get("feature", "")), dt_features) for x in dt["feature_importances"][:3]]
        shared = sorted(set(lr_names) & set(dt_names))
        shared_text = f" Shared leading predictors: {', '.join(shared)}." if shared else " Their leading predictors differ."
        cross.append(
            f"Linear Regression estimates {lr.get('target_variable') or 'the numeric target'} from predictor values; "
            f"its leading coefficient inputs are {', '.join(lr_names) or 'not available'}. Decision Tree uses explicit split rules; "
            f"its leading importance inputs are {', '.join(dt_names) or 'not available'}.{shared_text} "
            "These are comparisons of prediction and fitted rules, not independent causal confirmation."
        )
    if km and pca:
        pca_features = pca.get("features_used", [])
        supervised_features = (lr or {}).get("provenance", {}).get("predictor_variables", [])
        pca_set_differs = bool(pca_features and supervised_features and set(pca_features) != set(supervised_features))
        pca_scope = (f" PCA used its selected feature set ({', '.join(pca_features)}), which differs from the supervised predictor set."
                     if pca_set_differs else " PCA summarizes variation in its selected measurement inputs.")
        cross.append("K-Means groups records by similarity and does not predict the target; PCA reduces measurement dimensions and does not predict consumption." + pca_scope + " These descriptions are complementary, not independent confirmation.")

    completed_keys = {key for key, value in (("linear_regression", lr), ("decision_tree", dt), ("kmeans", km), ("pca", pca))
                      if value and value.get("status") == "COMPLETED"}
    declared_statuses = analysis_payload.get("experiment_statuses") or {}
    incomplete_keys = {key for key in WORKSPACE_METHOD_NAMES if key not in completed_keys and
                       (declared_statuses.get(key) == "incomplete" or
                        (key not in declared_statuses and any(token in str(skipped.get(key, "")).lower()
                         for token in ("incomplete", "execution error", "failed", "running"))))}
    not_yet_executed_keys = set(WORKSPACE_METHOD_NAMES) - completed_keys - incomplete_keys
    completion_status = {
        "completed": [WORKSPACE_METHOD_NAMES[key] for key in WORKSPACE_METHOD_NAMES if key in completed_keys],
        "incomplete": [WORKSPACE_METHOD_NAMES[key] for key in WORKSPACE_METHOD_NAMES if key in incomplete_keys],
        "not_yet_executed": [WORKSPACE_METHOD_NAMES[key] for key in WORKSPACE_METHOD_NAMES if key in not_yet_executed_keys],
    }
    # The executive summary compares only verified results attached to this report.
    lr_r2 = _metric_value((lr or {}).get("r2_score"))
    dt_metrics = (dt or {}).get("metrics", {})
    dt_r2 = _metric_value(dt_metrics.get("r2_score"))
    supervised = [("Linear Regression", lr, lr_r2), ("Decision Tree", dt, dt_r2)]
    scored_supervised = [(name, result, score) for name, result, score in supervised
                         if result and result.get("status") == "COMPLETED" and score is not None]
    strongest_predictor = max(scored_supervised, key=lambda item: float(item[2]))[0] if scored_supervised else None
    summary_parts = []
    if lr and lr.get("status") == "COMPLETED":
        lr_rmse = _metric_value(lr.get("rmse"))
        summary_parts.append(f"Linear Regression predicts {lr.get('target_variable') or 'the numeric target'}; held-out R² was {lr_r2 or 'not returned'}" + (f" and RMSE was {lr_rmse}." if lr_rmse else "."))
    if dt and dt.get("status") == "COMPLETED":
        dt_rmse, dt_mae = _metric_value(dt_metrics.get("rmse")), _metric_value(dt_metrics.get("mae"))
        dt_text = f"Decision Tree applies fitted split rules; held-out R² was {dt_r2 or 'not returned'}"
        if dt_rmse: dt_text += f", RMSE was {dt_rmse}"
        if dt_mae: dt_text += f", and MAE was {dt_mae}"
        summary_parts.append(dt_text + ".")
    if km and km.get("status") == "COMPLETED":
        silhouette = _metric_value(km.get("silhouette_score"))
        summary_parts.append(f"K-Means grouped records into {km.get('optimal_k') if km.get('optimal_k') is not None else 'an unreported number of'} clusters" +
                             (f" with silhouette {silhouette}, indicating weak separation." if silhouette and float(silhouette) < .25 else
                              f" with silhouette {silhouette}." if silhouette else "."))
    if pca and pca.get("status") == "COMPLETED":
        evr = pca.get("explained_variance_ratio", [])
        cum = pca.get("cumulative_explained_variance", [])
        pca_text = "PCA summarizes variation; it does not predict consumption"
        if evr:
            pca_text += f" (PC1 {evr[0] * 100:.2f}%"
            if len(evr) > 1:
                pca_text += f", first two PCs {(cum[1] if len(cum) > 1 else sum(evr[:2])) * 100:.2f}%"
            pca_text += ")"
        pca_text += "."
        summary_parts.append(pca_text)
    strongest = (" ".join(summary_parts) + " " if summary_parts else "No specific model finding is supported by the available results. ")
    if strongest_predictor:
        strongest = f"{strongest_predictor} had the strongest held-out R² among the completed supervised models. " + strongest
    summary_text = (f"This assessment used {summary.get('row_count', 0)} records from {summary.get('original_name', 'the selected dataset')}. "
                    f"Completed experiments: {', '.join(completion_status['completed']) if completion_status['completed'] else 'none'}. "
                    f"Incomplete experiments: {', '.join(completion_status['incomplete']) if completion_status['incomplete'] else 'none'}. "
                    f"Not yet executed: {', '.join(completion_status['not_yet_executed']) if completion_status['not_yet_executed'] else 'none'}. "
                    + strongest + "Taken together, these methods provide complementary views of prediction, fitted rules, record grouping, and measurement variation. Their results do not establish causes, faults, or savings.")
    return {
        "analysis_id": analysis_payload.get("analysis_id", 0),
        "executive_summary": summary_text,
        "completion_status": completion_status,
        "major_discoveries": discoveries,
        "direct_observations": direct,
        "cross_model_insights": " ".join(cross) if cross else "The available outputs do not establish a cross-method conclusion.",
        "potential_inefficiencies": [],
        "practical_recommendations": recommendations[:2],
        "data_collection_recommendations": analysis_payload.get("data_improvement_advice", []),
        "confidence_and_evidence": "Confidence depends on data coverage and model-specific test evidence. A model score does not validate an operational explanation.",
        "limitations": "These analyses cannot prove causation, establish device-level waste, or quantify savings without direct measurements and intervention evaluation.",
        "is_ai_generated": False,
        "model_used": reason,
        "validated_against_results": True,
        "interpretation_status": "local_fallback"
    }
def interpret_analysis_with_gemini(analysis_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Orchestrates AI interpretation using Google GenAI SDK with structured output validation,
    or falls back gracefully to the local scientific evidence synthesizer.
    """
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")

    if not api_key:
        logger.info("No GEMINI_API_KEY found; executing local evidence-grounded interpretation engine.")
        return generate_local_heuristic_insights(analysis_payload, reason="Local Evidence Heuristic Engine (API Key Not Configured)")

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        prompt_content = f"""
Given the following verified Python ML Engine outputs and data profile for a university hostel:

DATASET PROFILE:
{json.dumps(analysis_payload.get('dataset_summary', {}), indent=2)}

COLUMN MAPPINGS & UNITS:
{json.dumps(analysis_payload.get('column_mappings', []), indent=2)}

MODEL READINESS EVALUATION:
{json.dumps(analysis_payload.get('model_readiness', {}), indent=2)}

LINEAR REGRESSION (O.L.S.) ACTUAL RESULTS:
{json.dumps(analysis_payload.get('linear_regression'), indent=2)}

DECISION TREE RESULTS:
{json.dumps(analysis_payload.get('decision_tree'), indent=2)}

K-MEANS CLUSTERING RESULTS:
{json.dumps(analysis_payload.get('kmeans'), indent=2)}

PRINCIPAL COMPONENT ANALYSIS (PCA) RESULTS:
{json.dumps(analysis_payload.get('pca'), indent=2)}

SKIPPED MODELS:
{json.dumps(analysis_payload.get('skipped_models', {}), indent=2)}

DATASET IMPROVEMENT ADVICE:
{json.dumps(analysis_payload.get('data_improvement_advice', []), indent=2)}

DIRECT OBSERVATIONS CALCULATED BY PYTHON:
{json.dumps(analysis_payload.get('direct_observations', []), indent=2)}

{("VERIFIED WORKSPACE CONSOLIDATION: These are the completed workspace runs that will be shown unchanged in the report. Do not state any numeric values or metric figures in prose; describe them qualitatively. The report displays all metrics directly from these Python results." if analysis_payload.get('verified_workspace_results') else "")}

RUN PROVENANCE AND LEAKAGE WARNINGS:
{json.dumps({name: result.get('provenance') for name, result in [('linear_regression', analysis_payload.get('linear_regression')), ('decision_tree', analysis_payload.get('decision_tree')), ('kmeans', analysis_payload.get('kmeans')), ('pca', analysis_payload.get('pca'))] if result}, indent=2)}

Generate a structured JSON response matching the following key structure. Write for hostel officials in plain English. Never label an association or model split as an inefficiency. Leave potential_inefficiencies empty unless measured evidence directly supports one. Every recommendation must be a verification or measurement step unless a measured intervention result supports an operational change. Do not invent savings.
{{
  "executive_summary": string,
  "major_discoveries": [
     {{"topic": string, "finding": string, "plain_language_explanation": string, "evidence_source": string, "evidence_level": "direct_observation"|"model_finding"|"hypothesis", "operational_implication": string, "recommended_verification": string, "impact": "HIGH"|"MEDIUM"|"LOW", "confidence": string, "limitation": string}}
  ],
  "cross_model_insights": string,
  "potential_inefficiencies": [
     {{"anomaly_type": string, "description": string, "affected_nodes": string, "estimated_severity": "HIGH"|"MEDIUM"|"LOW"}}
  ],
  "practical_recommendations": [
     {{"action": string, "expected_savings": "Not quantified unless measured", "implementation_complexity": "LOW"|"MEDIUM"|"HIGH", "evidence_basis": string, "priority": "High"|"Medium"|"Low", "reason": string, "expected_benefit": string, "verify_before": string, "action_category": "Immediate verification"|"Short-term monitoring improvements"|"Long-term opportunities requiring further evidence", "responsible_role": string}}
  ],
  "data_collection_recommendations": [
     {{"missing_parameter": string, "analytical_impact": string, "recommended_sensor_or_log": string}}
  ],
  "confidence_and_evidence": string,
  "limitations": string
}}
"""

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=[
                types.Part.from_text(GEMINI_SYSTEM_PROMPT + "\n\n" + prompt_content)
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2
            )
        )

        response_text = response.text.strip()
        # Clean markdown wrappers if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        parsed = json.loads(response_text.strip())
        required_text = ("executive_summary", "cross_model_insights", "confidence_and_evidence", "limitations")
        required_lists = ("major_discoveries", "practical_recommendations", "data_collection_recommendations")
        schema_valid = (isinstance(parsed, dict)
                        and all(isinstance(parsed.get(key), str) for key in required_text)
                        and all(isinstance(parsed.get(key), list) for key in required_lists)
                        and all(isinstance(item, dict) for key in required_lists for item in parsed[key]))
        if not schema_valid or not _numeric_claims_supported(parsed, analysis_payload):
            logger.warning("Gemini response failed structured or numeric-claim validation; using verified local fallback.")
            return generate_local_heuristic_insights(analysis_payload, reason="Local evidence fallback (Gemini response validation failed)")
        parsed["practical_recommendations"] = parsed.get("practical_recommendations", [])[:2]
        for item in parsed.get("major_discoveries", []):
            item["topic"] = _clean_finding_title(item.get("topic", ""))
        for item in parsed["practical_recommendations"]:
            item.pop("expected_savings", None)
            action = str(item.get("action", ""))
            item["action"] = re.sub(r"\s*(?:[-–—:]\s*)?(?:not estimated from these analyses|not quantified unless measured)\.?\s*$", "", action, flags=re.IGNORECASE).strip()
            benefit = str(item.get("expected_benefit", ""))
            if "savings estimate is supported" not in benefit.lower():
                item["expected_benefit"] = (benefit + " No savings estimate is supported by the supplied results.").strip()
            evidence = str(item.get("evidence_basis", ""))
            if "savings estimate is supported" not in evidence.lower():
                item["evidence_basis"] = (evidence + " No savings estimate is supported by the supplied results.").strip()
        verified_local = generate_local_heuristic_insights(analysis_payload)
        parsed["completion_status"] = verified_local["completion_status"]
        parsed["executive_summary"] = verified_local["executive_summary"]
        parsed["analysis_id"] = analysis_payload.get("analysis_id", 0)
        parsed["is_ai_generated"] = True
        parsed["model_used"] = f"Google Gemini ({settings.GEMINI_MODEL})"
        parsed["validated_against_results"] = True
        parsed["interpretation_status"] = "gemini_active"
        return parsed

    except Exception as e:
        logger.warning(f"Gemini API invocation failed ({str(e)}). Switching to local fallback.")
        return generate_local_heuristic_insights(analysis_payload, reason=f"Local Heuristic Engine (Gemini fallback: {str(e)[:50]})")
