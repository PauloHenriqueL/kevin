from django.db import migrations, models


def backfill_codigos(apps, schema_editor):
    """Converte aulas existentes: class_num = ordem antigo, regenera codigo."""
    Aula = apps.get_model('curriculo', 'Aula')
    for aula in Aula.objects.all():
        aula.class_num = aula.ordem or 1
        aula.unit = 1
        aula.week = 1
        aula.codigo = f'Y{aula.year}U{aula.unit}W{aula.week}C{aula.class_num}'
        aula.save(update_fields=['unit', 'week', 'class_num', 'codigo'])


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('curriculo', '0003_aula_closure_aula_development_aula_warm_up_and_more'),
    ]

    operations = [
        # 1. Adiciona os novos campos com default 1 (sem constraints ainda)
        migrations.AddField(
            model_name='aula',
            name='unit',
            field=models.IntegerField(default=1, help_text='Unit dentro do Year'),
        ),
        migrations.AddField(
            model_name='aula',
            name='week',
            field=models.IntegerField(default=1, help_text='Week dentro da Unit'),
        ),
        migrations.AddField(
            model_name='aula',
            name='class_num',
            field=models.IntegerField(default=1, help_text='Class dentro da Week'),
        ),

        # 2. Relaxa codigo para aumentar tamanho e permitir regeneração
        migrations.AlterField(
            model_name='aula',
            name='codigo',
            field=models.CharField(
                max_length=20,
                unique=True,
                editable=False,
                help_text='Gerado automaticamente no formato Y1U1W1C1.',
            ),
        ),

        # 3. Remove o unique_together antigo (year, ordem) ANTES de dropar 'ordem'
        migrations.AlterUniqueTogether(
            name='aula',
            unique_together=set(),
        ),

        # 4. Backfill: usa ordem antigo como class_num e regenera codigo
        migrations.RunPython(backfill_codigos, reverse_noop),

        # 5. Remove o campo ordem
        migrations.RemoveField(
            model_name='aula',
            name='ordem',
        ),

        # 6. Novo unique_together + ordering
        migrations.AlterUniqueTogether(
            name='aula',
            unique_together={('year', 'unit', 'week', 'class_num')},
        ),
        migrations.AlterModelOptions(
            name='aula',
            options={
                'ordering': ['year', 'unit', 'week', 'class_num'],
                'verbose_name': 'Aula',
                'verbose_name_plural': 'Aulas',
            },
        ),
    ]
