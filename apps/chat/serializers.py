from rest_framework import serializers

from .models import Conversa, Mensagem


class MensagemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mensagem
        fields = ('id', 'conversa', 'role', 'tipo', 'conteudo', 'created_at')
        read_only_fields = ('id', 'conversa', 'role', 'created_at')


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
