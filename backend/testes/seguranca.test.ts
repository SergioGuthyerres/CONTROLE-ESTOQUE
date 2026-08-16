// Testes das regras de segurança que separam este sistema de um sistema
// aberto. Rodar com: npm test
//
// Cada teste aqui corresponde a uma brecha real que existia antes:
// senha fraca aceita, sessão que não morre, senha provisória que vira
// permanente, força bruta sem limite, erro do Prisma pendurando a requisição.
//
// O banco é substituído por um objeto em memória (testes/prismaFalso.ts) para
// que isto rode sem SQLite e sem o engine nativo do Prisma.
import test from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

// As variáveis precisam existir ANTES de src/lib/env.ts ser carregado — ele
// valida a configuração e encerra o processo se algo estiver faltando.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:./teste.db";
process.env.JWT_SECRET = "segredo-de-teste-suficientemente-longo-para-passar-na-validacao";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.LOGIN_MAX_TENTATIVAS = "5";
process.env.LOGIN_JANELA_MINUTOS = "15";

// Injetar o Prisma falso no cache de módulos antes que qualquer rota importe
// o de verdade. O projeto é CommonJS, então require.cache é o ponto de troca.
import { PrismaFalso } from "./prismaFalso";

const bancoFalso = new PrismaFalso();
const caminhoPrisma = require.resolve("../src/lib/prisma");
require.cache[caminhoPrisma] = {
  id: caminhoPrisma,
  filename: caminhoPrisma,
  loaded: true,
  exports: { prisma: bancoFalso },
} as NodeJS.Module;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { criarApp } = require("../src/app") as typeof import("../src/app");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { gerarHashSenha } = require("../src/lib/senha") as typeof import("../src/lib/senha");

let servidor: Server;
let base: string;

async function chamar(
  caminho: string,
  opcoes: { metodo?: string; token?: string; corpo?: unknown; origem?: string } = {},
) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: opcoes.metodo ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opcoes.token ? { Authorization: `Bearer ${opcoes.token}` } : {}),
      ...(opcoes.origem ? { Origin: opcoes.origem } : {}),
    },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
  const texto = await resposta.text();
  return {
    status: resposta.status,
    corpo: texto ? JSON.parse(texto) : null,
    headers: resposta.headers,
  };
}

async function entrar(nome: string, senha: string) {
  return chamar("/auth/login", { metodo: "POST", corpo: { nome, senha } });
}

test.before(async () => {
  const app = criarApp();
  servidor = app.listen(0);
  await new Promise((resolve) => servidor.once("listening", resolve));
  const endereco = servidor.address();
  base = `http://127.0.0.1:${typeof endereco === "object" && endereco ? endereco.port : 0}`;

  bancoFalso.usuarios = [
    {
      id: "id-dono",
      nome: "dona.maria",
      senhaHash: await gerarHashSenha("senha-boa-da-dona"),
      perfil: "admin",
      ativo: true,
      tokenVersion: 0,
      precisaTrocarSenha: false,
      criadoEm: new Date(),
    },
    {
      id: "id-func",
      nome: "joao.silva",
      senhaHash: await gerarHashSenha("senha-boa-do-joao"),
      perfil: "funcionario",
      ativo: true,
      tokenVersion: 0,
      precisaTrocarSenha: false,
      criadoEm: new Date(),
    },
    {
      id: "id-novato",
      nome: "novato",
      senhaHash: await gerarHashSenha("provisoria-do-novato"),
      perfil: "funcionario",
      ativo: true,
      tokenVersion: 0,
      precisaTrocarSenha: true,
      criadoEm: new Date(),
    },
    {
      id: "id-demitido",
      nome: "demitido",
      senhaHash: await gerarHashSenha("senha-do-demitido"),
      perfil: "funcionario",
      ativo: false,
      tokenVersion: 0,
      precisaTrocarSenha: false,
      criadoEm: new Date(),
    },
  ];
});

test.after(() => servidor.close());

