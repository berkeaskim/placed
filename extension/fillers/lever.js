// Lever (live Palantir form, 2026-10-14). Plain HTML <form id="application-form">, everything addressed by name:
//   text          [name=name|email|phone|org|urls[LinkedIn]|cards[<id>][fieldN]|comments]
//   CV            input[name=resume][type=file] (#resume-upload-input)
//   card select   radios input[type=radio][name=cards[..][fieldN]][value=<label>] or a native <select> (value = label)
//   card multi    input[type=checkbox][name=cards[..][fieldN]][value=<label>]
//   location      #location-input (async dropdown .dropdown-results, hidden #selected-location)
//   wrapper       li.application-question
// Note: Lever's real submit is <button type="button" id="btn-submit">, caught by PlacedGuard's id/text rules.
(function (root) {
  const D = () => root.PlacedDom;
  const G = () => root.PlacedGuard;
  const byName = (name) => document.querySelectorAll(`[name="${D().attrEsc(name)}"]`);

  function box(field) {
    const el = byName(field.target)[0];
    return el ? el.closest(".application-question") || el.closest("li") || el.parentElement : null;
  }

  async function lever(field, ctx) {
    if (field.mode !== "fill") return field.mode;
    const { setNative, uploadFile, norm } = D();
    const els = [...byName(field.target)];

    if (field.type === "file") {
      if (!ctx.cvFile) return "yours";
      const input = els.find((e) => e.type === "file") || document.getElementById("resume-upload-input");
      return uploadFile(input, ctx.cvFile) ? "filled" : "missing";
    }
    if (!els.length) return "missing";
    const values = (Array.isArray(field.value) ? field.value : [field.value]).filter((v) => v != null).map(String);
    if (field.optionLabel) values.push(field.optionLabel);
    const wanted = new Set(values.map(norm));
    if (field.type === "boolean") { if (field.value === "true") wanted.add("yes"); if (field.value === "false") wanted.add("no"); }

    const radios = els.filter((e) => e.type === "radio");
    if (radios.length) {
      const r = radios.find((e) => wanted.has(norm(e.value)));
      if (!r) return "select-yourself";
      if (!r.checked) G().safeClick(r);
      return r.checked ? "filled" : "select-yourself";
    }
    const boxes = els.filter((e) => e.type === "checkbox");
    if (boxes.length) {
      let found = 0;
      for (const b of boxes) if (wanted.has(norm(b.value))) { found++; if (!b.checked) G().safeClick(b); }
      return found ? "filled" : "select-yourself";
    }
    const el = els[0];
    if (el.tagName === "SELECT") {
      const opt = [...el.options].find((o) => o.value && (wanted.has(norm(o.value)) || wanted.has(norm(o.text))));
      if (!opt) return "select-yourself";
      el.value = opt.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return "filled";
    }
    if (field.type === "location") {
      const city = String(field.value || "").split(",")[0].trim();
      if (!city) return "missing";
      const results = el.parentElement && el.parentElement.querySelector(".dropdown-results");
      const selected = document.getElementById("selected-location");
      if ((await D().trustedClickOn(el)) && (await D().trustedType(city))) {
        const opt = await D().waitFor(() => results && [...results.children].find((c) => norm(c.textContent).startsWith(norm(city))), 25, 150);
        if (opt && !G().isSubmitControl(opt)) {
          G().safeClick(opt);
          await D().sleep(150);
          if (!selected || selected.value) return "filled";
        }
      }
      if (!el.value) setNative(el, city);
      return "select-yourself"; // typed, but the student confirms the suggestion
    }
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return "select-yourself";
    setNative(el, Array.isArray(field.value) ? field.value.join(", ") : String(field.value));
    return "filled";
  }
  lever.box = box;
  root.PlacedFillers = Object.assign(root.PlacedFillers || {}, { lever });
})(globalThis);
