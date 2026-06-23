import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Faz o "@/..." dos imports apontar pra ./src, igual ao tsconfig.
    // Sem isso, o Vitest não acha @/lib/auth etc. e os testes de rota quebram.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node", // rotas usam Request/Response do Node, não precisa de DOM
  },
});