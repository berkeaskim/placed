// Ashby (live Multiverse form, 2026-10-14). There is NO <form> element; every button is a typeless <button>
// (so .type === "submit"), including the Yes/No toggles and the real "Submit Application" button. We therefore never
// click Ashby buttons at all:
//   field entry   label[for="<path>"] inside .ashby-application-form-field-entry / fieldset
//   text          input#<path> / textarea#<path> (name = path; system fields _systemfield_name, _systemfield_email)
//   CV            input#_systemfield_resume[type=file] (no name attribute)
//   Boolean       Yes/No buttons [data-option=yes|no][aria-pressed] plus a hidden input[type=checkbox][name=<path>]
//                 whose React onChange sets the value to checked (true -> Yes, false -> No). We click the checkbox.
//   ValueSelect   few options: radio group (label.ashby-application-form-input-radio-group-option-label -> radio)
//                 many options: input[role=combobox].ashby-application-form-input-autocomplete ("Start typing...")
//   MultiValue    checkbox group, input[type=checkbox] name = option label
(function (root) {
  const D = () => root.PlacedDom;
  const G = () => root.PlacedGuard;
  const ENTRY = ".ashby-application-form-field-entry, fieldset, [class*=_fieldEntry]";

  function entry(field) {
    const label = document.querySelector(`label[for="${D().attrEsc(field.target)}"]`);
    if (label) return label.closest(ENTRY) || label.parentElement;
    const el = document.getElementById(field.target) || document.querySelector(`[name="${D().attrEsc(field.target)}"]`);
    return el ? el.closest(ENTRY) || el.parentElement : null;
  }

  function pressed(container, which) {
    const b = container.querySelector(`[data-option="${which}"]`);
    return b ? b.getAttribute("aria-pressed") === "true" : false;
  }

  async function fillBoolean(container, field) {
    const want = field.value === "true" || field.optionLabel === "Yes" ? "yes" : field.value === "false" || field.optionLabel === "No" ? "no" : null;
    if (!want) return "select-yourself";
    const cb = container.querySelector(`input[type=checkbox][name="${D().attrEsc(field.target)}"]`); // only this field's own box
    if (!cb || !container.querySelector("[data-option]")) return "select-yourself";
    for (let i = 0; i < 2 && !pressed(container, want); i++) {
      // checked -> Yes. For No: an unchecked box goes true then false; a checked one goes straight to false.
      G().safeClick(cb);
      await D().sleep(80);
    }
    return pressed(container, want) ? "filled" : "select-yourself";
  }

  async function fillCombobox(container, input, label, ctx, { prefix } = {}) {
    const hasValue = () => Boolean(String(input.value || "").trim());
    const listbox = () => document.getElementById(input.getAttribute("aria-controls") || input.getAttribute("aria-owns") || "");
    const arm = () => {
      ctx.armed = D().armAutoPick({ input, scope: container, optionSelector: "[role=option]", label, prefix, sourceLabel: ctx.sourceLabel, hasValue });
      return "select-yourself";
    };
    if (hasValue()) return "select-yourself";
    if (!(await D().trustedClickOn(input))) return arm();
    if (!(await D().trustedType(label, input, container))) return arm();
    // The field's own listbox, else its entry; the whole document only while this combobox is the expanded one.
    const where = () => listbox() || (container.querySelector("[role=option]") ? container : input.getAttribute("aria-expanded") === "true" ? document : null);
    const opt = await D().waitFor(() => D().findOption(where(), "[role=option]", label, prefix), 25, 150);
    if (!opt || G().isSubmitControl(opt)) return "select-yourself";
    G().safeClick(opt);
    await D().sleep(150);
    if (prefix || D().norm(input.value) === D().norm(label)) return "filled";
    // Some listboxes select on a real click only.
    if (opt.isConnected && (await D().trustedClickOn(opt))) await D().sleep(150);
    return D().norm(input.value) === D().norm(label) ? "filled" : "select-yourself";
  }

  async function ashby(field, ctx) {
    if (field.mode !== "fill") return field.mode;
    const { setNative, uploadFile } = D();

    if (field.type === "file") {
      if (!ctx.cvFile) return "yours";
      const input = document.getElementById(field.target);
      const fileInput = input && input.type === "file" ? input : entry(field) && entry(field).querySelector("input[type=file]");
      return uploadFile(fileInput, ctx.cvFile) ? "filled" : "missing";
    }
    const container = entry(field);
    if (!container) return "missing";

    if (field.type === "boolean") return fillBoolean(container, field);

    if (field.type === "select") {
      const label = field.optionLabel || String(field.value);
      const radioLabel = [...container.querySelectorAll("label[for]")].find((l) => l.htmlFor !== field.target && D().norm(l.textContent) === D().norm(label));
      const radio = radioLabel && document.getElementById(radioLabel.htmlFor);
      if (radio && radio.type === "radio") {
        if (!radio.checked) G().safeClick(radio);
        return radio.checked ? "filled" : "select-yourself";
      }
      const combo = container.querySelector("input[role=combobox]");
      return combo ? fillCombobox(container, combo, label, ctx) : "select-yourself";
    }

    if (field.type === "multiselect") {
      const values = (Array.isArray(field.value) ? field.value : [field.value]).map(String);
      const wanted = new Set([...values, field.optionLabel].filter(Boolean).map(D().norm));
      let found = 0;
      for (const cb of container.querySelectorAll("input[type=checkbox]")) {
        const lab = cb.id ? container.querySelector(`label[for="${D().attrEsc(cb.id)}"]`) : null;
        if (!wanted.has(D().norm(cb.name)) && !(lab && wanted.has(D().norm(lab.textContent)))) continue;
        found++;
        if (!cb.checked) G().safeClick(cb);
      }
      return found ? "filled" : "select-yourself";
    }

    if (field.type === "location") {
      const combo = container.querySelector("input[role=combobox]");
      const city = String(field.value || "").split(",")[0].trim();
      if (!city) return "missing";
      if (combo) return fillCombobox(container, combo, city, ctx, { prefix: true });
      const plain = container.querySelector("input[type=text]");
      if (!plain) return "select-yourself";
      setNative(plain, String(field.value));
      return "filled";
    }

    if (field.type === "date") {
      const d = container.querySelector("input[type=date]");
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(String(field.value))) return "select-yourself"; // date pickers: student picks
      setNative(d, String(field.value));
      return "filled";
    }

    const el = document.getElementById(field.target) || container.querySelector(`[name="${D().attrEsc(field.target)}"]`);
    if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") || el.type === "checkbox" || el.type === "radio" || el.type === "file") return "select-yourself";
    setNative(el, Array.isArray(field.value) ? field.value.join(", ") : String(field.value));
    return "filled";
  }
  ashby.box = entry;
  root.PlacedFillers = Object.assign(root.PlacedFillers || {}, { ashby });
})(globalThis);
