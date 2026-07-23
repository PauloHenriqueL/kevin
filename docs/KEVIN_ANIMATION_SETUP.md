# Kevin Animation System — Setup & Usage

Implementação **modular** (Opção B) do sistema de animação do Kevin, integrada com o chat.

## 📁 Arquivos Criados

```
static/js/
  ├── KevinRig.js                    — Carrega SVG e controla animações
  ├── KevinAnimations.js             — Funções de efeito reutilizáveis
  └── KevinChatIntegration.js        — Integração com o sistema de chat

static/css/
  └── kevin-chat-animation.css       — Estilos de animações do chat

templates/
  └── professor/aula_detail.html     — Modificado para montar Kevin animado

animations/                           — Referência (demo)
  ├── kevin-rigged.svg              — Modelo SVG com rigging
  ├── app.js                        — Playground (não usado em prod)
  ├── styles.css                    — Estilos do playground
  └── index.html                    — Demo interativa
```

---

## 🎬 Como Funciona

### 1. **KevinRig.js** — Classe Principal

Carrega o SVG do Kevin e expõe métodos para controlar:
- **Boca**: `setMouthShape(shapeKey)`, `animateTalkingSequence(ms)`
- **Olhos**: `blink()`, piscadas automáticas
- **Cabeça**: `rotateHead(degrees)`

```javascript
const rig = new KevinRig('#kevin-rig-mount', '/static/css/animations/kevin-rigged.svg');
await rig.load();

// Animar boca falando
rig.animateTalkingSequence(3000);

// Piscar
rig.blink();

// Rotacionar cabeça
rig.rotateHead(15);
```

### 2. **KevinAnimations.js** — Efeitos Reutilizáveis

Encapsula comportamentos compostos:

```javascript
const animations = new KevinAnimations(rig);

// Falar (com duração automática ou manual)
animations.talk(3000);

// Múltiplas piscadas
await animations.blinkMultiple(2, 300);

// Balanço de cabeça
animations.nodHead(15, 600);

// Kevin escuta
animations.listen(3000);

// Saudação amigável
await animations.greet('Oi! Como posso ajudar?');

// Confusão
animations.confused();

// Entusiasmo
animations.excited(2000);
```

### 3. **KevinChatIntegration.js** — Integração com Chat

Conecta animações com eventos do chat:

```javascript
const kevinChat = new KevinChatIntegration(
  '#kevin-rig-mount',
  '/static/css/animations/kevin-rigged.svg'
);
await kevinChat.init();

// Usuário envia mensagem
kevinChat.onUserMessage('Oi Kevin!');

// Kevin responde
kevinChat.onAssistantMessage('Olá! Como posso ajudar?', 3000);

// Pergunta
kevinChat.onQuestion('O que é uma preposição?');

// Erro
kevinChat.onError();

// Saudação inicial
await kevinChat.greet('Bem-vindo ao Kevin!');

// Reset ao neutro
kevinChat.reset();
```

---

## 🎮 Integração no Chat

No `templates/professor/aula_detail.html`:

```html
<!-- SVG animado montado aqui -->
<div id="kevin-rig-mount" class="kevin-rig-chat"></div>

<!-- Configuração global (window.KEVIN_RIG_CONFIG) -->
<script>
window.KEVIN_RIG_CONFIG = {
    svgUrl: "{% static 'css/animations/kevin-rigged.svg' %}",
    rigMountSelector: "#kevin-rig-mount",
};
</script>

<!-- Carregar módulos -->
<script src="{% static 'js/KevinRig.js' %}"></script>
<script src="{% static 'js/KevinAnimations.js' %}"></script>
<script src="{% static 'js/KevinChatIntegration.js' %}"></script>
<script src="{% static 'js/kevin_chat.js' %}"></script>
```

No `static/js/kevin_chat.js`:

```javascript
let kevinChat = null;

async function initializeKevin() {
  kevinChat = new KevinChatIntegration(
    window.KEVIN_RIG_CONFIG.rigMountSelector,
    window.KEVIN_RIG_CONFIG.svgUrl
  );
  await kevinChat.init();
}

// Inicializa Kevin
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeKevin);
} else {
  setTimeout(initializeKevin, 100);
}

// Dispara animações em eventos
function enviarMensagem() {
  // ...
  if (kevinChat) {
    kevinChat.onUserMessage(texto);
  }
}

function pollResposta() {
  // ...
  if (kevinChat) {
    kevinChat.onAssistantMessage(resposta);
  }
}
```

---

