from rest_framework import serializers

from .models import Atividade, Aula, AulaTurma, BlocoAula, Homework


class AtividadeSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    eh_oficial = serializers.BooleanField(read_only=True)

    class Meta:
        model = Atividade
        fields = [
            'id', 'tipo', 'tipo_display', 'nome', 'descricao', 'como_conduzir',
            'objetivo_pedagogico', 'materiais', 'duracao_estimada',
            'arquivo_url', 'tags', 'escola', 'eh_oficial', 'created_at',
        ]
        read_only_fields = ['created_at']


class BlocoAulaSerializer(serializers.ModelSerializer):
    atividade_detail = AtividadeSerializer(source='atividade', read_only=True)
    fase_display = serializers.CharField(source='get_fase_display', read_only=True)
    rotulo = serializers.CharField(read_only=True)

    class Meta:
        model = BlocoAula
        fields = [
            'id', 'aula', 'fase', 'fase_display', 'ordem', 'atividade',
            'atividade_detail', 'titulo', 'rotulo', 'instrucoes', 'referencia',
        ]


class HomeworkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Homework
        fields = ['id', 'aula', 'descricao']


class AulaListSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    mes_display = serializers.CharField(source='get_mes_display', read_only=True)

    class Meta:
        model = Aula
        fields = [
            'id', 'codigo', 'titulo', 'year', 'unit', 'mes', 'mes_display',
            'semana', 'numero_aula', 'tipo', 'tipo_display', 'frequencia_minima',
        ]


class AulaSerializer(serializers.ModelSerializer):
    blocos = BlocoAulaSerializer(many=True, read_only=True)
    homeworks = HomeworkSerializer(many=True, read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    mes_display = serializers.CharField(source='get_mes_display', read_only=True)

    class Meta:
        model = Aula
        fields = [
            'id', 'codigo', 'year', 'unit', 'mes', 'mes_display', 'semana',
            'numero_aula', 'tipo', 'tipo_display', 'frequencia_minima',
            'lesson', 'titulo', 'observacao', 'kickoff', 'background',
            'blocos', 'homeworks',
        ]
        read_only_fields = ['codigo']


class AulaTurmaSerializer(serializers.ModelSerializer):
    aula_codigo = serializers.CharField(source='aula.codigo', read_only=True)
    aula_titulo = serializers.CharField(source='aula.titulo', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AulaTurma
        fields = [
            'id', 'turma', 'aula', 'aula_codigo', 'aula_titulo',
            'status', 'status_display', 'data_realizada', 'professor',
            'presentes', 'observacoes', 'updated_at',
        ]
        read_only_fields = ['updated_at']
