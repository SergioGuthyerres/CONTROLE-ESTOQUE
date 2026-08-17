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

**b) No firewall de dentro da máquina.** Conecte via SSH:

```bash
ssh -i sua-chave.key ubuntu@IP-DA-INSTANCIA
```

E rode:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

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
# Pacotes básicos e Node 20
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Caddy (o servidor web que cuida do HTTPS sozinho)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
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

> **Não rode `npm run seed` no servidor.** Ele cria os usuários de exemplo
> `admin/admin123` e `funcionario/func123`, que estão publicados no README deste
> repositório público. O script se recusa a rodar com `NODE_ENV=production`
> justamente por isso.

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
sudo systemctl reload caddy
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

No painel do Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**,
escolha o repositório e configure:

| Campo | Valor |
|---|---|
| Framework preset | None |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |

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
`estoque-casa-do-campo.pages.dev`), volte ao servidor e coloque-a em
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
```

Rode uma vez à mão para conferir que funciona, sem esperar até as 3h:

```bash
cd /opt/estoque/backend
sudo -u estoque bash -c 'set -a && . /etc/estoque/api.env && set +a && node dist/scripts/backup.js'
ls -lh /var/backups/estoque
```

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
- [ ] `npm run seed` **nunca** executado no servidor
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
| Caddy não emite certificado | Domínio ainda não aponta para o IP, ou porta 80 fechada (o desafio do Let's Encrypt usa a 80). |
| API não sobe | `sudo journalctl -u estoque-api -n 50`. Erro de `.env` sai com o nome da variável. |
| `npm run build` morre com "Killed" | Falta de memória no shape de 1 GB. Criar o swap da etapa 2. |
| Comando `apt` não existe no servidor | A instância subiu com Oracle Linux em vez de Ubuntu. Recriar escolhendo Canonical Ubuntu em *Change image*. |
| "Muitas tentativas de login" | Rate limit. Espere 15 minutos ou aumente `LOGIN_MAX_TENTATIVAS`. |
| Login diz "sessão encerrada" sem motivo | A senha foi trocada ou o acesso resetado em outro lugar — todos os aparelhos caem por design. |
| Backup falha com "unable to open database" | `DATABASE_URL` com caminho relativo. Em produção precisa ser absoluto. |
