# Análise do export novo (`export/`)

> Gerado em 07/09/2026, atualizado no mesmo dia após o Vitor subir uma segunda
> versão do export + README. Objetivo: entender o que o export traz, o que já
> está rodando em produção/dev hoje, e o que precisa mudar para instalar —
> **sem implementar ainda** (isso é só a análise; a implementação é outra
> conversa). Ver [DIARIO_EXPORT.md](DIARIO_EXPORT.md) para o passo a passo que
> vamos seguir quando formos executar.

## 0. ⚠️ O achado mais importante desta rodada

O export novo liga, **por padrão**, uma sequência de abertura própria dele
(`autoOpening: true`): ao criar o Kevin, o motor já monta um popup interno
(nome da aula + botão "Iniciar") por cima da cena, esperando alguém clicar
*naquele* botão pra tocar a entrada e emendar sozinho pra `tchau` → `speaking`.

**Isso colide de frente com o que já existe no telão.** O app já tem a
própria tela de espera (`#call-standby` / `#btn-iniciar-aula`, em
`templates/professor/aula_detail.html`) e o próprio fluxo de início
(`iniciarAula()` em `static/js/kevin_chat.js`, que dispara o kickoff da IA).
Se instalarmos sem mexer em nada, o motor vai desenhar **um segundo popup
"Iniciar"** dentro do palco do Kevin — e como o clique do botão da nossa tela
não aciona o botão interno do motor, esse popup interno **nunca fecha
sozinho**, ficando preso por cima do Kevin depois que a nossa tela de espera
já sumiu.

**A correção é simples e documentada pelo próprio export:** passar
`autoOpening: false` na chamada de `createKevinPuppet(...)` dentro de
`static/js/kevin-puppet-integration.js`. Com isso o motor não desenha o
popup próprio e a integração continua chamando `kevin.playEntrada()` na hora
certa (Passo 9 do README dele), exatamente como já estava planejado. **Não é
opcional — sem esse flag, a instalação quebra o fluxo de abrir a aula.**

## 1. O que já está instalado hoje vs. o export

| | Rodando (`static/js/kevin-puppet/`) | Export novo (`export/`) |
|---|---|---|
| `kevin-puppet.js` | 106 KB | 138 KB |
| `kevin-puppet.css` | 2,1 KB (80 linhas) | 5,5 KB (221 linhas) |
| `kevin-rigged.svg` | 184.710 bytes | **idêntico** (mesmo MD5, não mudou nesta nem na rodada anterior) |
| Modos (`setMode`) | `off·standby·thinking·speaking·sleeping·musica·tchau` (7) | mesmos 7 **+ `celebrate`** (8) |
| Mosca | `startMosca/dismissMosca/isMoscaActive` | idêntico |
| Cenários | 7 (`floresta, quarto, banheiro, escola-int, escola-ext, hospital, hospital-int`), `setBackground()` | mesmos 7, mesma resolução (1672×941) |
| Teaching/vocabulário | não existe | `startTeaching()`/`stopTeaching()` com câmera+quadro **animados** (ver §3) |
| Camuflage | não existe | `playCamuflage()` — gira o matiz de cor 0→360→0, disparo único |
| Abertura | app orquestra 100% na mão | motor tem sequência própria opcional (`autoOpening`, ver §0) |
| Áudio ambiente | não existe | música de fundo em loop + ronco no `sleeping` (ver §5.2 — **arquivos não entregues**) |
| `assets/` | **não existe** — nenhum vídeo/áudio/quadro/vocabulário no projeto hoje | pasta completa nova (ver §3) |

A integração atual (`static/js/kevin-puppet-integration.js`) é um adaptador
que expõe `window.KevinChatIntegration`, chamado por `static/js/kevin_chat.js`.
Ele já foi escrito para ser **tolerante a métodos que não existem** (ex.:
`if (kevinChat.playMusica) ...`), então plugar funções novas do motor não deve
quebrar nada do que já funciona — **com a exceção do `autoOpening`** (§0), que
precisa de um flag explícito porque o comportamento *padrão* mudou.

## 2. Resultado do validador

```
python3 scripts/validar_export.py export/
```

**Passou 100%, 0 erros, 0 avisos** — nas duas versões entregues hoje.
Estrutura, changelog, SVG (peso, IDs obrigatórios, esqueleto dentro de
`Bones_*`, Mosca, variantes de mão), cenários (peso e resolução) e vídeo de
transição, tudo dentro do contrato.

O SVG é **byte-a-byte idêntico** ao que já está em produção — risco zero de
quebrar IDs (a causa mais comum de bug neste projeto). Só `kevin-puppet.js`,
`kevin-puppet.css` e `README.md` mudaram.

> O validador não checa `autoOpening`, música de fundo ou Teaching/Camuflage
> — são recursos novos demais para o contrato atual. Isso é esperado: o
> validador cobre o que já causou bug antes (Regras 1–6 de
> `docs/mensagem.md`), não tudo que pode dar errado.

