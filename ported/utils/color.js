function parseHex(value) {
  const hex = value.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return;
  const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
  const n = (i) => parseInt(full.slice(i, i + 2), 16);
  return { rgb: [n(0), n(2), n(4)], alpha: full.length === 8 ? n(6) / 255 : 1 };
}
const toHex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const triplet = ([r, g, b]) => `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
const toLinear = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const fromLinear = (v) => 255 * (v <= 31308e-7 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
function toOklch([r, g, b]) {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}
function rawRgb({ l: L, c, h }) {
  const A = c * Math.cos(h * Math.PI / 180), B = c * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
function fromOklch(color) {
  let c = color.c;
  for (let i = 0; i < 24; i++) {
    const linear = rawRgb({ ...color, c });
    if (linear.every((v) => v >= -5e-4 && v <= 1.0005)) return linear.map(fromLinear);
    c *= 0.9;
  }
  return rawRgb({ ...color, c: 0 }).map(fromLinear);
}
const oklch = (l, c, h) => fromOklch({ l, c, h });
function luminance([r, g, b]) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function onColor(fill) {
  const hue = toOklch(fill).h, dark = oklch(0.22, 0.03, hue), light = [255, 255, 255];
  return contrast(fill, dark) >= contrast(fill, light) ? dark : light;
}
export {
  contrast,
  fromOklch,
  luminance,
  mix,
  oklch,
  onColor,
  parseHex,
  toHex,
  toOklch,
  triplet
};
