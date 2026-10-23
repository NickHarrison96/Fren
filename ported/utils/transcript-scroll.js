const scrollRounding = /* @__PURE__ */ new WeakMap();
function restoreScrollTop(transcript, top) {
  transcript.scrollTop = top;
  const actual = transcript.scrollTop, remainder = top - actual;
  scrollRounding.set(transcript, { top: actual, remainder: Math.abs(remainder) < 1 ? remainder : 0 });
}
function viewport(transcript) {
  const rect = transcript.getBoundingClientRect();
  const height = parseFloat(getComputedStyle(transcript).height);
  return { top: rect.top, bottom: rect.bottom, scale: height > 0 && rect.height > 0 ? rect.height / height : 1 };
}
function captureTranscriptAnchor(transcript) {
  const { top, bottom, scale } = viewport(transcript);
  const scrollTop = transcript.scrollTop, height = transcript.scrollHeight;
  const previous = scrollRounding.get(transcript);
  const remainder = previous?.top === scrollTop ? previous.remainder : 0;
  const attributes = ["data-message-id", "data-tool-key", "data-turn-key", "data-change-key"];
  const anchors = [...transcript.querySelectorAll(attributes.map((name) => `[${name}]`).join(","))].filter((node) => node.getClientRects().length).map((node) => ({ node, rect: node.getBoundingClientRect() })).filter(({ rect }) => rect.bottom > top && rect.top < bottom).sort((a, b) => Math.abs(a.rect.top - top) - Math.abs(b.rect.top - top)).map(({ node, rect }) => {
    const attribute = attributes.find((name) => node.hasAttribute(name));
    return { selector: `[${attribute}="${CSS.escape(node.getAttribute(attribute))}"]`, offset: (rect.top - top) / scale };
  });
  return () => {
    for (const anchor of anchors) {
      const node = transcript.querySelector(anchor.selector);
      if (!node?.getClientRects().length) continue;
      const current = viewport(transcript);
      restoreScrollTop(transcript, transcript.scrollTop + (node.getBoundingClientRect().top - current.top) / current.scale - anchor.offset + remainder);
      return;
    }
    restoreScrollTop(transcript, scrollTop + transcript.scrollHeight - height + remainder);
  };
}
function preserveTranscriptPosition(transcript, changed) {
  const follow = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 140 && !document.activeElement?.closest("details");
  if (follow) return () => {
    transcript.scrollTop = transcript.scrollHeight;
  };
  if (changed && changed.getBoundingClientRect().top >= transcript.getBoundingClientRect().bottom) return () => {
  };
  return captureTranscriptAnchor(transcript);
}
export {
  captureTranscriptAnchor,
  preserveTranscriptPosition
};
