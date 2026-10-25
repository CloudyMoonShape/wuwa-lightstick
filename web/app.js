import { LightstickClient } from "./sdk.js";
import { rgbToHsv, wheelRgb, renderColor } from "./color.js";
import { brightnessDrive, BrightnessSmoother, breathBrightness, breathHue } from "./dimming.js";
import { outputRate, isControlReply, EffectClock, FrameSender } from "./output.js";
import { DevicePlayback } from "./playback.js";

const t = (source, params = {}) => window.ResonatorI18n?.t(source, params) ?? source.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
const $ = id => document.getElementById(id);
const hex = b => [...b].map(x => x.toString(16).padStart(2, "0")).join(" ");
const requestedEngine = new URLSearchParams(location.search).get("engine");
let engine = ["web", "music"].includes(requestedEngine) ? requestedEngine : "native";
let trialUsed = engine !== "web";

function log(line) {
  const el = $("log");
  el.textContent += new Date().toLocaleTimeString() + "  " + line + "\n";
  if (el.textContent.length > 20000) el.textContent = el.textContent.slice(-15000);
  el.scrollTop = el.scrollHeight;
}

function setStatus(text, cls = "") { $("status").textContent = t(text); $("status").className = "web-small " + cls; $("connectionMark").dataset.state = cls === "ok" ? "on" : cls === "err" ? "off" : "unknown"; }

