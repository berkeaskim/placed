import { requireUser } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { GuestBanner } from "@/components/guest-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return (
    <div className="min-h-dvh">
      <Header userId={user.id} />
      {user.is_anonymous && <GuestBanner />}
      <main className="mx-auto max-w-[1280px] px-4 py-7 sm:px-8">{children}</main>
    </div>
  );
}
