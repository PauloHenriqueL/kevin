from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import TestCase

from apps.chat.providers.ia import AnthropicProvider, OpenAIProvider


def _bloco_texto(texto):
    return SimpleNamespace(type='text', text=texto)


def _bloco_tool_use(tool_id='toolu_1', nome='celebrar_acerto'):
    return SimpleNamespace(type='tool_use', id=tool_id, name=nome)


def _anthropic_response(content):
    return SimpleNamespace(content=content)


class AnthropicProviderCelebrarTests(TestCase):
    """Tool-calling do celebrar_acerto (D38) — sem chave real, tudo mockado."""

    def _client_mock(self, respostas):
        """Cada chamada a messages.create() consome uma resposta da lista."""
        client = MagicMock()
        client.messages.create.side_effect = respostas
        return client

    @patch('apps.chat.providers.ia.anthropic.Anthropic')
    def test_resposta_sem_celebrar(self, AnthropicMock):
        AnthropicMock.return_value = self._client_mock([
            _anthropic_response([_bloco_texto('Hello Teacher!')]),
        ])
        provider = AnthropicProvider(api_key='fake', modelo='claude-fake')

        texto, celebrar = provider.chat('system', [{'role': 'user', 'content': 'oi'}])

        self.assertEqual(texto, 'Hello Teacher!')
        self.assertFalse(celebrar)
        AnthropicMock.return_value.messages.create.assert_called_once()

    @patch('apps.chat.providers.ia.anthropic.Anthropic')
    def test_celebrar_com_texto_na_mesma_rodada(self, AnthropicMock):
        AnthropicMock.return_value = self._client_mock([
            _anthropic_response([_bloco_texto('Very good!'), _bloco_tool_use()]),
        ])
        provider = AnthropicProvider(api_key='fake', modelo='claude-fake')

        texto, celebrar = provider.chat('system', [{'role': 'user', 'content': 'dog'}])

        self.assertEqual(texto, 'Very good!')
        self.assertTrue(celebrar)
        # Texto já veio na primeira rodada — não deve pedir continuação.
        AnthropicMock.return_value.messages.create.assert_called_once()

    @patch('apps.chat.providers.ia.anthropic.Anthropic')
    def test_celebrar_sem_texto_pede_continuacao(self, AnthropicMock):
        AnthropicMock.return_value = self._client_mock([
            _anthropic_response([_bloco_tool_use(tool_id='toolu_9')]),
            _anthropic_response([_bloco_texto('Very good, dog is right!')]),
        ])
        provider = AnthropicProvider(api_key='fake', modelo='claude-fake')

        texto, celebrar = provider.chat('system', [{'role': 'user', 'content': 'dog'}])

        self.assertEqual(texto, 'Very good, dog is right!')
        self.assertTrue(celebrar)
        self.assertEqual(AnthropicMock.return_value.messages.create.call_count, 2)
        # A segunda chamada precisa carregar o tool_result com o id certo.
        segunda_chamada = AnthropicMock.return_value.messages.create.call_args_list[1]
        mensagens_enviadas = segunda_chamada.kwargs['messages']
        tool_result = mensagens_enviadas[-1]['content'][0]
        self.assertEqual(tool_result['tool_use_id'], 'toolu_9')


def _openai_tool_call(call_id='call_1', nome='celebrar_acerto'):
    return SimpleNamespace(id=call_id, function=SimpleNamespace(name=nome))


def _openai_response(content, tool_calls=None):
    message = SimpleNamespace(content=content, tool_calls=tool_calls)
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class OpenAIProviderCelebrarTests(TestCase):
    def _client_mock(self, respostas):
        client = MagicMock()
        client.chat.completions.create.side_effect = respostas
        return client

    @patch('apps.chat.providers.ia.openai.OpenAI')
    def test_resposta_sem_celebrar(self, OpenAIMock):
        OpenAIMock.return_value = self._client_mock([
            _openai_response('Hello Teacher!'),
        ])
        provider = OpenAIProvider(api_key='fake', modelo='gpt-fake')

        texto, celebrar = provider.chat('system', [{'role': 'user', 'content': 'oi'}])

        self.assertEqual(texto, 'Hello Teacher!')
        self.assertFalse(celebrar)

    @patch('apps.chat.providers.ia.openai.OpenAI')
    def test_celebrar_com_texto_na_mesma_rodada(self, OpenAIMock):
        OpenAIMock.return_value = self._client_mock([
            _openai_response('Very good!', tool_calls=[_openai_tool_call()]),
        ])
        provider = OpenAIProvider(api_key='fake', modelo='gpt-fake')

        texto, celebrar = provider.chat('system', [{'role': 'user', 'content': 'dog'}])

        self.assertEqual(texto, 'Very good!')
        self.assertTrue(celebrar)
        OpenAIMock.return_value.chat.completions.create.assert_called_once()

    @patch('apps.chat.providers.ia.openai.OpenAI')
    def test_celebrar_sem_texto_pede_continuacao(self, OpenAIMock):
        OpenAIMock.return_value = self._client_mock([
            _openai_response(None, tool_calls=[_openai_tool_call(call_id='call_9')]),
            _openai_response('Very good, dog is right!'),
        ])
        provider = OpenAIProvider(api_key='fake', modelo='gpt-fake')

        texto, celebrar = provider.chat('system', [{'role': 'user', 'content': 'dog'}])

        self.assertEqual(texto, 'Very good, dog is right!')
        self.assertTrue(celebrar)
        self.assertEqual(OpenAIMock.return_value.chat.completions.create.call_count, 2)
        segunda_chamada = OpenAIMock.return_value.chat.completions.create.call_args_list[1]
        mensagens_enviadas = segunda_chamada.kwargs['messages']
        tool_result = mensagens_enviadas[-1]
        self.assertEqual(tool_result['tool_call_id'], 'call_9')


