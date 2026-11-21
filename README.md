# OrbitGuard: Multi-Hazard Early Warning & Response Prioritisation (Assam Prototype)

OrbitGuard is an operational early warning, hazard modeling, and humanitarian response prioritization framework for Assam. This repository contains the complete **Flood Module**, designed for multi-tier disaster preparedness, resource allocation, and spatial exposure risk ranking across all 33 administrative districts of Assam.

---

## 1. Quick Start & Execution

### Prerequisites
- Python 3.11+
- Virtual environment or system Python with required packages:
```bash
pip install -r requirements.txt
```

### Running the End-to-End Pipeline
```bash
# Run full pipeline (intake -> base harmonization -> EE integration -> LOYO modeling -> ranking -> export)
python run_pipeline.py

# Force re-extraction and clean rerun
python run_pipeline.py --force

# Run with a custom archive path
python run_pipeline.py --zip path/to/your_archive.zip

# Skip cross-validation training (audit and boundary processing only)
python run_pipeline.py --skip-train
```

### Running Automated Test Suite
```bash
python -m pytest tests -v
```

---

## 2. Architecture & Pipeline Workflow

```
OrbitGuard/
├── data/
│   ├── raw/
│   │   ├── _unzipped/               # Extracted files from zip archive
│   │   └── orbitguard_flood_data.zip# Master archive
│   └── processed/
│       ├── .manifest.json           # SHA-256 integrity cache
│       ├── assam_districts_33.geojson # Canonical boundary polygons (G01..G33)
│       ├── base_district_month.csv  # 2,520-row base table (35 districts x 6 months x 12 years)
│       ├── training_table_district_month.csv # Ingested district training table
│       ├── sar_polygon_month.csv    # Primary SAR satellite training table
│       └── annual_sar_vs_official.csv # Validation table (SAR vs official anchors)
├── core/
│   ├── intake.py                    # Phase Z: Path traversal guard & content classifier
│   ├── base.py                      # Phase B: Boundary harmonization & base table
│   ├── ingest.py                    # Phase A: GEE integration & lag feature engineering
│   ├── features.py                  # Phase 1: In-fold anomalies, climatologies & leakage tests
│   ├── targets.py                   # Phase 2: Target construction (T_cls, T_reg)
│   ├── hazard.py                    # Abstract BaseHazardModel interface
│   ├── ranking.py                   # Phase 5: Multi-factor exposure & priority ranking
│   └── export.py                    # Phase 6: GeoJSON & Model Card export
├── hazards/
│   ├── flood.py                     # LightGBM M1, Isotonic M2, Quantiles M3, CQR M4, SHAP M6, Synthetic M7, FloodHazard.extent()
│   └── drought.py                   # Demo: index-based SPI-1/3/6 & MODIS VCI drought model, in-fold baseline & timescale spread
├── service/
│   ├── app.py                       # FastAPI application serving ONLY precomputed outputs/
│   ├── models.py                    # Pydantic schemas (all responses embed label_source & warning)
│   └── README.md                    # Service guide with curl examples for all endpoints
├── core/
│   ├── advisory.py                  # Rule-based advisory generator (no LLMs, ASDMA disclaimer)
│   ├── advisory_actions.yaml        # Editable action catalog and alert thresholds
├── sar/
│   ├── export_extent_ee.py          # Sentinel-1 GEE extractor: IW VV, Otsu / -16dB, MMU 5ha, simplified GeoJSON & stats CSV
│   └── extent.py                    # Local extent processor: GeoJSON footprint, summary JSON, observed SAR fields & Bhuvan IoU/F1
├── gee/
│   ├── export_flood_features.py     # Google Earth Engine automated feature extractor (Sentinel-1 & CHIRPS)
│   └── export_drought_features.py   # GEE 30-year CHIRPS (1991-2025) & MODIS NDVI/VCI feature extractor
├── metrics/
│   ├── results.json                 # Cross-validation performance metrics
│   ├── event_backtest.json          # Severe historical event backtest metrics
│   └── claims_table.json            # Pitch deck claims audit and validation evidence
├── reports/
│   ├── ingest_report.md             # Ingestion classification & hard gate audit
│   ├── data_audit_v2.md             # Data integrity audit & circularity proof
│   ├── model_card.md                # Model card & known operational limitations
│   ├── event_backtest.md            # Comprehensive event backtest report (2019, 2020, 2022)
│   ├── drought_index_report.md      # Drought module audit & 2014-2025 index timeline report
│   ├── drought_index_timeline.png   # 2014-2025 statewide drought timeline visualization
│   ├── priority_ranking_sensitivity.csv # Weight sensitivity table
│   └── *.png                        # LOYO evaluation, backtest timelines, reliability diagrams & hit charts
├── outputs/
│   ├── flood_zones.geojson          # 33-district polygon priority map
│   ├── flood_extent_2019_07.geojson # Sentinel-1 SAR flood footprint vector layer
│   ├── extent_summary.json          # Extent metrics, thresholds, dates, scene counts, and non-independence caveat
│   ├── flood_predictions_*.json     # Precomputed flood monthly predictions
│   ├── drought_predictions_*.json   # Precomputed drought monthly predictions (72 periods, 2014-2025)
│   └── pipeline_verification_summary.json # Pipeline check run summary
└── tests/                           # Pytest suite (46 passing unit, integration, contract & multi-hazard tests)
```

---

## 3. Methodological Honesty & Operational Rules

