'use strict';

// ---------- Konfiguration ----------

const STORAGE_KEY = 'symptomtagebuch.v1';

// Skalen: bei allen Symptomen gilt "höher = schlimmer", nur Schlafqualität ist "höher = besser".
const SCALES = [
  { key: 'schlafQualitaet', label: 'Schlafqualität', min: 1, max: 5, def: null,
    names: ['Sehr schlecht', 'Schlecht', 'Mittelmäßig', 'Gut', 'Sehr gut'] },
  { key: 'muedigkeit', label: 'Müdigkeit', min: 1, max: 5, def: null,
    names: ['Gar nicht müde', 'Leicht müde', 'Spürbar müde', 'Sehr müde', 'Völlig erschöpft'] },
  { key: 'antrieb', label: 'Antriebslosigkeit', min: 1, max: 5, def: null,
    names: ['Voller Tatendrang', 'Guter Antrieb', 'Träge', 'Wenig Antrieb', 'Gar kein Antrieb'] },
  { key: 'brainfog', label: 'Brain Fog', min: 1, max: 5, def: null,
    names: ['Klarer Kopf', 'Leicht benebelt', 'Konzentrationsprobleme', 'Starker Brain Fog', 'Denken kaum möglich'] },
  { key: 'kribbelnHaende', label: 'Kribbeln Hände', min: 0, max: 3, def: 0,
    names: ['Kein Kribbeln', 'Leicht', 'Mittel', 'Stark'] },
  { key: 'kribbelnFuesse', label: 'Kribbeln Füße', min: 0, max: 3, def: 0,
    names: ['Kein Kribbeln', 'Leicht', 'Mittel', 'Stark'] },
];
const SCALE_BY_KEY = Object.fromEntries(SCALES.map(s => [s.key, s]));

// ---------- Hilfsfunktionen ----------

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const todayISO = () => toISO(new Date());
const fmtShort = iso => { const [, m, d] = iso.split('-'); return `${d}.${m}.`; };
const fmtLong = iso => fromISO(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtNum = (n, digits = 1) => n == null || Number.isNaN(n) ? '–' : n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ---------- Datenhaltung ----------

function sanitize(raw) {
  if (!raw || typeof raw !== 'object' || !ISO_RE.test(raw.date)) return null;
  const e = { date: raw.date };
  const h = Number(raw.schlafStunden);
  e.schlafStunden = raw.schlafStunden === null || raw.schlafStunden === '' || !Number.isFinite(h) ? null : Math.min(24, Math.max(0, h));
  for (const s of SCALES) {
    const v = raw[s.key];
    const n = Number(v);
    e[s.key] = v === null || v === undefined || v === '' || !Number.isInteger(n) || n < s.min || n > s.max ? null : n;
  }
  e.verstopfung = raw.verstopfung === true;
  e.notizen = typeof raw.notizen === 'string' ? raw.notizen : '';
  e.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString();
  return e;
}

function loadEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(sanitize).filter(Boolean) : [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

let entries = loadEntries();
sortEntries();

function sortEntries() { entries.sort((a, b) => a.date.localeCompare(b.date)); }
function findEntry(date) { return entries.find(e => e.date === date) || null; }

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (err) {
    console.error(err);
    alert('Speichern fehlgeschlagen. Der Browser-Speicher ist evtl. voll oder blockiert.');
    return false;
  }
}

function upsert(entry) {
  entries = entries.filter(e => e.date !== entry.date);
  entries.push(entry);
  sortEntries();
  return persist();
}

// Browser bitten, die Daten nicht automatisch zu löschen (wirkt v. a. bei installierter App)
function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// ---------- Navigation ----------

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  if (name === 'charts') renderCharts();
  if (name === 'data') renderList();
  window.scrollTo(0, 0);
}

$('tabbar').addEventListener('click', e => {
  const btn = e.target.closest('button[data-page]');
  if (btn) showPage(btn.dataset.page);
});

// ---------- Formular ----------

