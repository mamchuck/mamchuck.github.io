// Шейдерный фон диагностики: «северное сияние» в фирменных цветах + свечение за курсором.
// Лёгкий: чистый WebGL без библиотек, рендер в половинном разрешении, ≤ 30 кадров/с,
// пауза на скрытой вкладке, статичный кадр при «уменьшить движение». Нет WebGL — просто ничего не рисуем.
// В тексте шейдера только ASCII: GLSL ES не допускает других символов даже в комментариях.
const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `
precision mediump float;
uniform vec2 r; uniform float t; uniform vec2 m; uniform float dark; uniform vec3 burst; uniform float bt;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r; vec2 q=uv; q.x*=r.x/r.y;
  float s=t*.045;
  // aurora curtains: noise stretched vertically, drifting sideways
  float warp=fbm(q*1.4+vec2(s,-s*.6));
  float cur=fbm(vec2(q.x*2.6+warp*1.6+s*1.2,q.y*.55-s*.4));
  float rib=pow(smoothstep(.38,.68,cur),1.4);
  float top=smoothstep(.12,.92,uv.y+.16*sin(q.x*1.7+s*2.5));
  float haze=smoothstep(.35,.7,warp)*.4;
  vec3 blue=vec3(.169,.541,.847), sky=vec3(.40,.74,1.), teal=vec3(.08,.78,.70), violet=vec3(.55,.40,1.);
  vec3 c=mix(teal,sky,smoothstep(.2,.8,uv.x+.2*sin(s*2.+q.y*2.)));
  c=mix(c,violet,smoothstep(.55,.95,fbm(q*1.3+vec2(0.,s))));
  c=mix(blue,c,rib);
  float a=(rib+haze)*top*(dark>.5?.6:.34);
  vec2 mm=m; mm.x*=r.x/r.y; float g=exp(-6.*dot(q-mm,q-mm));
  a+=g*(dark>.5?.16:.09); c=mix(c,sky,g*.5);
  vec2 bc=vec2(.5*r.x/r.y,.62); float b=bt*exp(-3.5*dot(q-bc,q-bc));
  c=mix(c,burst,clamp(b*1.4,0.,1.)); a+=b*(dark>.5?.35:.22);
  a=clamp(a,0.,.62);
  float grain=(h(gl_FragCoord.xy+t)-.5)*.015;
  gl_FragColor=vec4(c*(a+grain),a+grain);
}`;

export function startFx() {
  const cv = document.createElement('canvas');
  cv.className = 'x-fx'; cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true, powerPreference: 'low-power' });
  if (!gl) return { burst() {} };
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return { burst() {} };
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return { burst() {} };
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['r', 't', 'm', 'dark', 'burst', 'bt'].map((k) => [k, gl.getUniformLocation(pr, k)]));
  document.body.prepend(cv);

  const scale = 0.5;                                             // половинное разрешение — фону детали не нужны
  const resize = () => {
    const w = Math.max(1, Math.round(innerWidth * scale)), h = Math.max(1, Math.round(innerHeight * scale));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
  };
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mx = 0.5, my = 0.6, tx = 0.5, ty = 0.6, last = 0, raf = 0, t0 = performance.now();
  let burstCol = [0.17, 0.54, 0.85], burstAt = -1e9;
  addEventListener('pointermove', (e) => { tx = e.clientX / innerWidth; ty = 1 - e.clientY / innerHeight; }, { passive: true });
  addEventListener('resize', resize);

  const frame = (now) => {
    raf = 0;
    if (document.hidden) return;                                 // скрытая вкладка — не тратим батарею
    if (!still) raf = requestAnimationFrame(frame);
    if (now - last < 33 && !still) return;                       // ≤ 30 кадров/с
    last = now; resize();
    mx += (tx - mx) * 0.08; my += (ty - my) * 0.08;
    const bt = Math.max(0, 1 - (now - burstAt) / 1800);
    gl.uniform2f(U.r, cv.width, cv.height); gl.uniform1f(U.t, still ? 12 : (now - t0) / 1000);
    gl.uniform2f(U.m, mx, my); gl.uniform1f(U.dark, isDark() ? 1 : 0);
    gl.uniform3f(U.burst, ...burstCol); gl.uniform1f(U.bt, bt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', kick);
  kick();
  return {
    // Вспышка цветом результата (по центру, затухает за ~2 с)
    burst(css) {
      const m = /^#?([0-9a-f]{6})$/i.exec((css || '').trim());
      if (m) burstCol = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
      burstAt = performance.now(); kick();
      if (still) setTimeout(kick, 50);
    },
  };
}
