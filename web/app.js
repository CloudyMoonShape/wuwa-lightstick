import { LightstickClient } from "./sdk.js";

const $ = id => document.getElementById(id);
const hex = b => [...b].map(x => x.toString(16).padStart(2, "0")).join(" ");

function log(line) {
  const el = $("log");
  el.textContent += new Date().toLocaleTimeString() + "  " + line + "\n";
  if (el.textContent.length > 20000) el.textContent = el.textContent.slice(-15000);
  el.scrollTop = el.scrollHeight;
}

function setStatus(text, cls = "") { $("status").textContent = text; $("status").className = cls; }

// Transport and frame validation are shared with developer examples through sdk.js.
let sentFrames = 0, rttMs = 0;
const client = new LightstickClient({
  onState(state, detail) {
    const labels = {selecting:"选择设备…", connecting:"连接中…", authenticating:"等待蓝灯闪完…", ready:"已连接 " + (detail || ""), disconnected:"已断开 · 屏幕预览", error:"连接失败，请检查电池和浏览器蓝牙权限"};
    setStatus(labels[state] || state, state === "ready" ? "ok" : state === "error" ? "err" : "");
    $("connect").disabled = ["selecting","connecting","authenticating"].includes(state);
    $("connect").textContent = state === "ready" ? "断开连接" : "连接应援棒";
    $("mode").textContent = state === "ready" ? "正在控制应援棒" : "屏幕预览";
    lastFrame = null;
    if (state === "disconnected") { stopAudio(); startEffect(effects[0]); }
    log(state + (detail ? " " + detail : ""));
  },
  onNotification(data) { if (!running) log("<- " + hex(data)); }
});
async function connect() {
  if (!navigator.bluetooth) { setStatus("当前浏览器不支持蓝牙连接，请用桌面 Chrome / Edge 或 Android Chrome；仍可屏幕试玩", "err"); return; }
  if (client.ready) { client.disconnect(); return; }
  try { await client.connect(); startEffect(effects[0]); }
  catch (e) {
    if (e.name === "NotFoundError") setStatus("未选择设备 · 继续预览");
    log(e.message);
  }
}
function sendColor(rgb) {
  const started = performance.now();
  client.setColor(rgb).then(sent => {
    if (!sent) return;
    const elapsed = performance.now() - started;
    rttMs = rttMs ? rttMs * .9 + elapsed * .1 : elapsed;
    sentFrames++;
  }).catch(error => { lastFrame = null; log("发送失败 " + error.message); });
}

// ---- 颜色工具 ----

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function hsv(h, s = 1, v = 1) {
  h = ((h % 360) + 360) % 360 / 60;
  const i = Math.floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i].map(x => x * 255);
}
const mix = (a, b, k) => a.map((x, i) => x + (b[i] - x) * k);
const scale = (c, k) => c.map(x => x * k);
const smooth = x => x * x * (3 - 2 * x);

const PALETTE = ["#ff2040", "#ff7a00", "#ffd400", "#3dff6e", "#00e5ff", "#2f6bff", "#a64dff", "#ff4fd8", "#ffffff"];
// 幻彩多色用的几组配色
const THEMES = [
  ["#ff2040", "#ffd400", "#00e5ff", "#a64dff"],
  ["#00e5ff", "#2f6bff", "#a64dff"],
  ["#ff4fd8", "#ffd400", "#3dff6e"],
].map(t => t.map(hexToRgb));

// ---- 灯效：给定时间 t（秒，已乘速度）和基础色，返回 RGB ----

