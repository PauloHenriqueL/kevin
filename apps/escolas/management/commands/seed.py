from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.curriculo.models import Aula, AulaConteudo, Conteudo, Homework
from apps.escolas.models import Aluno, Diretor, Escola, Plano, Professor, Turma


class Command(BaseCommand):
    help = 'Popula o banco com dados de teste para o Bebelingue'

    def handle(self, *args, **kwargs):
        self.stdout.write('Criando dados de teste...\n')

        # ── Plano ──
        plano_basico, _ = Plano.objects.get_or_create(
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
        plano_premium, _ = Plano.objects.get_or_create(
            nome='Premium',
            defaults={
                'valor_mensal': 399.90,
                'ia_provider': 'openai',
                'ia_modelo': 'gpt-4o',
                'ia_api_key': 'sk-test-key',
                'tts_provider': 'openai_tts',
                'tts_api_key': 'tts-test-key',
                'tts_voice_id': '',
                'tts_modelo': 'alloy',
                'stt_provider': 'openai_whisper',
                'stt_api_key': 'stt-test-key',
            },
        )
        self.stdout.write(f'  Planos: {plano_basico}, {plano_premium}')

        # ── Escola ──
        escola, _ = Escola.objects.get_or_create(
            slug='happy-kids',
            defaults={'nome': 'Happy Kids School', 'plano': plano_basico},
        )
        escola2, _ = Escola.objects.get_or_create(
            slug='little-stars',
            defaults={'nome': 'Little Stars Academy', 'plano': plano_premium},
        )
        self.stdout.write(f'  Escolas: {escola}, {escola2}')

        # ── Usuário Admin ──
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'role': 'admin',
                'first_name': 'Admin',
                'last_name': 'Bebelingue',
                'email': 'admin@bebelingue.com',
                'is_staff': True,
                'is_superuser': True,
            },
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.save()
        self.stdout.write(f'  Admin: admin / admin123')

        # ── Diretores ──
        dir_data = [
            ('carlos', 'Carlos', 'Oliveira', 'carlos@happykids.com', escola),
            ('lucia', 'Lúcia', 'Mendes', 'lucia@littlestars.com', escola2),
        ]
        for username, first, last, email, esc in dir_data:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'role': 'escola',
                    'first_name': first,
                    'last_name': last,
                    'email': email,
                },
            )
            if created:
                user.set_password('dir123')
                user.save()
            Diretor.objects.get_or_create(
                user=user,
                defaults={'escola': esc},
            )
            self.stdout.write(f'  Diretor: {username} / dir123 ({esc.nome})')

        # ── Professores ──
        prof_data = [
            ('maria', 'Maria', 'Silva', 'maria@escola.com', escola),
            ('joao', 'João', 'Santos', 'joao@escola.com', escola),
            ('ana', 'Ana', 'Costa', 'ana@escola.com', escola2),
        ]
        professores = []
        for username, first, last, email, esc in prof_data:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'role': 'professor',
                    'first_name': first,
                    'last_name': last,
                    'email': email,
                },
            )
            if created:
                user.set_password('prof123')
                user.save()

            prof, _ = Professor.objects.get_or_create(
                user=user,
                defaults={'escola': esc},
            )
            professores.append(prof)
            self.stdout.write(f'  Professor: {username} / prof123 ({esc.nome})')

        maria, joao, ana = professores

        # ── Turmas ──
        turmas_data = [
            (1, 'A', escola, maria),
            (1, 'B', escola, maria),
            (2, 'A', escola, joao),
            (1, 'A', escola2, ana),
        ]
        turmas = []
        for year, nome, esc, prof in turmas_data:
            turma, _ = Turma.objects.get_or_create(
                escola=esc, year=year, nome=nome,
                defaults={'professor': prof},
            )
            turmas.append(turma)
        self.stdout.write(f'  Turmas: {len(turmas)} criadas')

        # ── Alunos ──
        nomes_alunos = [
            'Lucas', 'Sofia', 'Miguel', 'Helena', 'Arthur',
            'Valentina', 'Bernardo', 'Laura', 'Pedro', 'Alice',
            'Gabriel', 'Manuela', 'Rafael', 'Julia', 'Enzo',
        ]
        for turma in turmas:
            for i, nome in enumerate(nomes_alunos[:8]):
                Aluno.objects.get_or_create(
                    nome=f'{nome} {turma.nome}{i+1}',
                    turma=turma,
                )
        self.stdout.write(f'  Alunos: 8 por turma')

        # ── Aulas Year 1 ──
        aulas_y1 = [
            ('Hello Song', 'Primeira aula de introdução. Os alunos aprendem a se apresentar em inglês usando a música "Hello, what\'s your name?". Foco em cumprimentos básicos: Hello, Hi, Good morning, Good afternoon. Praticar pronúncia e ritmo com a canção.'),
            ('Colors', 'Aula sobre cores primárias e secundárias em inglês. Red, Blue, Yellow, Green, Orange, Purple, Pink, Black, White, Brown. Atividades de identificação de cores em objetos da sala de aula e colorir.'),
            ('Numbers 1-10', 'Aprender a contar de 1 a 10 em inglês. One, Two, Three, Four, Five, Six, Seven, Eight, Nine, Ten. Músicas de contagem, jogos com dados e atividades de correspondência número-palavra.'),
            ('Animals', 'Vocabulário de animais domésticos e da fazenda. Dog, Cat, Bird, Fish, Cow, Pig, Horse, Chicken, Duck, Rabbit. Sons dos animais em inglês e jogo de mímica.'),
            ('My Body', 'Partes do corpo em inglês. Head, Shoulders, Knees, Toes, Eyes, Ears, Mouth, Nose, Hands, Feet. Música "Head, Shoulders, Knees and Toes" com movimentos.'),
            ('Food & Fruits', 'Frutas e alimentos básicos. Apple, Banana, Orange, Grape, Strawberry, Bread, Milk, Water, Juice, Rice. Expressões: "I like...", "I don\'t like...". Atividade de cardápio.'),
        ]

        aulas_y2 = [
            ('Family Members', 'Membros da família em inglês. Mother, Father, Sister, Brother, Grandmother, Grandfather, Uncle, Aunt, Cousin. Construir árvore genealógica e apresentar "This is my...".'),
            ('Clothes', 'Roupas e acessórios. T-shirt, Pants, Dress, Shoes, Hat, Jacket, Socks, Skirt. Expressões: "I\'m wearing...", "Put on your...". Desfile de moda na sala de aula.'),
            ('Weather', 'Clima e estações do ano. Sunny, Rainy, Cloudy, Windy, Hot, Cold, Snow. "How\'s the weather today?", "It\'s sunny!". Calendário do clima semanal.'),
            ('Classroom Objects', 'Objetos da sala de aula. Book, Pencil, Eraser, Ruler, Scissors, Glue, Notebook, Backpack, Desk, Chair. "Can I have a...?", "Where is the...?".'),
        ]

        # Para demo: U1W1C{class_num} — mesma unit/week, classes 1..N
        for year, aulas_data in [(1, aulas_y1), (2, aulas_y2)]:
            for class_num, (titulo, descricao) in enumerate(aulas_data, 1):
                Aula.objects.get_or_create(
                    year=year,
                    unit=1,
                    week=1,
                    class_num=class_num,
                    defaults={
                        'titulo': titulo,
                        'descricao': descricao,
                        'warm_up': (
                            f'Cumprimente a turma de forma animada em inglês. '
                            f'Introduza o tema "{titulo}" com uma pergunta curta '
                            f'ou uma música de abertura. Ative o conhecimento prévio '
                            f'dos alunos sobre o assunto.'
                        ),
                        'development': descricao,
                        'closure': (
                            f'Revise rapidamente o vocabulário principal de "{titulo}". '
                            f'Peça para 2-3 alunos usarem uma frase em inglês com o que '
                            f'aprenderam. Conduza a música de despedida.'
                        ),
                    },
                )
        self.stdout.write(f'  Aulas: {len(aulas_y1)} (Year 1) + {len(aulas_y2)} (Year 2)')

        # ── Conteúdos ──
        conteudos_data = [
            ('Hello Song - Música', 'Música de boas-vindas para a aula de Hello', 'musica', 'https://example.com/hello-song.mp3'),
            ('Hello Song - Vídeo', 'Vídeo animado com personagens cumprimentando', 'video', 'https://example.com/hello-video.mp4'),
            ('Colors Flashcards', 'Imagens de flashcards com cores', 'imagem', 'https://example.com/colors-flashcards.pdf'),
            ('Colors Song', 'Música das cores - I see red, I see blue', 'musica', 'https://example.com/colors-song.mp3'),
            ('Numbers Song 1-10', 'One two three four five, once I caught a fish alive', 'musica', 'https://example.com/numbers-song.mp3'),
            ('Numbers Worksheet', 'Folha de atividade para escrever números', 'texto', 'https://example.com/numbers-worksheet.pdf'),
            ('Animal Sounds', 'Áudio com sons dos animais em inglês', 'audio', 'https://example.com/animal-sounds.mp3'),
            ('Animals Video', 'Vídeo Old MacDonald Had a Farm', 'video', 'https://example.com/animals-video.mp4'),
            ('Body Parts Song', 'Head Shoulders Knees and Toes - versão animada', 'musica', 'https://example.com/body-parts.mp3'),
            ('Body Parts Poster', 'Poster com partes do corpo ilustradas', 'imagem', 'https://example.com/body-poster.jpg'),
            ('Fruits Flashcards', 'Flashcards com fotos reais de frutas', 'imagem', 'https://example.com/fruits-flashcards.pdf'),
            ('I Like Food Song', 'Música sobre preferências alimentares', 'musica', 'https://example.com/food-song.mp3'),
        ]

        conteudos = []
        for titulo, descricao, tipo, url in conteudos_data:
            c, _ = Conteudo.objects.get_or_create(
                titulo=titulo,
                defaults={
                    'descricao': descricao,
                    'tipo': tipo,
                    'arquivo_url': url,
                    'criado_por': maria,
                },
            )
            conteudos.append(c)
        self.stdout.write(f'  Conteúdos: {len(conteudos)} criados')

        # ── Vincular conteúdos às aulas ──
        aulas = list(Aula.objects.filter(year=1).order_by('ordem'))
        vinculos = [
            (aulas[0], [conteudos[0], conteudos[1]]),         # Hello Song
            (aulas[1], [conteudos[2], conteudos[3]]),         # Colors
            (aulas[2], [conteudos[4], conteudos[5]]),         # Numbers
            (aulas[3], [conteudos[6], conteudos[7]]),         # Animals
            (aulas[4], [conteudos[8], conteudos[9]]),         # Body
            (aulas[5], [conteudos[10], conteudos[11]]),       # Food
        ]
        for aula, contents in vinculos:
            for ordem, conteudo in enumerate(contents, 1):
                AulaConteudo.objects.get_or_create(
                    aula=aula,
                    conteudo=conteudo,
                    defaults={'ordem': ordem},
                )
        self.stdout.write(f'  Conteúdos vinculados às aulas')

        # ── Homeworks ──
        hw_data = [
            (aulas[0], 'Praticar cumprimentos com a família', 'Hello, Hi, Good morning, Goodbye', 'Greetings'),
            (aulas[1], 'Identificar 5 cores de objetos em casa', 'Red, Blue, Yellow, Green, Purple', 'Colors: What color is it?'),
            (aulas[2], 'Contar objetos em casa de 1 a 10', 'One through Ten', 'How many...? There are...'),
            (aulas[3], 'Desenhar e nomear 3 animais', 'Dog, Cat, Bird, Fish, Cow', 'I have a... It says...'),
            (aulas[4], 'Apontar partes do corpo em frente ao espelho', 'Head, Shoulders, Knees, Toes, Eyes', 'Touch your... This is my...'),
            (aulas[5], 'Listar 3 comidas favoritas em inglês', 'Apple, Banana, Bread, Milk, Rice', 'I like... I don\'t like...'),
        ]
        for aula, objetivo, vocab, gram in hw_data:
            Homework.objects.get_or_create(
                aula=aula,
                objetivo=objetivo,
                defaults={'vocabulario': vocab, 'gramatica': gram},
            )
        self.stdout.write(f'  Homeworks: {len(hw_data)} criados')

        self.stdout.write(self.style.SUCCESS(
            '\n✅ Dados de teste criados com sucesso!\n\n'
            'Usuários disponíveis:\n'
            '  admin   / admin123  → Django Admin (superusuário)\n'
            '  carlos  / dir123    → Diretor Happy Kids (gestão)\n'
            '  lucia   / dir123    → Diretora Little Stars (gestão)\n'
            '  maria   / prof123   → Professora (Happy Kids - Year 1A, 1B)\n'
            '  joao    / prof123   → Professor (Happy Kids - Year 2A)\n'
            '  ana     / prof123   → Professora (Little Stars - Year 1A)\n'
        ))
