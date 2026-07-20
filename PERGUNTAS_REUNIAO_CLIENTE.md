# Perguntas para a reunião com o cliente

Framework de **descoberta** pra você como PO extrair o máximo de contexto do
time do cliente. Cada seção começa com **objetivo** (o que você quer entender)
e uma **pergunta-âncora** (a mais importante) seguida de perguntas de
aprofundamento.

**Dica prática**: em reunião, escreva "PARA APROFUNDAR" ao lado da resposta e
não interrompa o entrevistado — grave/anote e volte depois.

**Legenda**:
- 🎯 pergunta essencial (não sai da reunião sem resposta)
- 🔍 pergunta de aprofundamento
- 💡 pergunta pra descobrir dor não-verbalizada
- ⚠️ pergunta que pode ser desconfortável — deixa pro fim

---

## 1. Visão de produto & negócio

**Objetivo**: entender o "porquê" antes de qualquer decisão de feature.

🎯 **Qual é a promessa central do Kevin?** Se você tivesse que resumir em uma
frase pra um investidor: "o Kevin é o produto que _____ para _____."

🔍 Como vocês descrevem o Kevin hoje quando falam com uma escola nova?

🔍 Qual foi o **evento gerador** — que problema alguém viveu que fez o
Kevin existir?

🔍 Qual é o **modelo de negócio**? A escola paga mensalidade? Anuidade?
Por professor? Por aluno? Por turma? Por número de aulas?

🔍 Vocês têm um **ticket médio** por escola? Quanto?

🔍 Quantas escolas estão contratadas hoje? Quantas em piloto?
Quantas ativas (usando semanalmente)?

⚠️ Qual foi a **última escola que cancelou** e por quê?

💡 Se o Kevin desaparecesse amanhã, o que os professores perderiam? E as
escolas? E a Bebelingue como negócio?

---

## 2. Personas e usuários

**Objetivo**: entender quem realmente usa e quem é o comprador — nem sempre
é a mesma pessoa.

### 2.1 Comprador (quem decide)

🎯 **Quem decide comprar o Kevin numa escola?** Diretor pedagógico? Dono da
franquia? Coordenador de inglês?

🔍 Como esse decisor descobriu o Kevin?

🔍 Ele testa antes de comprar? Vê um demo? Quem faz esse demo?

### 2.2 Professor (usuário primário)

🎯 **Descreva o perfil do professor típico**. Idade, formação em inglês
(fluente? intermediário?), afinidade com tecnologia, quantas horas/semana com
o Kevin.

🔍 O professor recebe treinamento pra usar o Kevin? Quanto tempo dura?

🔍 O professor **quer** usar o Kevin, ou é obrigado?

🔍 Quais são as **3 queixas mais comuns** dos professores hoje?

🔍 O que os professores mais **elogiam**?

💡 Como o professor **sente** ficar na frente da turma com o Kevin funcionando
mal? Vergonha? Frustração? Vai tirar da aula?

🔍 O professor tem acesso ao Kevin **fora** da sala de aula? (preparação,
correção de trabalhos, dúvidas)

### 2.3 Aluno

🎯 **O aluno interage diretamente com o Kevin?** No código atual, não — só
vê/ouve o Kevin na tela do professor. Isso é intencional? É pra sempre?

🔍 Qual é a **idade** dos alunos? A faixa etária muda a UI/UX (fonte maior?
mais cores?)

🔍 Os alunos têm **tarefa de casa** com o Kevin? Como funcionaria isso?

🔍 Vocês pensam em **fazer o aluno falar com o Kevin** em algum momento?
Isso muda tudo (multi-tenancy por usuário, moderação, LGPD infantil).

### 2.4 Diretor de escola

🎯 **O que o diretor faz na plataforma numa semana típica?** Cadastra?
Acompanha? Cobra os professores?

🔍 O diretor precisa **provar** progresso pra alguém? (pais, franqueadora,
secretaria de educação)

🔍 Qual **relatório** o diretor gostaria de ter que hoje não tem?

### 2.5 Pais (persona invisível?)

🎯 **Os pais fazem parte da equação?** Recebem relatórios? Veem o Kevin
em casa?

🔍 Existe **portal de pais** ou app? Está no roadmap?

### 2.6 Bebelingue (você/cliente)

🎯 **Quem cadastra o currículo?** É um pedagogo interno? Terceirizado?

🔍 Quantas pessoas na Bebelingue tocam o produto hoje? (dev, pedagógico,
comercial, suporte)

🔍 Quem responde quando um professor abre um chamado?

---

## 3. Currículo & pedagogia

