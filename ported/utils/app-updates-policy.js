const CHECK_EVERY = 6 * 60 * 60 * 1e3;
const IDLE_BEFORE_RESTART = 2 * 60 * 1e3;
function readyToRestart(busy, lastInput, now = Date.now()) {
  return !busy && now - lastInput >= IDLE_BEFORE_RESTART;
}
function describeUpdate(state, automatic, now = Date.now()) {
  switch (state.kind) {
    case "off":
      return "Updates are installed by the desktop app.";
    case "checking":
      return "Checking GitHub Releases\u2026";
    case "current": {
      const minutes = Math.round((now - state.checkedAt) / 6e4);
      return `Up to date \xB7 checked ${minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`}`;
    }
    case "available":
      return `PandaCode ${state.version} is available.`;
    case "downloading":
      return `Downloading ${state.version}${state.percent === null ? "\u2026" : ` \xB7 ${state.percent}%`}`;
    case "ready":
      return `${state.version} is ready. ${automatic ? "PandaCode restarts when your agents are done and you step away." : "Restart to finish."}`;
    case "installing":
      return `Installing ${state.version}\u2026`;
    case "error":
      return `Couldn\u2019t check for updates: ${state.message}`;
    default:
      return automatic ? "Checks GitHub Releases automatically." : "Automatic updates are off.";
  }
}
export {
  CHECK_EVERY,
  IDLE_BEFORE_RESTART,
  describeUpdate,
  readyToRestart
};
