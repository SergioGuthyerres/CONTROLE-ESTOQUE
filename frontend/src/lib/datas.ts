// Conversão entre "dia" (o que a dona escolhe num <input type="date">, no
// formato AAAA-MM-DD) e instante (o que a API compara com criadoEm).
//
// O detalhe que faz isso existir: `new Date("2026-08-21")` é meia-noite em
// UTC, não meia-noite aqui. A loja fica em UTC-3, então uma venda das 21h do
// dia 20 é registrada como 00h do dia 21 em UTC. Filtrar o "dia 21" com as
// datas cruas jogaria essa venda para o dia errado — e a conferência do
// caixa do dia fecharia com um valor que ninguém consegue explicar.
//
// A saída é o navegador resolver: ele conhece o fuso do aparelho, converte o
// dia escolhido para o instante correspondente e manda ISO para a API. O
// servidor não precisa saber em que fuso a loja fica, e continua guardando
// tudo em UTC.

/** Meia-noite do dia informado, no fuso do aparelho. */
export function inicioDoDiaLocal(dia: string): Date {
  const [ano, mes, diaDoMes] = dia.split("-").map(Number);
  return new Date(ano, mes - 1, diaDoMes, 0, 0, 0, 0);
}

/** Último instante do dia informado, no fuso do aparelho. */
export function fimDoDiaLocal(dia: string): Date {
  const [ano, mes, diaDoMes] = dia.split("-").map(Number);
  return new Date(ano, mes - 1, diaDoMes, 23, 59, 59, 999);
}

/** AAAA-MM-DD de uma data, no fuso do aparelho — o formato do <input date>. */
export function diaLocal(data: Date): string {
  const doisDigitos = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

export function hoje(): string {
  return diaLocal(new Date());
}

/** Soma dias a um AAAA-MM-DD, atravessando mês e ano sem drama. */
export function somarDias(dia: string, quantidade: number): string {
  const data = inicioDoDiaLocal(dia);
  data.setDate(data.getDate() + quantidade);
  return diaLocal(data);
}
