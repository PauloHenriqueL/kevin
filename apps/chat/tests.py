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


# ── Playground (Demanda 20) ──────────────────────────────────────────────────

import json as _json  # noqa: E402

from django.test import Client  # noqa: E402

from apps.accounts.models import User  # noqa: E402
from apps.chat import ferramentas  # noqa: E402
from apps.chat.models import Conversa, Mensagem  # noqa: E402
from apps.chat.prompts import (  # noqa: E402
    PLAYGROUND_ABERTURA_PADRAO, PLAYGROUND_PAPEL_PADRAO, montar_prompt_playground,
)
from apps.chat.tasks import _montar_contexto, _montar_historico  # noqa: E402
from apps.curriculo.models import TG, Atividade, Aula  # noqa: E402
from apps.escolas.models import Escola, Plano, Professor, Serie, Turma  # noqa: E402


class BasePlayground(TestCase):
    """Duas escolas; a professora Maria (escola A) com uma turma Y5 ligada a um TG."""

    def setUp(self):
        plano = Plano.objects.create(nome='P', valor_mensal=1)
        self.escola_a = Escola.objects.create(nome='A', slug='a', plano=plano)
        self.escola_b = Escola.objects.create(nome='B', slug='b', plano=plano)
        self.tg = TG.objects.create(nome='TG 3x Y5', year=5, frequencia=3)
        serie = Serie.objects.create(escola=self.escola_a, nome='Fund', year=5, tg=self.tg)

        self.user = User.objects.create_user('maria', password='x', role='professor')
        self.prof = Professor.objects.create(user=self.user, escola=self.escola_a)
        self.turma = Turma.objects.create(
            year=5, nome='A', escola=self.escola_a, serie=serie,
            professor=self.prof, qtd_alunos=20,
        )
        self.conversa = Conversa.objects.create(
            professor=self.prof, turma=self.turma, modo=Conversa.Modo.PLAYGROUND,
            estado={'cenario': 'floresta', 'quadro': '', 'whisper': False,
                    'so_ingles': False, 'jogo_id': None},
        )
        self.client = Client()
        self.client.login(username='maria', password='x')

    def _msg(self, role='user', tipo='texto', conteudo='oi', conversa=None):
        return Mensagem.objects.create(
            conversa=conversa or self.conversa, role=role, tipo=tipo, conteudo=conteudo,
        )


class PromptEpicoATest(TestCase):
    """Épico A (D55–D57): português com o professor, sequência didática com a turma."""

    def test_prompts_padrao_sem_instant_translation_e_com_a_sequencia(self):
        from apps.chat.prompts import montar_prompt
        for prompt in (montar_prompt(), montar_prompt_playground()):
            self.assertNotIn('Instant Translation', prompt)
            self.assertNotIn('Teacher', prompt)
            self.assertIn('SEQUÊNCIA PARA ENSINAR UM TERMO', prompt)
            self.assertIn('PROFESSOR REGENTE', prompt)


class PromptPlaygroundTest(BasePlayground):
    def test_tg_sem_customizacao_usa_os_defaults(self):
        self.assertEqual(self.tg.get_system_prompt_playground(), montar_prompt_playground())
        self.assertEqual(self.tg.get_abertura_playground(), PLAYGROUND_ABERTURA_PADRAO)

    def test_campo_preenchido_sobrescreve_so_aquele_bloco(self):
        self.tg.playground_papel = 'Você é o Kevin do teste.'
        self.tg.playground_abertura = 'Hi, teste!'
        self.tg.save()
        prompt = self.tg.get_system_prompt_playground()
        self.assertTrue(prompt.startswith('Você é o Kevin do teste.'))
        self.assertNotIn(PLAYGROUND_PAPEL_PADRAO, prompt)
        self.assertEqual(self.tg.get_abertura_playground(), 'Hi, teste!')

    def test_turma_sem_tg_cai_no_default(self):
        turma = Turma.objects.create(year=5, nome='B', escola=self.escola_a, professor=self.prof)
        conversa = Conversa.objects.create(
            professor=self.prof, turma=turma, modo=Conversa.Modo.PLAYGROUND)
        self.assertIn(PLAYGROUND_PAPEL_PADRAO, _montar_contexto(conversa))


