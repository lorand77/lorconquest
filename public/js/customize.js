// Customize (a section of the shell, shell.js): the colours, dark or light. The choice is theme.js's, which keeps it in the
// browser and applies it on every page; this page only shows it and changes it.
import { requireUser } from "./auth.js";
import { mountShell } from "./shell.js";

const $ = (id) => document.getElementById(id);
mountShell(await requireUser());

const scheme = globalThis.lorconquestScheme;
const radios = [...$("schemes").querySelectorAll("input[name=scheme]")];
const show = () => { for (const r of radios) r.checked = r.value === scheme.current; };
for (const r of radios) r.addEventListener("change", () => { if (r.checked) scheme.choose(r.value); });
window.addEventListener("storage", show);                 // chosen in another tab
show();
