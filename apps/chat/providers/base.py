from abc import ABC, abstractmethod


class BaseIAProvider(ABC):
    def __init__(self, api_key: str, modelo: str):
        self.api_key = api_key
        self.modelo = modelo

    @abstractmethod
    def chat(self, system_prompt: str, mensagens: list[dict]) -> str:
        """
        Envia mensagens para a IA e retorna a resposta em texto.

        Args:
            system_prompt: Contexto do sistema (ex: conteúdos da aula)
            mensagens: Lista de dicts com 'role' e 'content'

        Returns:
            Texto da resposta da IA
        """


class BaseTTSProvider(ABC):
    def __init__(self, api_key: str, voice_id: str = '', modelo: str = ''):
        self.api_key = api_key
        self.voice_id = voice_id
        self.modelo = modelo

    @abstractmethod
    def sintetizar(self, texto: str) -> bytes:
        """
        Converte texto em áudio.

        Args:
            texto: Texto para converter

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
