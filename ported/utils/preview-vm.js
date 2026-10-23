const IMAGES = [
  { id: "ubuntu", name: "Ubuntu 24.04", os: "linux", source: "ghcr.io/cirruslabs/ubuntu:latest", downloadGb: 5, memoryMb: 2048, cpus: 2 },
  { id: "debian", name: "Debian", os: "linux", source: "ghcr.io/cirruslabs/debian:latest", downloadGb: 4, memoryMb: 2048, cpus: 2 },
  { id: "fedora", name: "Fedora", os: "linux", source: "ghcr.io/cirruslabs/fedora:latest", downloadGb: 5, memoryMb: 2048, cpus: 2 },
  { id: "macos-tahoe", name: "macOS Tahoe", os: "darwin", source: "ghcr.io/cirruslabs/macos-tahoe-base:latest", downloadGb: 30, memoryMb: 4096, cpus: 4 },
  { id: "macos-sequoia", name: "macOS Sequoia", os: "darwin", source: "ghcr.io/cirruslabs/macos-sequoia-base:latest", downloadGb: 28, memoryMb: 4096, cpus: 4 }
];
function createPreviewVm() {
  let installed = false, shown = null;
  const vms = [];
  const desktops = /* @__PURE__ */ new Set();
  let installing = null, checks = 0;
  const inputs = [];
  const starts = [];
  let mark = null, typed = "";
  const status = () => {
    if (installing && ++checks > 2) {
      const vm = vms.find((v) => v.name === installing);
      if (vm) vm.desktop = null;
      desktops.add(installing);
      installing = null;
    }
    return { supported: true, installed, vms: structuredClone(vms), shown, images: structuredClone(IMAGES) };
  };
  const startVm = (vm) => {
    vm.running = vm.attached = true;
    if (vm.os === "linux" && !desktops.has(vm.name)) {
      vm.desktop = "installing";
      installing = vm.name;
      checks = 0;
    }
  };
  const find = (name) => {
    const vm = vms.find((candidate) => candidate.name === name);
    if (!vm) throw new Error("No VM with that name.");
    return vm;
  };
  async function frame() {
    const canvas = new OffscreenCanvas(1024, 768), g = canvas.getContext("2d");
    g.fillStyle = "#16213a";
    g.fillRect(0, 0, 1024, 768);
    g.fillStyle = "#f4f4f2";
    g.fillRect(0, 0, 1024, 26);
    g.fillStyle = "#222";
    g.font = "13px sans-serif";
    g.fillText("Applications", 20, 17);
    g.fillStyle = "#0d1117";
    g.fillRect(120, 90, 700, 420);
    g.fillStyle = "#7ee787";
    g.font = "15px monospace";
    g.fillText(`admin@ubuntu:~$ ${typed}`, 136, 124);
    if (mark) {
      g.fillStyle = "rgba(255,255,255,.6)";
      g.beginPath();
      g.arc(mark.x, mark.y, 14, 0, Math.PI * 2);
      g.fill();
    }
    return (await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 })).arrayBuffer();
  }
  return {
    inputs,
    starts,
    status,
    setup() {
      installed = true;
      return "/Users/you/Applications/tart.app/Contents/MacOS/tart";
    },
    show(name) {
      if (name != null && !String(name).includes(":")) find(name);
      shown = name == null ? null : String(name);
      return status();
    },
    create(image, name) {
      const found = IMAGES.find((candidate) => candidate.id === image);
      if (!found) throw new Error("Unknown VM image.");
      if (typeof name !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) throw new Error("VM names use lowercase letters, digits and dashes.");
      if (vms.some((vm2) => vm2.name === name)) throw new Error(`A VM named ${name} already exists.`);
      const vm = { name, running: false, attached: false, os: found.os, memoryMb: found.memoryMb, cpus: found.cpus, sizeGb: found.downloadGb, desktop: null };
      vms.push(vm);
      startVm(vm);
      starts.push({ name, share: null });
      shown = name;
      return status();
    },
    power(name, action, share) {
      const vm = find(name);
      if (action === "start") {
        startVm(vm);
        starts.push({ name: vm.name, share: typeof share === "string" ? share : null });
      } else if (action === "stop") {
        vm.running = vm.attached = false;
      } else if (action === "suspend") {
        if (vm.os !== "darwin") throw new Error("Only macOS VMs can be suspended.");
        vm.running = vm.attached = false;
      } else if (action === "delete") {
        vms.splice(vms.indexOf(vm), 1);
        if (shown === vm.name) shown = null;
      } else throw new Error("Unknown VM action.");
      return status();
    },
    async frame(name) {
      const vm = find(name);
      if (!vm.attached) throw new Error(`${vm.name} is not running in PandaCode. Start it with vm_manage first.`);
      return frame();
    },
    input(name, input) {
      const vm = find(name);
      if (!vm.attached) throw new Error(`${vm.name} is not running in PandaCode.`);
      inputs.push({ name: vm.name, input: structuredClone(input) });
      if (typeof input.x === "number" && typeof input.y === "number") mark = { x: input.x, y: input.y };
      if (input.action === "type") typed += String(input.text);
      return `${input.action} done`;
    },
    desktop(name) {
      const vm = find(name);
      if (vm.os !== "linux") throw new Error("macOS VMs already have a desktop.");
      return `${vm.name} now has an Xfce desktop.`;
    }
  };
}
const BASE = ["daytona", "cloudflare", "aws", "vercel", "railway", "gcloud"];
const KEYED = ["e2b", "modal", "codesandbox", "runloop", "blaxel", "tensorlake", "freestyle", "boat"];
const AGENT_TARGETS = [["e2b", "E2B"], ["daytona", "Daytona"], ["modal", "Modal"], ["vercel", "Vercel Sandbox"], ["codesandbox", "CodeSandbox"], ["runloop", "Runloop"], ["blaxel", "Blaxel"], ["tensorlake", "Tensorlake"], ["freestyle", "Freestyle"], ["boat", "boat"], ["cloudflare", "Cloudflare"], ["aws", "AWS EC2"], ["gcloud", "Google Cloud"]];
function createPreviewCloud() {
  const connected = /* @__PURE__ */ new Map();
  const machines = [];
  const inputs = [];
  const kinds = {
    daytona: { provider: "daytona", os: "linux", desktop: true, detail: "Daytona \xB7 1 CPU \xB7 1 GB", needs: "daytona" },
    cloudflare: { provider: "cloudflare", os: "linux", desktop: false, detail: "Cloudflare container \xB7 commands only", needs: "cloudflare" },
    "aws-linux": { provider: "aws", os: "linux", desktop: true, detail: "AWS EC2 \xB7 Ubuntu \xB7 t4g.medium", needs: "aws" },
    "aws-windows": { provider: "aws", os: "windows", desktop: true, detail: "AWS EC2 \xB7 Windows Server \xB7 t3.large", needs: "aws" },
    agentcore: { provider: "agentcore", os: "linux", desktop: false, detail: "AWS AgentCore code interpreter \xB7 commands only \xB7 ends after an hour", needs: "aws" }
  };
  let sandboxes = false;
  const connections = () => [...BASE, ...KEYED].map((provider) => ({ provider, connected: connected.has(provider), detail: connected.get(provider) ?? null, ...provider === "cloudflare" ? { sandboxes: connected.has(provider) && sandboxes } : {} }));
  const find = (id) => {
    const machine = machines.find((m) => m.id === id);
    if (!machine) throw new Error("Unknown cloud machine.");
    return machine;
  };
  return {
    inputs,
    connections,
    connect(provider, key, options) {
      if (typeof provider !== "string" || ![...BASE, ...KEYED].includes(provider)) throw new Error("Unknown cloud provider.");
      if (provider === "modal" && !options.tokenId) throw new Error("Enter the Modal token ID.");
      if (provider === "blaxel" && !options.workspace) throw new Error("Enter the Blaxel workspace.");
      if (provider !== "aws" && provider !== "gcloud" && (typeof key !== "string" || !key.trim())) throw new Error("Enter the key.");
      if (key === "bad") throw new Error(`${provider === "daytona" ? "Daytona" : "Cloudflare"} refused the credentials (HTTP 401). Check them in Settings \u2192 Cloud.`);
      connected.set(provider, provider === "aws" ? `${options.profile || "default profile"} \xB7 ${options.region}` : provider === "cloudflare" ? String(options.account) : provider === "vercel" ? String(options.team ?? "") || null : provider === "railway" ? String(options.workspace ?? "") || null : provider === "gcloud" ? [options.project, options.region, options.zone].filter(Boolean).join(" \xB7 ") : KEYED.includes(provider) ? String(options.workspace ?? options.environment ?? options.apiUrl ?? "") || null : null);
      return connections();
    },
    /** Providers that can run cloud agents, ready once connected. */
    agentTargets() {
      return AGENT_TARGETS.map(([provider, label]) => ({ provider, label, ready: connected.has(provider) }));
    },
    disconnect(provider) {
      connected.delete(String(provider));
      if (provider === "cloudflare") sandboxes = false;
      return connections();
    },
    setupSandboxes() {
      if (!connected.has("cloudflare")) throw new Error("Connect Cloudflare first.");
      sandboxes = true;
      return connections();
    },
    list() {
      return { machines: structuredClone(machines.filter((m) => connected.has(kinds[Object.keys(kinds).find((k) => kinds[k].provider === m.provider)].needs))), errors: [] };
    },
    create(kind, name) {
      const spec = kinds[String(kind)];
      if (!spec || !connected.has(spec.needs)) throw new Error("Connect this provider in Settings \u2192 Cloud first.");
      const machine = { id: `${spec.provider}:${String(name)}`, provider: spec.provider, name: String(name), state: "running", os: spec.os, desktop: spec.desktop, detail: spec.detail };
      machines.push(machine);
      return structuredClone(machine);
    },
    power(id, action) {
      const machine = find(id);
      if (action === "delete") machines.splice(machines.indexOf(machine), 1);
      else if (action === "start" || action === "stop") machine.state = action === "start" ? "running" : "stopped";
      else throw new Error("Unknown action.");
      return null;
    },
    async frame(id) {
      const machine = find(id);
      if (!machine.desktop) throw new Error("This machine has no screen.");
      if (machine.state !== "running") throw new Error("This sandbox is stopped. Start it first.");
      const canvas = new OffscreenCanvas(1280, 800), g = canvas.getContext("2d");
      g.fillStyle = machine.os === "windows" ? "#0b5cad" : "#2b2f3a";
      g.fillRect(0, 0, 1280, 800);
      g.fillStyle = "#fff";
      g.font = "20px sans-serif";
      g.fillText(`${machine.name} \xB7 ${machine.provider}`, 40, 60);
      return (await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 })).arrayBuffer();
    },
    input(id, input) {
      const machine = find(id);
      if (!machine.desktop) throw new Error("This machine has no screen.");
      inputs.push({ id: machine.id, input: structuredClone(input) });
      return `${input.action} done`;
    }
  };
}
export {
  createPreviewCloud,
  createPreviewVm
};