const effects = [
  { name: "常亮", desc: "单色", fn: (t, c) => c },
  { name: "呼吸", desc: "缓慢明暗", fn: (t, c) => scale(c, 0.04 + 0.96 * smooth((Math.sin(t * 1.6) + 1) / 2)) },
  { name: "闪烁", desc: "一亮一灭", fn: (t, c) => (t * 2) % 1 < 0.5 ? c : [0, 0, 0] },
  { name: "频闪", desc: "短促爆闪", fn: (t, c) => (t * 6) % 1 < 0.18 ? c : [0, 0, 0] },
  { name: "心跳", desc: "咚-咚", fn: (t, c) => {
      const p = (t * 1.1) % 1;
      const k = Math.max(Math.exp(-((p - 0.08) ** 2) / 0.002), 0.7 * Math.exp(-((p - 0.3) ** 2) / 0.003));
      return scale(c, 0.05 + 0.95 * k);
    } },
  { name: "幻彩渐变", desc: "色环慢转", fn: t => hsv(t * 40) },
  { name: "彩虹跳变", desc: "七色硬切", fn: t => hsv(Math.floor(t * 2) * (360 / 7)) },
  { name: "多色渐变", desc: "配色 1 循环", fn: t => theme(THEMES[0], t * 0.8) },
  { name: "冰蓝流光", desc: "配色 2 循环", fn: t => theme(THEMES[1], t * 0.8) },
  { name: "糖果", desc: "配色 3 循环", fn: t => theme(THEMES[2], t * 0.8) },
  { name: "呼吸变色", desc: "每口气换色", fn: t => {
      const k = smooth((Math.sin(t * 1.6 - Math.PI / 2) + 1) / 2);
      return scale(hsv(Math.floor((t * 1.6) / (2 * Math.PI)) * 67), 0.03 + 0.97 * k);
    } },
  { name: "烛光", desc: "随机摇曳", fn: (t, c) => scale(c, 0.55 + 0.45 * flicker(t)) },
  { name: "警灯", desc: "红蓝交替", fn: t => {
      const p = (t * 1.5) % 1, on = (p * 6) % 1 < 0.5;
      return on ? (p < 0.5 ? [255, 0, 0] : [0, 40, 255]) : [0, 0, 0];
    } },
  { name: "关灯", desc: "全灭", fn: () => [0, 0, 0] },
];

function theme(cols, t) {
  const n = cols.length, i = Math.floor(t) % n;
  return mix(cols[i], cols[(i + 1) % n], smooth(t % 1));
}

// 几个不同频率正弦叠出来的平滑噪声，看着像火苗
function flicker(t) {
  const v = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 13.1 + 1.3) * 0.3 + Math.sin(t * 23.7 + 2.1) * 0.2;
  return (v + 1) / 2;
}

// ---- 音乐律动 ----
// 分析用不经延迟的原始信号，播放走 DelayNode 推迟「同步」毫秒，抵消蓝牙和分析的滞后

const FFT_SIZE = 1024;           // 48 kHz 下窗口约 21 ms，频率分辨率约 47 Hz，低音够分
const BANDS = { bass: [30, 150], mid: [150, 2000], high: [2000, 9000] };
const FLUX_HISTORY = 60;         // 约 1 秒的历史，用来算自适应门限
const BEAT_MIN_GAP_S = 0.12;     // 两拍最短间隔，挡住同一拍的连续触发
const BEAT_DECAY_S = 0.18;       // 节拍脉冲衰减时间常数
const SILENCE_RMS = 0.003;       // 约 -50 dBFS，比这小当静音，不出拍

let actx = null, analyser = null, delay = null, srcNode = null, srcStream = null;
let spec = null, prevSpec = null, wave = null;
const au = { bass: 0, mid: 0, high: 0, level: 0, centroid: 0, beat: false, pulse: 0, beats: 0,
  flux: 0, thresh: 0 };
const peaks = { bass: 1e-4, mid: 1e-4, high: 1e-4, level: 1e-4, rms: 0 };
const fluxHist = [];
let lastBeatT = -1;

