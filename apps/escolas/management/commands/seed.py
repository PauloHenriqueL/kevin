from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.curriculo.models import Atividade, Aula, AulaTurma, BlocoAula, Homework
from apps.escolas.models import Diretor, Escola, Plano, Professor, Turma


class Command(BaseCommand):
    help = 'Popula o banco com dados de DEMONSTRAÇÃO no schema novo (Demanda 1).'

    def handle(self, *args, **kwargs):
        self.stdout.write('Criando dados de demonstração...\n')

        # ── Plano ──
        plano, _ = Plano.objects.get_or_create(
            nome='Básico',
            defaults={
                'valor_mensal': 199.90,
                'ia_provider': 'anthropic',
                'ia_modelo': 'claude-sonnet-4-20250514',
                'ia_api_key': 'sk-test-key',
                'tts_provider': 'elevenlabs',
                'tts_api_key': 'tts-test-key',
                'tts_voice_id': '21m00Tcm4TlvDq8ikWAM',
                'tts_modelo': 'eleven_multilingual_v2',
                'stt_provider': 'openai_whisper',
                'stt_api_key': 'stt-test-key',
            },
        )

        # ── Escolas ──
        escola, _ = Escola.objects.get_or_create(
            slug='bernoulli',
            defaults={'nome': 'Colégio Bernoulli', 'plano': plano},
        )
        escola2, _ = Escola.objects.get_or_create(
            slug='paulo-freire',
            defaults={'nome': 'Escola Paulo Freire', 'plano': plano},
        )

        # ── Admin ──
        admin, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'role': 'admin', 'first_name': 'Admin', 'last_name': 'Bebelingue',
                'email': 'admin@bebelingue.com', 'is_staff': True, 'is_superuser': True,
            },
        )
        if created:
            admin.set_password('admin123')
            admin.save()

        # ── Coordenador Bebelingue ──
        coord, created = User.objects.get_or_create(
            username='coord',
            defaults={
                'role': 'coordenador', 'first_name': 'Coordenação',
                'last_name': 'Bebelingue', 'email': 'coord@bebelingue.com',
                'is_staff': True,
            },
        )
        if created:
            coord.set_password('coord123')
            coord.save()

        # ── Diretor ──
        dir_user, created = User.objects.get_or_create(
            username='carlos',
            defaults={
                'role': 'diretor', 'first_name': 'Carlos', 'last_name': 'Oliveira',
                'email': 'carlos@bernoulli.com',
            },
        )
        if created:
            dir_user.set_password('dir123')
            dir_user.save()
        Diretor.objects.get_or_create(user=dir_user, defaults={'escola': escola})

        # ── Professor ──
        prof_user, created = User.objects.get_or_create(
            username='maria',
            defaults={
                'role': 'professor', 'first_name': 'Maria', 'last_name': 'Silva',
                'email': 'maria@bernoulli.com',
            },
        )
        if created:
            prof_user.set_password('prof123')
            prof_user.save()
        maria, _ = Professor.objects.get_or_create(
            user=prof_user, defaults={'escola': escola}
        )

        # ── TG, Série e Turma (Year 5, 3x) — D31/D32 ──
        from apps.curriculo.models import TG
        from apps.escolas.models import Serie
        tg, _ = TG.objects.get_or_create(
            year=5, frequencia=3, defaults={'nome': 'TG 3x — Year 5'})
        self.tg = tg
        serie, _ = Serie.objects.get_or_create(
            escola=escola, nome='Fundamental', defaults={'year': 5, 'tg': tg})
        turma, _ = Turma.objects.get_or_create(
            escola=escola, year=5, nome='A',
            defaults={'professor': maria, 'qtd_alunos': 20, 'serie': serie},
        )
        self.stdout.write(f'  Turma: {turma}')

        # ── Catálogo de atividades (oficial Bebelingue) ──
        atividades = {}
        catalogo = [
            ('rotina', 'BeCalendar', 'Rotina de abertura trabalhando data e calendário em inglês.',
             'Pergunte o dia da semana, o mês e o clima. Faça a turma responder em inglês.'),
            ('rotina', 'Songs Collection', 'Coletânea de músicas da metodologia.',
             'Toque uma música da coletânea e cante junto com a turma.'),
            ('rotina', 'I Can Routine', 'Ritual de fim de atividade.',
             'Peça aos alunos que marquem a caixa "I can" no rodapé da página e escrevam a data.'),
            ('tecnica', 'Sandwich Technique', 'Diz em inglês, traduz, repete em inglês.',
             'Leia a frase em inglês, diga em português, e repita em inglês para garantir compreensão.'),
            ('tecnica', 'Repetition Techniques', 'Repetição em escada, nível de frase.',
             '3 grupos grandes → 3 grupos pequenos → 4 técnicas individuais. Sempre em frase, nunca palavra solta.'),
            ('jogo', 'Go and Touch', 'Jogo de vocabulário com movimento.',
             'Diga "Go and touch the..." e a turma corre até o objeto correspondente.'),
            ('jogo', 'Hangman', 'Jogo da forca para revisar vocabulário.',
             'Desenhe traços para cada letra de uma palavra e a turma adivinha letra por letra.'),
            ('jogo', 'Simon Says', 'Jogo de comandos e escuta.',
             'Dê comandos começando com "Simon says". A turma só obedece se você disser "Simon says" antes.'),
            ('recurso', "Student's Book U1L1", 'Livro do aluno, Unit 1 Lesson 1.',
             '', 'https://exemplo.com/sb-u1l1'),
        ]
        for item in catalogo:
            tipo, nome, desc, como = item[0], item[1], item[2], item[3]
            url = item[4] if len(item) > 4 else ''
            a, _ = Atividade.objects.get_or_create(
                nome=nome, escola=None,
                defaults={
                    'tipo': tipo, 'descricao': desc, 'como_conduzir': como,
                    'arquivo_url': url, 'criado_por': coord,
                },
            )
            atividades[nome] = a
        self.stdout.write(f'  Catálogo: {len(atividades)} atividades oficiais')

        # ── Aula real do TG (Y5-U1W1C1, Content Class) ──
        aula, _ = Aula.objects.get_or_create(
            tg=tg, unit='U1', semana=1, numero_aula=1,
            defaults={
                'tipo': 'content', 'mes': 3, 'lesson': 'U1L1',
                'titulo': 'Share It! — Daily Routines',
                'background': 'quarto',
            },
        )
        # Roteiro (blocos)
        roteiro = [
            ('warm_up', 1, 'BeCalendar', '', ''),
            ('warm_up', 2, 'Songs Collection', '', ''),
            ('warm_up', 3, 'Go and Touch', '', 'HW Correction / Practice Game'),
            ('development', 1, "Student's Book U1L1", 'Explore a imagem da página.\nIntroduza o vocabulário com Repetition Techniques.', "Student's Book U1L1 (P. 10-11)"),
            ('development', 2, 'I Can Routine', '', ''),
            ('closure', 1, 'Hangman', '', 'Review Game'),
        ]
        for fase, ordem, ativ_nome, instr, ref in roteiro:
            BlocoAula.objects.get_or_create(
                aula=aula, fase=fase, ordem=ordem,
                defaults={
                    'atividade': atividades.get(ativ_nome),
                    'instrucoes': instr, 'referencia': ref,
                },
            )
        Homework.objects.get_or_create(
            aula=aula,
            descricao='Integrated Activities - Unit 1 (exercises 1 and 2)',
        )
        self.stdout.write(f'  Aula: {aula.codigo} com {aula.blocos.count()} blocos')

        # ── Execução: turma já deu a primeira aula ──
        AulaTurma.objects.get_or_create(
            turma=turma, aula=aula,
            defaults={'status': 'em_andamento', 'professor': maria},
        )

        self.stdout.write(self.style.SUCCESS(
            '\n✅ Dados de demonstração criados!\n\n'
            'Usuários:\n'
            '  admin   / admin123  → Django Admin (superusuário)\n'
            '  coord   / coord123  → Coordenador Bebelingue (cadastra o TG)\n'
            '  carlos  / dir123    → Diretor Bernoulli (gestão)\n'
            '  maria   / prof123   → Professora (Bernoulli — Year 5A)\n'
        ))
