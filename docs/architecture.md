# Smart Hostel Energy Advisor — System Architecture & Design

## 1. System Overview

Smart Hostel Energy Advisor is designed around a decoupled, modular architecture adhering to strict software engineering and data science principles:

1. **Adaptive Ingestion**: Delimiter and decimal sniffing allows universal CSV ingestion without schema assumptions.
2. **Contextual Configuration**: Flexible unit mapping and feature/target designations without hardcoding regional parameters.
3. **Statistically Defensible Gating**: Independent prerequisite audits for all four required algorithms (`Linear Regression`, `Decision Tree`, `K-Means`, `PCA`).
4. **Calculated in Python, Interpreted by AI**: All metrics ($R^2$, RMSE, MAE, Silhouette, Explained Variance, Centroids, Loadings) are computed by `scikit-learn` in Python. Gemini receives these verified numbers to produce structured interpretations, never hallucinating raw numerical results.
5. **Persistent History**: SQLite database using SQLAlchemy 2.0 persists datasets, schemas, runs, model artifacts, and AI summaries for multi-run comparison.

---

## 2. Machine Learning Engine Specification

### A. Linear Regression (Ordinary Least Squares)
- **Mathematical Form**:
  $$\hat{y} = \beta_0 + \sum_{j=1}^{p} \beta_j X_j$$
- **Precondition Gating**:
  - Requires continuous numeric target ($y$).
  - Target uniqueness $\ge 10$ levels.
  - Number of numeric features $p \ge 1$.
  - Sample size $n \ge 15$.
  - Flagged as `CONDITIONAL` if $n < 10 \times p$ (sample-to-predictor ratio risk).
- **Leakage Protection**:
  - Target column excluded from $X$.
  - Highly collinear predictors ($|r| > 0.999$ with $y$) automatically filtered out.
  - Imputers (`median`) and `StandardScaler` fit exclusively on the 80% train split.
- **Artifacts Computed**:
  - Out-of-sample $R^2$, RMSE, MAE.
  - Standardized feature coefficients.
  - Residual histogram ($y - \hat{y}$) for normality assessment.

### B. Decision Tree (CART)
- **Supported Modes**:
  - `DecisionTreeRegressor` when $y$ is continuous.
  - `DecisionTreeClassifier` when $y$ is categorical or converted via explicit median thresholding.
- **Precondition Gating**:
  - Requires target variable.
  - $n \ge 20$ samples. Depth constrained to $4$ with `min_samples_leaf=3` to avoid overfitting small sample regimes.
- **Artifacts Computed**:
  - Mean Decrease in Impurity (MDI) feature importances.
  - Hierarchical text decision paths (`export_text`).

### C. K-Means Clustering
- **Mathematical Objective**:
  $$\min \sum_{k=1}^{K} \sum_{x \in S_k} ||x - \mu_k||^2$$
- **Precondition Gating**:
  - Unsupervised: target is not required.
  - Requires $\ge 2$ variable numerical features and $n \ge 15$.
- **Execution Pipeline**:
  - Standard scaling across candidate features.
  - Elbow curve evaluation ($k \in [2, 6]$).
  - Silhouette coefficient maximization to select optimal $k$.
  - Centroids unscaled back to physical units (e.g., actual kWh, °C, occupants) with objective feature summaries.
  - 2D projection via PCA for visualization.

### D. Principal Component Analysis (PCA)
- **Mathematical Decomposition**:
  $$\mathbf{X}_{\text{std}} = \mathbf{U} \mathbf{\Sigma} \mathbf{V}^T$$
- **Precondition Gating**:
  - Continuous numerical features $\ge 2$.
  - $n \ge p + 2$.
- **Artifacts Computed**:
  - Scree plot (explained variance ratio per component).
  - Cumulative variance curve.
  - Factor loadings matrix ($\mathbf{V}$).
  - PC1 vs PC2 coordinate scatter map.

---

## 3. Gemini AI Interpretation Pipeline

The application integrates Google Gemini via `google-genai` SDK:
- Strict Pydantic response models:
  - `executive_summary`
  - `major_discoveries`
  - `cross_model_insights`
  - `potential_inefficiencies`
  - `practical_recommendations`
  - `data_collection_recommendations`
  - `confidence_and_evidence`
  - `limitations`
- **Fallback Resilience**: When `GEMINI_API_KEY` is not present, the `generate_local_heuristic_insights` function provides identical schema outputs derived directly from Scikit-learn results, guaranteeing zero crashes.