// Transport and frame validation are shared with developer examples through sdk.js.
let sentFrames = 0, replyFrames = 0, rttMs = 0, statsSince = performance.now();
const client = new LightstickClient({
  // FrameSender is the sole rate limiter for this controller. SDK defaults stay 60 Hz.
  minGapMs: 0,
  onState(state, detail) {
    const labels = {selecting:"选择设备…", connecting:"连接中…", authenticating:"等待蓝灯闪完…", ready:t("已连接 {device}", {device: detail || ""}), disconnected:"已断开 · 屏幕预览", error:detail ? t("连接失败：请先更换新电池后重试，并确认浏览器蓝牙权限（{detail}）", {detail}) : "连接失败：请先更换新电池后重试，并确认浏览器蓝牙权限"};
    setStatus(labels[state] || state, state === "ready" ? "ok" : state === "error" ? "err" : "");
    $("connect").disabled = ["selecting","connecting","authenticating"].includes(state);
    $("connect").textContent = state === "ready" ? t("断开连接") : t("连接应援棒");
    $("mode").textContent = state === "ready" ? t("正在控制应援棒") : t("屏幕预览");
    sender.invalidate();
    sentFrames = 0; replyFrames = 0; statsSince = performance.now();
    if (state === "ready" && running) configurePlayback();
    else playback.reset();
    if (state === "disconnected") stopAudio();
    log(t("状态 {state}{detail}", {state, detail: detail ? " " + detail : ""}));
  },
  onNotification(data) {
    if (client.ready && isControlReply(data)) replyFrames++;
    if (!running) log("<- " + hex(data));
  },
  onWrite(data, elapsed) {
    sentFrames++;
    rttMs = rttMs ? rttMs * .9 + elapsed * .1 : elapsed;
  }
});
async function connect() {
  if (!window.isSecureContext || typeof navigator.bluetooth?.requestDevice !== "function") { setStatus("当前浏览器无法连接蓝牙，可以继续屏幕试玩", "err"); return; }
  if (client.ready) { client.disconnect(); return; }
  try { await client.connect(); }
  catch (e) {
    if (e.name === "NotFoundError") setStatus("未选择设备 · 继续预览");
    log(e.message);
  }
}
function sendColor(rgb) {
  return playback.sendColor(rgb);
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

const PALETTE = [
  ["纯红", "#ff0000"], ["橙色", "#ff8000"], ["黄色", "#ffff00"],
  ["纯绿", "#00ff00"], ["青色", "#00ffff"], ["纯蓝", "#0000ff"],
  ["品红", "#ff00ff"], ["粉红", "#ff2020"], ["白光", "#ffffff"],
];
// Quick colors and animated endpoints share the same device-oriented values.
const namedColors = PALETTE.map(([, color]) => color);
// 混色仍需实物确认；连续 HSV 色环不是经过测量的色彩校准。
const THEMES = [
  [namedColors[0], namedColors[2], namedColors[4], namedColors[6]],
  [namedColors[4], namedColors[5], namedColors[6]],
  [namedColors[7], namedColors[2], namedColors[3]],
].map(t => t.map(hexToRgb));

// ---- 灯效：给定时间 t（秒，已乘速度）和基础色，返回 RGB ----

const effects = [
  { name: "常亮", desc: "单色", fn: (t, c) => c },
  { name: "调速呼吸", desc: "自选呼吸节奏", breathing: true, fn: (t, c) => c },
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
  { name: "呼吸变色", desc: "暗处柔和换色", breathing: true, fn: t => hsv(breathHue(t)) },
  { name: "烛光", desc: "随机摇曳", fn: (t, c) => scale(c, 0.55 + 0.45 * flicker(t)) },
  { name: "警灯", desc: "红蓝交替", fn: t => {
      const p = (t * 1.5) % 1, on = (p * 6) % 1 < 0.5;
      return on ? (p < 0.5 ? [255, 0, 0] : [0, 0, 255]) : [0, 0, 0];
    } },
  { name: "关灯", desc: "全灭", fn: () => [0, 0, 0] },
];
const nativeEffects = [
  { name: "常亮", native: "stream", fn: (t, c) => c },
  { name: "呼吸", native: "breathe", fn: (t, c) => c },
  { name: "三色渐变", native: "fade", fixedPalette: true, fn: t => hsv(t * 120) },
  { name: "三色呼吸", native: "rgb-breathe", fixedPalette: true,
    fn: t => [[255,0,0],[0,255,0],[0,0,255]][Math.floor(t / 2.6) % 3] },
  // Display-only approximation: the firmware's 15-color palette is independent.
  { name: "多色轮播", native: "palette-cycle", fixedPalette: true,
    fn: t => hsv(Math.floor(t / .58) % 15 * 24) },
  { name: "闪烁", native: "blink", timed: true, fn: (t, c) => c },
  { name: "三色跳变", native: "rgb-step", timed: true, fixedPalette: true,
    fn: t => [[255,0,0],[0,255,0],[0,0,255]][Math.floor(t * 4) % 3] },
  { name: "三色连闪", native: "rgb-burst", fixedPalette: true,
    fn: t => Math.floor(t / .095) % 2 ? [0,0,0] : [[255,0,0],[0,255,0],[0,0,255]][Math.floor(t / .95) % 3] },
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
let audioRequest = 0;
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
  $("stopAudio").disabled = false;
  if (stream) stream.getAudioTracks().forEach(track => track.addEventListener("ended", () => {
    if (srcStream === stream) stopAudio();
  }, {once:true}));
  actx.resume();
  if (!running || !running.music) startEffect(musicEffects[0]);
}

async function useFile(file) {
  if (engine !== "music") return;
  const request = ++audioRequest;
  ensureAudio();
  const p = $("player");
  p.hidden = false;
  if (p._url) URL.revokeObjectURL(p._url);
  p.src = p._url = URL.createObjectURL(file);
  p.style.display = "block";
  if (!p._node) p._node = actx.createMediaElementSource(p);
  setSource(p._node, null, true, file.name);
  try { await p.play(); } catch(e) { if (request === audioRequest) $("srcInfo").textContent = t("无法播放这个文件，请换一个音频文件"); }
}

async function useTab() {
  const request = ++audioRequest;
  ensureAudio();
  try {
    // Chrome 要求同时要视频；suppressLocalAudioPlayback 让被共享的标签页自己静音，只听这里推迟过的那一路
    const s = await navigator.mediaDevices.getDisplayMedia({
      video: true, audio: { suppressLocalAudioPlayback: true, echoCancellation: false,
        noiseSuppression: false, autoGainControl: false } });
    if (request !== audioRequest || engine !== "music") { s.getTracks().forEach(t => t.stop()); return; }
    s.getVideoTracks().forEach(t => t.stop());
    if (!s.getAudioTracks().length) { $("srcInfo").textContent = t("没拿到声音：共享时要勾上「同时分享标签页音频」"); return; }
    $("player").style.display = "none";
    setSource(actx.createMediaStreamSource(s), s, true, t("标签页声音"));
  } catch (e) { if (request === audioRequest) $("srcInfo").textContent = t("共享取消：{message}", {message: e.message}); }
}

async function useMic() {
  const request = ++audioRequest;
  ensureAudio();
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    if (request !== audioRequest || engine !== "music") { s.getTracks().forEach(t => t.stop()); return; }
    $("player").style.display = "none";
    setSource(actx.createMediaStreamSource(s), s, false, t("麦克风"));
  } catch (e) { if (request === audioRequest) $("srcInfo").textContent = t("麦克风被拒：{message}", {message: e.message}); }
}