function ensureAudio() {
  if (actx) return;
  actx = new AudioContext({ latencyHint: "interactive" });
  analyser = actx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0;
  delay = actx.createDelay(1);
  delay.connect(actx.destination);
  spec = new Float32Array(analyser.frequencyBinCount);
  prevSpec = new Float32Array(analyser.frequencyBinCount);
  wave = new Float32Array(FFT_SIZE);
  applySync();
}

function setSource(node, stream, audible, info) {
  if (stream) $("player").pause();
  if (srcNode) srcNode.disconnect();
  if (srcStream) srcStream.getTracks().forEach(t => t.stop());
  srcNode = node; srcStream = stream;
  fluxHist.length = 0; prevSpec.fill(0); lastBeatT = -1;
  for (const key of Object.keys(au)) au[key] = 0;
  node.connect(analyser);
  if (audible) node.connect(delay);
  $("srcInfo").textContent = info;
  if (stream) stream.getAudioTracks().forEach(track => track.addEventListener("ended", stopAudio, {once:true}));
  actx.resume();
  if (!running || !running.music) startEffect(musicEffects[0]);
}

async function useFile(file) {
  ensureAudio();
  const p = $("player");
  if (p._url) URL.revokeObjectURL(p._url);
  p.src = p._url = URL.createObjectURL(file);
  p.style.display = "block";
  if (!p._node) p._node = actx.createMediaElementSource(p);
  setSource(p._node, null, true, file.name);
  try { await p.play(); } catch(e) { $("srcInfo").textContent = "无法播放这个文件，请换一个音频文件"; }
}

async function useTab() {
  ensureAudio();
  try {
    // Chrome 要求同时要视频；suppressLocalAudioPlayback 让被共享的标签页自己静音，只听这里推迟过的那一路
    const s = await navigator.mediaDevices.getDisplayMedia({
      video: true, audio: { suppressLocalAudioPlayback: true, echoCancellation: false,
        noiseSuppression: false, autoGainControl: false } });
    s.getVideoTracks().forEach(t => t.stop());
    if (!s.getAudioTracks().length) { $("srcInfo").textContent = "没拿到声音：共享时要勾上「同时分享标签页音频」"; return; }
    $("player").style.display = "none";
    setSource(actx.createMediaStreamSource(s), s, true, "标签页声音");
  } catch (e) { $("srcInfo").textContent = "共享取消：" + e.message; }
}

async function useMic() {
  ensureAudio();
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    $("player").style.display = "none";
    setSource(actx.createMediaStreamSource(s), s, false, "麦克风");
  } catch (e) { $("srcInfo").textContent = "麦克风被拒：" + e.message; }
}

function applySync() {
  const ms = +$("sync").value;
  $("syncv").textContent = ms + " ms";
  if (delay) delay.delayTime.setTargetAtTime(ms / 1000, actx.currentTime, 0.05);
}

// 灯晚于分析的时间 ≈ 排队等上一帧(约半帧) + 送达(约半个往返) + 固件 10 ms 定时 + 分析窗口一半 + 一帧刷新；
// 再扣掉声卡/耳机自己的输出延迟（蓝牙耳机可能比灯还慢，这时只能补到 0）
function autoSync() {
  if (!rttMs) { $("srcInfo").textContent = "先连上棒子跑一会儿再点"; return; }
  ensureAudio();
  const windowMs = FFT_SIZE / actx.sampleRate * 1000 / 2;
  const out = ((actx.outputLatency || 0) + actx.baseLatency) * 1000;
  const ms = Math.max(0, Math.round(rttMs + 10 + windowMs + 16 - out));
  $("sync").value = ms;
  applySync();
}

function bandEnergy(lo, hi) {
  const hz = actx.sampleRate / FFT_SIZE;
  let s = 0;
  for (let i = Math.max(1, Math.floor(lo / hz)); i <= Math.min(spec.length - 1, Math.ceil(hi / hz)); i++) s += spec[i];
  return s;
}

// 快攻慢放：上升立即跟随，下降按 release 秒衰减
const follow = (prev, x, dt, release) => x > prev ? x : prev * Math.exp(-dt / release);

