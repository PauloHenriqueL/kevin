from rest_framework import serializers

from .models import Aluno, Escola, Plano, Professor, Turma


class PlanoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plano
        fields = (
            'id', 'nome', 'valor_mensal',
            'ia_provider', 'ia_modelo',
            'tts_provider', 'stt_provider',
        )


class EscolaSerializer(serializers.ModelSerializer):
    plano_nome = serializers.CharField(source='plano.nome', read_only=True)

    class Meta:
        model = Escola
        fields = ('id', 'nome', 'slug', 'plano', 'plano_nome', 'ativa', 'created_at')
        read_only_fields = ('id', 'created_at')


class ProfessorSerializer(serializers.ModelSerializer):
    nome = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    escola_nome = serializers.CharField(source='escola.nome', read_only=True)

    class Meta:
        model = Professor
        fields = ('id', 'user', 'nome', 'email', 'escola', 'escola_nome', 'ativo')
        read_only_fields = ('id',)


class TurmaSerializer(serializers.ModelSerializer):
    professor_nome = serializers.CharField(
        source='professor.user.get_full_name', read_only=True, default=None,
    )
    display_nome = serializers.CharField(source='__str__', read_only=True)
    total_alunos = serializers.IntegerField(source='alunos.count', read_only=True)

    class Meta:
        model = Turma
        fields = (
            'id', 'year', 'nome', 'escola', 'professor',
            'professor_nome', 'display_nome', 'total_alunos',
        )
        read_only_fields = ('id',)


class AlunoSerializer(serializers.ModelSerializer):
    turma_nome = serializers.CharField(source='turma.__str__', read_only=True)

    class Meta:
        model = Aluno
        fields = ('id', 'nome', 'turma', 'turma_nome')
        read_only_fields = ('id',)
