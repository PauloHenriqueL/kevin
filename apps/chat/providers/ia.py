import anthropic
import openai

from .base import BaseIAProvider


class AnthropicProvider(BaseIAProvider):
    def chat(self, system_prompt: str, mensagens: list[dict]) -> str:
        client = anthropic.Anthropic(api_key=self.api_key)

        response = client.messages.create(
            model=self.modelo,
            max_tokens=1024,
            system=system_prompt,
            messages=mensagens,
        )

        return response.content[0].text


class OpenAIProvider(BaseIAProvider):
    def chat(self, system_prompt: str, mensagens: list[dict]) -> str:
        client = openai.OpenAI(api_key=self.api_key)

        messages = [{'role': 'system', 'content': system_prompt}]
        messages.extend(mensagens)

        response = client.chat.completions.create(
            model=self.modelo,
            messages=messages,
        )

        return response.choices[0].message.content


PROVIDERS = {
    'anthropic': AnthropicProvider,
    'openai': OpenAIProvider,
}


def get_ia_provider(provider_name: str, api_key: str, modelo: str) -> BaseIAProvider:
    provider_class = PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f'Provedor de IA desconhecido: {provider_name}')
    return provider_class(api_key=api_key, modelo=modelo)
