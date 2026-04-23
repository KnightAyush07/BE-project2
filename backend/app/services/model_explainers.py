import math
from functools import lru_cache

import numpy as np
import shap
from lime.lime_tabular import LimeTabularExplainer
from sklearn.ensemble import RandomForestClassifier


FEATURE_NAMES = [
    "ats_score",
    "ats_match_percent",
    "oa_percentage",
    "interview_percentage",
    "oa_tab_switches",
    "interview_tab_switches",
]


def _safe_number(value, default=0.0) -> float:
    try:
        if value is None:
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _feature_vector(candidate: dict) -> np.ndarray:
    return np.array(
        [
            _safe_number(candidate.get("ats_score")),
            _safe_number(candidate.get("ats_match_percent")),
            _safe_number(candidate.get("oa_percentage")),
            _safe_number(candidate.get("interview_percentage")),
            _safe_number(candidate.get("oa_tab_switches")),
            _safe_number(candidate.get("interview_tab_switches")),
        ],
        dtype=float,
    )


def _business_rule_probability(row: np.ndarray) -> float:
    ats_score, ats_match, oa_pct, interview_pct, oa_switches, interview_switches = row.tolist()

    raw_score = (
        0.28 * ats_score
        + 0.12 * ats_match
        + 0.28 * oa_pct
        + 0.32 * interview_pct
        - 5.0 * oa_switches
        - 6.0 * interview_switches
    )
    centered = (raw_score - 52.0) / 10.0
    return 1.0 / (1.0 + math.exp(-centered))


def _training_matrix(seed: int = 42, samples: int = 900) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    ats_score = rng.uniform(25, 96, samples)
    ats_match = rng.uniform(10, 100, samples)
    oa_pct = rng.choice(
        [0.0, *np.linspace(20, 100, 17)],
        size=samples,
        p=[0.12] + [0.88 / 17] * 17,
    )
    interview_pct = rng.choice(
        [0.0, *np.linspace(20, 100, 17)],
        size=samples,
        p=[0.20] + [0.80 / 17] * 17,
    )
    oa_switches = rng.integers(0, 6, samples)
    interview_switches = rng.integers(0, 6, samples)

    X = np.column_stack(
        [
            ats_score,
            ats_match,
            oa_pct,
            interview_pct,
            oa_switches,
            interview_switches,
        ]
    )
    probabilities = np.array([_business_rule_probability(row) for row in X])
    y = (probabilities >= 0.5).astype(int)
    return X, y


@lru_cache(maxsize=1)
def _explainer_bundle():
    X, y = _training_matrix()
    model = RandomForestClassifier(
        n_estimators=160,
        max_depth=6,
        min_samples_leaf=4,
        random_state=42,
    )
    model.fit(X, y)
    shap_explainer = shap.TreeExplainer(model)
    lime_explainer = LimeTabularExplainer(
        X,
        feature_names=FEATURE_NAMES,
        class_names=["hold", "advance"],
        discretize_continuous=True,
        mode="classification",
        random_state=42,
    )
    return model, shap_explainer, lime_explainer, X


def _normalize_shap_values(raw_values) -> np.ndarray:
    values = np.array(raw_values)
    if values.ndim == 1:
        return values
    if values.ndim == 2:
        return values[0]
    if values.ndim == 3:
        return values[0, :, -1]
    return values.reshape(-1)[: len(FEATURE_NAMES)]


def _safe_shap_items(shap_explainer, features: np.ndarray) -> list[dict]:
    shap_values = shap_explainer.shap_values(np.array([features]), check_additivity=False)
    shap_vector = _normalize_shap_values(shap_values)
    shap_items = []
    for index, impact in enumerate(shap_vector):
        shap_items.append(
            {
                "feature": FEATURE_NAMES[index],
                "value": round(float(features[index]), 2),
                "impact": round(float(impact), 4),
                "direction": "positive" if float(impact) >= 0 else "negative",
            }
        )
    shap_items.sort(key=lambda item: abs(item["impact"]), reverse=True)
    return shap_items[:4]


def _safe_lime_items(lime_explainer, model, features: np.ndarray) -> list[dict]:
    lime_exp = lime_explainer.explain_instance(
        features,
        model.predict_proba,
        num_features=min(4, len(FEATURE_NAMES)),
        top_labels=1,
    )
    label = None
    if getattr(lime_exp, "available_labels", None):
        labels = lime_exp.available_labels()
        if labels:
            label = labels[0]
    if label is None:
        local_exp = getattr(lime_exp, "local_exp", {}) or {}
        if local_exp:
            label = next(iter(local_exp.keys()))

    if label is None:
        return []

    return [
        {
            "feature_rule": rule,
            "weight": round(float(weight), 4),
            "direction": "positive" if float(weight) >= 0 else "negative",
        }
        for rule, weight in lime_exp.as_list(label=label)
    ]


def explain_candidate_model(candidate: dict) -> dict:
    model, shap_explainer, lime_explainer, _background = _explainer_bundle()
    features = _feature_vector(candidate)
    probability = float(model.predict_proba([features])[0][1])
    try:
        shap_items = _safe_shap_items(shap_explainer, features)
    except Exception:
        shap_items = []

    try:
        lime_items = _safe_lime_items(lime_explainer, model, features)
    except Exception:
        lime_items = []

    return {
        "surrogate_model": "RandomForestClassifier",
        "target": "advance_probability",
        "advance_probability": round(probability * 100, 2),
        "shap_top_features": shap_items,
        "lime_local_rules": lime_items,
    }
