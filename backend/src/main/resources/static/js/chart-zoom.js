

window._czmChart = null;

function openCzm(canvasId, title, subtitle) {
  const orig = typeof Chart !== 'undefined' ? Chart.getChart(canvasId) : null;
  if (!orig) return;
  window._czmSourceCanvasId = canvasId;

  document.getElementById('czmTitle').textContent = title || '';
  document.getElementById('czmSub').textContent = subtitle || '';

  const tools = document.getElementById('czmTools');
  if (tools) tools.style.display = '';

  const overlay = document.getElementById('czmOverlay');
  overlay.classList.add('on');
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    if (window._czmChart) { window._czmChart.destroy(); window._czmChart = null; }
    const type = orig.config.type;
    const data = orig.config.data;
    const baseOptions = orig.config.options || {};
    const options = Object.assign({}, baseOptions, {
      responsive: true,
      maintainAspectRatio: false,
    });
    const zoomMode = type === 'scatter' ? 'xy' : 'x';
    options.plugins = Object.assign({}, baseOptions.plugins, {
      zoom: {
        pan: { enabled: true, mode: zoomMode, modifierKey: null },
        zoom: {
          wheel: { enabled: true, speed: 0.12 },
          pinch: { enabled: true },
          drag: { enabled: false },
          mode: zoomMode,
        },
        limits: zoomMode === 'x' ? { x: { minRange: 2 } } : undefined,
      },
    });
    window._czmChart = new Chart(document.getElementById('czmChart'), { type, data, options });
    window._czmChart.canvas.ondblclick = () => window._czmChart.resetZoom();
  });
}

function closeCzm() {
  const overlay = document.getElementById('czmOverlay');
  if (!overlay) return;
  overlay.classList.remove('on');
  document.body.style.overflow = '';
  if (window._czmChart) { window._czmChart.destroy(); window._czmChart = null; }
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const overlay = document.getElementById('czmOverlay');
  if (overlay && overlay.classList.contains('on')) closeCzm();
});