test("login com senha correta devolve token", async () => {
  const resposta = await entrar("dona.maria", "senha-boa-da-dona");
  assert.equal(resposta.status, 200);
  assert.ok(resposta.corpo.token);
  assert.equal(resposta.corpo.usuario.perfil, "admin");
  // O hash da senha nunca pode sair da API.
  assert.equal(JSON.stringify(resposta.corpo).includes("senhaHash"), false);
});

test("senha errada e usuário inexistente respondem igual", async () => {
  const senhaErrada = await entrar("dona.maria", "chute-errado");
  const inexistente = await entrar("nao.existe", "chute-errado");

  assert.equal(senhaErrada.status, 401);
  assert.equal(inexistente.status, 401);
  // Mensagens diferentes revelariam quais usuários existem no sistema.
  assert.deepEqual(senhaErrada.corpo, inexistente.corpo);
});

test("usuário desativado não consegue entrar", async () => {
  const resposta = await entrar("demitido", "senha-do-demitido");
  assert.equal(resposta.status, 401);
});

test("rota protegida recusa requisição sem token e com token forjado", async () => {
  assert.equal((await chamar("/produtos")).status, 401);
  assert.equal((await chamar("/produtos", { token: "token.invalido.aqui" })).status, 401);
});

test("funcionário não acessa rota de admin", async () => {
  const { corpo } = await entrar("joao.silva", "senha-boa-do-joao");
  const dashboard = await chamar("/dashboard", { token: corpo.token });
  const usuarios = await chamar("/usuarios", { token: corpo.token });

  assert.equal(dashboard.status, 403);
  assert.equal(usuarios.status, 403);
});

test("senha provisória só libera a troca de senha", async () => {
  const { corpo } = await entrar("novato", "provisoria-do-novato");
  assert.equal(corpo.usuario.precisaTrocarSenha, true);

  const bloqueado = await chamar("/produtos", { token: corpo.token });
  assert.equal(bloqueado.status, 403);
  assert.equal(bloqueado.corpo.codigo, "SENHA_PROVISORIA");

  // A tela de troca precisa continuar acessível, senão o usuário fica preso.
  const permitido = await chamar("/auth/eu", { token: corpo.token });
  assert.equal(permitido.status, 200);
});

test("troca de senha recusa senha fraca e a senha pública do README", async () => {
  const { corpo } = await entrar("joao.silva", "senha-boa-do-joao");

  const curta = await chamar("/auth/trocar-senha", {
    metodo: "POST",
    token: corpo.token,
    corpo: { senhaAtual: "senha-boa-do-joao", senhaNova: "curta" },
  });
  assert.equal(curta.status, 400);

  // "func123" está publicada no README do repositório público.
  const publica = await chamar("/auth/trocar-senha", {
    metodo: "POST",
    token: corpo.token,
    corpo: { senhaAtual: "senha-boa-do-joao", senhaNova: "func123" },
  });
  assert.equal(publica.status, 400);

  const senhaAtualErrada = await chamar("/auth/trocar-senha", {
    metodo: "POST",
    token: corpo.token,
    corpo: { senhaAtual: "nao-e-a-atual", senhaNova: "outra-senha-longa-boa" },
  });
  assert.equal(senhaAtualErrada.status, 400);
});

test("trocar a senha derruba os outros aparelhos e mantém o atual", async () => {
  const primeiro = await entrar("novato", "provisoria-do-novato");
  const segundo = await entrar("novato", "provisoria-do-novato");

  const troca = await chamar("/auth/trocar-senha", {
    metodo: "POST",
    token: segundo.corpo.token,
    corpo: { senhaAtual: "provisoria-do-novato", senhaNova: "escolhi-esta-senha-agora" },
  });
  assert.equal(troca.status, 200);
  assert.ok(troca.corpo.token);
  assert.equal(troca.corpo.usuario.precisaTrocarSenha, false);

  // O token novo funciona...
  assert.equal((await chamar("/auth/eu", { token: troca.corpo.token })).status, 200);
  // ...e o token do outro aparelho morreu.
  assert.equal((await chamar("/auth/eu", { token: primeiro.corpo.token })).status, 401);
  // O token usado para fazer a troca também não vale mais (foi substituído).
  assert.equal((await chamar("/auth/eu", { token: segundo.corpo.token })).status, 401);
});

