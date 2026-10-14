import data from "./data.json";
import { Playbook } from "./schema";
import { ARCHETYPES, type Archetype } from "@/lib/types";

export const PLAYBOOKS = Object.fromEntries(
  ARCHETYPES.map((a) => [a, Playbook.parse((data as Record<string, unknown>)[a])]),
) as Record<Archetype, Playbook>;

export type { Playbook, Action, Signal, Source } from "./schema";
