# Nyx

MVP de um companheiro digital para Android construído com React Native e Kotlin.

## Fluxo implementado

`voz → texto → intenção local → ferramenta validada → ação Android → resposta → voz`

- O reconhecimento usa a interface de fala instalada no Android, em `pt-BR`, somente após ação explícita.
- O interpretador local não usa LLM e reconhece a abertura de YouTube, Chrome, Google Maps, Gmail e YouTube Music, além de pesquisa e controles de mídia do YouTube Music.
- A allowlist é validada novamente no módulo Kotlin; nomes de pacote arbitrários não atravessam a ponte.
- O personagem provisório usa `WindowManager` e pode ser arrastado.
- Um toque simples na bolha abre um painel flutuante; arrastar continua movendo a Nyx sem abrir o painel.
- O microfone do painel usa `SpeechRecognizer` dentro de uma Activity transparente e isolada apenas durante o reconhecimento. A interface externa do Google não é aberta; a transcrição volta ao interpretador TypeScript e o resultado é exibido no próprio painel.
- Um gerenciador de conversa único coordena a tela principal e o overlay nos estados `idle`, `listening`, `processing`, `speaking`, `success` e `error`.
- As respostas usam o `TextToSpeech` nativo do Android, priorizando uma voz local em `pt-BR`. Uma nova resposta interrompe a anterior, e a fala também pode ser interrompida pela tela ou pelo overlay.
- O histórico recente existe apenas em memória, é limitado a 12 mensagens e pode ser limpo pela interface. Áudio bruto não é armazenado.
- O roteamento é híbrido: comandos reconhecidos continuam totalmente locais; somente perguntas que não correspondem a um comando autorizado são enviadas à Gemini.

Conceda a permissão especial “Exibir sobre outros apps” quando o Nyx abrir as configurações. A permissão de microfone é pedida apenas ao tocar em **Falar com Nyx**.

O reconhecimento offline não é garantido: ele depende do serviço de fala instalado no dispositivo. Os aplicativos permitidos também podem não existir em todos os aparelhos.

A síntese de voz também depende do mecanismo e das vozes instaladas no aparelho. Quando não há uma voz em português compatível, a resposta textual e o resultado do comando continuam funcionando sem áudio.

## Conversação com Gemini

O projeto usa o SDK oficial `@google/genai` e o modelo `gemini-3.5-flash-lite`. Em outubro de 2026, esse modelo possui modalidade gratuita para texto, sujeita às cotas ativas do projeto no Google AI Studio. O aplicativo não habilita faturamento e faz apenas uma tentativa por pergunta; um erro de cota não é contornado com novas chamadas automáticas.

