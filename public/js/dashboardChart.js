function compactCurrency(value) {
  const numeric = Number(value) || 0;
  if (Math.abs(numeric) >= 1000000) return `R$ ${(numeric / 1000000).toFixed(1).replace('.', ',')} mi`;
  if (Math.abs(numeric) >= 1000) return `R$ ${Math.round(numeric / 1000)} mil`;
  return `R$ ${Math.round(numeric).toLocaleString('pt-BR')}`;
}

function points(values, width, height, padding, maxValue) {
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  return values.map((value, index) => {
    const ratio = values.length <= 1 ? 0 : index / (values.length - 1);
    const x = padding.left + ratio * usableWidth;
    const y = padding.top + usableHeight - ((Number(value) || 0) / maxValue) * usableHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function renderRevenueTaxTrend(container, trend = {}) {
  if (!container) return;
  const labels = trend.labels || [];
  const revenue = trend.revenue || [];
  const taxes = trend.taxes || [];
  const maxValue = Math.max(1, ...revenue, ...taxes);

  container.classList.remove('skeleton', 'skeleton-card');

  if (trend.empty || !labels.length) {
    container.innerHTML = `
      <div class="chart-empty">
        <strong>Sem tendência suficiente</strong>
        <span>Conecte banco ou informe faturamento para acompanhar receita e impostos.</span>
      </div>
    `;
    return;
  }

  const width = 720;
  const height = 260;
  const padding = { top: 22, right: 18, bottom: 42, left: 54 };
  const revenuePoints = points(revenue, width, height, padding, maxValue);
  const taxPoints = points(taxes, width, height, padding, maxValue);
  const lastRevenue = revenue[revenue.length - 1] || 0;
  const lastTaxes = taxes[taxes.length - 1] || 0;

  container.innerHTML = `
    <div class="chart-legend">
      <span><i class="legend-revenue"></i> Receita</span>
      <span><i class="legend-taxes"></i> Impostos</span>
      <strong>${compactCurrency(lastRevenue)} / ${compactCurrency(lastTaxes)}</strong>
    </div>
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tendência de receita versus impostos">
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="axis"></line>
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="axis"></line>
      <text x="${padding.left - 10}" y="${padding.top + 4}" class="axis-label" text-anchor="end">${compactCurrency(maxValue)}</text>
      <text x="${padding.left - 10}" y="${height - padding.bottom + 4}" class="axis-label" text-anchor="end">R$ 0</text>
      ${labels.map((label, index) => {
        const usableWidth = width - padding.left - padding.right;
        const x = padding.left + (labels.length <= 1 ? 0 : index / (labels.length - 1)) * usableWidth;
        return `<text x="${x.toFixed(1)}" y="${height - 14}" class="axis-label" text-anchor="middle">${label}</text>`;
      }).join('')}
      <polyline points="${revenuePoints}" class="line-revenue"></polyline>
      <polyline points="${taxPoints}" class="line-taxes"></polyline>
    </svg>
  `;
}
