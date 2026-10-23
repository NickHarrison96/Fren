import { escape, icon } from "./dom";
const KINDS = [
  { id: "web", label: "Web chat", blurb: "A private chat page on this computer", minutes: "Instant" },
  { id: "telegram", label: "Telegram", blurb: "Message it from your phone", minutes: "2 min" },
  { id: "slack", label: "Slack", blurb: "DM it or @mention it in channels", minutes: "4 min" },
  { id: "discord", label: "Discord", blurb: "DM it or @mention it in a server", minutes: "4 min" },
  { id: "whatsapp", label: "WhatsApp", blurb: "Via Meta\u2019s Cloud API and a tunnel", minutes: "15 min" }
];
const kindLabel = (kind) => KINDS.find((item) => item.id === kind)?.label ?? "Channel";
const PORT_DEFAULT = 47321;
const link = (url, label, primary = false) => `<button type="button" class="${primary ? "primary-button" : "secondary-button"} bots-step-button" data-open-url="${escape(url)}">${escape(label)}${icon("forward")}</button>`;
const copy = (value, label = "Copy", caption = "") => `<span class="bots-copy-row">${caption ? `<span class="bots-copy-caption">${escape(caption)}</span>` : ""}<code>${escape(value)}</code><button type="button" class="secondary-button" data-copy="${escape(value)}">${escape(label)}</button></span>`;
const handle = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20) || "my";
function slackManifest(botName) {
  const name = botName.trim().slice(0, 35) || "PandaCode bot";
  return {
    display_information: { name, description: "An always-on assistant running on my computer through PandaCode." },
    features: { bot_user: { display_name: name, always_online: true }, app_home: { messages_tab_enabled: true, messages_tab_read_only_enabled: false } },
    oauth_config: { scopes: { bot: ["app_mentions:read", "chat:write", "im:history", "im:read", "im:write", "users:read"] } },
    settings: { event_subscriptions: { bot_events: ["app_mention", "message.im"] }, interactivity: { is_enabled: false }, org_deploy_enabled: false, socket_mode_enabled: true, token_rotation_enabled: false }
  };
}
const slackCreateUrl = (botName) => `https://api.slack.com/apps?new_app=1&manifest_json=${encodeURIComponent(JSON.stringify(slackManifest(botName)))}`;
function steps(kind, botName) {
  switch (kind) {
    case "telegram":
      return [
        { title: "Open BotFather in Telegram", body: `BotFather is Telegram\u2019s official bot for creating bots. ${link("https://t.me/BotFather", "Open BotFather", true)}` },
        { title: "Create the bot", body: `Send this to BotFather, then answer its two questions: a display name (for example \u201C${escape(botName)}\u201D) and a username ending in \u201Cbot\u201D.${copy("/newbot", "Copy", "Send")}${copy(`${handle(botName)}_pandacode_bot`, "Copy", "Username idea")}` },
        { title: "Paste the token BotFather sends back", body: "It looks like <code>123456789:AAE\u2026</code>. Anyone with it can control the bot, so keep it private.", field: { name: "token", label: "Bot token", secret: true, placeholder: "123456789:AAE\u2026" } }
      ];
    case "slack":
      return [
        { title: "Create the Slack app in one click", body: `This opens Slack with the name, permissions, events and Socket Mode filled in. Pick your workspace, review, then press <b>Create</b>. ${link(slackCreateUrl(botName), "Create Slack app", true)} <button type="button" class="bots-text-button" data-copy="${escape(JSON.stringify(slackManifest(botName), null, 2))}">Copy manifest instead</button>` },
        { title: "Install it and copy the bot token", body: "In the app\u2019s page, open <b>Install App</b> \u2192 <b>Install to Workspace</b> \u2192 <b>Allow</b>. Copy the <b>Bot User OAuth Token</b>.", field: { name: "token", label: "Bot token", secret: true, placeholder: "xoxb-\u2026" } },
        { title: "Create an app-level token", body: "Open <b>Basic Information</b> \u2192 <b>App-Level Tokens</b> \u2192 <b>Generate Token and Scopes</b>. Name it anything, add the scope <code>connections:write</code>, generate, and copy it.", field: { name: "app_token", label: "App-level token", secret: true, placeholder: "xapp-\u2026" } }
      ];
    case "discord":
      return [
        { title: "Create an application", body: `Press <b>New Application</b>, name it \u201C${escape(botName)}\u201D, and accept the terms. ${link("https://discord.com/developers/applications", "Open Developer Portal", true)}` },
        { title: "Let it read messages", body: "Open the <b>Bot</b> tab, turn on <b>Message Content Intent</b> under Privileged Gateway Intents, and press <b>Save Changes</b>." },
        { title: "Copy the bot token", body: "Still on the Bot tab, press <b>Reset Token</b>, confirm, and copy it. (The Client Secret and Public Key are different values.)", field: { name: "token", label: "Bot token", secret: true, placeholder: "MTA\u2026" } },
        { title: "Add it to your server", body: "After you connect, an <b>Add to server</b> button appears here with the right permissions already chosen." }
      ];
    case "whatsapp":
      return [
        { title: "Create a Meta app with WhatsApp", body: `Choose <b>Other</b> \u2192 <b>Business</b>, then add the <b>WhatsApp</b> product. Meta gives you a free test number. ${link("https://developers.facebook.com/apps/creation/", "Open Meta for Developers", true)}` },
        { title: "Copy the phone number ID", body: "In <b>WhatsApp</b> \u2192 <b>API Setup</b>, copy the <b>Phone number ID</b> (a long number, not the phone number itself). Add your own phone under <b>To</b> so the test number may message you.", field: { name: "phoneNumberId", label: "Phone number ID", secret: false, placeholder: "123456789012345", config: true } },
        { title: "Copy an access token", body: `The temporary token on API Setup works for 24 hours. For one that lasts, create a system user with WhatsApp permissions and generate its token. ${link("https://business.facebook.com/settings/system-users", "System users")}`, field: { name: "access_token", label: "Access token", secret: true, placeholder: "EAAG\u2026" } },
        { title: "Copy the app secret", body: "Open <b>App settings</b> \u2192 <b>Basic</b> \u2192 <b>App secret</b> \u2192 <b>Show</b>. PandaCode uses it to check that messages really come from Meta.", field: { name: "signing_secret", label: "App secret", secret: true, placeholder: "32 characters" } },
        { title: "Connect, then point Meta at this computer", body: "After you connect, the steps for the webhook (with everything to copy) appear on the channel." }
      ];
    default:
      return [];
  }
}
let adding = null;
const values = /* @__PURE__ */ new Map();
let tested = null;
const guides = /* @__PURE__ */ new Map();
function guideToggled(details) {
  const id = details.dataset.guide;
  if (!id) return;
  if (details.open === (details.dataset.default === "open")) guides.delete(id);
  else guides.set(id, details.open);
}
function input(kind, form) {
  const all = steps(kind, "").flatMap((step) => step.field ? [step.field] : []);
  const read = (name) => (form?.querySelector(`[name="${name}"]`)?.value ?? values.get(`${kind}:${name}`) ?? "").trim();
  return { kind, label: read("label"), config: Object.fromEntries(all.filter((field) => field.config).map((field) => [field.name, read(field.name)])), secrets: Object.fromEntries(all.filter((field) => !field.config).map((field) => [field.name, read(field.name)])) };
}
function result() {
  if (!tested || tested.kind !== adding) return "";
  if (tested.error) return `<div class="bots-check fail" role="alert">${icon("alert")}<span>${escape(tested.error)}</span></div>`;
  const identity = tested.identity;
  return `<div class="bots-check ok" role="status">${icon("check")}<span>Works \u2014 connects as <b>${escape(identity.name)}</b>${identity.warnings.map((warning) => `<small>${escape(warning)}</small>`).join("")}</span></div>`;
}
function connectSection(detail) {
  const chooser = `<div class="bots-kind-grid" role="group" aria-label="Add a channel">${KINDS.map((kind2) => `<button type="button" data-add-kind="${kind2.id}" aria-pressed="${kind2.id === adding}"><span class="bots-kind" data-kind="${kind2.id}" aria-hidden="true">${kind2.label.slice(0, 1)}</span><b>${escape(kind2.label)}</b><small>${escape(kind2.blurb)}</small><em>${escape(kind2.minutes)}</em></button>`).join("")}</div>`;
  if (!adding) return chooser;
  if (adding === "web") {
    return `${chooser}<form class="bots-connect" data-kind="web"><p class="bots-lede">A chat page served by this computer. Only people with the private link can use it, and only while PandaCode is running.</p>
      <div class="dialog-footer"><button type="button" class="secondary-button" data-add-kind="">Cancel</button><button type="submit" class="primary-button">Turn on web chat</button></div></form>`;
  }
  const kind = adding;
  const list = steps(kind, detail.bot.name).map((step, index) => `<li><span class="bots-step-number" aria-hidden="true">${index + 1}</span><div><b>${escape(step.title)}</b><p>${step.body}</p>${step.field ? `<label class="bots-field"><span>${escape(step.field.label)}</span><input name="${step.field.name}" ${step.field.secret ? 'type="password" spellcheck="false"' : 'inputmode="numeric"'} autocomplete="off" placeholder="${escape(step.field.placeholder)}" value="${escape(values.get(`${kind}:${step.field.name}`) ?? "")}"></label>` : ""}</div></li>`).join("");
  return `${chooser}<form class="bots-connect" data-kind="${kind}"><ol class="bots-steps">${list}</ol>
    ${result()}
    <small class="bots-hint">${icon("unlock")}Tokens go straight to your system keychain. The agent never sees them.</small>
    <div class="dialog-footer"><button type="button" class="secondary-button" data-add-kind="">Cancel</button><button type="button" class="secondary-button" data-test-channel>Test</button><button type="submit" class="primary-button">Connect ${escape(kindLabel(kind))}</button></div></form>`;
}
function channelGuide(detail, channel) {
  const identity = channel.config.identity;
  const port = detail.serverPort || PORT_DEFAULT;
  const warnings = (identity?.warnings ?? []).map((warning) => `<p class="bots-warning">${icon("alert")}${escape(warning)}</p>`).join("");
  const paired = detail.pairings.some((pairing) => pairing.channelId === channel.id && pairing.status === "approved");
  const pairStep = paired ? "" : "<li>Send it any message. It replies with a four-digit code, which also appears under <b>People</b> below. Press <b>Approve</b> and you\u2019re talking.</li>";
  const publicUrl = String(channel.config.publicUrl ?? "");
  const typedUrl = values.get(`public:${channel.id}`) ?? publicUrl;
  let body = "";
  switch (channel.kind) {
    case "telegram":
      body = `<ol>${identity?.link ? `<li>${link(identity.link, `Open ${identity.name} in Telegram`, true)}</li>` : ""}${pairStep}<li>In groups, add the bot and mention it or reply to it.</li></ol>`;
      break;
    case "slack":
      body = `<ol>${identity?.link ? `<li>${link(identity.link, "Open Slack", true)}</li>` : ""}<li>Find the bot under <b>Apps</b> in the sidebar and message it, or <code>/invite</code> it to a channel and @mention it.</li>${pairStep}</ol>`;
      break;
    case "discord":
      body = `<ol>${identity?.invite ? `<li>${link(identity.invite, "Add to a server", true)} Choose a server you manage and press <b>Authorize</b>.</li>` : ""}<li>Mention it in a channel, or open its profile and send a direct message.</li>${pairStep}</ol>`;
      break;
    case "whatsapp": {
      const callback = publicUrl ? `${publicUrl}/whatsapp/${channel.id}` : "";
      body = `<ol>
        <li><b>Give Meta a way in.</b> Meta delivers messages over HTTPS, so this computer needs a public address. The quickest is a free Cloudflare tunnel; run these in Terminal and keep the second one open:${copy("brew install cloudflared", "Copy", "Install")}${copy(`cloudflared tunnel --url http://127.0.0.1:${port}`, "Copy", "Start")}It prints an address ending in <code>trycloudflare.com</code>. That address changes each time the tunnel starts; for a fixed one, use Tailscale Funnel instead:${copy(`tailscale funnel --bg ${port}`, "Copy", "Or")}</li>
        <li><label class="bots-field"><span>Paste that https address</span><span class="bots-inline-form"><input data-public-url="${escape(channel.id)}" placeholder="https://\u2026.trycloudflare.com" value="${escape(typedUrl)}" autocomplete="off" spellcheck="false"><button type="button" class="secondary-button" data-save-public="${escape(channel.id)}">Save</button></span></label></li>
        <li><b>In Meta</b>, open WhatsApp \u2192 <b>Configuration</b> \u2192 Webhook \u2192 <b>Edit</b> and paste:${callback ? `${copy(callback, "Copy", "Callback URL")}` : " <i>(the callback URL appears here after you save the address)</i>"}${copy(String(channel.config.verifyToken ?? ""), "Copy", "Verify token")}Press <b>Verify and save</b>, then under Webhook fields press <b>Manage</b> and subscribe to <b>messages</b>. The status above turns to \u201CWebhook verified\u201D.</li>
        <li>${identity?.link ? link(identity.link, "Message your WhatsApp number") : "Message your WhatsApp business number from your phone."}</li>${pairStep}</ol>`;
      break;
    }
    case "web":
      body = `<ol><li><button type="button" class="primary-button bots-step-button" data-web-open="${escape(channel.id)}">Open web chat</button> On this computer, that\u2019s it.</li>
        <li><label class="bots-switch-row"><input type="checkbox" class="bots-switch" data-remote="${escape(channel.id)}" ${channel.config.remote ? "checked" : ""}><span><b>Use from my phone and other devices</b><small>Allows the page through a private tunnel. The link still works only with its token.</small></span></label></li>
        ${channel.config.remote ? `<li>Install Tailscale on this computer and your phone and sign in to both. Then run this in Terminal:${copy(`tailscale serve --bg ${port}`, "Copy", "Run")}It shows an address like <code>https://your-mac.tailnet.ts.net</code>.</li>
        <li><label class="bots-field"><span>Paste that https address</span><span class="bots-inline-form"><input data-public-url="${escape(channel.id)}" placeholder="https://your-mac.tailnet.ts.net" value="${escape(typedUrl)}" autocomplete="off" spellcheck="false"><button type="button" class="secondary-button" data-save-public="${escape(channel.id)}">Save</button></span></label></li>
        ${publicUrl ? `<li><button type="button" class="primary-button bots-step-button" data-phone-link="${escape(channel.id)}">Copy link for my phone</button> Open it on your phone; add it to your home screen to use it like an app.</li>` : ""}` : ""}</ol>`;
      break;
  }
  const fallback = channel.kind === "web" ? Boolean(channel.config.remote) : !paired;
  const open = guides.get(channel.id) ?? fallback;
  return `${warnings}<details class="bots-guide" data-guide="${escape(channel.id)}" data-default="${fallback ? "open" : "closed"}" ${open ? "open" : ""}><summary>${channel.kind === "web" ? "How to use" : paired ? "How to use" : "Finish setting up"}</summary>${body}</details>`;
}
async function webLink(context, channelId) {
  return context.call("bot_web_link", { channelId });
}
function connectClick(target, context) {
  const data = target.dataset;
  const detail = context.detail();
  if (!detail) return false;
  const done = async (text) => {
    context.notify(text);
    await context.reload();
  };
  if (data.addKind !== void 0) {
    adding = data.addKind || null;
    tested = null;
    context.rerender();
    target.closest(".bots-panel")?.querySelector(".bots-connect input")?.focus();
    return true;
  }
  if (data.openUrl) {
    void context.work(async () => {
      await context.call("open_external_url", { url: data.openUrl });
    });
    return true;
  }
  if (data.copy) {
    void context.work(async () => {
      await navigator.clipboard.writeText(data.copy);
      context.notify("Copied");
    });
    return true;
  }
  if (target.hasAttribute("data-test-channel") && adding) {
    const kind = adding, form = target.closest("form");
    void context.work(async () => {
      try {
        tested = { kind, identity: await context.call("bot_channel_test", { input: input(kind, form) }) };
      } catch (cause) {
        tested = { kind, error: cause instanceof Error ? cause.message : String(cause) };
      }
      context.rerender();
    });
    return true;
  }
  if (data.webOpen) {
    void context.work(async () => {
      await context.call("open_external_url", { url: await webLink(context, data.webOpen) });
    });
    return true;
  }
  if (data.webCopy) {
    void context.work(async () => {
      await navigator.clipboard.writeText(await webLink(context, data.webCopy));
      context.notify("Private link copied. Anyone with it can talk to this bot.");
    });
    return true;
  }
  if (data.webRotate) {
    context.confirm("Create a new web chat link?", "Pages opened with the current link stop working right away. Use this if the link was shared by mistake.", "New link", async () => {
      await navigator.clipboard.writeText(await context.call("bot_web_new_link", { channelId: data.webRotate }));
      await done("New link copied");
    });
    return true;
  }
  if (data.phoneLink) {
    const channel = detail.channels.find((item) => item.id === data.phoneLink);
    void context.work(async () => {
      const local = new URL(await webLink(context, data.phoneLink));
      await navigator.clipboard.writeText(`${String(channel?.config.publicUrl ?? "")}${local.pathname}${local.hash}`);
      context.notify("Phone link copied. Send it to yourself and open it on your phone.");
    });
    return true;
  }
  if (data.savePublic) {
    const field = target.closest("li")?.querySelector(`[data-public-url="${CSS.escape(data.savePublic)}"]`);
    void context.work(async () => {
      await context.call("bot_channel_configure", { channelId: data.savePublic, config: { publicUrl: field?.value ?? "" } });
      values.delete(`public:${data.savePublic}`);
      await done("Address saved");
    });
    return true;
  }
  return false;
}
function connectChange(target, context) {
  const input2 = target;
  if (input2.dataset.remote) {
    void context.work(async () => {
      await context.call("bot_channel_configure", { channelId: input2.dataset.remote, config: { remote: input2.checked } });
      await context.reload();
    });
    return true;
  }
  return false;
}
function connectInput(target) {
  const form = target.closest(".bots-connect");
  const field = target;
  if (field.dataset.publicUrl) {
    values.set(`public:${field.dataset.publicUrl}`, field.value);
    return;
  }
  if (form?.dataset.kind && field.name) {
    values.set(`${form.dataset.kind}:${field.name}`, field.value);
    if (tested?.kind === form.dataset.kind) tested = null;
  }
}
function connectSubmit(form, context) {
  if (!form.matches(".bots-connect")) return false;
  const detail = context.detail();
  const kind = form.dataset.kind;
  if (!detail || !kind) return true;
  void context.work(async () => {
    await context.call("bot_channel_add", { botId: detail.bot.id, input: kind === "web" ? { kind, label: "", config: {}, secrets: {} } : input(kind, form) });
    for (const key of [...values.keys()]) if (key.startsWith(`${kind}:`)) values.delete(key);
    adding = null;
    tested = null;
    context.notify(`${kindLabel(kind)} connected`);
    await context.reload();
  });
  return true;
}
export {
  KINDS,
  channelGuide,
  connectChange,
  connectClick,
  connectInput,
  connectSection,
  connectSubmit,
  guideToggled,
  kindLabel,
  slackCreateUrl,
  slackManifest
};