function applySync() {
  const ms = +$("sync").value;
  $("syncv").textContent = ms + " ms";
  paintRange($("sync"));
  if (delay) delay.delayTime.setTargetAtTime(ms / 1000, actx.currentTime, 0.05);
}

// 灯晚于分析的时间 ≈ 排队等上一帧(约半帧) + 送达(约半个往返) + 固件 10 ms 定时 + 分析窗口一半 + 一帧刷新；
// 再扣掉声卡/耳机自己的输出延迟（蓝牙耳机可能比灯还慢，这时只能补到 0）
function autoSync() {
  if (!rttMs) { $("srcInfo").textContent = t("先连上棒子跑一会儿再点"); return; }
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

let meterInk = getComputedStyle(document.documentElement).getPropertyValue("--web-ink").trim();
matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => { meterInk = getComputedStyle(document.documentElement).getPropertyValue("--web-ink").trim(); });
function drawMeter() {
  const c = $("meter"), g = c.getContext("2d"), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  if (!actx) return;
  const n = 64, step = Math.floor(spec.length / 2 / n);
  for (let i = 0; i < n; i++) {
    const m = spec[i * step + 1] / (peaks.level / spec.length * 8 + 1e-6);
    const h = Math.min(1, Math.sqrt(m)) * (H - 8);
    g.fillStyle = meterInk;
    g.fillRect(i * (W / n) + 1, H - h, W / n - 2, h);
  }
  g.fillStyle = meterInk;
  if (au.pulse > 0.5) g.fillRect(W - 16, 4, 12, 12);
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
const PALETTE_RGB = [0, 2, 4, 6, 3, 1].map(i => hexToRgb(namedColors[i]));
const selectedEffects = {native: nativeEffects[0], web: effects[5], music: musicEffects[0]};

// ---- 白平衡 ----

const GAIN_IDS = ["gainR", "gainG", "gainB"];
const GAIN_KEY = "wuwa-lightstick-gain";

// 预览圆点显示的是想要的颜色，发给棒子的才乘增益；R=G=B 时固件点白光灯珠，乘了反而变成三色混白
function balance(rgb, brightness) {
  return renderColor(rgb, {brightness,
    yellowGreen: +$("yellowGreen").value,
    gains: $("useGains").checked ? GAIN_IDS.map(id => +$(id).value/100) : [1,1,1]});
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
  $("color").value = hexColor; syncWheel();
  $("bright").value = 100; $("bright").oninput();
  paintRange($("bright")); stopAudio();
  startEffect(effects[0]);
}

let running = null, raf = 0, visualTime = performance.now(), musicRgb = [0,0,0];
const effectClock = new EffectClock(visualTime);
const brightnessSmoother = new BrightnessSmoother(+$("bright").value / 100);
const sender = new FrameSender({
  rate: outputRate(new URLSearchParams(location.search).get("rate")),
  readFrame: now => sampleFrame(now).out,
  sendFrame: sendColor,
  onError: error => log(t("发送失败 {message}", {message: error.message}))
});
const playback = new DevicePlayback({ client, sender, canStream: () => !document.hidden && !!running,
  onMode: mode => {
    $("mode").textContent = mode === "stream" ? t("正在控制应援棒") : t("灯棒自主播放 · 屏幕仅示意");
    $("playbackState").textContent = mode === "stream" ? "" : t("灯棒已确认");
  },
  onError: error => { $("playbackState").textContent = t("切换失败，请重新连接"); log(error.message); }
});
let lastPreview = "", lastOutput = "";
const FLASH_EFFECTS = new Set(["闪烁", "频闪", "警灯", "爆闪", "彩虹跳变", "三色跳变", "三色连闪"]);

function configurePlayback(forceReset = false) {
  if (!client.ready || !running) return;
  const kind = running.native || "stream";
  if (kind !== "stream") $("playbackState").textContent = t("等待灯棒确认…");
  void playback.configure({ kind, continuous: trialUsed, forceReset,
    rgb: balance(hexToRgb($("color").value), brightnessDrive(+$("bright").value / 100)),
    intervalMs: running.timed ? Math.round(250 / (+$("speed").value / 100)) : undefined });
}

function colorChanged() {
  if (running?.music) { sender.invalidate(); return; }
  stopAudio();
  if (["breathe", "blink"].includes(running?.native)) sender.invalidate();
  else startEffect(effects[0]);
}

function startEffect(fx) {
  const previousEngine = engine;
  if (fx.music && engine !== "music") { engine = "music"; renderEffects(); }
  if (!fx.music && !fx.native && fx.name !== "关灯" && engine === "music") { engine = "native"; trialUsed = true; renderEffects(); }
  if (previousEngine !== engine) updateEngineUrl();
  if (engine === "native" && fx === effects[0]) fx = nativeEffects[0];
  if (FLASH_EFFECTS.has(fx.name) && !$("flashConsent").checked) { $("flashing").open = true; $("flashNote").textContent = t("先开启「允许快速闪光」，或选择呼吸、渐变。"); return; }
  $("flashNote").textContent = "";
  $("effectName").textContent = t(fx.name);
  if ((fx.breathing || fx.native) && running !== fx) effectClock.reset(performance.now());
  if (fx !== running) { musicRgb = [0,0,0]; sender.invalidate(); }
  running = fx;
  if (fx.name !== "关灯") selectedEffects[engine] = fx;
  lastOutput = "";
  document.querySelectorAll("[data-effect]").forEach(b => { b.classList.toggle("on", b.dataset.name === fx.name); b.setAttribute("aria-pressed", String(b.dataset.name === fx.name)); });
  $("blackout").setAttribute("aria-pressed", String(fx.name === "关灯"));
  $("speed").disabled = ["常亮", "关灯"].includes(fx.name) || !!fx.music;
  if (fx.native && !fx.timed) $("speed").disabled = true;
  $("speedv").textContent = fx.native && !fx.timed && fx.native !== "stream" ? t("固定") : (+$("speed").value / 100).toFixed(1) + "×";
  document.querySelector(".color-panel").inert = !!fx.fixedPalette;
  document.querySelector(".color-panel").setAttribute("aria-disabled", String(!!fx.fixedPalette));
  $("calibration").inert = !!fx.fixedPalette;
  $("brightv").textContent = fx.fixedPalette ? t("预设") : $("bright").value + "%";
  $("playbackState").textContent = "";
  $("nativeNote").textContent = fx.fixedPalette ? t("颜色与亮度由灯棒预设；屏幕仅示意。") : fx.native === "breathe" ? t("固定周期约 2.6 秒；屏幕仅示意。") : fx.native === "blink" ? t("灯棒自主闪烁；屏幕仅示意。") : "";
  if (!raf) { visualTime = performance.now(); raf = requestAnimationFrame(tick); }
  configurePlayback(fx.name === "关灯" && trialUsed);
}

function stopEffect() {
  running = null;
  cancelAnimationFrame(raf); raf = 0;
  sender.stop();
  document.querySelectorAll("[data-effect]").forEach(b => { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); });
}

