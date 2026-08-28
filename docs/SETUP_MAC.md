# Setup do Kevin no Mac — guia para o dev de animação

> Este guia leva você de "acabei de receber o link do projeto" até "o Kevin
> rodando no meu Mac, pronto para eu instalar minhas animações". É pensado para
> quem vai trabalhar na **parte de animação** e conversa com o **Claude Code**
> para integrar os exports.

---

## 0. O que você vai ter no fim

- O sistema Kevin rodando em **http://localhost:8000** no seu Mac.
- Login pronto (admin, professor, coordenador…).
- 4 aulas de demonstração, uma para cada cenário — para você testar as animações.
- O caminho claro de **como instalar um export novo** (via Claude Code).

---

## 1. Pré-requisitos (instalar uma vez)

Você precisa de **duas coisas** no Mac:

### 1.1 Docker Desktop
O sistema roda dentro do Docker — você **não** precisa instalar Python, Postgres
nem nada disso na sua máquina. O Docker cuida de tudo.

1. Baixe em **https://www.docker.com/products/docker-desktop/** (escolha a versão
   do seu chip: **Apple Silicon** para M1/M2/M3, **Intel** para Macs antigos).
2. Instale (arrasta para Applications) e **abra o Docker Desktop**.
3. Espere o ícone da baleia na barra de menu ficar estável (verde). O Docker
   precisa estar **rodando** antes de subir o projeto.

### 1.2 Git
Já vem no Mac na maioria dos casos. Teste no Terminal:
```bash
git --version
```
Se pedir para instalar as "Command Line Tools", aceite. Senão, baixe em
https://git-scm.com/download/mac.

---

## 2. Baixar o projeto

Abra o **Terminal** e rode (troque o caminho se quiser outra pasta):

```bash
cd ~/Documentos
git clone https://github.com/PauloHenriqueL/kevin.git
cd kevin
```

Agora você está dentro da pasta do projeto. Todos os comandos abaixo rodam aqui.

---

## 3. Configurar o ambiente (o arquivo .env)

O projeto precisa de um arquivo `.env` com as configurações. Há um modelo
pronto — copie:

```bash
cp .env.example .env
```

Pronto. Os valores padrão já funcionam para desenvolvimento local (o banco, o
Redis, etc. sobem dentro do Docker). **Não precisa mexer em nada** para começar.

> As chaves de IA (para o chat do Kevin responder de verdade) são opcionais — o
> sistema funciona sem elas, e a **animação funciona independente do chat**.
> Para animação você não precisa de chave nenhuma.

---

## 4. Subir o sistema

Com o Docker Desktop aberto, rode:

```bash
docker compose up -d
```

Isso baixa as imagens e sobe **4 contêineres** (a primeira vez demora alguns
minutos):

| Contêiner | O que é |
|---|---|
| `db` | O banco de dados (PostgreSQL) |
| `redis` | Fila para tarefas assíncronas (chat) |
| `web` | O sistema Django em si (é o principal) |
| `celery` | Processa tarefas em segundo plano |

Espere os 4 subirem. Confira com:
```bash
docker compose ps
```
Todos devem aparecer como `running`.

---

## 5. Preparar o banco e os dados de demonstração

Na primeira vez, crie as tabelas e popule os dados:

```bash
# cria as tabelas do banco
docker compose exec web python manage.py migrate

# popula usuários + 4 aulas de demonstração (uma por cenário)
docker compose exec web python manage.py seed_demo
```

Pronto. Abra **http://localhost:8000** no navegador.

### Logins criados pelo seed

| Papel | Login | Senha | Para quê |
|---|---|---|---|
| Admin | `admin` | `admin123` | Painel técnico (`/admin/`) |
| Coordenador | `coord` | `coord123` | Monta o TG e o catálogo |
| Diretor | `carlos` | `dir123` | Gestão da escola |
| **Professora** | **`maria`** | **`prof123`** | **É aqui que a animação aparece** |
| Professor | `joao` | `prof123` | Turma atrasada (relatórios) |

### As 4 aulas de demonstração (para testar animação)

Entre como **`maria` / `prof123`** → Year 5 → Turma 5A. As 4 aulas cobrem
cenários diferentes:

| Aula | Cenário (background) | O que testa |
|---|---|---|
| Share It! — Daily Routines | floresta | botão de **Música** (Kevin toca ukulele) |
| Listening — A Day in My Life | escola (interior) | botão de **Listening** (toca áudio) |
| Vocabulary — Daily Routines | quarto | cenário quarto |
| Culture — At the Doctor | hospital | cenário hospital |

Abra uma aula → **Iniciar aula** → o Kevin aparece animado no cenário. É essa
tela (`/professor/...`) que renderiza o motor de animação.

---

## 6. Comandos do dia a dia

```bash
docker compose up -d              # sobe tudo
docker compose down               # derruba tudo
docker compose restart web        # reinicia o Django (após mudar código Python)
docker compose logs -f web        # ver os logs (útil quando algo dá erro)
docker compose exec web python manage.py flush --no-input  # zera o banco
docker compose exec web python manage.py seed_demo         # repopula
```

> **Mudou só CSS, JS ou o SVG do Kevin?** Não precisa reiniciar o Docker — só dê
> um **Cmd+Shift+R** no navegador (recarrega ignorando o cache). Mudou código
> Python? Aí sim `docker compose restart web`.

---

