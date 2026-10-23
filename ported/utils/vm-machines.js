const osName = (os) => os === "darwin" ? "macOS" : os === "windows" ? "Windows" : "Linux";
const memory = (mb) => mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`;
function machines(status, cloud) {
  const local = (status?.vms ?? []).map((vm) => ({
    key: vm.name,
    name: vm.name,
    os: vm.os,
    cloud: false,
    running: vm.running,
    live: vm.running && vm.attached,
    desktop: true,
    detail: `${osName(vm.os)} \xB7 ${memory(vm.memoryMb)} \xB7 ${vm.running ? vm.attached ? "Running" : "Running elsewhere" : "Stopped"}`,
    elsewhere: vm.running && !vm.attached,
    canStart: true,
    local: vm
  }));
  const remote = cloud.map((machine) => ({
    key: machine.id,
    name: machine.name,
    os: machine.os,
    cloud: true,
    running: machine.state === "running",
    live: machine.state === "running" && machine.desktop,
    desktop: machine.desktop,
    detail: `${machine.detail} \xB7 ${machine.state[0].toUpperCase()}${machine.state.slice(1)}`,
    elsewhere: false,
    canStart: machine.provider !== "agentcore"
  }));
  return [...local, ...remote];
}
function createOptions(status, connections) {
  const local = status?.installed ? status.images.map((image) => ({ id: `image:${image.id}`, label: image.name, description: `Local \xB7 ${image.downloadGb} GB download \xB7 ${memory(image.memoryMb)}`, cloud: false })) : [];
  const on = (provider) => connections.some((c) => c.provider === provider && c.connected);
  const cloud = [
    ...on("daytona") ? [{ id: "cloud:daytona", label: "Daytona desktop", description: "Linux with a screen \xB7 billed by Daytona", cloud: true }] : [],
    ...connections.some((c) => c.provider === "cloudflare" && c.connected && c.sandboxes) ? [{ id: "cloud:cloudflare", label: "Cloudflare container", description: "Linux, commands only \xB7 your Cloudflare account", cloud: true }] : [],
    ...on("aws") ? [
      { id: "cloud:aws-linux", label: "AWS Linux desktop", description: "Ubuntu on EC2 \xB7 billed while running", cloud: true },
      { id: "cloud:aws-windows", label: "AWS Windows desktop", description: "Windows Server on EC2 \xB7 about 10 min to set up", cloud: true },
      { id: "cloud:agentcore", label: "AWS AgentCore session", description: "Commands only \xB7 ends after an hour", cloud: true }
    ] : []
  ];
  return [...local, ...cloud];
}
function cloudName() {
  return `pandacode-${Math.random().toString(36).slice(2, 8)}`;
}
export {
  cloudName,
  createOptions,
  machines
};
