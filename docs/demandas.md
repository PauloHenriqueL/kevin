# Demandas — Kevin v2 (Alinhamento com a metodologia Bebelingue)

> **Status deste documento:** aprovado como escopo. Cada demanda tem seu próprio
> status de implementação — leia o cabeçalho de cada uma antes de começar.
>
> **Última atualização:** 21/07/2026

---

## Sumário

- [0. Por que este documento existe](#0-por-que-este-documento-existe)
- [Glossário](#glossário) ← **leia antes de tudo**
- [Panorama das demandas](#panorama-das-demandas)
- [Demanda 1 — Remodelagem do banco de dados (currículo, catálogo e execução)](#demanda-1--remodelagem-do-banco-de-dados)
- [Demanda 2 — Papéis e permissões](#demanda-2--papéis-e-permissões)
- [Demanda 3 — Contexto do Kevin](#demanda-3--contexto-do-kevin)
- [Demanda 4 — Métricas de professor: execução](#demanda-4--métricas-de-professor-execução)
- [Demanda 5 — Class Feedback (qualitativo)](#demanda-5--class-feedback-qualitativo) ⚠️
- [Demanda 6 — Busca global de conteúdo](#demanda-6--busca-global-de-conteúdo)
- [Demanda 7 — Área da coordenação](#demanda-7--área-da-coordenação)
- [Demanda 8 — Configuração do comportamento do Kevin](#demanda-8--configuração-do-comportamento-do-kevin) 📌
- [Decisões registradas](#decisões-registradas)
- [Considerado e adiado](#considerado-e-adiado)
- [Riscos aceitos](#riscos-aceitos)

---

## 0. Por que este documento existe

O banco de dados atual do Kevin foi modelado **antes** de conhecermos a
metodologia real da Bebelingue. Ele foi bom o suficiente para vender o produto —
e o produto **foi vendido**.

Agora a escola precisa popular o sistema com dados reais, e o Kevin precisa
funcionar como produto de verdade. O problema: a estrutura atual não representa
a metodologia que a escola efetivamente usa. Os documentos em `documento_escola/`
(Teacher's Guide real, formulário de Class Feedback preenchido, avaliação de
unidade) mostram uma metodologia muito mais estruturada do que o que existe hoje
no código.

**Este documento descreve a remodelagem completa** — banco, telas, papéis e o
que chega no prompt do Kevin — para que a estrutura reflita a realidade.

### Princípio que guia todas as decisões

> **O schema tem que ser autoexplicativo o suficiente para o coordenador da
> Bebelingue e o professor conseguirem preencher sozinhos, sem seed e sem
> treinamento técnico.**

Decidimos **não criar seed de dados**. Nada de pré-popular o catálogo de
atividades ou os TGs. Se um campo só faz sentido para quem leu este documento, o
campo está mal modelado — corrija o campo, não adicione documentação.

Consequência prática para o dev: `help_text` em **todo** campo, `verbose_name`
em português, e admin configurado com `fieldsets` que agrupem o formulário na
mesma ordem em que a informação aparece no TG em papel.

---

## Respostas do cliente — 23/07/2026

Recebidas por WhatsApp, antes da reunião. **Resolveram os riscos arquiteturais.**

| # | Pergunta | Resposta | Efeito |
|---|---|---|---|
| 1 | O TG é igual para todas as escolas? | **Sim.** Toda escola que usa Year 1 recebe o mesmo TG. Adaptação é "quase irrelevante" | ✅ **Confirma D1** — currículo global. Risco eliminado |
| 2 | Existe lista de regras dos jogos? | **Sim — "Games Bank"**, no início do TG | ✅ Não precisamos escrever ~27 regras. **Falta receber o arquivo** |
| 3 | E o BeBooklet? | **Também no início do TG** | ✅ Idem |
| 4 | O que é o "3x"? | Existem TGs **3x, 4x e 5x**. O de 4x **é o de 3x + uma Communication Class** | ⚠️ Mudou a modelagem — ver D19 |
| 5 | Como sabem que um professor está atrasado? | **RMP** (reunião mensal): o professor preenche um forms dizendo em que aula está. O código da aula revela o atraso. O previsto vem do **Yearly Plan Review**, montado por professor + coordenador no início do ano | 🔴 **Derrubou a suposição da Demanda 4** — ver D20 |

### O que ainda falta receber

- [ ] **TG completo** (não só a grade de março) — contém o Games Bank e o BeBooklet
- [ ] **Modelo de RMP** — solicitado
- [ ] **Modelo de Yearly Plan Review** — solicitado

> **Prioridade definida pelo cliente:** o foco é a **estrutura das aulas** e a
> parte que **o professor usa no dia a dia**. Yearly Plan e RMP entram depois,
> quando os arquivos chegarem — não bloqueiam nada.

---

## Glossário

Termos da Bebelingue que aparecem no código e nos documentos. **Não são
invenção nossa** — são o vocabulário do cliente, e devem ser preservados na UI.

| Termo | Significado |
|---|---|
| **Bebelingue** | A fornecedora. Vende metodologia, material didático e (agora) o Kevin para escolas. É a dona do currículo. |
| **Escola** | O cliente da Bebelingue (ex: Bernoulli, Paulo Freire). Contrata para implementar a metodologia. |
| **TG** (*Teacher's Guide*) | O roteiro pronto de aulas que a Bebelingue entrega ao professor. Organizado como uma grade **mês × semana × aula**. Ver `documento_escola/Modelo TG - Share With Friends Y5 (KEVIN AI).pdf`. |
| **BeCoordie** | Coordenador pedagógico da Bebelingue que assiste presencialmente à aula do professor e preenche o Class Feedback. |
| **Games Bank** | Seção no início do TG com as regras de cada jogo da metodologia (Simon Says, Hot Potato, Hangman…). É a fonte oficial para popular o catálogo de atividades. |
| **RMP** | Reunião mensal entre coordenador e professor. O professor informa em que aula está; o código da aula revela se há atraso. |
| **Yearly Plan Review** | Planejamento do ano, montado por professor + coordenador no início do ano letivo, com a organização mês a mês. É o "previsto" contra o qual se mede o atraso. |
| **3x / 4x / 5x** | Frequência semanal contratada pela escola. O TG de 4x **é o de 3x acrescido de uma Communication Class**; o de 5x, de mais uma. Não são currículos distintos. |
| **BeTips / BeComments** | Comentários escritos que o BeCoordie deixa no Class Feedback — elogios e ajustes sugeridos. |
| **Class Feedback** | Formulário de observação de aula preenchido pelo BeCoordie. Avalia o professor em 4 dimensões. |
| **Year** | Ano do currículo (Year 1 a Year 5). Corresponde ao ano escolar da turma. |
| **Unit** | Unidade pedagógica do material (Unit 1, Unit 2…). Agrupa conteúdo e é a base das avaliações. **Não é o eixo de navegação** — ver Decisão D2. |
| **Content Class** | Tipo de aula focado no Student's Book — vocabulário, gramática, reading, listening. |
| **Communication Class** | Tipo de aula focado em prática oral através de jogos (Simon Says, Four Corners…). Sem livro. |
| **Culture Class** | Tipo de aula com o *Integrated Activities Book* (CLIL) ou temática cultural/sazonal (ex: St. Patrick's Day). |
| **I Can Routine** | Ritual de fim de atividade: aluno marca a caixa "I can" no rodapé da página e escreve a data. Repete em quase toda Content Class. |
| **BeCalendar** | Rotina fixa de abertura de aula, trabalhando data e calendário em inglês. |
| **Songs Collection** | Rotina fixa de abertura — coletânea de músicas da metodologia. |
| **Sandwich Technique** | Técnica de ensino: diz a frase em inglês → diz em português → repete em inglês. Garante compreensão sem abandonar o idioma-alvo. |
| **Repetition Techniques** | Protocolo de repetição em escada: 3 grupos grandes → 3 grupos pequenos → 4 técnicas individuais. Sempre em nível de frase, nunca palavra solta. |
| **Warm Up / Development / Closure** | As três fases obrigatórias de toda aula. Warm Up ~10min, Development é o corpo, Closure é o fechamento com jogo de revisão. |
| **HW** | Homework (tarefa de casa). |
| **Extra Class** | Slot de aula sem roteiro definido no TG — usado como folga, reposição ou reforço. |

---

## Panorama das demandas

| # | Demanda | Status | Depende de |
|---|---|---|---|
| 1 | Remodelagem do banco de dados | ✅ Aprovada | — |
| 2 | Papéis e permissões | ✅ Aprovada | — |
| 3 | Contexto do Kevin | ✅ Aprovada | 1 |
| 4 | Métricas de professor — execução | ✅ Aprovada | 1 |
| 5 | Class Feedback (qualitativo) | ⚠️ **Escopo mapeado, implementação a definir com o cliente** | 1, 2 |
| 6 | Busca global de conteúdo | ✅ Aprovada | 1 |
| 7 | Área da coordenação | ✅ Aprovada (fase 2) | 1, 2 |
| 8 | Configuração do comportamento do Kevin | 📌 **Demanda futura** — registrada, não priorizada | 3, 7 |
| 9 | Animações novas do Kevin | ✅ **Feita** — motor novo integrado e validado | — |
| **10** | Retrabalho da animação | ✅ **Resolvida** — enquadramento + export_2 corrigido do animador | 9A |
| 11 | Ajustes do telão (música condicional, chat, concluir) | ✅ **Feita** | 1, 4 |
| 12 | Background por aula | ✅ **Feita** | 1, 9 |
| 13 | Seed só com currículo da Bebelingue | ✅ **Feita** | 1 |
| 14 | Suíte de testes automatizados | ✅ **Feita** — 30 testes | — |

### Ordem sugerida de execução

```
Fase 1 (fundação)        →  Demanda 1 + Demanda 2
                            (migração destrutiva; fazer de uma vez)
                                    │
Fase 2 (valor imediato)  →  Demanda 3 + Demanda 4 + Demanda 6
                            (dependem só do schema novo; podem ir em paralelo)
                                    │
Fase 3 (usabilidade)     →  Demanda 7
                            (depois de ver a coordenação sofrendo no Django admin)
                                    │
Fase 4 (a definir)       →  Demanda 5
                            (só depois de reunião com o cliente)
```

---

## Demanda 1 — Remodelagem do banco de dados

**Status:** ✅ Aprovada
**Objetivo:** fazer a estrutura de currículo refletir o TG real da Bebelingue.

### 1.1 O problema, em concreto

O TG real (`documento_escola/Modelo TG - ... - March - 3x.csv`) é assim:

```
                CLASS 1              CLASS 2              CLASS 3
WEEK 1     (MAR W1C1) CONTENT   (MAR W1C2) CONTENT   (MAR W1C3) CULTURE
Homework   —                    "copiar Grammar..."  "Integrated Act. U1 ex.1-2"
WEEK 2     (MAR W2C1) CONTENT   (MAR W2C2) COMMUNIC. (MAR W2C3) CULTURE
...
WEEK 5     EXTRA CLASS          EXTRA CLASS          —
```

E cada célula tem esta anatomia:

```
(MAR W1C1) - CONTENT CLASS

WARM UP (10 MIN)
1) BeCalendar                                    ← rotina fixa, reutilizável
2) Songs Collection                              ← rotina fixa, reutilizável
3) HW Correction / Practice Game: Go and Touch   ← jogo do catálogo

DEVELOPMENT
1) Student's Book - U1L1 (P. 10-11)              ← recurso + páginas
   - Explore the picture from the page...        ← passos ordenados, texto livre
   - Introduce the target vocabulary, applying
     repetition techniques (3 big groups -> 3
     small groups -> 4 individual techniques)    ← técnica do catálogo
2) I Can Routine                                 ← rotina fixa, reutilizável

CLOSURE
1) Review Game: Hangman                          ← jogo do catálogo
2) Homework Assignment
```

**O que o modelo atual não comporta:**

| Realidade | Modelo de hoje | Problema |
|---|---|---|
| Aula endereçada por **mês** (`MAR W1C1`) | `unique_together (year, unit, week, class_num)`, código `Y5U1W1C1` | Mês não existe. Unit é usada como eixo de navegação, mas ela atravessa o mês |
| Aula tem **tipo** (Content/Communication/Culture) | não existe | Development muda completamente de forma conforme o tipo |
| Fases são **listas ordenadas de blocos** | 3 `TextField` de texto corrido | Kevin recebe prosa; não sabe o que é atividade nomeada |
| `Simon Says` é uma **atividade com regras** | `Conteudo(titulo, tipo, arquivo_url)` — modelo de arquivo de mídia | Jogo não tem arquivo, tem regra. Kevin recebe só a string e alucina o resto |
| Cada turma percorre o TG **no seu ritmo** | `ProgressoTurma(turma, aula, status)` | Guarda status, mas não data real nem quem deu a aula |
| Homework é **da semana** | `Homework(aula, ...)` | Aproximação aceitável, mas hoje não tem relação com o calendário |

### 1.2 Modelo de dados alvo

```
Escola (mantém)
  └── Turma
        ├── year            Year do currículo (1–5)
        ├── nome            "A", "B", "C"
        ├── qtd_alunos      NOVO — headcount. Substitui o modelo Aluno
        ├── aulas_por_semana NOVO — 2 ou 3 ("3x" do nome do TG)
        └── professor (FK)

── CURRÍCULO (global, da Bebelingue) ─────────────────────────

Aula                        ← o TG publicado. Professor NÃO edita
  ├── year                  1–5
  ├── mes                   1–12          ┐
  ├── semana                1–5           ├── CHAVE (unique_together)
  ├── numero_aula           1–3           ┘
  ├── codigo                Y5-MAR-W1C1   ← gerado no save()
  ├── tipo                  content | communication | culture | extra
  ├── unit                  atributo descritivo, NÃO é chave
  ├── lesson                atributo descritivo (ex: "U1L1")
  ├── frequencia_minima     3 | 4 | 5 — a aula aparece para turmas com
  │                         aulas_por_semana >= este valor. O TG de 4x é o
  │                         de 3x + 1 Communication Class (ver D19)
  ├── titulo
  ├── observacao            ex: "Sugestão: convidar alunos a vestir verde"
  ├── kickoff               opcional — mensagem que abre a aula (ver 3.3.1)
  └── BlocoAula × N         ← o roteiro, ordenado

BlocoAula                   ← um item numerado dentro de uma fase
  ├── aula (FK)
  ├── fase                  warm_up | development | closure
  ├── ordem                 1, 2, 3…
  ├── atividade (FK opcional → Atividade)   ← "Simon Says", "BeCalendar"
  ├── titulo                texto livre — usado quando não há atividade
  ├── instrucoes            os passos específicos DESTA aula
  └── referencia            ex: "Student's Book U1L1 (P. 10-11)"

Atividade                   ← o CATÁLOGO. É o que faz o Kevin "saber" a atividade
  ├── tipo                  jogo | tecnica | rotina | recurso
  ├── nome                  "Simon Says", "Sandwich Technique", "BeCalendar"
  ├── descricao             o que é / qual o objetivo pedagógico
  ├── como_conduzir         passo a passo — VAI PARA O KEVIN
  ├── objetivo_pedagogico   o que se pratica
  ├── materiais             flashcards, bola, quadro…
  ├── duracao_estimada      minutos (opcional)
  ├── arquivo_url           só para tipo=recurso (livro, áudio, vídeo)
  ├── tags                  busca livre (Demanda 6)
  ├── escola (FK, NULL)     NULL = catálogo oficial Bebelingue
  │                         preenchido = atividade local daquela escola
  └── criado_por (FK User)

Homework
  ├── aula (FK)
  └── descricao             texto livre, como vem no TG

── EXECUÇÃO (local, da turma) ────────────────────────────────

AulaTurma                   ← evolui o ProgressoTurma atual
  ├── turma (FK)
  ├── aula (FK)
  ├── status                nao_iniciada | em_andamento | concluida
  ├── data_realizada        NOVO — data real em que foi dada
  ├── professor (FK)        NOVO — quem deu (pode ser substituto)
  ├── presentes             NOVO — ATTENDANCE do Class Feedback
  └── observacoes           NOVO — anotação livre do professor
```

### 1.3 Histórias de usuário

> **Como coordenador da Bebelingue**, quero cadastrar o TG de um mês como uma
> grade de semanas × aulas, **por meio de** uma tela que espelhe o mesmo formato
> do arquivo que já uso, **para que** eu não precise traduzir mentalmente o meu
> material para o formato do sistema.

> **Como coordenador da Bebelingue**, quero cadastrar "Simon Says" uma única vez
> no catálogo **por meio de** um formulário de Atividade, **para que** eu possa
> reutilizá-la em dezenas de aulas sem redigitar as regras — e para que o Kevin
> saiba conduzi-la.

> **Como professor**, quero abrir a aula de hoje e ver o roteiro em blocos
> numerados **por meio da** tela da aula, **para que** eu saiba exatamente o que
> fazer e em que ordem, sem interpretar um texto corrido.

> **Como professor**, quero marcar a aula como dada informando a data real e
> quantos alunos estavam presentes, **por meio do** botão de conclusão,
> **para que** a coordenação saiba o ritmo real da minha turma.

> **Como diretor**, quero ver o progresso da turma mesmo quando ela atrasou em
> relação ao calendário, **por meio do** relatório de progresso, **para que**
> feriados e reposições não sejam lidos como abandono do currículo.

### 1.4 Regras de negócio

1. `Aula.codigo` é **gerado automaticamente** no `save()`, no formato
   `Y{year}-{MES}-W{semana}C{numero_aula}` (ex: `Y5-MAR-W1C1`). Mês em sigla de
   3 letras, em inglês maiúsculo, como no TG.
2. `unique_together = (year, mes, semana, numero_aula)`.
3. `Aula.tipo = extra` corresponde ao "EXTRA CLASS" do TG: aula sem roteiro
   obrigatório. Pode ter zero blocos.
4. `BlocoAula` **ou** aponta para uma `Atividade` **ou** tem `titulo` preenchido.
   Nunca os dois vazios — validar no `clean()`.
5. `Atividade.escola = NULL` significa catálogo oficial da Bebelingue. Só o
   coordenador cria com `escola = NULL`.
6. Professor só enxerga atividades com `escola = NULL` **ou**
   `escola = <sua escola>`. Nunca de outra escola.
7. `Atividade.arquivo_url` só é obrigatório para `tipo = recurso`.
8. `AulaTurma` é criada sob demanda: só existe depois que a turma interage com
   aquela aula. Ausência = não iniciada.
9. Uma `Aula` só pode ser editada pelo coordenador. Professor tem leitura.

### 1.5 Plano de migração

> ⚠️ **Migração destrutiva e aprovada.** O sistema está em protótipo, existe
> backup, e o cliente ainda não populou dados reais. Não é necessário preservar
> os dados de demo (`seed_demo`).

| Passo | Ação |
|---|---|
| 1 | Criar `Atividade`. Migrar `Conteudo` existente → `Atividade(tipo='recurso')`, preservando `titulo`, `descricao`, `arquivo_url`, `criado_por` |
| 2 | Criar `BlocoAula` |
| 3 | Alterar `Aula`: adicionar `mes`, `tipo`, `lesson`, `observacao`; trocar `unique_together`; regerar todos os `codigo` |
| 4 | **Não migrar** `warm_up`/`development`/`closure` automaticamente para blocos — o texto de demo não tem estrutura recuperável. Dropar os campos |
| 5 | Renomear `ProgressoTurma` → `AulaTurma`; adicionar `data_realizada`, `professor`, `presentes`, `observacoes` |
| 6 | Adicionar `Turma.qtd_alunos` e `Turma.aulas_por_semana` |
| 7 | **Dropar o modelo `Aluno`** e remover `/gestao/alunos/`, `aluno_form.html`, `aluno_list.html`. Ajustar dashboard do diretor (contar `qtd_alunos` em vez de registros) |
| 8 | Dropar `AulaConteudo` (substituído por `BlocoAula`) e o modelo `Conteudo` |
| 9 | Atualizar `seed_demo` para o schema novo — **dados de demonstração apenas**, não é seed de catálogo |

**Atenção para o dev:** `apps/escolas/professor_views.py` faz
`prefetch_related('alunos')` em pelo menos 4 lugares (linhas ~74, 91, 127, 285).
Todos quebram no passo 7.

### 1.6 Caso de teste do modelo — o roteiro da Aula 1

Existe um roteiro de aula **já escrito e validado** em `exemplo/server.py`
(commit `cc87c5b`). Ele foi redigido à mão, dentro de uma string Python, porque o
banco atual não comporta a estrutura. É o **melhor teste que temos**: se o modelo
novo não conseguir representá-lo, o modelo está errado.

Mapeamento alvo:

| No roteiro do protótipo | Vira no banco |
|---|---|
| `[ FASE 1: WARM UP ]` | `BlocoAula.fase = warm_up` |
| Ação 2 — jogo "True or False" (5 fatos, 3 verdadeiros / 2 falsos) | `Atividade(tipo=jogo, nome="True or False")` + `BlocoAula.instrucoes` com o detalhe desta aula |
| Ação 4 — apresentação com "My name's… / I'm X years old / I like…" | `BlocoAula.instrucoes` (específico desta aula) |
| `[ FASE 2: DEVELOPMENT ]` — "class deals" | `Atividade(tipo=rotina, nome="Class Deals")` |
| Ação 3 — "aplique a técnica de Instant Translation" | `Atividade(tipo=tecnica, nome="Instant Translation")` |
| Lista de combinados (*attend the classes, speak only English…*) | `BlocoAula.instrucoes` |
| `[ FASE 3: CLOSURE ]` — despedida | `BlocoAula.fase = closure` |
| "hoje é dia de se conhecerem" | `Aula.kickoff` |

**Três atividades novas para o catálogo** — não estavam no TG de março:
`True or False`, `Class Deals`, `Instant Translation`. Reforça a pergunta 3.1 da
pauta do cliente: a lista real de atividades é maior que a do TG.

> **Nota:** o roteiro do protótipo faz o Kevin dirigir-se às crianças e aguardar
> resposta delas. Ao portar, ajustar para o modelo de interação confirmado
> (Decisão D11): o professor é o interlocutor e media os momentos com a turma.

### 1.7 Critérios de aceite

- [ ] O roteiro da Aula 1 (seção 1.6) é representável no modelo novo, sem perda
- [ ] Coordenador cadastra um mês inteiro do TG (5 semanas × 3 aulas) pelo admin, sem escrever código
- [ ] Aula `Y5-MAR-W1C1` existe com 3 blocos em warm_up, 2 em development, 2 em closure
- [ ] "Simon Says" cadastrado uma vez aparece em 2+ aulas diferentes
- [ ] Professor da escola A não vê atividade local da escola B (testar via ORM e via UI)
- [ ] Professor marca aula como dada com data e presença; `AulaTurma` registra ambos
- [ ] Nenhuma referência a `Aluno` ou `Conteudo` sobra no código (`grep` limpo)
- [ ] `manage.py migrate` roda do zero sem erro

---

## Demanda 2 — Papéis e permissões

**Status:** ✅ Aprovada
**Objetivo:** criar o papel do coordenador Bebelingue e corrigir a nomenclatura do diretor.

### 2.1 O problema

O `User.Role` atual tem `admin`, `escola`, `professor`. Dois problemas:

1. O valor `escola` designa o **diretor da escola** — mas todo o resto do projeto
   (modelo `Diretor`, templates, `PRODUTO_KEVIN.md`) chama de "diretor".
   Incoerência já instalada, confunde quem chega agora.
2. **Não existe o coordenador da Bebelingue** — o papel que cadastra a
   metodologia, é dono do catálogo oficial e (na Demanda 5) observa aulas.
   Hoje ele só poderia operar como superuser, o que mistura papel de negócio com
   acesso técnico irrestrito.

### 2.2 Solução

```python
class Role(models.TextChoices):
    ADMIN       = 'admin',       'Administrador'
    COORDENADOR = 'coordenador', 'Coordenador Bebelingue'   # NOVO
    DIRETOR     = 'diretor',     'Diretor de Escola'        # era 'escola'
    PROFESSOR   = 'professor',   'Professor'
```

| Papel | Pertence a | Pode |
|---|---|---|
| `admin` | Bebelingue (técnico) | Tudo. Django admin irrestrito |
| `coordenador` | Bebelingue (pedagógico) | Cadastrar TG, catálogo oficial, escolas, professores. **Não** acessa configuração técnica (chaves de API, planos) |
| `diretor` | Escola cliente | Gerenciar professores e turmas **da sua escola**. Ver relatórios |
| `professor` | Escola cliente | Ver suas turmas e aulas, usar o Kevin, criar atividade **local** |

### 2.3 Histórias de usuário

> **Como coordenador da Bebelingue**, quero acessar o sistema com um papel
> próprio **por meio de** login normal, **para que** eu cadastre a metodologia
> sem precisar de credencial de superusuário.

> **Como Bebelingue**, quero que o coordenador não veja chaves de API nem
> configuração de plano, **por meio de** permissão granular, **para que** acesso
> pedagógico não implique acesso técnico.

### 2.4 Plano de migração

Migração de dados: `UPDATE accounts_user SET role='diretor' WHERE role='escola'`.

Ocorrências de `'escola'` como valor de role a corrigir (levantadas via grep):

- `apps/accounts/permissions.py:11` e `:21`
- `apps/accounts/mixins.py:18`
- `apps/accounts/middleware.py:26`
- `apps/accounts/template_views.py:27`
- `apps/accounts/migrations/0001_initial.py:32` (choices)

> ⚠️ Cuidado ao fazer find-and-replace: `escola` aparece muito mais vezes como
> **nome de FK** (`select_related('escola')`, `list_filter = ('escola',)`).
> Essas **não** devem ser tocadas. Só troque onde o contexto for `role`.

### 2.5 Critérios de aceite

- [ ] Login com `role='coordenador'` redireciona para área adequada
- [ ] Nenhum usuário com `role='escola'` no banco após a migração
- [ ] Coordenador consegue criar `Aula` e `Atividade` oficial
- [ ] Coordenador **não** consegue ver/editar `Plano` (chaves de API)
- [ ] Diretor continua vendo só a própria escola
- [ ] Middleware de redirecionamento cobre os 4 papéis

---

## Demanda 3 — Contexto do Kevin

**Status:** ✅ Aprovada
**Objetivo:** entregar ao Kevin a metodologia estruturada, para que ele conduza
atividades que conhece em vez de improvisar.

### 3.1 O problema

Hoje `Aula.get_contexto_completo()` concatena `warm_up + development + closure`
como texto corrido. Quando o TG diz "Game: Simon Says", o Kevin recebe a string
`"Simon Says"` e **inventa** como se joga — que pode não ser a versão da
Bebelingue, com o objetivo pedagógico da Bebelingue.

Este é o motivo central da remodelagem. É aqui que ela vira valor.

### 3.2 Quem conversa com o Kevin — modelo de interação

> Confirmado com o cliente. **O prompt deve refletir isto.**

O Kevin é projetado na tela/TV da sala. Quem conversa com ele é
**principalmente o professor**, por áudio, e ele atua como **mediador**:

```
Professor  ──fala com o Kevin──▶  Kevin responde
    │
    └── "agora vocês falam com o Kevin"  ──▶  Turma interage (momento aberto pelo professor)
    │
    └── encerra o momento e retoma a condução
```

**Regras que decorrem disso:**

1. O interlocutor padrão é o **professor**. O Kevin fala *com* ele, não *para* a
   turma, salvo quando o professor abre esse momento.
2. A turma participa em **momentos mediados** — quem abre e fecha é o professor.
3. A interação é **majoritariamente por áudio**. O texto é secundário.
4. O Kevin **não toma a iniciativa** de se dirigir às crianças.

> **Referência de implementação:** o protótipo em `exemplo/server.py` (commit
> `cc87c5b`) tem um roteiro de aula escrito à mão que já exercita esse fluxo —
> Kevin propõe um jogo, pede que a turma responda, e aguarda. Vale ler antes de
> escrever o prompt novo. Note que aquele roteiro está **hardcoded numa string
> Python** justamente porque o banco atual não comporta a estrutura — é o
> problema que a Demanda 1 resolve.

### 3.3 Solução

Reescrever a montagem do contexto para percorrer os `BlocoAula` em ordem e
**expandir a `Atividade`** de cada bloco a partir do catálogo:

```
=== AULA Y5-MAR-W1C1 ===
Year 5 | Unit 1 | Tipo: Content Class
Título: Share It! — Daily Routines

--- WARM UP ---
1. BeCalendar  [rotina]
   Como conduzir: <Atividade.como_conduzir>
2. Songs Collection  [rotina]
   Como conduzir: <Atividade.como_conduzir>
3. HW Correction / Practice Game: Go and Touch  [jogo]
   Objetivo: <Atividade.objetivo_pedagogico>
   Como conduzir: <Atividade.como_conduzir>
   Materiais: <Atividade.materiais>

--- DEVELOPMENT ---
1. Student's Book - U1L1 (P. 10-11)  [recurso]
   Instruções desta aula:
   - Explore the picture from the page, asking students questions about it
   - Introduce the target vocabulary, applying repetition techniques...
   Técnica referenciada: Repetition Techniques
   → <Atividade.como_conduzir>
...
```

### 3.3.1 Kickoff — a mensagem que abre a aula

O telão (ver `templates/professor/aula_detail.html`) tem uma tela de standby com
o botão **"Iniciar aula"**. Ao clicar, o sistema envia uma mensagem automática ao
Kevin — o professor não digita nada — e o Kevin já responde falando (TTS).

Hoje esse texto está **hardcoded** no template:

```js
window.KEVIN_KICKOFF = "Olá Kevin, o que vamos fazer hoje? Por onde começamos?";
```

**Deve passar a vir do banco, com precedência do específico para o genérico:**

| Ordem | Origem | Exemplo |
|---|---|---|
| 1º | `Aula.kickoff` (campo novo, opcional) | *"Kevin, hoje é nosso primeiro dia. Vamos nos conhecer?"* |
| 2º | Template por `Aula.tipo` | Content → *"Kevin, vamos começar. Por onde?"* · Communication → *"Kevin, hoje é dia de jogos. Qual o primeiro?"* |
| 3º | Fallback genérico | o texto atual |

**Por que com precedência:** obrigar o coordenador a escrever um kickoff em 150
aulas seria trabalho morto — na maioria delas o texto do tipo resolve. O campo
existe para as aulas que merecem abertura própria (primeira aula do ano, aula
sazonal, aula de revisão).

> 📌 Os textos dos níveis 2 e 3 são **calibráveis** — entram na Demanda 8.

Adicionar `kickoff` ao modelo `Aula` (Demanda 1, seção 1.2).

### 3.4 Regras

1. Expandir **apenas** as atividades que aparecem nos blocos **desta** aula.
   Nunca o catálogo inteiro — é API paga por token e diluiria o foco.
2. Ordem do contexto = ordem dos blocos. O Kevin deve conseguir responder
   "e agora?" seguindo a sequência.
3. Se `BlocoAula.atividade` for nulo, enviar só `titulo` + `instrucoes`.
4. `Aula.observacao` entra no contexto (ex: aviso de aula sazonal).
5. Homework da aula entra no fim.
6. **Interlocutor padrão = professor** (ver 3.2). Respostas curtas e acionáveis —
   ele está de pé na frente da turma.
7. **Idioma — Instant Translation.** Comportamento padrão: quando alguém
   responde em português, o Kevin **valida calorosamente em português e
   responde em inglês na sequência**, mantendo o foco no idioma-alvo. É a
   técnica da metodologia, não invenção nossa.

   > 📌 Implementar como **padrão configurável**, não hardcoded. A Demanda 8
   > transforma isto em parâmetro calibrável pelo gerente da Bebelingue. Escreva
   > o prompt de forma que essa regra seja um trecho isolado e substituível.

### 3.5 Liberdade para otimizar o prompt

> **O `SYSTEM_PROMPT_BASE` em `apps/chat/tasks.py:7` pode ser reescrito à
> vontade.** Não há compromisso com o texto atual.

Diretrizes:

- **Economia de token é requisito**, não otimização opcional. A chave de API é
  por plano e cada mensagem custa. Cortar redundância é trabalho válido.
- **Considerar placeholders e triggers** que ajudem o Kevin a raciocinar melhor:
  marcadores explícitos de fase atual, instruções sobre quando citar a técnica
  em vez de descrevê-la, formato de resposta esperado durante a aula (curto,
  acionável — o professor está de pé na frente de 20 crianças).
- Vale testar prompt com e sem expansão completa e comparar qualidade x custo.
- Documentar no PR qual formato foi escolhido e por quê.

### 3.6 Histórias de usuário

> **Como professor**, quero que o Kevin saiba conduzir o "Simon Says" da
> metodologia Bebelingue **por meio da** expansão automática do catálogo no
> contexto, **para que** ele não invente uma versão diferente da que a escola
> ensina.

> **Como professor**, quero perguntar "e agora?" durante a aula **por meio do**
> chat, **para que** o Kevin me responda com base na sequência real de blocos.

> **Como professor**, quero abrir um momento em que a turma fala com o Kevin
> **por meio do** microfone que eu controlo, **para que** eu conduza a interação
> sem perder o comando da aula.

### 3.7 Critérios de aceite

- [ ] Aula com bloco `Simon Says`: contexto contém o `como_conduzir` completo
- [ ] Catálogo inteiro **não** vai no contexto — só as atividades da aula
- [ ] Ordem dos blocos preservada no prompt
- [ ] Contagem de tokens do contexto medida e registrada no PR
- [ ] Kevin responde "e agora?" citando um bloco real da aula
- [ ] Kevin trata o professor como interlocutor padrão
- [ ] Regra de Instant Translation isolada num trecho substituível do prompt

---

## Demanda 4 — Métricas de professor (execução)

**Status:** ✅ Aprovada
**Objetivo:** medir a execução do currículo pelo professor. Métrica automática,
derivada do uso — custo próximo de zero depois da Demanda 1.

### 4.1 Contexto

Na reunião, o cliente foi explícito: **as métricas principais são do professor**,
não do aluno nem da turma. Existem duas naturezas de métrica de professor:

- **Execução** (esta demanda) — automática, o sistema já sabe.
- **Qualidade** (Demanda 5) — humana, alguém precisa observar a aula.

Hoje já existe `/gestao/relatorios/professores/` prometendo "desempenho por
professor", mas sem dado real por trás.

### 4.2 Métricas

Todas derivam de `AulaTurma`:

| Métrica | Cálculo |
|---|---|
| Aulas dadas no período | `count(AulaTurma where status=concluida)` |
| Aderência ao calendário | aulas dadas ÷ aulas previstas até hoje |
| Atraso médio | média de `data_realizada − data_prevista` |
| Presença média | média de `presentes ÷ Turma.qtd_alunos` |
| Uso do Kevin | conversas iniciadas ÷ aulas dadas |
| Aulas sem registro | aulas previstas cuja `AulaTurma` não existe |

> **Nota:** "data prevista" exige saber quando o mês letivo começa para aquela
> turma. Sugestão: campo `Turma.inicio_ano_letivo` + `aulas_por_semana` para
> derivar. Se ficar frágil na prática, tratar como demanda de refinamento.

### 4.3 Histórias de usuário

> **Como diretor**, quero ver quantas aulas cada professor deu no mês e se está
> em dia com o TG **por meio do** relatório de professores, **para que** eu
> identifique quem precisa de apoio antes de virar problema.

> **Como coordenador da Bebelingue**, quero comparar aderência ao currículo entre
> escolas **por meio de** um relatório consolidado, **para que** eu saiba onde a
> metodologia não está sendo seguida.

> **Como professor**, quero ver meu próprio progresso **por meio da** tela "Meu
> Progresso", **para que** eu saiba se estou no ritmo antes de alguém me cobrar.

### 4.4 Critérios de aceite

- [ ] Relatório mostra aulas dadas por professor no período
- [ ] Aderência calculada e exibida como %
- [ ] Diretor vê só professores da própria escola
- [ ] Coordenador vê todas as escolas
- [ ] Professor vê apenas os próprios números
- [ ] Turma que atrasou por feriado não aparece como abandono

---

## Demanda 5 — Class Feedback (qualitativo)

> ## ⚠️ ATENÇÃO — NÃO IMPLEMENTAR AINDA
>
> **O escopo abaixo está mapeado, mas a forma de implementação será discutida
> com o cliente.** Esta seção existe para registrar o que foi entendido do
> material, não para ser executada. Nenhuma linha de código deve ser escrita
> para esta demanda antes de nova rodada de alinhamento.
>
> **Motivo:** é avaliação de desempenho de funcionário — dado sensível,
> atravessa a fronteira Bebelingue ↔ escola-cliente, e envolve um papel
> (BeCoordie) cujo fluxo de trabalho ainda não conhecemos bem o suficiente.

### 5.1 O que foi entendido do material

Fonte: `documento_escola/GO_ADAPT JUNIOR - CLASS FEEDBACK - MODELO (1).docx`
(formulário em branco) e `04_13 - 4º Ano Tarde (Gabriela) - Paulo Freire NP.docx`
(caso real preenchido).

Um **BeCoordie** assiste presencialmente à aula e preenche um formulário com:

**Cabeçalho:** professor, escola, turma, presença, pontualidade (on time/late),
unit/lesson, data, class code, nome do BeCoordie.

**Checklist da rotina** — o que foi efetivamente cumprido em cada fase, com
campos livres de BeTips por fase. O checklist do Development varia conforme o
tipo de aula (Content / Communication / Culture / CLIL), espelhando a estrutura
que modelamos na Demanda 1.

**Quatro dimensões avaliadas**, cada uma em `Great / Good / Under development`,
com BeTips escritos:

1. Teacher's Active Presence
2. Class Management
3. Time Management
4. Use of English

**Gentle Reminders** — bloco fixo de lembretes da metodologia, igual em todo
formulário.

**Resumo em português para o coordenador/diretor da escola** — seção separada,
com aspectos positivos e ajustes sugeridos por dimensão. Note que este resumo
**atravessa** da Bebelingue para a escola-cliente.

### 5.2 Perguntas em aberto para a reunião com o cliente

1. O BeCoordie preenche **durante** a aula (mobile?) ou depois?
2. O professor avaliado **vê** o próprio feedback? Integral ou só o resumo?
3. O diretor da escola vê o feedback completo ou só o resumo em português?
4. Histórico de avaliações do professor fica visível para quem? Por quanto tempo?
5. O checklist de rotina deve ser **derivado** dos blocos da aula (Demanda 1) ou
   é uma lista fixa independente?
6. As 4 dimensões viram nota agregada/série histórica, ou são sempre pontuais?
7. Existe fluxo de resposta — o professor comenta o feedback recebido?
8. LGPD: avaliação de desempenho tem requisito de retenção/acesso a tratar?

### 5.3 História de usuário (rascunho, sujeito a mudança)

> **Como BeCoordie**, quero registrar a observação de uma aula **por meio de**
> um formulário estruturado, **para que** o professor receba devolutiva
> consistente e a escola acompanhe a qualidade da execução.

---

## Demanda 6 — Busca global de conteúdo

**Status:** ✅ Aprovada
**Objetivo:** eliminar o "Ctrl+F em PDF".

### 6.1 O problema (levantado pelo cliente na reunião)

Hoje o professor que precisa achar um conteúdo abre o PDF do material e faz
Ctrl+F. É lento, e só funciona se ele já souber em qual PDF procurar.

Dois casos de uso concretos:

1. **Busca por assunto** — "preciso de uma atividade sobre frutas".
2. **Cobrir buraco no TG** — a coordenação esqueceu de preencher uma aula, o
   professor sabe que existe conteúdo para aquilo, e quer encontrá-lo sozinho
   em vez de ficar bloqueado.

### 6.2 Solução

Tela de busca sobre a tabela `Atividade` (que unifica jogo, técnica, rotina e
recurso — por isso a Demanda 1 escolheu modelo único: a busca varre uma tabela
só, não faz union de quatro).

- Campo de busca livre sobre `nome`, `descricao`, `objetivo_pedagogico`, `tags`
- Filtro por `tipo` (jogo / técnica / rotina / recurso)
- Filtro por origem (oficial Bebelingue / da minha escola)
- Resultado mostra em quais aulas a atividade é usada
- Respeita o isolamento entre escolas (regra 1.4.6)

### 6.3 Histórias de usuário

> **Como professor**, quero buscar "fruits" e encontrar jogos, técnicas e páginas
> de livro relacionados **por meio de** uma busca única, **para que** eu pare de
> fazer Ctrl+F em PDF.

> **Como professor**, quero encontrar uma atividade adequada quando a aula do TG
> vier incompleta **por meio da** busca do catálogo, **para que** eu não fique
> bloqueado esperando a coordenação.

> **Como professor**, quero ver em quais aulas uma atividade aparece **por meio
> do** resultado da busca, **para que** eu entenda o contexto de uso dela.

### 6.4 Critérios de aceite

- [ ] Busca por termo retorna atividades de todos os 4 tipos
- [ ] Filtros de tipo e origem funcionam combinados
- [ ] Professor não vê atividade local de outra escola
- [ ] Resultado indica as aulas que usam a atividade
- [ ] Busca responde em tempo aceitável com catálogo de ~500 atividades
      (índice em `nome` e `tags`)

---

## Demanda 7 — Área da coordenação

**Status:** ✅ Aprovada — **fase 2** (após a fundação)
**Objetivo:** dar ao coordenador da Bebelingue telas próprias, em vez do Django admin cru.

### 7.1 Contexto e sequenciamento

Na **fase 1**, o coordenador cadastra tudo pelo **Django admin bem configurado**
(`fieldsets`, `inlines`, `help_text`, `list_filter`). É o suficiente para
começar, e evita construir telas antes de saber onde dói.

Esta demanda constrói a área dedicada `/coordenacao/`, **depois** de observar o
coordenador usando o admin de verdade. A prioridade de cada tela deve ser
definida pelo atrito observado, não por suposição.

### 7.2 Escopo previsto

- **Grade do TG** — visualizar e editar o mês como grade semana × aula, no mesmo
  formato do arquivo que ele já usa. É a tela mais importante: hoje cadastrar
  uma aula com blocos ordenados no admin é desconfortável.
- **Editor de blocos** — arrastar, reordenar, escolher atividade do catálogo com
  autocomplete.
- **Gestão do catálogo** — CRUD de atividades oficiais, ver onde cada uma é usada
  antes de editar/remover.
- **Cadastro de escolas, diretores e professores.**
- **Visão consolidada de aderência** por escola (consome a Demanda 4).
- **Duplicar mês** — copiar a estrutura do mês anterior como ponto de partida.

### 7.3 Histórias de usuário

> **Como coordenador da Bebelingue**, quero cadastrar o TG do mês numa grade
> igual à do meu arquivo **por meio da** tela de grade, **para que** eu não
> traduza mentalmente entre dois formatos.

> **Como coordenador da Bebelingue**, quero reordenar os blocos de uma aula
> arrastando **por meio do** editor visual, **para que** montar o roteiro seja
> rápido.

> **Como coordenador da Bebelingue**, quero ver onde uma atividade é usada antes
> de editá-la **por meio da** tela do catálogo, **para que** eu não quebre aulas
> sem perceber.

### 7.4 Critérios de aceite

- [ ] Coordenador cadastra um mês inteiro sem abrir o Django admin
- [ ] Grade exibe mês × semana × aula como no TG original
- [ ] Blocos reordenáveis com persistência da ordem
- [ ] Autocomplete de atividade no editor de blocos
- [ ] Tela de atividade mostra as aulas que a referenciam

---

## Demanda 8 — Configuração do comportamento do Kevin

> ## 📌 DEMANDA FUTURA — registrada, não priorizada
>
> Escopo anotado para não se perder. **Não implementar agora.** Entra depois da
> Demanda 7 (área da coordenação), como parte das telas de gerência da
> Bebelingue.

**Objetivo:** permitir que o gerente da Bebelingue calibre o comportamento do
Kevin sem depender de deploy de código.

### 8.1 Por que existe

Ao escrever a Demanda 3, apareceram várias regras de comportamento que hoje só
existem hardcoded no `SYSTEM_PROMPT_BASE`. A primeira identificada foi a
**Instant Translation** (valida em português → responde em inglês). É o padrão
correto hoje, mas é uma **decisão pedagógica**, não técnica — e quem deve poder
mudá-la é a Bebelingue, não o desenvolvedor.

O mesmo raciocínio vale para outros parâmetros: se hoje "responda curto" está
fixo no código, mudar isso exige PR, review e deploy para uma decisão que é de
metodologia.

### 8.2 Escopo previsto

Parâmetros candidatos a virarem configuráveis:

- **Política de idioma** — Instant Translation (padrão) / só inglês / bilíngue
  livre. Possivelmente variando por Year (Year 1 tolera mais português que
  Year 5).
- **Tamanho e tom da resposta** — quão curto, quão animado.
- **Postura pedagógica** — o Kevin pode sugerir sair do roteiro? Pode concordar
  em pular uma fase? (ver "Considerado e adiado")
- **Comportamento nos momentos com a turma** — o quanto ele fala direto com as
  crianças quando o professor abre esse momento.
- **Textos de abertura** — a mensagem de kickoff da aula.

### 8.3 Decisões em aberto

1. A configuração é **global** (uma para toda a Bebelingue), **por plano**, ou
   **por Year**? Ver Decisão D11 — hoje provedor/chave de IA é por `Plano`.
2. O diretor da escola pode ajustar alguma coisa, ou é exclusivo da Bebelingue?
3. Precisa de histórico/auditoria de quem mudou o quê? (mudar o prompt afeta
   todas as escolas ao mesmo tempo)
4. Precisa de preview/teste antes de publicar uma mudança de prompt?

### 8.4 Histórias de usuário (rascunho)

> **Como gerente da Bebelingue**, quero ajustar a política de idioma do Kevin
> **por meio de** uma tela de configuração, **para que** eu adeque o
> comportamento à metodologia sem depender do time de desenvolvimento.

> **Como gerente da Bebelingue**, quero testar uma mudança de prompt antes de
> publicar **por meio de** um preview, **para que** eu não quebre a experiência
> de todas as escolas de uma vez.

### 8.5 Preparação necessária na Demanda 3

Para que esta demanda seja barata depois, a Demanda 3 já deve escrever o prompt
com as regras calibráveis em **trechos isolados e substituíveis** — não diluídas
no meio do texto. Ver regra 3.4.7.

---

## Demanda 9 — Animações novas do Kevin

**Status:** ✅ Aprovada — **executável em duas partes independentes**
**Objetivo:** integrar o motor de animação novo (`export_2`), com 3 modos novos,
a Mosca e cenários de fundo trocáveis.

### 9.0 Leia isto antes de começar

Esta demanda **se divide em duas partes que não dependem uma da outra**:

| Parte | O que é | Depende da Demanda 1? |
|---|---|---|
| **9A — Motor** | Trocar os arquivos, ligar os 3 modos novos, Mosca, botão de música | ❌ **Não.** Pode ser feita hoje |
| **9B — Cenários** | Campo `Aula.background` e troca automática por aula | ✅ Sim — o campo vive no modelo que a Demanda 1 reescreve |

> **Faça a 9A primeiro.** Ela entrega valor visível de imediato e não cria
> retrabalho. A 9B espera a fundação, senão o campo seria criado duas vezes.

**A boa notícia:** a API do motor novo é **retrocompatível**. `createKevinPuppet`,
`setMode` e `setAudioInput` mantêm a mesma assinatura. O adaptador
`static/js/kevin-puppet-integration.js` continua funcionando — inclusive o
`createTtsAudioInput`. **É substituição de arquivo, não reescrita.** As animações
que já existem continuam funcionando por construção.

### 9.1 O que chegou no `export_2`

| | Antes | Depois |
|---|---|---|
| Modos | 4 — `off`, `standby`, `thinking`, `speaking` | **7** — \+ `sleeping`, `musica`, `tchau` |
| Motor JS | 60 KB | 104 KB |
| SVG | 2,7 MB | 6,6 MB ⚠️ |
| Backgrounds | 1 (floresta) | **7** \+ vídeo de transição |
| Extras | — | **Mosca** · `setBackground()` |

**Os 3 modos novos:**

- **`sleeping`** — olhos fechados, cabeça pende, respiração no agachamento,
  letras "Z" subindo (CSS `.kevin-sleep-z`)
- **`musica`** — 4 fases: pega o ukulele, passa o braço atrás do tronco, acomoda,
  e entra em loop dedilhando com notas musicais subindo. Lipsync ativo
- **`tchau`** — gesto de disparo único: acena 3 vezes e **volta sozinho** para
  `off`

**A Mosca** — não é um modo. Roda **por cima de qualquer modo ativo**. Kevin
segue com os olhos e a cabeça; quando ela entra no alcance da boca, a língua
dispara para capturá-la. API: `startMosca()`, `dismissMosca()`, `isMoscaActive()`.

**Os 7 cenários** — `floresta`, `quarto`, `banheiro`, `escola-int`, `escola-ext`,
`hospital`, `hospital-int`. Troca com `setBackground(url)`, que anima uma
transição em vídeo e resolve a Promise ao terminar.

### 9.2 Comportamento decidido

#### Ociosidade — standby ⇄ mosca → dormindo

```
standby ──── a cada 40–90s ────▶ mosca (por cima do standby)
   │                               │
   │         captura ou dismiss ◀──┘
   │
   └──── ~5 min sem interação ────▶ sleeping
                                       │
              professor interage ──────┘  (corte seco, acorda na hora)
```

**Por que ~5 minutos:** durante a aula, silêncio é normal — o professor passa 10
minutos conduzindo um jogo sem falar com o Kevin. Dormir cedo demais significa o
assistente cochilando na frente de 20 crianças. Cinco minutos é longo o
suficiente para não pegar o professor no meio de uma atividade, e curto o
suficiente para a animação acontecer de verdade num intervalo.

**Por que 40–90s para a mosca:** frequente o bastante para dar vida a um telão
que fica ligado a aula inteira, rara o bastante para não virar ruído visual.

#### Interrupção — o professor fala e o Kevin está ocupado

| Estado | O que fazer |
|---|---|
| **Mosca ativa** | **Nada.** A mosca roda por cima de `thinking`/`speaking`. Kevin muda a postura e continua acompanhando com os olhos — é o comportamento padrão do motor |
| **`sleeping`** | Corte seco. `setMode("thinking")` direto. Acordar de susto é natural; o professor espera resposta, não coreografia |
| **`musica`** | Chamar `setMode("thinking")` e **deixar o motor animar a saída** (M4 → exit_m2 → exit_m1, devolvendo o ukulele). Leva alguns segundos, mas cortar no meio do movimento fica feio e não ganha tempo real |

> ⚠️ `setMode()` retorna imediatamente, mas ao sair da `musica` o efeito visual
> demora. Não assuma que o modo já trocou na tela quando a Promise resolve.

#### Música — em duas fases

**Fase 1 (agora):** botão manual no telão — "Kevin, canta!". O professor aciona
quando quiser. Não depende de nada.

**Fase 2 (após a Demanda 1):** o bloco `Songs Collection` do roteiro dispara
automaticamente, com o áudio vindo de `Atividade.arquivo_url`.

**Por que em duas fases:** `Songs Collection` aparece no Warm Up de **todas** as
12 aulas do TG de março — é rotina fixa da metodologia, e o gatilho natural é o
roteiro. Mas a animação de música é a mais elaborada que o animador entregou;
seria desperdício ela só existir depois da remodelagem inteira do banco.

> ⚠️ **Sobre o áudio:** o `Y5U1.mp3` em `documento_escola/` **não é uma música** —
> é a faixa de listening da prova (diálogos do Mr. Bloom). Serve para testar o
> lipsync, não como caso de uso real.
>
> ⚠️ **YouTube não funciona** para o lipsync: `createMediaElementSource` não
> alcança um iframe. O áudio precisa ser um arquivo em `<audio>`.

### 9.3 Onde cada arquivo vai morar

| Arquivo | Destino | Motivo |
|---|---|---|
| `kevin-puppet.js`, `.css` | ✅ Git | É código |
| `kevin-rigged.svg` | ✅ Git | Acoplado ao motor — o JS identifica as partes **pelos `id`** do SVG. Precisam versionar juntos |
| Backgrounds, vídeo de transição | ☁️ Storage externo (R2) | Conteúdo; crescem a cada entrega. `Aula.background` guarda a referência |
| `export_*.zip` | ❌ Nunca no Git | Já no `.gitignore` |

**Por que mídia fora do Git:** o Git guarda cada versão de binário integralmente,
para sempre — não faz delta como em texto. Três entregas do animador = ~60 MB
permanentes no histórico, mesmo deletando os arquivos depois.

### 9.4 Modelo de dados (parte 9B)

```
Aula
  └── background    choices: floresta | quarto | banheiro | escola-int
                             escola-ext | hospital | hospital-int
                    default: floresta
```

Cenário é **escolha pedagógica**, não decoração: casa com o vocabulário da aula.
"Daily routines" pede quarto/banheiro; "school objects" pede escola; "at the
doctor" pede hospital.

> ❓ **Pendente de validação com o cliente:** quem decide qual cenário para qual
> aula? São 7 cenários e ~100 aulas por Year. Provavelmente o coordenador
> escolhe ao cadastrar o TG, mas o mapeamento vocabulário → cenário é decisão
> pedagógica da Bebelingue.

### 9.5 Histórias de usuário

> **Como professor**, quero que o Kevin pareça vivo enquanto espero
> **por meio de** animações de ociosidade variadas, **para que** a tela projetada
> não pareça travada na frente da turma.

> **Como professor**, quero que o Kevin adormeça após muito tempo parado
> **por meio do** modo `sleeping`, **para que** eu perceba que ele está ocioso e
> a turma ache graça.

> **Como professor**, quero que o Kevin cante com o ukulele **por meio de** um
> botão no telão, **para que** o momento de música da aula tenha o personagem
> participando.

> **Como coordenador da Bebelingue**, quero definir o cenário de cada aula
> **por meio de** um campo no cadastro, **para que** o fundo combine com o
> vocabulário sendo ensinado.

### 9.6 Riscos

**R5 — Peso dos assets.** O SVG novo tem 6,6 MB (dobrou) e comprime mal — gzip
só chega a 5,1 MB. O Kevin **só aparece depois de baixar o arquivo inteiro**, e
ele é o elemento central da tela. Com um background, o primeiro carregamento
passa de ~8,6 MB.

**Decisão:** implementar com os assets como estão. O animador já foi alinhado
para que as próximas entregas venham mais leves (export do Illustrator com
precisão decimal reduzida e sem metadata de edição).

**Mitigações disponíveis:**
- `whitenoise` comprime automaticamente em produção
- Converter backgrounds para WebP: ~2 MB → ~300 KB cada
- Pré-carregar o background da próxima aula

> ⚠️ **Se rodar SVGO, use `cleanupIds: false`.** O motor identifica elementos
> pelos `id` (`Mão_Ukulele`, `Cabeça_`, `Prop_`). Minificar IDs quebra tudo.

### 9.7 Critérios de aceite

**Parte 9A — motor**

- [ ] Modos antigos (`standby`, `thinking`, `speaking`) continuam idênticos
- [ ] Lipsync do TTS continua funcionando (o adaptador atual não foi reescrito)
- [ ] `sleeping` entra após ~5 min sem interação, com as letras "Z"
- [ ] Mosca aparece a cada 40–90s durante o standby
- [ ] Digitar durante a mosca troca o modo **sem** interromper a mosca
- [ ] Acordar do `sleeping` é imediato
- [ ] Botão de música toca o ukulele com lipsync
- [ ] Sair da música devolve o ukulele antes de assumir o novo modo
- [ ] Nenhum erro de console ao alternar entre todos os 7 modos

**Parte 9B — cenários**

- [ ] `Aula.background` existe com os 7 cenários e default `floresta`
- [ ] O telão carrega o cenário da aula aberta
- [ ] Transição em vídeo roda ao trocar de cenário
- [ ] Backgrounds servidos do storage externo, não do Git

---

## Demanda 10 — Retrabalho da animação do Kevin (URGENTE)

> ## 🟡 PARCIALMENTE RESOLVIDA — enquadramento OK, esqueleto AINDA aparece
>
> **Parte 1 (resolvida, 23/07):** o Kevin ficava cortado pela barra de controles.
> Corrigido com faixa segura inferior no `.kevin-puppet-host` (`--controls-safe`).
> Kevin agora aparece inteiro. Validado em desktop e mobile.
>
> **Parte 2 (PENDENTE):** o cliente reportou (com screenshot no modo música) que o
> **esqueleto continua desenhado por cima do Kevin** — as linhas e círculos das
> juntas (ombros, cotovelos, joelhos, pulsos) ficam visíveis. Isto NÃO era efeito
> do corte; é um bug real do export_2. Ver 10.5 para a causa e a correção exata.
>
> Decisões do cliente: mosca/língua ficam como o animador entregou; animação de
> entrada da floresta fica com o animador (não feita aqui).

**Objetivo:** deixar a animação do Kevin no mínimo tão boa quanto era antes do
export_2, corrigindo os defeitos abaixo.

### 10.1 Defeitos observados (teste real, com screenshot)

| # | Defeito | Diagnóstico inicial |
|---|---|---|
| A | **Esqueleto exposto** — linhas tracejadas marcando corpo, braços e juntas | O motor tem `bonesGroup` que deveria ficar oculto (o README garante isso). Está sendo desenhado. Ver `initDefaultVisibility` e o CSS do puppet |
| B | **4 mãos** — o Kevin aparece com mãos a mais | Variantes de mão (`Mão_Ukulele`, `Mão_tchau`) não estão sendo escondidas quando não usadas |
| C | **Mosca aparece na abertura** — "o vilão" já está lá ao abrir a aula | A mosca deveria surgir só em ociosidade (40-90s). Está iniciando junto. Bug na condição de start |
| D | **Língua mal implementada / dispara toda hora** | Os frames da língua (`lingua_frame_*`) estão ruins; o intervalo de captura é curto demais. Precisa demorar muito mais entre disparos |
| E | **Não dá para ver a mosca direito** | Relacionado a C/D — a animação da mosca está confusa |
| F | **Música não faz nada** ao clicar | `setMode('musica')` provavelmente retorna `false` (sem permissão de áudio / sem gesture). Precisa funcionar mesmo sem faixa de áudio |
| G | **Sem animação de entrada** — a floresta não "abre" para revelar o Kevin | **Não existe no motor.** É feature nova, não regressão — ver 10.3 |

### 10.2 História de usuário

> **Como professor**, quero abrir a aula e ver o Kevin bem desenhado e parado,
> **sem** esqueleto à mostra, mãos extras ou mosca, **para que** eu não me
> envergonhe na frente da turma.

### 10.3 Abordagem sugerida

1. **Primeiro: fazer o motor novo parecer o antigo em standby** — esqueleto
   oculto (A), uma mão só por lado (B), sem mosca na abertura (C), sem ukulele
   ao abrir. Um Kevin parado e correto vale mais que um cheio de features quebradas.
2. **Ajustar a mosca (C, D, E):** só em ociosidade real, intervalo bem maior
   entre disparos de língua, frames revisados. Se não ficar bom rápido, **cortar
   a mosca** — ela é enfeite, não requisito.
3. **Corrigir a música (F):** garantir que `setMode('musica')` funcione; tratar o
   retorno `false` e destravar o áudio antes.
4. **Animação de entrada (G):** NOVA — a floresta/cenário "abre" (cortina, fade
   ou zoom) revelando o Kevin quando a aula inicia. Escopo próprio; não bloqueia
   o resto.
5. **Plano B explícito:** se após o retrabalho a animação ainda estiver ruim,
   **reverter para o motor anterior** (está no histórico do Git, commit anterior
   ao 9A). O cliente foi claro: o antigo é melhor que o atual quebrado.

### 10.4 Critérios de aceite

- [x] Ao abrir a aula: Kevin **inteiro** (não cortado pela barra) — feito
- [ ] 🔴 **Esqueleto (bones) nunca visível em nenhum modo** — PENDENTE, ver 10.5
- [x] Botão de música toca a animação do ukulele (visível após o fix de enquadramento)
- [ ] Mosca/língua: manter como o animador entregou (decisão do cliente)
- [ ] Animação de entrada: responsabilidade do animador (não aqui)

### 10.5 🔴 PENDENTE — esconder o esqueleto (bones)

**Sintoma:** o cliente enviou screenshot (modo música) com as linhas e círculos
das juntas — ombros, cotovelos, joelhos, pulsos, pelve — desenhados por cima do
Kevin.

**Causa raiz (investigada):** o motor (`kevin-puppet.js`, `initDefaultVisibility`,
~linha 1389) esconde **apenas `Pulso_bone1`**. Mas o SVG tem **22 elementos de
bone** (`Ombro_bone`, `Cotovelo_core_bone`, `Joelho`, `Biceps_bone`,
`Right_pelvis_Bone`…), agrupados sob 5 grupos-pai:
`Bones_Body`, `Bones_Left_Arm`, `Bones_Right_Arm`, `Bones_Right_leg`,
`Bones_Right_leg1`. O motor não esconde esses grupos. O README do export_2
prometia "esqueleto sempre oculto" — o export **não cumpre**.

**Fato que torna a correção segura:** os bones são `<circle>`/`<line>` com a
**classe `st36`**, dentro dos grupos `Bones_*`. São puramente decorativos —
separados do mesh do corpo. Escondê-los **não afeta** o desenho do Kevin.

**Correção recomendada (CSS — 1 regra, não toca o motor):**

```css
/* Esconde o esqueleto de referência que o export_2 deixou visível.
   Os bones são class="st36" dentro dos grupos Bones_*. */
#kevin-rig-mount [id^="Bones_"],
#kevin-rig-mount .st36 {
  display: none !important;
}
```

Colocar em `static/css/style.css` (junto do bloco do telão) ou em
`kevin-puppet.css`. Preferir CSS a mexer no motor, para não quebrar na próxima
entrega do animador.

> ⚠️ **Validar que `st36` é só bone.** Antes de aplicar, confirmar no SVG que a
> classe `st36` não é usada por nenhuma parte visível do corpo (a inspeção
> inicial mostrou só circle/line de junta). Se houver risco, usar apenas o
> seletor `[id^="Bones_"]`, que é 100% seguro (são os grupos-pai do esqueleto).

**Alternativa (JS):** ampliar `initDefaultVisibility` para esconder os grupos
`Bones_*`. Mais invasivo; some se o animador reexportar. CSS é preferível.

**Pedir ao animador (paralelo):** que o próximo export **não inclua os bones**
como elementos renderizáveis (ou os marque `display:none` na origem). Isso
elimina o problema na fonte.

**Critério de aceite:** em nenhum modo (standby, música, dormindo, pensando)
aparece qualquer linha/círculo de junta sobre o Kevin.

---

## Demanda 11 — Ajustes do telão (aula)

**Status:** ✅ Aprovada
**Objetivo:** corrigir comportamentos e visual dos controles da tela da aula.

### 11.1 Botão de música condicional

Hoje o botão de música aparece em toda aula. **Deve aparecer só quando a aula
tem música** (um bloco/atividade de música no roteiro). Sem música na aula, sem
botão.

> Implementação: a view já tem os blocos da aula; expor ao template se existe
> atividade de tipo música/rotina de canção, e renderizar o botão condicionalmente.

### 11.2 Botão de abrir chat — visual

O botão de abrir o chat (FAB) **está feio**. Rever o visual para combinar com o
resto do telão.

### 11.3 Concluir aula → popup de dados + sair

Hoje "Concluir" **reinicia a aula** (bug) e não coleta dados. O correto:

1. Clicar em **Concluir** abre um **popup/modal** pedindo os dados da aula:
   - **Quantos alunos foram** (presença)
   - Outras informações necessárias para analisar o desempenho do professor
     (a definir — ligado à Demanda 4 / métricas)
2. Após preencher e confirmar, marca a aula como concluída **e leva o professor
   para fora — de volta à tela de aulas da turma** (não fica na aula).

> Isto conecta com D22 (concluir = 1 clique, presença opcional): revisar. O
> cliente agora quer **coletar presença na conclusão** via popup, não deixar
> totalmente opcional. Presença vira parte do fluxo de conclusão.

### 11.4 Histórias de usuário

> **Como professor**, quero que o botão de música só apareça quando a aula tem
> música, **para que** a interface não ofereça o que não faz sentido.

> **Como professor**, quero que ao concluir a aula o sistema me pergunte quantos
> alunos vieram e me leve de volta à lista de aulas, **para que** o registro de
> desempenho fique completo e eu siga para a próxima.

### 11.5 Critérios de aceite

- [ ] Botão de música só aparece em aulas com música
- [ ] FAB do chat com visual revisado
- [ ] Concluir abre popup de presença + dados; não reinicia a aula
- [ ] Após concluir, redireciona para a lista de aulas da turma

---

## Demanda 12 — Background por aula não está funcionando

**Status:** ✅ Aprovada
**Objetivo:** fazer o cenário de fundo mudar de fato conforme a aula (Demanda 9B).

### 12.1 O problema

Testado: a primeira aula, a aula em andamento e a de St. Patrick's Day
**mostraram todas o mesmo fundo**. Ao entrar numa aula "fora da escola", o
background não mudou.

O campo `Aula.background` existe e o template passa `window.KEVIN_BACKGROUND`,
mas o motor **não está consumindo** esse valor — provavelmente ainda usa o
`backgroundUrl` fixo do `KEVIN_RIG_CONFIG`, e os assets de cenário nem foram
ligados (estão fora do Git, destino R2).

### 12.2 Solução

- A integração deve ler `window.KEVIN_BACKGROUND` e chamar `setBackground()` com
  a URL do cenário correspondente ao carregar a aula.
- Mapear a chave (`quarto`, `escola-ext`…) para a URL do asset.
- Enquanto os assets não estão no R2, servir localmente de `assets/backgrounds/`.

> Esta é a parte 9B da Demanda 9, que ficou pendente. Ver Demanda 9, seção 9.4.

### 12.3 Critérios de aceite

- [ ] Aulas com `background` diferente mostram fundos diferentes
- [ ] Trocar de aula troca o cenário
- [ ] (Quando houver R2) assets servidos do storage externo

---

## Demanda 13 — Seed só com currículo da Bebelingue

**Status:** ✅ Aprovada
**Objetivo:** o seed de demonstração não deve ter aulas criadas por escolas.

### 13.1 O problema

O `seed_demo` cria uma atividade **local de escola** ("Quiz do Bernoulli") para
demonstrar o isolamento. O cliente pediu para **remover** isso: o seed deve ter
**apenas conteúdo oficial da Bebelingue**. Currículo e catálogo são da
Bebelingue; escola não cria aula.

### 13.2 Solução

- Remover a atividade local "Quiz do Bernoulli" do `seed_demo`.
- Todo o catálogo do seed fica com `escola=None` (oficial).
- Ajustar o roteiro de apresentação (`ROTEIRO_APRESENTACAO.md`) que mencionava o
  Quiz do Bernoulli — o passo de "atividade local" sai ou vira menção verbal.

> **Nota:** a *capacidade* de o professor criar atividade local continua no
> sistema (Decisão D6) — o que muda é só o dado de demonstração, que não deve
> exibir isso.

### 13.3 Critérios de aceite

- [ ] `seed_demo` não cria nenhuma atividade com `escola` preenchida
- [ ] Roteiro de apresentação atualizado

---

## Demanda 14 — Suíte de testes automatizados

**Status:** ✅ Implementada
**Objetivo:** cobrir as funcionalidades das demandas com testes que rodam sem
depender de navegador nem de chave de IA.

### 14.1 O que existe

Testes com `django.test.TestCase` (sem dependência nova — roda com `manage.py
test`). **30 testes**, distribuídos:

| Arquivo | Cobre |
|---|---|
| `apps/curriculo/tests.py` | Código da aula (Y5-MAR-W1C1), catálogo + isolamento, contexto do Kevin expandindo atividades, kickoff, `tem_musica`, blocos, frequência 3x/4x, execução |
| `apps/accounts/tests.py` | Os 4 papéis, `escola`→`diretor`, redirect por papel, coordenador no admin sem loop, professor barrado |
| `apps/escolas/tests.py` | Busca no catálogo com isolamento, conclusão com presença + redirect para a lista, telão carrega com background |

### 14.2 Como rodar

```bash
# tudo
docker compose exec web python manage.py test

# um app
docker compose exec web python manage.py test apps.curriculo

# um teste específico
docker compose exec web python manage.py test apps.escolas.tests.ConclusaoAulaTest
```

### 14.3 O que NÃO cobre (e por quê)

- **Animação do Kevin** — é visual, roda no browser. Validada manualmente com
  Playwright (screenshots), não em teste unitário.
- **Chamadas reais de IA/TTS/STT** — dependem de chave paga. O fluxo de chat é
  testado até o ponto de montar o contexto.

### 14.4 Critérios de aceite

- [x] `manage.py test` roda verde, sem dependência externa
- [x] Cobre modelo, permissões, isolamento, frequência, busca, conclusão
- [x] Documentado como rodar

---

## Decisões registradas

Decisões tomadas na sessão de alinhamento. **Não reabrir sem discussão** — cada
uma tem consequência em cascata sobre as demais.

| # | Decisão | Alternativa rejeitada | Motivo |
|---|---|---|---|
| **D1** | Currículo **global** (Bebelingue) + execução **local** (turma) | Currículo por escola, editável | A metodologia é o produto que a Bebelingue vende. Editável por escola = perda de padronização e vazamento de propriedade intelectual |
| **D2** | Chave da aula = `Year + Mês + Semana + Aula`; `unit` vira atributo | Manter `Year+Unit+Week+Class` | O TG real é indexado por mês (`MAR W1C1`). Unit atravessa o mês; usá-la como chave não espelha o material do cliente |
| **D3** | Duas tabelas: `Aula` (TG) + `AulaTurma` (execução) | Uma tabela só | Data real, professor e presença são da turma, não da aula. Sem isso, "quantas aulas o professor deu em abril" é irrespondível |
| **D4** | Fase → `BlocoAula` ordenado, com FK opcional pro catálogo | Manter 3 `TextField`; ou tipar forte por tipo de aula | Texto livre não deixa o Kevin conhecer a atividade. Tipagem forte por tipo engessa — a aula de St. Patrick's não cabe em molde |
| **D5** | `Atividade` unificada com campo `tipo` | Modelos separados (`Jogo`, `Tecnica`, …) | Busca global (D6) sobre uma tabela só; `BlocoAula` aponta para uma FK só. Custo: campos nulos por tipo — aceitável |
| **D6** | Catálogo oficial (coordenador) + local por escola (professor) | Comunitário global; ou só coordenador | Protege a metodologia proprietária sem transformar o professor em espectador |
| **D7** | **Sem seed.** Schema autoexplicativo | Pré-popular catálogo e TGs | Se o cliente não consegue preencher sozinho, o modelo está errado. Seed mascararia o problema |
| **D8** | Modelo `Aluno` **apagado**; `Turma.qtd_alunos` + `AulaTurma.presentes` | Manter `Aluno`; ou deprecar sem apagar | A escola não mede aluno. O dado que eles coletam é ATTENDANCE por aula. Protótipo com backup — hard delete liberado |
| **D9** | Role `escola` → `diretor`; novo role `coordenador` | Coordenador como superuser | Papel pedagógico não deve implicar acesso técnico irrestrito |
| **D10** | Contexto do Kevin = blocos + atividades **daquela aula** | Catálogo inteiro; ou só texto sem expandir | Resolve o caso "Kevin conhece o Simon Says" sem inflar token. API é paga por token |
| **D11** | **Professor é o interlocutor principal**; a turma participa em momentos que ele abre e fecha | Kevin dirigido à turma; ou Kevin exclusivo do professor | É como a aula acontece de verdade: o professor conduz por áudio e media a interação das crianças |
| **D12** | O prompt do Kevin vive **só** em `apps/chat/` | Espalhado em protótipos (`exemplo/server.py`) | Duas fontes de verdade divergem em silêncio. `exemplo/` é protótipo descartável, não referência |
| **D13** | Regras pedagógicas do prompt (idioma, tom) são **configuráveis**, não hardcoded | Fixas no código | São decisão de metodologia, não de engenharia. Mudar não deve exigir deploy — ver Demanda 8 |
| **D14** | Cenário de fundo é escolhido **por aula** (`Aula.background`) | Por Unit; por bloco; ou fixo | Cenário é pedagógico — casa com o vocabulário. Por Unit desperdiça a granularidade dos 7 cenários; por bloco cobra caro no cadastro |
| **D15** | Mosca a cada 40–90s · dorme após ~5 min | Mais agressivo (2 min) ou mais discreto (10 min) | Silêncio de 10 min é normal durante a aula. Dormir cedo = assistente cochilando na frente da turma |
| **D16** | Interrupção: corte seco no `sleeping`; `musica` respeita a saída animada | Cortar tudo; ou sempre esperar | O motor já anima a saída da música sozinho. Atraso deliberado é professor parado na frente da turma |
| **D17** | Música em 2 fases: botão manual agora, automático pelo roteiro depois | Só manual; ou esperar a Demanda 1 | A animação mais elaborada do animador não deve esperar a remodelagem inteira do banco |
| **D18** | Código do puppet no Git; mídia em storage externo (R2) | Tudo no Git; ou tudo externo | Git guarda binário integralmente para sempre. O SVG fica porque é acoplado aos `id` que o motor usa |
| **D19** | Frequência via `Aula.frequencia_minima` (3/4/5), cadastro único | Três TGs completos por Year/mês; ou tabela separada de extras | Cliente confirmou: o TG de 4x **é** o de 3x + uma Communication. Cadastro triplicado obrigaria a replicar toda correção 3× |
| **D20** | Yearly Plan no sistema + retrato automático; RMP segue como reunião | Só o retrato; ou digitalizar o RMP inteiro | O "previsto" é **acordado**, não calculado — vem do Yearly Plan. O sistema elimina a digitação manual do forms, mas não substitui a conversa |
| **D21** | Navegação: card "próxima aula" + grade do mês | Lista cronológica; só o card; ou calendário | Com ~100 aulas por Year, o professor às 14h quer a aula de hoje em 1 clique — sem perder a opção de voltar ou adiantar |
| **D22** | Concluir aula = 1 clique; data e professor automáticos; presença opcional | Sem campo algum; ou formulário obrigatório | Melhor 100% de aulas marcadas com 30% de presença do que 40% de tudo. Data e professor o sistema já sabe |

---

## Considerado e adiado

**Versionamento do TG.** `AulaTurma` apontaria para a *versão* do TG vigente
quando a aula foi dada. Resolveria o risco R1. Adiado por custo x benefício no
momento — reabrir quando a Bebelingue precisar revisar TGs de anos anteriores
mantendo histórico fiel.

**Aluno nominal e avaliações.** O material inclui a avaliação de unidade
(`Y5 - test U1.docx` + gabarito + áudio), com questões tagueadas por
`Vocabulary / level 1`, `Ability: circle`, `CLIL / level 1`. É um produto
inteiro — banco de questões, correção, notas por aluno. Fora de escopo porque a
escola declarou não medir aluno. Reintroduzir `Aluno` depois é migração aditiva,
barata. Reabrir se o cliente pedir boletim ou relatório para pais.

**Kevin com consciência de posição na aula.** O Kevin saber em qual bloco a aula
está *neste momento*, e não só a sequência completa. Exige rastreio em tempo real
na UI. Reabrir depois que a Demanda 3 estiver em uso e soubermos se o professor
sente falta.

---

## Riscos aceitos

**R1 — Revisão de TG reescreve o passado.** Sem versionamento (D3), se a
Bebelingue editar a aula `Y5-MAR-W1C1`, o roteiro muda também para turmas que já
a deram. Relatórios históricos passam a referenciar um roteiro diferente do que
foi executado. **Aceito conscientemente.** Mitigação: orientar a coordenação a
criar aula nova em vez de editar aula já dada em larga escala.

**R2 — Migração destrutiva.** Os roteiros em texto livre dos dados de demo se
perdem (passo 1.5.4). Aceito: é protótipo, existe backup, o cliente ainda não
populou dados reais.

**R3 — Catálogo vazio no dia 1.** Consequência direta de D7 (sem seed). A
primeira aula cadastrada exige criar as atividades antes. Aceito: é o teste real
de que o schema é autoexplicativo. Mitigação: acompanhar o primeiro cadastro do
coordenador de perto e tratar o atrito observado como bug de modelagem.

**R4 — Custo de token cresce com a expansão do catálogo.** Aulas com muitos
blocos geram contexto maior que o de hoje. Mitigação na Demanda 3: medir tokens,
otimizar o prompt, e reavaliar se aula com muitos blocos estourar o orçamento.