function renderScales() {
  $('scales').innerHTML = SCALES.map(s => {
    const opts = [];
    for (let v = s.min; v <= s.max; v++) {
      opts.push(`<input type="radio" name="${s.key}" id="f-${s.key}-${v}" value="${v}"><label for="f-${s.key}-${v}">${v}</label>`);
    }
    return `<fieldset class="field" data-key="${s.key}">
      <legend>${s.label}</legend>
      <div class="seg">${opts.join('')}</div>
      <div class="seg-value" id="v-${s.key}"></div>
    </fieldset>`;
  }).join('');

  document.querySelectorAll('#scales .seg').forEach(seg => {
    // Erneutes Antippen der gewählten Zahl hebt die Auswahl auf (= nicht erfasst)
    seg.addEventListener('pointerdown', e => {
      const lab = e.target.closest('label');
      if (!lab) return;
      const inp = $(lab.htmlFor);
      inp.dataset.was = inp.checked ? '1' : '';
    });
    seg.addEventListener('click', e => {
      if (e.target.tagName !== 'INPUT') return;
      if (e.target.dataset.was === '1') e.target.checked = false;
      e.target.dataset.was = '';
      updateScaleLabel(e.target.name);
    });
    seg.addEventListener('change', e => updateScaleLabel(e.target.name));
  });
}

function getScale(key) {
  const checked = document.querySelector(`input[name="${key}"]:checked`);
  return checked ? Number(checked.value) : null;
}

function setScale(key, value) {
  document.querySelectorAll(`input[name="${key}"]`).forEach(i => { i.checked = Number(i.value) === value; });
  updateScaleLabel(key);
}

function updateScaleLabel(key) {
  const s = SCALE_BY_KEY[key];
  const v = getScale(key);
  $('v-' + key).textContent = v == null ? 'nicht erfasst' : s.names[v - s.min];
}

let formShowsExisting = false;

function fillForm(entry) {
  $('f-schlafStunden').value = entry && entry.schlafStunden != null ? entry.schlafStunden : '';
  for (const s of SCALES) setScale(s.key, entry ? entry[s.key] : s.def);
  $('f-verstopfung').checked = entry ? entry.verstopfung : false;
  $('f-notizen').value = entry ? entry.notizen : '';
  formShowsExisting = !!entry;
  $('f-date-hint').hidden = !entry;
  $('btnDelete').hidden = !entry;
}

function openDate(date) {
  $('f-date').value = date;
  fillForm(findEntry(date));
}

$('f-date').addEventListener('change', () => {
  const date = $('f-date').value;
  if (!ISO_RE.test(date)) return;
  const existing = findEntry(date);
  // Eingaben für einen neuen Tag behalten, aber einen geladenen alten Eintrag nicht auf ein anderes Datum übertragen
  if (existing || formShowsExisting) fillForm(existing);
});

$('entryForm').addEventListener('submit', e => {
  e.preventDefault();
  const date = $('f-date').value;
  if (!ISO_RE.test(date)) { toast('Bitte ein Datum wählen.'); return; }
  const hoursRaw = $('f-schlafStunden').value;
  const raw = {
    date,
    schlafStunden: hoursRaw === '' ? null : Number(hoursRaw),
    verstopfung: $('f-verstopfung').checked,
    notizen: $('f-notizen').value.trim(),
    updatedAt: new Date().toISOString(),
  };
  for (const s of SCALES) raw[s.key] = getScale(s.key);
  const entry = sanitize(raw);
  if (!upsert(entry)) return;
  requestPersistentStorage();
  toast(`Eintrag für ${fmtShort(date)} gespeichert`);
  fillForm(entry);
});

$('btnDelete').addEventListener('click', () => {
  const date = $('f-date').value;
  if (!findEntry(date)) return;
  if (!confirm(`Eintrag vom ${fmtLong(date)} löschen?`)) return;
  entries = entries.filter(e => e.date !== date);
  persist();
  fillForm(null);
  toast('Eintrag gelöscht');
});

// ---------- Diagramme ----------

