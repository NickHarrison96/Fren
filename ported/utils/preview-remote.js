const THIS = "dev-this";
let signedIn = false, hostEnabled = false;
let devices = [], cancelSignIn;
const offline = /* @__PURE__ */ new Set();
const trusted = /* @__PURE__ */ new Set(["dev-studio", "dev-laptop"]);
const status = () => ({ configured: true, signedIn, account: signedIn ? { login: "octocat" } : void 0, device: { id: THIS, name: "This Mac", fingerprint: "3fa91c07d2b64e58" }, hostEnabled, connected: signedIn });
const sampleDevices = () => [
  { id: THIS, name: "This Mac", platform: "macOS", fingerprint: "3fa91c07d2b64e58", host: hostEnabled, online: true, trusted: true, lastSeen: Date.now(), current: true },
  { id: "dev-studio", name: "Studio iMac", platform: "macOS", fingerprint: "9b02e4aa71c3d605", host: true, online: !offline.has("dev-studio"), trusted: trusted.has("dev-studio"), lastSeen: Date.now(), current: false },
  { id: "dev-nas", name: "Home NAS", platform: "Linux", fingerprint: "17aa5e90b3c4d286", host: true, online: true, trusted: trusted.has("dev-nas"), lastSeen: Date.now(), current: false },
  { id: "dev-laptop", name: "Old laptop", platform: "Windows", fingerprint: "c4d81f3e0a9957b2", host: true, online: false, trusted: trusted.has("dev-laptop"), lastSeen: Date.now() - 864e5, current: false }
];
function invokeRemote(command, args, emit) {
  return Promise.resolve().then(() => handle(command, args, emit));
}
function handle(command, args, emit) {
  switch (command) {
    case "remote_status":
      window.__remoteOnline = (id, online) => setPreviewOnline(id, online, emit);
      return status();
    case "remote_sign_in_start":
      return { userCode: "WDJB-MJHT", verificationUri: "https://github.com/login/device", expiresIn: 900 };
    case "remote_sign_in_finish":
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cancelSignIn = void 0;
          signedIn = true;
          devices = sampleDevices();
          emit("remote://status", status());
          resolve(status());
        }, window.__signInDelay ?? 400);
        cancelSignIn = () => {
          clearTimeout(timer);
          reject(new Error("Sign-in cancelled"));
        };
      });
    case "remote_sign_in_cancel":
      cancelSignIn?.();
      cancelSignIn = void 0;
      return {};
    case "remote_sign_out":
      signedIn = false;
      hostEnabled = false;
      devices = [];
      emit("remote://status", status());
      return status();
    case "remote_set_host_enabled":
      hostEnabled = Boolean(args.enabled);
      devices = sampleDevices();
      emit("remote://presence", devices);
      return status();
    case "remote_devices":
      return devices = signedIn ? sampleDevices() : [];
    case "remote_set_trusted":
      if (args.trusted) trusted.add(args.deviceId);
      else trusted.delete(args.deviceId);
      return devices = sampleDevices();
    case "remote_revoke_device":
      devices = devices.filter((d) => d.id !== args.deviceId);
      emit("remote://presence", devices);
      return {};
    // Other trusted computers with remote control on; preview.ts mocks remote_repo_check and remote_start_task.
    case "remote_targets":
      return (signedIn ? sampleDevices() : []).filter((d) => !d.current && d.host && d.trusted).map((d) => ({ deviceId: d.id, name: d.name, platform: d.platform, online: d.online }));
    default:
      throw new Error(`Unknown preview command: ${command}`);
  }
}
function setPreviewOnline(id, online, emit) {
  if (online) offline.delete(id);
  else offline.add(id);
  devices = sampleDevices();
  emit("remote://presence", devices);
}
export {
  invokeRemote,
  setPreviewOnline
};
