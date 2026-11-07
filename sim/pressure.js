// Сцена «Давление жидкости и гидростатический парадокс»: три сосуда с одинаковой площадью дна и одинаковым уровнем жидкости, но разной формы.
// p = ρgh зависит только от глубины, а не от формы сосуда: давление на дно и сила давления на дно F = pS одинаковы, хотя вес жидкости разный.
// Пробный датчик на глубине z показывает давление в точке. Объёмы: цилиндр V = Sh; расширяющийся кверху (радиус от r до 2r) V = 7Sh/3; сужающийся (от r до r/2) V = 7Sh/12.
import { fmt, tex, arrow, rr } from './tex.js?v=202611071149';

const SW = 520, SH = 400, BASE = 286, PXCM = 5.2, XC = [92, 260, 428], RB = 36, G = 10, S = 20e-4, P0 = 101325;
const LIQ = { 800: ['Керосин', '#f1c15a', '#c98b0a'], 1000: ['Вода', '#6cb4ff', '#2f7fd6'], 13600: ['Ртуть', '#b4bccb', '#6c7689'] };
const SHAPES = [{ id: 'A', name: 'цилиндр', k: 1, top: 1 }, { id: 'B', name: 'расширяется кверху', k: 7 / 3, top: 2 }, { id: 'C', name: 'сужается кверху', k: 7 / 12, top: 0.5 }];

