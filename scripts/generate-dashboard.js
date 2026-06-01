import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const SUITES = ['regression', 'semantic', 'security', 'compliance'];

function readHistory(suite) {
  const file = `tests/llm/fixtures/score-history/${suite}.json`;
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
}

function buildDashboard() {
  const data = Object.fromEntries(SUITES.map(s => [s, readHistory(s)]));
  const suiteStatus = existsSync('tests/llm/fixtures/score-history/suite-status.json')
    ? JSON.parse(readFileSync('tests/llm/fixtures/score-history/suite-status.json', 'utf8'))
    : {};

  const latest = Object.fromEntries(SUITES.map(s => [s, data[s].at(-1) ?? null]));

  const drift = Object.fromEntries(
    SUITES.map(s => {
      const h = data[s];
      if (h.length < 2) return [s, null];
      return [s, (h.at(-1).avg - h.at(-2).avg).toFixed(2)];
    })
  );

  const worstCases = latest.regression
    ? Object.entries(latest.regression.scores)
        .sort(([, a], [, b]) => a - b)
        .slice(0, 3)
    : [];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LLM Evaluation Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f5f5f5; margin: 0; }
    header { background: #016CE2; color: white; padding: 16px 24px; font-size: 18px; font-weight: bold; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; padding: 24px; }
    .card { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .card h3 { font-size: 11px; color: #888; text-transform: uppercase; margin: 0 0 8px; }
    .score { font-size: 32px; font-weight: bold; }
    .green { color: #16a34a; } .red { color: #dc2626; } .yellow { color: #d97706; }
    .section { padding: 0 24px 24px; }
    .section h2 { font-size: 13px; color: #666; text-transform: uppercase; margin-bottom: 12px; }
    .suite-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
    .suite-card { background: white; border-radius: 8px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .bar { height: 6px; background: #e5e7eb; border-radius: 3px; margin: 8px 0; }
    .bar-fill { height: 6px; border-radius: 3px; }
  </style>
</head>
<body>
<header>LLM Evaluation Dashboard</header>

<div class="grid">
  ${SUITES.map(s => {
    const run = latest[s];
    const avg = run?.avg?.toFixed(2) ?? '—';
    const d = drift[s];
    const color = !run ? '' : avg >= 4 ? 'green' : avg >= 3 ? 'yellow' : 'red';
    const driftStr = d !== null ? ` <small>(${d > 0 ? '+' : ''}${d} vs prev)</small>` : '';
    return `<div class="card">
      <h3>${s}</h3>
      <div class="score ${color}">${avg}${driftStr}</div>
      <small>${run?.date ? new Date(run.date).toLocaleDateString() : 'no data'}</small>
    </div>`;
  }).join('')}
</div>

<div class="section">
  <h2>Suite Health</h2>
  <div class="suite-grid">
    ${Object.entries(suiteStatus).map(([name, s]) => {
      const icon = s.status === 'pass' ? '✓' : s.status === 'warn' ? '△' : '✗';
      const color = s.status === 'pass' ? 'green' : s.status === 'warn' ? 'yellow' : 'red';
      return `<div class="suite-card">
        <strong>${name}</strong><br>
        <span class="${color}">${icon}</span> ${s.passed}/${s.total} passed
        <small style="display:block;color:#999">${new Date(s.date).toLocaleDateString()}</small>
      </div>`;
    }).join('')}
  </div>
</div>

<div class="section">
  <h2>Top Failures - Worst Cases</h2>
  <div class="suite-grid">
    ${worstCases.map(([id, score]) => {
      const pct = (score / 5 * 100).toFixed(0);
      const color = score < 2 ? '#dc2626' : score < 3.5 ? '#d97706' : '#16a34a';
      return `<div class="suite-card">
        <strong>${id}</strong>
        <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span style="color:${color};font-size:20px;font-weight:bold">${score.toFixed(2)}</span>
      </div>`;
    }).join('')}
  </div>
</div>

</body></html>`;

  mkdirSync('dashboard', { recursive: true });
  writeFileSync('dashboard/report.html', html);
  console.log('Dashboard generated: dashboard/report.html');
}

buildDashboard();
