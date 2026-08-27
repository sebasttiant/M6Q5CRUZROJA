import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export default async function HomePage() {
  redirect((await getSessionUser()) ? "/dashboard" : "/login");
}
