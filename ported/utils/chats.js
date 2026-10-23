const CHAT_FOLDER = /[\\/]PandaCode Chats[\\/]chat-[0-9a-f]{8}$/;
const isChatProject = (project) => Boolean(project && CHAT_FOLDER.test(project.path));
const NO_PROJECT = "no-project";
export {
  NO_PROJECT,
  isChatProject
};
