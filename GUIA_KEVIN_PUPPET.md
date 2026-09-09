# Guia — como implementar mods novos do Kevin

> Escrito em 08/09/2026, depois da instalação do export com `celebrate`,
> Teaching, Camuflage e áudio ambiente, e de uma rodada de ajustes finos
> (aceno, entrada congelada, layout). Este documento é o **padrão a seguir**
> da próxima vez que o Vitor mandar um mod novo (e ele vai mandar mais — o
> motor já foi de 4 modos pra 8 mais dois efeitos aditivos em duas entregas).
>
> **Leia também [DIARIO_EXPORT.md](DIARIO_EXPORT.md)** — é o histórico
> entrada-por-entrada de tudo que foi decidido e implementado até aqui
> (9 entradas). Este guia é o *resumo prescritivo*; o diário é a *prova de
> como cada decisão foi tomada*, com o raciocínio completo. Quando um padrão
> aqui parecer incompleto ou um caso não se encaixar, o diário provavelmente
> já tem o caso parecido. Ver também [ANALISE_EXPORT.md](ANALISE_EXPORT.md)
> para o levantamento técnico do export atualmente instalado.

---

## 1. As 3 camadas — onde cada coisa entra

```
kevin-puppet.js / .css / .svg    ← "vendored": entregue pelo Vitor, NUNCA editar
        ↑ (createKevinPuppet, setMode, playX, etc.)
kevin-puppet-integration.js      ← A FACHADA. Toda orquestração mora aqui.
        ↑ (window.KevinChatIntegration)
kevin_chat.js                    ← UI do chat + chamadas na hora certa
        ↑ (window.KEVIN_RIG_CONFIG, KEVIN_CHAT_CONFIG)
templates/professor/aula_detail.html   ← config, URLs de asset, cache-buster
```

**Regra de ouro:** `kevin-puppet.js`/`.css`/`.svg` são entrega do animador —
tratar como biblioteca de terceiro. Se algo nesses arquivos precisa mudar
(bug, comportamento errado), o pedido volta pro Vitor (`docs/mensagem.md`),
não se corrige por cima aqui. Toda lógica de app — quando um modo dispara,
como ele se encaixa no resto do chat, timers, delays — vive em
`kevin-puppet-integration.js`.

## 2. Padrões pra cada tipo de mod novo

O motor não tem só uma categoria de "efeito" — cada tipo pede um padrão
diferente. Antes de conectar um mod novo, identifique qual desses ele é:

### 2.1 — Gesto de disparo único, sem Promise de conclusão

Exemplos já implementados: `celebrate`, `tchau` (reusado como aceno de "oi").

O motor **não** resolve uma Promise quando o gesto termina — `setMode('x')`
retorna assim que a troca é aceita, não quando a animação acaba. Padrão:

1. Achar as constantes de timing do gesto no `kevin-puppet.js` (busque por
   `_WAVE_`, `_PHASE`, frequências/ciclos — ex: `TCHAU_WAVE_FREQ`,
   `TCHAU_WAVE_CYCLES`) e **calcular a duração real**, não chutar. Ex.: tchau
   = 3 ciclos a 1,5Hz (waving) + tempo de entrada/saída via lerp ≈ 2,6s total.
2. Na fachada, criar um método que dispara o modo e espera esse tempo fixo
   antes de resolver:
   ```js
   async meuGesto() {
     if (!this._initialized) return false;
     this._kickActivity();
     const ok = await this.kevin.setMode('meugesto');
     if (!ok) return false;
     await new Promise((r) => setTimeout(r, DURACAO_MEDIDA_MS));
     return true;
   }
   ```
3. Documentar de onde veio o número (qual constante, qual conta) no
   comentário — quem ler depois precisa saber que não foi chute.

### 2.2 — Variação de standby (aditivo, roda por cima da ociosidade)

Exemplos: `Mosca` (do export original), `Camuflage` (adicionado nesta
sessão, Entrada 8).

Padrão: entra no loop de ociosidade (`_startIdleLoop`/`_stopIdleLoop`),
com o mesmo esqueleto de `_scheduleMosca()`:

```js
_scheduleNovaVariacao() {
  clearTimeout(this._novaVariacaoTimer);
  const espera = MIN_MS + Math.floor((MAX_MS - MIN_MS) * Math.random());
  this._novaVariacaoTimer = setTimeout(() => {
    if (this._idleActive && this.kevin.getMode() === 'standby'
        && !this.kevin.isMoscaActive() /* + guards de outras variações */) {
      this.kevin.playNovaVariacao();
    }
    if (this._idleActive) this._scheduleNovaVariacao();
  }, espera);
}
```

Checklist:
- [ ] Timer novo declarado no constructor e limpo em `_stopIdleLoop()`
- [ ] Chamada de agendamento adicionada em `_startIdleLoop()`
- [ ] Guard pra não competir com as outras variações já existentes (mosca,
      camuflage) — decida se podem coexistir ou se uma deve esperar a outra
