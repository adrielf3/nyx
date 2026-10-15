import type { ConversationMessage, ConversationRole } from './types';

const DEFAULT_HISTORY_LIMIT = 12;

export class ConversationHistory {
  private messages: ConversationMessage[] = [];
  private nextId = 1;

  constructor(private readonly limit = DEFAULT_HISTORY_LIMIT) {
    if (limit < 1) {
      throw new Error('O limite do histórico deve ser maior que zero.');
    }
  }

  add(role: ConversationRole, content: string): void {
    this.messages.push({
      id: this.nextId++,
      role,
      content,
      createdAt: Date.now(),
    });
    this.messages = this.messages.slice(-this.limit);
  }

  getMessages(): readonly ConversationMessage[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }
}
