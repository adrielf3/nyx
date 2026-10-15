import type { CommandIntent } from '../commands/commandInterpreter';
import type { ToolResult } from '../tools/appTools';

export function generateNyxResponse(
  intent: CommandIntent,
  result: ToolResult,
): string {
  if (intent.type === 'unknown') {
    return 'Ainda não sei fazer isso. Quer tentar de outro jeito?';
  }

  if (intent.type !== 'open_app') {
    return result.response || result.message;
  }

  if (result.success) {
    return `Pronto, o ${intent.appName} está aberto!`;
  }

  if (
    result.message.toLocaleLowerCase('pt-BR').includes('não está instalado')
  ) {
    return `Não encontrei o ${intent.appName} instalado.`;
  }

  return `Não consegui abrir o ${intent.appName}. Quer tentar novamente?`;
}
