import type { Person } from "./parse";

export const GROUPS = ["alumni", "team", "recruiter"] as const;
export type Group = (typeof GROUPS)[number];
export type Found = { groups: Record<Group, Person[]>; searched: boolean };