- [ ] Cadência (MIN/MAX) documentada — "igual à mosca" (40-90s) é o padrão
      default combinado com o Paulo; só usar outro valor se ele pedir

### 2.3 — Efeito disparado pela IA (sinal vindo do backend)

Exemplo: `celebrate` ao acertar no chat (D38, `docs/demandas.md`).

Isso é o padrão mais caro — envolve as 4 camadas do app, não só o
frontend. Antes de implementar, **decidir com o Paulo o mecanismo de
sinalização** (não inventar sozinho — ver 3 abordagens comparadas na
Entrada 5 do diário: marcador de texto, heurística por palavra-chave, ou
tool-calling estruturado). Uma vez decidido, o fluxo completo é:

1. **Modelo**: campo booleano/enum em `Mensagem` (`apps/chat/models.py`) +
   migração
2. **Provider** (`apps/chat/providers/ia.py`): tool/instrução pro modelo
   sinalizar — se for tool-calling, tratar o caso de "tool chamada sem texto
   na mesma rodada" com uma rodada de continuação (ver `AnthropicProvider`/
   `OpenAIProvider` como referência)
3. **`BaseIAProvider.chat()`**: se a assinatura mudar (ex.: de `str` pra
   `tuple`), atualizar as DUAS implementações e os call sites em
   `apps/chat/tasks.py`
4. **Serializer** (`apps/chat/serializers.py`): expor o campo novo — sem
   isso ele nunca chega no frontend
5. **Frontend**: método na fachada (`kevin-puppet-integration.js`) +
   plugar em **TODOS os pontos que produzem resposta do assistente** em
   `kevin_chat.js` — hoje são 3: texto assíncrono (`pollResposta`), modo
   chamada (`sendTextAndSpeak`), áudio/mic (`handleRecordingStop`). Esquecer
   um desses é o erro mais fácil de cometer aqui.
6. **Testes**: mockar o client da IA (`unittest.mock.patch` no client
   `anthropic.Anthropic`/`openai.OpenAI`) — não precisa de chave real pra
   testar o *parsing*. Mas **isso não substitui testar com chave real** antes
   de confiar em produção — o teste mockado prova que o código trata
   corretamente uma resposta no formato esperado, não que o modelo de
   verdade vai se comportar como o mock.

### 2.4 — Asset novo (vídeo/áudio/imagem) sem novo comportamento

Exemplo: cenários novos, sons de efeito.

1. Copiar pra `static/js/kevin-puppet/assets/<tipo>/`
2. Conferir se a pasta já está coberta pelo `.gitignore` (regra
   `static/js/kevin-puppet/assets/*` — mídia nunca vai pro Git, ver
   `CLAUDE.md` → "Assets do Kevin")
3. Se for cenário novo: registrar em `BACKGROUND_CHOICES`
   (`apps/curriculo/models.py`)
4. **Verificar que o arquivo existe de fato no disco**, não só que o
   template/CSS o referencia — a Entrada 6 do diário documenta um bug real
   causado exatamente por essa suposição errada (backgrounds "existiam" só
   porque o código os citava; a pasta inteira estava vazia)

## 3. Cinco erros já cometidos nesta integração — não repetir

| # | Erro | Onde doeu | Como evitar da próxima vez |
|---|---|---|---|
| 1 | Assumir que um default do construtor do motor (`createKevinPuppet(...)`) não mudou entre versões | `autoOpening` virou `true` por padrão numa atualização e criou um popup interno que nunca fechava | Sempre diffar a seção "API completa" do README do export contra o que `kevin-puppet-integration.js` passa explicitamente — ver Playbook do diário, passo 6 |
| 2 | Bumpar só o `?v=` do `<script>` externo | O `import` ES module interno (`kevin-puppet/kevin-puppet.js`) é cacheado pela própria URL, sem query string — o navegador servia o motor velho mesmo com o `?v=` do wrapper atualizado | Bumpar os DOIS: o `<script src=...?v=N>` E o `import ... from './kevin-puppet/kevin-puppet.js?v=N'` dentro do `kevin-puppet-integration.js` |
| 3 | Sobrescrever o posicionamento interno do puppet pra "resolver" um problema de layout externo | Um hack (`bottom: var(--controls-safe)`) foi adicionado pra abrir espaço pros controles, e isso desalinhou o Kevin do "chão" do cenário — teve que ser revertido | Nunca tocar em `.kevin-puppet-mount`/`.kevin-stage` (regras do próprio `kevin-puppet.css`). Se a UI (controles, chat) precisa de espaço, ela resolve isso na PRÓPRIA camada (z-index, opacity, posição), nunca empurrando o palco |
| 4 | Confiar que um asset existe porque o código o referencia | `assets/backgrounds/*.webp` não existiam no disco deste checkout; ninguém tinha notado porque ninguém tinha rodado o telão nesse Mac ainda | Testar no browser de verdade assim que possível — `curl` no arquivo estático confirma que ele existe e é servido, o que grep no template não confirma |
| 5 | Presumir causa de um bug de layout sem achar a regra CSS/JS responsável | "o chat empurra o Kevin" foi reportado, mas a auditoria não achou nenhuma regra que fizesse isso — a correção aplicada (`contain:layout`) é uma garantia formal, não a prova de que era essa a causa | Quando a causa não é encontrada por leitura de código, dizer isso explicitamente em vez de inventar uma explicação — e pedir print/vídeo pra confirmar visualmente |