function sampleFrame(now, visualDt) {
  const {time, elapsed} = effectClock.advance(now, running.native && !running.timed ? 1 : +$("speed").value / 100);
  const base = hexToRgb($("color").value);
  const level = brightnessSmoother.advance(+$("bright").value / 100, elapsed);
  const ceiling = brightnessDrive(level);
  if (running.native && running.native !== "stream") {
    const rgb = running.fn(time, base);
    const envelope = ["breathe", "rgb-breathe"].includes(running.native) ? (1 - Math.cos(time / 2.6 * Math.PI * 2)) / 2 : running.native === "blink" ? (time * 2 % 1 < .5 ? 1 : 0) : 1;
    return { rgb, k: envelope * (running.fixedPalette ? 1 : ceiling), out: balance(base, ceiling) };
  }
  if (running.music && !srcNode) return {rgb:[0,0,0], k:0, out:[0,0,0]};
  // Audio analysis and stateful music effects still advance only with the UI.
  // Extra Bluetooth samples must not count a beat twice or speed up hue drift.
  if (running.music && visualDt !== undefined) musicRgb = running.fn(time, base, visualDt);
  const rgb = (running.music ? musicRgb : running.fn(time, base, Math.min(.1,elapsed)))
    .map(x => Math.max(0, Math.min(255, x)));
  const k = running.breathing ? breathBrightness(time, ceiling, Math.max(...rgb)) : ceiling;
  return {rgb, k, out:balance(rgb, k)};
}

