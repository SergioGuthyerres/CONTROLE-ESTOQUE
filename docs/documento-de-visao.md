# Documento de Visão — Estoque Casa do Campo

> Nome do sistema provisório: **Estoque Casa do Campo**. Sugestão livre, já que a
> identidade visual ainda está em aberto — troquem quando quiserem.

## 1. Contexto e problema

A Casa do Campo controla hoje o estoque em **caderno / anotações manuais**, com
um catálogo de **50+ produtos** e entre **50 e 150 movimentações por dia**
(entradas e saídas).

Esse processo manual gera:

- Falta de controle real de entrada e saída de produtos
- Falta de visibilidade sobre faturamento e prejuízos
- Desorganização administrativa
- Falta de rastreabilidade dos investimentos (o que foi comprado, por quanto,
  e o que virou venda ou perda)

## 2. Declaração de visão

Para a **Casa do Campo**, que precisa registrar entradas e saídas de estoque
sem depender de anotações manuais, o **Estoque Casa do Campo** é um sistema de
controle de estoque com painel administrativo que dá visibilidade real sobre
quantidade, valor investido e movimentação dos produtos — diferente do
caderno atual, que não rastreia nada de forma confiável e não gera nenhum
relatório.

O sistema é pensado para ser **usado por qualquer funcionário sem
familiaridade prévia com tecnologia**, sem depender de hardware adicional
(sem leitor de código de barras).

## 3. Usuários e perfis

| Perfil            | Quem                            | O que faz                                                                                |
| ----------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| **Funcionário**   | Atendente/operador do dia a dia | Registra entrada e saída de produtos (compra, venda, perda, uso interno)                 |
| **Administrador** | Dono/gestor                     | Tudo que o funcionário faz, + dashboard, relatórios, histórico/auditoria, controle geral |

Dispositivos: **funcionário usa celular** (Android e iOS), **admin usa
celular e computador**. A interface precisa funcionar bem em tela pequena
como prioridade.

## 4. Restrições e premissas

Essas são condições dadas, não escolhas de design — moldam todo o resto:

- **Sem leitor de código de barras.** Identificação de produto é manual.
- **Baixa maturidade digital dos usuários.** Telas precisam ser as mais
  simples possíveis; qualquer fluxo com muitas etapas ou conceitos técnicos
  (sincronizar, resolver conflito, etc.) tende a ser mal operado.
- **Sem fotos de produto por enquanto.** Identificação é só por texto
  (nome/descrição).
- **Precisa funcionar offline.** Funcionário e admin normalmente usam o
  sistema em momentos/lugares diferentes, então cada dispositivo roda com
  banco local (SQLite) e sincroniza quando há internet.
- **Conflitos de sincronização podem acontecer** (dois lançamentos para o
  mesmo produto, feitos offline, em dispositivos diferentes) — ver decisão
  técnica abaixo.
- **Unidades de medida:** kg, L e fardo/saco. Fardo/saco é tratado como uma
  quantidade em kg (ex: ao cadastrar um produto vendido em fardo, informa-se
  o peso do fardo e o sistema converte automaticamente para kg).
- **Orçamento quase zero.** Não há verba para ferramentas pagas, hospedagem
  paga ou serviços com mensalidade. Toda a stack (banco, sincronização,
  hospedagem) precisa caber em camadas gratuitas ou ser 100% self-hosted sem
  custo. Isso é restrição de primeira ordem — pesa mais que conveniência ou
  velocidade de desenvolvimento na escolha de qualquer peça técnica.

## 5. Decisões técnicas que vêm da visão do negócio

### 5.1 Identificação de produto: busca simples por nome

Sem código de barras e sem fotos, e considerando a maturidade digital dos
funcionários, a tela de entrada/saída usa **um único campo de busca por
nome/descrição**, sem distinguir "atalhos" de produtos frequentes nem grade
de categorias. Produto encontrado → informa quantidade e valor → confirma.
Simples, uniforme, sem decisão extra pro usuário.

### 5.2 Estoque como soma de movimentações, não como número fixo

Para evitar que a sincronização offline dependa de alguém "resolver
conflito" manualmente (o que não é realista dado o perfil dos usuários), o
sistema **nunca sobrescreve o estoque diretamente**. Cada entrada, saída ou
ajuste é um registro imutável (o que aconteceu, quando, e por quem). O
estoque atual de um produto é sempre **calculado somando todas as suas
movimentações**.

