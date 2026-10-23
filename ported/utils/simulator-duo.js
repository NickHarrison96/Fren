import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { plate, roundedRect } from "./simulator-hardware";
const DUO_FOLD = { closed: 0, book: 127 / 180, open: 1 };
const COVER = { width: 466, height: 678 }, INNER = { width: 951, height: 669 };
const MM = 1 / 16.6;
const HALF = 5.2 * MM, GAP = 0.9 * MM;
const BEZEL = 3.5 * MM, OUTER = 0.55 + BEZEL, HINGE = 0.06, BEVEL = 0.06;
const SPINE = 1.8 * MM, BARREL = 0.29;
const BEND = 0.04, BEND_SEGMENTS = 16;
const APPLE_PATH = "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";
const APPLE = APPLE_PATH.split("M").filter(Boolean).map((part) => {
  const n = (part.match(/-?\d*\.?\d+/g) ?? []).map(Number), shape = new THREE.Shape();
  let x = n[0], y = n[1];
  shape.moveTo(x, y);
  for (let i = 2; i + 5 < n.length; i += 6) {
    shape.bezierCurveTo(x + n[i], y + n[i + 1], x + n[i + 2], y + n[i + 3], x + n[i + 4], y + n[i + 5]);
    x += n[i + 4];
    y += n[i + 5];
  }
  return shape;
});
function duoDisplays(duo) {
  const given = typeof duo === "object" && duo ? duo : {};
  const sized = (size, fallback) => {
    const width = Number(size?.width) || fallback.width, height = Number(size?.height) || fallback.height;
    return width > height === fallback.width > fallback.height ? { width, height } : { width: height, height: width };
  };
  return { cover: sized(given.cover, COVER), inner: sized(given.inner, INNER) };
}
function sideRect(width, height, left, right) {
  const x = -width / 2, y = -height / 2, l = Math.min(Math.max(left, 1e-3), width / 2, height / 2), r = Math.min(Math.max(right, 1e-3), width / 2, height / 2), shape = new THREE.Shape();
  shape.moveTo(x + l, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + l, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - l);
  shape.lineTo(x, y + l);
  shape.quadraticCurveTo(x, y, x + l, y);
  return shape;
}
function sidePlate(width, height, left, right, u0 = 0, u1 = 1) {
  const geometry = new THREE.ShapeGeometry(sideRect(width, height, left, right), 24);
  const position = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) uv.setXY(i, u0 + (position.getX(i) / width + 0.5) * (u1 - u0), position.getY(i) / height + 0.5);
  return geometry;
}
const LENTICULAR_VERTEX = (
  /* glsl */
  `
varying vec2 vUv; varying vec3 vNormal; varying vec3 vView; varying vec3 vAcross;
void main() {
  vUv = uv;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vAcross = normalize((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vView = -view.xyz;
  gl_Position = projectionMatrix * view;
}`
);
const LENTICULAR_FRAGMENT = (
  /* glsl */
  `
uniform float uOpen; uniform float uWidth;
varying vec2 vUv; varying vec3 vNormal; varying vec3 vView; varying vec3 vAcross;
vec3 hue(float h) { return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
void main() {
  vec3 view = normalize(vView);
  float facing = clamp(abs(dot(normalize(vNormal), view)), 0.0, 1.0), across = dot(view, normalize(vAcross));
  float x = vUv.x * uWidth, hinge = abs(vUv.x - 0.5) * uWidth;
  // Lenticules far finer than a pixel at rest: they shimmer into a fine grain, never a fence.
  float phase = x * 46.0, blur = clamp(fwidth(phase) * 1.5, 0.0, 1.0);
  float grain = mix(0.55 + 0.45 * cos(6.2831853 * phase), 0.75, blur);
  // Thin spectral bands that sweep across the display, and through the spectrum, with the view angle.
  float sweep = across * 2.2 + x * 0.32;
  float bands = pow(0.5 + 0.5 * cos(6.2831853 * sweep), 10.0) + 0.35 * pow(0.5 + 0.5 * cos(6.2831853 * (sweep * 2.7 + 0.3)), 16.0);
  float on = smoothstep(0.0, 0.05, uOpen), angled = clamp((1.0 - facing) * 1.6, 0.0, 1.0);
  float amount = on * min(0.16 * sin(3.14159265 * uOpen) + 0.55 * angled + 0.03, 0.42);
  vec3 sheen = min(hue(fract(sweep * 0.5 + across)) * bands * grain * amount, vec3(0.32));
  float band = exp(-pow(hinge / 0.06, 2.0)) * on * (0.03 + 0.1 * angled);
  float dip = exp(-pow(hinge / 0.025, 2.0)) * on * 0.22;
  gl_FragColor = vec4(sheen + band, dip);
}`
);
function buildDuo(parent, finish, displays, shared) {
  const cover = { width: displays.cover.width / 100, height: displays.cover.height / 100 };
  const inner = { width: displays.inner.width / 100, height: displays.inner.height / 100 };
  const W = inner.width / 2 + BEZEL, H = Math.max(inner.height + BEZEL * 2, cover.height + 5.5 * MM);
  const color = new THREE.Color(finish.color), light = color.getHSL({ h: 0, s: 0, l: 0 }).l > 0.6;
  const tone = color.clone().offsetHSL(0, 0, light ? -0.04 : 0.05);
  const titanium = new THREE.MeshPhysicalMaterial({ color: tone, metalness: 0.92, roughness: 0.28, envMapIntensity: 1.3 });
  const printed = new THREE.MeshPhysicalMaterial({ color: tone, metalness: 0.85, roughness: 0.46, envMapIntensity: 1.2 });
  const sheen = color.clone().offsetHSL(0, 0, 0.5);
  const back = new THREE.MeshPhysicalMaterial({ color: color.clone().offsetHSL(-0.015, light ? -0.03 : -0.06, light ? -0.015 : 0.02), metalness: 0.15, roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.7, envMapIntensity: 0.9, specularIntensity: light ? 1 : 0.8, specularColor: sheen });
  const plateau = new THREE.MeshPhysicalMaterial({ color: color.clone().offsetHSL(-0.015, -0.06, light ? -0.06 : -0.025), metalness: 0.1, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.4, envMapIntensity: 0.4, specularIntensity: 0.5, specularColor: sheen });
  const logo = new THREE.MeshPhysicalMaterial({ color: color.clone().offsetHSL(-0.015, 0.02, light ? -0.1 : -0.02), roughness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 0.8, specularIntensity: 1, specularColor: sheen });
  const nano = new THREE.MeshPhysicalMaterial({ color: 197380, roughness: 0.3, specularIntensity: 0.35, envMapIntensity: 0.12 });
  const nanoGlare = new THREE.MeshPhysicalMaterial({ color: 0, roughness: 0.5, envMapIntensity: 1, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
  const lensGlass = new THREE.MeshPhysicalMaterial({ color: 394759, roughness: 0.06, clearcoat: 0.6, clearcoatRoughness: 0.05, envMapIntensity: 0.3 });
  const lensFace = new THREE.MeshBasicMaterial({ color: 526346 });
  const bezel = new THREE.MeshPhysicalMaterial({ color: color.clone().offsetHSL(-0.015, 0, light ? -0.1 : 0.01), metalness: 0.75, roughness: 0.32, envMapIntensity: 0.7 });
  const glint = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const shade = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.07, depthWrite: false });
  const ring = new THREE.MeshPhysicalMaterial({ color: tone, metalness: 0.85, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 1.2 });
  const ringDark = new THREE.MeshStandardMaterial({ color: 1776672, metalness: 0.7, roughness: 0.35 });
  const flash = new THREE.MeshPhysicalMaterial({ color: 8749435, metalness: 0.5, roughness: 0.45, clearcoat: 0.2, clearcoatRoughness: 0.3 });
  const flashRim = new THREE.MeshPhysicalMaterial({ color: 6249560, metalness: 0.6, roughness: 0.4 });
  const hole = new THREE.MeshBasicMaterial({ color: 328965 });
  const antenna = new THREE.MeshPhysicalMaterial({ color: color.clone().offsetHSL(0, -0.15, light ? -0.18 : 0.06), roughness: 0.55, clearcoat: 0.3 });
  const lenticular = new THREE.ShaderMaterial({
    uniforms: { uOpen: { value: 0 }, uWidth: { value: inner.width } },
    vertexShader: LENTICULAR_VERTEX,
    fragmentShader: LENTICULAR_FRAGMENT,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor
  });
  const materials = [titanium, printed, back, nano, nanoGlare, lensGlass, lensFace, bezel, glint, shade, ring, ringDark, flash, flashRim, hole, antenna, lenticular, plateau, logo];
  const root = new THREE.Group(), right = new THREE.Group(), pivot = new THREE.Group(), left = new THREE.Group();
  pivot.position.z = GAP / 2;
  left.position.z = -GAP / 2;
  pivot.add(left);
  root.add(right, pivot);
  parent.add(root);
  const pickables = [], buttons = /* @__PURE__ */ new Map();
  const put = (group, object, x, y, z, pick = true) => {
    object.position.set(x, y, z);
    group.add(object);
    if (pick) pickables.push(object);
    return object;
  };
  const overlay = (host, geometry, material, z, order) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    mesh.renderOrder = order;
    mesh.userData.noShadow = true;
    host.add(mesh);
  };
  const faceBack = (geometry) => geometry.rotateY(Math.PI);
  for (const side of [1, -1]) {
    const [l, r] = side > 0 ? [HINGE, OUTER] : [OUTER, HINGE];
    const body = new THREE.ExtrudeGeometry(sideRect(W - BEVEL * 2, H - BEVEL * 2, l - BEVEL, r - BEVEL), { depth: HALF - BEVEL * 2, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 8, curveSegments: 40 });
    body.translate(side * W / 2, 0, -(HALF - BEVEL));
    put(side > 0 ? right : left, new THREE.Mesh(body, [side > 0 ? back : shared.glass, titanium]), 0, 0, 0);
  }
  const inside = (side) => {
    const group = side > 0 ? right : left, span = W - BEVEL * 0.6 - BEND, half = inner.width / 2 - BEND;
    put(group, new THREE.Mesh(sidePlate(span, H - BEVEL * 1.2, side > 0 ? 0 : OUTER - BEVEL * 0.6, side > 0 ? OUTER - BEVEL * 0.6 : 0), nano), side * (BEND + span / 2), 0, 2e-3);
    const [u0, u1] = side > 0 ? [0.5 + BEND / inner.width, 1] : [0, 0.5 - BEND / inner.width];
    const geometry = sidePlate(half, inner.height, side > 0 ? 0 : 0.55, side > 0 ? 0.55 : 0, u0, u1);
    const mesh = put(group, new THREE.Mesh(geometry, shared.inner), side * (BEND + half / 2), 0, 4e-3);
    overlay(mesh, geometry, nanoGlare, 15e-4, 1);
    overlay(mesh, geometry, lenticular, 2e-3, 2);
    return { mesh, u0, u1, width: half, height: inner.height };
  };
  const innerSurfaces = [inside(-1), inside(1)];
  const strip = (height, material, surface) => {
    const geometry = new THREE.BufferGeometry(), uv = [], index = [];
    for (let i = 0; i <= BEND_SEGMENTS; i++) {
      const u = 0.5 + (i / BEND_SEGMENTS * 2 - 1) * BEND / inner.width;
      uv.push(u, 0, u, 1);
      if (i < BEND_SEGMENTS) index.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array((BEND_SEGMENTS + 1) * 6), 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(index);
    return { mesh: new THREE.Mesh(geometry, material), height, surface };
  };
  const bezelBend = strip(H - BEVEL * 1.2, nano, 2e-3), screenBend = strip(inner.height, shared.inner, 4e-3);
  put(root, bezelBend.mesh, 0, 0, 0);
  put(root, screenBend.mesh, 0, 0, 0);
  overlay(screenBend.mesh, screenBend.mesh.geometry, lenticular, 0, 2);
  const coverMesh = new THREE.Mesh(sidePlate(cover.width, cover.height, 0.08, 0.59), shared.cover);
  coverMesh.rotation.y = Math.PI;
  put(left, coverMesh, -W / 2, 0, -HALF - 4e-3);
  overlay(coverMesh, sidePlate(cover.width, cover.height, 0.08, 0.59), shared.glare, 15e-4, 1);
  const island = new THREE.Mesh(plate(1.05, 0.32, 0.16), shared.ink);
  island.position.set(0, cover.height / 2 - 0.27, 1e-3);
  coverMesh.add(island);
  const backZ = -HALF, t = 0.07, at = (fromOuter, fromTop) => [W - W * fromOuter, H / 2 - W * fromTop];
  const [px, py] = at(0.395, 0.198), pw = W * 0.695, ph = W * 0.279;
  const pill = new THREE.ExtrudeGeometry(roundedRect(pw - 0.06, ph - 0.06, ph / 2 - 0.03), { depth: t - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 6, curveSegments: 32 });
  faceBack(pill).translate(0, 0, -0.03);
  put(right, new THREE.Mesh(pill, plateau), px, py, backZ, false);
  for (let i = 1; i <= 4; i++) {
    const grow = i * 0.025;
    put(right, new THREE.Mesh(faceBack(plate(pw + grow * 2, ph + grow * 2, ph / 2 + grow)), shade), px, py - 0.02, backZ - 1e-3, false);
  }
  const glow = (radius, center) => {
    const geometry = faceBack(new THREE.CircleGeometry(radius, 32)), colors = [];
    for (let i = 0; i < geometry.attributes.position.count; i++) colors.push(...i === 0 ? center : [0, 0, 0]);
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return new THREE.Mesh(geometry, glint);
  };
  const lens = (x, y, z, r) => {
    const height = 0.05, outer = r * 1.3, lip = r * 0.1;
    const wall = new THREE.CylinderGeometry(outer, outer * 1.03, height, 64, 1, true);
    wall.rotateX(Math.PI / 2);
    put(right, new THREE.Mesh(wall, bezel), x, y, z - height / 2, false);
    put(right, new THREE.Mesh(faceBack(new THREE.TorusGeometry(outer - lip, lip, 16, 64)), bezel), x, y, z - height, false);
    put(right, new THREE.Mesh(faceBack(new THREE.RingGeometry(r, outer - lip, 64)), bezel), x, y, z - height + 1e-3, false);
    put(right, new THREE.Mesh(faceBack(new THREE.CircleGeometry(r, 48)), lensFace), x, y, z - height + 4e-3, false);
    put(right, new THREE.Mesh(faceBack(new THREE.RingGeometry(r * 0.86, r, 64)), hole), x, y, z - height + 3e-3, false);
    put(right, glow(r * 0.6, [0.04, 0.04, 0.1]), x, y, z - height + 2e-3, false);
    put(right, glow(r * 0.13, [0.16, 0.12, 0.32]), x - r * 0.06, y + r * 0.04, z - height + 15e-4, false);
  };
  for (const fromOuter of [0.179, 0.395]) lens(...at(fromOuter, 0.189), backZ - t, W * 0.075);
  put(right, new THREE.Mesh(faceBack(plate(W * 0.034, W * 0.013, W * 65e-4)), hole), ...at(0.6, 0.139), backZ - t - 2e-3, false);
  put(right, new THREE.Mesh(faceBack(new THREE.CircleGeometry(W * 0.024, 48)), flashRim), ...at(0.6, 0.245), backZ - t - 2e-3, false);
  put(right, new THREE.Mesh(faceBack(new THREE.CircleGeometry(W * 0.019, 48)), flash), ...at(0.6, 0.245), backZ - t - 3e-3, false);
  for (const shape of APPLE) {
    const mark = new THREE.ShapeGeometry(shape, 12);
    mark.translate(-12, -12, 0).scale(-W * 0.0105, -W * 0.0105, 1);
    put(right, new THREE.Mesh(faceBack(mark), logo), W / 2, H / 2 - W * 0.737, backZ - 2e-3, false);
  }
  const depth = HALF * 0.5;
  const key = (group, width, height, d, x, y, material = titanium) => put(group, new THREE.Mesh(new RoundedBoxGeometry(width, height, d, 3, Math.min(width, height, d) / 2.2), material), x, y, -HALF / 2);
  key(left, W * 0.13, 0.08, depth, -W * 0.79, H / 2 + 0.02);
  key(left, W * 0.125, 0.08, depth, -W * 0.63, H / 2 + 0.02);
  buttons.set(key(left, 0.08, 1.1, depth, -W - 0.02, H * 0.06, ring), "lock");
  key(right, 0.05, 1.1, depth * 0.9, W + 5e-3, -H * 0.17, ringDark);
  key(right, 0.04, 0.98, depth * 0.7, W + 0.025, -H * 0.17, lensGlass);
  for (const [group, side] of [[right, 1], [left, -1]]) {
    const band = (x, y, along) => put(group, new THREE.Mesh(new THREE.BoxGeometry(along ? 0.035 : 0.028, along ? 0.028 : 0.035, HALF * 0.62), antenna), x, y, -HALF / 2, false);
    for (const sy of [-1, 1]) {
      band(side * (W + 2e-3), sy * (H / 2 - 0.8), false);
      band(side * (W - 0.8), sy * (H / 2 + 2e-3), true);
    }
  }
  const port = new THREE.Mesh(plate(0.42, HALF * 0.38, 0.05), hole);
  port.rotation.x = Math.PI / 2;
  put(right, port, W / 2, -H / 2 - 1e-3, -HALF / 2, false);
  for (let i = 0; i < 5; i++) for (const side of [-1, 1]) {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), hole);
    dot.rotation.x = Math.PI / 2;
    put(right, dot, W / 2 + side * (0.45 + i * 0.075), -H / 2 - 1e-3, -HALF / 2, false);
  }
  const barrel = put(root, new THREE.Mesh(new THREE.CylinderGeometry(1, 1, H - 0.12, 48, 1, false, 0, Math.PI), printed), 0, 0, GAP / 2);
  barrel.scale.set(BARREL, 1, HALF + GAP / 2 - 8e-3);
  const bookAngle = (1 - DUO_FOLD.book) * Math.PI;
  let size = { width: W, height: H };
  const turn = (x, z, angle, cz = 0) => ({ x: x * Math.cos(angle) + (z - cz) * Math.sin(angle), z: -x * Math.sin(angle) + (z - cz) * Math.cos(angle) + cz });
  function bend(target, phi) {
    const s = target.surface, h = BEND * 0.9, from = turn(-BEND, s, phi, GAP / 2);
    const p1 = { x: from.x + Math.cos(phi) * h, z: from.z - Math.sin(phi) * h }, p2 = { x: BEND - h, z: s }, to = { x: BEND, z: s };
    const geometry = target.mesh.geometry, position = geometry.attributes.position;
    for (let i = 0; i <= BEND_SEGMENTS; i++) {
      const t2 = i / BEND_SEGMENTS, a = (1 - t2) ** 3, b = 3 * (1 - t2) ** 2 * t2, c = 3 * (1 - t2) * t2 * t2, d = t2 ** 3;
      const x = a * from.x + b * p1.x + c * p2.x + d * to.x, z = a * from.z + b * p1.z + c * p2.z + d * to.z;
      position.setXYZ(i * 2, x, -target.height / 2, z);
      position.setXYZ(i * 2 + 1, x, target.height / 2, z);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
  }
  function setFold(open) {
    const phi = (1 - THREE.MathUtils.clamp(open, 0, 1)) * Math.PI, half = phi / 2;
    pivot.rotation.y = phi;
    const out = { x: -Math.sin(half), z: -Math.cos(half) }, reach = Math.max(SPINE, 0.33 * Math.cos(half)), k = reach - BARREL;
    barrel.rotation.y = Math.PI / 2 + half;
    barrel.position.set(out.x * k, 0, GAP / 2 + out.z * k);
    const yaw = -half * (1 - THREE.MathUtils.smoothstep(phi, bookAngle, Math.PI));
    root.rotation.y = yaw;
    lenticular.uniforms.uOpen.value = open;
    bend(bezelBend, phi);
    bend(screenBend, phi);
    const points = [[0, 0], [W, 0], [0, -HALF], [W, -HALF]].map(([x, z]) => ({ x, z }));
    for (const [x, z] of [[-W, 0], [-W, -HALF], [0, 0], [0, -HALF]]) points.push(turn(x, z, phi, GAP / 2));
    points.push({ x: out.x * reach, z: GAP / 2 + out.z * reach });
    const posed = points.map((point) => turn(point.x, point.z, yaw));
    const xs = posed.map((point) => point.x), zs = posed.map((point) => point.z);
    root.position.set(-(Math.min(...xs) + Math.max(...xs)) / 2, 0, -(Math.min(...zs) + Math.max(...zs)) / 2);
    size = { width: Math.max(...xs) - Math.min(...xs), height: H };
  }
  setFold(0);
  return {
    cover: { mesh: coverMesh, u0: 0, u1: 1, width: cover.width, height: cover.height },
    inner: innerSurfaces,
    bend: screenBend.mesh,
    buttons,
    pickables,
    setFold,
    extent: () => size,
    dispose() {
      materials.forEach((material) => material.dispose());
    }
  };
}
export {
  DUO_FOLD,
  buildDuo,
  duoDisplays
};
