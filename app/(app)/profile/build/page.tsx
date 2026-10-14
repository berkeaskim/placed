import Link from "next/link";
import { UploadCard } from "./upload-card";

export default function BuildProfile() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 sm:gap-8 sm:pt-8">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight sm:text-[40px]">Upload your CV</h1>
        <p className="text-[15px] text-muted-foreground sm:text-[17px]">We&apos;ll find the roles that fit you and check it against recruiter guidance.</p>
      </header>
      <UploadCard />
      <p className="text-center text-sm text-muted-foreground">
        No CV yet?{" "}
        <Link href="/profile/quiz" className="font-semibold text-[#5B3DF5] no-underline hover:underline">Take the 1-minute quiz</Link>
      </p>
    </div>
  );
}
