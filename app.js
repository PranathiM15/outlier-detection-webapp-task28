(() => {
  const $ = (id) => document.getElementById(id);
  const datasetSelect = $('dataset-select');
  const columnSelect = $('column-select');
  const uploadInput = $('csv-upload');
  const canvas = $('boxplot-canvas');
  const ctx = canvas.getContext('2d');
  let sourceRows = [];
  let headers = [];
  let filename = 'employee_salary.csv';
  let datasetName = 'Employee salary dataset';
  let currentStats = null;

  const numberFormat = (value, maximumFractionDigits = 2) => {
    if (!Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits, minimumFractionDigits: 0 }).format(value);
  };
  const compactFormat = (value) => {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs >= 10000000) return (value / 10000000).toFixed(2).replace(/\.00$/, '') + ' Cr';
    if (abs >= 100000) return (value / 100000).toFixed(2).replace(/\.00$/, '') + 'L';
    if (abs >= 10000) return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return numberFormat(value, 2);
  };
  const asNumber = (raw) => {
    if (raw === null || raw === undefined) return NaN;
    const text = String(raw).trim().replace(/[,₹$%]/g, '');
    if (!text || text === '-' || text.toLowerCase() === 'na' || text.toLowerCase() === 'null') return NaN;
    const value = Number(text);
    return Number.isFinite(value) ? value : NaN;
  };

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(cell); cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((item) => item.trim() !== '')) rows.push(row);
        row = [];
      } else cell += char;
    }
    if (cell.length || row.length) {
      row.push(cell);
      if (row.some((item) => item.trim() !== '')) rows.push(row);
    }
    if (rows.length < 2) throw new Error('This CSV has no data rows. Please choose a CSV with a header and at least one record.');
    const parsedHeaders = rows.shift().map((h, i) => (h.trim() || `Column_${i + 1}`));
    const parsedRows = rows.map((cells) => {
      const record = {};
      parsedHeaders.forEach((header, i) => { record[header] = (cells[i] ?? '').trim(); });
      return record;
    });
    return { headers: parsedHeaders, rows: parsedRows };
  }

  function quantile(sorted, percentile) {
    if (!sorted.length) return NaN;
    const position = (sorted.length - 1) * percentile;
    const low = Math.floor(position), high = Math.ceil(position);
    if (low === high) return sorted[low];
    return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
  }

  function findNumericColumns() {
    return headers.filter((header) => {
      const values = sourceRows.map((row) => asNumber(row[header]));
      const valid = values.filter(Number.isFinite).length;
      return valid >= 2 && valid / Math.max(1, values.length) >= 0.65;
    });
  }

  function setColumnOptions(preferred = '') {
    const previous = preferred || columnSelect.value;
    const numericColumns = findNumericColumns();
    columnSelect.innerHTML = '';
    numericColumns.forEach((name) => {
      const option = document.createElement('option'); option.value = name; option.textContent = name; columnSelect.appendChild(option);
    });
    if (!numericColumns.length) {
      const option = document.createElement('option'); option.value = ''; option.textContent = 'No numeric columns found'; columnSelect.appendChild(option); columnSelect.disabled = true; render(); return;
    }
    columnSelect.disabled = false;
    columnSelect.value = numericColumns.includes(previous) ? previous : numericColumns[0];
    render();
  }

  async function loadSample(key) {
    const config = key === 'housing'
      ? { path: 'datasets/housing.csv', name: 'Housing dataset', filename: 'housing.csv', preferred: 'Price_lakhs' }
      : { path: 'datasets/employee_salary.csv', name: 'Employee salary dataset', filename: 'employee_salary.csv', preferred: 'Salary_INR' };
    datasetSelect.disabled = true;
    setStatus('Loading sample data…');
    try {
      const response = await fetch(config.path);
      if (!response.ok) throw new Error(`Could not load ${config.filename}. Run the app using run_webapp.bat or a local web server, not by opening index.html directly.`);
      const parsed = parseCSV(await response.text());
      headers = parsed.headers; sourceRows = parsed.rows; filename = config.filename; datasetName = config.name;
      $('file-chip').textContent = filename;
      $('table-variable-heading').textContent = 'VALUE';
      setStatus(`${datasetName} loaded successfully. Select a numeric variable to inspect its distribution.`);
      setColumnOptions(config.preferred);
    } catch (error) {
      setStatus(error.message, true);
      $('finding-main').innerHTML = '<span class="finding-pulse"></span><div><strong>Could not load dataset</strong><p>Use run_webapp.bat from the project folder and refresh this page.</p></div>';
    } finally { datasetSelect.disabled = false; }
  }

  function setStatus(message, isError = false) {
    $('data-status-text').textContent = message;
    $('data-status-text').style.color = isError ? 'var(--coral)' : 'var(--muted)';
  }

  function analyze(column) {
    const valid = [];
    sourceRows.forEach((row, index) => {
      const value = asNumber(row[column]);
      if (Number.isFinite(value)) valid.push({ value, row, index });
    });
    const sorted = valid.map((item) => item.value).sort((a, b) => a - b);
    if (sorted.length < 2) return null;
    const q1 = quantile(sorted, .25), median = quantile(sorted, .5), q3 = quantile(sorted, .75);
    const iqr = q3 - q1, lowerFence = q1 - 1.5 * iqr, upperFence = q3 + 1.5 * iqr;
    const outliers = valid.filter((item) => item.value < lowerFence || item.value > upperFence);
    const inliers = valid.filter((item) => item.value >= lowerFence && item.value <= upperFence).map((item) => item.value);
    return {
      column, values: valid, sorted, q1, median, q3, iqr, lowerFence, upperFence,
      whiskerLow: Math.min(...inliers), whiskerHigh: Math.max(...inliers), outliers,
      missing: sourceRows.length - valid.length, count: valid.length, min: sorted[0], max: sorted[sorted.length - 1]
    };
  }

  function render() {
    const column = columnSelect.value;
    currentStats = column ? analyze(column) : null;
    $('metric-rows').textContent = numberFormat(sourceRows.length, 0);
    $('metric-outliers').textContent = currentStats ? numberFormat(currentStats.outliers.length, 0) : '—';
    $('metric-outlier-note').textContent = currentStats ? `${currentStats.outliers.length} of ${currentStats.count} numeric values flagged` : 'Values beyond the whiskers';
    $('metric-median').textContent = currentStats ? compactFormat(currentStats.median) : '—';
    $('metric-iqr').textContent = currentStats ? compactFormat(currentStats.iqr) : '—';
    $('lower-fence').textContent = currentStats ? numberFormat(currentStats.lowerFence) : '—';
    $('upper-fence').textContent = currentStats ? numberFormat(currentStats.upperFence) : '—';
    $('whisker-range').textContent = currentStats ? `${compactFormat(currentStats.whiskerLow)} – ${compactFormat(currentStats.whiskerHigh)}` : '—';
    $('table-count').textContent = currentStats ? currentStats.outliers.length : '0';
    $('table-variable-heading').textContent = column ? `${column.toUpperCase()} VALUE` : 'VALUE';
    $('table-footer-note').textContent = currentStats ? `${currentStats.count} numeric values analysed${currentStats.missing ? ` · ${currentStats.missing} blank/non-numeric values skipped` : ''}.` : 'No dataset analyzed yet.';
    renderFinding(currentStats);
    renderTable(currentStats);
    drawBoxplot(currentStats);
  }

  function renderFinding(stats) {
    const target = $('finding-main');
    if (!stats) {
      target.innerHTML = '<span class="finding-pulse"></span><div><strong>No numeric series available</strong><p>Choose another column or upload a CSV with at least two numeric values.</p></div>';
      return;
    }
    if (stats.outliers.length) {
      const highest = Math.max(...stats.outliers.map((item) => item.value));
      const lowest = Math.min(...stats.outliers.map((item) => item.value));
      const details = stats.outliers.length === 1
        ? `One value (${numberFormat(stats.outliers[0].value)}) sits outside the fence range.`
        : `${stats.outliers.length} values fall outside the expected fence range, from ${numberFormat(lowest)} to ${numberFormat(highest)}.`;
      target.innerHTML = `<span class="finding-pulse"></span><div><strong>${stats.outliers.length} potential outlier${stats.outliers.length === 1 ? '' : 's'} detected</strong><p>${details} Verify these records against the original source before taking action.</p></div>`;
    } else {
      target.innerHTML = '<span class="finding-pulse" style="background:var(--lime);box-shadow:0 0 10px rgba(193,250,104,.25)"></span><div><strong>No potential outliers detected</strong><p>All numeric observations fall within the 1.5 × IQR fences. This does not guarantee the data is error-free.</p></div>';
    }
  }

  function recordLabel(item) {
    const candidates = ['Employee_ID', 'Employee', 'ID', 'Property_ID', 'Property', 'Record_ID', 'Name', 'Location'];
    for (const key of candidates) if (headers.includes(key) && String(item.row[key] ?? '').trim()) return String(item.row[key]).trim();
    const textHeader = headers.find((key) => !Number.isFinite(asNumber(item.row[key])) && String(item.row[key] ?? '').trim());
    return textHeader ? String(item.row[textHeader]).trim() : `Record ${item.index + 1}`;
  }

  function renderTable(stats) {
    const tbody = $('outlier-tbody'); tbody.innerHTML = '';
    if (!stats) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No numeric data to analyze.</td></tr>'; return;
    }
    if (!stats.outliers.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No records cross the IQR fences. Keep reviewing the dataset for other kinds of data quality issues.</td></tr>'; return;
    }
    stats.outliers.slice().sort((a, b) => b.value - a.value).forEach((item) => {
      const tr = document.createElement('tr');
      const values = [
        { text: String(item.index + 2), cls: 'row-number' },
        { text: recordLabel(item), cls: 'record-label' },
        { text: numberFormat(item.value), cls: 'value-cell' },
        { text: item.value < stats.lowerFence ? 'BELOW FENCE' : 'ABOVE FENCE', pill: true },
        { text: 'Verify units, source, and context before exclusion.', cls: 'review-text' }
      ];
      values.forEach((value) => {
        const td = document.createElement('td');
        if (value.pill) { const span = document.createElement('span'); span.className = 'flag-pill'; span.textContent = value.text; td.appendChild(span); }
        else { td.textContent = value.text; if (value.cls) td.className = value.cls; }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function drawBoxplot(stats) {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(280, canvas.clientWidth || 600);
    const height = canvas.clientHeight || 275;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    $('plot-empty').hidden = !!stats;
    if (!stats) return;
    const color = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const plot = { left: 65, right: width - 22, top: 18, bottom: height - 36 };
    const rawMin = Math.min(stats.min, stats.lowerFence), rawMax = Math.max(stats.max, stats.upperFence);
    const padding = (rawMax - rawMin || Math.abs(rawMax) * .1 || 1) * .08;
    const min = rawMin - padding, max = rawMax + padding;
    const y = (value) => plot.bottom - ((value - min) / (max - min || 1)) * (plot.bottom - plot.top);
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    for (let i = 0; i <= 4; i++) {
      const val = min + (max - min) * i / 4, py = y(val);
      ctx.strokeStyle = '#1d303c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plot.left, py); ctx.lineTo(plot.right, py); ctx.stroke();
      ctx.fillStyle = '#718694'; ctx.textAlign = 'right'; ctx.fillText(compactFormat(val), plot.left - 10, py + 3);
    }
    const cx = plot.left + (plot.right - plot.left) * .5, boxW = Math.min(100, Math.max(66, (plot.right - plot.left) * .22));
    ctx.strokeStyle = '#6fe1d2'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, y(stats.whiskerHigh)); ctx.lineTo(cx, y(stats.q3)); ctx.moveTo(cx, y(stats.q1)); ctx.lineTo(cx, y(stats.whiskerLow)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - boxW * .28, y(stats.whiskerHigh)); ctx.lineTo(cx + boxW * .28, y(stats.whiskerHigh)); ctx.moveTo(cx - boxW * .28, y(stats.whiskerLow)); ctx.lineTo(cx + boxW * .28, y(stats.whiskerLow)); ctx.stroke();
    ctx.fillStyle = 'rgba(193,250,104,.12)'; ctx.strokeStyle = color('--lime'); ctx.lineWidth = 2;
    const top = y(stats.q3), bottom = y(stats.q1);
    ctx.fillRect(cx - boxW / 2, top, boxW, Math.max(2, bottom - top)); ctx.strokeRect(cx - boxW / 2, top, boxW, Math.max(2, bottom - top));
    ctx.strokeStyle = color('--coral'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - boxW / 2, y(stats.median)); ctx.lineTo(cx + boxW / 2, y(stats.median)); ctx.stroke();
    ctx.fillStyle = color('--coral'); stats.outliers.forEach((item, index) => {
      const jitter = ((index % 7) - 3) * 5;
      ctx.beginPath(); ctx.arc(cx + jitter, y(item.value), 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#a6b7c1'; ctx.textAlign = 'center'; ctx.font = '11px ui-sans-serif, system-ui, sans-serif'; ctx.fillText(stats.column, cx, height - 10);
    ctx.textAlign = 'left'; ctx.fillStyle = '#a6b7c1'; ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Q3', Math.min(width - 25, cx + boxW / 2 + 11), y(stats.q3) + 3);
    ctx.fillText('MED', Math.min(width - 32, cx + boxW / 2 + 11), y(stats.median) + 3);
    ctx.fillText('Q1', Math.min(width - 25, cx + boxW / 2 + 11), y(stats.q1) + 3);
    if (stats.outliers.length) {
      ctx.fillStyle = '#ff9a87'; ctx.textAlign = 'left'; ctx.fillText(`${stats.outliers.length} flagged`, plot.left + 3, plot.top + 12);
    }
  }

  datasetSelect.addEventListener('change', () => { uploadInput.value = ''; loadSample(datasetSelect.value); });
  columnSelect.addEventListener('change', render);
  uploadInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0]; if (!file) return;
    try {
      const parsed = parseCSV(await file.text());
      headers = parsed.headers; sourceRows = parsed.rows; filename = file.name; datasetName = file.name;
      $('file-chip').textContent = filename; datasetSelect.value = '';
      setStatus(`Imported ${filename}. ${sourceRows.length} rows detected.`);
      setColumnOptions();
    } catch (error) { setStatus(error.message, true); }
  });
  window.addEventListener('resize', () => drawBoxplot(currentStats));
  loadSample('employee');
})();