function analyse(now, dt) {
  analyser.getFloatFrequencyData(spec);
  let flux = 0, num = 0, den = 0;
  const hz = actx.sampleRate / FFT_SIZE;
  for (let i = 1; i < spec.length; i++) {
    const m = Math.pow(10, spec[i] / 20);        // dB 转线性幅度
    const d = m - prevSpec[i];
    // 起拍主要看 2 kHz 以下，人声高频不该算拍子
    if (d > 0 && i * hz < 2000) flux += d;
    num += m * i * hz; den += m;
    prevSpec[i] = m; spec[i] = m;
  }
  const sens = +$("sens").value / 100;
  // 自动增益：每个量除以自己慢慢下降的历史峰值，换歌、换音量都不用调
  for (const k of ["bass", "mid", "high"]) {
    const e = bandEnergy(...BANDS[k]);
    peaks[k] = Math.max(e, peaks[k] * Math.exp(-dt / 6));
    au[k] = follow(au[k], Math.min(1, e / peaks[k] * sens), dt, 0.12);
  }
  peaks.level = Math.max(den, peaks.level * Math.exp(-dt / 6));
  au.level = follow(au.level, Math.min(1, den / peaks.level * sens), dt, 0.15);
  au.centroid = den > 0 ? num / den : 0;

  // 谱通量同时超过「近 1 秒均值 + 1.5 倍标准差」和「均值的 2 倍」才算一拍：
  // 前者挡住持续的强音，后者挡住平稳底噪的随机起伏；灵敏度越高两道门限越低
  fluxHist.push(flux); if (fluxHist.length > FLUX_HISTORY) fluxHist.shift();
  const mean = fluxHist.reduce((a, b) => a + b, 0) / fluxHist.length;
  const sd = Math.sqrt(fluxHist.reduce((a, b) => a + (b - mean) ** 2, 0) / fluxHist.length);
  au.flux = flux; au.thresh = Math.max(mean + (1.5 / sens) * sd, mean * (2 / sens));
  analyser.getFloatTimeDomainData(wave);
  const rms = Math.sqrt(wave.reduce((a, x) => a + x * x, 0) / wave.length);
  peaks.rms = Math.max(rms, peaks.rms * Math.exp(-dt / 6));
  // 比近期最响处低 20 dB 以上的段落（歌曲间隙、尾奏底噪）不出拍
  const loud = rms > SILENCE_RMS && rms > peaks.rms * 0.1;
  const t = now / 1000;
  au.beat = fluxHist.length >= FLUX_HISTORY / 2 && loud && flux > au.thresh && t - lastBeatT > BEAT_MIN_GAP_S;
  if (au.beat) { lastBeatT = t; au.beats++; au.pulse = 1; }
  else au.pulse *= Math.exp(-dt / BEAT_DECAY_S);
}

function drawMeter() {
  const c = $("meter"), g = c.getContext("2d"), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  if (!actx) return;
  const n = 64, step = Math.floor(spec.length / 2 / n);
  for (let i = 0; i < n; i++) {
    const m = spec[i * step + 1] / (peaks.level / spec.length * 8 + 1e-6);
    const h = Math.min(1, Math.sqrt(m)) * (H - 8);
    g.fillStyle = `hsl(${i / n * 300},80%,55%)`;
    g.fillRect(i * (W / n) + 1, H - h, W / n - 2, h);
  }
  g.fillStyle = `rgba(242,193,78,${au.pulse})`;
  g.fillRect(W - 16, 4, 12, 12);
}

// 亮度按平方映射：LED 的 PWM 是线性的，人眼对暗部更敏感，平方后律动更有冲击感
const lum = (c, k) => scale(c, Math.max(0, Math.min(1, k)) ** 2);
let hueDrift = 0, beatHue = 0;

