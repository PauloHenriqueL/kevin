# Roteiro de apresentação para o cliente (Bebelingue)

> Guia passo a passo para demonstrar o Kevin com as atualizações desta fase.
> Duração alvo: **~20 minutos**. Cada passo diz **onde clicar**, **o que falar**
> e **o que destacar**.

---

## Antes de começar (preparação)

```bash
docker compose up -d
docker compose exec web python manage.py migrate
docker compose exec web python manage.py seed_demo
```

Abra **http://localhost:8000** e deixe estas abas prontas (ou use uma janela
anônima por login para trocar de papel rápido):

| Papel | Login | Senha | Para mostrar |
|---|---|---|---|
| Coordenador | `coord` | `coord123` | Como a Bebelingue cadastra o TG |
| Professora 5A | `maria` | `prof123` | A aula com o Kevin (turma **adiantada**) |
| Professor 5B | `joao` | `prof123` | Turma **atrasada**, frequência 4x |
| Diretor | `carlos` | `dir123` | Relatórios de progresso |
| Admin | `admin` | `admin123` | Django admin (bastidor técnico) |

> **Dica:** teste o roteiro uma vez sozinho antes. Se a internet da IA estiver
> sem chave, o chat entra em modo demo (respostas locais) — a animação funciona
> mesmo assim.

---

## A mensagem central (diga isto no início — 1 min)

> "Na primeira versão, o Kevin refletia o que *eu imaginei* que a metodologia de
> vocês fosse. Agora, depois de estudar o TG, o Class Feedback e a prova de
> vocês, o sistema reflete **como vocês realmente trabalham**: o TG organizado
> por mês, os jogos e técnicas de vocês como peças reutilizáveis, e o Kevin
> sabendo conduzir cada uma. Vou mostrar."

---

## Parte 1 — O currículo agora é o TG de vocês (5 min)

**Papel: Coordenador (`coord` / `coord123`) → vai para `/admin/`**

### 1.1 A grade de Março
1. No admin, abra **Curriculo → Aulas (TG)**.
2. **Destaque:** as 12 aulas de Março, com o código no formato **`Y5-MAR-W1C1`** —
   *"é o mesmo endereçamento do arquivo de vocês: mês, semana, aula."*
3. Aponte a coluna **tipo**: Content, Communication, Culture — *"o sistema sabe
   que tipo de aula é cada uma."*

### 1.2 Uma aula por dentro
1. Clique na aula **`Y5-MAR-W1C1` — Share It! — Daily Routines**.
2. **Destaque os blocos** (Warm Up / Development / Closure): *"o roteiro não é um
   texto solto — é uma sequência de blocos, cada um ligado a uma atividade do
   catálogo de vocês."*
3. Mostre que o bloco 1 do Warm Up é **BeCalendar**, o 2 é **Songs Collection** —
   *"as rotinas fixas de vocês."*

### 1.3 O catálogo — o que faz o Kevin "saber" a atividade
1. Abra **Curriculo → Atividades (catálogo)**.
2. **Destaque:** os jogos (Simon Says, Hangman…), técnicas (Sandwich, Instant
   Translation), rotinas (BeCalendar). *"Cada um é cadastrado uma vez e
   reutilizado em quantas aulas quiserem."*
3. Abra **Simon Says** e mostre o campo **"Como conduzir"**: *"É isto que o Kevin
   lê. Ele não inventa a regra — ele usa a de vocês."*
4. Aponte a coluna **"Kevin sabe conduzir?"** — o indicador verde.

> **Pergunta que vai surgir:** "de onde vêm essas regras?" → Resposta: do
> **Games Bank** e do **BeBooklet** no início do TG. *"Quando vocês nos
> enviarem, populamos o catálogo oficial com o texto de vocês."*

---

## Parte 2 — A aula com o Kevin (o telão) (6 min)

**Papel: Professora Maria (`maria` / `prof123`)**

### 2.1 Navegação do dia a dia
1. Entre em **Year 5 → Turma 5A**.
2. **Destaque:** a lista de aulas com status (concluídas, atual). *"A Maria está
   adiantada — já deu 7 aulas."*
3. Abra a aula **`Y5-MAR-W1C1`**.

