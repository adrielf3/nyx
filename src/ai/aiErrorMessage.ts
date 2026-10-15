import { AiServiceError } from './types';

export function aiErrorMessage(error: unknown): string {
  if (!(error instanceof AiServiceError)) {
    return 'Minha conversa inteligente falhou agora. Podemos tentar novamente?';
  }

  switch (error.code) {
    case 'disabled':
      return 'A conversa com IA está desativada. Os comandos locais continuam disponíveis.';
    case 'invalid_key':
      return 'A chave da Gemini não é válida. Os comandos locais continuam disponíveis.';
    case 'quota_exceeded':
      return 'A cota gratuita da Gemini terminou por enquanto. Tente novamente após a renovação do limite.';
    case 'timeout':
      return 'A Gemini demorou demais para responder. Quer tentar novamente?';
    case 'network':
      return 'Estou sem acesso à internet agora. Os comandos locais continuam funcionando.';
    case 'invalid_response':
      return 'A Gemini não retornou uma resposta válida. Quer tentar de outro jeito?';
    case 'api_error':
      return 'A Gemini não conseguiu responder agora. Podemos tentar novamente?';
  }
}
