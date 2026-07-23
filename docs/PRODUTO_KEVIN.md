# Kevin — Visão de Produto (estado atual)

Documento de referência do produto **como ele existe hoje no código**. Use na
reunião com o cliente para explicar como o sistema funciona, quais são as regras
implícitas e onde estão as decisões que precisam ser confirmadas ou revisitadas.

---

## 1. O que é o Kevin em 30 segundos

**Kevin** é uma plataforma SaaS que ajuda **professores de inglês** a conduzir
aulas em **turmas de crianças** (Ensino Fundamental / Elementary School) usando
um **assistente de IA por texto e voz** — o próprio "Kevin", um mascote animado
que fala, escuta e reage.

O produto é vendido em modelo **franqueado**: cada **escola** paga um **plano**
mensal à Bebelingue. A escola tem um **diretor** que cadastra **professores** e
**turmas**. Cada professor recebe um **currículo pronto** (fixo, feito pela
Bebelingue) e usa o Kevin como copiloto durante a aula.

Kevin é para o **professor** — os alunos não interagem diretamente com a IA
(mas ouvem/veem a voz do Kevin durante a aula, na tela do professor).

---

## 2. Papéis (usuários)


| **Admin** (Bebelingue) | Django Admin (`/admin/`) | Tudo: cria escola, plano, currículo (aulas), reset de senhas |

| **Diretor de escola** | Cadastra professores, turmas, alunos; vê relatórios de progresso |

| **Professor** | Vê suas turmas, entra na aula, conversa com Kevin, marca progresso, contribui pra biblioteca |

| **Aluno** | ❌ **não tem login** | — | (só participa presencialmente da aula, olhando a tela do professor) |

**Detalhes técnicos**:
- Só existe **um** modelo `User` (Django `AbstractUser`) com o campo `role`.
- Diretor e Professor são tabelas separadas 1:1 com User + FK pra Escola.
- Login redireciona automaticamente para a área do papel (middleware).

---

## 3. Estrutura de dados (modelo mental)

```
Plano
  ├── ia_provider   (anthropic | openai)     — configurável por PLANO, não escola
  ├── ia_api_key
  ├── tts_provider  (elevenlabs | openai_tts)
  ├── stt_provider  (openai_whisper | google_stt)
  └── valor_mensal
       │
       ▼
Escola (nome, slug, ativa)
  │
  ├── Diretor (1:1 com User)
  ├── Professor (1:1 com User) × N
  │      │
  │      └── Turma (year 1–5, nome "A"/"B"/"C") × N
  │             │
  │             └── Aluno × N          ← sem login, só cadastro
  │             │
  │             └── ProgressoTurma × N
  │                  ├── aula (FK)
  │                  └── status: nao_iniciada | parcial | concluida
  │
  │
Aula (compartilhada por TODAS as escolas — currículo global Bebelingue)
  ├── código: Y1U1W1C6 (Year 1, Unit 1, Week 1, Class 6)
  ├── year, unit, week, class_num
  ├── titulo, descricao (só p/ UI)
  ├── warm_up      ┐
  ├── development  ├── roteiro pedagógico enviado à IA como CONTEXTO
  ├── closure      ┘
  │
  ├── Homework × N (objetivo, vocabulário, gramática)
  └── AulaConteudo × N
        └── Conteudo (musica | video | texto | audio | imagem)
              └── criado_por: Professor  ← biblioteca é comunitária

Chat / Conversa
  ├── professor (FK)
  ├── aula (FK, opcional — se null = chat "livre")
  └── Mensagem × N
        ├── role: user | assistant
        ├── tipo: texto | audio
        └── conteudo (texto ou URL de áudio)
```

### Regras implícitas que valem confirmar com o cliente

1. **Currículo é global e fixo**. Todas as escolas usam as mesmas aulas
   cadastradas pela Bebelingue. Professor **não** cria aula — só marca
   progresso e contribui com conteúdos avulsos.
