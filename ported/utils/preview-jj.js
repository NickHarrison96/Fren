const change = (changeId, description, extra = {}) => ({ changeId, commitId: changeId.split("").reverse().join(""), description, bookmarks: [], author: "Preview User", when: "just now", conflict: false, empty: false, current: false, ...extra });
let counter = 0;
let current = change("kntqzsqtwlyn", "Speed up search", { current: true });
let history = [change("vruxwmqvtpmx", "Add search index", { bookmarks: ["main"], when: "2 hours ago" }), change("zzzzzzzzzzzz", "", { empty: true, author: "", when: "" })];
let files = [{ status: "M", path: "src/lib/search-index.ts" }, { status: "A", path: "src/components/search.ts" }];
const status = () => ({ isRepo: true, colocated: mode() === "colocated", change: current, files });
const mode = () => globalThis.__previewJj;
const fresh = () => change(`preview${String(++counter).padStart(5, "0")}`, "", { current: true, empty: true });
const advance = (description) => {
  history = [{ ...current, description, current: false }, ...history];
  current = fresh();
  files = [];
};
function invokeJj(command, args) {
  switch (command) {
    case "jj_status":
      return mode() ? status() : { isRepo: false, colocated: false, change: null, files: [] };
    case "jj_log":
      return [current, ...history].slice(0, args.limit ?? 20);
    case "jj_diff":
      return `diff --git a/${args.path} b/${args.path}
--- a/${args.path}
+++ b/${args.path}
@@ -1 +1 @@
-old
+new
`;
    case "jj_describe":
      current = { ...current, description: String(args.message ?? "") };
      return status();
    case "jj_new":
      advance(current.description);
      return status();
    case "jj_commit":
      if (!String(args.message ?? "").trim()) throw new Error("Write a description before committing.");
      advance(String(args.message));
      return status();
    default:
      throw new Error(`Unknown jj command ${command}`);
  }
}
export {
  invokeJj
};
