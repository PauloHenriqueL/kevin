from abc import ABC, abstractmethod


class BaseIAProvider(ABC):
    def __init__(self, api_key: str, modelo: str):
        self.api_key = api_key
        self.modelo = modelo

    @abstractmethod
    def chat(self, system_prompt: str, mensagens: list[dict]) -> tuple[str, bool]:
        """
        Envia mensagens para a IA e retorna a resposta.

        Além do texto, a IA pode sinalizar que a resposta celebra um acerto
        do Teacher/turma — via tool-calling (mais confiável que procurar
        palavras-chave no texto): o provider expõe pro modelo uma função
        "celebrar_acerto", sem parâmetros, que ele chama quando quer marcar a
        resposta como uma comemoração (dispara o modo "celebrate" do Kevin no
        frontend). Ver docs/demandas.md → D38.

        Args:
            system_prompt: Contexto do sistema (ex: conteúdos da aula)
            mensagens: Lista de dicts com 'role' e 'content'

        Returns:
            (texto, celebrar) — texto da resposta da IA e se ela chamou a
            tool de celebração.
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
