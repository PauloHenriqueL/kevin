# Perguntas para a reunião — validação do modelo de dados (Kevin v2)

> **Contexto:** estamos remodelando o banco de dados do Kevin para refletir a
> metodologia real da Bebelingue (ver [demandas.md](demandas.md)). Ao escrever as
> demandas, **tivemos que deduzir** várias coisas a partir dos arquivos que vocês
> nos passaram. Esta pauta lista essas deduções para confirmação.
>
> **Atualizado em 23/07/2026** — 5 perguntas já foram respondidas por WhatsApp
> (ver quadro abaixo). Elas continuam no corpo do documento, marcadas com ✅.

---

## ⚡ Status rápido — o que já sabemos e o que ainda falta

### Já respondido pelo cliente (WhatsApp, 23/07)

| # | Pergunta | Resposta | Efeito |
|---|---|---|---|
| 2.6 | TG é igual para todas as escolas? | **Sim**, adaptação quase irrelevante | ✅ Currículo global — implementado |
| 1.1 | O que é o "3x"? | Frequências **3x/4x/5x**; 4x = 3x + 1 Communication | ✅ `frequencia_minima` — implementado |
| 3.1 | Existe lista de regras dos jogos? | **Sim — "Games Bank"** no início do TG | ⏳ Falta receber o arquivo |
| 3.2 | E o BeBooklet (técnicas)? | **Também no início do TG** | ⏳ Falta receber o arquivo |
| 5.1 | Como sabem que um professor atrasou? | **RMP** mensal + **Yearly Plan Review** | ⏳ Falta receber os modelos |

### Ainda falta receber (bloqueia trabalho)

- [ ] 🔴 **TG completo** (com Games Bank + BeBooklet) — sem ele o catálogo do Kevin nasce vazio
- [ ] **Modelo de RMP** e **Yearly Plan Review** — destravam as métricas de professor (Demanda 4)

### Perguntas que ainda valem para esta reunião

As respondidas acima estão fechadas. **Priorize agora:**

1. **§9 (Class Feedback)** — a demanda inteira depende desta conversa. É avaliação
   de desempenho de pessoa; queremos definir quem vê o quê antes de construir.
2. **Cenários de fundo** (NOVA, ver §10) — quem escolhe qual cenário para qual aula.
3. **§7.1** — confirmar que aluno nominal não é necessário (já implementamos assim).
4. As demais 🔴 do corpo que não foram respondidas.

---

## 1. Calendário e ritmo das aulas

> **Por que este bloco é crítico:** decidimos que a aula passa a ser endereçada
> por **Year + Mês + Semana + Aula** (ex: `Y5-MAR-W1C1`), porque é assim que o TG
> de vocês é organizado. Toda a navegação do professor e todos os relatórios
> dependem disso estar certo.

### 1.1 ✅ A frequência de aulas por semana é sempre 3?

> **RESPONDIDO:** Não — existem TGs de 3x, 4x e 5x. O de 4x é o de 3x mais uma Communication Class. Implementado como `Aula.frequencia_minima`.

**Por quê:** o nome do arquivo é `... - March - 3x`.

**A pergunta:** o que significa o "3x"? Existem escolas com 2 aulas por semana?
A frequência é negociada por escola, por turma, ou é sempre a mesma?

**O que muda:** se for sempre 3, simplificamos o modelo. Se varia, o TG passa a
ter versões diferentes por frequência — bem mais complexo de cadastrar.

📝 **Resposta:**

<br>

---

### 1.2 🔴 Como funciona a Week 5 / "EXTRA CLASS"?

**O que deduzimos:** que é um slot de folga, sem roteiro obrigatório.

**Por quê:** no TG de março, a Week 5 tem "EXTRA CLASS" em duas colunas e a
terceira vazia. Não tem roteiro.

**A pergunta:** a Week 5 existe todo mês? É usada para reposição de feriado,
reforço, ou avaliação?

**O que muda:** se for previsível, a grade tem 5 semanas fixas. Se é usada para
prova, conecta com a seção 8.

📝 **Resposta:**

<br>

---

### 1.3 🔴 O que acontece quando a turma atrasa?

**O que deduzimos:** que cada turma percorre o TG no ritmo dela — por isso
separamos "o TG" (`Aula`) da "execução" (`AulaTurma`, com data real).

**Por quê:** feriado, professor doente e semana de prova acontecem.

**A pergunta:** quando uma turma perde uma aula, o que vocês fazem na prática?