export const pressure = {
  id: 'pressure',
  mode: 'free',
  title: 'Давление жидкости',
  lead: 'Три сосуда с одинаковым дном и одинаковым уровнем жидкости, но разной формы. Давление на дно у всех одно и то же: оно зависит только от глубины и плотности жидкости, p = ρgh. А вес жидкости разный. Датчик показывает давление на любой глубине.',
  stage: { w: SW, h: SH, label: 'Три сосуда разной формы с жидкостью и датчиком давления' },
  params: [
    { id: 'rho', name: 'Жидкость', tex: '\\rho', unit: 'кг/м³', dec: 0, def: 1000, options: [{ label: 'Керосин', v: 800 }, { label: 'Вода', v: 1000 }, { label: 'Ртуть', v: 13600 }] },
    { id: 'h', name: 'Высота столба жидкости', tex: 'h', unit: 'см', min: 5, max: 40, step: 1, def: 25, dec: 0 },
    { id: 'z', name: 'Глубина датчика', tex: 'z', unit: 'см', min: 1, max: 40, step: 1, def: 15, dec: 0 },
  ],
  toggles: [{ id: 'atm', name: 'Атмосферное давление', color: '#6b7a90', on: false }, { id: 'f', name: 'Силы на дно и вес', color: '#e8590c', on: true }],
  derive(p) {
    const h = p.h / 100, z = Math.min(p.z, p.h) / 100, pb = p.rho * G * h, pz = p.rho * G * z, F = pb * S, V = SHAPES.map((s) => s.k * S * h);
    return { h, z, zEff: Math.min(p.z, p.h), pb, pz, F, W: V.map((v) => p.rho * G * v), V };
  },
  readouts: (p, d) => [['Давление на глубине z', 'p = \\rho g z', `${fmt(d.pz / 1000, 2)} кПа`], ['Давление на дно', 'p = \\rho g h', `${fmt(d.pb / 1000, 2)} кПа`], ['Сила давления на дно', 'F = pS', `${fmt(d.F, 2)} Н`],
    ['Вес жидкости: A, B, C', 'mg', `${fmt(d.W[0], 1)} · ${fmt(d.W[1], 1)} · ${fmt(d.W[2], 1)} Н`], ['Площадь дна', 'S', '20 см²']],
  formulas: [
    { tag: 'Давление жидкости', color: '#2563eb', tex: 'p = \\rho g h' },
    { tag: 'Сила давления на дно', color: '#e8590c', tex: 'F = p\\,S = \\rho g h S' },
    { tag: 'Полное давление', color: '#6b7a90', tex: 'p_\\text{полн} = p_0 + \\rho g h,\\quad p_0 \\approx 101\\ \\text{кПа}' },
  ],
  note: 'Сила давления на дно F = ρghS одинакова во всех сосудах, потому что одинаковы ρ, h и S. А вес жидкости mg = ρgV различается: в расширяющемся кверху сосуде часть веса жидкости держат стенки, а в сужающемся стенки добавляют силу к дну.',
  info(p, d) {
    const row = (s, i) => `<tr><td>${s.id}: ${s.name}</td><td>${fmt(d.W[i], 1)} Н</td></tr>`;
    return `<div class="sm-big" style="font-size:26px">${fmt(d.pb / 1000, 2)} кПа</div>
      <div><span class="sm-chip">давление на дно во всех сосудах одинаково</span></div>
      <table class="sm-it"><tr><td>Сила на дно F = pS</td><td>${fmt(d.F, 2)} Н</td></tr>${SHAPES.map(row).join('')}</table>
      <div class="sm-eq">Вес жидкости ${d.W[1] > d.F ? 'в B больше силы давления на дно' : 'в B не больше силы давления на дно'}, а в C — ${d.W[2] < d.F ? 'меньше' : 'не меньше'}.<small>Гидростатический парадокс: давление определяется высотой столба, а не количеством жидкости.</small></div>`;
  },

  mount(box) {
    const bg = document.createElement('canvas'); bg.className = 'sm-sbg'; box.prepend(bg);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label); bg.setAttribute('aria-hidden', 'true');
    let P = null, d = null, on = { atm: false, f: true };
    const full = () => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.4e6 / (cssW * ((cssW * SH) / SW)))));
      bg.width = Math.round(cssW * dpr); bg.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = bg.getContext('2d'); g.setTransform(bg.width / SW, 0, 0, bg.height / SH, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round'; return g;
    };
    const wAt = (s, u) => RB * (1 + (s.top - 1) * u);                                              // половина ширины сосуда на относительной высоте u (0 — дно, 1 — уровень жидкости)
    const paint = () => {
      const c = full(); c.clearRect(0, 0, SW, SH); if (!d) return;
      const [, fill, edge] = LIQ[P.rho], H = P.h * PXCM, hTot = Math.min(H + 22, H * 1.3, BASE - 72);
      c.fillStyle = '#9aa5b8'; c.fillRect(20, BASE, SW - 40, 10); c.strokeStyle = '#2a3140'; c.lineWidth = 2; c.strokeRect(20, BASE, SW - 40, 10);
      const fscale = 46 / Math.max(d.F, d.W[1], 1e-9);
      SHAPES.forEach((s, i) => {
        const x = XC[i], wTop = wAt(s, 1), wCont = (u) => wAt(s, u);
        const uTot = hTot / H;                                                                     // стенки продолжаются чуть выше уровня жидкости
        // жидкость
        c.beginPath(); c.moveTo(x - wCont(0), BASE); c.lineTo(x - wTop, BASE - H); c.lineTo(x + wTop, BASE - H); c.lineTo(x + wCont(0), BASE); c.closePath();
        const g = c.createLinearGradient(0, BASE - H, 0, BASE); g.addColorStop(0, fill); g.addColorStop(1, edge); c.fillStyle = g; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
        // стенки
        c.strokeStyle = '#2a3140'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(x - wCont(uTot), BASE - hTot); c.lineTo(x - wCont(0), BASE); c.lineTo(x + wCont(0), BASE); c.lineTo(x + wCont(uTot), BASE - hTot); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - wTop + 1, BASE - H); c.lineTo(x + wTop - 1, BASE - H); c.stroke();
        tex(c, s.id, x, 38, { size: 22, align: 'center', color: '#1b2330' }); tex(c, s.name, x, 58, { size: 13, align: 'center', color: '#6b7a90' });
        // датчик на глубине z
        const zy = BASE - H + d.zEff * PXCM, zx = x + wAt(s, 1 - d.zEff / P.h) * 0.0 - 0;
        c.strokeStyle = '#e03131'; c.setLineDash([4, 4]); c.lineWidth = 1.3; c.beginPath(); c.moveTo(x - wTop - 14, BASE - H); c.lineTo(x - wTop - 14, zy); c.stroke(); c.setLineDash([]);
        c.beginPath(); c.arc(zx, zy, 7, 0, 7); c.fillStyle = '#e03131'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        const pz = d.pz + (on.atm ? P0 : 0), pb = d.pb + (on.atm ? P0 : 0);
        const lab = (str, xx, yy, col) => { const w = tex(c, str, xx, yy, { size: 14, align: 'center', color: 'rgba(0,0,0,0)' }); rr(c, xx - w / 2 - 4, yy - 13, w + 8, 19, 5); c.fillStyle = 'rgba(244,246,250,.9)'; c.fill(); tex(c, str, xx, yy, { size: 14, align: 'center', color: col }); };
        lab(`${fmt(pz / 1000, 1)} кПа`, zx, zy - 12, '#c92a2a'); lab(`${fmt(pb / 1000, 1)} кПа`, x, BASE - 8, '#1b2330');
        // силы под сосудом: сила давления на дно и сила тяжести жидкости
        if (on.f) {
          const y0 = BASE + 14, L1 = d.F * fscale, L2 = Math.min(70, d.W[i] * fscale);
          arrow(c, x - 22, y0, x - 22, y0 + Math.max(4, L1), { color: '#e8590c', lw: 3, head: 9 }); arrow(c, x + 22, y0, x + 22, y0 + Math.max(4, L2), { color: '#1f9d55', lw: 3, head: 9 });
          tex(c, `F = ${fmt(d.F, 1)} Н`, x - 22, y0 + 64, { size: 13, align: 'center', color: '#c2410c' }); tex(c, `mg = ${fmt(d.W[i], 1)} Н`, x + 22, y0 + 78, { size: 13, align: 'center', color: '#1f7a45' });
        }
      });
      tex(c, `h = ${fmt(P.h, 0)} см`, 18, 18, { size: 14, color: '#3b475c' });
    };
    return { resize() {}, params(p, dd) { P = p; d = dd; paint(); }, update(dd, flags) { if (!!flags.atm !== on.atm || !!flags.f !== on.f) { on = { atm: !!flags.atm, f: !!flags.f }; paint(); } }, busy: () => false, animate() {} };
  },
};