2. **Aula tem um código estruturado**: `Y{year}U{unit}W{week}C{class_num}`
   (ex.: `Y1U1W1C6`). Gerado automaticamente no save.
3. **A `descricao` da aula NÃO vai pra IA** — é só pra interface do professor.
   Só `warm_up`, `development` e `closure` são enviados como contexto.
4. **Progresso é da TURMA**, não do aluno individual. Se a turma marcou "aula 6
   concluída", ela some da fila daquela turma.
5. **O aluno é só um cadastro nominal** — não faz login, não tem histórico
   individual, não tem métrica própria.
6. **Biblioteca de conteúdos é comunitária**: qualquer professor cria um
   conteúdo (música, vídeo, PDF), qualquer outro pode usar em qualquer aula.
7. **Provedores de IA/TTS/STT são configurados por PLANO**, não por escola.
   Ou seja, escolas de planos diferentes podem usar Anthropic vs OpenAI, mas
   escolas do mesmo plano compartilham a chave.
8. **A API key fica no banco** (na tabela `Plano`, texto puro). Não está
   criptografada.
9. **Só existe chat 1:1 com o professor** (não em grupo, não simultâneo com
   vários professores).

---

## 4. Fluxo principal — o professor dando aula com o Kevin

```
LOGIN                     professor entra com usuário/senha
  │
  ▼
/professor/               "Qual Year você vai trabalhar hoje?"
  │                       (cards com Year 1, 2, 3, ...)
  ▼
/professor/turmas/1/      Lista as turmas da escola daquele professor
  │                       (Turma 1A, 1B, etc.)
  ▼
/professor/turma/N/       Lista das aulas do currículo daquele Year
                          Cada aula mostra:
                          - código + título
                          - status: Não iniciada / Em andamento / Concluída
                          - accordion com descrição + conteúdos + homeworks
                          - botão "Abrir aula com o Kevin"
  │
  ▼
/professor/turma/N/aula/Y1U1W1C6/
                          ┌─────────────────────┬──────────────────────┐
                          │                     │   Chat com Kevin     │
                          │  KEVIN ANIMADO      │   ┌──────────────┐   │
                          │  (motor kevin-puppet)│   │ msg do prof   │  │
                          │                     │   │ msg do Kevin  │  │
                          │  status pill:       │   └──────────────┘  │
                          │  Ouvindo…           │                     │
                          │  Pensando…          │   [🎤] [texto] [→]  │
                          │  Respondendo…       │                     │
                          └─────────────────────┴──────────────────────┘

                          Header tem botões:
                            "Concluir" → marca aula como concluída p/ turma
                            "Reset"    → apaga histórico do chat e progresso
```

**O que acontece quando o professor conversa:**

1. **Envia texto**: `POST /api/chat/conversas/N/mensagem/` cria uma `Mensagem`
   role=user. Uma task Celery `processar_mensagem_ia` roda em background:
   - Pega o **system prompt base do Kevin** (definido em `apps/chat/tasks.py`)
   - Concatena com o **contexto da aula** (`warm_up + development + closure +
     conteudos + homeworks`)
   - Concatena com o **histórico da conversa**
   - Chama o provedor de IA definido no plano da escola
   - Salva a resposta como `Mensagem` role=assistant
   - O frontend faz polling e mostra a nova mensagem
2. **Envia áudio (clique único)**: browser grava com VAD (voice activity
   detection — silêncio de 2.5s = para automaticamente). Envia pra `/api/chat/stt/`
   → transcreve → segue mesmo fluxo do texto.
3. **Live mode ("hands-free")**: mic fica aberto num loop. Grava → transcreve →
   IA responde → TTS toca → mic reabre.
4. **Ouvir uma resposta**: cada mensagem do Kevin tem botão "Ouvir" que chama
   `/api/chat/tts/` e retorna áudio. Sincronizado com a boca do Kevin animado
   (lipsync real, RMS → forma da boca).
5. **Modo demo**: `KEVIN_DEMO_MODE = true` no template. Respostas locais
   pré-programadas (sem chamar IA). Útil pra testar sem consumir crédito de API.

