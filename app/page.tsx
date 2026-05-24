import { redirect } from "next/navigation";

// The board lives at /active; / is just a redirect so deep-links and the
// root URL land in the same place.
export default function HomePage() {
  redirect("/active");
}
