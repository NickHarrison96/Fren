import { call } from "./bridge";
function mountSupportDetails(host) {
  const output = host.querySelector("textarea");
  const copy = host.querySelector(".support-copy");
  const retry = host.querySelector(".support-retry");
  const status = host.querySelector('[role="status"]');
  let disposed = false, loading = false, loaded = false, copying = false;
  async function load() {
    if (disposed || loaded || loading || !host.open) return;
    loading = true;
    retry.hidden = true;
    status.textContent = "Loading app details\u2026";
    try {
      const data = await call("support_details");
      if (disposed) return;
      output.value = `PandaCode: ${data.version}
Platform: ${data.platform}
Architecture: ${data.architecture}`;
      loaded = true;
      copy.disabled = false;
      status.textContent = "";
    } catch {
      if (!disposed) {
        status.textContent = "Could not load app details.";
        retry.hidden = false;
      }
    } finally {
      loading = false;
    }
  }
  async function copyDetails() {
    if (!loaded || disposed || copying) return;
    copying = true;
    copy.setAttribute("aria-busy", "true");
    try {
      await navigator.clipboard.writeText(output.value);
      if (!disposed) status.textContent = "App details copied. Paste them into your support request.";
    } catch {
      if (!disposed) {
        output.focus();
        output.select();
        status.textContent = "Copy the selected app details using your keyboard.";
      }
    } finally {
      copying = false;
      copy.removeAttribute("aria-busy");
    }
  }
  host.addEventListener("toggle", load);
  retry.addEventListener("click", load);
  copy.addEventListener("click", copyDetails);
  return () => {
    disposed = true;
    host.removeEventListener("toggle", load);
    retry.removeEventListener("click", load);
    copy.removeEventListener("click", copyDetails);
  };
}
export {
  mountSupportDetails
};
