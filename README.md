# OrbitGuard — Assam basin MVP (Team Asguardians // S75)

Flood early-warning + response prioritisation demo. FastAPI + LightGBM backend, React + vanilla Leaflet frontend.
The frontend works standalone (LOCAL ENGINE) if the backend is off.

## Run
```bash
# backend (terminal 1)
cd backend
pip install -r requirements.txt
python train_model.py        # optional: main.py trains automatically if models/orbitguard_lgbm.pkl is missing
uvicorn main:app --port 8000

# frontend (terminal 2)
cd frontend
npm install
npm run dev                  # http://localhost:5173
# optional: VITE_API_BASE=http://host:8000 npm run dev
```
Keys: `1` `2` `3` = day, `Space` = play/pause replay.

## What is real and what is not (say this to the jury)
- **Real:** the pipeline. Three LightGBM quantile models (P10/P50/P90), conformal (CQR) calibration of the band,
  per-district SHAP contributions, risk x exposure ranking, the API, the UI, the offline fallback.
- **Synthetic:** the training data (4,000 rows drawn from a documented latent function + noise).
  Holdout F1 / Brier / band coverage are measured against that generator. They show the pipeline works,
  **not** real-world forecast skill. They are never presented as real-flood accuracy.
- **Output is a risk index in [0,1]** (P50 with P10-P90 band), not a calibrated flood probability.
- **Illustrative inputs:** district rainfall (Dhemaji = 11/12/20 mm to match the deck), exposure scores, floodplain
  fractions, boundaries (schematic polygons). Population is approx. 2011 census, rounded.
- **SAR flood extent** is a schematic corridor that widens with forecast day and local risk. It is not Sentinel-1 output.
- **Orbital module** is a planned-module preview with placeholder satellites. No CelesTrak data is connected.
- **Not computed, shown as n/a:** SAR-Bhuvan overlap, satellite counts. "Alerts" = districts at MODERATE/HIGH tier.
- **LOCAL ENGINE** evaluates the analytic generator (not LightGBM), so numbers and close ranks can differ slightly
  from FASTAPI LGBM. The engine pill always shows which one answered.

## Honest next steps (for Q&A)
Replace synthetic data with MOSDAC/IMERG rainfall + labelled Assam flood events (Bhuvan / Sentinel-1 extents),
use time-based and leave-one-year-out validation, real district boundaries, real exposure data, then backtest.

## API
`GET /api/health` · `GET /api/dashboard?day=1..3&rain_boost=0..30` · `GET /api/flood-extent?day=1..3&rain_boost=0..30`
Shared inputs live in `backend/data/spec.json` (copy in `frontend/src/data/spec.json`; keep them identical).
