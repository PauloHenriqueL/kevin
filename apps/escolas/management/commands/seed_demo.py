"""Seed de APRESENTAÇÃO — dados ricos para demonstrar o sistema ao cliente.

Seed enxuta para a APRESENTAÇÃO: 4 aulas de vitrine, cada uma mostrando uma
capacidade do sistema, em vez de reproduzir o TG inteiro:
- Aula 1: botão de MÚSICA (Kevin canta com o ukulele) — bg floresta
- Aula 2: botão de LISTENING (atividade de escuta) — bg escola
- Aula 3: background QUARTO (sem áudio)
- Aula 4: background HOSPITAL (sem áudio)
Mais: catálogo cheio, 2 escolas, 2 turmas (3x e 4x) e progresso variado.

Rode: docker compose exec web python manage.py seed_demo
Segue o roteiro em docs/ROTEIRO_APRESENTACAO.md.
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.curriculo.models import Atividade, Aula, AulaTurma, BlocoAula, Homework
from apps.escolas.models import Diretor, Escola, Plano, Professor, Turma


class Command(BaseCommand):
    help = 'Popula o banco com dados RICOS para apresentar o sistema ao cliente.'

    def handle(self, *args, **kwargs):
        self.stdout.write('Criando dados de APRESENTAÇÃO...\n')
        self._planos_e_escolas()
        self._usuarios()
        self._turmas()
        self._catalogo()
        self._tg_marco()
        self._progresso()
        self._final()

    # ── Planos e escolas ──
    def _planos_e_escolas(self):
        self.plano, _ = Plano.objects.get_or_create(
            nome='Bebelingue Completo',
            defaults={
                'valor_mensal': 299.90,
                'ia_provider': 'anthropic',
                'ia_modelo': 'claude-sonnet-4-20250514',
                'ia_api_key': '',
                'tts_provider': 'elevenlabs',
                'tts_api_key': '',
                'tts_voice_id': '21m00Tcm4TlvDq8ikWAM',
                'tts_modelo': 'eleven_multilingual_v2',
                'stt_provider': 'openai_whisper',
                'stt_api_key': '',
            },
        )
        self.bernoulli, _ = Escola.objects.get_or_create(
            slug='bernoulli',
            defaults={'nome': 'Colégio Bernoulli', 'plano': self.plano},
        )
        self.paulofreire, _ = Escola.objects.get_or_create(
            slug='paulo-freire',
            defaults={'nome': 'Escola Paulo Freire', 'plano': self.plano},
        )
        self.stdout.write('  ✓ 2 escolas (Bernoulli, Paulo Freire)')

    # ── Usuários ──
    def _mk_user(self, username, role, first, last, senha, **extra):
        u, created = User.objects.get_or_create(
            username=username,
            defaults={'role': role, 'first_name': first, 'last_name': last,
                      'email': f'{username}@bebelingue.com', **extra},
        )
        if created:
            u.set_password(senha)
            u.save()
        return u

    def _grupo_coordenador(self):
        """Grupo com as permissões que o coordenador Bebelingue usa no admin:
        currículo (aulas, atividades, blocos, homeworks) e cadastro de escolas/
        professores/turmas. NÃO inclui Plano (chaves de API)."""
        from django.contrib.auth.models import Group, Permission

        grupo, _ = Group.objects.get_or_create(name='Coordenador Bebelingue')
        apps_perms = {
            'curriculo': ['aula', 'atividade', 'blocoaula', 'homework', 'aulaturma'],
            'escolas': ['escola', 'professor', 'turma', 'diretor'],
        }
        perms = Permission.objects.filter(
            content_type__app_label__in=apps_perms.keys(),
            content_type__model__in=[m for ms in apps_perms.values() for m in ms],
        )
        grupo.permissions.set(perms)
        return grupo

    def _usuarios(self):
        self._mk_user('admin', 'admin', 'Admin', 'Bebelingue', 'admin123',
                      is_staff=True, is_superuser=True)
        self.coord = self._mk_user('coord', 'coordenador', 'Coordenação',
                                   'Bebelingue', 'coord123', is_staff=True)
        # dá ao coordenador as permissões de admin para cadastrar o TG
        self.coord.groups.add(self._grupo_coordenador())
        # diretor
        dir_user = self._mk_user('carlos', 'diretor', 'Carlos', 'Oliveira', 'dir123')
        Diretor.objects.get_or_create(user=dir_user, defaults={'escola': self.bernoulli})
        # professores
        maria_u = self._mk_user('maria', 'professor', 'Maria', 'Silva', 'prof123')
        joao_u = self._mk_user('joao', 'professor', 'João', 'Santos', 'prof123')
        self.maria, _ = Professor.objects.get_or_create(
            user=maria_u, defaults={'escola': self.bernoulli})
        self.joao, _ = Professor.objects.get_or_create(
            user=joao_u, defaults={'escola': self.bernoulli})
        self.stdout.write('  ✓ admin, coord, diretor, 2 professores')

    # ── TG, Série e Turmas (D31/D32) ──
    def _turmas(self):
        from apps.curriculo.models import TG
        from apps.escolas.models import Serie

        # O cronograma da Bebelingue (global). MVP: um TG 3x para o Year 5.
        self.tg, _ = TG.objects.get_or_create(
            year=5, frequencia=3, defaults={'nome': 'TG 3x — Year 5'})

        # A escola cria a série "Fundamental" e a coordenação a vincula ao TG.
        self.serie, _ = Serie.objects.get_or_create(
            escola=self.bernoulli, nome='Fundamental',
            defaults={'year': 5, 'tg': self.tg})

        # Ambas as turmas seguem essa série (MVP é Y5 3x).
        self.turma5a, _ = Turma.objects.get_or_create(
            escola=self.bernoulli, year=5, nome='A',
            defaults={'professor': self.maria, 'qtd_alunos': 22, 'serie': self.serie},
        )
        self.turma5b, _ = Turma.objects.get_or_create(
            escola=self.bernoulli, year=5, nome='B',
            defaults={'professor': self.joao, 'qtd_alunos': 19, 'serie': self.serie},
        )
        self.stdout.write('  ✓ TG 3x Year 5, série Fundamental, turmas 5A e 5B')

    # ── Catálogo de atividades ──
    def _catalogo(self):
        # (tipo, nome, descricao, como_conduzir, objetivo, materiais, tags)
        oficiais = [
            ('rotina', 'BeCalendar', 'Rotina de abertura com data e calendário.',
             'Pergunte o dia da semana, o mês e o clima. A turma responde em inglês.',
             'Situar a turma no tempo em inglês', '', 'rotina, abertura, calendario'),
            ('rotina', 'Songs Collection', 'Coletânea de músicas da metodologia.',
             'Toque uma música da coletânea e cante junto com a turma.',
             'Engajamento e ritmo', '', 'musica, rotina'),
            ('recurso', 'Listening Practice U1', 'Áudio de escuta da Unit 1.',
             'Toque o áudio e peça que a turma escute e responda às perguntas.',
             'Compreensão auditiva', '', 'listening, escuta, unit1'),
            ('rotina', 'I Can Routine', 'Ritual de fim de atividade.',
             'Peça que marquem a caixa "I can" no rodapé e escrevam a data.',
             'Autoavaliação e registro', '', 'rotina, registro'),
            ('tecnica', 'Sandwich Technique', 'Inglês → português → inglês.',
             'Leia a frase em inglês, diga em português, repita em inglês.',
             'Compreensão sem abandonar o idioma-alvo', '', 'tecnica, traducao'),
            ('tecnica', 'Instant Translation', 'Valida em PT, responde em EN.',
             'Quando o aluno fala português, valide e traduza para o inglês na hora.',
             'Manter o foco no inglês', '', 'tecnica, idioma'),
            ('tecnica', 'Repetition Techniques', 'Repetição em escada.',
             '3 grupos grandes → 3 pequenos → 4 individuais. Sempre nível de frase.',
             'Fixação de vocabulário', 'flashcards', 'tecnica, repeticao, drill'),
            ('jogo', 'Go and Touch', 'Jogo de vocabulário com movimento.',
             'Diga "Go and touch the..." e a turma corre até o objeto.',
             'Vocabulário + movimento', 'flashcards ou objetos', 'jogo, movimento, vocabulario'),
            ('jogo', 'Simon Says', 'Comandos e escuta.',
             'Dê comandos com "Simon says". A turma só obedece se disser antes.',
             'Escuta e comandos', '', 'jogo, escuta, comandos'),
            ('jogo', 'Hangman', 'Jogo da forca.',
             'Trace lacunas para as letras; a turma adivinha letra por letra.',
             'Revisão de vocabulário e soletração', 'quadro', 'jogo, revisao, spelling'),
            ('jogo', 'Hot Potato', 'Passa a batata quente.',
             'Passe um objeto ao som da música; quem fica com ele responde.',
             'Prática rápida de vocabulário', 'bolinha', 'jogo, revisao'),
            ('jogo', 'Four Corners', 'Quatro cantos.',
             'Cada canto é uma opção; a turma corre para a resposta certa.',
             'Prática oral com movimento', '', 'jogo, movimento, communication'),
            ('jogo', 'Pictionary', 'Desenhe e adivinhe.',
             'Um aluno desenha a palavra; os outros adivinham em inglês.',
             'Vocabulário e comunicação', 'quadro', 'jogo, desenho'),
            ('recurso', "Student's Book U1L1", 'Livro do aluno, Unit 1 Lesson 1.',
             '', 'Base do conteúdo da aula', '', 'livro, unit1'),
            ('recurso', 'Integrated Activities - Science L1', 'Atividades integradas de Ciências.',
             '', 'CLIL — estados da água', '', 'clil, science, culture'),
        ]
        # URL de áudio por atividade (demo). O mesmo arquivo serve para música e
        # listening — na apresentação, você explica que é a mesma faixa. As URLs
        # são absolutas porque arquivo_url é URLField; em produção, apontam ao R2.
        base = 'http://localhost:8000/static/audio'
        audio_por_atividade = {
            'Songs Collection': f'{base}/musica-y5u1.mp3',
            'Listening Practice U1': f'{base}/listening-y5u1.mp3',
        }

        self.atv = {}
        for tipo, nome, desc, como, obj, mat, tags in oficiais:
            arquivo_url = audio_por_atividade.get(nome, '')
            if not arquivo_url and tipo == 'recurso':
                arquivo_url = 'https://exemplo.com/material'
            a, _ = Atividade.objects.get_or_create(
                nome=nome, escola=None,
                defaults={'tipo': tipo, 'descricao': desc, 'como_conduzir': como,
                          'objetivo_pedagogico': obj, 'materiais': mat, 'tags': tags,
                          'arquivo_url': arquivo_url,
                          'criado_por': self.coord},
            )
            self.atv[nome] = a

        # Catálogo é 100% oficial da Bebelingue (Demanda 13). Escola não cria aula.
        self.stdout.write(f'  ✓ Catálogo: {len(oficiais)} atividades oficiais (Bebelingue)')

    # ── Aulas do TG (ligadas ao TG 3x Year 5) ──
    def _aula(self, semana, num, tipo, unit, lesson, titulo, freq=3, bg='floresta',
              blocos=None, hw=None, obs='', kickoff=''):
        # A `unit` posicional é numérica por herança; aqui vira a sigla do TG.
        sigla_unit = f'U{unit}' if isinstance(unit, int) else unit
        aula, created = Aula.objects.get_or_create(
            tg=self.tg, unit=sigla_unit, semana=semana, numero_aula=num,
            defaults={'tipo': tipo, 'mes': 3, 'lesson': lesson, 'titulo': titulo,
                      'background': bg, 'observacao': obs, 'kickoff': kickoff},
        )
        if created and blocos:
            for fase, ordem, ativ, instr, ref in blocos:
                BlocoAula.objects.create(
                    aula=aula, fase=fase, ordem=ordem,
                    atividade=self.atv.get(ativ), instrucoes=instr, referencia=ref)
        if created and hw:
            Homework.objects.create(aula=aula, descricao=hw)
        return aula

    def _warmup(self, jogo, com_musica=False, com_listening=False):
        """Warm Up da aula. BeCalendar + jogo sempre; música e listening só
        quando a aula pede (é o que faz o botão correspondente aparecer)."""
        blocos = [('warm_up', 1, 'BeCalendar', '', '')]
        ordem = 2
        if com_musica:
            blocos.append(('warm_up', ordem, 'Songs Collection', '', '')); ordem += 1
        if com_listening:
            blocos.append(('warm_up', ordem, 'Listening Practice U1', '', '')); ordem += 1
        blocos.append(('warm_up', ordem, jogo, '', 'HW Correction / Practice Game'))
        return blocos

    def _tg_marco(self):
        """Seed enxuta para apresentação: 4 aulas, cada uma mostrando uma
        capacidade — música, listening, e dois backgrounds diferentes.

        Não reproduz o TG inteiro de propósito: é uma vitrine do sistema. A
        regra dos botões (só aparece se a aula tem o conteúdo) é a mesma de
        produção — aqui só controlamos QUAIS aulas têm cada conteúdo."""

        # AULA 1 — botão de MÚSICA (o Kevin canta com o ukulele)
        self._aula(1, 1, 'content', 1, 'U1L1', 'Share It! — Daily Routines', bg='floresta',
                   kickoff='Olá Kevin, hoje começamos a Unit 1. Por onde vamos?',
                   blocos=self._warmup('Go and Touch', com_musica=True) + [
                       ('development', 1, "Student's Book U1L1",
                        'Explore a imagem da página.\nIntroduza o vocabulário com Repetition Techniques.',
                        "Student's Book U1L1 (P. 10-11)"),
                       ('development', 2, 'I Can Routine', '', ''),
                       ('closure', 1, 'Hangman', '', 'Review Game'),
                   ],
                   hw='Integrated Activities - Unit 1 (exercises 1 and 2)')

        # AULA 2 — botão de LISTENING (atividade de escuta)
        self._aula(1, 2, 'content', 1, 'U1L2', 'Listening — A Day in My Life', bg='escola-int',
                   kickoff='Olá Kevin! Hoje vamos praticar escuta. Pronto?',
                   blocos=self._warmup('Hot Potato', com_listening=True) + [
                       ('development', 1, "Student's Book U1L1",
                        'Toque o áudio de listening e faça as perguntas de compreensão.',
                        "Student's Book U1L2 (P. 12-13)"),
                       ('development', 2, 'I Can Routine', '', ''),
                       ('closure', 1, 'Simon Says', '', 'Review Game'),
                   ])

        # AULA 3 — background QUARTO (sem áudio)
        self._aula(1, 3, 'content', 1, 'U1L3', 'Vocabulary — Daily Routines at Home', bg='quarto',
                   blocos=self._warmup('Go and Touch') + [
                       ('development', 1, "Student's Book U1L1", 'Vocabulário de rotina com flashcards.',
                        "Student's Book U1L3 (P. 14)"),
                       ('development', 2, 'I Can Routine', '', ''),
                       ('closure', 1, 'Hangman', '', 'Review Game'),
                   ])

        # AULA 4 — background HOSPITAL (sem áudio)
        self._aula(2, 1, 'culture', 1, 'CLIL Health', 'Culture — At the Doctor', bg='hospital',
                   obs='Cenário de hospital combina com o vocabulário de saúde.',
                   blocos=self._warmup('Four Corners') + [
                       ('development', 1, 'Integrated Activities - Science L1',
                        'Vocabulário de saúde e partes do corpo.',
                        'Integrated Activities Book (P. 65-66)'),
                       ('closure', 1, 'Pictionary', '', 'Review Game'),
                   ])

        self.stdout.write('  ✓ 4 aulas de demo: música (floresta), listening (escola), quarto, hospital')

    def _progresso(self):
        # Com a seed enxuta (4 aulas), o contraste 5A vs 5B fica: 5A adiantada
        # (3 concluídas + 1 em andamento), 5B atrasada (1 concluída).
        base = date.today() - timedelta(days=30)

        aulas_5a = list(self.turma5a.aulas_do_curriculo())
        for i, aula in enumerate(aulas_5a[:3]):
            AulaTurma.objects.get_or_create(
                turma=self.turma5a, aula=aula,
                defaults={'status': 'concluida', 'professor': self.maria,
                          'data_realizada': base + timedelta(days=i * 3),
                          'presentes': 20 + (i % 3)},
            )
        if len(aulas_5a) > 3:
            AulaTurma.objects.get_or_create(
                turma=self.turma5a, aula=aulas_5a[3],
                defaults={'status': 'em_andamento', 'professor': self.maria})

        aulas_5b = list(self.turma5b.aulas_do_curriculo())
        for i, aula in enumerate(aulas_5b[:1]):
            AulaTurma.objects.get_or_create(
                turma=self.turma5b, aula=aula,
                defaults={'status': 'concluida', 'professor': self.joao,
                          'data_realizada': base + timedelta(days=i * 5),
                          'presentes': 17 + (i % 2)},
            )
        self.stdout.write('  ✓ Progresso: 5A adiantada (3 concluídas), 5B atrasada (1)')

    def _final(self):
        self.stdout.write(self.style.SUCCESS(
            '\n✅ Dados de APRESENTAÇÃO prontos! Siga docs/ROTEIRO_APRESENTACAO.md\n\n'
            '  admin  / admin123  → Django Admin (currículo)\n'
            '  coord  / coord123  → Coordenador Bebelingue\n'
            '  carlos / dir123    → Diretor Bernoulli (relatórios)\n'
            '  maria  / prof123   → Professora Year 5A (adiantada)\n'
            '  joao   / prof123   → Professor Year 5B (atrasado, 4x)\n'
        ))
