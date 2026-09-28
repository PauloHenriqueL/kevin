"""Testes do currículo — modelo novo (Demandas 1, 3, 11, 12).

Roda com: docker compose exec web python manage.py test apps.curriculo
"""
from unittest.mock import patch

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

    def test_unicidade_por_endereco_dentro_do_tg(self):
        # A unicidade agora é por TG (D31): a mesma U1W1C1 não repete no MESMO
        # TG, mas pode existir em TGs diferentes (3x e 5x).
        from .models import TG
        tg3 = TG.objects.create(nome='TG 3x Y5', year=5, frequencia=3)
        tg5 = TG.objects.create(nome='TG 5x Y5', year=5, frequencia=5)
        Aula.objects.create(tg=tg3, unit='U1', semana=1, numero_aula=1, titulo='A')
        # mesmo endereço, outro TG: permitido
        Aula.objects.create(tg=tg5, unit='U1', semana=1, numero_aula=1, titulo='B')
        # mesmo endereço, mesmo TG: proibido
        with self.assertRaises(Exception):
            Aula.objects.create(tg=tg3, unit='U1', semana=1, numero_aula=1, titulo='C')


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


class SerieTGTest(TestCase):
    """Turma segue o TG da sua série (D31/D32)."""

    def setUp(self):
        from .models import TG
        from apps.escolas.models import Serie
        plano = Plano.objects.create(nome='P', valor_mensal=1)
        self.escola = Escola.objects.create(nome='E', slug='e', plano=plano)

        # Dois cronogramas distintos, cada um com seu próprio conteúdo.
        self.tg3 = TG.objects.create(nome='TG 3x Y5', year=5, frequencia=3)
        self.tg5 = TG.objects.create(nome='TG 5x Y5', year=5, frequencia=5)
        for i in range(1, 4):
            Aula.objects.create(tg=self.tg3, unit='U1', semana=1, numero_aula=i, titulo=f'3x-{i}')
        for i in range(1, 6):
            Aula.objects.create(tg=self.tg5, unit='U1', semana=1, numero_aula=i, titulo=f'5x-{i}')

        self.serie3 = Serie.objects.create(escola=self.escola, nome='Fund', year=5, tg=self.tg3)

    def test_turma_segue_o_tg_da_serie(self):
        t = Turma.objects.create(year=5, nome='A', escola=self.escola, serie=self.serie3)
        self.assertEqual(t.tg, self.tg3)
        self.assertEqual(t.aulas_do_curriculo().count(), 3)  # só as do TG 3x

    def test_serie_5x_ve_o_tg_5x(self):
        from apps.escolas.models import Serie
        serie5 = Serie.objects.create(escola=self.escola, nome='Adol', year=5, tg=self.tg5)
        t = Turma.objects.create(year=5, nome='B', escola=self.escola, serie=serie5)
        self.assertEqual(t.aulas_do_curriculo().count(), 5)  # só as do TG 5x

    def test_turma_sem_tg_nao_tem_curriculo(self):
        from apps.escolas.models import Serie
        serie_vazia = Serie.objects.create(escola=self.escola, nome='X', year=5, tg=None)
        t = Turma.objects.create(year=5, nome='C', escola=self.escola, serie=serie_vazia)
        self.assertEqual(t.aulas_do_curriculo().count(), 0)


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


