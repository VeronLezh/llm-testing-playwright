# Judge calibration

An LLM judge is only as useful as its agreement with a human reviewer. This checks how far
the judge in `JudgeClient` can be trusted: how closely it matches human labels, how steady it
is between runs, and — most importantly — whether it ever accepts an answer a human would reject.

## How to label (`tests/llm/fixtures/calibration/labels.json`)

Score each of the 30 responses in `cases.json` with **one integer, 1–5**, as a human reviewer.

Judge only what the judge sees: the **user prompt** and the **response**, on the same three criteria
`JudgeClient` uses by default.

| Criterion | 1 | 5 |
|---|---|---|
| relevance | off topic | perfectly on topic |
| completeness | missing most key points | complete |
| correctness | wrong | right |

Overall score: **5** excellent · **4** good, minor gap · **3** acceptable, clear weakness ·
**2** poor · **1** unacceptable (wrong, off topic, or misleading).

Rules, so the labels stay honest:
- Label **before** running the judge and don't change labels after you see its scores.
- Don't score style, length or bank policy: the judge is not given the system prompt.
- Go through the cases in file order; the order is shuffled on purpose.
- Use the whole scale, and when unsure between two numbers pick the lower one.

## Run

```bash
npm run calibrate        # 30 cases x 3 runs ≈ 90 small judge calls
```

Writes `tests/llm/fixtures/calibration/report.json` and prints a summary.
`JUDGE_PROVIDER` (falls back to `LLM_PROVIDER`) selects the judge; `CALIBRATION_RUNS` changes repeats.

## What the numbers mean

| Metric | Reading |
|---|---|
| Spearman ρ | Does the judge rank answers in the same order as a human? ≥ 0.8 good |
| Weighted kappa | Agreement beyond chance, penalising big misses. 0.6–0.8 substantial, > 0.8 strong |
| Exact / within ±1 | Plain agreement on the 1–5 scale |
| Bias | Positive = judge is more lenient than the human |
| **False pass** | Human would fail it (< 3.0), judge passes it. The dangerous direction |
| Run-to-run range | How much the same case moves between runs. High = thresholds are noise |

With 30 cases the numbers are indicative, not precise — treat them as a smoke check on the judge,
not a benchmark. Re-run after changing the judge model or the judge prompt.
