# Contributing

Use synthetic or properly de-identified fixtures only. Run `python3 ml/train_model.py`, `python3 -m unittest discover -s tests -v`, and `node --test tests/*.test.js` before proposing a change. Any model or policy change must update its version, evaluation artifact, model/data card and audit fixture. Never add credentials, personal data, hidden production connectors or autonomous credit actions.
