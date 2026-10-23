const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
const isWindows = /Win/i.test(navigator.platform);
const commandKey = isMac ? "\u2318" : "Ctrl";
function shortcut(key, shift = false) {
  return `${commandKey}${shift ? isMac ? " \u21E7" : " Shift" : ""} ${key}`;
}
export {
  commandKey,
  isMac,
  isWindows,
  shortcut
};
