import { connection } from "next/server";
import { requireUser } from "@/lib/auth/local-user";
import { Header } from "@/components/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection(); // better-sqlite3 is sync: without this, build would prerender every app page with build-time data
  const { user } = await requireUser();
  return (
    <div className="min-h-dvh">
      <Header userId={user.id} />
      <main className="mx-auto max-w-[1280px] px-4 py-7 sm:px-8">{children}</main>
    </div>
  );
}