class CoordenacaoTest(TestCase):
    """Área da coordenação (Demanda 7): acesso, editor de blocos, duplicar."""

    def setUp(self):
        from django.test import Client
        self.coord = User.objects.create_user(
            'coord', password='x', role='coordenador', is_staff=True)
        self.prof = User.objects.create_user('prof', password='x', role='professor')
        self.client_coord = Client()
        self.client_coord.login(username='coord', password='x')

        from .models import TG
        self.tg = TG.objects.create(nome='TG 3x — Year 5', year=5, frequencia=3)
        self.aula = Aula.objects.create(
            tg=self.tg, unit='U1', semana=1, numero_aula=1, titulo='Aula 1')
        self.atividade = Atividade.objects.create(
            tipo='jogo', nome='Simon Says', como_conduzir='Dê comandos.')

    def test_professor_nao_acessa_coordenacao(self):
        c = self.client_class()
        c.login(username='prof', password='x')
        r = c.get('/coordenacao/')
        self.assertIn(r.status_code, (302, 403))

    def test_coordenador_acessa_dashboard(self):
        r = self.client_coord.get('/coordenacao/')
        self.assertEqual(r.status_code, 200)

    def test_grade_lista_aulas_da_unit(self):
        r = self.client_coord.get(f'/coordenacao/tg/{self.tg.id}/U1/')
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, 'Y5-U1W1C1')

    def test_adicionar_bloco_por_atividade(self):
        import json
        r = self.client_coord.post(
            f'/coordenacao/aula/{self.aula.pk}/blocos/adicionar/',
            data=json.dumps({'fase': 'warm_up', 'atividade_id': self.atividade.pk}),
            content_type='application/json',
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.aula.blocos.count(), 1)
        self.assertEqual(self.aula.blocos.first().atividade, self.atividade)

    def test_reordenar_nao_mexe_em_bloco_de_outra_aula(self):
        """Segurança: reordenar só afeta blocos da própria aula."""
        import json
        outra = Aula.objects.create(tg=self.tg, unit='U1', semana=9, numero_aula=1, titulo='X')
        bloco_outra = BlocoAula.objects.create(
            aula=outra, fase='warm_up', ordem=1, titulo='intruso')
        self.client_coord.post(
            f'/coordenacao/aula/{self.aula.pk}/blocos/reordenar/',
            data=json.dumps({'blocos': [
                {'id': bloco_outra.id, 'fase': 'closure', 'ordem': 99}]}),
            content_type='application/json',
        )
        bloco_outra.refresh_from_db()
        self.assertEqual(bloco_outra.fase, 'warm_up')  # inalterado

    def test_duplicar_unit_copia_aulas_e_blocos(self):
        BlocoAula.objects.create(
            aula=self.aula, fase='warm_up', ordem=1, atividade=self.atividade)
        r = self.client_coord.post(
            f'/coordenacao/tg/{self.tg.id}/U1/duplicar/', data={'unit_destino': 'U2'})
        self.assertEqual(r.status_code, 302)
        nova = Aula.objects.get(tg=self.tg, unit='U2', semana=1, numero_aula=1)
        self.assertEqual(nova.codigo, 'Y5-U2W1C1')
        self.assertEqual(nova.blocos.count(), 1)

    def test_duplicar_nao_sobrescreve_unit_com_aulas(self):
        Aula.objects.create(tg=self.tg, unit='U3', semana=1, numero_aula=1, titulo='Já existe')
        self.client_coord.post(
            f'/coordenacao/tg/{self.tg.id}/U1/duplicar/', data={'unit_destino': 'U3'})
        # Continua só a aula original em U3 — a duplicação foi recusada.
        self.assertEqual(Aula.objects.filter(tg=self.tg, unit='U3').count(), 1)

    def test_buscar_atividades_so_retorna_oficiais(self):
        from apps.escolas.models import Escola, Plano
        plano = Plano.objects.create(nome='P', valor_mensal=1)
        escola = Escola.objects.create(nome='E', slug='e', plano=plano)
        Atividade.objects.create(tipo='jogo', nome='Local Secreto', escola=escola)
        r = self.client_coord.get('/coordenacao/atividades/buscar/?q=')
        nomes = [a['nome'] for a in r.json()['resultados']]
        self.assertIn('Simon Says', nomes)
        self.assertNotIn('Local Secreto', nomes)


class MusicaAulaTest(TestCase):
    """Botão de música do telão: só aparece com atividade de música (D11)."""

    def setUp(self):
        self.aula = Aula.objects.create(
            year=5, unit='U1', semana=1, numero_aula=1, titulo='X')

    def test_sem_musica_botao_nao_aparece(self):
        self.assertFalse(self.aula.tem_musica)
        self.assertEqual(self.aula.musica_url, '')

    def test_atividade_com_tag_musica_ativa_botao(self):
        song = Atividade.objects.create(
            tipo='rotina', nome='Songs Collection', tags='musica, rotina',
            arquivo_url='https://exemplo.com/faixa.mp3')
        BlocoAula.objects.create(aula=self.aula, fase='warm_up', ordem=1, atividade=song)
        self.assertTrue(self.aula.tem_musica)
        self.assertEqual(self.aula.musica_url, 'https://exemplo.com/faixa.mp3')

    def test_detecta_musica_pelo_nome_song(self):
        song = Atividade.objects.create(tipo='rotina', nome='Hello Song')
        BlocoAula.objects.create(aula=self.aula, fase='warm_up', ordem=1, atividade=song)
        self.assertTrue(self.aula.tem_musica)


