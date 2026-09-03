// A lista de devedores: quem levou fiado e ainda não pagou.
//
// Puro de propósito (nenhum import de Prisma), pelo mesmo motivo de
// estornoService.ts: "quem ainda deve, e quanto" é regra de negócio, e regra
// de negócio testável não deve precisar de banco. Ver testes/fiado.test.ts.

export interface VendaFiado {
  id: string;
  cliente: string | null;
  valor: number;
  criadoEm: string;
  produtoNome: string;
  quantidade: number;
  unidade: string;
  vendidoPor: string;
  // Preenchidos pelo `include` da rota.
  pagamentoFiado: { id: string } | null;
  estorno: { id: string } | null;
}

export interface DividaEmAberto {
  movimentacaoId: string;
  valor: number;
  criadoEm: string;
  produtoNome: string;
  quantidade: number;
  unidade: string;
  vendidoPor: string;
}

export interface Devedor {
  cliente: string;
  total: number;
  desde: string;
  dividas: DividaEmAberto[];
}

// "Seu Antônio", "seu antonio" e "SEU ANTONIO" são a mesma pessoa e a mesma
// dívida. Sem isso a lista mostraria três devedores de R$ 30 onde existe um
// de R$ 90 — e ninguém cobraria o valor certo.
//
// Só a CHAVE de agrupamento é normalizada; o nome exibido continua sendo o
// que alguém digitou no balcão.
export function chaveDoCliente(nome: string): string {
  return nome
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

// Uma venda fiado só é dívida enquanto ninguém deu baixa nela — e enquanto
// ela existe de fato. Venda desfeita não é dívida: a mercadoria voltou para a
// prateleira, e cobrar por ela seria cobrar duas vezes o mesmo erro.
export function ehDividaEmAberto(venda: VendaFiado): boolean {
  return venda.pagamentoFiado === null && venda.estorno === null && !!venda.cliente?.trim();
}

export function listarDevedores(vendas: VendaFiado[]): Devedor[] {
  const porCliente = new Map<string, Devedor>();
  // Data da compra mais recente de cada chave, para escolher a grafia exibida.
  const maisRecente = new Map<string, string>();

  for (const venda of vendas) {
    if (!ehDividaEmAberto(venda)) continue;

    const nome = venda.cliente!.trim();
    const chave = chaveDoCliente(nome);
    const divida: DividaEmAberto = {
      movimentacaoId: venda.id,
      valor: venda.valor,
      criadoEm: venda.criadoEm,
      produtoNome: venda.produtoNome,
      quantidade: venda.quantidade,
      unidade: venda.unidade,
      vendidoPor: venda.vendidoPor,
    };

    const existente = porCliente.get(chave);
    if (!existente) {
      porCliente.set(chave, {
        cliente: nome,
        total: venda.valor,
        desde: venda.criadoEm,
        dividas: [divida],
      });
      maisRecente.set(chave, venda.criadoEm);
      continue;
    }

    existente.total += venda.valor;
    existente.dividas.push(divida);
    if (venda.criadoEm < existente.desde) existente.desde = venda.criadoEm;
    // Entre grafias diferentes do mesmo nome, exibe a da compra mais recente:
    // é a que a pessoa do balcão acabou de usar e vai reconhecer.
    if (venda.criadoEm > maisRecente.get(chave)!) {
      existente.cliente = nome;
      maisRecente.set(chave, venda.criadoEm);
    }
  }

  for (const devedor of porCliente.values()) {
    // Dentro de um devedor, a dívida mais antiga primeiro — é a ordem em que
    // se cobra, e a que responde "desde quando ele deve".
    devedor.dividas.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  }

  // A lista inteira também começa por quem deve há mais tempo. Ordenar por
  // valor colocaria a dívida grande e recente na frente da pequena e
  // esquecida — e é a esquecida que vira prejuízo.
  return [...porCliente.values()].sort((a, b) => a.desde.localeCompare(b.desde));
}
