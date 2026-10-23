let store = [
  { name: "review-diff", description: "Review, check, then stop for approval", scope: "project", steps: [
    { kind: "prompt", text: "Review the changed files and summarize risks." },
    { kind: "slash", command: "/review", text: "Review the diff for bugs." },
    { kind: "check", text: "npm test" },
    { kind: "approval", text: "Ready to commit?" }
  ] },
  { name: "needs-ship", description: "Blocked without /ship", scope: "global", steps: [{ kind: "slash", command: "/ship" }] }
];
function status(step, slash) {
  if (step.kind === "approval") return { status: "manual", reason: "Waits for you to confirm before the next step." };
  if (step.kind !== "slash") return { status: "supported", reason: "Sent as a message." };
  const name = (step.command ?? "").split(/\s+/)[0];
  if (slash.includes(name)) return { status: "supported", reason: `${name} is offered.` };
  return step.text ? { status: "fallback", reason: `${name} is not offered; the step's own text is sent instead.` } : { status: "blocked", reason: `${name} is not offered and the step has no fallback text.` };
}
function recipesCommand(command, args) {
  switch (command) {
    case "recipes_list":
      return { handled: true, result: structuredClone(store) };
    case "recipes_save": {
      const recipe = args.recipe;
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(recipe.name) || !recipe.steps?.length) throw "Recipe names use lowercase letters, digits, - and _ (up to 64).";
      store = [...store.filter((r) => r.name !== recipe.name), { ...recipe, scope: args.scope }];
      return { handled: true, result: null };
    }
    case "recipes_delete":
      store = store.filter((r) => r.name !== args.name);
      return { handled: true, result: null };
    case "recipes_dry_run": {
      const recipe = args.recipe;
      const steps = recipe.steps.map((s, index) => ({ index, ...status(s, args.slash ?? []) }));
      const blocked = steps.some((s) => s.status === "blocked");
      const messages = blocked ? [] : recipe.steps.map((s) => s.kind === "slash" ? s.command : s.kind === "check" ? `Run this check and report the result, including any failures:
${s.text}` : s.kind === "approval" ? "Stop here and ask me to confirm before doing anything else. Do not continue until I reply." : s.text);
      return { handled: true, result: { steps, messages } };
    }
    default:
      return { handled: false };
  }
}
export {
  recipesCommand
};
