"""Testes do fluxo do professor e da gestão (Demandas 1, 6, 8, 11).

Roda com: docker compose exec web python manage.py test apps.escolas
"""
from django.test import Client, TestCase

from apps.accounts.models import User
from apps.curriculo.models import Atividade, Aula, AulaTurma, BlocoAula

from .models import Escola, Plano, Professor, Turma


class BaseProfessor(TestCase):
    """Cenário comum: 2 escolas, 1 professor na escola A, aulas do currículo."""

    def setUp(self):
        plano = Plano.objects.create(nome='P', valor_mensal=1)
        self.escola_a = Escola.objects.create(nome='A', slug='a', plano=plano)
        self.escola_b = Escola.objects.create(nome='B', slug='b', plano=plano)

        u = User.objects.create_user('maria', password='x', role='professor')
        self.prof = Professor.objects.create(user=u, escola=self.escola_a)
        self.turma = Turma.objects.create(year=5, nome='A', escola=self.escola_a,
                                          professor=self.prof, qtd_alunos=20)
        self.aula = Aula.objects.create(year=5, mes=3, semana=1, numero_aula=1,
                                        titulo='Daily Routines', tipo='content')
        self.client = Client()
        self.client.login(username='maria', password='x')


class BuscaCatalogoTest(BaseProfessor):
    """Busca no catálogo com isolamento por escola (Demanda 6)."""

    def setUp(self):
        super().setUp()
        # oficial (todos veem)
        Atividade.objects.create(tipo='jogo', nome='Simon Says', tags='escuta')
        # local da escola A (só a A vê)
        Atividade.objects.create(tipo='jogo', nome='Quiz A', escola=self.escola_a)
        # local da escola B (a A NÃO deve ver)
        Atividade.objects.create(tipo='jogo', nome='Quiz B', escola=self.escola_b)

    def test_busca_acha_oficial(self):
        r = self.client.get('/professor/biblioteca/?q=simon')
        self.assertContains(r, 'Simon Says')

    def test_ve_local_da_propria_escola(self):
        r = self.client.get('/professor/biblioteca/')
        self.assertContains(r, 'Quiz A')

    def test_nao_ve_local_de_outra_escola(self):
        r = self.client.get('/professor/biblioteca/')
        self.assertNotContains(r, 'Quiz B')

    def test_filtro_origem_oficial(self):
        r = self.client.get('/professor/biblioteca/?origem=oficial')
        self.assertContains(r, 'Simon Says')
        self.assertNotContains(r, 'Quiz A')


class ConclusaoAulaTest(BaseProfessor):
    """Concluir a aula grava presença e redireciona para a lista (Demanda 11)."""

    def test_concluir_via_modal_grava_e_redireciona(self):
        r = self.client.post(
            f'/professor/turma/{self.turma.id}/aula/{self.aula.codigo}/progresso/',
            {'status': 'concluida', 'presentes': '18', 'redirect': 'lista'},
        )
        # redireciona para a lista de aulas da turma
        self.assertEqual(r.status_code, 302)
        self.assertIn(f'/turma/{self.turma.id}/', r['Location'])
        self.assertNotIn('/aula/', r['Location'])
        # gravou presença
        at = AulaTurma.objects.get(turma=self.turma, aula=self.aula)
        self.assertEqual(at.status, 'concluida')
        self.assertEqual(at.presentes, 18)
        self.assertIsNotNone(at.data_realizada)
        self.assertEqual(at.professor, self.prof)


class TelaoTest(BaseProfessor):
    """A tela da aula (telão) carrega com o contexto novo (Demandas 3, 12)."""

    def test_telao_carrega(self):
        r = self.client.get(f'/professor/turma/{self.turma.id}/aula/{self.aula.codigo}/')
        self.assertEqual(r.status_code, 200)

    def test_telao_passa_background(self):
        self.aula.background = 'quarto'
        self.aula.save()
        r = self.client.get(f'/professor/turma/{self.turma.id}/aula/{self.aula.codigo}/')
        self.assertContains(r, 'quarto')

    def test_professor_nao_acessa_turma_de_outra_escola(self):
        outra = Turma.objects.create(year=5, nome='Z', escola=self.escola_b)
        r = self.client.get(f'/professor/turma/{outra.id}/')
        self.assertEqual(r.status_code, 404)
