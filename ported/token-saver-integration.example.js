// Proof-of-concept: wiring PandaCode's token-saver into AnythingLLM's chat flow.
//
// AnythingLLM sends messages via the `submit` handler in ChatContainer. To inject
// token-saver guidance, wrap the outgoing message text with contextFor() before
// it reaches the API. Example integration point (in ChatContainer or wherever
// `submit` is defined):
//
//   import { contextFor } from "@/utils/token-saver";
//
//   function submit(e) {
//     e.preventDefault();
//     const textarea = e.target.querySelector("textarea");
//     const raw = textarea?.value ?? "";
//     const sessionId = threadSlug ?? workspaceSlug ?? "default";
//     const guidance = contextFor(sessionId, { rtk: false });
//     const message = raw + guidance; // guidance is "" when nothing to say
//     // ... send `message` to AnythingLLM's chat API instead of `raw`
//   }
//
// For a UI control, render PACKS/LEVELS/estimate() in a settings panel and
// call updateThread(sessionId, { packs, level }) on change. Defaults persist
// via setDefaults().
//
// Status: proof-of-concept only. Real integration requires adapting the
// session-id scheme (threadSlug/workspaceSlug) and the message-send path.

export { contextFor, threadSaver, updateThread, defaults, setDefaults, estimate, PACKS, LEVELS } from "./token-saver";
EOF