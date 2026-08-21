# Como contribuir com este projeto

Regra curta: **nada entra na `main` por commit direto.** Toda mudança —
feature, correção, ajuste de documentação — nasce numa branch e entra por
Pull Request, com o CI verde.

## Por que

A `main` é o que está rodando na casa do cliente. Os donos usam o sistema
todo dia e não têm como voltar atrás sozinhos se uma versão quebrada for
publicada: o PWA se atualiza sozinho a cada push (Cloudflare Workers), então
um commit ruim na `main` chega ao celular deles em minutos, sem ninguém
apertar nada.

A branch dá dois pontos de parada que o commit direto não dá: o CI roda os
testes antes do merge, e o diff do PR obriga a reler a mudança inteira antes
de publicá-la.

## Fluxo

```bash
git switch main
git pull                                # sempre partir da main atualizada
git switch -c feat/nome-curto-da-feature

# ... trabalho, commits pequenos ...

cd backend && npm test                  # roda offline, sem banco
cd ../frontend && npm run build         # o tsc -b faz o typecheck

git push -u origin feat/nome-curto-da-feature
gh pr create --fill                     # ou abrir pelo site
```

Depois do merge:

```bash
git switch main && git pull
git branch -d feat/nome-curto-da-feature
```

## Nome da branch

`tipo/assunto-em-kebab-case`, com o mesmo conjunto de tipos usado nos
commits:

| Prefixo | Para |
|---|---|
| `feat/` | funcionalidade nova |
| `fix/` | correção de bug |
| `docs/` | só documentação |
| `chore/` | manutenção, configuração, dependências |
| `ci/` | pipeline de integração contínua |
| `refactor/` | mudança interna sem alterar comportamento |

Exemplos reais deste repositório: `fix/catalogo-desatualizado`,
`feat/estorno-de-movimentacao`, `ci/github-actions`.

## Mensagem de commit

Convenção `tipo: o que mudou`, em português, no imperativo e em minúsculas —
é a que o histórico já usa:

```
feat: desfaz movimentacao pelo historico criando estorno
fix: catalogo so era baixado quando havia fila pendente
```

O corpo é opcional, mas quando a mudança tem uma decisão não óbvia por trás,
ela vai no corpo. Um "por que" no commit vale mais que um "o que" — o "o que"
já está no diff.

## O que o PR precisa ter

- Título no mesmo formato da mensagem de commit.
- Descrição respondendo: o que muda para quem usa o sistema, e por que
  desta forma (o template em `.github/pull_request_template.md` já pergunta).
- CI verde. PR com teste vermelho não entra, nem "só desta vez".
- Se mexeu em regra de negócio, teste cobrindo a regra.
- Se mexeu em `prisma/schema.prisma`, a migration correspondente commitada.
- Se mudou uma decisão de arquitetura, `docs/ARCHITECTURE.md` atualizado no
  mesmo PR — documentação que fica para depois não fica.

## As três regras que nenhum PR pode quebrar

Estão em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) e valem a repetição:

1. Estoque nunca é um número salvo — é sempre a soma das movimentações.
2. `Movimentacao` é append-only: correção é registro novo, nunca `UPDATE`
   nem `DELETE`.
3. `tipo` só tem `entrada` e `saida`.

## Protegendo a `main` no GitHub

O acordo acima só vale de verdade quando o servidor recusa o push direto.
Em **Settings → Branches → Add branch ruleset**, para a branch `main`:

- Restrict deletions
- Require a pull request before merging
- Require status checks to pass → marcar o check `testes`
- Block force pushes

Como o repositório é de um dono só, vale deixar
"Require approvals" em 0 — exigir aprovação de outra pessoa num projeto solo
só cria o hábito de burlar a regra.
