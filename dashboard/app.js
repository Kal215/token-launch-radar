(() => {
  'use strict';

  const data = window.RADAR;
  const search = document.getElementById('search');
  const categoryFilter = document.getElementById('category-filter');
  const body = document.getElementById('table-body');
  const tableHead = document.getElementById('table-head');
  const resultCount = document.getElementById('result-count');
  const dialog = document.getElementById('detail-dialog');
  const detailContent = document.getElementById('detail-content');
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const model = data.model;
  const factorEntries = Object.entries(model.category_factors);

  let view = 'pre';
  let sortKey = 'rank';
  let sortDirection = 1;

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const categoryOf = (row) => row.category || 'Other';
  const growthLabel = (value) => value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  const ageLabel = (row) => `${number.format(row.age_days)}d`;
  const valueOf = (row, key, index) => {
    if (key === 'rank') return row.rank ?? index + 1;
    if (key === 'name') return row.name.toLocaleLowerCase();
    if (key === 'age_days') return row.age_days;
    if (key === 'implied_value_usd') return row.implied_value_usd ?? row.mcap_usd ?? -1;
    return row[key] ?? -Infinity;
  };

  function populateHeader() {
    const columns = view === 'pre'
      ? [['rank', 'Rank'], ['name', 'Protocol'], ['tvl_usd', 'TVL'], ['change_7d', '7d growth'], ['age_days', 'Age'], ['implied_value_usd', 'Implied value'], ['status', 'Status']]
      : [['rank', 'No.'], ['name', 'Protocol'], ['tvl_usd', 'TVL'], ['change_7d', '7d growth'], ['age_days', 'Age'], ['implied_value_usd', 'Market cap']];
    tableHead.replaceChildren(...columns.map(([key, label], index) => {
      const th = document.createElement('th');
      th.scope = 'col';
      if (['tvl_usd', 'change_7d', 'age_days', 'implied_value_usd'].includes(key)) th.className = 'numeric';
      if (key === 'implied_value_usd') th.classList.add('value-column');
      if (key === 'status') {
        th.className = 'status-column';
        th.textContent = label;
      } else {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sort-button';
        button.dataset.sort = key;
        button.append(document.createTextNode(label));
        const indicator = document.createElement('span');
        indicator.setAttribute('aria-hidden', 'true');
        indicator.textContent = '↕';
        button.append(indicator);
        th.append(button);
      }
      if (index === columns.length - 1 && view === 'pre') th.classList.add('status-column');
      return th;
    }));
    tableHead.querySelectorAll('[data-sort]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextKey = button.dataset.sort;
        if (sortKey === nextKey) sortDirection *= -1;
        else {
          sortKey = nextKey;
          sortDirection = nextKey === 'implied_value_usd' && view === 'live' ? -1 : 1;
        }
        renderTable();
      });
    });
  }

  function filteredRows() {
    const source = view === 'pre' ? data.rows : data.live_rows;
    const query = search.value.trim().toLocaleLowerCase();
    const selectedCategory = categoryFilter.value;
    const filtered = source.filter((row) => {
      if (selectedCategory !== 'all' && categoryOf(row) !== selectedCategory) return false;
      if (!query) return true;
      return [row.name, row.slug, categoryOf(row), ...(row.chains || [])]
        .join(' ').toLocaleLowerCase().includes(query);
    });
    return filtered.sort((a, b) => {
      const ai = source.indexOf(a);
      const bi = source.indexOf(b);
      const av = valueOf(a, sortKey, ai);
      const bv = valueOf(b, sortKey, bi);
      if (typeof av === 'string') return av.localeCompare(bv) * sortDirection;
      return (av - bv) * sortDirection || ai - bi;
    });
  }

  function protocolCell(row) {
    const category = categoryOf(row);
    const chains = row.chains.length ? row.chains.join(' · ') : 'Chain not specified';
    return `<span class="protocol-name">${escapeHtml(row.name)}</span><span class="protocol-subtitle">${escapeHtml(category)} <span aria-hidden="true">·</span> ${escapeHtml(chains)}</span>`;
  }

  function renderTable() {
    const rows = filteredRows();
    const highest = Math.max(1, ...data.rows.map((row) => row.implied_value_usd));
    document.getElementById('live-caption').hidden = view !== 'live';
    resultCount.textContent = `${number.format(rows.length)} ${view === 'pre' ? 'pre-token protocols' : 'live-token protocols'}`;
    if (rows.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = view === 'pre' ? 7 : 6;
      td.className = 'empty-state';
      td.textContent = 'No protocols match these filters.';
      tr.append(td);
      body.replaceChildren(tr);
      return;
    }

    const rendered = rows.map((row, index) => {
      const originalIndex = (view === 'pre' ? data.rows : data.live_rows).indexOf(row);
      const tr = document.createElement('tr');
      tr.tabIndex = 0;
      tr.setAttribute('aria-label', `Open details for ${row.name}`);
      tr.addEventListener('click', () => openDetail(row));
      tr.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDetail(row);
        }
      });

      const rank = document.createElement('td');
      rank.className = 'rank-cell';
      rank.textContent = view === 'pre' ? `#${row.rank}` : String(originalIndex + 1).padStart(2, '0');
      tr.append(rank);

      const name = document.createElement('td');
      name.className = 'protocol-cell';
      name.innerHTML = protocolCell(row);
      tr.append(name);

      const tvl = document.createElement('td');
      tvl.className = 'numeric';
      tvl.textContent = compactMoney.format(row.tvl_usd);
      tr.append(tvl);

      const growth = document.createElement('td');
      growth.className = `numeric ${row.change_7d > 0 ? 'positive' : row.change_7d < 0 ? 'negative' : ''}`;
      growth.textContent = growthLabel(row.change_7d);
      tr.append(growth);

      const age = document.createElement('td');
      age.className = 'numeric';
      age.textContent = ageLabel(row);
      tr.append(age);

      const value = document.createElement('td');
      value.className = 'numeric value-cell';
      if (view === 'pre') {
        const amount = document.createElement('span');
        amount.className = 'value-number';
        amount.textContent = compactMoney.format(row.implied_value_usd);
        const track = document.createElement('span');
        track.className = 'value-track';
        track.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('span');
        fill.className = 'value-fill';
        fill.style.width = `${Math.max(1, Math.min(100, row.implied_value_usd / highest * 100))}%`;
        track.append(fill);
        value.append(amount, track);
      } else {
        value.textContent = row.mcap_usd === null ? 'Not reported' : compactMoney.format(row.mcap_usd);
      }
      tr.append(value);

      if (view === 'pre') {
        const status = document.createElement('td');
        status.innerHTML = '<span class="status-chip">no token</span>';
        tr.append(status);
      }
      tr.dataset.row = String(index);
      tr.dataset.sourceRow = String(originalIndex);
      return tr;
    });
    body.replaceChildren(...rendered);
    document.querySelectorAll('.sort-button').forEach((button) => {
      if (button.dataset.sort === sortKey) button.setAttribute('aria-sort', sortDirection === 1 ? 'ascending' : 'descending');
      else button.removeAttribute('aria-sort');
    });
  }

  function formatFactor(value) {
    return `${Number(value).toFixed(2)}×`;
  }

  function renderModel() {
    document.getElementById('snapshot-date').textContent = data.as_of;
    document.getElementById('model-version').textContent = data.model_version;
    document.getElementById('pre-count').textContent = number.format(data.rows.length);
    document.getElementById('live-count').textContent = number.format(data.live_rows.length);
    document.getElementById('lede').textContent =
      `${number.format(data.watchlist_count)} watchlist protocols covered across ${number.format(data.rows.length)} scored rows, including ${number.format(data.early_count)} early rows below the $${number.format(data.floor_usd)} TVL floor; ${number.format(data.live_rows.length)} live-token protocols are set aside.`;
    document.getElementById('source-note').textContent = `Snapshot source: ${data.source}`;
    categoryFilter.replaceChildren(new Option('All categories', 'all'));
    for (const category of data.categories) categoryFilter.add(new Option(category, category));

    const constants = Object.entries(model)
      .filter(([key]) => key !== 'category_factors')
      .map(([key, value]) => `<span class="constant-pill">${escapeHtml(key)} = ${escapeHtml(value)}</span>`);
    document.getElementById('constants').innerHTML = constants.join('');
    document.getElementById('category-factors').innerHTML = factorEntries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, factor]) => `<div class="factor-row"><span>${escapeHtml(category)}</span><b>${formatFactor(factor)}</b></div>`)
      .join('');
    document.getElementById('formula-line').textContent =
      `growth = exp(clamp(7d% or 0, ${model.growth_floor}, ${model.growth_cap}) ÷ 100 × ${model.growth_weight}); maturity = ${model.maturity_floor} + age ÷ (age + ${model.maturity_days}) × ${model.maturity_range}; breadth = 1 + min(chains, ${model.chain_cap}) × ${model.chain_weight}; implied = max(1, round(TVL × ${model.base_multiple} × growth × maturity × breadth × category)).`;
  }

  function parseFarmStep(step) {
    const match = /^(.*?)\. Cost: (.*?)\. Time: (.*)\.$/.exec(step);
    return match ? { action: match[1], cost: match[2], time: match[3] } : { action: step, cost: 'See protocol guidance', time: 'As needed' };
  }

  function openDetail(row) {
    if (view === 'live') {
      detailContent.innerHTML = `
        <p class="detail-kicker">Live token · market data</p>
        <h2 class="detail-title" id="detail-title">${escapeHtml(row.name)}</h2>
        <p class="detail-summary">${escapeHtml(categoryOf(row))} · ${escapeHtml(row.chains.join(' · ') || 'Chain not specified')}${row.symbol ? ` · ${escapeHtml(row.symbol)}` : ''}</p>
        <div class="detail-value"><strong>${row.mcap_usd === null ? 'Not reported' : money.format(row.mcap_usd)}</strong><span>market capitalization · the market’s own value, not a model</span></div>
        <dl class="detail-grid">
          <div class="detail-metric"><dt>Protocol TVL</dt><dd>${money.format(row.tvl_usd)}</dd></div>
          <div class="detail-metric"><dt>7d TVL change</dt><dd>${growthLabel(row.change_7d)}</dd></div>
          <div class="detail-metric"><dt>Age</dt><dd>${ageLabel(row)}${row.listed_at ? ` · listed ${escapeHtml(row.listed_at)}` : ' · listing date unknown'}</dd></div>
        </dl>
        <p class="detail-live-note">This protocol has token market data and is intentionally kept outside the pre-token ranking. Its market capitalization is reported from the frozen snapshot and is not an implied-value estimate.</p>`;
    } else {
      const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d ?? 0));
      const growthMult = Math.exp((growthPct / 100) * model.growth_weight);
      const age = row.listed_at === null ? model.unknown_age_days : Math.floor((Date.parse(`${data.as_of}T00:00:00Z`) - Date.parse(`${row.listed_at}T00:00:00Z`)) / 86400000);
      const maturityMult = model.maturity_floor + age / (age + model.maturity_days) * model.maturity_range;
      const breadthMult = 1 + Math.min(row.chains.length, model.chain_cap) * model.chain_weight;
      const categoryMult = row.category === null ? model.category_default :
        model.category_factors[row.category.toLowerCase()] ?? model.category_default;
      const recomputed = Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturityMult * breadthMult * categoryMult));
      const matches = recomputed === row.implied_value_usd;
      const inputs = [
        ['base TVL multiple', formatFactor(model.base_multiple)],
        ['growth (7d)', formatFactor(growthMult)],
        ['maturity', formatFactor(maturityMult)],
        ['chain breadth', formatFactor(breadthMult)],
        ['category', formatFactor(categoryMult)],
      ];
      const steps = row.farm_steps.map((step) => {
        const parsed = parseFarmStep(step);
        return `<li>${escapeHtml(parsed.action)} <strong>Cost:</strong> ${escapeHtml(parsed.cost)} · <strong>Time:</strong> ${escapeHtml(parsed.time)}</li>`;
      }).join('');
      detailContent.innerHTML = `
        <p class="detail-kicker">Pre-token protocol · rank #${row.rank}</p>
        <h2 class="detail-title" id="detail-title">${escapeHtml(row.name)}</h2>
        <p class="detail-summary">${escapeHtml(categoryOf(row))} · ${escapeHtml(row.chains.join(' · ') || 'Chain not specified')} · no token recorded</p>
        <div class="detail-value"><strong>${money.format(recomputed)}</strong><span>recomputed implied value · board: ${money.format(row.implied_value_usd)}</span></div>
        <dl class="detail-grid">
          <div class="detail-metric"><dt>TVL input</dt><dd>${money.format(row.tvl_usd)}</dd></div>
          <div class="detail-metric"><dt>7d growth input</dt><dd>${growthLabel(row.change_7d)} → ${growthPct.toFixed(2)}% clamped</dd></div>
          <div class="detail-metric"><dt>Age input</dt><dd>${number.format(age)} days${row.listed_at ? ` · listed ${escapeHtml(row.listed_at)}` : ' · unknown-date default'}</dd></div>
        </dl>
        <h3 class="multiplier-title">Model multipliers</h3>
        <div class="multiplier-list">${inputs.map(([label, amount]) => `<div class="multiplier-item"><span>${label}</span><b>${amount}</b></div>`).join('')}</div>
        <p class="match-note${matches ? '' : ' mismatch'}">${matches ? '✓ Recomputed value matches the number carried by board.json.' : `Value mismatch: recomputed ${money.format(recomputed)}, board carries ${money.format(row.implied_value_usd)}.`}</p>
        <h3 class="farm-title">A measured farming plan</h3>
        <ol class="farm-list">${steps}</ol>`;
    }
    if (!dialog.open) dialog.showModal();
  }

  document.querySelectorAll('.view-button').forEach((button) => {
    button.addEventListener('click', () => {
      if (view === button.dataset.view) return;
      view = button.dataset.view;
      sortKey = 'rank';
      sortDirection = 1;
      document.querySelectorAll('.view-button').forEach((item) => item.classList.toggle('is-active', item === button));
      populateHeader();
      renderTable();
    });
  });
  document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  search.addEventListener('input', renderTable);
  categoryFilter.addEventListener('change', renderTable);

  renderModel();
  populateHeader();
  renderTable();
})();