**O que o Kevin animado faz** (após a última migração):
- **Standby**: agacha suave, olha em volta, mão na cintura / no queixo / coça a
  cabeça (gestos alternados)
- **Thinking**: cabeça inclinada 3/4, braços perto do rosto, agachamento maior
- **Speaking**: boca sincronizada em tempo real com o áudio do TTS (envelope
  attack/release, 3 tiers de formas de boca)
- **Piscar + drift natural das pupilas** em qualquer modo

---

## 5. Fluxo do diretor

```
LOGIN
  │
  ▼
/gestao/                  Dashboard com stats: N professores, N turmas, N alunos
                          + Lista curta de professores e turmas
  │
  ├── /gestao/professores/  CRUD (sem delete — só "ativo/inativo")
  ├── /gestao/turmas/       CRUD (year + nome + professor responsável)
  ├── /gestao/alunos/       CRUD (nome + turma)
  └── /gestao/relatorios/
        ├── progresso/       % de aulas concluídas por turma
        └── professores/     desempenho por professor
```

Detalhes:
- **Não tem delete em lugar nenhum** — modelos preservam integridade referencial
  (Django `PROTECT` no plano, `SET_NULL` em turma-professor).
- **Escola do diretor** é injetada via middleware — ele só vê os professores/
  turmas/alunos da própria escola.
- Não tem "aprovação" de professor — o diretor cria com senha e o professor já
  pode logar.

---

## 6. Stack técnica

| Camada | Tecnologia | Observação |
|---|---|---|
| Backend | **Django 6** + **DRF** | monolito, 4 apps: accounts, escolas, curriculo, chat |
| DB | **PostgreSQL 16** | sem cache de queries; sem particionamento |
| Async | **Celery** + **Redis** | 2 tasks: `processar_mensagem_ia`, `processar_audio_ia` |
| Auth | **SimpleJWT** + **Session** | login web usa session; API pode usar JWT |
| Frontend | **Django templates** + **Vanilla JS** | sem React/Vue; CSS custom (~2.5k linhas) |
| Deploy | **Docker Compose** | 4 containers: web, db, redis, celery |
| Áudio TTS/STT | ElevenLabs, OpenAI Whisper (por plano) | providers pluggáveis em `apps/chat/providers/` |
| IA | Anthropic Claude, OpenAI GPT (por plano) | idem |
| Mídia | S3 externo (URL manual em `Conteudo.arquivo_url`) | não tem upload direto — o professor cola link |

**API endpoints públicos** (versão atual):
```
/api/accounts/token/                POST      login JWT
/api/accounts/me/                   GET       perfil
/api/escolas/{planos,escolas,professores,turmas,alunos}/  DRF ViewSets
/api/curriculo/{aulas,conteudos,aula-conteudos,homeworks,progressos}/  idem
/api/chat/conversas/                GET/POST  lista/cria conversas
/api/chat/conversas/N/mensagem/     POST      envia msg (async por padrão)
/api/chat/conversas/N/mensagem/?sync=1  POST  envia msg síncrono (usado no live mode)
/api/chat/stt/                      POST      áudio → texto
/api/chat/tts/                      POST      texto → áudio
```

---

## 7. O motor do Kevin animado (novidade da última semana)

Recentemente integramos um motor de animação SVG novo, mais rico que o anterior.
Vale destacar na conversa porque é o **diferencial visual** do produto.

**O que ele faz:**
- Boca sincronizada em tempo real com o áudio do TTS (não é loop fake — é RMS
  do áudio → tier → forma da boca)
- Deformação de mesh nas juntas (braço/perna não só rotacionam — a "pele"
  esticada perto do cotovelo se comprime naturalmente)
- 5 poses de cabeça (frontal, 3/4 esq/dir, perfil esq/dir)
- Comportamento idle rico: piscar, pupilas viajando, olhadas laterais, mão na
  cintura, mão no queixo, coçar a cabeça
- Transições suaves entre modos (nada "salta")
- 4 modos programáticos: `off | standby | thinking | speaking`

