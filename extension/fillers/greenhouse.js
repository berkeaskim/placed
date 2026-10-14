// Greenhouse job-boards (live Monzo form, 2026-10-14):
//   text/textarea  #<field name>            native value setter + input/change
//   CV             input#resume[type=file]  DataTransfer + change
//   multiselect    checkbox id="question_X[]_<valueId>"
//   single select  react-select: input#question_X[role=combobox] in .select-shell > .select__control
//                  (synthetic events do not open it; a trusted click does, then .select__option can be clicked)
//   location       #candidate-location, an async react-select combobox
//   wrapper        .field-wrapper
(function (root) {
  const D = () => root.PlacedDom;
  const G = () => root.PlacedGuard;

  function anchor(field) {
    if (field.type === "file") return document.getElementById(field.target) || document.getElementById("resume");
    if (field.type === "location") return document.getElementById("candidate-location") || document.getElementById(field.target);
    if (field.type === "multiselect") return document.querySelector(`[id^="${D().attrEsc(field.target)}_"]`) || document.getElementById(field.target);
    return document.getElementById(field.target);
  }
  function box(field) {
    const el = anchor(field);
    return el ? el.closest(".field-wrapper") || el.closest("fieldset") || el.parentElement : null;
  }

  async function pickReactSelect(input, label, ctx, { type, prefix } = {}) {
    const shell = input.closest(".select-shell") || input.closest(".select__container") || input.parentElement;
    const control = input.closest(".select__control");
    if (!control || G().isSubmitControl(control)) return "select-yourself";
    const hasValue = () => Boolean(shell.querySelector(".select__single-value, .select__multi-value"));
    const arm = () => {
      ctx.armed = D().armAutoPick({ input, scope: shell, optionSelector: ".select__option", label, prefix, sourceLabel: ctx.sourceLabel, hasValue });
      return "select-yourself";
    };
    if (!(await D().trustedClickOn(control))) return arm();
    if (type && !(await D().trustedType(type, input, shell))) return arm();
    const opt = await D().waitFor(() => D().findOption(shell, ".select__option", label, prefix), type ? 25 : 12, 150);
    if (!opt || G().isSubmitControl(opt)) return arm();
    G().safeClick(opt);
    return "filled";
  }

  async function greenhouse(field, ctx) {
    if (field.mode !== "fill") return field.mode;
    const { setNative, uploadFile } = D();

    if (field.type === "file") {
      if (!ctx.cvFile) return "yours";
      return uploadFile(anchor(field), ctx.cvFile) ? "filled" : "missing";
    }
    if (field.type === "multiselect") {
      const values = Array.isArray(field.value) ? field.value : [field.value];
      let found = 0;
      for (const v of values) {
        const boxEl = document.getElementById(`${field.target}_${v}`);
        if (!boxEl || boxEl.type !== "checkbox") continue;
        found++;
        if (!boxEl.checked) G().safeClick(boxEl);
      }
      return found ? "filled" : "missing";
    }
    if (field.type === "location") {
      const input = anchor(field);
      if (!input || field.value == null) return "missing";
      const city = String(field.value).split(",")[0].trim();
      if (input.getAttribute("role") !== "combobox") { setNative(input, String(field.value)); return "filled"; }
      return pickReactSelect(input, city, ctx, { type: city, prefix: true });
    }
    const el = document.getElementById(field.target);
    if (!el) return "missing";
    if (el.getAttribute("role") === "combobox") return pickReactSelect(el, field.optionLabel || String(field.value), ctx);
    if (el.tagName === "SELECT") {
      const want = String(field.value);
      const opt = [...el.options].find((o) => o.value === want || D().norm(o.text) === D().norm(field.optionLabel || want));
      if (!opt) return "select-yourself";
      el.value = opt.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return "filled";
    }
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return "select-yourself";
    setNative(el, Array.isArray(field.value) ? field.value.join(", ") : String(field.value));
    return "filled";
  }
  greenhouse.box = box;
  root.PlacedFillers = Object.assign(root.PlacedFillers || {}, { greenhouse });
})(globalThis);
