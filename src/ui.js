import { COAT_PRESETS } from './presets.js';

const INSPECTOR_SCHEMA = {
  structure: [
    {
      title: '双层被毛体量 (Dual-Coat Volume)',
      items: [
        { key: 'strandCount', label: 'GPU 针毛实例数', type: 'range', min: 8000, max: 120000, step: 2000, fmt: (v) => Math.round(v).toLocaleString() },
        { key: 'shellLayers', label: '底绒体积切片层数', type: 'range', min: 0, max: 24, step: 1, fmt: (v) => `${Math.round(v)} 层` },
        { key: 'undercoatDensity', label: '底绒浓密覆盖度', type: 'range', min: 0.2, max: 1.0, step: 0.02 },
        { key: 'furLength', label: '全局基准毛长', type: 'range', min: 0.06, max: 0.42, step: 0.005 },
        { key: 'rootThickness', label: '发根粗细半径', type: 'range', min: 0.005, max: 0.026, step: 0.0005 },
        { key: 'tipTaper', label: '发尖收细锐度', type: 'range', min: 0.6, max: 3.0, step: 0.05 },
      ],
    },
    {
      title: '解剖学分区毛长遮罩 (Anatomical Masks)',
      items: [
        { key: 'faceLengthMul', label: '口鼻与眼周短毛比', type: 'range', min: 0.15, max: 1.2, step: 0.02 },
        { key: 'maneLengthMul', label: '脖圈围脖鬃毛蓬松比', type: 'range', min: 0.5, max: 2.3, step: 0.02 },
        { key: 'earLengthMul', label: '耳廓簇毛长度比', type: 'range', min: 0.3, max: 2.0, step: 0.02 },
        { key: 'bellyLengthMul', label: '胸腹肚皮绒毛比', type: 'range', min: 0.5, max: 1.8, step: 0.02 },
        { key: 'tailLengthMul', label: '尾巴大绒球长度比', type: 'range', min: 0.5, max: 2.5, step: 0.02 },
      ],
    },
  ],

  styling: [
    {
      title: 'Voronoi 毛簇聚合 (Clumping)',
      items: [
        { key: 'clumpStrength', label: '毛尖聚簇成束度', type: 'range', min: 0.0, max: 0.95, step: 0.01 },
        { key: 'clumpScale', label: '毛簇空间细分密度', type: 'range', min: 6.0, max: 34.0, step: 0.5 },
      ],
    },
    {
      title: '三维螺旋卷曲与毛躁 (Curl & Frizz)',
      items: [
        { key: 'curlStrength', label: '泰迪螺旋卷曲幅度', type: 'range', min: 0.0, max: 1.0, step: 0.01 },
        { key: 'curlFrequency', label: '螺旋波浪频率', type: 'range', min: 4.0, max: 36.0, step: 0.5 },
        { key: 'frizzStrength', label: '天然绒感毛躁度', type: 'range', min: 0.0, max: 0.65, step: 0.01 },
        { key: 'frizzScale', label: '毛躁微波形频率', type: 'range', min: 8.0, max: 48.0, step: 1.0 },
      ],
    },
    {
      title: '环境湿度状态 (Surface Condition)',
      items: [
        { key: 'wetness', label: '淋浴湿毛结块感', type: 'range', min: 0.0, max: 1.0, step: 0.01 },
      ],
    },
  ],

  optics: [
    {
      title: '发根-中段-发尖 三段色素渐变',
      colorTriplet: [
        { key: 'rootColor', label: '发根底色' },
        { key: 'midColor', label: '中段主色' },
        { key: 'tipColor', label: '发尖高光色' },
      ],
      items: [
        { key: 'colorBias', label: '中段色素过渡位置', type: 'range', min: 0.15, max: 0.85, step: 0.01 },
      ],
    },
    {
      title: '程序化生物被毛花纹 (Coat Patterns)',
      items: [
        {
          key: 'patternType',
          label: '被毛花色基因',
          type: 'select',
          options: [
            { value: 0, label: '0 · 纯色渐变 (Solid)' },
            { value: 1, label: '1 · 白胸雪爪燕尾服 (Tuxedo)' },
            { value: 2, label: '2 · 虎斑条纹 (Mackerel Tabby)' },
            { value: 3, label: '3 · 三花 / 奶牛斑块 (Calico)' },
            { value: 4, label: '4 · 暹罗/布偶重点色 (Points)' },
            { value: 5, label: '5 · 赤狐/小熊猫面具环尾 (Mask)' },
          ],
        },
      ],
      colorPair: [
        { key: 'patternColor', label: '花纹主色' },
        { key: 'patternSecondaryColor', label: '花纹深色斑纹' },
      ],
      extraItems: [
        { key: 'patternScale', label: '斑纹空间频率', type: 'range', min: 1.5, max: 10.0, step: 0.1 },
        { key: 'patternSoftness', label: '花纹边缘晕染度', type: 'range', min: 0.05, max: 0.85, step: 0.02 },
      ],
    },
    {
      title: 'Kajiya-Kay 双高光与逆光透射 SSS',
      items: [
        { key: 'specPrimary', label: '表皮毛鳞片主高光 (R)', type: 'range', min: 0.0, max: 1.2, step: 0.02 },
        { key: 'specShift1', label: '毛鳞片倾角偏移', type: 'range', min: -0.25, max: 0.35, step: 0.01 },
        { key: 'specSecondary', label: '内部透射次高光 (TRT)', type: 'range', min: 0.0, max: 1.2, step: 0.02 },
        { key: 'roughness', label: '发丝表面粗糙度', type: 'range', min: 0.08, max: 0.85, step: 0.01 },
        { key: 'backlightSSS', label: '逆光绒毛金边透射 (SSS)', type: 'range', min: 0.0, max: 1.5, step: 0.02 },
        { key: 'aoIntensity', label: '深层发根自遮蔽 (AO)', type: 'range', min: 0.0, max: 1.0, step: 0.02 },
        { key: 'iridescence', label: '幻彩薄膜干涉强度', type: 'range', min: 0.0, max: 1.0, step: 0.02 },
      ],
    },
  ],

  physics: [
    {
      title: '毛发重力与弹簧惯性动力学',
      items: [
        { key: 'gravity', label: '重力自然垂坠度', type: 'range', min: 0.0, max: 0.75, step: 0.01 },
        { key: 'stiffness', label: '毛干抗弯刚度', type: 'range', min: 0.05, max: 0.95, step: 0.02 },
        { key: 'springBounce', label: '惯性Q弹摆动度', type: 'range', min: 0.1, max: 0.92, step: 0.02 },
      ],
    },
    {
      title: '三维湍流风场 (Turbulent Wind)',
      items: [
        { key: 'windStrength', label: '微风吹拂强度', type: 'range', min: 0.0, max: 0.7, step: 0.01 },
        { key: 'windSpeed', label: '阵风湍流频率', type: 'range', min: 0.2, max: 3.5, step: 0.05 },
        { key: 'windAngle', label: '风向水平方位角', type: 'range', min: 0, max: 360, step: 5, fmt: (v) => `${Math.round(v)}°` },
      ],
    },
    {
      title: '摄影棚布光与生命力动画',
      items: [
        {
          key: 'lightingPreset',
          label: '摄影棚环境主题',
          type: 'select',
          options: [
            { value: 'warmSun', label: '☀️ 午后暖阳逆光棚' },
            { value: 'softStudio', label: '📷 商业柔光肖像棚' },
            { value: 'meadow', label: '🌿 森林晨曦自然光' },
            { value: 'cyberNeon', label: '🔮 赛博双色霓虹光' },
          ],
        },
        { key: 'lightAzimuth', label: '主光环绕角度', type: 'range', min: -180, max: 180, step: 2, fmt: (v) => `${Math.round(v)}°` },
        { key: 'rimLightIntensity', label: '轮廓逆光灯倍率', type: 'range', min: 0.0, max: 2.5, step: 0.05 },
        { key: 'idleAnimation', label: '开启呼吸与摇尾巴', type: 'checkbox' },
        { key: 'eyeTracking', label: '好奇眼神跟随鼠标', type: 'checkbox' },
      ],
    },
  ],
};

