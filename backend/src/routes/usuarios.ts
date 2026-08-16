import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao, exigirPerfil } from "../middleware/auth";
import { assincrono, ErroHttp } from "../middleware/erros";
import { limitadorAdministrativo } from "../middleware/rateLimit";
import { gerarHashSenha, gerarSenhaAleatoria } from "../lib/senha";
import { PERFIS } from "../lib/enums";

// RF14/RF15: só o admin (o dono) gerencia contas. Antes disso não existia
// caminho nenhum para criar um funcionário sem rodar o seed de exemplo — que
// é justamente o que colocava a senha "func123" em produção.
export const usuariosRouter = Router();
usuariosRouter.use(exigirAutenticacao, exigirPerfil("admin"), limitadorAdministrativo);

// Nunca selecionamos senhaHash aqui: hash não tem por que trafegar para o
// navegador, nem aparecer num log de rede.
const CAMPOS_PUBLICOS = {
  id: true,
  nome: true,
  perfil: true,
  ativo: true,
  precisaTrocarSenha: true,
  criadoEm: true,
} as const;

usuariosRouter.get(
  "/",
  assincrono(async (_req, res) => {
    const usuarios = await prisma.usuario.findMany({
      select: CAMPOS_PUBLICOS,
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    });
    res.json(usuarios);
  })
);

const criarUsuarioSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "O nome de usuário precisa de pelo menos 3 caracteres")
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado"),
  perfil: z.enum(PERFIS),
});

// A senha inicial é sempre gerada pelo servidor e devolvida UMA vez, em texto,
// nesta resposta. O admin repassa ao funcionário e o funcionário é obrigado a
// trocá-la no primeiro acesso (precisaTrocarSenha). Assim nenhuma senha
// escolhida por terceiro sobrevive, e não existe senha padrão no sistema.
usuariosRouter.post(
  "/",
  assincrono(async (req, res) => {
    const parse = criarUsuarioSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ erro: parse.error.issues[0]?.message ?? "Dados inválidos" });
    }

    const senhaProvisoria = gerarSenhaAleatoria();

    const usuario = await prisma.usuario.create({
      data: {
        nome: parse.data.nome,
        perfil: parse.data.perfil,
        senhaHash: await gerarHashSenha(senhaProvisoria),
        precisaTrocarSenha: true,
      },
      select: CAMPOS_PUBLICOS,
    });

    res.status(201).json({ usuario, senhaProvisoria });
  })
);

// Reset para quando o funcionário esquece a senha. Mesma lógica: senha gerada,
// mostrada uma vez, obrigatória trocar. O incremento de tokenVersion derruba
// qualquer sessão antiga — é também o botão de emergência para celular perdido.
usuariosRouter.post(
  "/:id/resetar-senha",
  assincrono(async (req, res) => {
    const senhaProvisoria = gerarSenhaAleatoria();

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data: {
        senhaHash: await gerarHashSenha(senhaProvisoria),
        precisaTrocarSenha: true,
        tokenVersion: { increment: 1 },
      },
      select: CAMPOS_PUBLICOS,
    });

    res.json({ usuario, senhaProvisoria });
  })
);

const alterarSchema = z.object({
  ativo: z.boolean().optional(),
  perfil: z.enum(PERFIS).optional(),
});

usuariosRouter.patch(
  "/:id",
  assincrono(async (req, res) => {
    const parse = alterarSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ erro: "Dados inválidos" });

    const alvo = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!alvo) throw new ErroHttp(404, "Usuário não encontrado");

    const viraInativo = parse.data.ativo === false;
    const deixaDeSerAdmin = parse.data.perfil !== undefined && parse.data.perfil !== "admin";

    // Trava contra o cenário em que o dono se tranca para fora do próprio
    // sistema: sem nenhum admin ativo, não sobra ninguém que possa recriar um.
    if (alvo.perfil === "admin" && (viraInativo || deixaDeSerAdmin)) {
      const outrosAdmins = await prisma.usuario.count({
        where: { perfil: "admin", ativo: true, id: { not: alvo.id } },
      });
      if (outrosAdmins === 0) {
        throw new ErroHttp(
          400,
          "Este é o único administrador ativo. Promova outro usuário a administrador antes de alterar este."
        );
      }
    }

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data: {
        ...parse.data,
        // Desativar ou rebaixar precisa valer imediatamente, não daqui a 30
        // dias quando o token vencer.
        ...(viraInativo || deixaDeSerAdmin ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: CAMPOS_PUBLICOS,
    });

    res.json(usuario);
  })
);
