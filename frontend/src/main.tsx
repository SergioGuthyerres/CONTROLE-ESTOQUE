import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { iniciarTema } from "./lib/tema";

// Antes do primeiro render: esperar o React montar faria a tela branca
// piscar a cada abertura para quem usa o tema escuro.
iniciarTema();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