class ListeningAulaTest(TestCase):
    """Botão de listening do telão: só aparece com atividade de listening,
    e é independente da música (são conteúdos diferentes)."""

    def setUp(self):
        self.aula = Aula.objects.create(
            year=5, unit='U1', semana=1, numero_aula=1, titulo='X')

    def test_sem_listening_botao_nao_aparece(self):
        self.assertFalse(self.aula.tem_listening)
        self.assertEqual(self.aula.listening_url, '')

    def test_atividade_com_tag_listening_ativa_botao(self):
        atv = Atividade.objects.create(
            tipo='recurso', nome='Listening Practice U1', tags='listening, escuta',
            arquivo_url='https://exemplo.com/listening.mp3')
        BlocoAula.objects.create(aula=self.aula, fase='warm_up', ordem=1, atividade=atv)
        self.assertTrue(self.aula.tem_listening)
        self.assertEqual(self.aula.listening_url, 'https://exemplo.com/listening.mp3')

    def test_musica_e_listening_sao_independentes(self):
        """Uma aula de música não ativa o botão de listening, e vice-versa."""
        song = Atividade.objects.create(
            tipo='rotina', nome='Songs Collection', tags='musica')
        BlocoAula.objects.create(aula=self.aula, fase='warm_up', ordem=1, atividade=song)
        self.assertTrue(self.aula.tem_musica)
        self.assertFalse(self.aula.tem_listening)


class CoordenacaoPermissaoEndpointsTest(TestCase):
    """As views em FUNÇÃO da coordenação também exigem papel (D40).

    Elas não herdam o CoordenadorRequiredMixin (não são classes), e por um
    tempo ficaram com apenas @require_POST — que valida o método, não quem
    chama. Qualquer usuário autenticado podia editar o TG oficial, que é
    global e serve todas as escolas. Estes testes existem para isso não
    voltar.
    """

    def setUp(self):
        from django.test import Client
        from .models import TG
        User.objects.create_user('coord2', password='x', role='coordenador')
        User.objects.create_user('prof2', password='x', role='professor')
        User.objects.create_user('dir2', password='x', role='diretor')

        self.tg = TG.objects.create(nome='TG 3x — Year 5', year=5, frequencia=3)
        self.aula = Aula.objects.create(
            tg=self.tg, unit='U1', semana=1, numero_aula=1, titulo='Aula 1')
        self.atividade = Atividade.objects.create(
            tipo='jogo', nome='Simon Says', como_conduzir='Dê comandos.')
        self.bloco = BlocoAula.objects.create(
            aula=self.aula, fase='warm_up', ordem=1, atividade=self.atividade)

        self.como_prof = Client(); self.como_prof.login(username='prof2', password='x')
        self.como_dir = Client(); self.como_dir.login(username='dir2', password='x')
        self.como_coord = Client(); self.como_coord.login(username='coord2', password='x')

    def _endpoints(self):
        return [
            ('post', f'/coordenacao/aula/{self.aula.pk}/blocos/reordenar/'),
            ('post', f'/coordenacao/aula/{self.aula.pk}/blocos/adicionar/'),
            ('post', f'/coordenacao/bloco/{self.bloco.pk}/atualizar/'),
            ('post', f'/coordenacao/bloco/{self.bloco.pk}/remover/'),
            ('get', '/coordenacao/atividades/buscar/?q='),
        ]

    def test_professor_recebe_403_em_todos_os_endpoints(self):
        for metodo, url in self._endpoints():
            with self.subTest(url=url):
                r = getattr(self.como_prof, metodo)(url)
                self.assertEqual(r.status_code, 403, f'{url} deixou o professor passar')

    def test_diretor_recebe_403_em_todos_os_endpoints(self):
        """O diretor é da escola cliente: também não mexe no TG global."""
        for metodo, url in self._endpoints():
            with self.subTest(url=url):
                r = getattr(self.como_dir, metodo)(url)
                self.assertEqual(r.status_code, 403, f'{url} deixou o diretor passar')

    def test_professor_nao_consegue_apagar_bloco(self):
        """Além do status, o efeito: o bloco precisa continuar existindo."""
        self.como_prof.post(f'/coordenacao/bloco/{self.bloco.pk}/remover/')

        self.assertTrue(BlocoAula.objects.filter(pk=self.bloco.pk).exists())

    def test_coordenador_continua_passando(self):
        """A trava não pode ter fechado a porta para quem é dono do TG."""
        r = self.como_coord.get('/coordenacao/atividades/buscar/?q=')

        self.assertEqual(r.status_code, 200)

    def test_anonimo_nao_passa(self):
        from django.test import Client
        r = Client().get('/coordenacao/atividades/buscar/?q=')

        self.assertIn(r.status_code, (302, 403))