function tick() {
  raf = requestAnimationFrame(tick);
  const now = performance.now(), dt = Math.min(.1, Math.max(0, now-visualTime)/1000);
  visualTime = now;
  if (srcNode) { analyse(now, dt); drawMeter(); }
  const {rgb, k, out} = sampleFrame(now, dt);
  const preview = rgb.map(x=>Math.round(x*k)).join();
  if (preview !== lastPreview) {
    $("orb").style.background = `rgb(${preview})`;
    lastPreview = preview;
  }
  const key = out.join();
  if (key !== lastOutput) {
    const baseOutput = running.native && running.native !== "stream";
    const whiteOutput = out[0] > 0 && out.every(x => x === out[0]);
    const outputLabel = baseOutput
      ? (whiteOutput ? "基础 RGB {rgb} · 白光通道" : "基础 RGB {rgb} · RGB 通道")
      : (whiteOutput ? "输出 RGB {rgb} · 白光通道" : "输出 RGB {rgb} · RGB 通道");
    $("outputRgb").textContent = running.fixedPalette ? t("灯棒预设 · 不提供实时 RGB 读回") : t(outputLabel, {rgb: out.join(", ")});
    lastOutput = key;
  }
}

setInterval(() => {
  const now = performance.now(), elapsed = now - statsSince;
  $("fps").textContent = running && client.ready ? Math.round(sentFrames * 1000 / elapsed) : "–";
  $("replyFps").textContent = running && client.ready ? Math.round(replyFrames * 1000 / elapsed) : "–";
  sentFrames = 0; replyFrames = 0; statsSince = now;
  $("rtt").textContent = rttMs ? rttMs.toFixed(0) : "–";
}, 1000);

// ---- 界面 ----