## 7. Onde vivem as animações no projeto

Os arquivos do Kevin (o motor + o personagem) ficam em:

```
static/js/kevin-puppet/
├── kevin-rigged.svg          ← o personagem (SVG com as partes nomeadas por id)
├── kevin-puppet.js           ← o motor de animação
├── kevin-puppet.css          ← estilos do puppet
└── assets/
    ├── backgrounds/          ← os cenários (floresta.webp, quarto.webp, …)
    └── videos/               ← vídeos de transição (.webm)
```

**Regra de ouro:** o motor (`kevin-puppet.js`) encontra cada parte do corpo do
Kevin pelos **`id`** do SVG. Se um export renomear esses IDs, o motor quebra.
Por isso o SVG e o JS **andam juntos** e nunca se renomeiam os IDs.

Para entender o motor a fundo: `docs/MOTOR_KEVIN.md`.

---

## 8. Como instalar as suas animações no Kevin (o seu fluxo)

Você trabalha num **projeto de animação separado** (numa pasta sua) e quer levar
o que produziu — novas animações, cenários, sons — para dentro do Kevin. O jeito
recomendado é **conversar com o Claude Code**: você aponta a pasta do seu
projeto e ele integra. O procedimento está documentado no `CLAUDE.md` (seção
"Como INSTALAR um export novo") para o Claude seguir.

**Como pedir ao Claude Code:**

> "Meu projeto de animação está em `~/Documentos/kevin-animacao/`. Vá lá, pegue
> o export mais novo (com as novas animações e os sons ambientes) e instale no
> Kevin. Valida antes de instalar."

O Claude então:

1. **Valida** o export antes de tocar no sistema:
   ```bash
   python3 scripts/validar_export.py <pasta-do-seu-export>/
   ```
   Se der ❌ (IDs faltando, esqueleto visível, background com chão alto), ele
   **te devolve o problema** em vez de instalar quebrado. O contrato completo
   está em `docs/mensagem.md`.

2. **Copia os arquivos** para os lugares certos:
   - `kevin-rigged.svg`, `kevin-puppet.js`, `kevin-puppet.css` →
     `static/js/kevin-puppet/`
   - backgrounds e vídeos → `static/js/kevin-puppet/assets/`

3. **Atualiza o cache-buster** (o `?v=N` no template) para o navegador pegar o
   novo — senão "não muda nada".

4. **Valida no navegador** e te mostra o resultado.

> Você pode apontar tanto uma **pasta** do seu projeto quanto um `export_N.zip`
> extraído — o que importa é o Claude ter acesso ao caminho no seu Mac.

### ⚠️ Sons ambientes — leia antes

O Kevin **hoje ainda não tem um lugar pronto para "sons ambientes"** (ex: som de
floresta no cenário floresta, ruído de hospital no cenário hospital). O que
existe é áudio **por aula** (música e listening).

Então, se o seu export traz sons ambientes, avise o Claude Code — **isso é uma
funcionalidade nova**, não uma simples cópia de arquivo. O que ele vai precisar
fazer (e provavelmente pedir confirmação ao Paulo antes):
- decidir onde o som ambiente se liga: ao **cenário/background** (toca sempre que
  aquele cenário aparece) ou à **aula**;
- criar o campo/modelo para guardar essa referência;
- fazer o motor tocar o áudio em loop quando o cenário entra.

Ou seja: **os arquivos de som você entrega; a "ligação" no sistema é
desenvolvimento novo.** Diga ao Claude "quero que o som X toque no cenário Y" e
ele encaminha — mas não espere que seja só arrastar um arquivo, como é com o SVG.

> **Por que validar antes de tudo?** Os exports costumam chegar com defeitos que
> "funcionam no seu ambiente mas quebram aqui" (esqueleto visível, mãos
> duplicadas, Kevin mal posicionado). O validador pega isso cedo. Os bugs
> conhecidos e suas causas estão no `CLAUDE.md` (seção "Exports de animação").

---

## 9. Se algo der errado

| Sintoma | Causa provável | Solução |
|---|---|---|
| `docker compose up` falha | Docker Desktop não está aberto | Abra o Docker Desktop e espere a baleia ficar verde |
| Página não abre / erro de conexão | Contêineres ainda subindo, ou `web` caiu | `docker compose ps` e `docker compose logs -f web` |
| Site sem CSS / Kevin não aparece | Cache do navegador | **Cmd+Shift+R** |
| "Instalei o export mas não mudou nada" | Cache-buster não foi incrementado | Peça ao Claude para dar bump no `?v=N` do template |
| Porta 8000 ocupada | Outra coisa usando a porta | `docker compose down` e suba de novo, ou libere a porta |

---

## 10. Resumo — do zero ao Kevin animado

```bash
# 1. instalar Docker Desktop e abrir
# 2. baixar e entrar no projeto
git clone https://github.com/PauloHenriqueL/kevin.git && cd kevin
# 3. configurar
cp .env.example .env
# 4. subir
docker compose up -d
# 5. preparar o banco + dados de demo
docker compose exec web python manage.py migrate
docker compose exec web python manage.py seed_demo
# 6. abrir http://localhost:8000  (login: maria / prof123)
```

Bem-vindo ao Kevin! Qualquer dúvida sobre o motor de animação, comece por
`docs/MOTOR_KEVIN.md`; sobre instalar exports, pela seção 8 acima.
