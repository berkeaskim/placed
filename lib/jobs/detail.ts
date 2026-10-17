/**
 * Curated programme cards (seed/programmes.yml) are not verified live postings: the detail page must not
 * offer Autopilot on them, must label them, and must not present "no requirements" as a reading failure.
 */
export function curatedDetail(job: { curated?: boolean }, autopilotOn: boolean) {
  const curated = Boolean(job.curated);
  return {
    curated,
    showAutopilot: autopilotOn && !curated,
    unscoredNote: curated ? "Curated programme: no posting text to score against yet" : null,
  };
}
