const teamActive = (team) => team?.status === "running" || team?.status === "waiting";
export {
  teamActive
};
