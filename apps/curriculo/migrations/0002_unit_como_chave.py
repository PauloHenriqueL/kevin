"""A chave da aula passa a ser a Unit, não o mês (D27 — revoga a D2).

O TG completo do Y5 mostrou que o código impresso na apostila é `U1W1C1`:
Unit + Week + Class. O mês aparece só na faixa lateral da grade, como contexto
de calendário. A D2 tinha decidido o contrário a partir do CSV de março — uma
amostra de um mês só, que dava a impressão de que o mês era o eixo.

Cuidado ao ler esta migração: `unit` muda de inteiro para texto, e uma
conversão direta transformaria `1` em `"1"`, gerando o código `Y5-1W1C1`. Por
isso a coluna é renomeada, a nova é criada, e os valores são traduzidos
(`1` → `"U1"`) antes de a antiga ser removida.
"""

from django.db import migrations, models

from apps.curriculo.models import montar_codigo_aula, ordem_da_unit


def numero_para_sigla(apps, schema_editor):
    """Traduz a unit numérica antiga para a sigla do TG e regera o código."""
    Aula = apps.get_model('curriculo', 'Aula')

    for aula in Aula.objects.all():
        # Aulas sem unit definida caem na Welcome Unit, que abre o ano.
        numero = aula.unit_numerica
        aula.unit = f'U{numero}' if numero else 'WU'
        aula.ordem_unit = ordem_da_unit(aula.unit)
        aula.codigo = montar_codigo_aula(
            aula.year, aula.unit, aula.semana, aula.numero_aula
        )
        aula.save(update_fields=['unit', 'ordem_unit', 'codigo'])


def sigla_para_numero(apps, schema_editor):
    """Volta a unit para número e o código para o formato por mês."""
    Aula = apps.get_model('curriculo', 'Aula')
    siglas = {1: 'JAN', 2: 'FEB', 3: 'MAR', 4: 'APR', 5: 'MAY', 6: 'JUN',
              7: 'JUL', 8: 'AUG', 9: 'SEP', 10: 'OCT', 11: 'NOV', 12: 'DEC'}

    for aula in Aula.objects.all():
        digitos = ''.join(c for c in (aula.unit or '') if c.isdigit())
        aula.unit_numerica = int(digitos) if digitos else None
        sigla = siglas.get(aula.mes, '???')
        aula.codigo = f'Y{aula.year}-{sigla}-W{aula.semana}C{aula.numero_aula}'
        aula.save(update_fields=['unit_numerica', 'codigo'])


class Migration(migrations.Migration):

    dependencies = [
        ('curriculo', '0001_initial'),
    ]

    operations = [
        # A unicidade antiga sai antes de o eixo mudar.
        migrations.AlterUniqueTogether(
            name='aula',
            unique_together=set(),
        ),

        # Preserva a unit numérica enquanto a nova é preenchida.
        migrations.RenameField(
            model_name='aula',
            old_name='unit',
            new_name='unit_numerica',
        ),
        migrations.AddField(
            model_name='aula',
            name='unit',
            field=models.CharField(
                default='U1',
                max_length=5,
                help_text=(
                    'Unit como aparece no TG: U1, U2… WU para a Welcome Unit '
                    'e JU para a de junho. Digite exatamente a sigla da apostila.'
                ),
            ),
        ),
        migrations.AddField(
            model_name='aula',
            name='ordem_unit',
            field=models.PositiveIntegerField(
                default=1,
                editable=False,
                help_text='Posição da unit no ano. Calculado a partir da sigla.',
            ),
        ),

        migrations.RunPython(numero_para_sigla, sigla_para_numero),

        migrations.RemoveField(
            model_name='aula',
            name='unit_numerica',
        ),

        # O mês vira descritivo: continua no modelo pela faixa de calendário
        # do TG, mas deixa de endereçar a aula.
        migrations.AlterField(
            model_name='aula',
            name='mes',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                choices=[(1, 'Janeiro'), (2, 'Fevereiro'), (3, 'Março'),
                         (4, 'Abril'), (5, 'Maio'), (6, 'Junho'),
                         (7, 'Julho'), (8, 'Agosto'), (9, 'Setembro'),
                         (10, 'Outubro'), (11, 'Novembro'), (12, 'Dezembro')],
                help_text='Mês em que esta unit costuma cair. Só contexto — não é a chave.',
            ),
        ),
        migrations.AlterField(
            model_name='aula',
            name='codigo',
            field=models.CharField(
                editable=False,
                unique=True,
                max_length=30,
                help_text='Gerado automaticamente. Ex: Y5-U1W1C1',
            ),
        ),
        migrations.AlterField(
            model_name='aula',
            name='semana',
            field=models.PositiveIntegerField(
                default=1,
                help_text='Semana dentro da unit: 1 a 5 (WEEK 1, WEEK 2… no TG).',
            ),
        ),
        # CLIL entra como natureza de aula (D28).
        migrations.AlterField(
            model_name='aula',
            name='tipo',
            field=models.CharField(
                max_length=20,
                default='content',
                choices=[('content', 'Content Class'),
                         ('communication', 'Communication Class'),
                         ('culture', 'Culture Class'),
                         ('clil', 'CLIL Class'),
                         ('extra', 'Extra Class / Festival')],
                help_text='Define o formato do roteiro e o que o Kevin espera da aula.',
            ),
        ),

        migrations.AlterModelOptions(
            name='aula',
            options={
                'ordering': ['year', 'ordem_unit', 'semana', 'numero_aula'],
                'verbose_name': 'Aula (TG)',
                'verbose_name_plural': 'Aulas (TG)',
            },
        ),
        migrations.AlterUniqueTogether(
            name='aula',
            unique_together={('year', 'unit', 'semana', 'numero_aula')},
        ),
    ]
