import { call } from "./bridge";
function mountProviderReadiness(host) {
  let disposed = false, pending = false;
  host.classList.add("provider-readiness");
  host.innerHTML = '<div><span role="status">Connection not checked</span><button type="button" class="secondary-button">Check connection</button></div><p hidden></p>';
  const status = host.querySelector('[role="status"]');
  const button = host.querySelector("button");
  const detail = host.querySelector("p");
  const check = async () => {
    if (pending || disposed) return;
    pending = true;
    button.disabled = true;
    button.textContent = "Checking\u2026";
    status.textContent = "Starting ACP\u2026";
    detail.hidden = true;
    try {
      const result = await call("provider_check_connection", { provider: "antigravity" });
      if (disposed) return;
      status.textContent = result.sessionReady ? "Connection ready" : result.state === "authenticationRequired" ? "Sign-in required" : !result.installed ? "ACP executable missing" : result.acpReady ? "Session unavailable" : "ACP startup failed";
      detail.textContent = result.message;
      detail.hidden = false;
    } catch (error) {
      if (!disposed) {
        status.textContent = "Could not check connection";
        detail.textContent = String(error);
        detail.hidden = false;
      }
    } finally {
      pending = false;
      if (!disposed) {
        button.disabled = false;
        button.textContent = "Check again";
      }
    }
  };
  button.addEventListener("click", check);
  return () => {
    disposed = true;
    button.removeEventListener("click", check);
  };
}
export {
  mountProviderReadiness
};
