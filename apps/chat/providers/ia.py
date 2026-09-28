import anthropic
import openai

from .base import BaseIAProvider

# ── Tool "celebrar_acerto" ──────────────────────────────────────────────────
#
# Sinaliza pro frontend disparar o modo "celebrate" do Kevin (pulo + confete)
# quando o Teacher ou a turma acerta algo (D38, docs/demandas.md). Uma única
# descrição compartilhada pelos dois providers evita as duas cópias divergirem
# com o tempo — cada provider só traduz para o formato de tool da sua API.
CELEBRAR_TOOL_NOME = 'celebrar_acerto'
CELEBRAR_TOOL_DESCRICAO = (
    'Chame esta ferramenta quando o Teacher (ou a turma, no momento que ele '
    'abriu) acabou de acertar algo que você estava ensinando ou testando — '
    'uma resposta certa, um vocabulário lembrado corretamente, um jogo '
    'ganho. Chame JUNTO com sua resposta de texto normal, nunca no lugar '
    'dela — o Teacher precisa continuar ouvindo você falar. Não chame por '
    'elogios genéricos, cumprimentos, ou toda vez que alguém responde algo.'
)


class AnthropicProvider(BaseIAProvider):
    def chat(self, system_prompt: str, mensagens: list[dict]) -> tuple[str, bool]:
        client = anthropic.Anthropic(api_key=self.api_key)
        tools = [{
            'name': CELEBRAR_TOOL_NOME,
            'description': CELEBRAR_TOOL_DESCRICAO,
            'input_schema': {'type': 'object', 'properties': {}},
        }]

        conversa = list(mensagens)
        response = client.messages.create(
            model=self.modelo,
            max_tokens=1024,
            system=system_prompt,
            messages=conversa,
            tools=tools,
        )

        texto = self._extrair_texto(response.content)
        celebrar = self._chamou_celebrar(response.content)

        if celebrar and not texto:
            # O modelo só chamou a tool nesta rodada, sem texto — devolve um
            # resultado trivial (não há dado real a computar) e pede a
            # continuação, que é a fala de verdade que o Teacher precisa
            # ouvir. Sem isso, celebrar tocaria com uma mensagem vazia.
            tool_use = next(b for b in response.content if b.type == 'tool_use')
            conversa = conversa + [
                {'role': 'assistant', 'content': response.content},
                {'role': 'user', 'content': [{
                    'type': 'tool_result',
                    'tool_use_id': tool_use.id,
                    'content': 'ok',
                }]},
            ]
            followup = client.messages.create(
                model=self.modelo,
                max_tokens=1024,
                system=system_prompt,
                messages=conversa,
            )
            texto = self._extrair_texto(followup.content)

        return texto, celebrar

    @staticmethod
    def _extrair_texto(blocks) -> str:
        return ''.join(b.text for b in blocks if b.type == 'text').strip()

    @staticmethod
    def _chamou_celebrar(blocks) -> bool:
        return any(
            b.type == 'tool_use' and b.name == CELEBRAR_TOOL_NOME
            for b in blocks
        )


class OpenAIProvider(BaseIAProvider):
    def chat(self, system_prompt: str, mensagens: list[dict]) -> tuple[str, bool]:
        client = openai.OpenAI(api_key=self.api_key)
        tools = [{
            'type': 'function',
            'function': {
                'name': CELEBRAR_TOOL_NOME,
                'description': CELEBRAR_TOOL_DESCRICAO,
                'parameters': {'type': 'object', 'properties': {}},
            },
        }]

        conversa = [{'role': 'system', 'content': system_prompt}]
        conversa.extend(mensagens)

        # reasoning_effort só vai quando configurado no Plano: modelos sem
        # suporte (ex: gpt-4o) recusam o parâmetro, então enviar sempre
        # quebraria quem não migrou. Ver D39.
        extra = {'reasoning_effort': self.effort} if self.effort else {}

        response = client.chat.completions.create(
            model=self.modelo,
            messages=conversa,
            tools=tools,
            **extra,
        )
        message = response.choices[0].message
        texto = (message.content or '').strip()
        celebrar = self._chamou_celebrar(message)

        if celebrar and not texto:
            # Mesma lógica do Anthropic: sem texto na rodada da tool, pede a
            # continuação devolvendo um resultado trivial pra cada tool call.
            conversa = conversa + [message] + [
                {
                    'role': 'tool',
                    'tool_call_id': tc.id,
                    'content': 'ok',
                }
                for tc in message.tool_calls
            ]
            followup = client.chat.completions.create(
                model=self.modelo,
                messages=conversa,
                **extra,
            )
            texto = (followup.choices[0].message.content or '').strip()

        return texto, celebrar

    @staticmethod
    def _chamou_celebrar(message) -> bool:
        if not message.tool_calls:
            return False
        return any(tc.function.name == CELEBRAR_TOOL_NOME for tc in message.tool_calls)


PROVIDERS = {
    'anthropic': AnthropicProvider,
    'openai': OpenAIProvider,
}


def get_ia_provider(
    provider_name: str, api_key: str, modelo: str, effort: str = '',
) -> BaseIAProvider:
    provider_class = PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f'Provedor de IA desconhecido: {provider_name}')
    return provider_class(api_key=api_key, modelo=modelo, effort=effort)
