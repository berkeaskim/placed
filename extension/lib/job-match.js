// Pure helpers: does the open page belong to the job the pack was built for? Whole path segments / query values only,
// so a pack for job 123 never fills /jobs/12345.
(function (root) {
  // /jobs/<id>, an Ashby/Lever uuid, or Greenhouse's embed page (/embed/job_app?for=<board>&token=<id>).
  const ID = /\/jobs\/(\d+)|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})|\/embed\/job_app\?(?:.*&)?token=(\d+)/i;
  function wantedJobId(planUrl) {
    const m = String(planUrl || "").match(ID);
    return m ? (m[1] || m[2] || m[3]).toLowerCase() : null;
  }
  function pageMatches(wanted, pathname, search) {
    if (!wanted) return false;
    const segments = String(pathname || "").toLowerCase().split("/").filter(Boolean);
    if (segments.includes(wanted)) return true;
    for (const v of new URLSearchParams(search || "").values()) if (v.toLowerCase() === wanted) return true; // e.g. ?token=<id> or gh_jid=<id>
    return false;
  }
  const api = { wantedJobId, pageMatches };
  root.PlacedJobMatch = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
