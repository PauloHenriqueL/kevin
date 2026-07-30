"""Migração de dados: liga o currículo existente às novas entidades TG e Série.

Antes desta remodelagem (D31/D32), a aula era global por `year`+`frequencia_minima`
e a turma tinha `year`+`aulas_por_semana` soltos. Agora:

- cada (year, frequência) das aulas existentes vira um **TG** nomeado, e as
  aulas são religadas a ele;
- cada turma ganha uma **Série** (uma por escola) que aponta para o TG
  correspondente à sua frequência.

Reversível: o reverse solta os vínculos (as entidades novas somem no rollback
do schema).
"""

from django.db import migrations


NOMES_FREQ = {3: '3x', 4: '4x', 5: '5x'}


def _tg_de(TG, year, freq):
    tg, _ = TG.objects.get_or_create(
        year=year,
        frequencia=freq,
        defaults={'nome': f'TG {NOMES_FREQ.get(freq, freq)} — Year {year}'},
    )
    return tg


def criar_tg_e_series(apps, schema_editor):
    TG = apps.get_model('curriculo', 'TG')
    Aula = apps.get_model('curriculo', 'Aula')
    Serie = apps.get_model('escolas', 'Serie')
    Turma = apps.get_model('escolas', 'Turma')

    # 1) Religa cada aula ao TG da sua (year, frequência). No MVP (Y5 3x), todas
    #    caem no mesmo TG.
    for aula in Aula.objects.all():
        aula.tg = _tg_de(TG, aula.year, aula.frequencia_minima or 3)
        aula.save(update_fields=['tg'])

    # 2) Uma série por turma (nomeada pelo year+frequência), apontando para o TG.
    for turma in Turma.objects.all():
        freq = turma.aulas_por_semana or 3
        tg = _tg_de(TG, turma.year, freq)
        serie, _ = Serie.objects.get_or_create(
            escola=turma.escola,
            nome=f'Year {turma.year} ({NOMES_FREQ.get(freq, freq)})',
            defaults={'year': turma.year, 'tg': tg},
        )
        if serie.tg_id is None:
            serie.tg = tg
            serie.save(update_fields=['tg'])
        turma.serie = serie
        turma.save(update_fields=['serie'])


def desfazer(apps, schema_editor):
    Turma = apps.get_model('escolas', 'Turma')
    Aula = apps.get_model('curriculo', 'Aula')
    Serie = apps.get_model('escolas', 'Serie')
    Turma.objects.update(serie=None)
    Aula.objects.update(tg=None)
    Serie.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('escolas', '0002_alter_turma_aulas_por_semana_alter_turma_year_serie_and_more'),
        ('curriculo', '0003_alter_aula_codigo_alter_aula_frequencia_minima_and_more'),
    ]

    operations = [
        migrations.RunPython(criar_tg_e_series, desfazer),
    ]