const effectIcons = {
  "常亮": '<circle cx="12" cy="12" r="5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  "呼吸": '<path d="M2 15c4 0 4-9 10-9s6 9 10 9M2 19h20"/>',
  "心跳": '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  "幻彩渐变": '<path d="M4 15a8 8 0 0 1 16 0M7 15a5 5 0 0 1 10 0M10 15a2 2 0 0 1 4 0"/>',
  "多色渐变": '<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>',
  "冰蓝流光": '<path d="M3 7h12m-7 5h13M3 17h12"/>',
  "糖果": '<path d="m4 4 16 16M4 9l11 11M9 4l11 11"/>',
  "呼吸变色": '<path d="M3 16c4 0 4-8 9-8s5 8 9 8M6 4h12"/>',
  "烛光": '<path d="M12 3c1 5 6 7 6 12a6 6 0 0 1-12 0c0-3 3-6 6-12Z"/><path d="M12 13c-3 3-2 6 0 7"/>',
};
effectIcons["三色渐变"] = effectIcons["多色渐变"];
effectIcons["三色呼吸"] = effectIcons["呼吸变色"];
effectIcons["调速呼吸"] = effectIcons["呼吸"];
effectIcons["多色轮播"] = '<path d="M5 4h14v16H5zM5 9h14M5 15h14M10 4v5m4 0v6m-4 0v5"/>';
effectIcons["节拍脉冲"] = effectIcons["心跳"];
effectIcons["节拍换色"] = effectIcons["呼吸变色"];
effectIcons["频谱色"] = '<path d="M4 17V9m4 8V5m4 12V3m4 14V7m4 10v-6"/>';
effectIcons["三频混色"] = effectIcons["多色渐变"];
effectIcons["幻彩律动"] = effectIcons["幻彩渐变"];
function renderEffects() {
  const list = engine === "native" ? nativeEffects : engine === "music" ? musicEffects : effects;
  const regular = list.filter(fx => fx.name !== "关灯" && !FLASH_EFFECTS.has(fx.name));
  for (const [grid, entries] of [["effects", engine === "music" ? [] : regular], ["flashEffects", list.filter(fx => FLASH_EFFECTS.has(fx.name))], ["music", engine === "music" ? regular : []]]) {
    $(grid).replaceChildren();
    $(grid).dataset.count = entries.length;
    for (const fx of entries) {
      const b = document.createElement("button");
      b.className = "web-small"; b.dataset.name = fx.name; b.dataset.effect = "";
      b.innerHTML = (effectIcons[fx.name] ? `<svg viewBox="0 0 24 24" aria-hidden="true">${effectIcons[fx.name]}</svg>` : "") + `<span>${t(fx.name)}</span>`;
      b.title = t(fx.desc || fx.name);
      b.setAttribute("aria-pressed", String(fx === running));
      b.classList.toggle("on", fx === running);
      b.onclick = () => startEffect(fx);
      $(grid).append(b);
    }
  }
  document.querySelector(".effects-panel").dataset.engine = engine;
  document.querySelectorAll('[name="engine"]').forEach(input => { input.checked = input.value === engine; });
  $("sound").hidden = engine !== "music";
  $("effectControls").hidden = engine === "music";
  $("flashing").open = false;
}
renderEffects();
function updateEngineUrl() {
  const url = new URL(location.href); url.searchParams.set("engine", engine); history.replaceState(null, "", url);
}
document.querySelectorAll('[name="engine"]').forEach(input => { input.onchange = () => {
  stopAudio(); engine = input.value; trialUsed ||= engine !== "web";
  if (engine === "music") $("srcInfo").textContent = t("选择音源");
  renderEffects();
  const selected = selectedEffects[engine];
  startEffect(FLASH_EFFECTS.has(selected.name) && !$("flashConsent").checked
    ? engine === "native" ? nativeEffects[1] : engine === "music" ? musicEffects[0] : effects[1]
    : selected);
  updateEngineUrl();
}; });
$("srcFile").onclick = () => $("file").click();
$("file").onchange = () => {
  const file = $("file").files[0];
  if (file) useFile(file);
  $("file").value = "";
};
$("player").onended = stopAudio;
$("srcTab").onclick = useTab;
$("srcMic").onclick = useMic;
$("sync").oninput = applySync;
$("autoSync").onclick = autoSync;
$("sens").oninput = () => { $("sensv").textContent = (+$("sens").value / 100).toFixed(1) + "×"; };
for (const [name, c] of PALETTE) {
  const b = document.createElement("button");
  b.className = "swatch web-small"; b.style.setProperty("--swatch", c); b.dataset.color = c;
  b.title = t(name + " · {hex}", {hex: c.toUpperCase()});
  b.setAttribute("aria-label", t("选择" + name + " {hex}", {hex: c.toUpperCase()}));
  b.onclick = () => { $("color").value = c; syncWheel(); colorChanged(); };
  $("swatches").append(b);
}
$("color").oninput = () => { syncWheel(); colorChanged(); };
$("bright").oninput = () => { $("brightv").textContent = $("bright").value + "%"; };
$("speed").oninput = () => { $("speedv").textContent = (+$("speed").value / 100).toFixed(1) + "×"; if (running?.timed) configurePlayback(); };
$("connect").onclick = connect;
GAIN_IDS.forEach(id => { $(id).oninput = () => { showGains(); sender.invalidate(); }; });
$("calY").onclick = () => calibrate("#ffff00");
$("calC").onclick = () => calibrate("#00ffff");
$("calM").onclick = () => calibrate("#ff00ff");
$("calReset").onclick = () => { GAIN_IDS.forEach(id => { $(id).value = 100; }); showGains(); sender.invalidate(); };
$("sendRate").value = String(sender.rate);
$("sendRate").onchange = () => {
  sender.setRate($("sendRate").value);
  sentFrames = 0; replyFrames = 0; statsSince = performance.now();
  const url = new URL(location.href);
  url.searchParams.set("rate", String(sender.rate));
  history.replaceState(null, "", url);
};
document.addEventListener("visibilitychange", () => {
  playback.resume();
});
loadGains();
startEffect(requestedEngine === "native" ? nativeEffects[1] : requestedEngine === "web" ? effects[0] : selectedEffects[engine]);

