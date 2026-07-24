# Perguntas para a reunião — Bebelingue

> **Contexto:** ao remodelar o Kevin (ver [demandas.md](demandas.md)), tivemos
> que deduzir várias coisas dos arquivos de vocês. Este documento ficou só com o
> que **ainda precisa de resposta** — as perguntas já respondidas viraram o
> quadro "Já fechado" abaixo, para não repetir.
>
> **Atualizado em 24/07/2026.**

---

## ✅ Já fechado (não precisa discutir de novo)

| Tema | O que ficou decidido |
|---|---|
| TG por escola | Igual para todas; adaptação quase irrelevante → **currículo global** |
| Frequência | Negociada com a escola; ela pode querer **3x ou 5x**. O **4x = 3x + 1 Communication** |
| Games Bank | Recebido no TG e **importado** (91 jogos com regra) |
| BeBooklet / técnicas | Recebido e **importado** (Instant Translation, Correlation, Sandwich) |
| Endereçamento | Aula = `Year + Unit + Semana + Aula` (ex: `Y5-U1W1C1`), como na apostila |
| Week 5 / Extra Class | Esclarecido — modelado como aula extra, sem roteiro obrigatório |
| Aluno nominal | **Não é necessário** — só quantidade e presença. Modelo `Aluno` removido |
| Class Feedback (fluxo) | O modelo está no arquivo `CLASS FEEDBACK - MODELO.docx` |

**Arquivos ainda esperados:**

- [ ] **TGs dos Years 1–4** — só temos o Y5. O catálogo importado já serve para
      todos; faltam as **aulas** de cada Year (cadastráveis na grade nova).
- [ ] **Modelo de RMP** e **Yearly Plan Review** — destravam as métricas de
      professor (Demanda 4).

---

## 🎯 As duas decisões que travam trabalho agora

1. **§1 — Como o 5x entra no banco.** 3x e 5x são TGs distintos; a escola escolhe
   um dos dois. Precisamos saber como modelar isso.
2. **§4 — Class Feedback: quem vê o quê.** É avaliação de desempenho de pessoa;
   queremos decidir antes de construir.

O resto são confirmações mais leves (§2, §3, §5).

---

## 1. Frequência 5x — como convive com o 3x? 🔴

> **Contexto:** vocês confirmaram que a escola negocia a frequência e pode querer
> 3x ou 5x. Comparando os TGs do Y5, **3x e 5x são TGs diferentes** (a Welcome
> Unit tem 12 aulas no 3x e 20 no 5x), com conteúdo próprio — diferente do 4x,
> que é o 3x + uma Communication.

### 1.1 Uma turma usa um TG por vez, do começo ao fim do ano?

**O que deduzimos:** que cada turma segue **um** TG inteiro — ou o de 3x, ou o de
5x —, nunca alternando no meio do ano.

**A pergunta:** confirma? Uma escola pode ter, ao mesmo tempo, turmas de 3x e
turmas de 5x (turmas diferentes)?

**O que muda:** define como guardamos os dois TGs no banco. Se é um por turma,
guardamos o 5x como um conjunto de aulas próprio e a turma puxa o TG da
frequência dela.

📝 **Resposta:**

<br>

---

### 1.2 O TG de 5x é montado do zero, ou parte do 3x?

**A pergunta:** o 5x é escrito independentemente, ou vocês começam do 3x e
adaptam? Existe frequência 2x em algum Year?

**O que muda:** se o 5x deriva do 3x de forma previsível, dá para gerar parte
dele automaticamente; se é independente, cada um é cadastrado por completo.

📝 **Resposta:**

<br>

---

### 1.3 🟡 Quando começa e termina o ano letivo?

**A pergunta:** o TG cobre quais meses? Fevereiro a novembro? Tem recesso de
julho? Todas as escolas seguem o mesmo calendário, ou cada uma tem o seu?

**O que muda:** sem a data de início do ano letivo de cada turma, não
conseguimos calcular "esta turma deveria estar na aula X hoje" (ver §5.1).

📝 **Resposta:**

<br>

---

## 2. Estrutura do TG

### 2.1 🔴 A lista de tipos de aula está completa?

**O que temos:** `Content`, `Communication`, `Culture`, `CLIL` e `Extra`.

