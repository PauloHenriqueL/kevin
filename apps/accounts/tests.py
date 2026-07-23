"""Testes de papéis, permissões e redirecionamento (Demanda 2).

Roda com: docker compose exec web python manage.py test apps.accounts
"""
from django.test import Client, TestCase

from apps.escolas.models import Diretor, Escola, Plano, Professor

from .models import User


class RolesTest(TestCase):
    """Os 4 papéis existem e o antigo 'escola' virou 'diretor'."""

    def test_choices_de_role(self):
        valores = [v for v, _ in User.Role.choices]
        self.assertIn('coordenador', valores)
        self.assertIn('diretor', valores)
        self.assertNotIn('escola', valores)


class RedirectPorPapelTest(TestCase):
    """Login manda cada papel para a área certa (middleware)."""

    def setUp(self):
        plano = Plano.objects.create(nome='P', valor_mensal=1)
        self.escola = Escola.objects.create(nome='E', slug='e', plano=plano)

        dir_u = User.objects.create_user('dir', password='x', role='diretor')
        Diretor.objects.create(user=dir_u, escola=self.escola)

        prof_u = User.objects.create_user('prof', password='x', role='professor')
        Professor.objects.create(user=prof_u, escola=self.escola)

        User.objects.create_user('coord', password='x', role='coordenador', is_staff=True)

    def _login_e_home(self, username):
        c = Client()
        c.login(username=username, password='x')
        return c.get('/', follow=False)

    def test_professor_vai_para_professor(self):
        r = self._login_e_home('prof')
        self.assertEqual(r.status_code, 302)
        self.assertIn('/professor/', r['Location'])

    def test_diretor_vai_para_gestao(self):
        r = self._login_e_home('dir')
        self.assertEqual(r.status_code, 302)
        self.assertIn('/gestao/', r['Location'])

    def test_coordenador_vai_para_admin(self):
        r = self._login_e_home('coord')
        self.assertEqual(r.status_code, 302)
        self.assertIn('/admin/', r['Location'])


class AdminAcessoTest(TestCase):
    """Coordenador acessa /admin/ sem loop; professor é barrado (fix D10)."""

    def setUp(self):
        User.objects.create_user('coord', password='x', role='coordenador', is_staff=True)
        plano = Plano.objects.create(nome='P', valor_mensal=1)
        escola = Escola.objects.create(nome='E', slug='e', plano=plano)
        prof_u = User.objects.create_user('prof', password='x', role='professor')
        Professor.objects.create(user=prof_u, escola=escola)

    def test_coordenador_nao_entra_em_loop(self):
        c = Client()
        c.login(username='coord', password='x')
        r = c.get('/admin/', follow=True)
        self.assertLess(len(r.redirect_chain), 3)

    def test_professor_barrado_do_admin(self):
        c = Client()
        c.login(username='prof', password='x')
        r = c.get('/admin/', follow=False)
        self.assertEqual(r.status_code, 302)
