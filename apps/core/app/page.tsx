import { redirect } from "next/navigation";

// The dashboard bounces unauthenticated visitors to /login.
export default function Home() {
  redirect("/dashboard");
}