class KevinAssetTagTest(TestCase):
    """Resolução de URL dos assets do Kevin (Demanda 19, etapa 1)."""

    def _render(self, caminho):
        from django.template import Context, Template
        t = Template("{% load kevin_assets %}{% kevin_asset caminho %}")
        return t.render(Context({'caminho': caminho}))

    def test_sem_base_configurada_cai_em_static(self):
        with self.settings(KEVIN_ASSETS_BASE_URL=''):
            url = self._render('backgrounds/floresta.webp')

        self.assertIn('js/kevin-puppet/assets/backgrounds/floresta.webp', url)

    def test_com_base_configurada_aponta_para_o_bucket(self):
        with self.settings(KEVIN_ASSETS_BASE_URL='https://bucket.exemplo/kevin-assets'):
            url = self._render('audio/backsound/trilha-padrao.mp3')

        self.assertEqual(
            url, 'https://bucket.exemplo/kevin-assets/audio/backsound/trilha-padrao.mp3')

    def test_barra_final_na_base_nao_duplica(self):
        with self.settings(KEVIN_ASSETS_BASE_URL='https://bucket.exemplo/kevin-assets/'):
            url = self._render('obj/quadro-negro.png')

        self.assertNotIn('//obj/', url)

    def test_espaco_no_nome_do_arquivo_e_escapado(self):
        """Um arquivo do export tem espaço no nome e o motor o referencia
        assim. Sem escapar, a URL quebra no navegador."""
        with self.settings(KEVIN_ASSETS_BASE_URL='https://bucket.exemplo/kevin-assets'):
            url = self._render('img/vocabulario/take-a-shower .png')

        self.assertIn('take-a-shower%20.png', url)
        self.assertNotIn(' ', url)


class KevinAssetFallbackTest(TestCase):
    """Asset ausente não pode derrubar a página (regressão de 28/09/2026).

    Com DEBUG=False o storage de manifesto levanta ValueError para arquivo
    não coletado. Como a mídia do Kevin é gitignored, em produção NENHUM
    cenário está no manifesto — e a aula inteira devolvia 500.
    """

    def _render(self):
        from django.template import Context, Template
        t = Template("{% load kevin_assets %}{% kevin_asset 'backgrounds/floresta.webp' %}")
        return t.render(Context({}))

    def test_manifesto_sem_o_arquivo_nao_levanta(self):
        # Simula o manifesto de produção, que não tem a mídia: o `static` do
        # Django levanta ValueError. Aqui isso é forçado porque em dev os
        # arquivos existem e são coletados normalmente.
        erro = ValueError(
            "Missing staticfiles manifest entry for "
            "'js/kevin-puppet/assets/backgrounds/floresta.webp'")
        with self.settings(KEVIN_ASSETS_BASE_URL=''):
            with patch('apps.curriculo.templatetags.kevin_assets.static',
                       side_effect=erro):
                url = self._render()   # não pode propagar o ValueError

        self.assertIn('backgrounds/floresta.webp', url)
        self.assertTrue(url.startswith('/static/'), url)
