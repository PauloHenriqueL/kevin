from rest_framework import serializers

from .models import Aula, AulaConteudo, Conteudo, Homework, ProgressoTurma


class ConteudoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    criado_por_nome = serializers.CharField(
        source='criado_por.user.get_full_name', read_only=True,
    )

    class Meta:
        model = Conteudo
        fields = (
            'id', 'titulo', 'descricao', 'tipo', 'tipo_display',
            'arquivo_url', 'criado_por', 'criado_por_nome', 'created_at',
        )
        read_only_fields = ('id', 'criado_por', 'created_at')


class AulaConteudoSerializer(serializers.ModelSerializer):
    conteudo_detail = ConteudoSerializer(source='conteudo', read_only=True)

    class Meta:
        model = AulaConteudo
        fields = ('id', 'aula', 'conteudo', 'ordem', 'conteudo_detail')
        read_only_fields = ('id',)


class HomeworkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Homework
        fields = ('id', 'aula', 'objetivo', 'vocabulario', 'gramatica')
        read_only_fields = ('id',)


class AulaSerializer(serializers.ModelSerializer):
    conteudos = AulaConteudoSerializer(
        source='aula_conteudos', many=True, read_only=True,
    )
    homeworks = HomeworkSerializer(many=True, read_only=True)

    class Meta:
        model = Aula
        fields = ('id', 'year', 'ordem', 'titulo', 'conteudos', 'homeworks')
        read_only_fields = ('id',)


class AulaListSerializer(serializers.ModelSerializer):
    total_conteudos = serializers.IntegerField(
        source='aula_conteudos.count', read_only=True,
    )

    class Meta:
        model = Aula
        fields = ('id', 'year', 'ordem', 'titulo', 'total_conteudos')


class ProgressoTurmaSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    aula_titulo = serializers.CharField(source='aula.titulo', read_only=True)

    class Meta:
        model = ProgressoTurma
        fields = (
            'id', 'turma', 'aula', 'aula_titulo',
            'status', 'status_display', 'updated_at',
        )
        read_only_fields = ('id', 'updated_at')