Crie uma chave em [Google AI Studio](https://aistudio.google.com/apikey) usando um projeto sem faturamento e forneça-a apenas no ambiente do processo de build:

```sh
GEMINI_API_KEY="sua-chave" npm run android
```

Para um APK gerado diretamente pelo Gradle:

```sh
cd android
GEMINI_API_KEY="sua-chave" ./gradlew assembleDebug
```

Não há arquivo `.env` nem chave padrão versionada. Para desabilitar a IA, remova `GEMINI_API_KEY` do ambiente e recompile; os comandos locais continuam funcionando normalmente.

Para verificar a integração, faça uma pergunta aberta que não seja um comando, como “Por que o céu é azul?”. Pedidos como “Abra o YouTube” devem seguir o interpretador local e não chamar a API.

### Dados e segurança

Cada chamada envia à Gemini somente:

- o texto da pergunta reconhecida;
- até seis mensagens recentes de usuário e assistente;
- as instruções centralizadas de personalidade da Nyx.

Áudio bruto, mensagens internas de ferramentas, contatos, localização, notificações, tokens e dados de outros aplicativos não são enviados. A Gemini não recebe declarações de ferramentas e sua resposta é tratada apenas como texto; toda ação no dispositivo continua protegida pelo interpretador e pela allowlist local.

Uma variável usada no build de um aplicativo mobile **não é um segredo real**: a chave fica incorporada ao APK e pode ser extraída. Esta integração direta é adequada somente para a fase pessoal de desenvolvimento solicitada. Antes de distribuir o aplicativo, mova a credencial para um backend controlado e aplique restrições de chave apropriadas.

No nível gratuito, prompts e respostas podem ser usados pelo Google para melhorar produtos, e limites podem mudar. Consulte a [tabela atual de preços](https://ai.google.dev/gemini-api/docs/pricing) e os [limites ativos](https://ai.google.dev/gemini-api/docs/rate-limits) antes de testar.

O interpretador e as ferramentas continuam no runtime React Native. Se esse runtime não estiver ativo quando a fala terminar, o painel apresenta um erro seguro e pede que o usuário abra o Nyx; o Kotlin não duplica nem contorna as regras de comandos.

## YouTube Music

Estes comandos são resolvidos localmente, antes da Gemini:

- “Nyx, abre o YouTube Music.”
- “Nyx, pesquisa Blinding Lights.”
- “Nyx, toca Blinding Lights, do The Weeknd.”
- “Nyx, pause a música.”, “continue a música”, “próxima música”, “anterior” e “pare a música”.

“Nyx, me indica uma música” é diferente: o cliente Gemini já existente solicita uma única recomendação em JSON validado, contendo título, artista, álbum opcional e justificativa. A Nyx apresenta a sugestão e a mantém somente em memória. Uma confirmação como “sim, quero ouvir essa música” envia os mesmos metadados ao mecanismo local; a Gemini nunca executa a ação nativa.

A abertura e a pesquisa são direcionadas exclusivamente ao pacote `com.google.android.apps.youtube.music`. A URL da pesquisa usa somente HTTPS, o host `music.youtube.com`, o caminho `/search` e um parâmetro `q` codificado. A Nyx não usa scraping, APIs privadas nem tenta controlar outro player.

Para “toca...”, a primeira tentativa usa a intent pública `MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH`, com foco de faixa, título, artista e consulta. A intent é direcionada somente ao pacote oficial e só é executada quando o YouTube Music declara um handler compatível. Após o envio, a Nyx verifica a sessão e o título; somente confirma reprodução quando há evidência correspondente. O TTS é omitido após essa confirmação para não disputar o foco de áudio com a música.

Se não houver handler, a abertura falhar ou a reprodução não puder ser confirmada, a Nyx constrói `https://music.youtube.com/search` com `Uri.Builder`, abre a pesquisa no pacote oficial e informa precisamente que a faixa ainda precisa ser selecionada. Nenhum link ou identificador é inventado, e não há scraping, API privada ou automação por acessibilidade.

### Autorizar pausa, retomada e troca de faixa

O Android só permite consultar sessões de mídia ativas quando o usuário concede um acesso especial. Na tela principal:

1. Toque em **Abrir configurações de acesso** na seção **Controle do YouTube Music**.
2. Ative **Nyx — controle do YouTube Music**.
3. Volte ao aplicativo e inicie uma música no YouTube Music antes de testar os controles.

O serviço existe apenas para obter acesso público ao `MediaSessionManager`. Ele não implementa callbacks para ler notificações e não armazena nem envia conteúdo delas. Mesmo com a autorização, cada comando filtra a sessão pelo pacote exato do YouTube Music. Se não houver sessão, se a ação não for suportada ou se o app não estiver instalado, o resultado traz uma mensagem segura e um código de erro, sem fallback para outro aplicativo.

### Validação manual sugerida

1. Com a Gemini desabilitada ou sem rede, confirme que abrir, pesquisar e os controles reconhecidos continuam locais.
2. Teste uma busca com espaços, acentos e caracteres especiais.
3. Peça uma reprodução específica e confirme que ela começa diretamente; se a versão instalada não aceitar `MEDIA_PLAY_FROM_SEARCH`, confirme o fallback para a tela de resultados e a mensagem de seleção manual.
4. Sem a autorização especial, confirme que pausar explica como concedê-la.
5. Com autorização, teste sem sessão ativa e depois com uma música em execução.
6. Deixe outro player ativo e confirme que a Nyx não o pausa quando não existe sessão do pacote do YouTube Music.

Os resultados nativos de música seguem o contrato `{ success, action, message, requiresUserInteraction, errorCode? }`. O envio de um controle a uma sessão indica que o Android aceitou a solicitação; o estado final da reprodução ainda depende do YouTube Music.

## Limitação do overlay

O overlay roda em um `Service` comum para validar o fluxo. O Android pode encerrar esse processo, especialmente em segundo plano. Uma etapa futura deve avaliar um serviço em primeiro plano e sua notificação persistente conforme as regras da versão Android alvo; este MVP não simula persistência garantida.

## Ambiente React Native

Este projeto foi criado com o [**React Native**](https://reactnative.dev) via [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
