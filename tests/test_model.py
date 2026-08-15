import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.train_model import COHORTS, build_scenario_forecast, engineer_features, generate_history


class ModelContractTest(unittest.TestCase):
    def test_features_do_not_use_future_rows(self):
        import numpy as np

        raw = generate_history(np.random.default_rng(7), n_entities=6)
        features = engineer_features(raw)
        self.assertFalse(features.isna().any().any())
        self.assertTrue((features["week"] >= 52).all())

    def test_every_scenario_has_ordered_26_week_intervals(self):
        for cohort in COHORTS:
            scenario = build_scenario_forecast(cohort)
            self.assertEqual(len(scenario["weeks"]), 26)
            for low, middle, high in zip(scenario["p10"], scenario["p50"], scenario["p90"]):
                self.assertLessEqual(low, middle)
                self.assertLessEqual(middle, high)

    def test_checked_in_artifact_is_honestly_labelled(self):
        artifact = json.loads((ROOT / "artifacts" / "model_metrics.json").read_text())
        self.assertEqual(artifact["status"], "prototype_evaluation_on_synthetic_data")
        self.assertIn("never sanctions", artifact["decision_boundary"].lower())
        self.assertEqual(len(artifact["scenarios"]), 3)
        self.assertLess(artifact["forecast_evaluation"]["aggregate"]["mase"], 1.0)


if __name__ == "__main__":
    unittest.main()
