# Resposta técnica ao `animador.md`

> Análise do lado do motor (`export/kevin-puppet.js`), cruzando cada regra do
> guia com o que o código realmente faz. Objetivo: separar "isso é regra de
> exportação" de "isso o motor já defende sozinho, então se ainda quebra é
> outra causa".

---

## Achado principal: o motor já força a maioria dessas regras via JS

Isto muda o diagnóstico de quase todas as "Regras" do documento: o
`kevin-puppet.js` **não confia no estado visual que vem dentro do SVG**. Ele
recalcula visibilidade em JS, por `id`, toda vez que o rig é montado
(`buildRigState()` → `initDefaultVisibility()`), usando `style.display`
inline — que tem prioridade sobre qualquer classe CSS (`.st36{stroke:...}`,
`display:none` de camada do Illustrator, etc.) embutida no próprio arquivo.

Isso significa: **se um bug de visibilidade aparece mesmo assim, o problema
quase sempre é estrutural (elemento fora do grupo/prefixo esperado), não
"a classe saiu com stroke visível"**. Fica mais fácil localizar a causa raiz
sabendo disso.

---

## Regra 1 — Esqueleto visível

**O que o motor faz:** `buildRigState()` coleta `bonesGroup.querySelectorAll("*")`
para cada um de `Bones_Left_Arm`, `Bones_Right_Arm`, `Bones_Right_leg`,
`Bones_Right_leg1`, `Bones_Body`, e aplica `node.style.display = "none"` em
**todos** eles, incondicionalmente, assim que o rig é montado — antes de
qualquer frame ser desenhado. Isso roda **independente** do que a classe
`.st36` diz no `<style>` do SVG; `style.display` inline sempre vence.

**Diagnóstico revisado:** se o esqueleto ainda aparece no nosso sistema, a
causa mais provável **não é** "a classe saiu com stroke" (isso o motor já
neutraliza) — é a arte do osso **não estar aninhada dentro do grupo `Bones_*`
correto**. Se o animador desenhou/exportou os bones como camadas soltas fora
desses grupos (ex.: um grupo `Bones_Left_Arm_v2` ou bones soltos direto em
`Left_Arm`), o `querySelectorAll` não os encontra e eles nunca são ocultados.

**Pergunta melhor para a pergunta 5/6 do questionário:** não "como você
esconde os bones" — e sim **"os elementos de bone estão, na hierarquia do
SVG, dentro do grupo com `id="Bones_Left_Arm"` (etc.) exatamente?"**. Peça
para a IA do animador confirmar isso abrindo o XML e checando o pai direto
de cada osso.

---

## Regra 2 — Mão duplicada

**O que o motor faz:** duas camadas independentes de proteção:
1. `initDefaultVisibility()` oculta **todo** elemento cujo `id` comece com
   `Mão_` ou `Mao_` (`[id^="Mão_"]`) assim que o rig monta — isso cobre
   `Mão_Ukulele`, `Mão_tchau`, `Mão_fechada` etc. automaticamente, sem lista
   manual.
2. Cada modo (Música, Tchau) troca explicitamente `handGroup.style.display`
   ↔ `ukeleGroup.style.display` / `tchauGroup.style.display` a cada frame,
   nunca deixando os dois visíveis ao mesmo tempo.

**Diagnóstico revisado:** se apareceu uma mão a mais, o nome da variante
**não bate com o prefixo esperado** (`Mão_` ou `Mao_`, com esse acento/hífen
exatos) — então ela nunca entra no auto-hide, fica sempre visível, e quando o
modo Música ativa a variante certa, sobram duas mãos. Confirme com a IA do
animador o **nome exato** de cada variante nova antes de aceitar o export.

---

## Regra 3 — Mosca visível ao abrir

**O que o motor faz:** `initDefaultVisibility()` seta
`rig.extras.mosca.setAttribute("display", "none")` no boot, sempre — não
depende do que o SVG trouxe.

