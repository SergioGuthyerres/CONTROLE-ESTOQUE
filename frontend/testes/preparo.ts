// Roda antes de cada arquivo de teste (ver vitest.config.ts).
//
// IndexedDB só existe no navegador. Sem uma implementação em memória, todo o
// código de armazenamento local — que é o coração do funcionamento offline —
// ficaria sem teste nenhum.
import "fake-indexeddb/auto";