**Objetivo**: currículo é o coração — se estiver errado, o Kevin é inútil.

🎯 **Como o currículo é construído hoje?** Quem escreve o warm_up /
development / closure de cada aula? Baseado em qual metodologia?

🔍 O currículo é **fixo pra todas as escolas** ou muda por região/franquia?

🔍 Vocês têm **níveis diferentes** (A1, A2, B1)? Onde isso está mapeado?

🔍 Qual **método pedagógico** vocês seguem? (TPR, PPP, task-based, CLIL, Cambridge?)

🔍 A aula segue **exatamente** o roteiro no sistema, ou o professor tem
liberdade de fugir? Como o Kevin lida quando o professor "vira" a aula?

🔍 O que acontece quando **um aluno específico não acompanha**? O sistema
tem alguma resposta pra isso?

🔍 Existe **teste/avaliação** dentro do Kevin?

🔍 Qual é a **frequência ideal** de aula? (1x/semana? 3x?)

💡 Se o Kevin pudesse **adaptar dinamicamente** o ritmo da aula com base em
como a turma reage, isso mudaria o produto? Vocês querem isso?

🔍 O currículo evolui? Quem decide mudar uma aula? Quando muda, muda pra
todo mundo instantaneamente (é assim hoje) — isso é desejado?

---

## 4. Conteúdo & biblioteca

**Objetivo**: entender governança de conteúdo.

🎯 **A biblioteca comunitária de conteúdos é uma feature intencional?**
Hoje qualquer professor cria conteúdo e ele fica visível pra qualquer outro
professor de qualquer escola. Isso é o desejado?

🔍 Quem **modera** um conteúdo inadequado?

🔍 O que impede um professor de **hospedar num link que expira** (Google
Drive privado, YouTube que sai do ar)?

🔍 Quem hoje **produz o conteúdo oficial** (as músicas, os vídeos)?

