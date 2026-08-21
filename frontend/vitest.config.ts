import { defineConfig } from "vitest/config";

// Config separada do vite.config.ts de propósito: o plugin do PWA e o do React
// não têm nada a ver com os testes, e carregá-los aqui só deixaria a suíte
// lenta e sujeita a quebrar por motivo de build.
export default defineConfig({
  test: {
    include: ["testes/**/*.test.ts"],
    // O código testado (Dexie) fala com IndexedDB, que não existe no Node.
    // fake-indexeddb/auto instala uma implementação em memória nos globais —
    // é o que permite testar a sincronização offline sem navegador.
    setupFiles: ["./testes/preparo.ts"],
    environment: "node",
  },
});
