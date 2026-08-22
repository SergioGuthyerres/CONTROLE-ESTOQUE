# Colocando o sistema em produção

Guia completo, do zero até o funcionário conseguir instalar o app no celular.
Backend numa VPS Oracle Cloud "Always Free", PWA no Cloudflare Pages — ambos
dentro do custo zero exigido pelo RNF04.

Leia a seção [Antes de começar](#antes-de-começar) inteira antes de digitar o
primeiro comando. O resto é sequencial: fazer fora de ordem costuma dar erro
difícil de entender.

---

## Antes de começar

Você vai precisar de três coisas, nesta ordem:

1. **Conta na Oracle Cloud** (cartão de crédito é pedido para verificação, mas
   os recursos "Always Free" não são cobrados). Alternativa: qualquer VPS que
   você já tenha — os passos são os mesmos a partir da seção 2.
2. **Um domínio apontando para o servidor.** Sem domínio não há certificado
   HTTPS, e sem HTTPS o app não funciona no celular — um site HTTPS não pode
   chamar uma API em HTTP puro, o navegador bloqueia. Duas saídas:
   - **Gratuita:** [DuckDNS](https://www.duckdns.org) — cria algo como
     `casadocampo.duckdns.org` de graça em dois minutos.
   - **Paga (~R$ 40/ano):** um domínio `.com.br` de verdade, se o cliente
     quiser um endereço com a marca dele.
3. **Conta no Cloudflare** (gratuita) para publicar o PWA.

Ao longo do guia, substitua:

| Escrito assim | Pelo seu valor |
|---|---|
| `api.SEU-DOMINIO.com` | o domínio da API (ex: `casadocampo.duckdns.org`) |
| `SEU-USUARIO` | seu usuário do GitHub |
| `dona.maria` | o nome de usuário real do dono da loja |

---

## 1. Criar a VPS na Oracle Cloud

No painel da Oracle: **Compute → Instances → Create instance**.

O assistente tem 5 etapas: *Basic information*, *Security*, *Networking*,
*Storage* e *Review*.

### Etapa 1 — Basic information

- **Image:** o padrão é **Oracle Linux**, não Ubuntu. Clique em **Change image**
  e escolha **Canonical Ubuntu 22.04** ou **24.04**. Confirme na tela de review
  antes de criar: todos os comandos deste guia usam `apt`, que não existe no
  Oracle Linux.
- **Shape:** clique em **Change shape**.
  - **Preferido:** `VM.Standard.A1.Flex` (ARM) com **1 OCPU e 6 GB**. Desde
    15/06/2026 a cota Always Free de ARM caiu de 4 OCPU/24 GB para **2 OCPU/12 GB**
    — 1 OCPU e 6 GB continua bem dentro do gratuito.
  - **Se der "Out of capacity"** (comum no A1): use `VM.Standard.E2.1.Micro`,
    que é Always Free e sempre tem vaga, mas tem só **1 GB de RAM**. Com 1 GB o
    `npm run build` costuma ser morto por falta de memória — a etapa 2 deste
    guia cria um arquivo de swap que resolve.

### Etapa 2 — Security

Pode deixar **Shielded instance** ligado (Secure Boot + Measured Boot + TPM);
as imagens do Ubuntu suportam. Se o console reclamar de incompatibilidade com o
shape escolhido, desligue — não é necessário para o funcionamento do sistema.

### Etapa 3 — Networking

Esta etapa costuma aparecer com erro no primeiro acesso porque ainda não existe
rede nenhuma na conta. Preencha assim:

- **VNIC name:** qualquer nome, ex: `estoque-vnic`
- **Primary network:** marque **Create new virtual cloud network**
- **Subnet:** marque **Create new public subnet** — precisa ser *public*, senão
  a máquina não recebe IP acessível pela internet
- **Public IPv4 address assignment:** **Automatically assign public IPv4 address**
  (o aviso "You must select a public subnet" some assim que a sub-rede pública
  for criada)
- **IPv6:** não precisa

Ainda nesta etapa, em **Advanced options → Add SSH keys**, escolha **Generate a
key pair for me** e clique em **Download private key**. Essa é a única vez em
que a chave é oferecida — sem ela não há como entrar no servidor. Guarde junto
com as senhas do projeto.

No Linux/macOS, ajuste a permissão antes de usar, senão o SSH recusa a chave:

```bash
chmod 600 ~/Downloads/ssh-key-*.key
```

### Etapas 4 e 5 — Storage e Review

Storage pode ficar no padrão (o boot volume de ~50 GB está no Always Free).
Em Review, confira **imagem = Ubuntu** e **shape Always Free-eligible** antes de
clicar em *Create*.

### Depois de criada

**Libere as portas 80 e 443 em dois lugares** —
esta é a pegadinha clássica da Oracle, e quem esquece passa horas achando que o
Caddy está quebrado:

**a) Na rede virtual (painel da Oracle):** Networking → Virtual Cloud Networks →
sua VCN → Security Lists → Default → Add Ingress Rules. Adicione duas regras
com Source `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `80` e `443`.

**b) No firewall de dentro da máquina.** Primeiro conecte via SSH, **do seu
computador**:

```bash
chmod 600 ssh-key-*.key                       # só precisa na primeira vez
ssh -i ssh-key-*.key ubuntu@IP-PUBLICO-DA-INSTANCIA
```

> **Use o IP público, não o privado.** Na página da instância aparecem dois
> endereços. O **Private IPv4** começa com `10.` e só funciona dentro da rede
> virtual da Oracle — tentar SSH nele dá "Operation timed out". O que você quer
> é o **Public IPv4 address**, na seção *Instance access* / *Primary VNIC*.
>
> Se o campo Public IPv4 estiver vazio ou com `-`, a sub-rede criada foi privada
> em vez de pública. O caminho mais rápido é apagar a instância e criar de novo
> marcando **Create new public subnet** na etapa de Networking.

Só **depois que o SSH conectar** (o prompt vira `ubuntu@nome-da-maquina:~$`) é
que os comandos abaixo fazem sentido — eles rodam dentro do servidor Ubuntu,
não no seu computador. Num Mac eles nem existem (`iptables: command not found`):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Daqui em diante, **todo comando do guia roda dentro do servidor**, via SSH — a
única exceção é o `rsync` de backup da seção 8, que é explicitamente marcado
como "do seu próprio computador".

Por fim, aponte o domínio para o IP público da instância (no DuckDNS, é só colar
o IP no campo do subdomínio). Confirme antes de seguir:

```bash
ping api.SEU-DOMINIO.com     # precisa responder com o IP da sua instância
```

---

## 2. Preparar o servidor

Ainda por SSH, tudo em sequência.

**Se você usou o shape `E2.1.Micro` (1 GB de RAM), crie o swap antes de
qualquer outra coisa.** Sem ele, o `npm run build` da etapa 3 é morto pelo
sistema no meio da compilação, com um erro de "Killed" que não explica nada:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h        # deve mostrar 2 GB em "Swap"
```

Em seguida, para qualquer shape:

```bash
# Pacotes básicos
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl

# Node 20 pelo repositório da NodeSource. O script é baixado para um arquivo
# antes de rodar, em vez de "curl | bash": se o download falhar, o erro
# aparece, em vez de o bash receber um texto vazio e não fazer nada.
curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs

# Caddy (o servidor web que cuida do HTTPS sozinho)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

**Confira antes de seguir** — este é o ponto onde o deploy costuma descarrilar
sem avisar:

```bash
node -v      # precisa ser v20.x — se aparecer v18, o repositório da
             # NodeSource não foi aplicado e você está com o pacote do Ubuntu
npm -v       # precisa responder algo; o pacote "nodejs" do Ubuntu NÃO traz npm
caddy version
```

Se `node -v` mostrar v18 ou `npm` não existir, remova o pacote do Ubuntu e
repita a instalação da NodeSource:

```bash
sudo apt remove -y nodejs npm libnode-dev
sudo apt autoremove -y
curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
```

Crie o usuário que vai rodar a API. Ele não tem shell nem sudo: se a API for
invadida, o invasor entra como esse usuário e não consegue fazer nada no resto
da máquina.

```bash
sudo useradd --system --home /opt/estoque --shell /usr/sbin/nologin estoque
sudo mkdir -p /opt/estoque /var/backups/estoque /etc/estoque
sudo chown -R estoque:estoque /opt/estoque /var/backups/estoque
sudo chmod 700 /var/backups/estoque
```

---

## 3. Instalar o código

```bash
sudo -u estoque git clone https://github.com/SEU-USUARIO/CONTROLE-ESTOQUE.git /opt/estoque
cd /opt/estoque/backend
sudo -u estoque npm ci
```

> É `npm ci` completo, e não `npm ci --omit=dev`: o compilador do TypeScript e
> o CLI do Prisma são dependências de desenvolvimento, e sem eles não dá para
> compilar nem aplicar migrations no servidor. Quem roda em produção é o
> JavaScript já compilado em `dist/` (ver o `ExecStart` do serviço systemd).

Agora o arquivo de configuração. **É o passo mais importante do guia** — é aqui
que nascem as chaves privadas que substituem os valores de exemplo do
repositório:

```bash
sudo cp /opt/estoque/deploy/api.env.example /etc/estoque/api.env

# Gere o segredo do JWT AGORA, nesta máquina, e não reaproveite de lugar nenhum
openssl rand -base64 48
```

Copie o resultado e edite o arquivo:

```bash
sudo nano /etc/estoque/api.env
```

Preencha `JWT_SECRET` com o valor gerado e `FRONTEND_URL` com o endereço que o
Cloudflare Pages vai dar (você volta aqui na etapa 6 para ajustar, se ainda não
souber). Depois, tranque o arquivo:

```bash
sudo chown estoque:estoque /etc/estoque/api.env
sudo chmod 600 /etc/estoque/api.env
```

> Quem lê esse arquivo consegue emitir um token de administrador válido sem
> saber senha nenhuma. Ele nunca vai para o Git e nunca fica dentro da pasta do
> código. A API se recusa a iniciar se o `JWT_SECRET` for curto ou ainda for o
> texto de exemplo.

Compile e crie o banco:

```bash
cd /opt/estoque/backend
sudo -u estoque npm run build
sudo -u estoque bash -c 'set -a && . /etc/estoque/api.env && set +a && npx prisma migrate deploy'
```

> **Não rode `npm run seed:dev` no servidor.** Ele cria usuários de exemplo
> que não deveriam existir no banco da loja, com senhas que ficam num
> terminal. O script se recusa a rodar com `NODE_ENV=production` justamente
> por isso — o usuário dos donos é criado pelo passo 4, abaixo.

---

## 4. Criar o usuário dos donos

```bash
cd /opt/estoque/backend
sudo -u estoque bash -c 'set -a && . /etc/estoque/api.env && set +a && node dist/scripts/criarAdmin.js --nome dona.maria'
```

O comando pede a senha duas vezes, sem mostrar na tela. Regras:

- mínimo de 10 caracteres;
- nomes genéricos (`admin`, `root`, `administrador`) são recusados — são os
  primeiros que qualquer ataque automatizado tenta;
- senhas conhecidas e as senhas de exemplo deste repositório são recusadas.

Uma frase é melhor que uma palavra complicada: `cachorro azul na varanda` é mais
difícil de quebrar que `Xk9$mP2` e não acaba anotada num papel colado no monitor.

**Se o dono estiver junto, deixe que ele mesmo digite.** Assim ninguém além dele
conhece a senha — nem você. Se ele não estiver, use a variante que gera uma senha
aleatória e a mostra uma única vez; o sistema vai obrigá-lo a trocar no primeiro
acesso:

```bash
sudo -u estoque bash -c '... node dist/scripts/criarAdmin.js --nome dona.maria --gerar-senha'
```

Os demais usuários (funcionários, segundo dono) são criados depois pelo próprio
app, em **Painel → Usuários** — sem precisar voltar ao servidor.

---

## 5. Subir a API e o HTTPS

```bash
sudo cp /opt/estoque/deploy/estoque-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now estoque-api
sudo systemctl status estoque-api        # precisa aparecer "active (running)"
```

Se não subir, o motivo aparece em `sudo journalctl -u estoque-api -n 50`. Erro
de configuração no `.env` é mostrado com o nome exato da variável.

Agora o Caddy:

```bash
sudo cp /opt/estoque/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile     # trocar api.SEU-DOMINIO.com pelo domínio real

# Confere a sintaxe ANTES de aplicar. Sem isto, o "reload" falha com uma
# mensagem genérica e o motivo real fica escondido no journalctl.
sudo caddy validate --config /etc/caddy/Caddyfile

sudo systemctl reload caddy
```

Se o `validate` apontar erro, ele diz a linha exata. Se o `reload` falhar mesmo
com a sintaxe válida, o motivo aparece em:

```bash
sudo journalctl -xeu caddy.service | tail -30
```

Teste de fora do servidor, do seu próprio computador:

```bash
curl https://api.SEU-DOMINIO.com/health     # esperado: {"ok":true}
```

Se responder com o cadeado válido, o certificado foi emitido — o Caddy faz isso
sozinho e renova sozinho. Confirme também que a porta 3000 **não** responde
diretamente (a API só escuta em `127.0.0.1`):

```bash
curl http://IP-DA-INSTANCIA:3000/health    # esperado: falhar/timeout
```

---

## 6. Publicar o PWA no Cloudflare Pages

O Cloudflare removeu do painel o fluxo antigo de criar projeto "Pages" — hoje
só existe **Create an application**, que cria um Worker. O caminho do Worker
tenta aplicar o plugin Vite da Cloudflare, que exige Vite 6+ e falha o deploy
com *"The version of Vite used in the project cannot be automatically
configured"*.

A saída é `frontend/wrangler.jsonc`, já no repositório: ele declara o projeto
como **assets estáticos puros**, sem Worker nenhum rodando. Assim o plugin Vite
não entra na jogada, a versão do Vite deixa de importar, e o `_headers` gerado
no build continua valendo.

No painel: **Workers & Pages → Create an application → Connect to Git**,
escolha o repositório e configure:

| Campo | Valor |
|---|---|
| Root directory | `frontend` (sem barra na frente — `/frontend` faz o build rodar na raiz do repositório e falhar com `Could not read package.json`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

O campo `name` em `frontend/wrangler.jsonc` precisa ser **exatamente** o nome
do Worker criado no painel (hoje: `controle-estoque`). Se não bater, o deploy
não falha — ele cria um Worker novo, e o app que os donos usam fica parado na
versão antiga sem nenhum erro para avisar.

Em **Settings → Environment variables**, adicione (para Production **e** Preview):

```
VITE_API_URL = https://api.SEU-DOMINIO.com
```

Essa variável não é um segredo — ela é embutida no app e qualquer pessoa
consegue vê-la. É só o endereço público da API, e é assim mesmo que deve ser.
O build usa esse valor para gerar os cabeçalhos de segurança (`dist/_headers`),
inclusive a política que impede o app de mandar dados para qualquer outro
servidor. Se a variável faltar, o build falha de propósito.

Anote a URL que o Cloudflare gerar (algo como
`controle-estoque.SEU-SUBDOMINIO.workers.dev`), volte ao servidor e coloque-a em
`FRONTEND_URL`:

```bash
sudo nano /etc/estoque/api.env
sudo systemctl restart estoque-api
```

> Se esquecer este passo, o app abre no celular mas nenhuma tela carrega dado
> nenhum: o navegador bloqueia por CORS. É o sintoma mais comum aqui.

---

## 7. Primeiro acesso e criação dos funcionários

1. Abra a URL do Pages no celular, entre com o usuário do dono.
2. **Painel → Usuários → Novo usuário.** Crie a conta do funcionário.
3. O sistema mostra uma **senha provisória, uma única vez**. Anote e entregue à
   pessoa — o servidor guarda só o hash, ninguém consegue recuperá-la depois.
   Se perder, é só clicar em "Resetar senha".
4. No primeiro acesso do funcionário, o sistema exige que ele escolha a própria
   senha antes de liberar qualquer tela. Enquanto ele não trocar, a conta não
   faz nada além disso.
5. Instale o app: no Android, o Chrome oferece "Instalar aplicativo"; no iPhone,
   Safari → Compartilhar → "Adicionar à Tela de Início".

Quando alguém sair da empresa ou perder o celular, use **Desativar acesso** na
mesma tela. O acesso cai na hora, em todos os aparelhos, sem apagar o histórico
de movimentações da pessoa (o registro é de auditoria e nunca é apagado).

---

## 8. Backup

```bash
sudo cp /opt/estoque/deploy/backup.cron /etc/cron.d/estoque-backup
sudo chmod 644 /etc/cron.d/estoque-backup

# O arquivo de log precisa existir e pertencer ao usuário "estoque": /var/log
# é do root, e o cron roda como estoque. Sem isto o redirecionamento ">>"
# falha e leva o backup inteiro junto — silenciosamente, às 3h da manhã.
sudo touch /var/log/estoque-backup.log
sudo chown estoque:estoque /var/log/estoque-backup.log
sudo chmod 640 /var/log/estoque-backup.log
```

Teste a linha exata que o cron vai executar, em vez de esperar as 3h e torcer:

```bash
sudo -u estoque sh -c 'cd /opt/estoque/backend && set -a && . /etc/estoque/api.env && set +a && /usr/bin/node dist/scripts/backup.js >> /var/log/estoque-backup.log 2>&1' && echo "cron OK"
```

Isso reproduz usuário, shell e redirecionamento do cron. Se imprimir `cron OK`,
o agendamento vai funcionar.

Rode uma vez à mão para conferir que funciona, sem esperar até as 3h:

```bash
cd /opt/estoque/backend
sudo -u estoque bash -c 'set -a && . /etc/estoque/api.env && set +a && node dist/scripts/backup.js'
sudo ls -lh /var/backups/estoque     # sudo: a pasta é 700 do usuário estoque
```

E confirme que o arquivo gerado é um banco íntegro, não um arquivo truncado:

```bash
sudo apt install -y sqlite3
sudo -u estoque sh -c 'sqlite3 "$(ls -t /var/backups/estoque/*.db | head -1)" "PRAGMA integrity_check; SELECT count(*) FROM Usuario;"'
```

Esperado: `ok` seguido do número de usuários cadastrados. Isso prova que o
backup abre e tem dados — bem mais do que confirmar que o arquivo existe.

O script mantém os 30 backups mais recentes e apaga os antigos — sem isso o
disco enche e a API para de conseguir escrever.

**Um backup que só existe na mesma máquina do banco não protege contra a VPS
sumir**, que é justamente o cenário em que se precisa de backup. Configure uma
cópia para fora. O jeito mais simples é do seu próprio computador, uma vez por
semana:

```bash
rsync -avz -e "ssh -i sua-chave.key" \
  ubuntu@IP-DA-INSTANCIA:/var/backups/estoque/ ~/backups-casa-do-campo/
```

Esses arquivos contêm todo o histórico da loja e os hashes de senha. Guarde-os
num lugar que só você acesse.

**Testar a restauração vale mais que fazer o backup.** Uma vez, faça o teste:
copie um arquivo de backup para um computador, aponte `DATABASE_URL` para ele e
suba a API localmente. Backup nunca testado é backup que costuma falhar no dia.

---

## 8b. Limpar os dados de teste antes de entregar

Depois de testar a aplicação com produtos e lançamentos inventados, o banco
precisa ir zerado para o cliente — mas sem perder os usuários já criados (senão
você refaz o `criar-admin` e redistribui as senhas dos funcionários).

```bash
cd /opt/estoque/backend

# 1. Mostra o que seria apagado, sem apagar nada
sudo -u estoque bash -c 'set -a && . /etc/estoque/api.env && set +a && node dist/scripts/limparDados.js'

# 2. Confirmado o que aparece acima, executa
sudo -u estoque bash -c 'set -a && . /etc/estoque/api.env && set +a && node dist/scripts/limparDados.js --confirmar'
```

O comando apaga movimentações, produtos e categorias, e preserva os usuários
com senhas e perfis intactos. Ele **grava um backup antes** de apagar qualquer
coisa; se o backup falhar, nada é apagado.

Depois de limpar, **em cada celular que já usou o app, saia e entre de novo**.
O PWA guarda um cache local do catálogo (RNF02, para funcionar offline) e
continuaria mostrando os produtos de teste até a próxima sincronização.

---

## 9. Atualizando o sistema depois

O PWA atualiza sozinho: um `git push` na branch principal dispara o build no
Cloudflare Pages e o app se atualiza no celular na próxima abertura.

A API é manual:

```bash
cd /opt/estoque
sudo -u estoque git pull
cd backend
sudo -u estoque npm ci
sudo -u estoque npm run build
sudo -u estoque bash -c 'set -a && . /etc/estoque/api.env && set +a && npx prisma migrate deploy'
sudo systemctl restart estoque-api
```

Faça um backup antes de qualquer atualização que mexa no banco.

---

## Checklist de segurança

Antes de considerar o sistema entregue:

- [ ] `JWT_SECRET` gerado com `openssl rand -base64 48`, só no servidor
- [ ] `/etc/estoque/api.env` com permissão `600` e dono `estoque`
- [ ] `npm run seed:dev` **nunca** executado no servidor
- [ ] Nenhum usuário chamado `admin` ou `funcionario` existe em produção
- [ ] `https://api.SEU-DOMINIO.com/health` responde com cadeado válido
- [ ] `http://IP:3000/health` **não** responde de fora
- [ ] `FRONTEND_URL` preenchido com o domínio real do PWA
- [ ] `TRUST_PROXY=true` no `.env` de produção
- [ ] Cron de backup instalado e testado à mão pelo menos uma vez
- [ ] Cópia dos backups saindo da VPS
- [ ] Dono trocou a senha provisória, se foi criada com `--gerar-senha`
- [ ] Funcionário instalou o PWA e conseguiu registrar uma saída de estoque

---

## Quando algo dá errado

| Sintoma | Causa quase sempre |
|---|---|
| App abre mas nenhuma tela carrega dados | `FRONTEND_URL` não bate com o domínio do Pages (erro de CORS). Ver o console do navegador. |
| `curl https://.../health` não conecta | Portas 80/443 liberadas só na Oracle **ou** só no `iptables` — precisa dos dois. |
| SSH dá "Operation timed out" | Você usou o IP privado (`10.x.x.x`). Pegue o **Public IPv4** na página da instância. |
| `sudo: iptables: command not found` | O comando foi rodado no seu Mac. Ele roda dentro do servidor, depois do SSH conectar. |
| SSH recusa a chave ("bad permissions") | `chmod 600` no arquivo `.key` baixado. |
| Caddy não emite certificado | Domínio ainda não aponta para o IP, ou porta 80 fechada (o desafio do Let's Encrypt usa a 80). |
| `systemctl reload caddy` falha | Rodar `sudo caddy validate --config /etc/caddy/Caddyfile`: aponta a linha do erro de sintaxe. |
| `node -v` mostra v18 e falta `npm` | O repositório da NodeSource não foi aplicado e ficou o pacote do Ubuntu, que não traz npm. Ver a seção 2. |
| API não sobe | `sudo journalctl -u estoque-api -n 50`. Erro de `.env` sai com o nome da variável. |
| API morre em loop com pilha do V8 e `signal=TRAP` | `MemoryDenyWriteExecute=true` no serviço systemd. O V8 compila JS para código de máquina e precisa tornar memória executável. Remover a linha. |
| Deploy do PWA falha com `Infinite loop detected in this rule` | Um `public/_redirects` com `/* /index.html 200`. No Workers quem cobre a SPA é o `not_found_handling` do `wrangler.jsonc`; apagar o arquivo. |
| Deploy do PWA falha pedindo Vite 6+ | O projeto foi criado como Worker sem o `frontend/wrangler.jsonc`, e o Cloudflare tentou aplicar o plugin Vite dele. Ver a seção 6. |
| `npm run build` morre com "Killed" | Falta de memória no shape de 1 GB. Criar o swap da etapa 2. |
| Comando `apt` não existe no servidor | A instância subiu com Oracle Linux em vez de Ubuntu. Recriar escolhendo Canonical Ubuntu em *Change image*. |
| "Muitas tentativas de login" | Rate limit. Espere 15 minutos ou aumente `LOGIN_MAX_TENTATIVAS`. |
| Login diz "sessão encerrada" sem motivo | A senha foi trocada ou o acesso resetado em outro lugar — todos os aparelhos caem por design. |
| Backup falha com "unable to open database" | `DATABASE_URL` com caminho relativo. Em produção precisa ser absoluto. |
