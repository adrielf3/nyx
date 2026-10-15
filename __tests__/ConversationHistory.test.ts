import { ConversationHistory } from '../src/conversation/ConversationHistory';

describe('ConversationHistory', () => {
  it('mantém apenas as mensagens mais recentes dentro do limite', () => {
    const history = new ConversationHistory(2);

    history.add('user', 'primeira');
    history.add('assistant', 'segunda');
    history.add('user', 'terceira');

    expect(history.getMessages().map(message => message.content)).toEqual([
      'segunda',
      'terceira',
    ]);
  });

  it('limpa todo o histórico em memória', () => {
    const history = new ConversationHistory();
    history.add('user', 'abrir youtube');

    history.clear();

    expect(history.getMessages()).toEqual([]);
  });
});