1. **Never Mix Label Families**: Satellite-observed SAR labels (`sentinel1_derived`) and synthetic district-month figures (`synthetic_augmentation`) are strictly partitioned. Synthetic numbers are used exclusively for structural pipeline verification (M7) and never for headline metrics or operational forecasts.
2. **Degraded Mode Guard**: If Earth Engine Sentinel-1 SAR flood files are absent in the input archive, the pipeline automatically enters **Degraded Mode**, executes the secondary synthetic severity model (M7), and stamps `"PIPELINE CHECK ONLY - no observed-derived labels"` on all outputs without emitting operational predictions.
3. **Synthetic Circularity Proof**: As audited in `reports/data_audit_v2.md`, synthetic affected population totals are a virtually constant fraction (0.911 to 0.960) of official statewide anchors every year. Validating a synthetic-trained model against official anchors is mathematically circular.
4. **Zero Temporal Leakage**: Climatologies, anomalies, and percent ranks are computed strictly in-fold during Leave-One-Year-Out (LOYO) cross-validation.
5. **SAR Extent Independence Caveat**: Because the primary training label generation (`s1_water_freq`) and the single-event SAR footprint both utilize Sentinel-1 IW VV thresholding and terrain masks (SRTM/MERIT/JRC), the resulting footprint and training labels are **not independent evidence** of each other. External validation strictly requires ground truth or independent reference layers (e.g. Bhuvan / Copernicus EMS).

---

## 4. Sentinel-1 SAR Flood Extent Extraction

### Earth Engine Extent Script (`sar/export_extent_ee.py`)
Run on Earth Engine to extract a high-resolution flood extent footprint for any target monsoon event:
```bash
# 1. Authenticate with Earth Engine
earthengine authenticate

# 2. Dry run check
python sar/export_extent_ee.py --dry-run

# 3. Submit Drive export tasks (defaults to peak flooded event window, or specify --year --month)
python sar/export_extent_ee.py --year 2020 --month 7 --drive-folder OrbitGuard_SAR_Extent
```

### Local Post-Processing & Validation (`sar/extent.py`)
Processes exported Drive deliverables (or calibrated proxy when running verification offline):
```bash
# Process extent footprint and update monthly prediction JSONs
python sar/extent.py --year 2019 --month 7

# Or invoke directly via model interface:
# from hazards.flood import FloodHazard
# FloodHazard().extent("2019-07")
```

---

## 4. Google Earth Engine (GEE) Data Generation

To extract real Sentinel-1 SAR flood coverage and CHIRPS precipitation grids:
```bash
# 1. Install Google Earth Engine API
pip install earthengine-api

# 2. Authenticate
earthengine authenticate

# 3. Submit Drive export tasks
python gee/export_flood_features.py --drive-folder OrbitGuard_Assam_GEE
```
Once tasks complete in GEE, download the exported CSVs from Google Drive, place them in `data/raw/`, and run `python run_pipeline.py --force`.

---

## 5. Drought Hazard Module (Index-Based Multi-Hazard Extension)

OrbitGuard implements a multi-hazard architecture polymorphic with `BaseHazardModel` and shared ranking (`core/ranking.py`).

### Methodological Principles & Formulae
- **Module Label**: `Demo: index-based`
- **Warning String**: `DEMO: INDEX-BASED - Agricultural & Meteorological Drought Index (SPI-3 + VCI)`
- **Standardized Precipitation Index (SPI-1, SPI-3, SPI-6)**:
  Fitted via Thom's (1958) Maximum Likelihood Estimation with zero-precipitation adjustment:
  $$H(x) = q + (1 - q) \cdot G(x), \quad z = \text{norm.ppf}(H(x))$$
- **Zero Temporal Leakage**: Reference climatological baseline strictly excludes the evaluated year ($Y$) during all backtests and index computations.
- **Vegetation Condition Index (VCI)**:
  Computed from multi-year MODIS NDVI min-max:
  $$\text{VCI} = \frac{\text{NDVI} - \text{NDVI}_{\min}}{\text{NDVI}_{\max} - \text{NDVI}_{\min}} \times 100$$
- **Combined Index Weights**:
  $$\text{Index} = 0.6 \cdot z(\text{SPI-3}) + 0.4 \cdot z(\text{VCI})$$
  *Assumption*: Weights 3-month seasonal precipitation deficit at 60% and satellite vegetative moisture stress at 40%.
- **Uncertainty Quantification**:
  Prediction intervals $[p_{\text{low}}, p_{\text{mid}}, p_{\text{high}}]$ are derived from the divergence across SPI timescales (std of SPI-1/3/6) and a 20-fold bootstrap of the Gamma fit parameters.
- **Shared Response Prioritization**:
  Drought and flood predictions feed directly into the identical `compute_exposure_and_priority` function (`core/ranking.py`), guaranteeing uniform API contracts and vulnerability scoring across all hazards.

### Earth Engine Drought Baseline Script (`gee/export_drought_features.py`)
Prepares 1991–2025 monthly CHIRPS precipitation (30-year SPI baseline) and 2000–2025 MODIS MOD13A3 NDVI collections for Google Drive export:
```bash
# Validate setup without connecting to live Earth Engine
python gee/export_drought_features.py --dry-run

# Launch export tasks to Google Drive
python gee/export_drought_features.py --start-year 1991 --end-year 2025 --drive-folder OrbitGuard_Drought_EE
```