const musicEffects = [
  { name: "节拍脉冲", desc: "低音推亮度", music: true,
    fn: (t, c) => lum(c, 0.25 + 0.75 * Math.max(au.pulse, au.bass * 0.8)) },
  { name: "节拍换色", desc: "每拍换一色", music: true,
    fn: () => lum(PALETTE_RGB[au.beats % PALETTE_RGB.length], 0.3 + 0.7 * au.pulse) },
  { name: "频谱色", desc: "音高定颜色", music: true,
    // 质心 150 Hz → 红，4 kHz 以上 → 紫，按对数频率插值
    fn: () => lum(hsv(Math.min(280, Math.max(0, Math.log2(Math.max(au.centroid, 150) / 150) / Math.log2(4000 / 150) * 280))),
      0.15 + 0.85 * au.level) },
  { name: "三频混色", desc: "低红 中绿 高蓝", music: true,
    fn: () => [au.bass, au.mid, au.high].map(x => 255 * x * x) },
  { name: "爆闪", desc: "拍上白闪", music: true,
    fn: (t, c) => mix(lum(c, 0.25 + 0.3 * au.level), [255, 255, 255], au.pulse ** 3) },
  { name: "幻彩律动", desc: "流动色+拍点", music: true, fn: (t, c, dt) => {
      hueDrift += dt * (20 + 120 * au.level);
      if (au.beat) beatHue += 45;
      return lum(hsv(hueDrift + beatHue), 0.2 + 0.8 * Math.max(au.pulse, au.level));
    } },
];
const PALETTE_RGB = ["#ff2040", "#ffd400", "#00e5ff", "#a64dff", "#3dff6e", "#ff7a00"].map(hexToRgb);

// ---- 白平衡 ----

const GAIN_IDS = ["gainR", "gainG", "gainB"];
const GAIN_KEY = "wuwa-lightstick-gain";

// 预览圆点显示的是想要的颜色，发给棒子的才乘增益；R=G=B 时固件点白光灯珠，乘了反而变成三色混白
function balance(rgb) {
  if (rgb[0] === rgb[1] && rgb[1] === rgb[2]) return rgb;
  return rgb.map((x, i) => Math.round(x * +$(GAIN_IDS[i]).value / 100));
}

function showGains() {
  GAIN_IDS.forEach(id => { $(id + "v").textContent = $(id).value + "%"; });
  try { localStorage.setItem(GAIN_KEY, JSON.stringify(GAIN_IDS.map(id => +$(id).value))); } catch {}
}

function loadGains() {
  try {
    const g = JSON.parse(localStorage.getItem(GAIN_KEY));
    if (Array.isArray(g)) GAIN_IDS.forEach((id, i) => { $(id).value = g[i]; });
  } catch {}
  showGains();
}

function calibrate(hexColor) {
  $("color").value = hexColor;
  $("bright").value = 100; $("bright").oninput();
  startEffect(effects[0]);
}

let running = null, raf = 0, t0 = 0, simT = 0, lastFrame = null;

function startEffect(fx) {
  if (["闪烁", "频闪", "警灯", "爆闪", "彩虹跳变"].includes(fx.name) && !$("flashConsent").checked) { $("flashNote").textContent = "这种效果会快速闪光。请先勾选下方开关，或选择呼吸、渐变。"; return; }
  $("flashNote").textContent = "";
  $("effectName").textContent = fx.name;
  running = fx;
  document.querySelectorAll("#effects button, #music button").forEach(b => { b.classList.toggle("on", b.dataset.name === fx.name); b.setAttribute("aria-pressed", String(b.dataset.name === fx.name)); });
  if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(tick); }
}

