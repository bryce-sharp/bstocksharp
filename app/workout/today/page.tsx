import { redirect } from "next/navigation";
import { getAssignments } from "@/lib/queries/workout";
import { getActiveProfile } from "@/lib/profile";
import PrivateNotice from "@/components/shared/PrivateNotice";
import { canView } from "@/lib/sharing";
import TodayRedirect from "@/components/workout/TodayRedirect";

export const metadata = { title: "Today — Workout" };

// Fast-track to today's workout. We resolve the profile and its schedule here on
// the server, then hand the weekday→workout map to a client component that reads
// the phone's clock (the server's UTC day would be wrong for an evening workout)
// and redirects to the run, or to today's day page on a rest day.
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const { profile } = await searchParams;
  const activeProfile = await getActiveProfile(profile);
  if (!activeProfile) redirect("/workout");
  if (!(await canView(activeProfile, "workout"))) {
    return <PrivateNotice title={`${activeProfile.name} keeps their workouts private`} />;
  }

  const assignments = await getAssignments(activeProfile.id);
  const workoutByDay: Record<number, number> = {};
  for (const a of assignments) workoutByDay[a.weekday] = a.workoutId;

  return (
    <TodayRedirect workoutByDay={workoutByDay} profileId={activeProfile.id} />
  );
}
