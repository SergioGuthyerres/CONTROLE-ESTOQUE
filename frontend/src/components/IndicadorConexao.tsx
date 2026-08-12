import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";

// Feedback simples de conexão + quantas movimentações ainda não
// sincronizaram — importante pro funcionário entender por que uma venda
// grande (RF07) pode estar bloqueada.
export function IndicadorConexao() {
  const [online, setOnline] = useState(navigator.onLine);
  const pendentes = useLiveQuery(() => db.movimentacoes.where({ sincronizada: 0 }).count(), []);

  useEffect(() => {
    const marcarOnline = () => setOnline(true);
    const marcarOffline = () => setOnline(false);
    window.addEventListener("online", marcarOnline);
    window.addEventListener("offline", marcarOffline);
    return () => {
      window.removeEventListener("online", marcarOnline);
      window.removeEventListener("offline", marcarOffline);
    };
  }, []);

  return (
    <span className="flex items-center gap-1">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${online ? "bg-green-400" : "bg-red-400"}`}
      />
      {online ? "Online" : "Offline"}
      {!!pendentes && pendentes > 0 && <span className="opacity-80">({pendentes} p/ enviar)</span>}
    </span>
  );
}
