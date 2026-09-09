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