## 3. O que é genuinamente novo (não existe no motor rodando hoje)

| Recurso | API | Asset que usa |
|---|---|---|
| **Modo `celebrate`** | `setMode("celebrate")` — pulo comemorativo + confete, volta sozinho pra `standby` | `assets/audio/efeitos-sonoros/celebrate.mp3` (35 KB, entregue) |
| **Animação de entrada** | `kevin.playEntrada()` — toca o vídeo uma vez, "abre a cortina" e revela o Kevin | `assets/videos/entrada-kevin.webm` (entregue) |
| **Teaching de verdade** | `startTeaching()`/`stopTeaching()`/`isTeachingActive()` — câmera aproxima e um quadro-negro desliza até o lugar (~1-2s), sequência animada de verdade (antes era só mostrar/esconder instantâneo) | `assets/obj/quadro-negro.png` (entregue) |
| **Vocabulário no quadro** | `showTeachingVocabulary(id\|item)`, `hideTeachingVocabulary()`, `hideVocabulary()`, `setVocabularyItems()`, `getVocabularyItems()` — agora **ativa o Teaching de verdade** ao mostrar uma palavra | `assets/img/vocabulario/*.png` (14/14 entregues) |
| **Camuflage** | `playCamuflage()` — gira o matiz de cor do Kevin inteiro, disparo único, aditivo | nenhum asset — só cor |
| **Sequência de abertura própria** | `autoOpening` (default `true`), `setLessonName(nome)` — ver §0, **precisa ser desativada** | usa o próprio `entrada-kevin.webm` |
| **Áudio ambiente** | música de fundo em loop (junto com `playEntrada`) + ronco durante `sleeping`, ambos automáticos | `assets/audio/backsound/trilha-padrao.mp3`, `assets/audio/voz-kevin/ronco-kevin.mp3` — **citados no README, mas não estão na pasta entregue** (ver §5.2) |
| Opções novas no construtor | `entradaVideoUrl`, `teachingBoardUrl`, `teachingCameraZoom/PanX/PanY`, `teachingObjectZoom/OffsetX/EnterY/RestY`, `celebrateAudioUrl/Volume/PlayDelayMs`, `backsoundMusicUrl/Volume`, `snoreAudioUrl/Volume`, `autoOpening`, `lessonName` | — |

Isso confirma itens que já estavam listados como pendência em `CLAUDE.md`
(seção "C. Esperando o animador"):
- ✅ **`entrada-kevin.webm` chegou** e agora tem API pra tocar (`playEntrada`) — falta só ligar no clique de "Iniciar aula" (ver §6).
- ✅ **Changelog no README** — completo e detalhado nas duas rodadas de hoje.
- ❓ **Chão do cenário `quarto`** — o changelog não menciona correção do chão. Precisa conferir a olho no `demo.html` antes de assumir resolvido.

## 4. O que NÃO mudou (baixo risco)

- SVG idêntico → nenhuma variante de mão, bone ou ID foi renomeado.
- Os 7 modos antigos e a Mosca continuam com a mesma assinatura.
- Os 7 backgrounds continuam com o mesmo nome de arquivo e resolução — não
  precisa mexer em `BACKGROUND_CHOICES` (`apps/curriculo/models.py`).
- `setMode`, `setAudioInput`, `setBackground` — mesma assinatura de sempre.

## 5. Achados que valem atenção antes de instalar

1. ~~Vocabulário incompleto~~ **Resolvido.** A pasta `assets/img/vocabulario/`
   tem as **14 imagens**, uma para cada ID de `DEFAULT_VOCABULARY_ITEMS`.
2. ~~Áudio ambiente prometido no README, mas ausente na pasta~~ **Resolvido.**
   O Vitor acrescentou `assets/audio/backsound/trilha-padrao.mp3` e
   `assets/audio/voz-kevin/ronco-kevin.mp3`. Veio também um extra não
   documentado, `assets/audio/backsound/forest-ambience.mp3` — não é
   referenciado por nenhum default da API hoje, aparenta ser pensado pra
   trilha por cenário no futuro; copiado junto, sem uso no momento.
3. **`autoOpening: true` por padrão — ver §0.** O achado crítico desta
   rodada; precisa de `autoOpening: false` explícito na integração.
4. **Mudança de comportamento em `hideTeachingVocabulary()`**: antes escondia
   o quadro instantâneo; agora também desativa o Teaching por completo
   (câmera + quadro saem animados, ~1-2s). Hoje nada no app chama esse método
   ainda, então não quebra nada *agora* — só registrar para quando formos
   implementar o quadro de vocabulário de verdade, não assumir que é
   instantâneo.