function stopAudio() {
  audioRequest++;
  const stream = srcStream; srcStream = null;
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (srcNode) srcNode.disconnect(); srcNode = null;
  $("player").pause(); $("player").hidden = true; $("player").style.display = "none";
  $("srcInfo").textContent = t("音源已停止");
  $("stopAudio").disabled = true;
  if (actx?.state === "running") actx.suspend().catch(error => log(error.message));
  const meter=$("meter"); meter.getContext("2d").clearRect(0,0,meter.width,meter.height);
  for (const key of Object.keys(au)) au[key] = 0;
  musicRgb = [0,0,0]; sender.invalidate();
}
$("stopAudio").onclick = stopAudio;
$("blackout").onclick = () => { stopAudio(); startEffect(effects.at(-1)); };
$("flashConsent").onchange = () => { if (!$("flashConsent").checked && FLASH_EFFECTS.has(running?.name)) startEffect(engine === "native" ? nativeEffects[1] : engine === "music" ? musicEffects[0] : effects[1]); };
// Connection guide: one tab per device family, opened on the visitor's own.
const ua = navigator.userAgent;
const guideDevice = /MicroMessenger|\bQQ\/|Weibo|DingTalk/i.test(ua) ? "in-app"
  : /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iphone"
  : /OpenHarmony|HarmonyOS|ArkWeb/.test(ua) ? "harmony"
  : /Android/.test(ua) ? "android" : "computer";
function showGuideTab(tab) {
  if (tab === "iphone") document.querySelectorAll("[data-guide-src]").forEach(image => { if (!image.hasAttribute("src")) image.src = image.dataset.guideSrc; });
  document.querySelector(`input[name=guideTab][value="${tab}"]`).checked = true;
  document.querySelectorAll(".guide-panel").forEach(panel => { panel.hidden = panel.dataset.tab !== tab; });
}
document.querySelectorAll("input[name=guideTab]").forEach(input => input.addEventListener("change", () => showGuideTab(input.value)));
document.addEventListener("click", async e => {
  if (e.target.closest("[data-guide]")) { showGuideTab(guideDevice); $("guide").showModal(); return; }
  const copy = e.target.closest("[data-copy]");
  if (!copy) return;
  const label = copy.textContent;
  try { await navigator.clipboard.writeText(copy.dataset.copy); copy.textContent = t("已复制"); }
  catch { copy.textContent = copy.dataset.copy; }
  setTimeout(() => { copy.textContent = t(label); }, 2500);
});
$("guide").addEventListener("click", e => { if (e.target === $("guide")) $("guide").close(); });
if (!window.isSecureContext || typeof navigator.bluetooth?.requestDevice !== "function") {
  setStatus("屏幕预览 · 当前浏览器无法连接蓝牙");
  // Name the visitor's situation so the guide reads as a next step, not a dead end.
  const hint = {"in-app": "在微信 / QQ 里不能连接，请换到浏览器打开。", iphone: "iPhone / iPad 需要先装一个免费 App 才能连接。"}[guideDevice]
    ?? "当前浏览器尚未开放网页蓝牙，可以在屏幕上调色、播放灯效。";
  const more = document.createElement("button");
  Object.assign(more, {type: "button", className: "web-small quiet inline", textContent: t("查看连接方法")});
  more.dataset.guide = "";
  $("compat").replaceChildren(t(hint) + " ", more);
  $("connect").textContent = t("怎么连接");
  $("connect").classList.add("guide-open");
  $("connect").onclick = () => { showGuideTab(guideDevice); $("guide").showModal(); };
  $("guideOpen").hidden = true;
}
if (!navigator.mediaDevices?.getDisplayMedia) $("srcTab").disabled = true;
if (!navigator.mediaDevices?.getUserMedia) $("srcMic").disabled = true;
window.addEventListener("pagehide", () => { stopAudio(); client.disconnect(); });

