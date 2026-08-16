// Implementação mínima do Prisma em memória, só com o que os testes de
// segurança exercitam. Existe para que as regras de autenticação possam ser
// testadas sem banco e sem o engine nativo do Prisma instalado — o teste roda
// em qualquer máquina e em qualquer CI, inclusive offline.
//
// Não é um substituto de teste de integração com SQLite de verdade: a query
// em si não é validada aqui. O que é validado é a lógica de sessão, permissão
// e tratamento de erro que fica em cima dela.

export interface UsuarioFalso {
  id: string;
  nome: string;
  senhaHash: string;
  perfil: string;
  ativo: boolean;
  tokenVersion: number;
  precisaTrocarSenha: boolean;
  criadoEm: Date;
}

type Onde = { id?: string; nome?: string };
type Selecao = Record<string, boolean> | undefined;

// O `select` do Prisma é o que impede senhaHash de sair da API. Se o falso
// ignorasse isso, o teste que verifica o vazamento do hash passaria mesmo com
// uma rota que devolve o usuário inteiro — ou seja, não testaria nada.
function aplicarSelect<T extends object>(registro: T | null, select: Selecao) {
  if (!registro || !select) return registro;
  const recorte: Record<string, unknown> = {};
  for (const [campo, incluir] of Object.entries(select)) {
    if (incluir) recorte[campo] = (registro as Record<string, unknown>)[campo];
  }
  return recorte as T;
}

function aplicarAtualizacao(alvo: UsuarioFalso, dados: Record<string, unknown>) {
  for (const [campo, valor] of Object.entries(dados)) {
    if (valor && typeof valor === "object" && "increment" in valor) {
      (alvo as unknown as Record<string, number>)[campo] =
        ((alvo as unknown as Record<string, number>)[campo] ?? 0) +
        (valor as { increment: number }).increment;
    } else {
      (alvo as unknown as Record<string, unknown>)[campo] = valor;
    }
  }
  return alvo;
}

export class PrismaFalso {
  usuarios: UsuarioFalso[] = [];
  // Ativado num teste para simular o erro de campo único que o banco real
  // devolveria — é o caminho que antes deixava a requisição pendurada.
  proximoErro: { code: string } | null = null;

  private achar(onde: Onde) {
    return (
      this.usuarios.find(
        (usuario) =>
          (onde.id !== undefined && usuario.id === onde.id) ||
          (onde.nome !== undefined && usuario.nome === onde.nome),
      ) ?? null
    );
  }

  usuario = {
    findUnique: async ({ where, select }: { where: Onde; select?: Selecao }) =>
      aplicarSelect(this.achar(where), select),

    findUniqueOrThrow: async ({ where, select }: { where: Onde; select?: Selecao }) => {
      const encontrado = this.achar(where);
      if (!encontrado) throw { code: "P2025" };
      return aplicarSelect(encontrado, select);
    },

    findMany: async ({ select }: { select?: Selecao } = {}) =>
      this.usuarios.map((usuario) => aplicarSelect(usuario, select)),

    count: async ({ where }: { where: Record<string, unknown> }) =>
      this.usuarios.filter((usuario) => {
        if (where.perfil && usuario.perfil !== where.perfil) return false;
        if (where.ativo !== undefined && usuario.ativo !== where.ativo) return false;
        const id = where.id as { not?: string } | undefined;
        if (id?.not && usuario.id === id.not) return false;
        return true;
      }).length,

    create: async ({ data, select }: { data: Record<string, unknown>; select?: Selecao }) => {
      if (this.proximoErro) {
        const erro = this.proximoErro;
        this.proximoErro = null;
        throw erro;
      }
      if (this.usuarios.some((usuario) => usuario.nome === data.nome)) {
        throw { code: "P2002" };
      }
      const novo: UsuarioFalso = {
        id: `id-${this.usuarios.length + 1}`,
        nome: String(data.nome),
        senhaHash: String(data.senhaHash),
        perfil: String(data.perfil),
        ativo: true,
        tokenVersion: 0,
        precisaTrocarSenha: Boolean(data.precisaTrocarSenha),
        criadoEm: new Date(),
      };
      this.usuarios.push(novo);
      return aplicarSelect(novo, select);
    },

    update: async ({
      where,
      data,
      select,
    }: {
      where: Onde;
      data: Record<string, unknown>;
      select?: Selecao;
    }) => {
      const alvo = this.achar(where);
      if (!alvo) throw { code: "P2025" };
      return aplicarSelect(aplicarAtualizacao(alvo, data), select);
    },
  };
}
