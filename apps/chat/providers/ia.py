import json

import anthropic
import openai

from .base import BaseIAProvider

# ── Ferramentas (tool calling) ──────────────────────────────────────────────
#
# A descrição de cada ferramenta vive UMA vez em apps/chat/ferramentas.py (D38,
# generalizada na D51); cada provider só traduz para o formato da sua API. Sem
# lista explícita, vale a do modo aula — só `celebrar_acerto`, como sempre foi.

# Teto de rodadas de tool calling por resposta: protege contra laço e contra
# latência (o professor espera na frente da turma).
MAX_RODADAS = 3


def _ferramentas_padrao():
    from apps.chat.ferramentas import ferramentas_do_modo
    return ferramentas_do_modo('aula')


def _executar(conversa, nome, entrada):
    from apps.chat.ferramentas import executar
    return executar(conversa, nome, entrada)


def _acumular(acoes, resultados):
    """Junta as ações da rodada, sem repetir (a IA pode chamar duas vezes)."""
    for r in resultados:
        if r.acao and r.acao not in acoes:
            acoes.append(r.acao)


def _precisa_rodar_de_novo(texto, resultados):
    """Sem texto ainda, ou alguma ferramenta devolveu algo que a IA precisa ler
    antes de falar (regras do jogo, música não encontrada)."""
    return not texto or any(r.precisa_continuar for r in resultados)


class AnthropicProvider(BaseIAProvider):
    def chat(self, system_prompt: str, mensagens: list[dict],
             ferramentas=None, conversa=None) -> tuple[str, list[dict]]:
        ferramentas = _ferramentas_padrao() if ferramentas is None else ferramentas
        client = anthropic.Anthropic(api_key=self.api_key)
        tools = [
            {'name': f.nome, 'description': f.descricao, 'input_schema': f.parametros}
            for f in ferramentas
        ]
        extra = {'tools': tools} if tools else {}

        historico = list(mensagens)
        textos, acoes = [], []
        for _ in range(MAX_RODADAS):
            response = client.messages.create(
                model=self.modelo,
                max_tokens=1024,
                system=system_prompt,
                messages=historico,
                **extra,
            )
            texto = self._extrair_texto(response.content)
            if texto:
                textos.append(texto)
            chamadas = [
                (b.id, b.name, getattr(b, 'input', None) or {})
                for b in response.content if b.type == 'tool_use'
            ]
            if not chamadas:
                break
            resultados = [_executar(conversa, nome, entrada) for _, nome, entrada in chamadas]
            _acumular(acoes, resultados)
            if not _precisa_rodar_de_novo(texto, resultados):
                break
            # Toda tool_use da rodada precisa do seu tool_result. Lista nova a
            # cada rodada (sem mutar a anterior).
            historico = historico + [
                {'role': 'assistant', 'content': response.content},
                {'role': 'user', 'content': [
                    {'type': 'tool_result', 'tool_use_id': id_, 'content': r.texto_para_ia}
                    for (id_, _, _), r in zip(chamadas, resultados)
                ]},
            ]

        return ' '.join(textos).strip(), acoes

    @staticmethod
    def _extrair_texto(blocks) -> str:
        return ''.join(b.text for b in blocks if b.type == 'text').strip()


class OpenAIProvider(BaseIAProvider):
    def chat(self, system_prompt: str, mensagens: list[dict],
             ferramentas=None, conversa=None) -> tuple[str, list[dict]]:
        ferramentas = _ferramentas_padrao() if ferramentas is None else ferramentas
        client = openai.OpenAI(api_key=self.api_key)
        tools = [
            {'type': 'function', 'function': {
                'name': f.nome, 'description': f.descricao, 'parameters': f.parametros,
            }}
            for f in ferramentas
        ]

        # reasoning_effort só vai quando configurado no Plano: modelos sem
        # suporte (ex: gpt-4o) recusam o parâmetro, então enviar sempre
        # quebraria quem não migrou. Ver D39.
        extra = {'reasoning_effort': self.effort} if self.effort else {}
        if tools:
            extra['tools'] = tools

        historico = [{'role': 'system', 'content': system_prompt}, *mensagens]
        textos, acoes = [], []
        for _ in range(MAX_RODADAS):
            response = client.chat.completions.create(
                model=self.modelo,
                messages=historico,
                **extra,
            )
            message = response.choices[0].message
            texto = (message.content or '').strip()
            if texto:
                textos.append(texto)
            tool_calls = message.tool_calls or []
            if not tool_calls:
                break
            chamadas = [
                (tc.id, tc.function.name, getattr(tc.function, 'arguments', None) or '{}')
                for tc in tool_calls
            ]
            resultados = [
                _executar(conversa, nome, self._ler_argumentos(argumentos))
                for _, nome, argumentos in chamadas
            ]
            _acumular(acoes, resultados)
            if not _precisa_rodar_de_novo(texto, resultados):
                break
            historico = historico + [
                {
                    'role': 'assistant',
                    'content': message.content,
                    'tool_calls': [
                        {'id': id_, 'type': 'function',
                         'function': {'name': nome, 'arguments': argumentos}}
                        for id_, nome, argumentos in chamadas
                    ],
                },
                *[
                    {'role': 'tool', 'tool_call_id': id_, 'content': r.texto_para_ia}
                    for (id_, _, _), r in zip(chamadas, resultados)
                ],
            ]

        return ' '.join(textos).strip(), acoes

    @staticmethod
    def _ler_argumentos(argumentos) -> dict:
        """`function.arguments` chega como string JSON (às vezes malformada)."""
        try:
            valor = json.loads(argumentos or '{}')
        except (TypeError, ValueError):
            return {}
        return valor if isinstance(valor, dict) else {}


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
