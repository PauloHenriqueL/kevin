from django.urls import path

from . import template_views

app_name = 'chat'

urlpatterns = [
    path('', template_views.ChatPageView.as_view(), name='chat_page'),
]
