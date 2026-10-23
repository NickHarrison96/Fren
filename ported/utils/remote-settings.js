import "./remote-settings.css";
import { escape, icon } from "./dom";
import { infoMark } from "./tooltip";
const TRUST_TIP = "Both computers must trust each other before one can drive the other. Compare the fingerprint shown on the other computer with the one here before trusting it. If its key changes, you need to trust it again.";
const ALLOW_TIP = "Remote prompts follow this computer\u2019s approval settings; they get no more power than prompts typed here.";
function mountRemoteSettings(root, host) {
  let status, devices = [], error = "", code, expires = 0, signingIn = false, disposed = false, attempt = 0;
  const fail = (e) => {
    error = e instanceof Error ? e.message : String(e);
    render();
  };
  function deviceRow(device) {
    return `<div class="setting-row remote-device" data-device="${escape(device.id)}"><div><strong><span class="remote-dot" data-online="${device.online}" role="img" aria-label="${device.online ? "Online" : "Offline"}"></span>${escape(device.name)}${device.current ? ' <span class="remote-badge">This computer</span>' : ""}</strong><small>${escape(device.platform)} \xB7 ${device.host ? "remote control on" : "remote control off"} \xB7 key <code>${escape(device.fingerprint)}</code></small></div>${device.current ? "" : `<label class="remote-trust"><span>Trusted ${infoMark(TRUST_TIP, "About trusting a computer")}</span><input type="checkbox" class="settings-switch" data-trust="${escape(device.id)}" aria-label="Trusted: ${escape(device.name)}" ${device.trusted ? "checked" : ""}></label>`}${device.current ? "" : `<button type="button" class="secondary-button" data-revoke="${escape(device.id)}" aria-label="Revoke ${escape(device.name)}">Revoke</button>`}</div>`;
  }
  function body() {
    if (!status) return '<p class="dialog-loading" role="status">Loading\u2026</p>';
    if (!status.configured) return '<p class="remote-note" role="status">Remote access is not configured in this build.</p>';
    if (!status.signedIn) {
      const flow = code ? `<div class="remote-code"><p>Enter this code at <strong>${escape(code.verificationUri)}</strong>:</p><div class="remote-code-row"><output class="remote-user-code" aria-label="Device code">${escape(code.userCode)}</output><button type="button" class="secondary-button" data-copy>${icon("copy")}Copy code</button></div><p class="remote-note" role="status">Waiting for you to approve in the browser\u2026 The code expires at ${new Date(expires).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</p><button type="button" class="secondary-button" data-cancel>Cancel</button></div>` : "";
      return `<div class="setting-row"><div><strong>PandaCode Connect</strong><small>Sign in with GitHub to reach your other computers. Task content is end-to-end encrypted; the relay sees only ciphertext.</small></div><button type="button" class="secondary-button" data-sign-in ${signingIn ? "disabled" : ""}>${icon("github")}Sign in with GitHub</button></div>${flow}`;
    }
    return `<div class="setting-row"><div><strong>${escape(status.account?.login ?? "Signed in")}</strong><small>Signed in with GitHub \xB7 ${status.connected ? "connected" : "connecting\u2026"}</small></div><button type="button" class="secondary-button" data-sign-out>Sign out</button></div>
      <div class="setting-row"><div><strong>Allow remote control of this computer ${infoMark(ALLOW_TIP, "About remote control")}</strong><small>Your other signed-in computers can see and drive tasks here.</small></div><input type="checkbox" class="settings-switch" id="remote-host" aria-label="Allow remote control of this computer" ${status.hostEnabled ? "checked" : ""}></div>
      <h3 class="settings-heading">Devices</h3><div class="settings-group remote-devices">${devices.length ? devices.map(deviceRow).join("") : '<p class="remote-note">No devices yet.</p>'}</div>`;
  }
  function render() {
    if (disposed) return;
    root.innerHTML = `<div class="settings-group remote-settings">${body()}</div>${error ? `<p class="remote-error" role="alert">${escape(error)}</p>` : ""}`;
  }
  const apply = (next) => {
    status = next;
    if (next.signedIn) {
      code = void 0;
      signingIn = false;
    }
  };
  async function load() {
    try {
      apply(await host.call("remote_status"));
      devices = status.signedIn ? await host.call("remote_devices") : [];
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    render();
  }
  async function signIn() {
    if (signingIn) return;
    error = "";
    signingIn = true;
    const mine = ++attempt;
    try {
      code = await host.call("remote_sign_in_start");
      expires = Date.now() + code.expiresIn * 1e3;
      render();
      void host.openUrl(code.verificationUri).catch(() => void 0);
      apply(await host.call("remote_sign_in_finish"));
      devices = await host.call("remote_devices");
    } catch (e) {
      if (mine !== attempt) return;
      code = void 0;
      signingIn = false;
      error = e instanceof Error ? e.message : String(e);
    }
    render();
  }
  function cancelSignIn() {
    attempt++;
    code = void 0;
    signingIn = false;
    error = "";
    render();
    void host.call("remote_sign_in_cancel").catch(fail);
  }
  root.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.hasAttribute("data-sign-in")) void signIn();
    else if (target.hasAttribute("data-cancel")) cancelSignIn();
    else if (target.hasAttribute("data-copy") && code) void navigator.clipboard.writeText(code.userCode).then(() => host.notify("Code copied"), () => host.notify("Couldn\u2019t copy; select the code instead"));
    else if (target.hasAttribute("data-sign-out")) void host.call("remote_sign_out").then((next) => {
      apply(next);
      devices = [];
      error = "";
      render();
    }, fail);
    else if (target.dataset.revoke) void host.call("remote_revoke_device", { deviceId: target.dataset.revoke }).then(() => {
      devices = devices.filter((d) => d.id !== target.dataset.revoke);
      render();
    }, fail);
  });
  root.addEventListener("change", (event) => {
    const input = event.target;
    if (input.dataset.trust) void host.call("remote_set_trusted", { deviceId: input.dataset.trust, trusted: input.checked }).then((next) => {
      devices = next;
      render();
    }, (e) => {
      input.checked = !input.checked;
      fail(e);
    });
    else if (input.id === "remote-host") void host.call("remote_set_host_enabled", { enabled: input.checked }).then((next) => {
      apply(next);
      render();
    }, (e) => {
      input.checked = !input.checked;
      fail(e);
    });
  });
  const unlisten = [
    host.listen("remote://status", (next) => {
      if (!signingIn || next.signedIn) {
        apply(next);
        render();
      }
    }),
    host.listen("remote://presence", (next) => {
      if (Array.isArray(next)) {
        devices = next;
        render();
      }
    })
  ];
  void load();
  return () => {
    disposed = true;
    for (const u of unlisten) void u.then((fn) => fn(), () => void 0);
  };
}
export {
  mountRemoteSettings
};
