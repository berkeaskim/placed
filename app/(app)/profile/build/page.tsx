import Link from "next/link";
import { UploadCard } from "./upload-card";

export default function BuildProfile() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Let&apos;s find your roles</h1>
        <p className="text-muted-foreground">Upload a CV for the full picture, or take a 1-minute quiz.</p>
      </div>
      <UploadCard />
      <div className="card-quest flex flex-col gap-4 p-6">
        <h2 className="text-xl font-extrabold">No CV yet?</h2>
        <p className="text-sm text-muted-foreground">Six quick questions about what you enjoy. Perfect for first years.</p>
        <Link href="/profile/quiz" className="btn-quest mt-auto py-3 text-center">Take the 1-minute quiz</Link>
      </div>
    </div>
  );
}
