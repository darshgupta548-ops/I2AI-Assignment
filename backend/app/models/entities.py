import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database.session import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    row_count = Column(Integer, default=0)
    col_count = Column(Integer, default=0)
    delimiter = Column(String(10), default=",")
    description = Column(Text, default="")
    is_sample = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
    
    # Relationships
    columns = relationship("DatasetColumn", back_populates="dataset", cascade="all, delete-orphan")
    analyses = relationship("AnalysisRun", back_populates="dataset", cascade="all, delete-orphan")

class DatasetColumn(Base):
    __tablename__ = "dataset_columns"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    name = Column(String(255), nullable=False)
    original_dtype = Column(String(50), default="unknown")
    inferred_type = Column(String(50), default="unknown") # profiler-derived type; selected_type stores user override
    selected_type = Column(String(50), nullable=True)
    custom_meaning = Column(String(255), default="")
    unit = Column(String(50), default="") # kWh, kW, Celsius, %, hours, occupants, Rs/kWh, etc.
    is_target = Column(Boolean, default=False)
    is_feature = Column(Boolean, default=True)
    is_excluded = Column(Boolean, default=False)
    exclusion_reason = Column(Text, default="")
    missing_count = Column(Integer, default=0)
    unique_count = Column(Integer, default=0)

    # Relationship
    dataset = relationship("Dataset", back_populates="columns")

class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    run_name = Column(String(255), default="")
    target_column = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
    status = Column(String(50), default="COMPLETED") # PENDING, RUNNING, COMPLETED, FAILED
    config_json = Column(Text, default="{}")
    data_quality_score = Column(Float, default=100.0)
    data_quality_summary = Column(Text, default="")

    # Relationships
    dataset = relationship("Dataset", back_populates="analyses")
    model_results = relationship("ModelResult", back_populates="analysis", cascade="all, delete-orphan")
    ai_insights = relationship("AiInsight", back_populates="analysis", uselist=False, cascade="all, delete-orphan")

class ModelResult(Base):
    __tablename__ = "model_results"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analysis_runs.id"), nullable=False)
    model_name = Column(String(100), nullable=False) # linear_regression, decision_tree, kmeans, pca
    status = Column(String(50), nullable=False) # READY, CONDITIONAL, INSUFFICIENT, COMPLETED, SKIPPED, FAILED
    is_runnable = Column(Boolean, default=True)
    execution_time_ms = Column(Float, default=0.0)
    metrics_json = Column(Text, default="{}") # R2, RMSE, MAE, Silhouette, etc.
    artifacts_json = Column(Text, default="{}") # Plot points, coefficients, cluster centroids, etc.
    readiness_notes = Column(Text, default="")
    explanation = Column(Text, default="")

    # Relationship
    analysis = relationship("AnalysisRun", back_populates="model_results")

class AiInsight(Base):
    __tablename__ = "ai_insights"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analysis_runs.id"), nullable=False)
    executive_summary = Column(Text, default="")
    discoveries_json = Column(Text, default="[]") # List of major discoveries with evidence
    cross_model_insights = Column(Text, default="")
    inefficiencies_json = Column(Text, default="[]") # Inefficiencies detected
    recommendations_json = Column(Text, default="[]") # Concrete energy conservation measures
    data_recommendations_json = Column(Text, default="[]") # Missing variables to collect
    confidence_notes = Column(Text, default="")
    limitations = Column(Text, default="")
    is_ai_generated = Column(Boolean, default=True)
    model_used = Column(String(50), default="gemini-2.5-flash")
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))

    # Relationship
    analysis = relationship("AnalysisRun", back_populates="ai_insights")
