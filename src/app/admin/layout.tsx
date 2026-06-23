// Layout neutro do painel — sem gate de acesso.
// Não-admins entram normalmente; as ações de escrita são controladas
// na UI (botões) e no servidor (rotas PATCH/DELETE exigem admin).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
