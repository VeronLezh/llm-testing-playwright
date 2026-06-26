import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HISTORY_DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/score-history');

export class ScoreTracker {
  constructor(suiteName, { maxDrift = 0.5 } = {}) {
    this.suiteName = suiteName;
    this.maxDrift = maxDrift;
    this.scores = {};
    this.metrics = {};
  }

  record(id, score) {
    this.scores[id] = score;
  }

  recordMetrics(id, metricsObj) {
    this.metrics[id] = metricsObj;
  }

  save() {
    mkdirSync(HISTORY_DIR, { recursive: true });
    const file = join(HISTORY_DIR, `${this.suiteName}.json`);
    let history = [];
    if (existsSync(file)) {
      try { history = JSON.parse(readFileSync(file, 'utf8')); } catch { history = []; }
    }

    const values = Object.values(this.scores);
    const currentAvg = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;

    const entry = {
      date: new Date().toISOString(),
      scores: this.scores,
      metrics: this.metrics,
      avg: currentAvg,
    };

    const previous = history[history.length - 1];
    let pass = true;
    let reason = 'No baseline yet';

    if (previous?.avg != null && currentAvg != null) {
      const drift = previous.avg - currentAvg;
      pass = drift <= this.maxDrift;
      reason = pass
        ? `Score stable: ${previous.avg.toFixed(2)} -> ${currentAvg.toFixed(2)}`
        : `Score dropped: ${previous.avg.toFixed(2)} -> ${currentAvg.toFixed(2)} (drift ${drift.toFixed(2)} > ${this.maxDrift})`;
    }

    history.push(entry);
    if (history.length > 50) history.splice(0, history.length - 50);
    writeFileSync(file, JSON.stringify(history, null, 2));

    return { pass, reason, drift: previous?.avg != null ? previous.avg - currentAvg : 0 };
  }
}
