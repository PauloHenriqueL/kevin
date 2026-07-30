# Perguntas para a Bebelingue — respostas e pendências

> **Atualizado em 30/07/2026**, após a reunião com a Mila (transcrição em
> `docs/reunião/30-06.md`). O documento agora registra o que foi **respondido**
> e o pouco que **ainda falta**. As respostas viraram decisões D31–D36 em
> `docs/demandas.md`.

---

## ✅ Respondido na reunião de 30/07

| # | Pergunta | Resposta |
|---|---|---|
| **5x vs 3x** | Como as frequências convivem? | A escola usa **um cronograma por segmento**: X usa 3x no Infantil, 4x no Fundamental, 5x nos Adolescentes. Cada frequência é um TG próprio → vira a **entidade TG** (D31), e a **série** da escola aponta para o TG (D32) |
| **Tipos de aula** | A lista está completa? | **Sim.** Content, Communication, Culture, CLIL, Extra — completa |
| **Quem preenche** | Quem sobe os dados? | A **Mila** (coordenadora) preenche. Nosso trabalho: deixar o sistema pronto e no Render para ela subir |
| **Qual escola/quando** | Primeira escola e data? | **Não cabe a nós** — a Mila decide. Foco: MVP numa turma **Y5** (D36) |
| **Class Feedback** | Quem vê o quê? | A avaliação é do **coordenador Bebelingue**, não do diretor. O relatório tem **parte em português** (coordenador) + **BeTips em inglês** (professor) |
| **Professor em dia** | Como se mede o atraso? | Progresso **mensal e anual**, comparando a posição do professor no material com as metas do **Early Plan**. Reuniões mensais ajustam (podem cortar aula se apertar) → **Demanda 16** |
| **Ano letivo** | Início e fim? | Começa em **fevereiro**; **julho** é férias (sem livro) |
| **Estrutura de séries** | Como a escola organiza? | Infantil (2–5 anos: PR2, Pratriz, K1, K2) + Fundamental (Y1–Y5) + Anos finais (Y6–Y9). Cada escola **dá o próprio nome** aos segmentos |
| **June** | Onde entra? | **Depois da Unit 4** (antes da U5); são **tarefas**, não aula de sala → **Demanda 17** |
| **Listening** | Como animar? | **Caixa de som + ondas sonoras**, sem lip-sync (proposta do Vitor, aceita). Confirma o que já implementamos → **D35** |

---

## ⏳ Ainda falta receber (não bloqueia o MVP)

- [ ] **Modelo do Early Plan** (o "Yearly Plan Review") — define o "previsto" no
      relatório do professor (Demanda 16). Sem ele, entregamos a posição real e
      deixamos o previsto manual.
- [ ] **TGs dos Years 1–4** — o MVP é só Y5, então não bloqueia agora.
- [ ] **Observação de aula** — a Mila vai ver com a Rebeca o formato de os
      desenvolvedores assistirem a uma aula (para entender o "enredo" pedagógico).

---

## 🟢 Confirmações leves ainda em aberto (não bloqueiam o MVP)

Estas nunca foram respondidas e **não travam** o MVP de Y5. Cobrir quando fizer
sentido (ex: numa reunião mensal):

- **Warm Up** é sempre BeCalendar + Songs + jogo? Vale para todos os Years?
- **"I Can Routine"** e **Homework** são regra em toda aula, ou variam?
- O **professor pode criar atividade própria** (só visível na escola dele)?
  Vocês querem ver o que ele cria, para promover ao catálogo oficial?
- A **presença** por aula serve para quê (cobrança, pais, controle)?
- **Turmas:** co-docência? substituição? a turma "sobe" de Year no ano seguinte?
  identificam por turno ("4º Ano Tarde")?
- **Cenário de fundo:** vocês têm um mapa vocabulário → cenário, ou é bom senso?
- **Provas:** quantas por ano? o Kevin deveria ajudar (gerar exercícios)?

---

## 🎯 O que destrava trabalho agora (nosso lado, não do cliente)

A reunião respondeu o que precisávamos. As próximas ações são **nossas**, não
dependem de mais respostas:

1. **Demanda 15** — modelar Série + TG e migrar o Y5.
2. **Demanda 16** — relatório orientado ao professor, com filtro mês/ano.
3. **Demanda 17** — June entre U4 e U5.
4. **Subir no Render** para a Mila começar a popular.

Detalhes em `docs/demandas.md` (Demandas 15–17, decisões D31–D36).
