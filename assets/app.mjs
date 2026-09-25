const root = document.documentElement;

const safeStorage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* stockage indisponible */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* stockage indisponible */ }
  }
};

const storedTheme = safeStorage.get("schema-theme");
if (storedTheme === "light" || storedTheme === "dark") root.dataset.theme = storedTheme;

const effectiveTheme = () => root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const syncThemeControls = () => {
  const dark = effectiveTheme() === "dark";
  document.querySelectorAll("[data-theme-toggle]").forEach((control) => {
    control.setAttribute("aria-checked", String(dark));
  });
};

document.querySelectorAll("[data-theme-toggle]").forEach((control) => {
  control.addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    safeStorage.set("schema-theme", next);
    syncThemeControls();
  });
});
syncThemeControls();

const wizard = document.querySelector("[data-schema-wizard]");

if (wizard) {
  const form = wizard.querySelector("form");
  const steps = [...wizard.querySelectorAll("[data-wizard-step]")];
  const stepControls = [...wizard.querySelectorAll("[data-step-jump]")];
  const previous = wizard.querySelector("[data-previous]");
  const next = wizard.querySelector("[data-next]");
  const progress = wizard.querySelector("[data-wizard-progress]");
  const currentText = wizard.querySelector("[data-step-current]");
  const preview = wizard.querySelector("[data-wizard-preview]");
  const saveState = wizard.querySelector("[data-save-state]");
  const storageKey = wizard.dataset.storageKey;
  const lang = wizard.dataset.lang;
  let current = 0;
  let saveTimer;

  const words = lang === "fr" ? {
    title: "Dossier SCHEMA",
    project: "Projet",
    promise: "Promesse actuelle",
    decision: "Décision à éclairer",
    question: "Question",
    state: "État de la connaissance",
    answer: "Réponse actuelle",
    evidence: "Preuves ou sources",
    unknowns: "Inconnues, divergences ou limites",
    empty: "Non renseigné"
  } : {
    title: "SCHEMA record",
    project: "Project",
    promise: "Current promise",
    decision: "Decision to inform",
    question: "Question",
    state: "State of knowledge",
    answer: "Current answer",
    evidence: "Evidence or sources",
    unknowns: "Unknowns, divergences or limits",
    empty: "Not provided"
  };

  const values = () => Object.fromEntries(
    [...form.elements]
      .filter((control) => control.name)
      .map((control) => [control.name, control.value.trim()])
  );

  const record = () => {
    const data = values();
    const links = [...wizard.querySelectorAll("[data-link-id]")].map((fieldset) => {
      const id = fieldset.dataset.linkId;
      const select = form.elements.namedItem(`${id}_state`);
      return {
        id,
        name: fieldset.dataset.linkName,
        question: fieldset.dataset.linkQuestion,
        state: select.value,
        stateLabel: select.selectedOptions[0]?.textContent || words.empty,
        answer: data[`${id}_answer`] || "",
        evidence: data[`${id}_evidence`] || "",
        unknowns: data[`${id}_unknowns`] || ""
      };
    });
    return {
      schemaVersion: "0.1",
      language: lang,
      exportedAt: new Date().toISOString(),
      project: {
        name: data.project_name || "",
        promise: data.project_promise || "",
        decision: data.decision_needed || ""
      },
      links
    };
  };

  const present = (value) => value || words.empty;
  const toMarkdown = () => {
    const data = record();
    const sections = data.links.map((link) => `## ${link.id} — ${link.name}\n\n**${words.question} :** ${link.question}\n\n**${words.state} :** ${link.stateLabel}\n\n### ${words.answer}\n\n${present(link.answer)}\n\n### ${words.evidence}\n\n${present(link.evidence)}\n\n### ${words.unknowns}\n\n${present(link.unknowns)}`);
    return `# ${words.title} — ${present(data.project.name)}\n\n## ${words.project}\n\n**${words.promise} :** ${present(data.project.promise)}\n\n**${words.decision} :** ${present(data.project.decision)}\n\n${sections.join("\n\n---\n\n")}\n`;
  };

  const toText = () => {
    const data = record();
    const sections = data.links.map((link) => `${link.id} — ${link.name}\n${words.question}: ${link.question}\n${words.state}: ${link.stateLabel}\n${words.answer}: ${present(link.answer)}\n${words.evidence}: ${present(link.evidence)}\n${words.unknowns}: ${present(link.unknowns)}`);
    return `${words.title} — ${present(data.project.name)}\n\n${words.promise}: ${present(data.project.promise)}\n${words.decision}: ${present(data.project.decision)}\n\n${sections.join("\n\n--------------------\n\n")}\n`;
  };

  const renderPreview = () => { preview.textContent = toMarkdown(); };

  const show = (index, focus = false) => {
    current = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach((step, i) => { step.hidden = i !== current; });
    stepControls.forEach((control, i) => {
      const active = i === current;
      control.setAttribute("aria-current", active ? "step" : "false");
    });
    currentText.textContent = String(current + 1);
    progress.value = current + 1;
    progress.textContent = `${current + 1}/${steps.length}`;
    previous.disabled = current === 0;
    next.hidden = current === steps.length - 1;
    if (steps[current].hasAttribute("data-summary-step")) renderPreview();
    if (focus) steps[current].querySelector("legend")?.focus?.();
  };

  const persist = () => {
    safeStorage.set(storageKey, JSON.stringify(values()));
    saveState.dataset.visible = "true";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { delete saveState.dataset.visible; }, 1600);
  };

  const restore = () => {
    const raw = safeStorage.get(storageKey);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      for (const [name, value] of Object.entries(data)) {
        const control = form.elements.namedItem(name);
        if (control && typeof value === "string") control.value = value;
      }
    } catch { safeStorage.remove(storageKey); }
  };

  const filename = () => {
    const raw = form.elements.namedItem("project_name").value.trim() || wizard.dataset.untitled;
    return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || wizard.dataset.untitled;
  };

  const download = (format) => {
    const content = format === "json" ? JSON.stringify(record(), null, 2) : format === "txt" ? toText() : toMarkdown();
    const type = format === "json" ? "application/json" : "text/plain";
    const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename()}-schema.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (current < steps.length - 1) show(current + 1, true);
  });
  form.addEventListener("input", persist);
  previous.addEventListener("click", () => show(current - 1, true));
  stepControls.forEach((control, index) => control.addEventListener("click", () => show(index, true)));
  wizard.querySelectorAll("[data-download]").forEach((control) => control.addEventListener("click", () => download(control.dataset.download)));
  wizard.querySelector("[data-copy]").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown());
      saveState.textContent = wizard.dataset.copied;
    } catch {
      saveState.textContent = wizard.dataset.copyFailed;
    }
    saveState.dataset.visible = "true";
  });
  wizard.querySelector("[data-reset]").addEventListener("click", () => {
    if (!confirm(wizard.dataset.resetConfirm)) return;
    form.reset();
    safeStorage.remove(storageKey);
    show(0, true);
  });

  restore();
  wizard.classList.add("wizard-enhanced");
  show(0);
}