**Arquivos**:
- Motor: `static/js/kevin-puppet/` (js + css + svg + fundo)
- Adaptador para o chat: `static/js/kevin-puppet-integration.js`
- Documentação técnica: `MOTOR_KEVIN.md` (770 linhas, para
  outra IA estender)

---

## 8. Estado atual — o que já está pronto

| Área | Status |
|---|---|
| Login por role + redirect | ✅ |
| Área do professor (Year → Turma → Aula) | ✅ |
| Chat com Kevin (texto + áudio + live mode) | ✅ |
| Kevin animado com lipsync real | ✅ (recém-integrado) |
| Biblioteca de conteúdos comunitária | ✅ (busca + filtro por tipo) |
| Meu progresso do professor | ✅ |
| Área do diretor: CRUD professor/turma/aluno | ✅ |
| Área do diretor: relatórios de progresso | ✅ |
| Django admin para curriculo (Bebelingue cadastra) | ✅ |
| Multi-provider IA/TTS/STT configurável no plano | ✅ |
| Design system moderno (claymorphism, SVG icons) | ✅ (última semana) |

---

## 9. Áreas que **ainda não existem** ou parecem incompletas

**Vale confirmar na reunião se essas ausências são intencionais ou backlog:**

- ❌ Sem análise/histórico de conversas de IA (o diretor não vê o que os
  professores conversaram com o Kevin)
- ❌ Sem métricas de uso (quantos minutos de aula, quantas mensagens, engajamento)
- ❌ Sem métrica por aluno (só por turma)
- ❌ Sem export de progresso (PDF, CSV para escola/pai)
- ❌ Sem sistema de notificações (email, push)
- ❌ Sem upload direto de conteúdos (professor precisa hospedar em S3/YouTube
  antes de colar a URL na plataforma)
- ❌ Sem moderação da biblioteca (qualquer professor cria qualquer conteúdo, vai
  pra biblioteca comunitária global)
- ❌ Sem sistema de tags/categorização de conteúdo além do tipo
- ❌ Sem controle de versão do currículo (se a Bebelingue muda uma aula, muda
  pra todo mundo instantaneamente)
- ❌ Sem billing/cobrança (Plano só tem `valor_mensal` como campo — não gera
  cobrança, não integra com Stripe/PagSeguro)
- ❌ Sem multi-idioma na UI (é só português — mas ensina inglês)
- ❌ Sem app mobile (só web responsivo)
- ❌ Sem observabilidade em produção (logs simples, sem Sentry/Datadog)
- ❌ Sem escola secundária/futuras: só Elementary por ora (o system prompt
  fala em "Ensino Fundamental")

---

## 10. Roteiro de apresentação sugerido (10 min)

Para a reunião, sugiro apresentar nessa ordem:

1. **(1 min) Modelo mental**: quem paga (escola/franquia), quem usa
   (professor), quem é o beneficiário final (aluno) — mas quem NÃO fala com o
   Kevin (o aluno).
2. **(2 min) Currículo**: mostrar como a aula tem os 3 momentos (warm-up,
   development, closure) que viram contexto pra IA. Confirmar que o
   professor só executa, não edita.
3. **(2 min) Fluxo do professor**: mostrar `/professor/` → aula → chat com
   Kevin funcionando. Chamar atenção pro Kevin animado com lipsync.
4. **(2 min) Fluxo do diretor**: mostrar `/gestao/` com CRUD e relatórios.
5. **(1 min) Multi-tenant por plano**: cada plano tem sua chave de IA. Falar
   dos custos (cada mensagem chama uma API paga).
6. **(2 min) Perguntas** — usar o documento de perguntas.

---

## Anexos

- `PERGUNTAS_REUNIAO_CLIENTE.md` (nesta pasta docs/) — perguntas de descoberta agrupadas por tema
- `CLAUDE.md` — instruções técnicas pra assistente de código (não pra cliente)
- `MOTOR_KEVIN.md` — como estender o motor do Kevin animado
