import { call } from "./bridge";
import { icon } from "./dom";
import { openChoiceMenu } from "./choice-menu";
import { sameTeamSetup } from "./team-mode";
function mountTeamProfiles(host, options) {
  let library = structuredClone(options.library), disposed = false, pending = false;
  let menu, edit;
  let selected = library.profiles.find((profile) => profile.id === library.activeProfileId && sameTeamSetup(profile.setup, options.read()))?.id ?? library.profiles.find((profile) => sameTeamSetup(profile.setup, options.read()))?.id ?? null;
  host.className = "team-library";
  host.innerHTML = `<div class="team-library-heading"><span>Team profile</span><span class="team-library-state" role="status"></span></div><div class="team-library-row"><button type="button" class="team-library-picker" aria-label="Choose team profile" aria-haspopup="dialog" aria-expanded="false"><span></span>${icon("down")}</button><button type="button" class="icon-button team-library-manage" aria-label="Manage team profile" aria-haspopup="dialog">${icon("more")}</button></div><div class="team-library-actions"><button type="button" class="team-library-create">${icon("plus")} Save as\u2026</button><button type="button" class="team-library-update" hidden>Update profile</button></div><div class="team-library-editor" hidden><label>Profile name<input type="text" maxlength="80" autocomplete="off" aria-label="Profile name"></label><div><button type="button" class="secondary-button team-library-cancel">Cancel</button><button type="button" class="primary-button team-library-confirm">Save profile</button></div></div><p class="team-library-error" role="alert" hidden></p>`;
  const picker = host.querySelector(".team-library-picker");
  const manage = host.querySelector(".team-library-manage");
  const create = host.querySelector(".team-library-create");
  const update = host.querySelector(".team-library-update");
  const status = host.querySelector(".team-library-state");
  const editor = host.querySelector(".team-library-editor");
  const name = editor.querySelector("input");
  const confirm = editor.querySelector(".team-library-confirm");
  const error = host.querySelector(".team-library-error");
  const current = () => library.profiles.find((profile) => profile.id === selected);
  const showError = (cause) => {
    error.textContent = cause instanceof Error ? cause.message : String(cause);
    error.hidden = false;
  };
  function refresh() {
    if (disposed) return;
    const profile = current(), setup = options.read();
    const modified = !!profile && !sameTeamSetup(profile.setup, setup);
    picker.querySelector("span").textContent = profile?.name ?? (library.lastSetup && sameTeamSetup(library.lastSetup, setup) ? "Last saved setup" : "Custom setup");
    picker.disabled = pending || !library.profiles.length && !library.lastSetup;
    picker.title = "Choose a saved team";
    manage.disabled = pending || !profile;
    create.disabled = pending || library.profiles.length >= 20;
    update.hidden = !modified;
    update.disabled = pending;
    status.textContent = modified ? "Modified" : options.pendingSetup && sameTeamSetup(options.pendingSetup, setup) ? "Pending" : profile ? "Saved" : "";
  }
  function closeEditor() {
    edit = void 0;
    editor.hidden = true;
    error.hidden = true;
  }
  function editName(mode) {
    edit = mode;
    editor.hidden = false;
    error.hidden = true;
    name.value = mode === "rename" ? current()?.name ?? "" : "";
    confirm.textContent = mode === "rename" ? "Rename profile" : "Save profile";
    name.focus();
    name.select();
  }
  async function mutate(action, after) {
    if (pending || disposed) return;
    pending = true;
    error.hidden = true;
    menu?.();
    options.busy(true);
    try {
      library = await action();
      if (!disposed) {
        after?.();
        closeEditor();
      }
    } catch (cause) {
      if (!disposed) showError(cause);
    } finally {
      pending = false;
      if (!disposed) {
        options.busy(false);
        refresh();
      }
    }
  }
  picker.addEventListener("click", () => {
    if (menu) {
      menu();
      return;
    }
    const profiles = library.profiles.filter((profile) => !profile.setup.config.rosterOnly);
    const items = profiles.map((profile) => ({
      id: profile.id,
      label: profile.name,
      provider: profile.setup.architect.provider,
      description: `${profile.setup.config.workers.length} worker model${profile.setup.config.workers.length === 1 ? "" : "s"} \xB7 ${profile.setup.config.maxParallel === 0 ? "Unlimited at once" : `${profile.setup.config.maxParallel} at once`}`,
      selected: selected === profile.id
    }));
    if (library.lastSetup) items.unshift({
      id: "last-saved",
      label: "Last saved setup",
      provider: library.lastSetup.architect.provider,
      description: library.enabled ? "Default for new tasks" : "Remembered \xB7 single agent default",
      selected: !selected && sameTeamSetup(library.lastSetup, options.read())
    });
    menu = openChoiceMenu({
      anchor: picker,
      title: "Team profiles",
      items,
      width: 310,
      searchPlaceholder: profiles.length > 5 ? "Search profiles\u2026" : void 0,
      onSelect: (id) => {
        const setup = id === "last-saved" ? library.lastSetup : profiles.find((profile) => profile.id === id)?.setup;
        if (!setup) throw new Error("This profile is no longer available.");
        options.apply(structuredClone(setup));
        selected = id === "last-saved" ? library.activeProfileId : id;
        closeEditor();
        refresh();
      },
      onClose: () => {
        menu = void 0;
      }
    });
  });
  create.addEventListener("click", () => editName("create"));
  editor.querySelector(".team-library-cancel").addEventListener("click", () => {
    closeEditor();
    create.focus();
  });
  function saveNamed() {
    const trimmed = name.value.trim();
    if (!trimmed) {
      showError(new Error("Give this team profile a name."));
      name.focus();
      return;
    }
    const id = edit === "rename" ? current()?.id : void 0;
    const setup = edit === "rename" ? current()?.setup : options.read();
    if (!setup) return;
    void mutate(() => call("architect_save_profile", { id, name: trimmed, setup }), () => {
      selected = id ?? library.profiles.find((profile) => profile.name === trimmed)?.id ?? null;
    });
  }
  confirm.addEventListener("click", saveNamed);
  name.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      saveNamed();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeEditor();
      create.focus();
    }
  });
  update.addEventListener("click", () => {
    const profile = current();
    if (!profile) return;
    void mutate(() => call("architect_save_profile", { id: profile.id, name: profile.name, setup: options.read() }));
  });
  manage.addEventListener("click", () => {
    if (menu) {
      menu();
      return;
    }
    const profile = current();
    if (!profile) return;
    menu = openChoiceMenu({ anchor: manage, title: "Profile actions", actions: true, items: [
      { id: "rename", label: "Rename profile", icon: "edit" },
      { id: "delete", label: "Delete profile", icon: "close" }
    ], onSelect: (id) => {
      if (id === "rename") {
        menu?.();
        editName("rename");
      } else void mutate(() => call("architect_delete_profile", { id: profile.id }), () => {
        selected = null;
      });
    }, onClose: () => {
      menu = void 0;
    } });
  });
  refresh();
  return {
    selectedId: () => {
      const profile = current();
      return profile && sameTeamSetup(profile.setup, options.read()) ? profile.id : null;
    },
    changed: refresh,
    hasMenu: () => Boolean(menu),
    dispose: () => {
      disposed = true;
      menu?.();
    }
  };
}
export {
  mountTeamProfiles
};