**A pergunta:** existem outros? "Movement Class" é o mesmo que "Communication
Class"? "CLIL Project" e "Festival" são tipos próprios ou variações?

**O que muda:** o tipo determina o formato do roteiro e o checklist de observação
(Demanda 5). Errar aqui obriga a mexer no cadastro depois.

📝 **Resposta:**

<br>

---

### 2.2 🟡 O Warm Up é sempre a mesma estrutura?

**O que deduzimos:** BeCalendar + Songs Collection fixos, variando só o jogo de
correção de HW.

**A pergunta:** confirma? Vale para todos os Years, ou só para alguns?

**O que muda:** se for fixo, pré-montamos o Warm Up ao criar a aula (o
coordenador só escolhe o jogo) — economiza tempo dele.

📝 **Resposta:**

<br>

---

### 2.3 🟡 "I Can Routine" e Homework — são regra?

**A pergunta:** o "I Can Routine" aparece em toda Content Class (e em Culture
também)? O Homework é sempre atribuído numa aula e corrigido na seguinte?

**O que muda:** se são regra, o Kevin e o cadastro já contam com eles; se variam,
ficam opcionais por aula.

📝 **Resposta:**

<br>

---

## 3. Catálogo e quem cadastra

### 3.1 🟡 O professor pode criar as próprias atividades?

**O que deduzimos:** que sim, mas separadas do catálogo oficial — a atividade do
professor fica visível só na escola dele, nunca no catálogo Bebelingue nem em
outra escola. (Já está implementado assim.)

**A pergunta:** concordam? Vocês gostariam de **ver** o que os professores criam,
para eventualmente promover ao catálogo oficial? Ou preferem que nem possam
criar?

📝 **Resposta:**

<br>

---

### 3.2 🔴 Quem cadastra as escolas, diretores e professores?

**O que deduzimos:** a Bebelingue cadastra a escola e o diretor; o diretor
cadastra os professores dele.

**A pergunta:** confirma? Ou vocês cadastram tudo, inclusive professores?

**O que muda:** define as permissões e o que priorizamos na área da coordenação.

📝 **Resposta:**

<br>

---

### 3.3 🟡 Quantos coordenadores, e com que prazo para popular?

**A pergunta:** quantas pessoas na Bebelingue vão cadastrar TG e catálogo? Têm
divisão (uma cuida do Year 1–3, outra do 4–5)? E quando a primeira turma precisa
estar rodando — dá para começar com um Year só?

**O que muda:** define se precisamos de permissão por Year e a ordem de entrega.

📝 **Resposta:**

<br>

---

## 4. Class Feedback 🔴

> **Demanda parada aguardando esta conversa.** Temos o formulário-modelo. O que
> falta é o **fluxo** e, principalmente, **quem enxerga o quê** — é avaliação de
> desempenho de pessoa, com implicação trabalhista.

### 4.1 O professor vê o próprio feedback?

**Por quê importa:** o formulário tem duas partes de tom diferente — os BeTips em
inglês (dirigidos ao professor) e o resumo em português endereçado ao
"Coordenador(a) / Diretor(a) da Escola".

**A pergunta:** o professor recebe o documento inteiro? Só os BeTips? Nada? Como
é entregue hoje — conversa, e-mail, impresso?

📝 **Resposta:**

<br>

---

### 4.2 O que a escola (diretor) vê?

**A pergunta:** o diretor recebe o resumo em português? Vê os BeTips detalhados?
Vê as notas das 4 dimensões?

> ⚠️ É o ponto em que a informação atravessa da Bebelingue para o empregador do
> professor. Um professor mal avaliado aparecendo assim para a escola tem
> implicação trabalhista — queremos que vocês decidam conscientemente.

📝 **Resposta:**

<br>

---

### 4.3 🟡 As 4 dimensões viram histórico? O checklist vem da aula?

**A pergunta:** faz sentido ver a evolução de um professor ao longo do ano
("melhorou em Class Management")? E o checklist da rotina — deve ser gerado a
partir dos blocos reais da aula, ou uma lista fixa genérica?

**O que muda:** série histórica é mais valiosa e mais delicada; derivar o
checklist da aula é mais preciso mas amarra à qualidade do cadastro.

📝 **Resposta:**

<br>

---

### 4.4 🟡 Com que frequência acontece a observação?