**Diagnóstico revisado:** se a mosca aparece ao abrir, o mais provável é que
o elemento com `id="Mosca"` **não existe** no export recebido (o motor tem
um fallback: `getNodeById("Mosca") ?? getNodeById("Corpo_mosca")?.parentElement`
— se nem o fallback casar, `rig.extras.mosca` fica `null`, o `setAttribute`
não roda, e **qualquer visibilidade que o SVG cru trouxer prevalece**). Vale
pedir para a IA do animador confirmar que o grupo pai de `Corpo_mosca` tem
`id="Mosca"` (não só o corpo, o grupo).

---

## Regra 4 — Kevin fora do chão (cenário quarto)

**Este é o único bug que o motor genuinamente não protege sozinho** — e o
diagnóstico do documento está certo. O posicionamento é puramente CSS:

```css
.kevin-puppet-mount { align-items: end; padding-bottom: 3%; }
```

O Kevin é sempre ancorado na base do container, então "onde ele pisa"
depende 100% de onde o chão está desenhado dentro da imagem de fundo — o
motor não tem noção de "chão" no cenário, só alinha a base do SVG à base do
elemento. A correção do documento (chão no terço inferior, mesma resolução
em todos os fundos) é a solução certa; não tem nada a ajustar no motor aqui.

**Nota à parte, já corrigida nesta sessão:** havia uma escala/posição "base"
do próprio Kevin (`PUPPET_BASE_ZOOM = 86%`, `PUPPET_BASE_OFFSET_Y = -46px`)
que existia no app de testes mas nunca tinha sido portada para o
`export/kevin-puppet.js` — o Kevin exportado ficava no tamanho/posição
"crua" (100%, sem offset), diferente do que o app de testes mostra. Isso já
foi corrigido no motor; não é a causa do bug do quarto, mas explica por que
o Kevin podia parecer "no lugar errado" mesmo em cenários sem problema de
chão.

---

## Regra 5 — Peso do arquivo

Sem contrapartida no motor — é puramente configuração de exportação do
Illustrator/otimizador. A orientação do documento (2 casas decimais,
desmarcar "Preserve Illustrator Editing Capabilities", Presentation
Attributes) está alinhada com o que o motor espera (ele lê `d` e `transform`
diretamente, não depende de metadados de edição do Illustrator).

---

## Regra 6 — IDs não podem mudar

Confirmado, sem ressalva — é a regra mais importante de todas. Todo o motor
localiza elementos por `getNodeById`/`getFirstExistingNode`/
`getFirstExistingBoneNode`, nunca por classe CSS ou posição no DOM. A lista
de IDs da Parte 2 do `animador.md` está consistente com o que o
`kevin-puppet.js` atual (`export/`) realmente procura — validei cruzando com
o código, não só com a documentação.

**Um ajuste a registrar:** até esta sessão, uma função interna do motor
(`getFirstExistingBoneNode`) ainda filtrava por classe CSS (`.st11`) como
resquício de uma versão anterior — o que é exatamente o tipo de fragilidade
que a Regra 6 adverte. Isso foi corrigido (motor agora identifica bones só
por `id`, igual ao resto), então o motor está mais alinhado com a própria
Regra 6 do que estava antes.

---

## Perguntas do questionário (Parte 3) — quais valem mais a pena insistir

Com o que o motor já neutraliza, as perguntas com maior chance de achar a
causa raiz real são:

- **#5/#6 (bones):** reformular para "os bones ficam, na árvore do SVG,
  dentro do grupo `id=Bones_*` correto?" — não "como você esconde".
- **#7 (variantes de mão):** confirmar o **nome exato** (`Mão_` com esse
  acento, maiúscula, underline) de cada variante nova gerada.
- **#8 (mosca):** confirmar que o grupo pai de `Corpo_mosca` tem
  literalmente `id="Mosca"`.
- **#9 (SVGO/otimizador):** continua crítica — qualquer otimizador com
  `cleanupIds` ligado quebra tudo, independente das outras regras.
- **#10 (chão dos cenários):** é a única pergunta puramente de arte, sem
  contrapartida no código — mantém como está no documento.

As perguntas #1–#4 (processo de geração) são úteis para entender o fluxo do
animador, mas não vão revelar a causa dos bugs relatados — esses três bugs
(bones, mão duplicada, mosca) têm causa técnica localizável nos itens acima,
não no processo geral.