const SERIES = {
  muedigkeit: { label: 'Müdigkeit', color: '--c-muede' },
  antrieb: { label: 'Antriebslosigkeit', color: '--c-antrieb' },
  brainfog: { label: 'Brain Fog', color: '--c-fog' },
  schlafStunden: { label: 'Schlafdauer (h)', color: '--c-sleep' },
  schlafQualitaet: { label: 'Schlafqualität', color: '--c-sleep' },
  kribbelnHaende: { label: 'Kribbeln Hände', color: '--c-haende' },
  kribbelnFuesse: { label: 'Kribbeln Füße', color: '--c-fuesse' },
  verstopfung: { label: 'Verstopfung', color: '--c-verst' },
};

/**
 * Zeichnet ein SVG-Diagramm.
 * series: [{ key, type: 'line' | 'bar' | 'marker', values: [] }]
 */
function chartSVG({ dates, yMin, yMax, yTicks, series, title }) {
  const W = 400, H = 190;
  const hasMarker = series.some(s => s.type === 'marker');
  const L = 28, R = 6, T = hasMarker ? 18 : 8, B = 20;
  const pw = W - L - R, ph = H - T - B;
  const n = dates.length;
  const slot = pw / n;
  const cx = i => L + (i + 0.5) * slot;
  const y = v => T + ph * (1 - (v - yMin) / (yMax - yMin));
  const out = [];

  for (const t of yTicks) {
    out.push(`<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`);
    out.push(`<text class="axis-text" x="${L - 5}" y="${y(t) + 3.5}" text-anchor="end">${t}</text>`);
  }
  const step = Math.max(1, Math.ceil(n / 6));
  for (let i = 0; i < n; i += step) {
    out.push(`<text class="axis-text" x="${cx(i)}" y="${H - 5}" text-anchor="middle">${fmtShort(dates[i])}</text>`);
  }

  const bars = series.filter(s => s.type === 'bar');
  const groupW = Math.min(slot * 0.8, 28);
  const bw = bars.length ? groupW / bars.length : 0;
  bars.forEach((s, j) => {
    const col = SERIES[s.key].color;
    s.values.forEach((v, i) => {
      if (v == null || v <= yMin) return;
      const x = cx(i) - groupW / 2 + j * bw;
      const top = y(Math.min(v, yMax));
      out.push(`<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${Math.max(bw - 1, 1).toFixed(1)}" height="${(y(yMin) - top).toFixed(1)}" rx="1.5" style="fill:var(${col})"/>`);
    });
  });

  const r = n > 45 ? 1.6 : 2.6;
  series.filter(s => s.type === 'line').forEach(s => {
    const col = SERIES[s.key].color;
    let d = '', prev = false;
    s.values.forEach((v, i) => {
      if (v == null) { prev = false; return; }
      d += `${prev ? 'L' : 'M'}${cx(i).toFixed(1)} ${y(v).toFixed(1)}`;
      prev = true;
    });
    if (d) out.push(`<path class="line" d="${d}" style="stroke:var(${col})"/>`);
    s.values.forEach((v, i) => {
      if (v != null) out.push(`<circle cx="${cx(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${r}" style="fill:var(${col})"/>`);
    });
  });

  series.filter(s => s.type === 'marker').forEach(s => {
    const col = SERIES[s.key].color;
    s.values.forEach((v, i) => {
      if (v) out.push(`<circle cx="${cx(i).toFixed(1)}" cy="8" r="${Math.min(4, Math.max(2, slot / 3)).toFixed(1)}" style="fill:var(${col})"/>`);
    });
  });

  const legend = series.map(s => `<span style="--sw:var(${SERIES[s.key].color})">${SERIES[s.key].label}${s.type === 'marker' ? ' (Punkt oben)' : ''}</span>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${out.join('')}</svg><div class="legend">${legend}</div></div>`;
}

let rangeDays = 14;

$('range').addEventListener('click', e => {
  const btn = e.target.closest('button[data-days]');
  if (!btn) return;
  rangeDays = Number(btn.dataset.days);
  document.querySelectorAll('#range button').forEach(b => b.classList.toggle('active', b === btn));
  renderCharts();
});

function rangeData() {
  if (!entries.length) return null;
  const end = fromISO(todayISO() > entries[entries.length - 1].date ? todayISO() : entries[entries.length - 1].date);
  const start = rangeDays ? addDays(end, -(rangeDays - 1)) : fromISO(entries[0].date);
  const dates = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(toISO(d));
  const byDate = new Map(entries.map(e => [e.date, e]));
  const rows = dates.map(d => byDate.get(d) || null);
  const inRange = rows.filter(Boolean);
  const col = key => rows.map(r => (r ? r[key] : null));
  return { dates, rows, inRange, col };
}

function avg(list, key) {
  const vals = list.map(e => e[key]).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function statsHTML(inRange, days) {
  const kribbelTage = inRange.filter(e => (e.kribbelnHaende || 0) > 0 || (e.kribbelnFuesse || 0) > 0).length;
  const verstTage = inRange.filter(e => e.verstopfung).length;
  const items = [
    [`${inRange.length} / ${days}`, 'Tage erfasst'],
    [avg(inRange, 'schlafStunden') == null ? '–' : fmtNum(avg(inRange, 'schlafStunden')) + ' h', 'Ø Schlafdauer'],
    [fmtNum(avg(inRange, 'schlafQualitaet')), 'Ø Schlafqualität (1–5, hoch = gut)'],
    [fmtNum(avg(inRange, 'muedigkeit')), 'Ø Müdigkeit (1–5)'],
    [fmtNum(avg(inRange, 'antrieb')), 'Ø Antriebslosigkeit (1–5)'],
    [fmtNum(avg(inRange, 'brainfog')), 'Ø Brain Fog (1–5)'],
    [String(kribbelTage), 'Tage mit Kribbeln'],
    [String(verstTage), 'Tage mit Verstopfung'],
  ];
  return `<div class="stats">${items.map(([v, l]) => `<div class="stat"><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>`;
}

function chartsHTML(rd) {
  const { dates, col } = rd;
  return `
    <div class="card"><h2>Müdigkeit, Antrieb, Brain Fog</h2>
      <p class="hint" style="margin:-6px 0 8px">1 = kaum Beschwerden · 5 = sehr stark</p>
      ${chartSVG({ dates, yMin: 1, yMax: 5, yTicks: [1, 2, 3, 4, 5], title: 'Verlauf Müdigkeit, Antrieb, Brain Fog',
        series: ['muedigkeit', 'antrieb', 'brainfog'].map(key => ({ key, type: 'line', values: col(key) })) })}
    </div>
    <div class="card"><h2>Schlafdauer</h2>
      ${chartSVG({ dates, yMin: 0, yMax: 12, yTicks: [0, 3, 6, 9, 12], title: 'Schlafdauer in Stunden',
        series: [{ key: 'schlafStunden', type: 'bar', values: col('schlafStunden') }] })}
    </div>
    <div class="card"><h2>Schlafqualität</h2>
      <p class="hint" style="margin:-6px 0 8px">1 = sehr schlecht · 5 = sehr gut</p>
      ${chartSVG({ dates, yMin: 1, yMax: 5, yTicks: [1, 2, 3, 4, 5], title: 'Schlafqualität',
        series: [{ key: 'schlafQualitaet', type: 'line', values: col('schlafQualitaet') }] })}
    </div>
    <div class="card"><h2>Kribbeln &amp; Verstopfung</h2>
      <p class="hint" style="margin:-6px 0 8px">Kribbeln 0 = keins · 3 = stark</p>
      ${chartSVG({ dates, yMin: 0, yMax: 3, yTicks: [0, 1, 2, 3], title: 'Kribbeln und Verstopfung',
        series: [
          { key: 'kribbelnHaende', type: 'bar', values: col('kribbelnHaende') },
          { key: 'kribbelnFuesse', type: 'bar', values: col('kribbelnFuesse') },
          { key: 'verstopfung', type: 'marker', values: col('verstopfung') },
        ] })}
    </div>`;
}

function renderCharts() {
  const rd = rangeData();
  $('btnReport').disabled = !rd;
  if (!rd) {
    $('chartsContent').innerHTML = '<div class="card empty">Noch keine Einträge. Trag zuerst ein paar Tage ein.</div>';
    return;
  }
  $('chartsContent').innerHTML = `<div class="card"><h2>Überblick</h2>${statsHTML(rd.inRange, rd.dates.length)}</div>` + chartsHTML(rd);
}

// ---------- Arztbericht ----------

$('btnReport').addEventListener('click', () => {
  const rd = rangeData();
  if (!rd) return;
  const fmtScale = (e, key) => (e[key] == null ? '–' : e[key]);
  const rows = rd.inRange.map(e => `<tr>
      <td>${esc(fmtLong(e.date))}</td>
      <td>${e.schlafStunden == null ? '–' : fmtNum(e.schlafStunden, 1)}</td>
      <td>${fmtScale(e, 'schlafQualitaet')}</td>
      <td>${fmtScale(e, 'muedigkeit')}</td>
      <td>${fmtScale(e, 'antrieb')}</td>
      <td>${fmtScale(e, 'brainfog')}</td>
      <td>${fmtScale(e, 'kribbelnHaende')} / ${fmtScale(e, 'kribbelnFuesse')}</td>
      <td>${e.verstopfung ? 'ja' : ''}</td>
      <td>${esc(e.notizen)}</td>
    </tr>`).join('');

  $('report').innerHTML = `
    <h1>Symptom-Tagebuch</h1>
    <div>Zeitraum: ${esc(fmtLong(rd.dates[0]))} bis ${esc(fmtLong(rd.dates[rd.dates.length - 1]))} · erstellt am ${esc(fmtLong(todayISO()))}</div>
    <p style="font-size:9pt">Skalen: Müdigkeit, Antriebslosigkeit, Brain Fog 1 (kaum) bis 5 (sehr stark) · Schlafqualität 1 (sehr schlecht) bis 5 (sehr gut) · Kribbeln 0 (keins) bis 3 (stark) · „–“ = nicht erfasst</p>
    <h2>Überblick</h2>${statsHTML(rd.inRange, rd.dates.length)}
    <h2>Verlauf</h2>${chartsHTML(rd).replace(/class="card"/g, 'class="report-block"')}
    <h2>Einträge</h2>
    <table>
      <thead><tr><th>Datum</th><th>Schlaf h</th><th>Schlaf­qual.</th><th>Müdigk.</th><th>Antriebs­los.</th><th>Brain Fog</th><th>Kribbeln H/F</th><th>Verst.</th><th>Notizen</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  window.print();
});

// ---------- Liste ----------

function renderList() {
  const list = $('entryList');
  if (!entries.length) { list.innerHTML = '<div class="empty">Keine Einträge vorhanden.</div>'; return; }
  list.innerHTML = [...entries].reverse().map(e => {
    const parts = [];
    if (e.schlafStunden != null) parts.push(`Schlaf ${fmtNum(e.schlafStunden, 1)} h`);
    if (e.schlafQualitaet != null) parts.push(`Qualität ${e.schlafQualitaet}/5`);
    if (e.muedigkeit != null) parts.push(`Müdigkeit ${e.muedigkeit}/5`);
    if (e.antrieb != null) parts.push(`Antriebslos. ${e.antrieb}/5`);
    if (e.brainfog != null) parts.push(`Brain Fog ${e.brainfog}/5`);
    const badges = [];
    if (e.kribbelnHaende) badges.push(`Kribbeln Hände ${e.kribbelnHaende}/3`);
    if (e.kribbelnFuesse) badges.push(`Kribbeln Füße ${e.kribbelnFuesse}/3`);
    if (e.verstopfung) badges.push('Verstopfung');
    return `<div class="entry" data-date="${e.date}" role="button" tabindex="0">
      <div class="entry-head"><strong>${esc(fmtLong(e.date))}</strong><span class="hint" style="margin:0">bearbeiten ›</span></div>
      <div class="entry-meta">${esc(parts.join(' · ') || 'Keine Werte')}</div>
      ${badges.length ? `<div>${badges.map(b => `<span class="badge">${esc(b)}</span>`).join('')}</div>` : ''}
      ${e.notizen ? `<div class="entry-note">${esc(e.notizen)}</div>` : ''}
    </div>`;
  }).join('');
}

function editFromList(e) {
  const item = e.target.closest('.entry[data-date]');
  if (!item) return;
  openDate(item.dataset.date);
  showPage('entry');
}
$('entryList').addEventListener('click', editFromList);
$('entryList').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editFromList(e); } });

