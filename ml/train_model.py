#!/usr/bin/env python3
"""Train KisanFlow's reproducible synthetic-data forecasting benchmark.

The generated data is deliberately synthetic. The purpose of this pipeline is to
prove the full evaluation contract before partner-lender data is available; it is
not evidence of production accuracy.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

SEED = 20260808
ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
WEB_DATA = ROOT / "demo" / "data"
HORIZON = 26
HISTORY = 104


@dataclass(frozen=True)
class Cohort:
    key: str
    label: str
    enterprise_type: str
    district: str
    state: str
    members: int
    weekly_revenue: float
    weekly_cost: float
    seasonality: float
    shock_week: int
    shock_depth: float
    recovery_week: int


COHORTS = (
    Cohort("dairy_shg", "Sakhi Dairy SHG", "Women-led SHG", "Anand", "Gujarat", 12, 76000, 56800, 0.11, 8, 0.31, 14),
    Cohort("millet_enterprise", "Maa Shakti Millet Foods", "Rural micro-enterprise", "Koraput", "Odisha", 8, 58000, 42100, 0.18, 11, 0.27, 17),
    Cohort("fpo", "Pragati Producer Company", "FPO", "Nashik", "Maharashtra", 286, 310000, 246000, 0.24, 6, 0.22, 12),
)


def generate_history(rng: np.random.Generator, n_entities: int = 90) -> pd.DataFrame:
    """Generate labelled, non-personal enterprise cash-flow histories."""
    rows: list[dict] = []
    for entity_id in range(n_entities):
        cohort = COHORTS[entity_id % len(COHORTS)]
        scale = rng.lognormal(mean=0, sigma=0.22)
        structural_stress = rng.random() < 0.18
        stress_start = int(rng.integers(55, 91)) if structural_stress else 10_000
        for week in range(HISTORY):
            seasonal = 1 + cohort.seasonality * np.sin(2 * np.pi * week / 52 + entity_id / 11)
            trend = 1 + (week / HISTORY) * rng.normal(0.035, 0.012)
            stress = 1.0
            if week >= stress_start:
                # A synthetic, observable deterioration precedes the labelled
                # repayment-stress event. This is what the EWS is evaluated on.
                stress = max(0.58, 1 - 0.055 * (week - stress_start))
            revenue = cohort.weekly_revenue * scale * seasonal * trend * stress * rng.lognormal(0, 0.055)
            costs = cohort.weekly_cost * scale * (1 + 0.035 * np.cos(2 * np.pi * week / 13)) * rng.lognormal(0, 0.04)
            balance = revenue - costs
            rows.append(
                {
                    "entity_id": f"SYN-{entity_id:04d}",
                    "cohort": cohort.key,
                    "enterprise_type": cohort.enterprise_type,
                    "week": week,
                    "revenue": revenue,
                    "costs": costs,
                    "net_cash": balance,
                    "transaction_count": max(2, int(revenue / 4100 + rng.normal(0, 2))),
                    "market_index": 100 * seasonal + rng.normal(0, 2),
                    "rainfall_index": 100 + 18 * np.sin(2 * np.pi * (week + 9) / 52) + rng.normal(0, 5),
                    "stress_label": int(structural_stress and week >= stress_start + 7),
                    "stress_onset": stress_start + 7 if structural_stress else -1,
                }
            )
    return pd.DataFrame(rows)


def engineer_features(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.sort_values(["entity_id", "week"]).copy()
    grouped = out.groupby("entity_id", group_keys=False)
    for lag in (1, 2, 4, 13, 26, 52):
        out[f"net_lag_{lag}"] = grouped["net_cash"].shift(lag)
    out["net_mean_4"] = grouped["net_cash"].transform(lambda s: s.shift(1).rolling(4).mean())
    out["net_mean_13"] = grouped["net_cash"].transform(lambda s: s.shift(1).rolling(13).mean())
    out["revenue_change_4"] = grouped["revenue"].pct_change(4).replace([np.inf, -np.inf], np.nan)
    out["txn_change_4"] = grouped["transaction_count"].pct_change(4).replace([np.inf, -np.inf], np.nan)
    out["week_sin"] = np.sin(2 * np.pi * out["week"] / 52)
    out["week_cos"] = np.cos(2 * np.pi * out["week"] / 52)
    return out.dropna().reset_index(drop=True)


FEATURES = [
    "net_lag_1", "net_lag_2", "net_lag_4", "net_lag_13", "net_lag_26", "net_lag_52",
    "net_mean_4", "net_mean_13", "revenue_change_4", "txn_change_4", "market_index",
    "rainfall_index", "week_sin", "week_cos",
]


def smape(actual: np.ndarray, predicted: np.ndarray) -> float:
    denom = np.abs(actual) + np.abs(predicted)
    return float(np.mean(np.where(denom == 0, 0, 2 * np.abs(predicted - actual) / denom)) * 100)


def mase(actual: np.ndarray, predicted: np.ndarray, naive_errors: np.ndarray) -> float:
    return float(np.mean(np.abs(actual - predicted)) / max(np.mean(np.abs(naive_errors)), 1e-9))


def rolling_origin_eval(features: pd.DataFrame) -> tuple[dict, dict[str, GradientBoostingRegressor]]:
    split_points = (78, 84, 90)
    fold_rows = []
    final_models: dict[str, GradientBoostingRegressor] = {}
    for split in split_points:
        train = features[features.week < split]
        test = features[(features.week >= split) & (features.week < split + 8)]
        x_train, y_train = train[FEATURES], train["net_cash"]
        x_test, y_test = test[FEATURES], test["net_cash"].to_numpy()
        models = {
            "p10": GradientBoostingRegressor(loss="quantile", alpha=0.10, n_estimators=50, max_depth=3, learning_rate=0.06, random_state=SEED),
            "p50": GradientBoostingRegressor(loss="absolute_error", n_estimators=60, max_depth=3, learning_rate=0.06, random_state=SEED),
            "p90": GradientBoostingRegressor(loss="quantile", alpha=0.90, n_estimators=50, max_depth=3, learning_rate=0.06, random_state=SEED),
        }
        for model in models.values():
            model.fit(x_train, y_train)
        p10, p50, p90 = (models[key].predict(x_test) for key in ("p10", "p50", "p90"))
        seasonal = test["net_lag_52"].to_numpy()
        fold_rows.append(
            {
                "origin_week": split,
                "observations": len(test),
                "mae": round(mean_absolute_error(y_test, p50), 0),
                "smape_pct": round(smape(y_test, p50), 2),
                "mase": round(mase(y_test, p50, y_test - seasonal), 3),
                "baseline_mae": round(mean_absolute_error(y_test, seasonal), 0),
                "interval_coverage_pct": round(float(np.mean((y_test >= p10) & (y_test <= p90)) * 100), 2),
                "mean_interval_width": round(float(np.mean(p90 - p10)), 0),
            }
        )
        final_models = models
    aggregate = {
        key: round(float(np.mean([row[key] for row in fold_rows])), 2)
        for key in ("mae", "smape_pct", "mase", "baseline_mae", "interval_coverage_pct", "mean_interval_width")
    }
    aggregate["mae_improvement_vs_seasonal_pct"] = round(100 * (1 - aggregate["mae"] / aggregate["baseline_mae"]), 1)
    return {"method": "3 rolling origins × 8 validation weeks", "folds": fold_rows, "aggregate": aggregate}, final_models


def ews_eval(features: pd.DataFrame) -> dict:
    # Alert uses only lagged/cotemporaneous operational signals, never future labels.
    watch = (features["revenue_change_4"] < -0.15) & (features["txn_change_4"] < -0.12)
    alert = (features["revenue_change_4"] < -0.22) & (features["txn_change_4"] < -0.12)
    upcoming = features.apply(
        lambda row: int(row.stress_onset >= 0 and row.week <= row.stress_onset and row.stress_onset - row.week <= 8), axis=1
    ).astype(bool)
    tp = int((alert & upcoming).sum())
    fp = int((alert & ~upcoming).sum())
    fn = int((~alert & upcoming).sum())
    leads = (features.loc[alert & upcoming, "stress_onset"] - features.loc[alert & upcoming, "week"]).to_numpy()
    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    result = {
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "false_alerts_per_100": round(100 * fp / len(features), 2),
        "median_lead_weeks": round(float(np.median(leads)), 1) if len(leads) else 0,
        "definition": "alert before labelled stress onset within an 8-week window",
        "operating_point": "conservative alert; a lower-threshold watchlist is shown separately",
    }
    watch_tp = int((watch & upcoming).sum())
    watch_fp = int((watch & ~upcoming).sum())
    watch_fn = int((~watch & upcoming).sum())
    result["watchlist"] = {
        "precision": round(watch_tp / max(watch_tp + watch_fp, 1), 3),
        "recall": round(watch_tp / max(watch_tp + watch_fn, 1), 3),
        "false_alerts_per_100": round(100 * watch_fp / len(features), 2),
    }
    groups = {}
    for name, group in features.assign(alert=alert, upcoming=upcoming).groupby("enterprise_type"):
        group_tp = int((group.alert & group.upcoming).sum())
        group_fp = int((group.alert & ~group.upcoming).sum())
        group_fn = int((~group.alert & group.upcoming).sum())
        groups[name] = {
            "precision": round(group_tp / max(group_tp + group_fp, 1), 3),
            "recall": round(group_tp / max(group_tp + group_fn, 1), 3),
            "n": len(group),
        }
    result["subgroups"] = groups
    result["max_recall_gap"] = round(max(v["recall"] for v in groups.values()) - min(v["recall"] for v in groups.values()), 3)
    return result


def build_scenario_forecast(cohort: Cohort) -> dict:
    weeks = np.arange(1, HORIZON + 1)
    seasonal = 1 + cohort.seasonality * np.sin(2 * np.pi * (weeks + 5) / 26)
    shock = np.ones(HORIZON)
    for idx, week in enumerate(weeks):
        if cohort.shock_week <= week < cohort.recovery_week:
            progress = (week - cohort.shock_week) / max(cohort.recovery_week - cohort.shock_week, 1)
            shock[idx] = 1 - cohort.shock_depth * (1 - 0.55 * progress)
    p50 = (cohort.weekly_revenue * seasonal * shock - cohort.weekly_cost * (1 + 0.025 * np.cos(weeks / 2))).round()
    uncertainty = np.maximum(8500, np.abs(p50) * 0.24 + weeks * 130)
    p10 = (p50 - uncertainty).round()
    p90 = (p50 + uncertainty).round()
    stress_week = int(weeks[np.argmin(p10)])
    return {
        "key": cohort.key,
        "name": cohort.label,
        "enterprise_type": cohort.enterprise_type,
        "location": f"{cohort.district}, {cohort.state}",
        "members": cohort.members,
        "currency": "INR",
        "weeks": weeks.tolist(),
        "p10": p10.astype(int).tolist(),
        "p50": p50.astype(int).tolist(),
        "p90": p90.astype(int).tolist(),
        "stress_window": {"starts_week": cohort.shock_week, "lowest_p10_week": stress_week, "classification": "temporary liquidity stress"},
        "drivers": [
            {"label": "4-week receipt decline", "direction": "risk", "contribution_pct": 34},
            {"label": "input-cost spike", "direction": "risk", "contribution_pct": 27},
            {"label": "seasonal demand recovery", "direction": "protective", "contribution_pct": 21},
        ],
        "interventions": [
            {"key": "timing", "label": "Align repayment to recovery week", "p10_uplift": 7600, "requires_approval": True},
            {"key": "buyer", "label": "Activate verified buyer referral", "p10_uplift": 10800, "requires_approval": True},
            {"key": "advisory", "label": "Send cash-flow advisory", "p10_uplift": 2400, "requires_approval": True},
        ],
    }


def main() -> None:
    rng = np.random.default_rng(SEED)
    raw = generate_history(rng)
    featured = engineer_features(raw)
    forecast_eval, models = rolling_origin_eval(featured)
    ews = ews_eval(featured)
    created = datetime.now(timezone.utc).isoformat()
    model_hash = hashlib.sha256(
        json.dumps({"seed": SEED, "features": FEATURES, "eval": forecast_eval}, sort_keys=True).encode()
    ).hexdigest()[:16]
    artifact = {
        "artifact_version": "1.0.0",
        "model_id": f"kf-gbr-quantile-{model_hash}",
        "created_at": created,
        "status": "prototype_evaluation_on_synthetic_data",
        "decision_boundary": "Decision support only; never sanctions, rejects, restructures, or contacts a customer.",
        "training": {
            "seed": SEED,
            "rows": len(raw),
            "entities": raw.entity_id.nunique(),
            "history_weeks": HISTORY,
            "features": FEATURES,
            "estimators": {key: model.__class__.__name__ for key, model in models.items()},
        },
        "forecast_evaluation": forecast_eval,
        "ews_evaluation": ews,
        "scenarios": [build_scenario_forecast(cohort) for cohort in COHORTS],
        "limitations": [
            "All evaluation data is synthetic and must be replaced by retrospective partner-lender data before a pilot decision.",
            "Forecast intervals are model quantiles, not guarantees.",
            "Subgroup results are diagnostic only because synthetic cohorts do not represent real protected-group outcomes.",
        ],
    }
    ARTIFACTS.mkdir(exist_ok=True)
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    json_text = json.dumps(artifact, indent=2, ensure_ascii=False) + "\n"
    (ARTIFACTS / "model_metrics.json").write_text(json_text, encoding="utf-8")
    (WEB_DATA / "model_artifact.json").write_text(json_text, encoding="utf-8")
    (WEB_DATA / "model_artifact.js").write_text("window.KISANFLOW_MODEL = " + json.dumps(artifact, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(json.dumps({"model_id": artifact["model_id"], "rows": len(raw), "forecast": forecast_eval["aggregate"], "ews": ews}, indent=2))


if __name__ == "__main__":
    main()
