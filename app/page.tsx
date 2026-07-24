import { redirect } from "next/navigation"

// Root entry — the app is a real multi-page router now. Each section is its own
// URL under the (app) route group; land on the default section.
export default function Home() {
  redirect("/prep")
}
