import { fimDoDiaLocal, hoje, inicioDoDiaLocal, somarDias } from "../lib/datas";

export interface Periodo {
  /** AAAA-MM-DD. Vazio = sem limite deste lado. */
  de: string;
  ate: string;
}

export const PERIODO_VAZIO: Periodo = { de: "", ate: "" };

export function periodoInvertido(periodo: Periodo): boolean {
  return periodo.de !== "" && periodo.ate !== "" && periodo.de > periodo.ate;
}

// Converte o período escolhido nos parâmetros que a API espera.
//
// A conversão dia → instante acontece aqui, no navegador, porque é ele que
// conhece o fuso da loja — ver o comentário em src/lib/datas.ts sobre a venda
// das 21h que ia parar no dia seguinte.
export function parametrosDoPeriodo(periodo: Periodo): URLSearchParams {
  const parametros = new URLSearchParams();
  if (periodo.de) parametros.set("dataInicio", inicioDoDiaLocal(periodo.de).toISOString());
  if (periodo.ate) parametros.set("dataFim", fimDoDiaLocal(periodo.ate).toISOString());
  return parametros;
}

// Dois campos de data e os atalhos que respondem à maioria das perguntas.
// Compartilhado entre o histórico e os relatórios porque a regra chata (fuso,
// intervalo invertido, "últimos N dias inclui hoje") é a mesma nos dois, e
// duplicá-la é garantir que um dos lados fique com a versão errada.
export function SeletorDePeriodo(props: {
  valor: Periodo;
  aoMudar: (periodo: Periodo) => void;
  rotulo?: string;
  /** Quantidades de dias oferecidas como atalho. */
  atalhosEmDias?: number[];
  /** Mostra "Hoje" e "Ontem" — não faz sentido num relatório de tendência. */
  mostrarDias?: boolean;
}) {
  const { valor, aoMudar } = props;
  const atalhos = props.atalhosEmDias ?? [7, 30];
  const invertido = periodoInvertido(valor);

  const ultimosDias = (quantidade: number) =>
    aoMudar({ de: somarDias(hoje(), -(quantidade - 1)), ate: hoje() });

  return (
    <div>
      <label className="block text-sm mb-1">{props.rotulo ?? "Período"}</label>
      {/* flex-1 + min-w-0 nos dois campos: `.campo` é `w-full`, e dois deles
          lado a lado pediam 100% da largura cada um. Como o padrão do flex é
          `min-width: auto`, o navegador não encolhia nenhum — a linha
          estourava a tela do celular e a página inteira ganhava rolagem
          horizontal. Com `min-w-0` eles podem encolher e dividem o espaço. */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          className="campo flex-1 min-w-0 text-base"
          aria-label="Data inicial"
          value={valor.de}
          max={valor.ate || undefined}
          onChange={(e) => aoMudar({ ...valor, de: e.target.value })}
        />
        <span className="text-sm text-gray-500 shrink-0">até</span>
        <input
          type="date"
          className="campo flex-1 min-w-0 text-base"
          aria-label="Data final"
          value={valor.ate}
          min={valor.de || undefined}
          onChange={(e) => aoMudar({ ...valor, ate: e.target.value })}
        />
      </div>

      {invertido && (
        <p className="text-red-600 text-xs mt-1">A data inicial precisa vir antes da final.</p>
      )}

      {/* Atalhos porque a pergunta do dia a dia quase sempre é uma destas, e
          digitar duas datas iguais para ver "hoje" é atrito que o RNF05 pede
          para evitar. */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs">
        {props.mostrarDias !== false && (
          <>
            <button
              type="button"
              className="underline"
              onClick={() => aoMudar({ de: hoje(), ate: hoje() })}
            >
              Hoje
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => aoMudar({ de: somarDias(hoje(), -1), ate: somarDias(hoje(), -1) })}
            >
              Ontem
            </button>
          </>
        )}
        {atalhos.map((dias) => (
          <button
            key={dias}
            type="button"
            className="underline"
            onClick={() => ultimosDias(dias)}
          >
            Últimos {dias} dias
          </button>
        ))}
        {(valor.de || valor.ate) && (
          <button
            type="button"
            className="underline text-gray-500"
            onClick={() => aoMudar(PERIODO_VAZIO)}
          >
            Tudo
          </button>
        )}
      </div>
    </div>
  );
}
