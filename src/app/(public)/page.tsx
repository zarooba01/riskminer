import { redirect } from "next/navigation";

/** Strona startowa prowadzi prosto do panelu (konta użytkowników są na razie wyłączone). */
export default function LandingPage() {
  redirect("/dashboard");
}
