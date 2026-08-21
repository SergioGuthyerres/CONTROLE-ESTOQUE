## O que muda

<!-- Em uma ou duas frases, o que passa a acontecer de diferente para quem
     usa o sistema. Não a lista de arquivos — isso o diff já mostra. -->

## Por que assim

<!-- A decisão não óbvia da mudança. Se havia um caminho mais simples que foi
     descartado, dizer qual e por quê. Se não houve decisão nenhuma, apagar
     esta seção. -->

## Como testar

<!-- O caminho mínimo para ver a mudança funcionando. Ex:
     1. `cd backend && npm test`
     2. entrar como admin → Painel → Histórico → "Desfazer" na primeira linha -->

## Checklist

- [ ] `cd backend && npm test` passa
- [ ] `cd frontend && npm run build` passa (o `tsc -b` faz o typecheck)
- [ ] Mexi em regra de negócio? Então tem teste cobrindo a regra
- [ ] Mexi no `schema.prisma`? Então a migration está commitada
- [ ] Mudei uma decisão de arquitetura? Então `docs/ARCHITECTURE.md` está atualizado