export function setupStudioUI({
  params,
  toolState,
  onParamsChange,
  onSpeciesChange,
  onLightingChange,
  onToolChange,
  onShake,
  onHappyTilt,
  onResetGroom,
  onScreenshot,
}) {
  let currentTab = 'structure';
  let activePresetId = 'cream_pom';

  const inspectorBody = document.getElementById('inspector-body');
  const tabContainer = document.getElementById('inspector-tabs');
  const presetStrip = document.getElementById('preset-buttons');
  const speciesBar = document.getElementById('species-buttons');

  // 1. 渲染底部预设胶囊栏
  function renderPresetStrip() {
    presetStrip.innerHTML = '';
    for (const preset of COAT_PRESETS) {
      const btn = document.createElement('button');
      btn.className = `preset-chip ${preset.id === activePresetId ? 'active' : ''}`;
      btn.innerHTML = `<span class="swatch-dot" style="background:${preset.swatch}"></span><span>${preset.name}</span>`;
      btn.addEventListener('click', () => {
        activePresetId = preset.id;
        const speciesChanged = preset.species && preset.species !== params.species;
        Object.assign(params, preset.params);
        if (preset.species) {
          params.species = preset.species;
        }
        if (speciesChanged) {
          onSpeciesChange(params.species);
          syncSpeciesButtons();
        }
        onParamsChange();
        onLightingChange();
        renderPresetStrip();
        renderInspectorTab(currentTab);
      });
      presetStrip.appendChild(btn);
    }
  }

  function syncSpeciesButtons() {
    speciesBar.querySelectorAll('.species-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.species === params.species);
    });
  }

  speciesBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.species-btn');
    if (!btn) return;
    const sp = btn.dataset.species;
    if (sp && sp !== params.species) {
      params.species = sp;
      syncSpeciesButtons();
      onSpeciesChange(sp);
    }
  });

  // 2. 渲染右侧参数检视器面板
  function renderControlItem(item, container) {
    if (item.type === 'checkbox') {
      const row = document.createElement('div');
      row.className = 'toggle-row';
      const lbl = document.createElement('label');
      lbl.textContent = item.label;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(params[item.key]);
      input.addEventListener('change', () => {
        params[item.key] = input.checked;
        onParamsChange();
      });
      row.append(lbl, input);
      container.appendChild(row);
      return;
    }

    if (item.type === 'select') {
      const wrap = document.createElement('div');
      wrap.className = 'control-item';
      const top = document.createElement('div');
      top.className = 'control-label-row';
      top.innerHTML = `<span>${item.label}</span>`;
      const sel = document.createElement('select');
      sel.className = 'styled-select';
      for (const opt of item.options) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (String(params[item.key]) === String(opt.value)) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        const val = typeof params[item.key] === 'number' ? Number(sel.value) : sel.value;
        params[item.key] = val;
        if (item.key === 'lightingPreset') {
          onLightingChange();
        } else {
          onParamsChange();
        }
      });
      wrap.append(top, sel);
      container.appendChild(wrap);
      return;
    }

    // 默认 range 滑杆
    const wrap = document.createElement('div');
    wrap.className = 'control-item';
    const fmt = item.fmt || ((v) => Number(v).toFixed(item.step < 0.005 ? 4 : 2));
    const top = document.createElement('div');
    top.className = 'control-label-row';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.label;
    const valSpan = document.createElement('span');
    valSpan.className = 'control-val';
    valSpan.textContent = fmt(params[item.key]);
    top.append(nameSpan, valSpan);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = item.min;
    slider.max = item.max;
    slider.step = item.step;
    slider.value = params[item.key];
    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      params[item.key] = v;
      valSpan.textContent = fmt(v);
      if (item.key === 'lightAzimuth' || item.key === 'rimLightIntensity') {
        onLightingChange();
      } else {
        onParamsChange();
      }
    });

    wrap.append(top, slider);
    container.appendChild(wrap);
  }

  function renderColorCells(cells, container) {
    const grid = document.createElement('div');
    grid.className = 'color-grid';
    if (cells.length === 2) {
      grid.style.gridTemplateColumns = '1fr 1fr';
    }
    for (const c of cells) {
      const cell = document.createElement('div');
      cell.className = 'color-cell';
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.value = params[c.key];
      picker.addEventListener('input', () => {
        params[c.key] = picker.value;
        onParamsChange();
      });
      const lbl = document.createElement('span');
      lbl.textContent = c.label;
      cell.append(picker, lbl);
      grid.appendChild(cell);
    }
    container.appendChild(grid);
  }

  function renderInspectorTab(tabKey) {
    inspectorBody.innerHTML = '';
    const groups = INSPECTOR_SCHEMA[tabKey] || [];

    for (const g of groups) {
      const card = document.createElement('div');
      card.className = 'param-group';

      const header = document.createElement('div');
      header.className = 'group-header';
      header.textContent = g.title;
      card.appendChild(header);

      if (g.colorTriplet) renderColorCells(g.colorTriplet, card);
      if (g.items) {
        for (const item of g.items) renderControlItem(item, card);
      }
      if (g.colorPair) renderColorCells(g.colorPair, card);
      if (g.extraItems) {
        for (const item of g.extraItems) renderControlItem(item, card);
      }

      inspectorBody.appendChild(card);
    }
  }

  tabContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    currentTab = btn.dataset.tab;
    tabContainer.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    renderInspectorTab(currentTab);
  });

  // 3. 左侧交互护理工具与笔刷控制
  const toolBtns = document.getElementById('tool-buttons');
  const dyeRow = document.getElementById('dye-color-row');
  const syncDyeVisibility = () => {
    dyeRow.style.display = toolState.activeTool === 'dye' ? 'flex' : 'none';
  };

  toolBtns.addEventListener('click', (e) => {
    const btn = e.target.closest('.tool-btn');
    if (!btn) return;
    toolState.activeTool = btn.dataset.tool;
    toolBtns.querySelectorAll('.tool-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    syncDyeVisibility();
    onToolChange(toolState.activeTool);
  });

  const radiusSlider = document.getElementById('ctrl-brushRadius');
  const radiusVal = document.getElementById('val-brushRadius');
  radiusSlider.addEventListener('input', () => {
    toolState.brushRadius = Number(radiusSlider.value);
    radiusVal.textContent = toolState.brushRadius.toFixed(2);
  });

  const strengthSlider = document.getElementById('ctrl-brushStrength');
  const strengthVal = document.getElementById('val-brushStrength');
  strengthSlider.addEventListener('input', () => {
    toolState.brushStrength = Number(strengthSlider.value);
    strengthVal.textContent = toolState.brushStrength.toFixed(2);
  });

  const dyeInput = document.getElementById('ctrl-dyeColor');
  dyeInput.addEventListener('input', () => {
    toolState.dyeColor = dyeInput.value;
  });

  document.getElementById('btn-shake').addEventListener('click', onShake);
  document.getElementById('btn-boop').addEventListener('click', onHappyTilt);
  document.getElementById('btn-reset-groom').addEventListener('click', onResetGroom);
  document.getElementById('btn-screenshot').addEventListener('click', onScreenshot);

  // 4. Best Practices 模态窗控制
  const modal = document.getElementById('modal-best-practices');
  document.getElementById('btn-best-practices').addEventListener('click', () => {
    modal.classList.remove('hidden');
  });
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  // 5. JSON 预设导入导出
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluffylab-${params.species}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const fileInput = document.getElementById('input-import-json');
  document.getElementById('btn-import-json').addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const imported = JSON.parse(txt);
      const spChanged = imported.species && imported.species !== params.species;
      Object.assign(params, imported);
      if (spChanged) {
        syncSpeciesButtons();
        onSpeciesChange(params.species);
      }
      onParamsChange();
      onLightingChange();
      renderInspectorTab(currentTab);
    } catch (err) {
      console.error('导入预设失败:', err);
    }
    fileInput.value = '';
  });

  syncDyeVisibility();
  syncSpeciesButtons();
  renderPresetStrip();
  renderInspectorTab(currentTab);
}
