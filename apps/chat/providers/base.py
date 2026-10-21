from abc import ABC, abstractmethod


class BaseIAProvider(ABC):
    def __init__(self, api_key: str, modelo: str, effort: str = ''):
        self.api_key = api_key
        self.modelo = modelo
        # Esforço de raciocínio (D39). Vazio = não envia o parâmetro, deixando
        # o padrão do provedor valer. Só o OpenAI usa; o Anthropic ignora.
        self.effort = effort

    @abstractmethod
    def chat(self, system_prompt: str, mensagens: list[dict],
             ferramentas=None, conversa=None) -> tuple[str, list[dict]]:
        """
        Envia mensagens para a IA e retorna a resposta.

        Além do texto, a IA pode pedir AÇÕES via tool-calling (mais confiável
        que procurar palavras-chave no texto): celebrar um acerto (D38), e no
        Playground tocar música, mostrar no quadro, trocar o cenário etc.
        (D51). Cada ferramenta pedida é executada por
        `apps.chat.ferramentas.executar` e o resultado volta para a IA quando
        ela precisa dele para falar. Ver docs/demandas.md → Demanda 20.

        Args:
            system_prompt: Contexto do sistema (ex: conteúdos da aula)
            mensagens: Lista de dicts com 'role' e 'content'
            ferramentas: Lista de `Ferramenta`. None = as do modo aula
                (só `celebrar_acerto`).
            conversa: A `Conversa`, para as ferramentas que leem/gravam estado.

        Returns:
            (texto, acoes) — texto da resposta (as rodadas concatenadas) e a
            lista de ações para o frontend, ex: [{"tipo": "celebrar"}].
        """


class BaseTTSProvider(ABC):
    def __init__(self, api_key: str, voice_id: str = '', modelo: str = ''):
        self.api_key = api_key
        self.voice_id = voice_id
        self.modelo = modelo

    @abstractmethod
    def sintetizar(self, texto: str, estilo: str = 'normal') -> bytes:
        """
        Converte texto em áudio.

        Args:
            texto: Texto para converter
            estilo: 'normal' ou 'sussurro' (Everybody Whisper, D52). Provider
                que não sabe sussurrar ignora.

        Returns:
            Bytes do arquivo de áudio
        """


class BaseSTTProvider(ABC):
    def __init__(self, api_key: str):
        self.api_key = api_key

    @abstractmethod
    def transcrever(self, audio: bytes) -> str:
        """
        Converte áudio em texto.

        Args:
            audio: Bytes do arquivo de áudio

        Returns:
            Texto transcrito
        """
