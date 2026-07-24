"""Testes do currículo — modelo novo (Demandas 1, 3, 11, 12).

Roda com: docker compose exec web python manage.py test apps.curriculo
"""
from django.test import TestCase

from apps.accounts.models import User
from apps.escolas.models import Escola, Plano, Professor, Turma

from .models import Atividade, Aula, AulaTurma, BlocoAula, montar_codigo_aula


class CodigoAulaTest(TestCase):
    """O código da aula segue o formato do TG (Y5-U1W1C1) — chave é a Unit (D27)."""

    def test_montar_codigo(self):
        self.assertEqual(montar_codigo_aula(5, 'U1', 1, 1), 'Y5-U1W1C1')
        self.assertEqual(montar_codigo_aula(1, 'WU', 5, 3), 'Y1-WUW5C3')
        # A sigla é normalizada para maiúscula.
        self.assertEqual(montar_codigo_aula(5, 'ju', 2, 3), 'Y5-JUW2C3')

    def test_codigo_gerado_no_save(self):
        aula = Aula.objects.create(year=5, unit='U2', semana=2, numero_aula=1, titulo='X')
        self.assertEqual(aula.codigo, 'Y5-U2W2C1')

    def test_ordem_unit_calculada_no_save(self):
        """A Welcome Unit abre o ano; a June fecha; U3 fica no meio."""
        wu = Aula.objects.create(year=5, unit='WU', semana=1, numero_aula=1, titulo='W')
        u3 = Aula.objects.create(year=5, unit='U3', semana=1, numero_aula=1, titulo='C')
        ju = Aula.objects.create(year=5, unit='JU', semana=1, numero_aula=1, titulo='J')
        self.assertEqual((wu.ordem_unit, u3.ordem_unit, ju.ordem_unit), (0, 3, 9))
        # O ordering do queryset segue a ordem do ano letivo.
        self.assertEqual(
            [a.unit for a in Aula.objects.all()], ['WU', 'U3', 'JU']
        )

    def test_unicidade_por_endereco(self):
        Aula.objects.create(year=5, unit='U1', semana=1, numero_aula=1, titulo='A')
        with self.assertRaises(Exception):
            Aula.objects.create(year=5, unit='U1', semana=1, numero_aula=1, titulo='B')


class AtividadeTest(TestCase):
    """Catálogo unificado + isolamento por escola (D5, D6)."""

    def setUp(self):
        plano = Plano.objects.create(nome='P', valor_mensal=1)
        self.escola_a = Escola.objects.create(nome='A', slug='a', plano=plano)
        self.escola_b = Escola.objects.create(nome='B', slug='b', plano=plano)

    def test_atividade_oficial_sem_escola(self):
        a = Atividade.objects.create(tipo='jogo', nome='Simon Says')
        self.assertTrue(a.eh_oficial)

    def test_atividade_local_com_escola(self):
        a = Atividade.objects.create(tipo='jogo', nome='Quiz', escola=self.escola_a)
        self.assertFalse(a.eh_oficial)

    def test_recurso_exige_url(self):
        from django.core.exceptions import ValidationError
        a = Atividade(tipo='recurso', nome='Livro')
        with self.assertRaises(ValidationError):
            a.clean()


class ContextoKevinTest(TestCase):
    """O contexto enviado ao Kevin expande as atividades da aula (D3)."""

    def setUp(self):
        self.aula = Aula.objects.create(year=5, mes=3, semana=1, numero_aula=1,
                                        titulo='Daily Routines', tipo='content')
        self.jogo = Atividade.objects.create(
            tipo='jogo', nome='Simon Says',
            como_conduzir='Dê comandos com "Simon says".',
            objetivo_pedagogico='Escuta',
        )

    def test_contexto_inclui_como_conduzir(self):
        BlocoAula.objects.create(aula=self.aula, fase='warm_up', ordem=1, atividade=self.jogo)
        ctx = self.aula.get_contexto_completo()
        self.assertIn('Simon Says', ctx)
        self.assertIn('Simon says', ctx)  # o como_conduzir
        self.assertIn('Y5-U1W1C1', ctx)

    def test_kickoff_por_tipo(self):
        self.assertIn('começar', self.aula.get_kickoff().lower())

    def test_kickoff_customizado_tem_prioridade(self):
        self.aula.kickoff = 'Olá turma!'
        self.aula.save()
        self.assertEqual(self.aula.get_kickoff(), 'Olá turma!')

    def test_tem_musica(self):
        self.assertFalse(self.aula.tem_musica)
        song = Atividade.objects.create(tipo='rotina', nome='Songs Collection', tags='musica')
        BlocoAula.objects.create(aula=self.aula, fase='warm_up', ordem=1, atividade=song)
        self.assertTrue(self.aula.tem_musica)


class BlocoAulaTest(TestCase):
    """Bloco precisa de atividade OU título (D4)."""

    def setUp(self):
        self.aula = Aula.objects.create(year=5, mes=3, semana=1, numero_aula=1, titulo='X')

    def test_bloco_sem_atividade_nem_titulo_invalido(self):
        from django.core.exceptions import ValidationError
        b = BlocoAula(aula=self.aula, fase='warm_up', ordem=1)
        with self.assertRaises(ValidationError):
            b.clean()

    def test_bloco_com_titulo_valido(self):
        b = BlocoAula(aula=self.aula, fase='warm_up', ordem=1, titulo='Hello Song')
        b.clean()  # não levanta


