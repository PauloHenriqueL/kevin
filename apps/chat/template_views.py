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


class ControleCelularView(TemplateView):
    """O celular do professor como controle da aula (D62). Sem login: o token
    do link (lido no QR do telão) é a credencial."""
    template_name = 'chat/controle_celular.html'

    def get_context_data(self, **kwargs):
        from .controle import ler_token

        ctx = super().get_context_data(**kwargs)
        controle = ler_token(kwargs['token'])
        ctx['token'] = kwargs['token']
        ctx['valido'] = controle is not None
        if controle:
            conversa = controle.conversa
            turma = conversa.turma
            turma_txt = f'Turma {turma.year}{turma.nome}' if turma else ''
            if conversa.eh_playground:
                ctx['titulo'] = f'Playground · {turma_txt}' if turma_txt else 'Playground'
            else:
                ctx['titulo'] = conversa.aula.codigo if conversa.aula else 'Aula'
            ctx['modo_playground'] = conversa.eh_playground
        return ctx