// ---------- Export / Import ----------

function download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('btnCsv').addEventListener('click', () => {
  if (!entries.length) { toast('Keine Einträge zum Exportieren.'); return; }
  const cell = v => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const num = v => (v == null ? '' : String(v).replace('.', ','));
  const header = ['Datum', 'Schlafdauer (h)', 'Schlafqualität (1-5)', 'Müdigkeit (1-5)', 'Antriebslosigkeit (1-5)', 'Brain Fog (1-5)', 'Kribbeln Hände (0-3)', 'Kribbeln Füße (0-3)', 'Verstopfung', 'Notizen'];
  const lines = entries.map(e => [
    e.date, num(e.schlafStunden), e.schlafQualitaet, e.muedigkeit, e.antrieb, e.brainfog,
    e.kribbelnHaende, e.kribbelnFuesse, e.verstopfung ? 'ja' : 'nein', e.notizen,
  ].map(cell).join(';'));
  // BOM + Semikolon, damit Excel (deutsch) die Datei direkt richtig öffnet
  download(`symptomtagebuch-${todayISO()}.csv`, 'text/csv;charset=utf-8', '﻿' + [header.join(';'), ...lines].join('\r\n'));
});

$('btnBackup').addEventListener('click', () => {
  const data = { app: 'symptomtagebuch', version: 1, exportedAt: new Date().toISOString(), entries };
  download(`symptomtagebuch-sicherung-${todayISO()}.json`, 'application/json', JSON.stringify(data, null, 2));
});