Consequência prática: quando o celular do funcionário sincroniza com o
computador do admin, os lançamentos de cada um só se somam à mesma linha do
tempo — não existe "por cima de quem" a sincronização vai escrever, então não
há conflito de sobrescrita para resolver. Isso também resolve a rastreabilidade
de investimentos (pedida no problema original), porque toda movimentação já
fica registrada com valor.

_Limite dessa abordagem:_ ela evita conflito de **sobrescrita**, mas não
impede que dois lançamentos deixem o estoque negativo (ex: os dois registram
saída do mesmo produto sem saber da venda um do outro). Isso vira um alerta
no dashboard do admin, não um erro travado na tela do funcionário — o
funcionário nunca deve ficar bloqueado por causa de sincronização.

### 5.3 Sincronização e hospedagem: self-host em VPS gratuita

O ponto de encontro entre o celular do funcionário e o computador do admin
(onde as movimentações sincronizam) roda em um **back-end próprio,
self-hosted pelo desenvolvedor** numa **VPS de camada "sempre grátis"** (ex:
Oracle Cloud Free Tier — oferta permanente, não é trial). O risco de
manutenção que existiria se o _cliente_ precisasse cuidar de um servidor não
se aplica aqui, porque quem hospeda e mantém é o próprio desenvolvedor, não a
Casa do Campo.

Nessa VPS roda uma API simples que recebe as movimentações de cada
dispositivo quando há internet e guarda tudo em um banco (Postgres ou
SQLite) controlado inteiramente pelo desenvolvedor — sem depender de SDK ou
limites de uso de um provedor de BaaS gerenciado (Supabase/Firebase). Isso dá
dois benefícios sobre a opção de BaaS gerenciado descartada antes: custo
permanece zero sem depender da política de terceiro, e o código do back-end
pode ser movido para outra VPS gratuita ou paga no futuro sem reescrever a
aplicação, já que é código próprio.

## 6. Escopo — MVP (entregar primeiro)

Prioridade: **o quanto antes**, entregando valor incremental. O que segue é o
recorte mínimo que já resolve o problema central (falta de controle e
rastreabilidade):

**Cadastros**

- Produto (nome, categoria, unidade — kg/L, estoque mínimo, valor)
- Categoria

**Movimentação de estoque**

- Entrada (compra, devolução) — quantidade e valor
- Saída (venda, perda, uso interno) — quantidade e valor
- Ajuste manual (inventário/contagem)

**Painel administrativo**

- Dashboard com indicadores (estoque total, giro, alertas)
- Alerta de estoque mínimo
- Relatório de produtos mais/menos movimentados
- Relatório de valor total em estoque
- Histórico/auditoria de alterações (quem fez o quê e quando)

**Acesso**

- Login individual por usuário, 2 perfis (funcionário / admin)
- Backup automático dos dados

## 7. Fora do escopo do MVP (fica para depois)

- QR Code ou qualquer identificação além de busca por texto
- Fotos de produto
- Alertas de validade/vencimento
- Múltiplas lojas/depósitos e transferência entre elas
- Cadastro de clientes e fornecedores
- Emissão de nota fiscal
- Integração com PDV, contabilidade ou e-commerce
- Autenticação em duas etapas (2FA)

## 8. Riscos conhecidos

| Risco                                                                                                                      | Impacto                                                                                                         | Mitigação prevista                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Estoque negativo por lançamentos offline conflitantes                                                                      | Relatório de estoque impreciso até o admin revisar                                                              | Alerta no dashboard, nunca bloqueio pro funcionário                                                                |
| Baixa maturidade digital gera erro de digitação (quantidade/valor)                                                         | Dados incorretos no histórico                                                                                   | Interface mínima, poucos campos, confirmação visual simples antes de salvar                                        |
| Prazo "o quanto antes" pode pressionar qualidade do MVP                                                                    | Retrabalho depois                                                                                               | Escopo do MVP já enxuto e fechado na seção 6                                                                       |
| VPS gratuita é mantida por uma única pessoa (o desenvolvedor); queda ou perda de acesso à conta interrompe a sincronização | Funcionário e admin continuam operando localmente (SQLite), mas param de trocar dados entre si até a VPS voltar | Local-first já é a base do design (seção 4); sincronização é conveniência, não dependência para o uso do dia a dia |

## 9. detalhes descritivos:

- Endereço/nº de lojas da Casa do Campo: apenas 1
- identidade visual (logo/cores: cores azul céu, verde claro, + liberdade total, preferencialmente cores claras)