🔍 Existe **direito autoral** por trás? (o Kevin toca "Old McDonald had a
farm" — é domínio público, mas e vídeos de terceiros?)

🔍 Se um conteúdo **muda de URL**, quem arruma? (Hoje o professor colou
manualmente uma URL. Sem detecção de link quebrado.)

💡 Se vocês tivessem que **retirar 90% da biblioteca comunitária** e ficar só
com 10% curado, o produto ficaria pior ou melhor?

---

## 5. O personagem Kevin (IA + persona)

**Objetivo**: entender a identidade do assistente.

🎯 **Quem escreveu a personalidade do Kevin?** (o system prompt tem 40+
linhas de instruções — quem cunhou o tom?)

🔍 O Kevin tem **história** (background)? Nome de família? Origem? Isso
importa pros alunos?

🔍 O Kevin é **um "personagem"** ou é uma "IA que se apresenta como Kevin"?
(Isso muda como reagimos quando o Kevin erra.)

🔍 Se um aluno pergunta "Kevin, você é robô?" — o Kevin deve confirmar,
negar ou desviar?

🔍 O Kevin **sabe** que os alunos são crianças? Ele adapta linguagem sozinho?
(O system prompt força isso hoje.)

🔍 **Qual voz** o Kevin usa hoje? É consistente entre planos? Vocês
escolheram baseado em algo?

🔍 O Kevin pode **cantar**? Fazer piada? Fazer o "yeeeeahh" animado que
professor de inglês infantil faz?

🔍 Se um professor **discorda do Kevin** na frente da turma, como o Kevin
reage?

⚠️ O Kevin já disse alguma coisa **problemática**? Ofensiva? Errada?
Vocês têm registro?

💡 Vocês pensam em **múltiplos Kevins** (Kevin, Sarah, Miguel) pra dar
variedade? Ou o mascote único é uma decisão de marca?

---

## 6. IA técnica: comportamento, custo, controle

**Objetivo**: entender orçamento e limites técnicos.

🎯 **Quanto custa o Kevin por escola por mês em API de IA?** ElevenLabs +
Anthropic/OpenAI + Whisper.

🔍 Vocês **medem** esses custos? Repassam pro plano da escola?

🔍 Um professor **fala demais** com o Kevin, gasta mais. Vocês têm limite?
(Rate limit? Quota por escola?)

🔍 Se a API do Anthropic **sai do ar**, o que acontece? Tem fallback?

🔍 O Kevin tem **memória** entre aulas? (Hoje: cada Conversa é isolada por
professor+aula. Se uma turma marca aula 6 como reset, apaga o histórico.)

🔍 Quando vocês trocam o **modelo da IA** (ex.: Claude 4 → Claude 4.5), quem
decide? Quem testa?

🔍 O prompt do Kevin **muda por escola/plano**? Ou é um único prompt global?
(Hoje é global.)

💡 Se vocês pudessem **treinar um modelo específico** com dados das aulas,
faria diferença? Custa muito.

---

## 7. Voz (TTS/STT) e experiência de aula

🎯 **A voz do Kevin é o principal ponto forte ou de dor?** Elogios? Bugs
recorrentes?

🔍 A latência atual entre "professor termina de falar" → "Kevin responde
com voz" é aceitável? Ideal seria quanto?

🔍 O **live mode** (mãos livres) é usado? Por quantos professores? Ou é
demo-only?

🔍 O Kevin **interrompe** o professor se o professor falar por cima?
Deveria?

🔍 Como é o **som do Kevin em uma sala com 20 crianças barulhentas**?
Vocês testaram em ambiente real?

🔍 O professor consegue **regular volume** do Kevin? Silenciar rápido?

⚠️ Já rolou de o **microfone do professor pegar áudio do Kevin** e entrar
em loop infinito? Como resolveu?

---

## 8. Dados, LGPD e ética

**Objetivo**: como PO, esses tópicos são **obrigatórios**. Nada é opcional.

🎯 **Vocês têm consentimento dos pais** pra alunos aparecerem no sistema?
(Nome, idade, escola.)

🎯 **Dados de menor são armazenados?** No banco de vocês? Nos providers de
IA?

🔍 Vocês têm **DPO (encarregado de dados)**? Política de privacidade
publicada?

🔍 A **conversa entre professor e Kevin** é armazenada indefinidamente? Ela
pode conter dados de aluno (o professor pode falar "Julia não conseguiu
fazer o exercício"). Como isso é tratado?

🔍 As **API keys** ficam no banco (`Plano.ia_api_key`) em texto puro. Isso
é um problema pra vocês? Existe compliance rodando?

🔍 Existe **direito ao esquecimento**? Se uma escola cancela, os dados são
apagados?

🔍 Vocês **enviam prompts pra Anthropic/OpenAI** — sabem que esses providers
podem estar armazenando/treinando com esses dados?

⚠️ Se algo **vaza** (banco invadido, prompt exposto), qual é o plano de
resposta?

---

## 9. Métricas & sucesso

🎯 **Como vocês medem que o Kevin está funcionando?**

🔍 Qual é o **KPI de negócio** hoje? (MRR? churn? NPS de escola?)

🔍 Qual é o **KPI de produto**? (Aulas concluídas por turma/mês? Mensagens
por conversa? Tempo médio de uso?)

🔍 Qual é o **KPI de aluno**? (Se existir — o aluno não faz login, mas há
alguma proxy?)

🔍 Vocês têm **dashboard** de uso? Onde?

🔍 O que vocês **gostariam de medir** e hoje não medem?

💡 Se vocês pudessem trocar 3 métricas hoje por 3 novas, quais seriam?

---

## 10. Suporte, operação e crise

🎯 **O que acontece quando um professor abre um chamado no meio da aula?**

🔍 Vocês têm **canal oficial** de suporte? Zendesk? WhatsApp? Email?

🔍 Qual é o **SLA de resposta** pra um professor em aula?

🔍 O que faz o Kevin **falhar** com mais frequência hoje?

🔍 Quando o Kevin falha, qual é o **plano B** do professor? (Ele tira o
Kevin da tela? Pula pra próxima atividade? Cancela a aula?)

🔍 Vocês têm **on-call**? Quem atende às 20h de uma quinta-feira?

⚠️ Já teve **incidente grave** (sistema fora por horas)? O que aconteceu?

---

## 11. Integrações & ecossistema

🎯 **Com quais sistemas o Kevin precisa conversar?**

🔍 A escola já tem **outro sistema** (secretaria, ERP escolar) onde os
alunos estão cadastrados? Vocês integram? Ou pedem cadastro duplicado?

🔍 **Google Classroom / Microsoft Teams for Education** — vocês têm SSO?
Deveriam?

🔍 A escola quer **exportar** dados pra fora? (Boletim, planilha, PDF?)

🔍 **WhatsApp** — vocês notificam pais/professores por lá?

🔍 **Google Meet / Zoom** — algum professor dá aula EAD com o Kevin
compartilhado por vídeo? Se sim, o áudio funciona bem?

---

## 12. Concorrência & mercado

🎯 **Quem são os concorrentes diretos do Kevin?** (Duolingo Kids? EF?
Cambridge One? Wizard Byyou? Alugobra? Alguém que faz IA em sala de aula?)

🔍 O que o Kevin faz que **eles não fazem**?

🔍 O que **eles fazem** que o Kevin não faz?

🔍 Vocês **perdem** clientes pra alguém específico? Pra quê?

⚠️ Se o **Duolingo lançasse "Duolingo for schools" com IA em português**
amanhã, o que muda pra vocês?

---

## 13. Roadmap & prioridades

🎯 **Se vocês pudessem construir uma coisa nos próximos 3 meses e uma nos
próximos 12 meses, o que seria?**

🔍 Qual é o **item mais votado** do backlog hoje?

🔍 Quais **features vocês já lançaram e removeram**? Por quê?

🔍 O que os **investidores/board** estão pedindo?

🔍 O que os **professores** pediriam se pudessem votar?

🔍 O que os **diretores** pediriam?

💡 Se o Kevin fosse **um outro produto** daqui a 2 anos, o que ele seria?
(Um app pra pais? Uma marketplace de conteúdo? Um professor de idioma
adulto?)

---

## 14. Comercial & pricing

🎯 **Como vocês precificam hoje?** Por escola? Por professor? Por aluno?
Por aula?

🔍 Tem **teto de uso**? (Ex.: X mensagens/mês por escola)

🔍 Vocês **cobram por consumo** de IA (repassam o custo do token) ou
absorvem?

🔍 Tem **desconto por volume**? Franquia grande paga menos por escola?

🔍 Se o custo de API **dobrar amanhã**, vocês repassam pra escola ou
comem a margem?

⚠️ Qual é o **cliente que dá mais receita**? Ele conhece esse dado?

---

## 15. Time e organização

🔍 Quem são as pessoas do time da Bebelingue que **eu deveria conversar
depois** (fora dessa reunião)?

🔍 Vocês têm **product designer**? UX researcher?

🔍 Vocês têm **pedagogo dedicado ao Kevin**?

🔍 Quem toma decisão sobre **features novas**? Comitê? Uma pessoa?

🔍 Como vocês **priorizam bugs vs features** hoje?

---

## 16. Ferramentas pra você (PO)

**Objetivo**: você vai voltar pra reunião e desenvolver — precisa de acesso.

🎯 **Quais acessos vocês vão me dar?**
- Ambiente de staging?
- Banco de dados (leitura)?
- Painel de custos (API providers)?
- Base de conhecimento interna?
- Roadmap (Notion, Linear, ClickUp)?
- Slack/Discord do time?

🔍 Quem é o **decisor de features** pra quem eu vou apresentar as ideias?

🔍 Vocês têm **critério de aceite** pra features novas ou eu quem vai
escrever?

🔍 Existe **guia de estilo** (voz do produto, tom, glossário)?

🔍 Vocês têm uma **arquitetura documentada** que eu ainda não vi?

🔍 Quem entende o **prompt do Kevin** hoje? Posso conversar com essa
pessoa separadamente?

---

## Fluxo sugerido pra reunião

Se você tiver **60 minutos**, ordem sugerida:

1. (5 min) Pergunta-âncora de **§1 (produto)** — só a primeira.
2. (10 min) **§2 (personas)** — 3 principais: comprador, professor, aluno.
3. (10 min) **§3 (currículo)** — porque é o coração.
4. (10 min) **§5 (personagem Kevin)** — porque é o diferencial.
5. (5 min) **§7 (voz/aula)** — porque é onde os bugs aparecem.
6. (5 min) **§9 (métricas)** — pra fechar em "como saberemos que ganhamos".
7. (5 min) **§13 (roadmap)** — pra sair com um "próximo passo" claro.
8. (10 min) **§16 (acessos e próximas etapas)** — logistics.

As perguntas de **§8 (LGPD), §10 (suporte crise), §14 (comercial), §12
(concorrência)** você guarda pra reuniões 1:1 específicas com quem é
responsável — não força numa reunião com o time inteiro.

---

## Saída esperada da reunião

Você deve voltar com:

- [ ] **Uma frase** que descreve o Kevin do jeito que o CLIENTE descreve
- [ ] **3 personas** com nome, dor e desejo (não descrição genérica)
- [ ] **1 KPI** principal do produto que o cliente monitora
- [ ] **3 features prioritárias** do backlog deles com **razão** por trás
- [ ] **Lista de acessos** solicitados (Slack, Notion, staging, etc.)
- [ ] **Nome + contato** de 2-3 pessoas com quem você vai falar depois
  (pedagogo, comercial, suporte)
- [ ] **Um risco** que eles reconhecem (custo de API? churn? escolas grandes?)
- [ ] **Uma coisa que eles NÃO querem** que vc mexa (área proibida — sempre
  existe uma)

Se você voltar com essas 8 coisas, foi uma boa reunião.