### 2.2 O telão
1. **Destaque a tela cheia:** o Kevin grande, no cenário de **quarto** (*"o fundo
   combina com o vocabulário: daily routines acontece no quarto"*).
2. Aponte os controles: **Falar**, **Conversa ao vivo**, e o botão novo de
   **Música**.
3. Clique em **"Iniciar aula"**: *"o Kevin recebe a turma com uma mensagem de
   abertura que muda conforme a aula."*
4. **Clique em Música** 🎵 — *"o Kevin pega o ukulele e canta."* Deixe a animação
   rodar alguns segundos. Depois clique de novo para parar.

### 2.3 O Kevin conhecendo o roteiro (se houver chave de IA)
1. Abra o chat (botão no canto) e pergunte: *"Kevin, como começo esta aula?"*
2. **Destaque:** a resposta segue o roteiro real da aula — começa pelo BeCalendar,
   na ordem dos blocos. *"Ele não está improvisando; está lendo o TG de vocês."*

> **Se não houver chave de IA:** explique que em produção o Kevin responde de
> verdade, e mostre o roteiro no "Material da aula" (menu recolhível) para provar
> que a estrutura está lá.

### 2.4 Concluir a aula
1. Clique em **Concluir**. *"Um clique — o sistema registra a data e o professor
   automaticamente. Presença é opcional, pra não atrapalhar no meio da aula."*

---

## Parte 3 — Busca no catálogo (2 min)

**Ainda como Maria**

1. Vá em **Biblioteca** (menu do topo).
2. **Destaque:** *"lembram que o professor fazia Ctrl+F no PDF? Agora ele busca
   aqui."* Digite **`fruits`** ou **`movimento`**.
3. Aponte os filtros: **tipo** e **origem** (Bebelingue vs. da escola).
4. Aponte o badge **"Usado em N aulas"**: *"o professor vê onde cada atividade é
   usada — útil quando falta conteúdo numa aula."*
5. Filtre por **origem = Da minha escola** e mostre o **"Quiz do Bernoulli"**:
   *"o professor pode criar atividades locais, que só a escola dele vê — a
   metodologia oficial de vocês fica protegida."*

---

## Parte 4 — A visão do gestor (3 min)

**Papel: Diretor Carlos (`carlos` / `dir123`)**

1. Entre em **`/gestao/`** — o dashboard da escola.
2. Vá em **Relatórios → Progresso**.
3. **Destaque o contraste:** a **Turma 5A** está com ~58% do currículo; a
   **5B** com ~23%. *"O diretor enxerga de relance qual turma está atrasada."*
4. Mencione: *"e as métricas principais são do professor — foi o que vocês
   pediram. A parte de acompanhamento mensal (o RMP) e o Yearly Plan entram
   quando vocês nos mandarem os modelos."*

---

## Parte 5 — O que mudou nos bastidores (2 min, opcional)

Se o público for técnico ou perguntarem "e o que mais mudou":

- **Frequência 3x/4x/5x:** mostre (como admin ou coord) que a **Turma 5B (4x)**
  tem uma aula a mais que a 5A (3x) — a Communication Class extra. *"Um TG só,
  não três — o de 4x é o de 3x mais uma aula."*
- **Papéis:** existe agora o papel de **Coordenador Bebelingue**, separado do
  diretor da escola.
- **Aluno:** não cadastramos aluno por nome — só quantidade e presença, como
  vocês trabalham.

---

## Fecho (1 min)

> "Resumindo o que mudou: o currículo agora é o **TG de vocês**, os jogos e
> técnicas são **peças reutilizáveis** que o Kevin conhece, o professor **busca**
> em vez de folhear PDF, e o Kevin ganhou **vida** — canta, dorme, reage. O que
> falta pra completar depende de vocês: o **TG completo** com o Games Bank e o
> BeBooklet, e os modelos de **RMP** e **Yearly Plan**."

Puxe a lista de pendências de `docs/PERGUNTAS_REUNIAO_CLIENTE.md` (quadro do topo)
para combinar os próximos passos.

---

## Se algo der errado (plano B)

| Problema | Saída |
|---|---|
| Kevin não aparece (tela vazia) | O SVG é grande (~7MB); espere ~5s. Se não vier, recarregue |
| Chat não responde | Sem chave de IA — diga que em produção responde; mostre o roteiro no "Material da aula" |
| Áudio/TTS não toca | Normal sem chave; a animação toca sem som |
| Quer reiniciar os dados | `docker compose exec web python manage.py flush --no-input && python manage.py seed_demo` |

---

## Checklist rápido (imprima ou deixe ao lado)

- [ ] `seed_demo` rodado, app no ar em localhost:8000
- [ ] 5 logins testados
- [ ] **P1** Coordenador: grade de Março + catálogo + "Como conduzir"
- [ ] **P2** Maria: telão + Música + Concluir
- [ ] **P3** Busca: fruits + filtros + Quiz do Bernoulli
- [ ] **P4** Carlos: relatório 5A vs 5B
- [ ] **Fecho:** pedir TG completo, RMP e Yearly Plan
