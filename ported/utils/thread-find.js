// Ported from PandaCode thread-find.ts (adapted to AnythingLLM frontend, JS).
// Find-in-thread using the CSS Custom Highlight API (no DOM rewrite).

const ICONS = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
function icon(name) {
  const path = ICONS[name] ?? "";
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const MESSAGE_TEXT = "article.message :is(.message-content, .streaming-content)";
const ALL = "thread-find";
const CURRENT = "thread-find-current";

export function findRanges(root, query) {
  const needle = query.toLocaleLowerCase();
  if (!needle) return [];
  const ranges = [];
  for (const block of root.querySelectorAll(MESSAGE_TEXT)) {
    const nodes = [];
    const starts = [];
    let text = "";
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest(".message-actions, .sr-only")) continue;
      nodes.push(node);
      starts.push(text.length);
      text += node.data;
    }
    const haystack = text.toLocaleLowerCase();
    const locate = (offset, from) => {
      let index = from;
      while (index + 1 < nodes.length && starts[index + 1] <= offset) index++;
      return index;
    };
    let at = haystack.indexOf(needle);
    let cursor = 0;
    while (at !== -1) {
      const first = locate(at, cursor);
      const last = locate(at + needle.length - 1, first);
      const range = document.createRange();
      range.setStart(nodes[first], at - starts[first]);
      range.setEnd(nodes[last], at + needle.length - starts[last]);
      ranges.push(range);
      cursor = first;
      at = haystack.indexOf(needle, at + needle.length);
    }
  }
  return ranges;
}

export function createThreadFind(host) {
  let bar, input, count;
  let ranges = [];
  let current = -1;
  let frame = 0;
  const highlights = typeof CSS !== "undefined" && "highlights" in CSS ? CSS.highlights : undefined;
  const HighlightCtor = globalThis.Highlight;
  const observer = new MutationObserver(() => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; search(false); });
  });
  const place = () => {
    const pane = host.pane();
    if (!bar || !pane) return;
    const rect = pane.getBoundingClientRect();
    bar.hidden = rect.width === 0;
    bar.style.setProperty("--find-left", `${Math.round(rect.left + rect.width / 2)}px`);
    bar.style.setProperty("--find-top", `${Math.round(rect.top + 10)}px`);
  };
  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(place) : undefined;

  function paint() {
    if (!highlights || !HighlightCtor) return;
    highlights.set(ALL, new HighlightCtor(...ranges));
    if (ranges[current]) highlights.set(CURRENT, new HighlightCtor(ranges[current]));
    else highlights.delete(CURRENT);
  }
  function label() {
    if (!count || !input) return;
    count.textContent = !input.value ? "" : ranges.length ? `${current + 1} of ${ranges.length}` : "No results";
    bar?.querySelectorAll("[data-find-step]").forEach((button) => {
      button.disabled = ranges.length < 2;
    });
  }
  function reveal() {
    const range = ranges[current];
    const transcript = host.transcript();
    if (!range || !transcript) return;
    for (let node = range.startContainer.parentElement; node && node !== transcript; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement && !node.open) node.open = true;
    }
    const rect = range.getBoundingClientRect();
    const box = transcript.getBoundingClientRect();
    if (rect.top < box.top + 48 || rect.bottom > box.bottom - 24) transcript.scrollTop += rect.top - box.top - box.height / 3;
  }
  function search(fresh) {
    const transcript = host.transcript();
    if (!bar || !input || !transcript) return;
    const previous = ranges[current];
    ranges = findRanges(transcript, input.value);
    if (!ranges.length) current = -1;
    else if (fresh || !previous) {
      const top = transcript.getBoundingClientRect().top;
      const visible = ranges.findIndex((range) => range.getBoundingClientRect().bottom >= top);
      current = visible === -1 ? ranges.length - 1 : visible;
    } else {
      current = Math.min(Math.max(ranges.findIndex((range) => range.compareBoundaryPoints(Range.START_TO_START, previous) >= 0), 0), ranges.length - 1);
    }
    paint();
    label();
    if (fresh) reveal();
  }
  function step(by) {
    if (!ranges.length) return;
    current = (current + by + ranges.length) % ranges.length;
    paint();
    label();
    reveal();
  }
  function open() {
    const pane = host.pane();
    const transcript = host.transcript();
    if (!pane || !transcript) return;
    if (!bar || !bar.isConnected) {
      bar = document.createElement("div");
      bar.className = "thread-find";
      bar.setAttribute("role", "search");
      bar.innerHTML = `${icon("search")}<input type="search" aria-label="Find in thread" placeholder="Find in thread" autocomplete="off" spellcheck="false" maxlength="200"><span class="thread-find-count" aria-live="polite"></span><button type="button" class="icon-button thread-find-previous" data-find-step="-1" aria-label="Previous match" title="Previous match">${icon("down")}</button><button type="button" class="icon-button" data-find-step="1" aria-label="Next match" title="Next match">${icon("down")}</button><button type="button" class="icon-button" data-find-close aria-label="Close find" title="Close (Esc)">${icon("close")}</button>`;
      input = bar.querySelector("input");
      count = bar.querySelector(".thread-find-count");
      input.addEventListener("input", () => search(true));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          step(event.shiftKey ? -1 : 1);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      });
      bar.addEventListener("click", (event) => {
        const target = event.target.closest("button");
        if (!target) return;
        if (target.dataset.findStep) step(Number(target.dataset.findStep));
        else if (target.hasAttribute("data-find-close")) close();
      });
      pane.append(bar);
      observer.observe(transcript, { childList: true, subtree: true, characterData: true });
      resize?.observe(pane);
      window.addEventListener("resize", place);
    }
    place();
    input.focus();
    input.select();
    if (input.value) search(true);
    else label();
  }
  function close() {
    observer.disconnect();
    resize?.disconnect();
    window.removeEventListener("resize", place);
    cancelAnimationFrame(frame);
    frame = 0;
    highlights?.delete(ALL);
    highlights?.delete(CURRENT);
    bar?.remove();
    bar = undefined;
    input = undefined;
    count = undefined;
    ranges = [];
    current = -1;
    host.restoreFocus();
  }
  return {
    open,
    close,
    isOpen: () => Boolean(bar?.isConnected),
    step: (by) => {
      if (bar?.isConnected) step(by);
    },
  };
}