class ContextoSessaoTest(BasePlayground):
    def test_primeira_fala_do_teacher_vira_contexto(self):
        self.assertTrue(self.conversa.registrar_contexto(self._msg(conteudo='Animals: cow, pig')))
        self.assertEqual(self.conversa.contexto, 'Animals: cow, pig')

    def test_segunda_fala_nao_sobrescreve(self):
        self.conversa.registrar_contexto(self._msg(conteudo='Animals'))
        self.assertFalse(self.conversa.registrar_contexto(self._msg(conteudo='outra coisa')))
        self.conversa.refresh_from_db()
        self.assertEqual(self.conversa.contexto, 'Animals')

    def test_evento_nao_conta(self):
        self.assertFalse(self.conversa.registrar_contexto(
            self._msg(tipo='evento', conteudo='A música terminou.')))
        self.assertEqual(self.conversa.contexto, '')

    def test_conversa_de_aula_nunca_grava_contexto(self):
        aula = Conversa.objects.create(professor=self.prof)
        msg = self._msg(conversa=aula, conteudo='Animals')
        self.assertFalse(aula.registrar_contexto(msg))
        self.assertEqual(aula.contexto, '')

    @patch('apps.chat.views.responder_ia_sync')
    def test_view_sincrona_grava_o_contexto(self, responder):
        responder.side_effect = lambda conversa_id: Mensagem.objects.create(
            conversa_id=conversa_id, role='assistant', conteudo='Great!',
            acoes=[{'tipo': 'quadro', 'texto': 'cow'}])
        r = self.client.post(
            f'/api/chat/conversas/{self.conversa.id}/mensagem/?sync=1',
            data=_json.dumps({'conteudo': 'Farm animals', 'tipo': 'texto'}),
            content_type='application/json',
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()['resposta']['acoes'], [{'tipo': 'quadro', 'texto': 'cow'}])
        self.conversa.refresh_from_db()
        self.assertEqual(self.conversa.contexto, 'Farm animals')

    @patch('apps.chat.views.responder_ia_sync')
    def test_evento_e_aceito_na_conversa_de_aula_sem_gravar_contexto(self, responder):
        # Épico A (D60): botões da aula também viram evento para a IA.
        responder.side_effect = lambda conversa_id: Mensagem.objects.create(
            conversa_id=conversa_id, role='assistant', conteudo='Eyes on me!')
        aula = Conversa.objects.create(professor=self.prof)
        r = self.client.post(
            f'/api/chat/conversas/{aula.id}/mensagem/?sync=1',
            data=_json.dumps({'conteudo': 'O professor apertou Atenção.', 'tipo': 'evento'}),
            content_type='application/json',
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(aula.mensagens.filter(tipo='evento').count(), 1)
        aula.refresh_from_db()
        self.assertEqual(aula.contexto, '')


class MontagemContextoPlaygroundTest(BasePlayground):
    def setUp(self):
        super().setUp()
        Atividade.objects.create(tipo='recurso', nome='Hello Song', tags='musica',
                                 arquivo_url='https://x/hello.mp3')
        Atividade.objects.create(tipo='recurso', nome='Goodbye Song', tags='musica')  # sem faixa
        self.jogo = Atividade.objects.create(
            tipo='jogo', nome='Simon Says', como_conduzir='Dê comandos com "Simon says".')
        Atividade.objects.create(tipo='jogo', nome='Jogo da B', escola=self.escola_b)

    def test_secoes_saem_do_estavel_ao_volatil(self):
        self.conversa.contexto = 'Animals'
        prompt = _montar_contexto(self.conversa)
        ordem = ['=== TURMA ===', '=== MÚSICAS DISPONÍVEIS ===', '=== JOGOS DISPONÍVEIS ===',
                 '=== CONTEXTO DA AULA DE HOJE ===', '=== ESTADO DA SALA AGORA ===']
        posicoes = [prompt.index(secao) for secao in ordem]
        self.assertEqual(posicoes, sorted(posicoes))
        self.assertTrue(prompt.startswith(self.tg.get_system_prompt_playground()))

    def test_catalogo_so_com_faixa_e_sem_atividade_de_outra_escola(self):
        prompt = _montar_contexto(self.conversa)
        self.assertIn('Hello Song', prompt)
        self.assertNotIn('Goodbye Song', prompt)
        self.assertIn('Simon Says', prompt)
        self.assertNotIn('Jogo da B', prompt)

    def test_sem_contexto_pede_o_tema(self):
        from apps.chat.tasks import SEM_CONTEXTO_AINDA
        self.assertIn(SEM_CONTEXTO_AINDA, _montar_contexto(self.conversa))

    def test_aula_tem_catalogo_e_estado_depois_do_roteiro(self):
        # Épico A (D60): a aula também vê MÚSICAS, JOGOS e ESTADO DA SALA.
        aula_obj = Aula.objects.create(tg=self.tg, unit='U1', semana=1, numero_aula=1,
                                       titulo='Daily', background='quarto')
        conversa = Conversa.objects.create(
            professor=self.prof, aula=aula_obj,
            estado={'cenario': 'quarto', 'quadro': 'cow', 'whisper': False,
                    'so_ingles': False, 'jogo_id': None})
        prompt = _montar_contexto(conversa)
        ordem = ['--- CONTEXTO DA AULA ---', '=== MÚSICAS DISPONÍVEIS ===',
                 '=== JOGOS DISPONÍVEIS ===', '=== ESTADO DA SALA AGORA ===']
        posicoes = [prompt.index(secao) for secao in ordem]
        self.assertEqual(posicoes, sorted(posicoes))
        self.assertIn('Hello Song', prompt)
        self.assertIn('Cenário: quarto', prompt)
        self.assertIn('Quadro: cow', prompt)
        self.assertNotIn('CONTEXTO DA AULA DE HOJE', prompt)

    def test_jogo_em_andamento_expande_as_regras_do_catalogo(self):
        self.conversa.estado['jogo_id'] = self.jogo.id
        self.assertIn('Dê comandos com "Simon says".', _montar_contexto(self.conversa))

    def test_historico_evento_vira_user_e_turnos_iguais_se_mesclam(self):
        self._msg(tipo='evento', conteudo='Sessão de Playground iniciada.')
        self._msg(role='assistant', conteudo='Hello!')
        self._msg(conteudo='Animals')
        self._msg(conteudo='Animals de novo')   # a IA falhou na anterior
        historico = _montar_historico(self.conversa)
        self.assertEqual([m['role'] for m in historico], ['user', 'assistant', 'user'])
        self.assertEqual(historico[0]['content'], '[EVENTO] Sessão de Playground iniciada.')
        self.assertEqual(historico[2]['content'], 'Animals\n\nAnimals de novo')


class FerramentasPlaygroundTest(BasePlayground):
    def setUp(self):
        super().setUp()
        Atividade.objects.create(tipo='recurso', nome='Hello Song', tags='musica',
                                 arquivo_url='https://x/hello.mp3')
        Atividade.objects.create(tipo='jogo', nome='Simon Says', como_conduzir='Comandos.')
        Atividade.objects.create(tipo='jogo', nome='Quiz da A', escola=self.escola_a,
                                 como_conduzir='Perguntas.')
        Atividade.objects.create(tipo='jogo', nome='Quiz da B', escola=self.escola_b)

    def _executar(self, nome, entrada):
        return ferramentas.executar(self.conversa, nome, entrada)

    def test_aula_e_playground_tem_todas_as_ferramentas(self):
        # Épico A (D60): a aula ganhou os recursos do Playground.
        todas = [f.nome for f in ferramentas.REGISTRO]
        self.assertEqual([f.nome for f in ferramentas.ferramentas_do_modo('aula')], todas)
        self.assertEqual([f.nome for f in ferramentas.ferramentas_do_modo('playground')], todas)
        self.assertIn('everybody_whisper', todas)
        self.assertIn('pay_attention', todas)

    def test_musica_por_nome_exato_e_aproximado(self):
        for pedido in ('Hello Song', 'hello song!', 'Hello Songg', 'hello'):
            r = self._executar('tocar_musica', {'nome': pedido})
            self.assertEqual(r.acao, {'tipo': 'musica', 'nome': 'Hello Song',
                                      'url': 'https://x/hello.mp3'}, pedido)
            self.assertFalse(r.precisa_continuar)

    def test_musica_nao_encontrada_devolve_disponiveis(self):
        r = self._executar('tocar_musica', {'nome': 'Baby Shark'})
        self.assertIsNone(r.acao)
        self.assertTrue(r.precisa_continuar)
        self.assertIn('Hello Song', r.texto_para_ia)

    def test_musica_sem_nome_e_so_o_ukulele(self):
        r = self._executar('tocar_musica', {'nome': ''})
        self.assertEqual(r.acao, {'tipo': 'musica', 'nome': '', 'url': ''})

    def test_jogo_oficial_e_local_da_propria_escola(self):
        r = self._executar('iniciar_jogo', {'nome': 'simon says'})
        self.assertTrue(r.precisa_continuar)
        self.assertIn('Comandos.', r.texto_para_ia)
        self.assertIsNotNone(self.conversa.estado['jogo_id'])
        r = self._executar('iniciar_jogo', {'nome': 'Quiz da A'})
        self.assertIn('Perguntas.', r.texto_para_ia)

    def test_jogo_local_de_outra_escola_nunca(self):
        self._executar('encerrar_jogo', {})
        r = self._executar('iniciar_jogo', {'nome': 'Quiz da B'})
        self.assertNotIn('Quiz da B', r.texto_para_ia.split('Parecidos:')[-1])
        self.conversa.refresh_from_db()
        jogo_id = self.conversa.estado.get('jogo_id')
        if jogo_id:
            self.assertNotEqual(Atividade.objects.get(id=jogo_id).escola, self.escola_b)

    def test_cenario_invalido_rejeitado_e_valido_persistido(self):
        r = self._executar('trocar_cenario', {'cenario': 'marte'})
        self.assertIsNone(r.acao)
        r = self._executar('trocar_cenario', {'cenario': 'quarto'})
        self.assertEqual(r.acao, {'tipo': 'cenario', 'cenario': 'quarto'})
        self.conversa.refresh_from_db()
        self.assertEqual(self.conversa.estado['cenario'], 'quarto')
        # Repetir o mesmo cenário não gera ação (a IA às vezes repete a ferramenta).
        self.assertIsNone(self._executar('trocar_cenario', {'cenario': 'quarto'}).acao)

    def test_modos_persistem_e_nao_repetem(self):
        r = self._executar('everybody_whisper', {'ativo': True})
        self.assertEqual(r.acao, {'tipo': 'whisper', 'ativo': True})
        self.assertIsNone(self._executar('everybody_whisper', {'ativo': True}).acao)
        r = self._executar('no_portuguese_allowed', {'ativo': True})
        self.assertEqual(r.acao, {'tipo': 'so_ingles', 'ativo': True})
        self.conversa.refresh_from_db()
        self.assertTrue(self.conversa.estado['whisper'])
        self.assertTrue(self.conversa.estado['so_ingles'])

    def test_quadro_corta_em_40_caracteres(self):
        r = self._executar('mostrar_no_quadro', {'texto': 'x' * 60})
        self.assertEqual(len(r.acao['texto']), 40)

    def test_ferramenta_desconhecida_nao_quebra(self):
        r = self._executar('apagar_tudo', {})
        self.assertIsNone(r.acao)


def _bloco_tool(tool_id, nome, entrada):
    return SimpleNamespace(type='tool_use', id=tool_id, name=nome, input=entrada)


class ProvidersPlaygroundTest(BasePlayground):
    @patch('apps.chat.providers.ia.anthropic.Anthropic')
    def test_padrao_do_provider_oferece_todas_as_ferramentas(self, AnthropicMock):
        AnthropicMock.return_value.messages.create.return_value = _anthropic_response(
            [_bloco_texto('Hello!')])
        AnthropicProvider(api_key='f', modelo='m').chat('s', [{'role': 'user', 'content': 'oi'}])
        tools = AnthropicMock.return_value.messages.create.call_args.kwargs['tools']
        self.assertEqual([t['name'] for t in tools], [f.nome for f in ferramentas.REGISTRO])

    @patch('apps.chat.providers.ia.anthropic.Anthropic')
    def test_laco_para_em_3_rodadas(self, AnthropicMock):
        AnthropicMock.return_value.messages.create.side_effect = [
            _anthropic_response([_bloco_tool(f't{i}', 'mostrar_no_quadro', {'texto': f'w{i}'})])
            for i in range(10)
        ]
        texto, acoes = AnthropicProvider(api_key='f', modelo='m').chat(
            's', [{'role': 'user', 'content': 'oi'}],
            ferramentas=ferramentas.ferramentas_do_modo('playground'), conversa=self.conversa)
        self.assertEqual(AnthropicMock.return_value.messages.create.call_count, 3)
        self.assertEqual(texto, '')
        self.assertEqual(len(acoes), 3)

    @patch('apps.chat.providers.ia.anthropic.Anthropic')
    def test_jogo_pede_continuacao_e_textos_sao_concatenados(self, AnthropicMock):
        Atividade.objects.create(tipo='jogo', nome='Simon Says', como_conduzir='Comandos.')
        AnthropicMock.return_value.messages.create.side_effect = [
            _anthropic_response([_bloco_texto("Let's play!"),
                                 _bloco_tool('t1', 'iniciar_jogo', {'nome': 'Simon Says'})]),
            _anthropic_response([_bloco_texto('Simon says: touch your nose!')]),
        ]
        texto, acoes = AnthropicProvider(api_key='f', modelo='m').chat(
            's', [{'role': 'user', 'content': 'oi'}],
            ferramentas=ferramentas.ferramentas_do_modo('playground'), conversa=self.conversa)
        self.assertEqual(texto, "Let's play! Simon says: touch your nose!")
        self.assertEqual(acoes, [])
        segunda = AnthropicMock.return_value.messages.create.call_args_list[1].kwargs['messages']
        self.assertIn('Comandos.', segunda[-1]['content'][0]['content'])

    @patch('apps.chat.providers.ia.openai.OpenAI')
    def test_openai_le_argumentos_json(self, OpenAIMock):
        chamada = SimpleNamespace(id='c1', function=SimpleNamespace(
            name='mostrar_no_quadro', arguments='{"texto": "cow"}'))
        OpenAIMock.return_value.chat.completions.create.side_effect = [
            _openai_response('Look: cow!', tool_calls=[chamada]),
        ]
        texto, acoes = OpenAIProvider(api_key='f', modelo='m').chat(
            's', [{'role': 'user', 'content': 'oi'}],
            ferramentas=ferramentas.ferramentas_do_modo('playground'), conversa=self.conversa)
        self.assertEqual(texto, 'Look: cow!')
        self.assertEqual(acoes, [{'tipo': 'quadro', 'texto': 'cow'}])

    @patch('apps.chat.providers.get_ia_provider')
    def test_resposta_grava_acoes_e_celebrar(self, get_provider):
        from apps.chat.tasks import responder_ia_sync
        get_provider.return_value.chat.return_value = (
            'Very good!', [{'tipo': 'celebrar'}, {'tipo': 'quadro', 'texto': 'cow'}])
        msg = responder_ia_sync(self.conversa.id)
        self.assertTrue(msg.celebrar)
        self.assertEqual(msg.acoes[1], {'tipo': 'quadro', 'texto': 'cow'})
        nomes = [f.nome for f in get_provider.return_value.chat.call_args.kwargs['ferramentas']]
        self.assertIn('tocar_musica', nomes)

    @patch('apps.chat.providers.get_ia_provider')
    def test_conversa_de_aula_recebe_todas_as_ferramentas(self, get_provider):
        from apps.chat.tasks import responder_ia_sync
        aula = Conversa.objects.create(professor=self.prof)
        get_provider.return_value.chat.return_value = ('Hi!', [])
        msg = responder_ia_sync(aula.id)
        self.assertFalse(msg.celebrar)
        nomes = [f.nome for f in get_provider.return_value.chat.call_args.kwargs['ferramentas']]
        self.assertEqual(nomes, [f.nome for f in ferramentas.REGISTRO])


class TelasPlaygroundTest(BasePlayground):
    def test_lista_mostra_as_turmas_do_professor(self):
        r = self.client.get('/professor/playground/')
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, 'Turma 5A')

    def test_so_professor_acessa(self):
        User.objects.create_user('coord', password='x', role='coordenador')
        c = Client()
        c.login(username='coord', password='x')
        self.assertEqual(c.get('/professor/playground/').status_code, 403)

    def test_iniciar_cria_evento_e_abertura(self):
        r = self.client.post(f'/professor/playground/turma/{self.turma.id}/iniciar/')
        conversa = Conversa.objects.filter(modo='playground').latest('id')
        self.assertRedirects(r, f'/professor/playground/{conversa.id}/', fetch_redirect_response=False)
        msgs = list(conversa.mensagens.order_by('id'))
        self.assertEqual([(m.role, m.tipo) for m in msgs], [('user', 'evento'), ('assistant', 'texto')])
        self.assertEqual(msgs[1].conteudo, PLAYGROUND_ABERTURA_PADRAO)
        self.assertFalse(self.turma.aulas_turma.exists())   # não mexe em progresso

    def test_iniciar_turma_de_outro_professor_da_404(self):
        outro = Professor.objects.create(
            user=User.objects.create_user('joao', role='professor'), escola=self.escola_a)
        turma = Turma.objects.create(year=5, nome='Z', escola=self.escola_a, professor=outro)
        r = self.client.post(f'/professor/playground/turma/{turma.id}/iniciar/')
        self.assertEqual(r.status_code, 404)

    def test_sessao_renderiza_sem_o_evento(self):
        self._msg(tipo='evento', conteudo='Sessão de Playground iniciada.')
        self._msg(role='assistant', conteudo='Hello kids!')
        r = self.client.get(f'/professor/playground/{self.conversa.id}/')
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, 'Hello kids!')
        self.assertNotContains(r, 'Sessão de Playground iniciada.')
        self.assertContains(r, 'window.KEVIN_MODO = "playground"')
        # Falas gravadas do motor desligadas: o Kevin só fala pela ElevenLabs (D54).
        self.assertContains(r, 'window.KEVIN_RIG_CONFIG.celebrateVoiceUrl = null;')
        self.assertContains(r, 'window.KEVIN_RIG_CONFIG.voiceVolume = 0;')

    def test_sessao_de_outro_professor_da_404(self):
        outro = Professor.objects.create(
            user=User.objects.create_user('joao', role='professor'), escola=self.escola_a)
        conversa = Conversa.objects.create(professor=outro, turma=self.turma, modo='playground')
        self.assertEqual(self.client.get(f'/professor/playground/{conversa.id}/').status_code, 404)

    def test_patch_estado(self):
        r = self.client.patch(
            f'/api/chat/conversas/{self.conversa.id}/estado/',
            data=_json.dumps({'whisper': True}), content_type='application/json')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()['whisper'])
        self.conversa.refresh_from_db()
        self.assertTrue(self.conversa.estado['whisper'])
        self.assertEqual(self.conversa.estado['cenario'], 'floresta')   # o resto fica

    def test_patch_estado_na_aula_so_do_proprio_professor(self):
        aula = Conversa.objects.create(professor=self.prof)
        r = self.client.patch(
            f'/api/chat/conversas/{aula.id}/estado/',
            data=_json.dumps({'whisper': True}), content_type='application/json')
        self.assertEqual(r.status_code, 200)
        aula.refresh_from_db()
        self.assertTrue(aula.estado['whisper'])
        outro = Professor.objects.create(
            user=User.objects.create_user('joao', role='professor'), escola=self.escola_a)
        de_outro = Conversa.objects.create(professor=outro)
        r = self.client.patch(
            f'/api/chat/conversas/{de_outro.id}/estado/',
            data=_json.dumps({'whisper': True}), content_type='application/json')
        self.assertEqual(r.status_code, 404)

    def test_aula_continua_abrindo_igual(self):
        aula = Aula.objects.create(tg=self.tg, unit='U1', semana=1, numero_aula=1, titulo='Daily')
        r = self.client.get(f'/professor/turma/{self.turma.id}/aula/{aula.codigo}/')
        self.assertEqual(r.status_code, 200)
        self.assertNotContains(r, 'KEVIN_MODO')
        self.assertContains(r, 'window.KEVIN_RIG_CONFIG')

    def test_aula_nasce_com_estado_no_cenario_dela(self):
        # Épico A (D61): o estado da sala da aula começa no Aula.background.
        aula = Aula.objects.create(tg=self.tg, unit='U1', semana=1, numero_aula=2,
                                   titulo='Bedroom', background='quarto')
        self.client.get(f'/professor/turma/{self.turma.id}/aula/{aula.codigo}/')
        conversa = Conversa.objects.get(professor=self.prof, aula=aula)
        self.assertEqual(conversa.estado['cenario'], 'quarto')
        self.assertFalse(conversa.estado['whisper'])
        # Conversa antiga (estado vazio) ganha as chaves ao reabrir.
        conversa.estado = {}
        conversa.save()
        self.client.get(f'/professor/turma/{self.turma.id}/aula/{aula.codigo}/')
        conversa.refresh_from_db()
        self.assertEqual(conversa.estado['cenario'], 'quarto')


