from django.db import migrations


def escola_para_diretor(apps, schema_editor):
    """Renomeia o papel 'escola' -> 'diretor'.

    O valor antigo designava o diretor da escola cliente, mas divergia do resto
    do projeto (modelo Diretor, templates, documentação), que sempre falou em
    "diretor". Ver Demanda 2 em demandas.md.
    """
    User = apps.get_model('accounts', 'User')
    User.objects.filter(role='escola').update(role='diretor')


def diretor_para_escola(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.filter(role='diretor').update(role='escola')


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_alter_user_role'),
    ]

    operations = [
        migrations.RunPython(escola_para_diretor, diretor_para_escola),
    ]