## 4. Processo de instalação (resumo — completo no diário, seção 0)

1. `python3 scripts/validar_export.py <pasta>/` — não instala se ❌
2. `md5` no SVG — igual ao atual = risco baixo; diferente = reler
   `docs/mensagem.md` §A.4 com atenção nos IDs
3. Ler o changelog do export e cruzar com o TODO do `CLAUDE.md`
4. Diff arquivo a arquivo contra `static/js/kevin-puppet/`
5. Separar mecânico (copiar, cache-bust) de decisão de escopo (quando um
   modo dispara — nunca inventar, perguntar)
6. Copiar seguindo a tabela de destino (código → Git, mídia → fora)
7. Bump de cache-buster (os dois lugares, ver erro #2 acima)
8. Testar no browser — todos os modos, comparar com `demo.html`
9. Commitar só o que versiona

## 5. Pendências desta implementação (consolidado do diário)

> Lista viva — ao resolver um item, marcar aqui **e** na entrada
> correspondente do `DIARIO_EXPORT.md`.

**Bloqueiam confiar em produção:**
- [ ] **Testar `celebrate` com chave real de IA** (Anthropic e/ou OpenAI) — os
      6 testes automatizados mockam o formato de resposta da API, não
      provam que o modelo de verdade chama a tool na hora certa (Entrada 5)
- [ ] **Confirmação visual completa no browser** de tudo que mudou nas
      Entradas 6-9 (proporção do Kevin, controles discretos, entrada
      congelada, aceno, alinhamento do header) — o Paulo foi pedindo ajustes
      em cima de ajustes; falta um "sim, bateu" final em cada item
- [ ] **Item 3 da Entrada 8** (chat "empurrando" o Kevin) especificamente —
      a correção aplicada (`contain:layout`) não veio de uma causa
      confirmada. Se o Paulo ainda ver o problema, precisa de print/vídeo
      pra achar a causa real

**Decisões de escopo pendentes:**
- [ ] **Vínculo do Teaching/vocabulário no domínio** — adiado de propósito
      pra quando a construção da aula (área da coordenação) for
      remodelada. Registrar como demanda formal em `docs/demandas.md`
      quando esse trabalho entrar em pauta (Entrada 4)
- [ ] **Chão do cenário `quarto`** — bug conhecido antigo (Kevin pisa em
      cima da cama). O changelog das versões recentes do export não
      confirma correção. Verificar a olho no `demo.html` antes de assumir
      resolvido ou não (Entrada 1/3)

**Dívidas técnicas, não bloqueantes:**
- [ ] **Este diretório não é um repositório git** — nada do trabalho desta
      sessão (nem o app, nem este guia) tem qualquer proteção de
      versionamento. Decisão do Paulo se/quando rodar `git init` (Entrada 6)
- [ ] **`staticfiles/` parece estar versionado** — é artefato de build
      (saída de `collectstatic`), não deveria estar no repositório.
      Investigar separadamente (Entrada 6)
- [ ] **Dois nomes de arquivo tortos** em `assets/img/vocabulario/`
      (`wahs-my-face.png` com typo, `take-a-shower .png` com espaço) —
      funcionam, mas são frágeis a qualquer correção manual futura do nome.
      Reportar ao Vitor pra próxima entrega (Entrada 1)
- [ ] **`forest-ambience.mp3`** entregue em `assets/audio/backsound/` sem
      nenhum default da API que o referencie — provavelmente pensado pra
      trilha por cenário no futuro. Perguntar ao Vitor a intenção antes de
      inventar um uso (Entrada 4)

## 6. Referências

- [DIARIO_EXPORT.md](DIARIO_EXPORT.md) — histórico completo, entrada por
  entrada, com o raciocínio por trás de cada decisão. **A fonte primária.**
- [ANALISE_EXPORT.md](ANALISE_EXPORT.md) — levantamento técnico do export
  atualmente instalado (o que mudou vs. o que já rodava)
- `docs/mensagem.md` — contrato técnico com o animador (regras de
  exportação, validador, changelog esperado)
- `docs/demandas.md` — decisões de domínio registradas (D1…D38), incluindo
  D38 (gatilho do `celebrate`)
- `CLAUDE.md` → seção "Kevin Animation System" e "Exports de animação do
  animador — como lidar"