$('btnImport').addEventListener('click', () => $('importFile').click());

$('importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const list = Array.isArray(parsed) ? parsed : parsed && parsed.entries;
    const imported = Array.isArray(list) ? list.map(sanitize).filter(Boolean) : [];
    if (!imported.length) { alert('In der Datei wurden keine gültigen Einträge gefunden.'); return; }
    const overlap = imported.filter(i => findEntry(i.date)).length;
    const msg = `${imported.length} Einträge importieren?` + (overlap ? `\n${overlap} davon gibt es schon und werden überschrieben.` : '');
    if (!confirm(msg)) return;
    const dates = new Set(imported.map(i => i.date));
    entries = entries.filter(x => !dates.has(x.date)).concat(imported);
    sortEntries();
    if (persist()) {
      renderList();
      openDate($('f-date').value || todayISO());
      toast(`${imported.length} Einträge importiert`);
    }
  } catch (err) {
    console.error(err);
    alert('Die Datei konnte nicht gelesen werden. Ist es eine Sicherung aus dieser App?');
  }
});

$('btnClear').addEventListener('click', () => {
  if (!entries.length) { toast('Es gibt keine Einträge.'); return; }
  if (!confirm(`Wirklich alle ${entries.length} Einträge unwiderruflich löschen?\n\nTipp: Vorher eine Sicherung (JSON) exportieren.`)) return;
  entries = [];
  persist();
  renderList();
  fillForm(null);
  toast('Alle Einträge gelöscht');
});

// ---------- Start ----------

renderScales();
openDate(todayISO());

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service Worker nicht registriert:', err));
}
