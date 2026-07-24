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
# popula o catálogo com o Games Bank do TG (91 jogos + técnicas):
docker compose exec web python manage.py importar_catalogo_tg "documento_escola/Y5 3x Part 1 .pdf" --sobrescrever
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
> vocês fosse. Agora, depois de estudar o TG completo, o Class Feedback e a prova
> de vocês, o sistema reflete **como vocês realmente trabalham**: o TG endereçado
> por Unit como na apostila, os jogos e técnicas de vocês — que já **importamos
> do TG** — como peças reutilizáveis, e o Kevin sabendo conduzir cada uma. E o
> coordenador de vocês agora tem uma **tela própria** para montar o TG, não mais
> o painel técnico. Vou mostrar."

---

## Parte 1 — A área da coordenação: montar o TG (6 min)

**Papel: Coordenador (`coord` / `coord123`) → agora vai para `/coordenacao/`**

> **A grande novidade desta fase.** Antes o coordenador usava o painel técnico
> (Django admin). Agora tem uma área desenhada para o trabalho dele.

### 1.1 O painel inicial
1. Após o login, mostre o **dashboard**: o retrato do TG (aulas, atividades no
   catálogo, escolas) e o alerta de "atividades sem regra".
2. *"Aqui ele vê o estado do TG num relance."*

### 1.2 A grade do TG — a tela mais importante
1. Clique em **Grade do TG** → escolha **Year 5 → Unit 1**.
2. **Destaque:** a grade **semana × aula**, no mesmo formato do arquivo de vocês.
   *"É a sua grade de papel, virada em tela. Cada célula é uma aula."*
3. Aponte o código **`Y5-U1W1C1`**: *"é o endereçamento da apostila — Unit,
   Week, Class."*
4. Aponte as **cores por tipo** (Content, Communication, Culture, CLIL) e a
   contagem de blocos. Mostre uma **célula vazia**: *"onde falta aula, é só
   clicar para criar."*

### 1.3 O editor de blocos — arrastar e montar
1. Clique numa aula (ex: **Share It! — Daily Routines**).
2. **Destaque as três fases** (Warm Up / Development / Closure) com os blocos.
3. **Arraste um bloco** para outra posição: *"reordenar é arrastar. E salva
   sozinho — sem botão de salvar."*
4. Clique em **+ adicionar**, digite **"Bingo"** no busca: *"ele escolhe a
   atividade do catálogo de vocês por um autocomplete."*

### 1.4 O catálogo — o que faz o Kevin "saber" a atividade
1. Vá em **Catálogo**.
2. **Destaque:** *"91 jogos e as técnicas de vocês — **importados direto do TG
   que vocês nos mandaram**. Não digitamos à mão nem inventamos: é o texto de
   vocês."*
3. Abra **Simon Says** e mostre o **"Como conduzir"**: *"É isto que o Kevin lê.
   Ele não inventa a regra — usa a de vocês."*
4. Aponte o **"usado em N aulas"**: *"antes de mudar uma atividade, o coordenador
   vê onde ela é usada — não quebra aula sem perceber."*

### 1.5 Duplicar uma Unit (se sobrar tempo)
1. Na grade, clique em **Duplicar esta Unit** → destino **U2**.
2. *"Ele parte da estrutura do mês anterior em vez de montar do zero."*

> **Não vai mais surgir a pergunta "de onde vêm as regras?"** — elas já estão lá,
> importadas. Se perguntarem: *"do Games Bank, no início do TG de vocês."*

---

## Parte 2 — A aula com o Kevin (o telão) (6 min)

**Papel: Professora Maria (`maria` / `prof123`)**

### 2.1 Navegação do dia a dia
1. Entre em **Year 5 → Turma 5A**.
2. **Destaque:** a lista de aulas com status (concluídas, atual). *"A Maria está
   adiantada — já deu 7 aulas."*
3. Abra a aula **`Y5-U1W1C1`**.

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
5. Aponte o filtro **origem** (Bebelingue vs. da escola): *"o catálogo oficial é
   de vocês; se um dia um professor criar uma atividade própria, ela fica só na
   escola dele — a metodologia oficial de vocês fica protegida."* (No seed, tudo
   é oficial da Bebelingue.)

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

> "Resumindo o que mudou: o coordenador de vocês tem uma **área própria** para
> montar o TG, o currículo é endereçado **por Unit** como na apostila, os jogos e
> técnicas — **já importados do TG de vocês** — são peças reutilizáveis que o
> Kevin conhece, o professor **busca** em vez de folhear PDF, e o Kevin ganhou
> **vida** — canta, dorme, reage. Para completar, precisamos de vocês: decidir
> como o **5x** entra (é um TG diferente do 3x), os **TGs dos outros Years**, e
> os modelos de **RMP** e **Yearly Plan**."

Puxe a lista de pendências de `docs/PERGUNTAS_REUNIAO_CLIENTE.md` (quadro do topo)
para combinar os próximos passos.

---

## Checklist rápido (imprima ou deixe ao lado)

- [ ] `seed_demo` **e** `importar_catalogo_tg` rodados, app no ar em localhost:8000
- [ ] 5 logins testados
- [ ] **P1** Coordenador: grade do TG + editor arrastável + catálogo importado + "usado em N aulas"
- [ ] **P2** Maria: telão + Música + Concluir
- [ ] **P3** Busca: fruits + filtros
- [ ] **P4** Carlos: relatório 5A vs 5B
- [ ] **Fecho:** decidir 5x vs 3x (§11) e Class Feedback; pedir TGs dos Years 1–4, RMP e Yearly Plan
