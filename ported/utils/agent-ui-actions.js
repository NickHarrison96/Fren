import { call, subscribe } from "./bridge";
async function connectAgentUiActions(activeTask, perform) {
  let queue = Promise.resolve();
  return subscribe("agent-ui-action", (request) => {
    queue = queue.catch(() => {
    }).then(async () => {
      try {
        if (!await call("agent_ui_request_active", { requestId: request.requestId })) return;
        if (activeTask() !== request.sessionId) throw new Error("Open this task before using its app or browser tools.");
        const result = await perform(request);
        await call("resolve_agent_ui_action", { requestId: request.requestId, result });
      } catch (error) {
        await call("resolve_agent_ui_action", { requestId: request.requestId, error: String(error) }).catch(() => {
        });
      }
    });
  });
}
export {
  connectAgentUiActions
};
