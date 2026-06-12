import { redirect } from "next/navigation";

// A raiz não tem conteúdo próprio: encaminha direto para o login.
export default function Home() {
  redirect("/login");
}