class FrequenciaTest(TestCase):
    """Turma vê só aulas da sua frequência ou menor (D19)."""

    def setUp(self):
        plano = Plano.objects.create(nome='P', valor_mensal=1)
        self.escola = Escola.objects.create(nome='E', slug='e', plano=plano)
        for i in range(1, 4):
            Aula.objects.create(year=5, mes=3, semana=1, numero_aula=i,
                                titulo=f'A{i}', frequencia_minima=3)
        Aula.objects.create(year=5, mes=3, semana=2, numero_aula=4,
                            titulo='Extra', frequencia_minima=4)

    def test_turma_3x_nao_ve_extra(self):
        t = Turma.objects.create(year=5, nome='A', escola=self.escola, aulas_por_semana=3)
        self.assertEqual(t.aulas_do_curriculo().count(), 3)

    def test_turma_4x_ve_extra(self):
        t = Turma.objects.create(year=5, nome='B', escola=self.escola, aulas_por_semana=4)
        self.assertEqual(t.aulas_do_curriculo().count(), 4)


class AulaTurmaTest(TestCase):
    """Execução por turma: data e professor no concluir (D22)."""

    def setUp(self):
        plano = Plano.objects.create(nome='P', valor_mensal=1)
        self.escola = Escola.objects.create(nome='E', slug='e', plano=plano)
        u = User.objects.create_user('prof', role='professor')
        self.prof = Professor.objects.create(user=u, escola=self.escola)
        self.turma = Turma.objects.create(year=5, nome='A', escola=self.escola)
        self.aula = Aula.objects.create(year=5, mes=3, semana=1, numero_aula=1, titulo='X')

    def test_conclui_grava_presenca(self):
        at = AulaTurma.objects.create(
            turma=self.turma, aula=self.aula, status='concluida',
            professor=self.prof, presentes=18)
        self.assertEqual(at.presentes, 18)
        self.assertEqual(at.status, 'concluida')

    def test_unicidade_turma_aula(self):
        AulaTurma.objects.create(turma=self.turma, aula=self.aula)
        with self.assertRaises(Exception):
            AulaTurma.objects.create(turma=self.turma, aula=self.aula)


class ImportadorCatalogoTest(TestCase):
    """Parsing do Games Bank do TG (D30).

    O parser é a única coisa entre o PDF do cliente e o `como_conduzir` que o
    Kevin usa em sala. Se ele engolir um jogo, o Kevin improvisa a regra.
    """

    def _parsear(self, texto):
        from .management.commands.importar_catalogo_tg import (
            parsear_jogos, recortar_banco_de_jogos,
        )
        return parsear_jogos(recortar_banco_de_jogos(texto))

    def test_parseia_jogo_simples(self):
        texto = (
            'GAMES FOR THE WHOLE YEAR\n'
            'A\n'
            '    ANSWER!\n'
            '    Have two students come to the front.\n'
            '\n'
            'WARM UP (10 minutes)\n'
        )
        jogos = self._parsear(texto)
        self.assertEqual(len(jogos), 1)
        self.assertEqual(jogos[0]['nome'], 'Answer!')

    def test_titulo_com_pontuacao_vira_jogo_proprio(self):
        """Regressão: "WHAT AM I?" era absorvido no corpo do jogo anterior."""
        texto = (
            'GAMES FOR THE WHOLE YEAR\n'
            '    UNSCRAMBLE\n'
            '    Give them cards with letters.\n'
            '    WHAT AM I?\n'
            '    Tape a card to each student back.\n'
            '    UP, UP; DOWN, DOWN\n'
            '    Say a sentence and they stand up.\n'
            'WARM UP\n'
        )
        nomes = [j['nome'] for j in self._parsear(texto)]
        self.assertEqual(nomes, ['Unscramble', 'What Am I?', 'Up, Up; Down, Down'])

    def test_ignora_rodape_e_divisoria_alfabetica(self):
        texto = (
            'GAMES FOR THE WHOLE YEAR\n'
            'B\n'
            '    BINGO\n'
            '    Call out a number.\n'
            '    Proibida a reprodução. Todos os direitos reservados Bebilíngue Ltda.\n'
            'WARM UP\n'
        )
        jogos = self._parsear(texto)
        self.assertEqual(len(jogos), 1)
        self.assertNotIn('Proibida', jogos[0]['linhas'][0])

    def test_captura_contexto_entre_parenteses(self):
        texto = (
            'GAMES FOR THE WHOLE YEAR\n'
            '    TONGUE TWISTER (Phonics)\n'
            '    Say it fast.\n'
            'WARM UP\n'
        )
        jogo = self._parsear(texto)[0]
        self.assertEqual(jogo['nome'], 'Tongue Twister')
        self.assertEqual(jogo['contexto'], 'Phonics')

    def test_capitalizacao_preserva_apostrofo_e_siglas(self):
        from .management.commands.importar_catalogo_tg import capitalizar_nome
        self.assertEqual(capitalizar_nome('DON’T SAY IT'), 'Don’t Say It')
        self.assertEqual(capitalizar_nome('YES/NO'), 'Yes/No')
        self.assertEqual(capitalizar_nome('TIC-TAC-TOE'), 'Tic-Tac-Toe')
        self.assertEqual(capitalizar_nome('Q&A LINES'), 'Q&A Lines')

    def test_secao_ausente_falha_com_mensagem_clara(self):
        from django.core.management.base import CommandError
        from .management.commands.importar_catalogo_tg import recortar_banco_de_jogos
        with self.assertRaises(CommandError):
            recortar_banco_de_jogos('um PDF qualquer sem banco de jogos')