## 🎨 Estilo & CSS

Arquivo: `static/css/kevin-chat-animation.css`

Animações incluídas:
- **Fade-in** para mensagens
- **Bounce** em botões
- **Pulse** no microfone
- **Typing indicator** animado
- **Slide-in** para bubbles

---

## 🔧 Como Estender

### Adicionar Novo Efeito em KevinAnimations

```javascript
excitedAboutLesson(topic) {
  this.talk(2000);
  this.nodHead(20, 600);
  // Piscar 3x rapidinho
  for (let i = 0; i < 3; i++) {
    setTimeout(() => this.rig.blink(), i * 150);
  }
}
```

### Usar em Outros Lugares

```javascript
// Página de aulas (não é chat, mas Kevin está lá)
const kevinHeader = new KevinAnimations(rig);
kevinHeader.greet('Bem-vindo às aulas!');

// Biblioteca de conteúdos
kevinLibrary.excited();

// Relatório de progresso
kevinReport.talk(2000);
```

---

## 📋 Estrutura do SVG

Kevin tem **múltiplas poses** (frontal, 3/4, perfil) e para cada pose:

- **Boca**: Neutral, M, Aa, Oh, Uh, F, L, S, R, D, w-Oo, Surprised
- **Olhos**: Left/RightEyeball, Left/RightPupil, blinks
- **Cabeça**: Pode rotacionar (pivot point: 493, 460.9)
- **Corpo**: Braços, pernas, cauda (presentes em `app.js` do playground)

No chat, usamos **pose frontal** (padrão, mais amigável).

---

## ⚙️ Configuração

### Tamanho do Kevin no Chat

```css
.kevin-rig-chat {
  width: 48px;
  height: 48px;
}
```

Mude para variar o tamanho.

### Duração das Animações

```javascript
// Ajustar duração de fala (default: ~50ms/char)
kevinChat.onAssistantMessage(resposta, 5000); // força 5s

// Ajustar intervalo de piscadas (em KevinRig)
this.nextBlinkAt = time + (Math.random() * 3000 + 3000); // 3-6s
```

### Velocidade de Animação (CSS)

```css
/* Aumentar velocidade de fade-in */
@keyframes fadeInMessageUp {
  /* ... */
}

.message.assistant {
  animation: fadeInMessageUp 0.15s ease-out; /* mais rápido */
}
```

---

## 🐛 Troubleshooting

**Kevin não aparece:**
- Verifique se `window.KevinChatIntegration` está disponível (scripts carregados?)
- Verifique console para erros de carregamento do SVG
- Verifique se `#kevin-rig-mount` existe no DOM

**Animações lentas:**
- Reduzir frequência de piscadas
- Reduzir duração de `animateTalkingSequence`

**SVG cortado:**
- Ajustar tamanho em `.kevin-rig-chat`
- Verificar escala do SVG

---

## 📚 Referência Completa

| Método | Descrição | Params |
|--------|-----------|--------|
| `rig.load()` | Carrega SVG | — |
| `rig.setMouthShape(key)` | Define forma de boca | `'neutral'` \| `'m'` \| `'aa'` \|... |
| `rig.animateTalkingSequence(ms)` | Anima sequência de fala | ms (duração) |
| `rig.blink()` | Pisca olhos | — |
| `rig.rotateHead(deg)` | Rotaciona cabeça | -35 a 35 graus |
| `animations.talk(ms)` | Kevin fala | ms |
| `animations.listen(ms)` | Kevin escuta | ms |
| `animations.greet(text)` | Saudação completa | texto |
| `animations.confused()` | Mostra confusão | — |
| `animations.excited(ms)` | Mostra entusiasmo | ms |
| `kevinChat.onUserMessage(text)` | Usuário envia msg | texto |
| `kevinChat.onAssistantMessage(text, ms)` | Kevin responde | texto, ms (opcional) |
| `kevinChat.onQuestion(text)` | Pergunta feita | texto |
| `kevinChat.onError()` | Erro ocorreu | — |
| `kevinChat.greet(text)` | Saudação inicial | texto |
| `kevinChat.reset()` | Reset ao neutro | — |

---

## 🚀 Próximos Passos

- [ ] Integrar TTS (text-to-speech) — Kevin "fala" de verdade
- [ ] Sincronizar movimento de boca com áudio TTS
- [ ] Mais poses durante conversa (girar cabeça, gesticular)
- [ ] Feedback visual para erros
- [ ] Animação de "pensamento" (piscadas + cabeça inclinada) enquanto aguarda resposta
