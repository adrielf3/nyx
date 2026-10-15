export type InteractionState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'success'
  | 'error';

export type ConversationRole = 'user' | 'assistant' | 'tool';

export type ConversationMessage = {
  id: number;
  role: ConversationRole;
  content: string;
  createdAt: number;
};
