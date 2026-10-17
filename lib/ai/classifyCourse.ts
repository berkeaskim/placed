import "server-only";
import { fieldForCourse, type Field } from "@/lib/profile/courses";
import { generateStructured, runAi } from "./provider";
import { SYSTEM_COURSE_FIELD } from "./prompts";
import { FIELDS } from "@/lib/validation/onboarding";
import { CourseFieldOutput } from "./schemas";

/**
 * The broad field for a course the student typed. Listed courses and recognisable subjects never reach the AI;
 * only an unusual name does, on the fast tier. Without an AI (fixture mode) or on any failure it falls back to "Other".
 */
export async function classifyCourse(course: string): Promise<Field> {
  const known = fieldForCourse(course);
  if (known) return known;
  try {
    return await runAi({
      fn: "classifyCourse",
      schema: CourseFieldOutput,
      fromFixture: (o) => o.field,
      live: async () => (await generateStructured({
        tier: "fast",
        system: SYSTEM_COURSE_FIELD,
        parts: [{ type: "text", text: `Fields: ${FIELDS.join(", ")}\nCourse: ${JSON.stringify(course.slice(0, 120))}` }],
        schema: CourseFieldOutput,
        maxTokens: 200,
      })).field,
      fallback: () => "Other" as Field,
    });
  } catch (e) {
    console.error("classifyCourse: AI failed, filing as Other", e);
    return "Other";
  }
}
