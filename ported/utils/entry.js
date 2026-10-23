if (new URLSearchParams(location.search).get("view") === "launcher") {
  void import("./overlay");
} else {
  void import("./main");
}