function stopEffect() {
  running = null;
  cancelAnimationFrame(raf); raf = 0;
  document.querySelectorAll("#effects button, #music button").forEach(b => b.classList.remove("on"));
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(0.1, (now - t0) / 1000); t0 = now;
  simT += dt * +$("speed").value / 100;
  if (actx) { analyse(now, dt); drawMeter(); }
  const base = hexToRgb($("color").value);
  const k = +$("bright").value / 100;
  const rgb = running.fn(simT, base, dt).map(x => Math.max(0, Math.min(255, Math.round(x * k))));
  $("orb").style.background = `rgb(${rgb})`;
  $("orb").style.setProperty("--glow", `rgba(${rgb},.6)`);
  const out = balance(rgb);
  const key = out.join();
  if (client.ready && key !== lastFrame) { lastFrame = key; sendColor(out); }
}

setInterval(() => {
  $("fps").textContent = running && client.ready ? sentFrames : "–"; sentFrames = 0;
  $("rtt").textContent = rttMs ? rttMs.toFixed(0) : "–";
}, 1000);

// ---- 界面 ----

for (const [grid, list] of [["effects", effects], ["music", musicEffects]]) {
  for (const fx of list) {
    const b = document.createElement("button");
    b.dataset.name = fx.name;
    b.innerHTML = `${fx.name}<small>${fx.desc}</small>`;
    b.onclick = () => startEffect(fx);
    $(grid).append(b);
  }
}
$("srcFile").onclick = () => $("file").click();
$("file").onchange = () => $("file").files[0] && useFile($("file").files[0]);
$("srcTab").onclick = useTab;
$("srcMic").onclick = useMic;
$("sync").oninput = applySync;
$("autoSync").onclick = autoSync;
$("sens").oninput = () => { $("sensv").textContent = (+$("sens").value / 100).toFixed(1) + "×"; };
for (const c of PALETTE) {
  const b = document.createElement("button");
  b.className = "swatch"; b.style.background = c; b.title = c; b.setAttribute("aria-label", "选择颜色 " + c);
  b.onclick = () => { $("color").value = c; if (running && !running.music && ![effects[0], effects[1], effects[2], effects[3], effects[4], effects[11]].includes(running)) startEffect(effects[0]); };
  $("swatches").append(b);
}
$("bright").oninput = () => { $("brightv").textContent = $("bright").value + "%"; };
$("speed").oninput = () => { $("speedv").textContent = (+$("speed").value / 100).toFixed(1) + "×"; };
$("connect").onclick = connect;
GAIN_IDS.forEach(id => { $(id).oninput = () => { showGains(); lastFrame = null; }; });
$("calY").onclick = () => calibrate("#ffff00");
$("calC").onclick = () => calibrate("#00ffff");
$("calM").onclick = () => calibrate("#ff00ff");
$("calReset").onclick = () => { GAIN_IDS.forEach(id => { $(id).value = 100; }); showGains(); lastFrame = null; };
loadGains();
startEffect(effects[0]);

function stopAudio() {
  const stream = srcStream; srcStream = null;
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (srcNode) srcNode.disconnect(); srcNode = null;
  $("player").pause(); $("srcInfo").textContent = "音源已停止";
  for (const key of Object.keys(au)) au[key] = 0;
  if (running?.music) startEffect(effects[0]);
}
$("stopAudio").onclick = stopAudio;
$("blackout").onclick = () => { stopAudio(); startEffect(effects.at(-1)); };
$("flashConsent").onchange = () => { if (!$("flashConsent").checked && ["闪烁","频闪","警灯","爆闪","彩虹跳变"].includes(running?.name)) startEffect(effects[1]); };
if (!window.isSecureContext || !navigator.bluetooth) {
  $("compat").textContent = "当前浏览器只能预览。连接棒子请使用支持 Web Bluetooth 的桌面 Chrome / Edge 或 Android Chrome，并通过 HTTPS 打开。iPhone / iPad 常规浏览器暂不支持连接。";
  $("connect").disabled = true;
}
if (!navigator.mediaDevices?.getDisplayMedia) $("srcTab").disabled = true;
window.addEventListener("pagehide", () => { stopAudio(); client.disconnect(); });