// Native canvas color wheel: hue around the rim, saturation toward the center.
const wheel = $("wheel"), ctx = wheel.getContext("2d");
const size=wheel.width, center=size/2, radius=center-14;
const pixels=ctx.createImageData(size,size);
for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
  const dx=x-center,dy=y-center, sat=Math.hypot(dx,dy)/radius;
  if(sat>1) continue;
  const h=(Math.atan2(dy,dx)*180/Math.PI+90+360)%360;
  const color=wheelRgb(h,sat), j=(y*size+x)*4;
  pixels.data.set([...color.map(Math.round),255],j);
}
let selectedHue=0;
function syncWheel() {
  const [h,s]=rgbToHsv(hexToRgb($("color").value));
  if(s) selectedHue=h;
  $("wheelHue").value=Math.round(selectedHue); $("wheelSat").value=Math.round(s*100);
  $("wheelHueValue").textContent=`${Math.round(selectedHue)}°`;
  $("wheelSatValue").textContent=`${Math.round(s*100)}%`;
  $("colorName").textContent=t(PALETTE.find(([,color])=>color === $("color").value)?.[0] || "自选");
  document.querySelectorAll("[data-color]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.color === $("color").value)));
  paintRange($("wheelHue")); paintRange($("wheelSat"));
  ctx.putImageData(pixels,0,0);
  const a=(selectedHue-90)*Math.PI/180, x=center+Math.cos(a)*s*radius, y=center+Math.sin(a)*s*radius;
  ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--eink-black").trim();ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--eink-paper").trim();ctx.lineWidth=3;ctx.stroke();
}
function selectWheel(h,s) {
  selectedHue=((h%360)+360)%360;
  $("color").value="#"+wheelRgb(selectedHue,s).map(x=>Math.round(x).toString(16).padStart(2,"0")).join("");
  syncWheel(); colorChanged();
}
function pointWheel(event) {
  const rect=wheel.getBoundingClientRect(),dx=(event.clientX-rect.left)*size/rect.width-center,dy=(event.clientY-rect.top)*size/rect.height-center;
  selectWheel((Math.atan2(dy,dx)*180/Math.PI+90+360)%360,Math.min(1,Math.hypot(dx,dy)/radius));
}
wheel.onpointerdown=e=>{wheel.setPointerCapture(e.pointerId);pointWheel(e)};
wheel.onpointermove=e=>{if(wheel.hasPointerCapture(e.pointerId)) pointWheel(e)};
wheel.onpointerup=e=>{if(wheel.hasPointerCapture(e.pointerId)) wheel.releasePointerCapture(e.pointerId)};
$("wheelHue").oninput=()=>selectWheel(+$("wheelHue").value,+$("wheelSat").value/100);
$("wheelSat").oninput=()=>selectWheel(+$("wheelHue").value,+$("wheelSat").value/100);
$("yellowGreen").oninput=()=>{$("yellowValue").textContent=$("yellowGreen").value;sender.invalidate()};
$("useGains").onchange=()=>{sender.invalidate()};
function paintRange(input) {
  const min=+input.min || 0, max=+input.max || 100;
  input.style.setProperty("--fill", `${(+input.value-min)/(max-min)*100}%`);
}
document.querySelectorAll('input[type="range"]').forEach(input => {
  paintRange(input); input.addEventListener("input", () => paintRange(input));
});
const resetGains = $("calReset").onclick;
$("calReset").onclick=()=>{resetGains();GAIN_IDS.forEach(id=>paintRange($(id)))};
syncWheel();
