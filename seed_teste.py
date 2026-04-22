from apps.accounts.models import User
from apps.escolas.models import Plano, Escola, Diretor, Professor, Turma, Aluno
from apps.curriculo.models import Aula

plano = Plano.objects.get(nome='Básico')

escola, _ = Escola.objects.get_or_create(
    slug='escola-teste',
    defaults={'nome': 'Escola Teste Bebelingue', 'plano': plano, 'ativa': True},
)

admin, created = User.objects.get_or_create(
    username='teste_admin',
    defaults={'first_name': 'Ana', 'last_name': 'Silva',
              'email': 'teste_admin@bebelingue.com',
              'role': 'admin', 'is_staff': True, 'is_superuser': True},
)
if created:
    admin.set_password('teste123')
    admin.save()
print("admin: teste_admin / teste123 (superuser) -", "criado" if created else "ja existia")

dir_user, created = User.objects.get_or_create(
    username='teste_diretor',
    defaults={'first_name': 'Roberto', 'last_name': 'Mendes',
              'email': 'roberto@escolateste.com', 'role': 'escola'},
)
if created:
    dir_user.set_password('teste123')
    dir_user.save()
diretor, _ = Diretor.objects.get_or_create(user=dir_user, defaults={'escola': escola})
print("diretor: teste_diretor / teste123 - escola:", escola.nome, "-", "criado" if created else "ja existia")

prof_user, created = User.objects.get_or_create(
    username='teste_prof',
    defaults={'first_name': 'Fernanda', 'last_name': 'Costa',
              'email': 'fernanda@escolateste.com', 'role': 'professor'},
)
if created:
    prof_user.set_password('teste123')
    prof_user.save()
professor, _ = Professor.objects.get_or_create(user=prof_user, defaults={'escola': escola, 'ativo': True})
print("professor: teste_prof / teste123 - escola:", escola.nome, "-", "criado" if created else "ja existia")

turma, _ = Turma.objects.get_or_create(
    year=1, nome='Teste-A', escola=escola,
    defaults={'professor': professor},
)
print("turma: Year", turma.year, turma.nome, "(id=" + str(turma.id) + ")")

alunos_exemplo = [
    'Pedro Henrique', 'Julia Santos', 'Gabriel Oliveira',
    'Sofia Martins', 'Lucas Almeida', 'Beatriz Ferreira',
]
for nome in alunos_exemplo:
    Aluno.objects.get_or_create(nome=nome, turma=turma)
print("alunos na turma:", Aluno.objects.filter(turma=turma).count())