5. **Dois nomes de arquivo tortos** (mas funcionais): `wahs-my-face.png`
   (typo de "wash") e `take-a-shower .png` (espaço antes do `.png`). O código
   referencia exatamente esses nomes, então não quebra nada — mas é frágil a
   qualquer correção manual futura do nome. Vale reportar ao Vitor.
6. **Fonte "Bungee"** referenciada no CSS mas nunca carregada via Google
   Fonts — sempre cai no fallback `"Space Grotesk", sans-serif`. Pré-existente,
   não é regressão desta entrega.
7. **Decisões de escopo — resolvidas em 07/09/2026** (ver
   [DIARIO_EXPORT.md](DIARIO_EXPORT.md), Entradas 4 e 5):
   - ✅ **Celebrate**: dispara ao acertar algo no chat, via **tool-calling**
     (`celebrar_acerto`) nos providers de IA — decisão **D38**
     (`docs/demandas.md`). Implementado: `Mensagem.celebrar`, migração,
     serializer, os dois providers (Anthropic/OpenAI) e os 3 pontos do
     frontend que produzem resposta do assistente. 6 testes novos (mockados,
     sem chave real) + suíte completa passando (61/61). **Falta testar com
     chave real** antes de confiar em produção.
   - ✅ **Teaching/vocabulário**: vínculo no domínio fica pra quando a
     construção da aula (área da coordenação) for remodelada. Nada
     implementado agora de propósito — API disponível, sem gatilho.
   - ✅ **Camuflage**: fica só disponível na API, sem gatilho automático.

## 6. Instalação mecânica — ✅ feita em 07/09/2026

| Arquivo do export | Destino | Ação |
|---|---|---|
| `kevin-puppet.js` | `static/js/kevin-puppet/kevin-puppet.js` | ✅ substituído |
| `kevin-puppet.css` | `static/js/kevin-puppet/kevin-puppet.css` | ✅ substituído |
| `kevin-rigged.svg` | `static/js/kevin-puppet/kevin-rigged.svg` | não precisou (idêntico) |
| `assets/videos/*.webm` | `static/js/kevin-puppet/assets/videos/` | ✅ copiado |
| `assets/audio/efeitos-sonoros/*.mp3` | `static/js/kevin-puppet/assets/audio/efeitos-sonoros/` | ✅ copiado |
| `assets/audio/backsound/*.mp3` | `static/js/kevin-puppet/assets/audio/backsound/` | ✅ copiado |
| `assets/audio/voz-kevin/*.mp3` | `static/js/kevin-puppet/assets/audio/voz-kevin/` | ✅ copiado |
| `assets/obj/quadro-negro.png` | `static/js/kevin-puppet/assets/obj/` | ✅ copiado |
| `assets/img/vocabulario/*.png` | `static/js/kevin-puppet/assets/img/vocabulario/` | ✅ copiado |
| `assets/backgrounds/*.png` | já existem como `.webp` em produção | não copiado (de propósito) |

E:
1. ✅ `.gitignore` ampliado pras pastas novas de mídia (`audio/`, `obj/`, `img/`).
2. ✅ **`autoOpening: false`** na chamada de `createKevinPuppet(...)` em
   `static/js/kevin-puppet-integration.js` — obrigatório, ver §0.
3. ✅ `kevin.playEntrada()` ligado no clique de "Iniciar aula" via um novo
   método `playEntrada()` na fachada `KevinPuppetIntegration`, chamado em
   `iniciarAula()` (`static/js/kevin_chat.js`).
4. ✅ Cache-buster bumpado nos dois `<script>` de `aula_detail.html` **e**
   no import interno de `kevin-puppet.js` dentro da integração (senão só
   bumpar o script externo não re-busca o módulo importado).
5. ⬜ **Falta testar no browser** — Docker não estava rodando nesta sessão,
   então isso não foi visualmente verificado ainda. Conferir todos os modos,
   a entrada, e que os controles não invadem o cenário (fix aplicado à parte,
   antes desta instalação).

`celebrate` já está com gatilho implementado (D38 — ver §5.7 e
[DIARIO_EXPORT.md](DIARIO_EXPORT.md) Entrada 5). Teaching/vocabulário e
Camuflage ficam copiados/disponíveis na API, **sem gatilho automático** de
propósito (§5.7).

## 7. Resumo

O export está tecnicamente limpo (validador 100% nas duas rodadas, SVG
intacto) e cresceu bastante em funcionalidade: `celebrate`, `playEntrada`,
Teaching/vocabulário animado, Camuflage, áudio ambiente e uma sequência de
abertura própria. A instalação mecânica (§6) e o gatilho do `celebrate`
(§5.7, D38) já estão implementados e com 61/61 testes passando. Falta:
**testar no browser** (Docker não disponível nesta sessão) e **testar o
celebrate com uma chave real de IA** antes de confiar nisso em produção —
nenhum dos dois foi verificado de ponta a ponta ainda.
