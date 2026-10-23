import "./cloud-settings.css";
import { escape } from "./dom";
import { infoMark } from "./tooltip";
const KEYED = {
  e2b: { name: "E2B", key: "API key", docs: "e2b.dev/dashboard \u2192 API keys", fields: [] },
  modal: { name: "Modal", key: "Token secret", docs: "modal.com/settings/tokens", fields: [{ name: "tokenId", label: "Token ID", placeholder: "ak-\u2026" }, { name: "environment", label: "Environment", placeholder: "Optional", optional: true }] },
  codesandbox: { name: "CodeSandbox", key: "API key", docs: "codesandbox.io/t/api", fields: [] },
  runloop: { name: "Runloop", key: "API key", docs: "platform.runloop.ai \u2192 Settings", fields: [] },
  blaxel: { name: "Blaxel", key: "API key", docs: "app.blaxel.ai \u2192 Workspace settings \u2192 API keys", fields: [{ name: "workspace", label: "Workspace", placeholder: "Workspace name" }] },
  tensorlake: { name: "Tensorlake", key: "API key", docs: "cloud.tensorlake.ai \u2192 API keys", fields: [] },
  freestyle: { name: "Freestyle", key: "API key", docs: "admin.freestyle.sh \u2192 API keys", fields: [] },
  boat: { name: "boat", key: "API key", docs: "your boat dashboard", fields: [{ name: "apiUrl", label: "API URL", placeholder: "Optional", optional: true }] }
};
const PROVIDERS = {
  daytona: {
    name: "Daytona",
    summary: "Linux desktops agents can see and control.",
    key: { name: "key", label: "API key", placeholder: "dtn_\u2026", secret: true },
    fields: [{ name: "organization", label: "Organization ID", placeholder: "Optional", optional: true }, { name: "apiUrl", label: "API URL", placeholder: "https://app.daytona.io/api", optional: true }],
    note: "Create a key at app.daytona.io \u2192 Keys. Sandboxes stop after 15 idle minutes.",
    connect: "Connect"
  },
  cloudflare: {
    name: "Cloudflare",
    summary: "Deploys to Workers and Pages, and container sandboxes.",
    key: { name: "key", label: "API token", placeholder: "Workers Scripts, Pages and Containers: Edit", secret: true },
    fields: [{ name: "account", label: "Account ID", placeholder: "32 hexadecimal characters" }],
    note: "Agents deploy with Wrangler using this token. Container sandboxes are a separate one-time setup that deploys a small PandaCode Worker; it needs Docker running and a Workers Paid plan.",
    connect: "Connect"
  },
  aws: {
    name: "AWS",
    summary: "EC2 Linux and Windows desktops, and AgentCore.",
    fields: [{ name: "region", label: "Region", placeholder: "us-east-1" }, { name: "profile", label: "CLI profile", placeholder: "Optional", optional: true }],
    note: "Uses your AWS CLI sign-in (run `aws login` first). Desktops have no open ports; PandaCode reaches them through Systems Manager, which needs the Session Manager plugin for screens.",
    connect: "Connect"
  },
  vercel: {
    name: "Vercel",
    summary: "Deploys by agents, preview and production.",
    key: { name: "key", label: "Access token", placeholder: "vercel.com/account/tokens", secret: true },
    fields: [{ name: "team", label: "Team slug", placeholder: "Optional", optional: true }, { name: "projectId", label: "Sandbox project ID", placeholder: "Optional; for cloud agents", optional: true, sparse: true }, { name: "teamId", label: "Sandbox team ID", placeholder: "Optional; for cloud agents", optional: true, sparse: true }],
    note: "Agents run the Vercel CLI with this token; it never enters their prompts. Cloud agents on Vercel Sandbox also need the project ID, and the team ID for a team project.",
    connect: "Connect"
  },
  railway: {
    name: "Railway",
    summary: "Deploys by agents: servers, containers and databases.",
    key: { name: "key", label: "API token", placeholder: "railway.com/account/tokens", secret: true },
    fields: [{ name: "workspace", label: "Workspace ID", placeholder: "Optional; needed for a workspace token", optional: true }],
    note: "Use an account token, or a workspace token with its workspace ID. Agents run the Railway CLI with it (fetched on first use if it is not installed); it never enters their prompts.",
    connect: "Connect"
  },
  gcloud: {
    name: "Google Cloud",
    summary: "Deploys by agents: Cloud Run and Cloud Storage.",
    fields: [{ name: "project", label: "Project ID", placeholder: "my-app-123456" }, { name: "region", label: "Region", placeholder: "Optional, such as us-central1", optional: true }, { name: "zone", label: "Zone", placeholder: "Optional; for cloud agent VMs, such as us-central1-a", optional: true, sparse: true }],
    note: "Uses your installed gcloud CLI and its sign-in (run `gcloud auth login` first); PandaCode downloads nothing and stores only the project, region and zone.",
    connect: "Connect"
  },
  ...Object.fromEntries(Object.entries(KEYED).map(([id, provider]) => [id, {
    name: provider.name,
    summary: "Cloud machines for agents.",
    key: { name: "key", label: provider.key, placeholder: provider.docs, secret: true },
    fields: provider.fields,
    note: `Create a key at ${provider.docs}. Cloud agents run on machines in your own account.`,
    connect: "Connect"
  }]))
};
const CLAUDE_TOKEN_HELP = "Run `claude setup-token` and paste the long-lived token it prints. Without one, PandaCode copies this computer\u2019s Claude Code login to the machine before each run.";
function mountCloudSettings(host, options) {
  host.innerHTML = `<div class="settings-group cloud-settings" aria-label="Cloud sandboxes"><div class="cloud-provider cloud-claude">
      <div class="setting-row"><div><strong>Claude login for cloud agents</strong>${infoMark(CLAUDE_TOKEN_HELP, "About the Claude login")}<small class="cloud-detail">Optional long-lived token</small></div></div>
      <form class="cloud-form cloud-claude-form" novalidate aria-label="Claude login for cloud agents">
        <label><span>Token</span><input name="token" type="password" autocomplete="off" spellcheck="false" placeholder="From claude setup-token" aria-label="Claude token for cloud agents" required></label>
        <p class="cloud-progress" role="status" hidden></p>
        <p class="cloud-error" role="alert" hidden></p>
        <div class="cloud-actions"><button type="submit" class="primary-button">Save token</button></div>
      </form>
    </div>${Object.keys(PROVIDERS).map((id) => {
    const provider = PROVIDERS[id];
    const fields = [...provider.key ? [provider.key] : [], ...provider.fields];
    return `<div class="cloud-provider" data-provider="${id}">
      <div class="setting-row"><div><strong>${escape(provider.name)}</strong><small class="cloud-detail">${escape(provider.summary)}</small></div><div class="cloud-buttons">${id === "cloudflare" ? '<button type="button" class="secondary-button" data-cloud="sandboxes" hidden>Set up sandboxes</button>' : ""}<button type="button" class="secondary-button" data-cloud="toggle">Connect</button></div></div>
      <p class="cloud-progress cloud-row-status" role="status" hidden></p>
      <form class="cloud-form" hidden novalidate aria-label="${escape(`Connect ${provider.name}`)}">
        ${fields.map((field) => `<label><span>${escape(field.label)}</span><input name="${field.name}" type="${field.secret ? "password" : "text"}" autocomplete="off" spellcheck="false" placeholder="${escape(field.placeholder)}" aria-label="${escape(`${provider.name} ${field.label}`)}" ${field.optional ? "" : "required"}></label>`).join("")}
        <p class="cloud-note">${escape(provider.note)}</p>
        <p class="cloud-progress" role="status" hidden></p>
        <p class="cloud-error" role="alert" hidden></p>
        <div class="cloud-actions"><button type="button" class="secondary-button" data-cloud="cancel">Cancel</button><button type="submit" class="primary-button">${escape(provider.connect)}</button></div>
      </form>
    </div>`;
  }).join("")}</div>`;
  let connections = [], disposed = false, busy = "";
  let stopListening;
  const section = (id) => host.querySelector(`.cloud-provider[data-provider="${id}"]`);
  function render() {
    for (const id of Object.keys(PROVIDERS)) {
      const connection = connections.find((c) => c.provider === id), root = section(id);
      const toggle = root.querySelector('[data-cloud="toggle"]');
      const form = root.querySelector("form");
      const sandboxes = id === "cloudflare" && connection?.connected ? connection.sandboxes ? " \xB7 sandboxes ready" : " \xB7 sandboxes not set up" : "";
      root.querySelector(".cloud-detail").textContent = connection?.connected ? `Connected${connection.detail ? ` \xB7 ${connection.detail}` : ""}${sandboxes}` : PROVIDERS[id].summary;
      const setup = root.querySelector('[data-cloud="sandboxes"]');
      if (setup) {
        setup.hidden = !connection?.connected || Boolean(connection.sandboxes);
        setup.disabled = Boolean(busy);
      }
      toggle.textContent = connection?.connected ? "Disconnect" : form.hidden ? "Connect" : "Close";
      toggle.disabled = Boolean(busy);
      toggle.setAttribute("aria-label", `${toggle.textContent} ${PROVIDERS[id].name}`);
      form.querySelector('[type="submit"]').disabled = Boolean(busy);
    }
  }
  async function load() {
    try {
      connections = await options.call("cloud_connections");
    } catch {
      connections = [];
    }
    if (!disposed) render();
  }
  function say(root, kind, text) {
    const line = root.querySelector(`.cloud-${kind}`);
    line.textContent = text;
    line.hidden = !text;
  }
  async function connect(id, form) {
    const root = section(id), data = new FormData(form);
    const value = (name) => String(data.get(name) ?? "").trim();
    const missing = [...PROVIDERS[id].key ? [PROVIDERS[id].key] : [], ...PROVIDERS[id].fields].find((field) => !field.optional && !value(field.name));
    if (missing) {
      say(root, "error", `Enter the ${missing.label.toLowerCase()}.`);
      return;
    }
    busy = id;
    say(root, "error", "");
    say(root, "progress", id === "cloudflare" ? "Preparing the deploy\u2026" : "Checking\u2026");
    render();
    try {
      const fields = Object.fromEntries(PROVIDERS[id].fields.filter((field) => !field.sparse || value(field.name)).map((field) => [field.name, value(field.name)]));
      connections = await options.call("cloud_connect", { provider: id, key: value("key"), options: fields });
      if (disposed) return;
      form.reset();
      form.hidden = true;
      say(root, "progress", "");
    } catch (error) {
      if (!disposed) {
        say(root, "progress", "");
        say(root, "error", error instanceof Error ? error.message : String(error));
      }
    } finally {
      busy = "";
      if (!disposed) render();
    }
  }
  async function setupSandboxes(root) {
    const line = root.querySelector(".cloud-row-status");
    busy = "cloudflare";
    line.hidden = false;
    line.textContent = "Preparing the sandbox Worker\u2026";
    render();
    try {
      connections = await options.call("cloud_setup_sandboxes");
      line.textContent = "Sandboxes are ready.";
    } catch (error) {
      line.textContent = error instanceof Error ? error.message : String(error);
      line.classList.add("cloud-error");
    } finally {
      busy = "";
      if (!disposed) render();
    }
  }
  async function saveClaudeToken(form) {
    const root = form.closest(".cloud-provider"), input = form.querySelector("input"), token = input.value.trim();
    say(root, "progress", "");
    say(root, "error", "");
    if (!token) {
      say(root, "error", "Paste the token from claude setup-token.");
      return;
    }
    try {
      await options.call("cloud_agent_set_claude_token", { token });
      if (!disposed) {
        form.reset();
        say(root, "progress", "Saved. Cloud agents sign in to Claude with this token.");
      }
    } catch (error) {
      if (!disposed) say(root, "error", error instanceof Error ? error.message : String(error));
    }
  }
  async function disconnect(id) {
    busy = id;
    render();
    try {
      connections = await options.call("cloud_disconnect", { provider: id });
    } catch (error) {
      say(section(id), "error", error instanceof Error ? error.message : String(error));
    } finally {
      busy = "";
      if (!disposed) render();
    }
  }
  host.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-cloud]") : null;
    if (!target || target.disabled) return;
    const root = target.closest(".cloud-provider[data-provider]"), id = root.dataset.provider;
    const form = root.querySelector("form");
    if (target.dataset.cloud === "cancel") {
      form.hidden = true;
      say(root, "error", "");
      render();
      return;
    }
    if (target.dataset.cloud === "sandboxes") {
      void setupSandboxes(root);
      return;
    }
    if (connections.find((c) => c.provider === id)?.connected) {
      void disconnect(id);
      return;
    }
    form.hidden = !form.hidden;
    render();
    if (!form.hidden) form.querySelector("input").focus();
  });
  host.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    if (form.classList.contains("cloud-claude-form")) {
      void saveClaudeToken(form);
      return;
    }
    const id = form.closest(".cloud-provider").dataset.provider;
    void connect(id, form);
  });
  host.addEventListener("keydown", (event) => {
    const form = event.target.closest?.(".cloud-provider[data-provider] form.cloud-form");
    if (form && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      form.hidden = true;
      render();
    }
  });
  void options.listen("cloud-setup", (event) => {
    if (event.provider !== busy) return;
    const line = section(busy).querySelector(".cloud-row-status");
    line.hidden = false;
    line.classList.remove("cloud-error");
    line.textContent = event.label;
  }).then((stop) => {
    if (disposed) stop();
    else stopListening = stop;
  });
  void load();
  return () => {
    disposed = true;
    stopListening?.();
    host.replaceChildren();
  };
}
export {
  mountCloudSettings
};