test("desativar usuário invalida a sessão aberta na hora", async () => {
  const sessao = await entrar("joao.silva", "senha-boa-do-joao");
  assert.equal((await chamar("/auth/eu", { token: sessao.corpo.token })).status, 200);

  const alvo = bancoFalso.usuarios.find((usuario) => usuario.id === "id-func")!;
  alvo.ativo = false;

  // Sem a checagem no banco a cada requisição, este token valeria mais 30 dias.
  assert.equal((await chamar("/auth/eu", { token: sessao.corpo.token })).status, 401);
  alvo.ativo = true;
});

test("erro do banco vira resposta HTTP em vez de pendurar a requisição", async () => {
  const { corpo } = await entrar("dona.maria", "senha-boa-da-dona");

  // Antes do tratador de erros global, um throw dentro de handler async no
  // Express 4 não era capturado: a requisição ficava aberta até dar timeout.
  bancoFalso.proximoErro = { code: "P2002" };
  const resposta = await chamar("/usuarios", {
    metodo: "POST",
    token: corpo.token,
    corpo: { nome: "qualquer.nome", perfil: "funcionario" },
  });

  assert.equal(resposta.status, 409);
  assert.ok(resposta.corpo.erro);
});

test("admin cria usuário com senha gerada e provisória", async () => {
  const { corpo } = await entrar("dona.maria", "senha-boa-da-dona");

  const criado = await chamar("/usuarios", {
    metodo: "POST",
    token: corpo.token,
    corpo: { nome: "maria.nova", perfil: "funcionario" },
  });

  assert.equal(criado.status, 201);
  assert.equal(criado.corpo.usuario.precisaTrocarSenha, true);
  assert.ok(criado.corpo.senhaProvisoria.length >= 16);
  // A senha é gerada pelo servidor: nada que o admin digitou vira credencial.
  assert.equal(criado.corpo.usuario.senhaHash, undefined);

  // E ela realmente funciona para entrar.
  const login = await entrar("maria.nova", criado.corpo.senhaProvisoria);
  assert.equal(login.status, 200);
  assert.equal(login.corpo.usuario.precisaTrocarSenha, true);
});

test("não é possível desativar o único administrador ativo", async () => {
  const { corpo } = await entrar("dona.maria", "senha-boa-da-dona");

  const resposta = await chamar("/usuarios/id-dono", {
    metodo: "PATCH",
    token: corpo.token,
    corpo: { ativo: false },
  });

  assert.equal(resposta.status, 400);
  assert.match(resposta.corpo.erro, /único administrador/i);
});

test("movimentação com data no futuro é recusada", async () => {
  const { corpo } = await entrar("joao.silva", "senha-boa-do-joao");

  const daquiUmAno = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const resposta = await chamar("/movimentacoes/sync", {
    metodo: "POST",
    token: corpo.token,
    corpo: {
      movimentacoes: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          produtoId: "produto-1",
          tipo: "saida",
          motivo: "venda",
          quantidade: 5,
          valor: 10,
          origemDispositivo: "celular-teste",
          criadoEm: daquiUmAno,
        },
      ],
    },
  });

  assert.equal(resposta.status, 400);
});

test("força bruta no login é bloqueada", async () => {
  // O limite de teste é 5 tentativas (LOGIN_MAX_TENTATIVAS acima).
  let bloqueou = false;
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const resposta = await entrar("dona.maria", `chute-${tentativa}`);
    if (resposta.status === 429) {
      bloqueou = true;
      break;
    }
  }
  assert.equal(bloqueou, true, "o login deveria ter respondido 429 após várias tentativas");
});

test("navegador de origem não autorizada é recusado pelo CORS", async () => {
  const permitida = await chamar("/health", { origem: "http://localhost:5173" });
  assert.equal(permitida.headers.get("access-control-allow-origin"), "http://localhost:5173");

  const estranha = await chamar("/health", { origem: "https://site-malicioso.example" });
  assert.equal(estranha.headers.get("access-control-allow-origin"), null);
});
