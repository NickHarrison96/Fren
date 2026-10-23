function mountExternalLinks(document, openExternalUrl, onError) {
  const handle = (event) => {
    if (event.defaultPrevented) return;
    if (event.type === "click" ? event.button !== 0 : event.button !== 1) return;
    const anchor = event.composedPath().find((target) => target instanceof HTMLAnchorElement);
    if (!anchor?.hasAttribute("href") || anchor.hasAttribute("download")) return;
    let url;
    try {
      url = new URL(anchor.href, document.baseURI);
    } catch {
      return;
    }
    if (!["http:", "https:"].includes(url.protocol) || !url.host) return;
    if (url.origin === document.location.origin && anchor.target.toLowerCase() !== "_blank") return;
    event.preventDefault();
    event.stopPropagation();
    try {
      void openExternalUrl(url.href).catch(onError);
    } catch (error) {
      onError(error);
    }
  };
  document.addEventListener("click", handle, true);
  document.addEventListener("auxclick", handle, true);
  return () => {
    document.removeEventListener("click", handle, true);
    document.removeEventListener("auxclick", handle, true);
  };
}
export {
  mountExternalLinks
};