**A pergunta:** cada professor é observado quantas vezes por semestre? É agendado
ou surpresa? Existe planejamento de visitas que o sistema deveria ajudar a
organizar?

📝 **Resposta:**

<br>

---

## 5. Métricas de professor

### 5.1 🔴 O que significa "professor em dia"?

> Vocês disseram que é medido no **RMP** (o professor informa em que aula está) e
> o previsto vem do **Yearly Plan Review**. Falta receber os dois modelos — e
> entender a conta.

**A pergunta:** o que é "atraso aceitável" — uma aula? Duas semanas? A referência
é "está na Unit certa para o mês", ou "deu X aulas no mês"? Alguém compara isso
manualmente hoje?

**O que muda:** define completamente o relatório da Demanda 4.

📝 **Resposta:**

<br>

---

### 5.2 🟡 A presença serve para quê, e quem vê as métricas?

**A pergunta:** a presença por aula é para cobrança, relatório aos pais, controle
interno? E as métricas de cada professor — o diretor vê os da escola dele, o
professor vê só os próprios, a Bebelingue vê todas? Um professor pode ver a de
outro?

**O que muda:** é dado sensível — queremos acertar antes de expor.

📝 **Resposta:**

<br>

---

## 6. Turmas

### 6.1 🟡 Uma turma tem sempre um professor só? Muda de Year no ano?

**A pergunta:** existe co-docência ou divisão de turma? Quando alguém falta,
outro assume — precisa registrar? E na virada de ano, a turma "sobe" para o Year
seguinte ou é criada nova?

**O que muda:** define se `Turma` é anual ou permanente, e se registramos
substituição.

📝 **Resposta:**

<br>

---

### 6.2 🟢 Como se chamam as turmas?

**A pergunta:** identificam por turno (o feedback da Gabriela diz "4º Ano
Tarde")? Nome livre resolve, ou querem um campo de turno separado?

📝 **Resposta:**

<br>

---

## 7. Cenários de fundo do Kevin 🔴

> O animador entregou 7 cenários (floresta, quarto, banheiro, escola
> interior/exterior, hospital interior/exterior). Cada aula tem um campo
> `background`.

### 7.1 Quem escolhe qual cenário para qual aula?

**O que deduzimos:** que o coordenador escolhe ao cadastrar o TG, casando o
cenário com o vocabulário (daily routines → quarto; at the doctor → hospital).

**A pergunta:** faz sentido? Vocês têm um mapeamento vocabulário → cenário, ou é
bom senso? Os 7 cobrem o que precisam, ou faltam temas?

**O que muda:** com um padrão claro, podemos **sugerir** o cenário
automaticamente pelo tema da aula em vez de deixar tudo manual.

📝 **Resposta:**

<br>

---

## 8. Operação (leves)

### 8.1 🟢 Provas e avaliação

**A pergunta:** quantas provas por ano (uma por Unit)? Quem imprime, aplica e
corrige, e a nota vai para onde? Faria sentido o Kevin ajudar (gerar exercícios,
preparar a turma), ou avaliação fica inteiramente com o professor?

📝 **Resposta:**

<br>

---

### 8.2 🔴 Qual escola entra primeiro e quando?

**A pergunta:** qual é a primeira escola a usar de verdade? Quantas turmas e
professores? Qual a data?

**O que muda:** define nossa ordem de entrega — uma escola com um Year só permite
entregar bem menos, bem mais rápido.

📝 **Resposta:**

<br>

---

## Checklist de saída da reunião

**Decisões que destravam trabalho:**
- [ ] 🔴 **5x vs 3x**: uma turma usa um TG por vez? Escola mistura turmas 3x e 5x? — §1
- [ ] 🔴 **Class Feedback**: professor vê? escola vê? — §4
- [ ] 🔴 **Tipos de aula** completos — §2.1
- [ ] 🔴 **Quem cadastra o quê** — §3.2
- [ ] 🔴 **Qual escola entra primeiro e quando** — §8.2

**Arquivos a receber:**
- [ ] **TGs dos Years 1–4**
- [ ] **RMP** e **Yearly Plan Review** — §5.1

**Confirmações leves (se sobrar tempo):** §2.2, §2.3, §3.1, §3.3, §5.2, §6, §7, §8.1.