1. Repõem em outro dia e seguem o TG na ordem
2. Pulam aquela aula e seguem o calendário (a aula é perdida)
3. Comprimem duas aulas em uma
4. Depende — e quem decide?

**O que muda:** define se o professor precisa marcar aula como "pulada"
(diferente de "ainda não dada"), e como calculamos atraso.

📝 **Resposta:**

<br>

---

### 1.4 🟡 Quando começa e termina o ano letivo?

**A pergunta:** o TG cobre quais meses? Fevereiro a novembro? Tem recesso de
julho? Todas as escolas seguem o mesmo calendário, ou cada uma tem o seu?

**O que muda:** sem a data de início do ano letivo de cada turma, não
conseguimos calcular "esta turma deveria estar na aula X hoje". Ver 5.1.

📝 **Resposta:**

<br>

---

## 2. Estrutura do TG

### 2.1 🔴 A lista de tipos de aula está completa?

**O que deduzimos:** quatro tipos — `Content Class`, `Communication Class`,
`Culture Class` e `Extra Class`.

**Por quê:** foram os que apareceram no TG de março. Mas o formulário de Class
Feedback menciona "Communication / Movement Class" e "CLIL Project / Festival",
que podem ser tipos adicionais ou subdivisões.

**A pergunta:** existem outros tipos? "Movement Class" é o mesmo que
"Communication Class"? "CLIL Project" e "Festival" são tipos próprios?

**O que muda:** o tipo determina o formato do roteiro e, na Demanda 5, o
checklist de observação. Errar aqui obriga a mexer no cadastro depois.

📝 **Resposta:**

<br>

---

### 2.2 🔴 O Warm Up é sempre a mesma estrutura?

**O que deduzimos:** que sim — 3 itens, sendo `BeCalendar` e `Songs Collection`
fixos, variando só o jogo de correção de HW.