class TTSWhisperTest(TestCase):
    @patch('apps.chat.providers.tts.httpx.post')
    def test_sussurro_usa_v3_com_a_tag(self, post):
        from apps.chat.providers.tts import ElevenLabsTTSProvider
        post.return_value = MagicMock(content=b'mp3')
        ElevenLabsTTSProvider(api_key='k', voice_id='v').sintetizar('Hello kids', estilo='sussurro')
        corpo = post.call_args.kwargs['json']
        self.assertEqual(corpo['model_id'], 'eleven_v3')
        self.assertEqual(corpo['text'], '[whispers] Hello kids')

    @patch('apps.chat.providers.tts.httpx.post')
    def test_normal_segue_igual(self, post):
        from apps.chat.providers.tts import ELEVENLABS_DEFAULT_MODEL, ElevenLabsTTSProvider
        post.return_value = MagicMock(content=b'mp3')
        ElevenLabsTTSProvider(api_key='k', voice_id='v').sintetizar('Hello kids')
        corpo = post.call_args.kwargs['json']
        self.assertEqual(corpo['model_id'], ELEVENLABS_DEFAULT_MODEL)
        self.assertEqual(corpo['text'], 'Hello kids')

    def test_limpar_para_fala(self):
        from apps.chat.providers.tts import limpar_para_fala
        self.assertEqual(limpar_para_fala('*Great* job! 🎉 [laughs] Repeat: dog'),
                         'Great job! Repeat: dog')
