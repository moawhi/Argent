import { redirect } from "next/navigation";

export default function DashboardsRedirect() {
  redirect("/sites");
}