class IAEffortTests(TestCase):
    """Esforço de raciocínio por Plano (D39).

    O ponto delicado não é enviar o parâmetro — é NÃO enviar quando o Plano
    não define nenhum: modelos sem suporte (gpt-4o, por exemplo) recusam
    `reasoning_effort`, e mandar sempre quebraria quem ainda não migrou.
    """

    def _client_mock(self, respostas):
        client = MagicMock()
        client.chat.completions.create.side_effect = respostas
        return client

    @patch('apps.chat.providers.ia.openai.OpenAI')
    def test_effort_vai_na_chamada_quando_configurado(self, OpenAIMock):
        OpenAIMock.return_value = self._client_mock([_openai_response('Hi!')])
        provider = OpenAIProvider(api_key='fake', modelo='gpt-5.6-terra', effort='max')

        provider.chat('system', [{'role': 'user', 'content': 'oi'}])

        kwargs = OpenAIMock.return_value.chat.completions.create.call_args.kwargs
        self.assertEqual(kwargs['reasoning_effort'], 'max')
        self.assertEqual(kwargs['model'], 'gpt-5.6-terra')

    @patch('apps.chat.providers.ia.openai.OpenAI')
    def test_effort_vazio_nao_envia_o_parametro(self, OpenAIMock):
        OpenAIMock.return_value = self._client_mock([_openai_response('Hi!')])
        provider = OpenAIProvider(api_key='fake', modelo='gpt-4o', effort='')

        provider.chat('system', [{'role': 'user', 'content': 'oi'}])

        kwargs = OpenAIMock.return_value.chat.completions.create.call_args.kwargs
        self.assertNotIn('reasoning_effort', kwargs)

    @patch('apps.chat.providers.ia.openai.OpenAI')
    def test_effort_repetido_na_continuacao_do_celebrate(self, OpenAIMock):
        """A 2ª chamada (tool sem texto, D38) precisa do mesmo effort —
        senão a fala que o professor ouve sai de outra configuração."""
        OpenAIMock.return_value = self._client_mock([
            _openai_response(None, tool_calls=[_openai_tool_call()]),
            _openai_response('Very good!'),
        ])
        provider = OpenAIProvider(api_key='fake', modelo='gpt-5.6-terra', effort='high')

        provider.chat('system', [{'role': 'user', 'content': 'dog'}])

        chamadas = OpenAIMock.return_value.chat.completions.create.call_args_list
        self.assertEqual(len(chamadas), 2)
        self.assertEqual(chamadas[1].kwargs['reasoning_effort'], 'high')

    @patch('apps.chat.providers.ia.anthropic.Anthropic')
    def test_anthropic_ignora_o_effort(self, AnthropicMock):
        """O Anthropic não expõe esse controle: o campo existe no Plano, mas
        não pode vazar para a chamada — seria um parâmetro desconhecido."""
        client = MagicMock()
        client.messages.create.return_value = SimpleNamespace(
            content=[SimpleNamespace(type='text', text='Hello!')]
        )
        AnthropicMock.return_value = client
        provider = AnthropicProvider(api_key='fake', modelo='claude-fake', effort='max')

        texto, celebrar = provider.chat('system', [{'role': 'user', 'content': 'oi'}])

        self.assertEqual(texto, 'Hello!')
        self.assertNotIn('reasoning_effort', client.messages.create.call_args.kwargs)

    def test_factory_repassa_o_effort(self):
        from apps.chat.providers import get_ia_provider

        provider = get_ia_provider(
            provider_name='openai', api_key='fake',
            modelo='gpt-5.6-terra', effort='xhigh',
        )

        self.assertEqual(provider.effort, 'xhigh')

    def test_plano_nasce_com_medium(self):
        from apps.escolas.models import Plano

        plano = Plano.objects.create(nome='Teste', valor_mensal=1)

        self.assertEqual(plano.ia_effort, 'medium')
