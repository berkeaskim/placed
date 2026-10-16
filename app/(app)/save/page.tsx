import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SaveForm } from "./save-form";

export default async function SavePage() {
  const { user } = await requireUser();
  if (!user.is_anonymous) redirect("/feed");
  return (
    <div className="flex justify-center py-6">
      <Card className="card-quest w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold"><h1>Save your progress</h1></CardTitle>
          <p className="text-sm text-muted-foreground">Your profile, CV score and saved jobs stay exactly where they are. Next time, sign in with this email and password.</p>
        </CardHeader>
        <CardContent><SaveForm /></CardContent>
      </Card>
    </div>
  );
}
