from django.views.generic import TemplateView

from apps.accounts.mixins import ProfessorRequiredMixin

from .models import Conversa, Mensagem


class ChatPageView(ProfessorRequiredMixin, TemplateView):
    template_name = 'chat/chat.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        professor = self.request.user.professor

        ctx['conversas'] = Conversa.objects.filter(
            professor=professor,
        ).select_related('aula').order_by('-created_at')

        conversa_id = self.request.GET.get('conversa')
        if conversa_id:
            conversa = Conversa.objects.filter(
                id=conversa_id,
                professor=professor,
            ).select_related('aula').first()

            if conversa:
                ctx['conversa_ativa'] = conversa
                ctx['mensagens'] = Mensagem.objects.filter(
                    conversa=conversa,
                ).order_by('created_at')

        return ctx