**Por quê:** nas 12 aulas do TG de março o padrão se repete sem exceção (única
variação: na aula de St. Patrick's há um 4º item).

**A pergunta:** confirma que o Warm Up é sempre BeCalendar + Songs Collection +
jogo?

**O que muda:** se for fixo, pré-montamos o Warm Up no cadastro de aula nova (o
coordenador só escolhe o jogo) — economiza muito tempo dele.

📝 **Resposta:**

<br>

---

### 2.3 🟡 O "I Can Routine" é obrigatório em toda Content Class?

**O que deduzimos:** que sim.

**Por quê:** aparece em todas as Content Classes do TG, sempre no fim do
Development, sempre com o mesmo texto.

**A pergunta:** é regra ou coincidência do mês de março? Aparece em Culture
Class também?

**O que muda:** mesma lógica de 2.2 — se é regra, pré-montamos.

📝 **Resposta:**

<br>

---

### 2.4 🟡 Homework é da aula ou da semana?

**O que deduzimos:** que é da aula específica.

**Por quê:** no CSV a linha "Homework" vem embaixo de cada semana, com uma coluna
por aula — mas várias ficam vazias.

**A pergunta:** o HW é atribuído numa aula específica e corrigido na seguinte?
O que significa a observação "*it must be assigned this class*"?

**O que muda:** se o HW pertence à semana, muda a modelagem. E entender o ciclo
"atribui numa aula → corrige na próxima" ajuda o Kevin a saber o que cobrar.

📝 **Resposta:**

<br>

---

### 2.5 🟢 Como funcionam as aulas sazonais?

**O que deduzimos:** que são aulas normais com uma observação especial.

**Por quê:** a W3C3 de março é St. Patrick's Day, com "*Suggestion: in advance,
invite students to wear green*" e um jogo temático ("Let's Catch a Leprechaun").

**A pergunta:** quantas datas sazonais existem no ano? São fixas no TG ou o
professor pode trocar? Se a escola não quiser comemorar, substitui por quê?

📝 **Resposta:**

<br>

---

### 2.6 ✅ O TG é o mesmo para todas as escolas?

> **RESPONDIDO:** Sim. Toda escola que usa o Year 1 recebe o mesmo TG; adaptação é quase irrelevante. Currículo modelado como global.

**O que deduzimos:** que sim — currículo global, definido pela Bebelingue, e a
escola não edita.

**Por quê:** é a metodologia que vocês vendem; padronização é o valor.

**A pergunta:** alguma escola pede adaptação? Vocês já entregaram TG diferente
para clientes diferentes no mesmo Year?

**O que muda:** se houver adaptação por escola, a modelagem inteira do currículo
muda (deixa de ser global). **É a decisão mais cara de reverter.**

📝 **Resposta:**

<br>

---

### 2.7 🟡 O que acontece quando vocês revisam um TG?

**O que deduzimos:** que a revisão vale para todos imediatamente, e que está tudo
bem o roteiro de uma aula já dada mudar retroativamente.

**Por quê:** decidimos não versionar o TG, para não encarecer a primeira versão.

**A pergunta:** com que frequência vocês revisam? É comum corrigir o TG do mês
que já está rodando? Vocês precisam saber depois qual era a versão que o
professor usou naquele dia?

**O que muda:** se precisarem de histórico fiel, temos que versionar o TG —
retrabalho grande se descobrirmos tarde. Registrado como risco R1.

📝 **Resposta:**

<br>

---

## 3. Catálogo de atividades

> **Contexto:** decidimos que jogos (`Simon Says`), técnicas (`Sandwich
> Technique`), rotinas (`BeCalendar`) e recursos (`Student's Book`) viram um
> catálogo único e reutilizável. É isso que permite o Kevin conduzir uma
> atividade que ele conhece, em vez de inventar.

### 3.1 ✅ Existe uma lista oficial de jogos?

> **RESPONDIDO:** Sim — a seção **Games Bank**, no início do TG. ⏳ Falta a Bebelingue enviar o arquivo.

**O que deduzimos:** que sim, e que ela é maior que o TG de março.

**Por quê:** contamos **mais de 25 jogos distintos** só em março — Go and Touch,
2 Truths and 1 Lie, Hot Potato, Point and Say, Telephone, Tic-Tac-Toe, Hangman,
Password, Run to the Board, Simon Says, Stand up/Sit Down, Four Corners,
Pictionary, Ten Questions, Toss and Answer, Unscramble, Board Race, Dictation,
Dodgeball, Draw and Guess, Guess What, Little by Little, Memory Chant, Hot Seat,
Let's Catch a Leprechaun.

**A pergunta:** existe um documento com as regras desses jogos? Quantos são no
total? Quem escreveu?

**O que muda:** este é **o insumo mais importante** para o Kevin funcionar bem —
sem a regra escrita, ele não sabe conduzir. Se o documento existe, o cadastro
fica muito mais rápido. Se não existe, **alguém vai ter que escrever 25+ regras**
e precisamos combinar quem e quando.

📝 **Resposta:**

<br>

---

### 3.2 ✅ Onde está o "BeBooklet"?

> **RESPONDIDO:** Também no início do TG. ⏳ Falta a Bebelingue enviar o arquivo.

**O que deduzimos:** que é o documento que descreve as técnicas da metodologia.

**Por quê:** o Class Feedback cita duas vezes — "*see BeBooklet at the beginning
of the TGs*" — ao falar de Instant Translation, Correlation, Sandwich Technique e
das técnicas de repetição.

**A pergunta:** podem nos enviar o BeBooklet? Ele tem a descrição completa de
cada técnica?

**O que muda:** as técnicas vão para o catálogo e para o contexto do Kevin. Sem o
texto original, o Kevin descreveria a metodologia com palavras dele — exatamente
o problema que queremos resolver.

📝 **Resposta:**

<br>

---

### 3.3 🟡 Quais técnicas existem além das que vimos?

**O que deduzimos:** identificamos Sandwich Technique, Repetition Techniques
(3 grandes → 3 pequenos → 4 individuais), Instant Translation e Correlation.

**A pergunta:** a lista está completa? Tem outras? Elas têm hierarquia (uma
contém a outra)?

📝 **Resposta:**

<br>

---

### 3.4 🟡 O professor pode criar as próprias atividades?

**O que deduzimos:** que sim, mas separadas do catálogo oficial — a atividade
criada pelo professor fica visível só na escola dele, nunca no catálogo da
Bebelingue e nunca em outra escola.

**Por quê:** vocês mencionaram que o professor precisa se virar quando falta
conteúdo. Mas a metodologia é propriedade de vocês.

**A pergunta:** concordam com essa separação? Vocês gostariam de **ver** o que os
professores criam (para eventualmente promover ao catálogo oficial)? Ou preferem
que o professor nem possa criar?

📝 **Resposta:**

<br>

---

## 4. Quem cadastra o quê

### 4.1 🟡 Quantos coordenadores vão usar o sistema?

**O que deduzimos:** poucos — criamos um papel único de "Coordenador Bebelingue".

**A pergunta:** quantas pessoas na Bebelingue vão cadastrar TG e catálogo? Elas
têm responsabilidades diferentes (uma cuida do Year 1-3, outra do 4-5)?

**O que muda:** se houver divisão, talvez precisemos de permissão por Year.

📝 **Resposta:**

<br>

---

### 4.2 🔴 Quem cadastra as escolas, diretores e professores?

**O que deduzimos:** que a Bebelingue cadastra a escola e o diretor, e o diretor
cadastra os professores dele.

**A pergunta:** confirma? Ou vocês cadastram tudo, inclusive professores?

**O que muda:** define as permissões da área de gestão.

📝 **Resposta:**

<br>

---

### 4.3 🟡 Quanto tempo vocês têm para popular o sistema?

**Por quê:** decidimos **não fazer seed** — o sistema nasce vazio e vocês
preenchem. É proposital (garante que o cadastro é usável de verdade), mas
significa trabalho antes de começar a usar.

**A pergunta:** quando a primeira turma precisa estar rodando com o Kevin?
Quantos Years vocês querem cadastrar primeiro? Dá para começar com um Year só?

**O que muda:** define a ordem de entrega e se precisamos de importação em massa
(ex: subir o CSV do TG) em vez de cadastro manual.

📝 **Resposta:**

<br>

---

## 5. Métricas de professor

> **Contexto:** vocês disseram que **a métrica principal é a do professor**, não a
> do aluno. Separamos em duas: execução (automática, esta seção) e qualidade (o
> Class Feedback, seção 6).

### 5.1 ✅ O que significa "professor em dia"?

> **RESPONDIDO:** Medido no **RMP** (reunião mensal): o professor informa em que aula está, e o código revela o atraso. O previsto vem do **Yearly Plan Review**, montado no início do ano. ⏳ Falta receber os dois modelos.

> **Esta é a dedução mais frágil de todo o documento.**

**O que deduzimos:** que dá para comparar aulas dadas com aulas previstas na data
de hoje — mas **não temos como saber a data prevista**, porque não sabemos quando
o ano letivo começa nem como vocês contam atraso. Chutamos derivar de "início do
ano letivo + frequência semanal", mas é suposição nossa.

**A pergunta:** como vocês sabem hoje que um professor está atrasado? O que vocês
olham? Alguém compara alguma coisa manualmente? O que é "atraso aceitável" — uma
aula? Duas semanas?

**O que muda:** define completamente o relatório da Demanda 4. Se vocês pensam em
"está na Unit certa para o mês", é uma conta. Se pensam em "deu 12 aulas em
março", é outra. Se ninguém acompanha isso hoje, talvez a métrica certa seja
outra — e queremos descobrir qual antes de construir.

📝 **Resposta:**

<br>

---

### 5.2 🟡 A presença é registrada por aula?

**O que deduzimos:** que sim.

**Por quê:** o Class Feedback tem o campo `ATTENDANCE: 20`, preenchido na
observação da Gabriela.

**A pergunta:** o professor conta os presentes toda aula? Isso é registrado em
algum lugar hoje? Serve para quê — cobrança, relatório para os pais, controle
interno?

**O que muda:** se for só do Class Feedback (quando o BeCoordie visita), não
precisa estar em toda aula.

📝 **Resposta:**

<br>

---

### 5.3 🟡 Quem vê as métricas de cada professor?

**O que deduzimos:** que o diretor vê os professores da escola dele, a Bebelingue
vê todas as escolas, e o professor vê só os próprios números.

**A pergunta:** confirma? O professor deve ver a própria métrica? Um professor
pode ver a de outro?

**O que muda:** é dado sensível — queremos acertar antes de expor.

📝 **Resposta:**

<br>

---

## 6. Class Feedback

> **Demanda parada aguardando esta conversa.** Mapeamos o formulário, mas não
> vamos implementar nada antes de entender o fluxo de trabalho do BeCoordie. É
> avaliação de desempenho de pessoa — queremos errar pouco aqui.

### 6.1 🔴 Como o BeCoordie trabalha hoje?

**A pergunta:** ele preenche o formulário **durante** a aula, com o notebook
aberto? Depois, de memória? Anota no papel e digita à noite?

**O que muda:** se for durante a aula, a tela precisa ser rápida e funcionar em
tablet/celular. Se for depois, pode ser um formulário longo e completo.

📝 **Resposta:**

<br>

---

### 6.2 🔴 O professor vê o próprio feedback?

**O que deduzimos:** não sabemos — e é a pergunta mais sensível.

**Por quê:** o formulário tem duas partes com tons bem diferentes: os BeTips em
inglês (dirigidos ao professor, com correções diretas) e o resumo em português
explicitamente endereçado ao "Coordenador(a) / Diretor(a) da Escola".

**A pergunta:** o professor recebe o documento inteiro? Só os BeTips? Nada? Como
é entregue hoje — conversa presencial, e-mail, impresso?

**O que muda:** define permissões e, principalmente, o tom da interface.

📝 **Resposta:**

<br>

---

### 6.3 🔴 O que a escola vê?

**A pergunta:** o diretor da escola recebe o resumo em português? Ele vê os
BeTips detalhados? Vê as notas das 4 dimensões?

> ⚠️ **Atenção:** este é o ponto em que a informação atravessa da Bebelingue para
> o cliente. Um professor mal avaliado pela Bebelingue aparecendo assim para o
> empregador dele tem implicação trabalhista. Queremos que vocês decidam
> conscientemente.

📝 **Resposta:**

<br>

---

### 6.4 🟡 As 4 dimensões viram histórico?

**O que deduzimos:** que hoje cada feedback é um evento isolado.

**Por quê:** o formulário não referencia observações anteriores.

**A pergunta:** faria sentido ver a evolução de um professor ao longo do ano —
"melhorou em Class Management, piorou em Time Management"? Ou preferem tratar
cada visita como pontual?

**O que muda:** série histórica é mais valiosa e mais delicada ao mesmo tempo.

📝 **Resposta:**

<br>

---

### 6.5 🟡 O checklist da rotina deve vir da aula?

**O que deduzimos:** que poderia ser gerado automaticamente.

**Por quê:** o formulário tem uma lista de itens do Warm Up/Development/Closure
para o BeCoordie marcar — e agora temos exatamente esses itens cadastrados como
blocos da aula.

**A pergunta:** faria sentido o sistema mostrar "esta aula tinha estes 7 blocos"
e o BeCoordie marcar quais foram cumpridos? Ou preferem a lista fixa genérica,
igual em toda observação?

**O que muda:** derivar da aula é mais preciso, mas amarra o formulário à
qualidade do cadastro do TG.

📝 **Resposta:**

<br>

---

### 6.6 🟡 Com que frequência acontece a observação?

**A pergunta:** cada professor é observado quantas vezes por semestre? É agendado
ou surpresa? Existe fila/planejamento de visitas que o sistema deveria ajudar a
organizar?

📝 **Resposta:**

<br>

---

### 6.7 🟢 Existe fluxo de resposta?

**A pergunta:** o professor pode comentar o feedback que recebeu? Existe
follow-up — "na próxima visita, verificar se melhorou X"?

📝 **Resposta:**

<br>

---

## 7. Turmas e alunos

### 7.1 🔴 Confirmam que não precisamos dos alunos nominalmente?

**O que deduzimos:** que basta saber **quantos** alunos a turma tem, e quantos
estavam presentes em cada aula.

**Por quê:** vocês disseram que dado de aluno é pouco relevante agora. Vamos
**apagar** o cadastro de alunos que existe hoje.

**A pergunta:** confirmam? Nenhum relatório de vocês ou das escolas precisa de
nome de aluno? A escola não vai pedir isso?

**O que muda:** é destrutivo. Reverter depois é possível, mas os nomes já
cadastrados se perdem. **Queremos confirmação explícita.**

📝 **Resposta:**

<br>

---

### 7.2 🟡 Uma turma tem sempre um professor só?

**O que deduzimos:** que sim, mas que pode haver substituição eventual — por isso
registramos quem deu cada aula.

**A pergunta:** existe co-docência? Professor que divide turma? Quando alguém
falta, outro assume — e isso precisa ser registrado?

📝 **Resposta:**

<br>

---

### 7.3 🟡 Uma turma pode mudar de Year no meio do ano?

**A pergunta:** a turma 5A é sempre Year 5 do começo ao fim do ano? O que
acontece na virada — a turma "sobe" para Year 6 ou é criada nova?

**O que muda:** define se `Turma` é uma entidade anual ou permanente.

📝 **Resposta:**

<br>

---

### 7.4 🟢 Como se chamam as turmas?

**O que deduzimos:** "A", "B", "C" dentro de cada Year.

**Por quê:** é o modelo atual. Mas o feedback da Gabriela diz "4º Ano Tarde",
sugerindo que o turno faz parte do nome.

**A pergunta:** as escolas identificam turma por turno (manhã/tarde)? Nome livre
resolve, ou querem campo de turno separado?

📝 **Resposta:**

<br>

---

## 8. Avaliações

> Vocês nos enviaram a prova `Y5 - test U1` com gabarito e áudio. **Deixamos fora
> do escopo** por enquanto, mas queremos entender o suficiente para não fechar
> portas na modelagem.

### 8.1 🟢 Como as provas funcionam hoje?

**A pergunta:** quantas provas por ano? Uma por Unit? Quem imprime, aplica e
corrige? A nota vai para onde?

📝 **Resposta:**

<br>

---

### 8.2 🟢 Vocês gostariam que o Kevin ajudasse com avaliação?

**A pergunta:** faz sentido o Kevin gerar exercícios extras, ajudar a corrigir, ou
preparar a turma para a prova? Ou avaliação é território que deve ficar
inteiramente com o professor?

📝 **Resposta:**

<br>

---

## 9. Operação e implantação

### 9.1 🔴 Qual escola entra primeiro e quando?

**A pergunta:** qual é a primeira escola a usar de verdade? Quantas turmas?
Quantos professores? Qual a data?

**O que muda:** define nossa ordem de entrega. Se for uma escola com um Year só,
podemos entregar bem menos coisa bem mais rápido.

📝 **Resposta:**

<br>

---

## 10. Cenários de fundo do Kevin (NOVA)

> **Contexto:** o animador entregou 7 cenários de fundo (floresta, quarto,
> banheiro, escola interior/exterior, hospital interior/exterior). O motor já
> troca de cenário com animação. Cada aula tem um campo `background`.

### 10.1 🔴 Quem escolhe qual cenário para qual aula?

**O que deduzimos:** que o coordenador escolhe ao cadastrar o TG, porque o
cenário casa com o vocabulário da aula (aula de "daily routines" → quarto;
"at the doctor" → hospital; "school objects" → escola).

**A pergunta:** faz sentido o coordenador escolher o cenário de cada aula? Vocês
têm um mapeamento vocabulário → cenário, ou é bom senso? Os 7 cenários cobrem o
que vocês precisam, ou faltam temas?

**O que muda:** se houver um padrão claro, podemos sugerir o cenário
automaticamente pelo tipo/tema da aula em vez de deixar tudo manual.

📝 **Resposta:**

<br>

---

## Resumo — deduções que ainda precisam de confirmação

As respondidas no WhatsApp (2.6, 1.1, 3.1, 3.2, 5.1) estão fora daqui — já foram
fechadas. **Estas continuam abertas; se a reunião encurtar, garanta-as:**

| § | Assumimos que… | Se estiver errado |
|---|---|---|
| 7.1 | Não precisamos de aluno nominal | Já implementamos sem — reverter é migração |
| 2.1 | Existem 4 tipos de aula | Retrabalho no cadastro (já implementado com 4) |
| 2.2 | Warm Up é sempre a mesma estrutura | Perdemos a chance de acelerar o cadastro |
| 1.3 | Turma pode atrasar e repor no próprio ritmo | Muda o cálculo de progresso |
| 2.7 | Revisar TG pode alterar aula já dada | Precisamos versionar (retrabalho grande) |
| 1.2 | Week 5 / Extra Class é slot de folga | Muda a grade do cadastro |
| 10.1 | Coordenador escolhe o cenário de fundo por aula | Automatizamos pelo tema |

---

## Checklist de saída da reunião

**Arquivos a receber (o mais importante):**
- [ ] 🔴 **TG completo** com **Games Bank** (regras dos jogos) e **BeBooklet** (técnicas) — §3.1, §3.2
- [ ] Modelo de **RMP** e **Yearly Plan Review** — destrava as métricas — §5.1

**Definições:**
- [ ] **Class Feedback**: quem vê o quê (professor / escola) — §6
- [ ] **Cenários de fundo**: quem mapeia vocabulário → cenário — §10
- [ ] Confirmar que **aluno nominal não é necessário** — §7.1
- [ ] **Qual escola entra primeiro e quando** — §9.1
- [ ] **Quem cadastra o quê** e prazo de população — §4.2, §4.3
