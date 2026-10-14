import type { Metadata } from "next";
import { QuizFlow } from "./quiz-flow";

export const metadata: Metadata = { title: "1-minute quiz · Placed" };

export default function QuizPage() {
  return <QuizFlow />;
}
