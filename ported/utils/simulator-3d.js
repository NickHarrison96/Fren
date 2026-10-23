import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { studioEnvironment, studioFloor } from "./simulator-studio";
import { buildHardware, plate, roundedRect } from "./simulator-hardware";
import { chosenFinish, modelSpec } from "./simulator-models";
import { buildDuo, DUO_FOLD, duoDisplays } from "./simulator-duo";
const UNIT = 100;
const TAP_SLOP = 8;
const LONG_PRESS = 450;
const FRONT = new THREE.Euler(0, 0, 0);
const INTRO = new THREE.Euler(0.12, -0.55, 0.02);
const FOLD_MS = 800;
const SPIN_STEPS = 12, SPIN_SCALE = 0.5, FRAME_SCALE = 2;
const INNER_FRAME_TURN = -Math.PI / 2;
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function geometryOf(shape) {
  const width = shape.width / UNIT, height = shape.height / UNIT, pad = shape.family === "pad";
  const spec = modelSpec(shape.deviceType, shape.family);
  const side = spec.bezel ?? (pad ? 0.26 : shape.homeButton ? 0.22 : 0.17);
  const cap = shape.homeButton ? pad ? 0.95 : 1.05 : side;
  const display = shape.homeButton ? 0 : spec.corner ?? (pad ? 0.19 : 0.55);
  const bodyWidth = width + side * 2;
  return { width, height, pad, side, cap, display, spec, body: { width: bodyWidth, height: height + cap * 2, radius: shape.homeButton ? pad ? 0.45 : 0.62 : display + side, depth: Math.max(bodyWidth * spec.depth, 0.18) } };
}
function mountDevice3D(host, options) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const canvas = renderer.domElement;
  canvas.className = "sim-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);
  const scene = new THREE.Scene();
  const environment = studioEnvironment(renderer);
  scene.environment = environment;
  const floor = studioFloor(scene);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.09, enablePan: false, rotateSpeed: 0.75, zoomSpeed: 0.8 });
  function canvasDisplay() {
    const pixels = document.createElement("canvas");
    pixels.width = 2;
    pixels.height = 2;
    const texture = new THREE.CanvasTexture(pixels);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    return { pixels, paint: pixels.getContext("2d"), texture, material: new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }) };
  }
  const main = canvasDisplay(), inside = canvasDisplay();
  const device = new THREE.Group();
  scene.add(device);
  const glass = new THREE.MeshPhysicalMaterial({ color: 131587, metalness: 0, roughness: 0.04, ior: 1.52, envMapIntensity: 0.18 });
  const glare = new THREE.MeshPhysicalMaterial({ color: 0, metalness: 0, roughness: 0.04, envMapIntensity: 1, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
  const ink = new THREE.MeshBasicMaterial({ color: 0 });
  const touchMaterial = new THREE.MeshBasicMaterial({ color: 16777215, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  let screen, touch, surfaces = [];
  let duo, pose = "closed", fold = DUO_FOLD.closed, folding;
  const buttons = /* @__PURE__ */ new Map();
  let shape = { width: 402, height: 874, homeButton: false, family: "phone", deviceType: "" };
  let finish, hardware = [];
  let fitDistance = 20;
  function clear() {
    device.traverse((node) => {
      if (node instanceof THREE.Mesh) node.geometry.dispose();
    });
    hardware.forEach((material) => material.dispose());
    hardware = [];
    duo?.dispose();
    duo = void 0;
    surfaces = [];
    screen = touch = void 0;
    device.clear();
    buttons.clear();
  }
  const activeSurfaces = () => duo ? pose === "closed" ? [duo.cover] : duo.inner : surfaces;
  function displayPoints() {
    if (!shape.duo) return shape;
    const displays = duoDisplays(shape.duo);
    return pose === "closed" ? displays.cover : displays.inner;
  }
  function buildDuoBody() {
    const spec = modelSpec("iPhone-Duo", "phone");
    finish = finish && spec.finishes.some((item) => item.id === finish.id) ? finish : chosenFinish(spec);
    duo = buildDuo(device, finish, duoDisplays(shape.duo), { cover: main.material, inner: inside.material, ink, glass, glare });
    duo.setFold(fold);
    lightCover();
    const displays = duoDisplays(shape.duo);
    sizeDisplay(main, displays.cover);
    sizeDisplay(inside, displays.inner);
    duo.buttons.forEach((name, mesh) => buttons.set(mesh, name));
    touch = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), touchMaterial);
    touch.position.z = 3e-3;
    touch.renderOrder = 3;
    activeSurfaces()[0].mesh.add(touch);
    device.traverse((node) => {
      if (node instanceof THREE.Mesh && !node.userData.noShadow && node.material !== glare && node.material !== touchMaterial) node.castShadow = true;
    });
    const { width, height } = duo.extent();
    floor.place(-height / 2, Math.max(width, height) * 1.6);
    fit();
  }
  const lightCover = () => main.material.color.setScalar(duo && pose !== "closed" ? 0 : 1);
  function build() {
    clear();
    lightCover();
    if (shape.duo) {
      buildDuoBody();
      return;
    }
    const g = geometryOf(shape), { body, spec } = g, bevel = Math.min(0.07, body.depth / 4);
    const look = finish && spec.finishes.some((item) => item.id === finish.id) ? finish : chosenFinish(spec);
    finish = look;
    const made = buildHardware(device, spec, look, body, { width: g.width, height: g.height, side: g.side, cap: g.cap }, ink);
    hardware = made.materials;
    const [frame2, panel] = made.materials;
    const slab = new THREE.ExtrudeGeometry(roundedRect(body.width - bevel * 2, body.height - bevel * 2, body.radius - bevel), { depth: body.depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 8, curveSegments: 40 });
    slab.translate(0, 0, -(body.depth - bevel * 2) / 2);
    device.add(new THREE.Mesh(slab, [panel, frame2]));
    const front = body.depth / 2;
    const cover = new THREE.Mesh(plate(body.width - bevel * 1.2, body.height - bevel * 1.2, body.radius - bevel * 0.6), glass);
    cover.position.z = front + 2e-3;
    device.add(cover);
    screen = new THREE.Mesh(plate(g.width, g.height, g.display), main.material);
    screen.position.z = front + 4e-3;
    device.add(screen);
    surfaces = [{ mesh: screen, u0: 0, u1: 1, width: g.width, height: g.height }];
    const sheen = new THREE.Mesh(plate(g.width, g.height, g.display), glare);
    sheen.position.z = 15e-4;
    sheen.renderOrder = 1;
    screen.add(sheen);
    touch = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), touchMaterial);
    touch.position.z = 3e-3;
    touch.renderOrder = 2;
    screen.add(touch);
    if (spec.front === "punch") {
      const punch = new THREE.Mesh(new THREE.CircleGeometry(0.055, 32), ink);
      punch.position.set(0, g.height / 2 - 0.26, 1e-3);
      screen.add(punch);
    }
    if (spec.front === "island" && !shape.homeButton) {
      const island = new THREE.Mesh(plate(1.25, 0.37, 0.185), ink);
      island.position.set(0, g.height / 2 - 0.3, 1e-3);
      screen.add(island);
    }
    if (shape.homeButton) {
      const home = new THREE.Mesh(new THREE.CylinderGeometry(g.pad ? 0.3 : 0.34, g.pad ? 0.3 : 0.34, 0.02, 48), glass);
      home.rotation.x = Math.PI / 2;
      home.position.set(0, -g.height / 2 - g.cap / 2, front + 4e-3);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(g.pad ? 0.3 : 0.34, 0.012, 8, 64), frame2);
      ring.position.set(0, -g.height / 2 - g.cap / 2, front + 0.012);
      device.add(home, ring);
      buttons.set(home, "home");
    }
    made.buttons.forEach((name, mesh) => buttons.set(mesh, name));
    device.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material !== glare && node.material !== touchMaterial) node.castShadow = true;
    });
    floor.place(-Math.max(body.height, body.width) / 2, Math.max(body.height, body.width));
    fit();
  }
  let fitted = false;
  function fit() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    frameCamera();
  }
  function frameCamera() {
    const body = duo ? duo.extent() : geometryOf(shape).body, half = THREE.MathUtils.degToRad(camera.fov / 2);
    const byHeight = body.height / 2 / Math.tan(half), byWidth = body.width / 2 / (Math.tan(half) * camera.aspect);
    const distance = Math.max(byHeight, byWidth) / 0.84;
    const zoom = fitted ? THREE.MathUtils.clamp(camera.position.length() / fitDistance, 0.45, 2.6) : 1;
    fitDistance = distance;
    fitted = true;
    controls.minDistance = distance * 0.45;
    controls.maxDistance = distance * 2.6;
    if (!camera.position.lengthSq()) camera.position.set(0, 0, 1);
    camera.position.setLength(distance * zoom);
    camera.updateProjectionMatrix();
    dirty = true;
  }
  let frame = 0, dirty = true, active = false, turning;
  let touchFade = 0, loading = false, spinStep = -1;
  const tick = (now) => {
    frame = 0;
    if (!active) return;
    let moving = controls.update();
    const step = Math.floor(now / 1e3 * SPIN_STEPS);
    if (loading && step !== spinStep) {
      spinStep = step;
      paintSpinner(step);
      dirty = true;
    }
    if (folding) {
      const t = Math.min(1, (now - folding.start) / FOLD_MS), eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      fold = THREE.MathUtils.lerp(folding.from, folding.to, eased);
      duo?.setFold(fold);
      frameCamera();
      if (t >= 1) folding = void 0;
      moving = true;
    }
    if (turning) {
      const t = Math.min(1, (now - turning.start) / turning.duration), eased = 1 - Math.pow(1 - t, 3);
      device.quaternion.slerpQuaternions(turning.from, turning.to, eased);
      if (t >= 1) turning = void 0;
      moving = true;
    }
    if (touchFade && touchMaterial.opacity > 0) {
      touchMaterial.opacity = Math.max(0, touchMaterial.opacity - 0.06);
      moving = true;
    }
    if (moving || dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }
    if (moving || loading) frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    dirty = true;
    if (active && !frame) frame = requestAnimationFrame(tick);
  };
  controls.addEventListener("change", wake);
  function turnTo(euler, duration) {
    const to = new THREE.Quaternion().setFromEuler(euler);
    if (reduceMotion() || !duration) {
      device.quaternion.copy(to);
      turning = void 0;
      wake();
      return;
    }
    turning = { from: device.quaternion.clone(), to, start: performance.now(), duration };
    wake();
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  function ray(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }
  function toPoints(surface, local) {
    const size = displayPoints();
    const u = surface.u0 + (local.x / surface.width + 0.5) * (surface.u1 - surface.u0), v = local.y / surface.height + 0.5;
    return { x: THREE.MathUtils.clamp(u * size.width, 0, size.width), y: THREE.MathUtils.clamp((1 - v) * size.height, 0, size.height) };
  }
  const normalOf = (mesh) => new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
  function pick(event) {
    if (!screen && !duo) return;
    ray(event);
    const hit = raycaster.intersectObjects(duo ? duo.pickables : device.children, false)[0];
    if (!hit) return;
    const bend = duo && pose !== "closed" && hit.object === duo.bend ? duo.inner[(hit.uv?.x ?? 0.5) < 0.5 ? 0 : 1] : void 0;
    const surface = bend ?? activeSurfaces().find((item) => item.mesh === hit.object);
    if (surface) {
      if (folding || normalOf(surface.mesh).dot(raycaster.ray.direction) >= 0) return;
      const local = surface.mesh.worldToLocal(hit.point.clone());
      return { kind: "screen", surface, point: toPoints(surface, local), local };
    }
    const name = buttons.get(hit.object);
    return name ? { kind: "button", name, mesh: hit.object } : void 0;
  }
  function onPlane(event, surface) {
    ray(event);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normalOf(surface.mesh), surface.mesh.getWorldPosition(new THREE.Vector3()));
    const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (!point) return;
    const local = surface.mesh.worldToLocal(point);
    return { ...toPoints(surface, local), local };
  }
  function showTouch(surface, local, opacity) {
    if (!touch) return;
    if (touch.parent !== surface.mesh) surface.mesh.add(touch);
    touch.position.set(local.x, local.y, 2e-3);
    touchMaterial.opacity = opacity;
    touchFade = opacity < 0.3 ? 1 : 0;
    wake();
  }
  let gesture;
  const onDown = (event) => {
    if (event.button !== 0) return;
    const hit = pick(event);
    if (!hit) return;
    event.stopPropagation();
    event.preventDefault();
    host.focus({ preventScroll: true });
    if (hit.kind === "button") {
      const original = hit.mesh.position.clone(), inward = hit.mesh.position.x === 0 ? new THREE.Vector3(0, -0.03, 0) : new THREE.Vector3(Math.sign(hit.mesh.position.x) * -0.03, 0, 0);
      if (hit.name === "home") inward.set(0, 0, -0.01);
      hit.mesh.position.add(inward);
      wake();
      window.setTimeout(() => {
        hit.mesh.position.copy(original);
        wake();
      }, 140);
      options.onButton(hit.name);
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    gesture = { id: event.pointerId, surface: hit.surface, start: hit.point, last: hit.point, at: performance.now() };
    showTouch(hit.surface, hit.local, 0.42);
  };
  const onMove = (event) => {
    if (gesture && event.pointerId === gesture.id) {
      const at = onPlane(event, gesture.surface);
      if (!at) return;
      gesture.last = { x: at.x, y: at.y };
      showTouch(gesture.surface, at.local, 0.42);
      return;
    }
    if (event.buttons) return;
    const hit = pick(event);
    canvas.style.cursor = hit?.kind === "screen" ? "pointer" : hit?.kind === "button" ? "pointer" : "grab";
  };
  const onUp = (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const { start, last, at } = gesture;
    gesture = void 0;
    const held = performance.now() - at, moved = Math.hypot(last.x - start.x, last.y - start.y);
    touchFade = 1;
    if (event.type === "pointercancel" || folding) return;
    if (moved < TAP_SLOP) options.onGesture(held >= LONG_PRESS ? { kind: "longPress", x: start.x, y: start.y, durationMs: Math.round(held) } : { kind: "tap", x: start.x, y: start.y });
    else options.onGesture({ kind: "swipe", x: start.x, y: start.y, endX: last.x, endY: last.y, durationMs: Math.round(THREE.MathUtils.clamp(held, 80, 2e3)) });
  };
  const onWheel = (event) => {
    if (event.ctrlKey) return;
    const hit = pick(event);
    if (hit?.kind !== "screen") return;
    event.stopPropagation();
    event.preventDefault();
    options.onScroll(event.deltaX, event.deltaY, hit.point);
  };
  const onDouble = (event) => {
    if (!pick(event)) {
      resetView(true);
    }
  };
  host.addEventListener("pointerdown", onDown, { capture: true });
  host.addEventListener("wheel", onWheel, { capture: true, passive: false });
  host.addEventListener("dblclick", onDouble);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  const resize = new ResizeObserver(() => fit());
  resize.observe(host);
  function sizeDisplay(display, size, scale = FRAME_SCALE) {
    const width = Math.round(size.width * scale), height = Math.round(size.height * scale);
    if (display.pixels.width === width && display.pixels.height === height) return;
    display.pixels.width = width;
    display.pixels.height = height;
    display.texture.dispose();
  }
  function activeDisplay(scale = FRAME_SCALE) {
    const display = duo && pose !== "closed" ? inside : main;
    sizeDisplay(display, displayPoints(), scale);
    return display;
  }
  function setMessage(text) {
    loading = false;
    const { pixels, paint, texture } = activeDisplay();
    paint.fillStyle = "#000";
    paint.fillRect(0, 0, pixels.width, pixels.height);
    if (text) {
      paint.fillStyle = "rgba(255,255,255,.62)";
      paint.textAlign = "center";
      paint.textBaseline = "middle";
      paint.font = `500 ${Math.round(pixels.width / 15)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      paint.fillText(text, pixels.width / 2, pixels.height / 2, pixels.width * 0.86);
    }
    texture.needsUpdate = true;
    wake();
  }
  function paintSpinner(step) {
    const { pixels, paint, texture } = activeDisplay(SPIN_SCALE);
    const cx = pixels.width / 2, cy = pixels.height / 2, radius = Math.min(pixels.width, pixels.height) / 18, lead = step % SPIN_STEPS;
    paint.fillStyle = "#000";
    paint.fillRect(0, 0, pixels.width, pixels.height);
    paint.lineWidth = radius / 4;
    paint.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2, sin = Math.sin(angle), cos = Math.cos(angle);
      paint.strokeStyle = `rgba(255,255,255,${0.15 + 0.7 * (1 - (lead - i + 12) % 12 / 11)})`;
      paint.beginPath();
      paint.moveTo(cx + sin * radius * 0.5, cy - cos * radius * 0.5);
      paint.lineTo(cx + sin * radius, cy - cos * radius);
      paint.stroke();
    }
    texture.needsUpdate = true;
  }
  function resetView(animate = true) {
    camera.position.set(0, 0, fitDistance);
    controls.target.set(0, 0, 0);
    controls.update();
    turnTo(FRONT, animate ? 520 : 0);
  }
  build();
  device.quaternion.setFromEuler(INTRO);
  setMessage("");
  return {
    setShape(next) {
      const same = next.homeButton === shape.homeButton && next.family === shape.family && next.deviceType === shape.deviceType && JSON.stringify(next.duo) === JSON.stringify(shape.duo);
      if (same && next.width === shape.width && next.height === shape.height) return;
      const wasDuo = Boolean(shape.duo);
      shape = next;
      if (same && next.duo) {
        activeDisplay();
        wake();
        return;
      }
      if (!next.duo || !wasDuo || !same) {
        pose = "closed";
        fold = DUO_FOLD.closed;
        folding = void 0;
        sizeDisplay(inside, { width: 1, height: 1 });
      }
      build();
      wake();
    },
    setFrame(image) {
      loading = false;
      const { pixels, paint, texture } = activeDisplay();
      if (pixels === inside.pixels && image.width > image.height !== pixels.width > pixels.height) {
        paint.save();
        paint.translate(pixels.width / 2, pixels.height / 2);
        paint.rotate(INNER_FRAME_TURN);
        paint.drawImage(image, -pixels.height / 2, -pixels.width / 2, pixels.height, pixels.width);
        paint.restore();
      } else paint.drawImage(image, 0, 0, pixels.width, pixels.height);
      texture.needsUpdate = true;
      wake();
    },
    setMessage,
    setLoading(next) {
      loading = next;
      spinStep = -1;
      wake();
    },
    setDark() {
      wake();
    },
    setFinish(next) {
      finish = next;
      build();
      wake();
    },
    resetView,
    setPose(next, animate = true) {
      if (!duo || next === pose) return;
      pose = next;
      gesture = void 0;
      lightCover();
      const to = DUO_FOLD[next];
      if (!animate || reduceMotion()) {
        fold = to;
        folding = void 0;
        duo.setFold(fold);
        frameCamera();
        wake();
        return;
      }
      folding = { from: fold, to, start: performance.now() };
      wake();
    },
    getPose: () => pose,
    setActive(next) {
      if (active === next) return;
      active = next;
      if (active) {
        fit();
        if (device.quaternion.angleTo(new THREE.Quaternion()) > 0.3 && !turning) turnTo(FRONT.clone().set(0.04, -0.18, 0), 900);
        wake();
      } else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    dispose() {
      active = false;
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      clear();
      host.removeEventListener("pointerdown", onDown, { capture: true });
      host.removeEventListener("wheel", onWheel, { capture: true });
      host.removeEventListener("dblclick", onDouble);
      for (const material of [glass, glare, ink, main.material, inside.material, touchMaterial]) material.dispose();
      floor.dispose();
      main.texture.dispose();
      inside.texture.dispose();
      environment.dispose();
      renderer.dispose();
      canvas.remove();
    }
  };
}
export {
  mountDevice3D
};
