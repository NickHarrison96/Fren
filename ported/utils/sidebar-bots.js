import "./sidebar-bots.css";
import { escape, icon } from "./dom";
import { botAvatarHtml } from "./bot-avatars";
const VIEW_KEY = "pandacode.sidebarView";
const SEEN_KEY = "pandacode.botsSeen";
const AVATAR_COLORS = ["#8b5cf6", "#3b82f6", "#22c55e", "#14b8a6", "#f97316", "#ef4444", "#ec4899", "#6366f1", "#eab308", "#06b6d4"];
function storedSidebarView() {
  try {
    return localStorage.getItem(VIEW_KEY) === "bots" ? "bots" : "tasks";
  } catch {
    return "tasks";
  }
}
function storeSidebarView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
  }
}
function readSeen() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function writeSeen(seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
  }
}
function syncSeen(bots, openProject) {
  const seen = readSeen(), unread = /* @__PURE__ */ new Set();
  let changed = false;
  for (const bot of bots) {
    const latest = bot.lastMessage?.at ?? 0;
    if (!(bot.id in seen) || bot.projectId === openProject) {
      if (seen[bot.id] !== latest) {
        seen[bot.id] = latest;
        changed = true;
      }
    } else if (bot.lastMessage?.role === "assistant" && latest > seen[bot.id]) unread.add(bot.id);
  }
  if (changed) writeSeen(seen);
  return unread;
}
function avatarColor(id) {
  let hash = 0;
  for (const char of id) hash = hash * 31 + char.charCodeAt(0) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function botAvatar(bot, cls = "bot-card-face") {
  return botAvatarHtml(bot.avatar, bot.name, cls).replace("<span ", `<span style="--bot-color:${avatarColor(bot.id)}" `);
}
function messageTime(at, now = Date.now()) {
  const date = new Date(at), today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (at >= startOfToday) return date.toLocaleTimeString(void 0, { hour: "numeric", minute: "2-digit" });
  if (at >= startOfToday - 864e5) return "Yesterday";
  if (at >= startOfToday - 6 * 864e5) return date.toLocaleDateString(void 0, { weekday: "long" });
  return date.toLocaleDateString(void 0, { month: "short", day: "numeric" });
}
function botsBarHtml(view, count, unread) {
  const open = view === "bots";
  return `<button type="button" class="sidebar-bots-bar" data-action="toggle-bots-view" aria-pressed="${open}" title="${open ? "Back to tasks" : "Show bots"}">${icon("bot")}<span>Bots</span>${unread ? `<span class="sidebar-bots-unread" aria-label="${unread} unread"></span>` : ""}<small>${count || ""}</small>${icon("chevron")}</button>`;
}
function botsPanelHeadHtml() {
  return `<div class="bots-panel-head"><label class="bots-panel-search">${icon("search")}<input type="search" data-bots-search placeholder="Search" aria-label="Search bots" autocomplete="off" spellcheck="false"></label><button type="button" class="icon-button" data-action="new-bot" aria-label="Add bot" title="Add bot">${icon("plus")}</button></div><div class="bots-panel-list" role="list"></div>`;
}
function botsListHtml(context, unread, query) {
  const needle = query.trim().toLowerCase();
  const bots = context.bots.filter((bot) => !needle || `${bot.name} ${bot.role} ${bot.lastMessage?.text ?? ""}`.toLowerCase().includes(needle)).sort((a, b) => (b.lastMessage?.at ?? b.updatedAt) - (a.lastMessage?.at ?? a.updatedAt));
  if (!context.bots.length) return `<button type="button" class="bot-row-add" data-action="new-bot">${icon("plus")}<span>Add a bot</span></button>`;
  if (!bots.length) return '<p class="bots-panel-empty">No bots match.</p>';
  return bots.map((bot) => {
    const selected = context.selectedProject === bot.projectId, working = context.working(bot), message = bot.lastMessage;
    const preview = bot.paused ? "Paused" : message ? `${message.role === "user" ? "You: " : ""}${message.text}` : bot.role || "No messages yet";
    return `<div class="bot-row bot-card${selected ? " selected" : ""}${bot.paused ? " paused" : ""}" role="listitem">
      <button type="button" class="bot-row-open" data-action="open-bot" data-bot="${escape(bot.id)}" aria-label="Chat with ${escape(bot.name)}${bot.paused ? " (paused)" : ""}" title="Chat with ${escape(bot.name)}" ${selected ? 'aria-current="page"' : ""}>
        <span class="bot-card-avatar">${botAvatar(bot)}${working ? '<span class="bot-card-working" role="img" aria-label="Working"></span>' : ""}</span>
        <span class="bot-card-text"><span class="bot-card-head"><span class="bot-row-name">${escape(bot.name)}</span>${message ? `<time>${escape(messageTime(message.at))}</time>` : ""}</span><span class="bot-card-preview">${escape(preview)}</span></span>
        ${unread.has(bot.id) ? '<span class="bot-card-unread" role="img" aria-label="Unread"></span>' : ""}
      </button>
      <button type="button" class="icon-button bot-row-settings" data-action="bot-settings" data-bot="${escape(bot.id)}" aria-label="${escape(bot.name)} settings" title="Settings, memory, schedules and channels">${icon("settings")}</button>
    </div>`;
  }).join("");
}
export {
  botAvatar,
  botsBarHtml,
  botsListHtml,
  botsPanelHeadHtml,
  messageTime,
  storeSidebarView,
  storedSidebarView,
  syncSeen
};
