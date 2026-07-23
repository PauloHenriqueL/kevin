"""Seed de APRESENTAÇÃO — dados ricos para demonstrar o sistema ao cliente.

Diferente do `seed` (mínimo, para testar), este popula:
- o TG de Março/Year 5 inteiro (12 aulas tipadas, como no TG real da Bebelingue)
- catálogo de atividades cheio (jogos, técnicas, rotinas, recursos)
- uma atividade LOCAL de escola (demonstra o isolamento entre clientes)
- 2 escolas, 2 turmas com frequências diferentes (3x e 4x)
- progresso variado (turma adiantada vs. atrasada) para os relatórios

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

    def _usuarios(self):
        self._mk_user('admin', 'admin', 'Admin', 'Bebelingue', 'admin123',
                      is_staff=True, is_superuser=True)
        self.coord = self._mk_user('coord', 'coordenador', 'Coordenação',
                                   'Bebelingue', 'coord123', is_staff=True)
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

    # ── Turmas (frequências diferentes) ──
    def _turmas(self):
        self.turma5a, _ = Turma.objects.get_or_create(
            escola=self.bernoulli, year=5, nome='A',
            defaults={'professor': self.maria, 'qtd_alunos': 22, 'aulas_por_semana': 3},
        )
        self.turma5b, _ = Turma.objects.get_or_create(
            escola=self.bernoulli, year=5, nome='B',
            defaults={'professor': self.joao, 'qtd_alunos': 19, 'aulas_por_semana': 4},
        )
        self.stdout.write('  ✓ Turma 5A (3x, Maria) e 5B (4x, João)')

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
        self.atv = {}
        for tipo, nome, desc, como, obj, mat, tags in oficiais:
            a, _ = Atividade.objects.get_or_create(
                nome=nome, escola=None,
                defaults={'tipo': tipo, 'descricao': desc, 'como_conduzir': como,
                          'objetivo_pedagogico': obj, 'materiais': mat, 'tags': tags,
                          'arquivo_url': 'https://exemplo.com/material' if tipo == 'recurso' else '',
                          'criado_por': self.coord},
            )
            self.atv[nome] = a

        # atividade LOCAL da escola (demonstra isolamento entre clientes)
        Atividade.objects.get_or_create(
            nome='Quiz do Bernoulli', escola=self.bernoulli,
            defaults={'tipo': 'jogo', 'descricao': 'Quiz criado pela professora Maria.',
                      'como_conduzir': 'Perguntas rápidas de revisão em equipes.',
                      'objetivo_pedagogico': 'Revisão gamificada', 'tags': 'jogo, revisao, local',
                      'criado_por': self.maria.user},
        )
        self.stdout.write(f'  ✓ Catálogo: {len(oficiais)} oficiais + 1 local (Bernoulli)')

    # ── TG de Março inteiro ──
    def _aula(self, semana, num, tipo, unit, lesson, titulo, freq=3, bg='floresta',
              blocos=None, hw=None, obs='', kickoff=''):
        aula, created = Aula.objects.get_or_create(
            year=5, mes=3, semana=semana, numero_aula=num,
            defaults={'tipo': tipo, 'unit': unit, 'lesson': lesson, 'titulo': titulo,
                      'frequencia_minima': freq, 'background': bg, 'observacao': obs,
                      'kickoff': kickoff},
        )
        if created and blocos:
            for fase, ordem, ativ, instr, ref in blocos:
                BlocoAula.objects.create(
                    aula=aula, fase=fase, ordem=ordem,
                    atividade=self.atv.get(ativ), instrucoes=instr, referencia=ref)
        if created and hw:
            Homework.objects.create(aula=aula, descricao=hw)
        return aula

    def _warmup_padrao(self, jogo):
        """Warm Up padrão: BeCalendar + Songs + jogo de correção de HW."""
        return [
            ('warm_up', 1, 'BeCalendar', '', ''),
            ('warm_up', 2, 'Songs Collection', '', ''),
            ('warm_up', 3, jogo, '', 'HW Correction / Practice Game'),
        ]

    def _tg_marco(self):
        # WEEK 1
        self._aula(1, 1, 'content', 1, 'U1L1', 'Share It! — Daily Routines', bg='quarto',
                   kickoff='Olá Kevin, hoje começamos a Unit 1. Por onde vamos?',
                   blocos=self._warmup_padrao('Go and Touch') + [
                       ('development', 1, "Student's Book U1L1",
                        'Explore a imagem da página.\nIntroduza o vocabulário com Repetition Techniques.',
                        "Student's Book U1L1 (P. 10-11)"),
                       ('development', 2, 'I Can Routine', '', ''),
                       ('closure', 1, 'Hangman', '', 'Review Game'),
                   ],
                   hw='Integrated Activities - Unit 1 (exercises 1 and 2)')
        self._aula(1, 2, 'content', 1, 'U1L2', 'Grammar — Frequency Adverbs', bg='quarto',
                   blocos=self._warmup_padrao('Hot Potato') + [
                       ('development', 1, "Student's Book U1L1",
                        'Escreva a gramática no quadro. Introduza com Sandwich Technique.',
                        "Student's Book U1L2 (P. 12-13)"),
                       ('development', 2, 'Repetition Techniques', 'Drills orais.', ''),
                       ('development', 3, 'I Can Routine', '', ''),
                       ('closure', 1, 'Simon Says', '', 'Review Game'),
                   ],
                   hw='Copiar o Grammar Chart da página 12 no caderno.')
        self._aula(1, 3, 'culture', 1, 'CLIL Science L1', 'Culture — States of Water', bg='floresta',
                   blocos=self._warmup_padrao('Hot Potato') + [
                       ('development', 1, 'Integrated Activities - Science L1',
                        'Explore as imagens de água. Introduza: gas, solid, liquid.',
                        'Integrated Activities Book - Science L1 (P. 65-66)'),
                       ('closure', 1, 'Four Corners', '', 'Review Game'),
                   ])
        # WEEK 2
        self._aula(2, 1, 'content', 1, 'U1L3', 'Reading — A Day in My Life', bg='escola-int',
                   blocos=self._warmup_padrao('Go and Touch') + [
                       ('development', 1, "Student's Book U1L1",
                        'Setting up context → Scanning → Skimming → While-reading → Post-reading.',
                        "Student's Book U1L3 (P. 14-15)"),
                       ('development', 2, 'I Can Routine', '', ''),
                       ('closure', 1, 'Hangman', '', 'Review Game'),
                   ])
        self._aula(2, 2, 'communication', 1, '', 'Communication — Speaking Games', bg='escola-ext',
                   obs='Aula sem livro — prática oral por jogos.',
                   blocos=self._warmup_padrao('Hot Potato') + [
                       ('development', 1, 'Simon Says', 'Pratique oralmente o vocabulário 1.', ''),
                       ('development', 2, 'Four Corners', 'Pratique oralmente o vocabulário 1.', ''),
                       ('closure', 1, 'Pictionary', '', 'Review Game'),
                   ])
        self._aula(2, 3, 'culture', 1, 'CLIL Science L2', 'Culture — Healthy Food', bg='floresta',
                   blocos=self._warmup_padrao('Hot Potato') + [
                       ('development', 1, 'Integrated Activities - Science L1',
                        'Discuta comidas saudáveis. Introduza grupos alimentares.',
                        'Integrated Activities Book - Science L2 (P. 67-68)'),
                       ('closure', 1, 'Four Corners', '', 'Review Game'),
                   ])
        # WEEK 3
        self._aula(3, 1, 'content', 1, 'U1L4', 'Vocabulary — Transportation', bg='escola-ext',
                   blocos=self._warmup_padrao('Go and Touch') + [
                       ('development', 1, "Student's Book U1L1", 'Vocabulário com flashcards.',
                        "Student's Book U1L4 (P. 16)"),
                       ('development', 2, 'I Can Routine', '', ''),
                       ('closure', 1, 'Hangman', '', 'Review Game'),
                   ])
        self._aula(3, 2, 'content', 1, 'U1L5', 'Grammar — How often?', bg='quarto',
                   blocos=self._warmup_padrao('Hot Potato') + [
                       ('development', 1, 'Repetition Techniques', 'Drills da estrutura "How often".', ''),
                       ('development', 2, 'I Can Routine', '', ''),
                       ('closure', 1, 'Simon Says', '', 'Review Game'),
                   ],
                   hw='Copiar o Grammar Chart da página 15.')
        self._aula(3, 3, 'culture', 1, 'St. Patrick', "Culture — St. Patrick's Day", bg='floresta',
                   obs="Sugestão: convidar os alunos a vestir verde neste dia.",
                   kickoff="Olá Kevin! Hoje é St. Patrick's Day. Vamos comemorar?",
                   blocos=self._warmup_padrao('Hangman') + [
                       ('development', 1, 'Four Corners',
                        "Jogo: Let's Catch a Leprechaun! Esconda recortes pela sala.", ''),
                       ('closure', 1, 'Go and Touch', '', 'Review Game'),
                   ])
        # WEEK 4
        self._aula(4, 1, 'content', 1, 'U1L6-7', 'CLIL Reading — Around the World', bg='escola-int',
                   blocos=self._warmup_padrao('Go and Touch') + [
                       ('development', 1, "Student's Book U1L1", 'Reading com scanning e skimming.',
                        "Student's Book U1L6 & L7 (P. 18-19)"),
                       ('development', 2, 'I Can Routine', '', ''),
                       ('closure', 1, 'Hangman', '', 'Review Game'),
                   ])
        self._aula(4, 2, 'communication', 1, 'Progress Tracker', 'Communication — Review Games', bg='escola-ext',
                   blocos=self._warmup_padrao('Hot Potato') + [
                       ('development', 1, 'Pictionary', 'Pratique o vocabulário 2.', ''),
                       ('development', 2, 'Four Corners', 'Progress Tracker (P. 21).', ''),
                       ('closure', 1, 'Simon Says', '', 'Review Game'),
                   ])
        self._aula(4, 3, 'content', 1, 'Review', 'Review & Exam Practice', bg='quarto',
                   blocos=self._warmup_padrao('Go and Touch') + [
                       ('development', 1, "Student's Book U1L1", 'Review (P. 22) + Exam Practice (P. 23).', ''),
                       ('closure', 1, 'Hangman', '', 'Review Game'),
                   ],
                   hw='Integrated Activities - Unit 1 (exercises 8 and 9 + Extra Practice)')

        # aula extra de 4x (só aparece para turmas 4x/5x)
        self._aula(2, 4, 'communication', 1, '', 'Extra Communication (4x)', freq=4, bg='escola-ext',
                   obs='Aula extra do TG de 4x — não aparece para turmas 3x.',
                   blocos=self._warmup_padrao('Hot Potato') + [
                       ('development', 1, 'Pictionary', 'Prática oral extra.', ''),
                       ('closure', 1, 'Four Corners', '', ''),
                   ])
        self.stdout.write('  ✓ TG de Março: 12 aulas + 1 extra (4x)')

    # ── Progresso variado (para os relatórios) ──
    def _progresso(self):
        aulas_5a = list(self.turma5a.aulas_do_curriculo())
        # 5A (Maria) está adiantada: 7 aulas dadas
        base = date.today() - timedelta(days=30)
        for i, aula in enumerate(aulas_5a[:7]):
            AulaTurma.objects.get_or_create(
                turma=self.turma5a, aula=aula,
                defaults={'status': 'concluida', 'professor': self.maria,
                          'data_realizada': base + timedelta(days=i * 3),
                          'presentes': 20 + (i % 3)},
            )
        # a 8ª em andamento
        if len(aulas_5a) > 7:
            AulaTurma.objects.get_or_create(
                turma=self.turma5a, aula=aulas_5a[7],
                defaults={'status': 'em_andamento', 'professor': self.maria})

        # 5B (João) está atrasada: só 3 aulas dadas
        aulas_5b = list(self.turma5b.aulas_do_curriculo())
        for i, aula in enumerate(aulas_5b[:3]):
            AulaTurma.objects.get_or_create(
                turma=self.turma5b, aula=aula,
                defaults={'status': 'concluida', 'professor': self.joao,
                          'data_realizada': base + timedelta(days=i * 5),
                          'presentes': 17 + (i % 2)},
            )
        self.stdout.write('  ✓ Progresso: 5A adiantada (7 aulas), 5B atrasada (3 aulas)')

    def _final(self):
        self.stdout.write(self.style.SUCCESS(
            '\n✅ Dados de APRESENTAÇÃO prontos! Siga docs/ROTEIRO_APRESENTACAO.md\n\n'
            '  admin  / admin123  → Django Admin (currículo)\n'
            '  coord  / coord123  → Coordenador Bebelingue\n'
            '  carlos / dir123    → Diretor Bernoulli (relatórios)\n'
            '  maria  / prof123   → Professora Year 5A (adiantada)\n'
            '  joao   / prof123   → Professor Year 5B (atrasado, 4x)\n'
        ))
