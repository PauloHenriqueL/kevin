from rest_framework import serializers

from .models import Conversa, Mensagem


class MensagemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mensagem
        fields = ('id', 'conversa', 'role', 'tipo', 'conteudo', 'celebrar', 'acoes', 'created_at')
        read_only_fields = ('id', 'conversa', 'role', 'celebrar', 'acoes', 'created_at')


class ConversaSerializer(serializers.ModelSerializer):
    ultima_mensagem = serializers.SerializerMethodField()
    total_mensagens = serializers.IntegerField(
        source='mensagens.count', read_only=True,
    )

    class Meta:
        model = Conversa
        fields = ('id', 'professor', 'aula', 'created_at', 'ultima_mensagem', 'total_mensagens')
        read_only_fields = ('id', 'professor', 'created_at')

    def get_ultima_mensagem(self, obj):
        msg = obj.mensagens.order_by('-created_at').first()
        if msg:
            return MensagemSerializer(msg).data
        return None


class ConversaDetailSerializer(ConversaSerializer):
    mensagens = MensagemSerializer(many=True, read_only=True)

    class Meta(ConversaSerializer.Meta):
        fields = ConversaSerializer.Meta.fields + ('mensagens',)


class EnviarMensagemSerializer(serializers.Serializer):
    conteudo = serializers.CharField()
    tipo = serializers.ChoiceField(
        choices=Mensagem.TipoChoices.choices,
        default='texto',
    )


class AtualizarEstadoSerializer(serializers.Serializer):
    """Botões do professor no Playground (Demanda 20). Só os campos enviados mudam."""
    whisper = serializers.BooleanField(required=False)
    so_ingles = serializers.BooleanField(required=False)
    quadro = serializers.CharField(required=False, allow_blank=True, max_length=40)
