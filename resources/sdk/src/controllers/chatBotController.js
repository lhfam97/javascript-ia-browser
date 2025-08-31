// @ts-check

/**
 * @typedef {import("../views/chatBotView.js").ChatbotView} ChatBotView
 * @typedef {import("../services/promptService.js").PromptService} PromptService
 */

export class ChatbotController {
  #abortController;
  #chatbotView;
  #promptService;

  /**
   * @param {Object} deps - Dependencies for the class.
   * @param {ChatBotView} deps.chatbotView - The chatbot view instance.
   * @param {PromptService} deps.promptService - The prompt service instance.
   */
  constructor({ chatbotView, promptService }) {
    this.#chatbotView = chatbotView;
    this.#promptService = promptService;
  }

  async init({ firstBotMessage, text }) {
    this.#setupEvents();
    this.#chatbotView.renderWelcomeBubble();
    this.#chatbotView.setInputEnabled(true);
    this.#chatbotView.appendBotMessage(firstBotMessage, null, false);

    const isDownloadable = await this.#checkIsDownloadable();
    if (isDownloadable) {
      this.#chatbotView.appendDownloadMessage();
      const activateButton = document.querySelector(".ewcb-btn-activate");
      if (activateButton) {
        activateButton.addEventListener("click", async () => {
          if (navigator.userActivation.isActive) {
            this.#chatbotView.setInputEnabled(false);
            this.#chatbotView.appendBotMessage("⏳ Baixando o modelo de IA...");

            try {
              // Tenta inicializar o PromptService novamente
              this.#chatbotView.showTypingIndicator();

              await this.#promptService.init(text);

              // Avança após download
              this.#chatbotView.appendBotMessage("✅ Modelo pronto para uso!");
            } catch (error) {
              console.error(error);
              this.#chatbotView.appendBotMessage(
                "❌ Falha ao baixar o modelo de IA."
              );
            } finally {
              this.#chatbotView.hideTypingIndicator();
              this.#chatbotView.setInputEnabled(true);
            }
          } else {
            console.log("User activation not active.");
          }
        });
      }
    } else {
      return this.#promptService.init(text);
    }
  }

  #setupEvents() {
    this.#chatbotView.setupEventHandlers({
      onOpen: this.#onOpen.bind(this),
      onSend: this.#chatBotReply.bind(this),
      onStop: this.#handleStop.bind(this),
    });
  }

  #handleStop() {
    this.#abortController.abort();
  }

  async #chatBotReply(userMsg) {
    this.#chatbotView.showTypingIndicator();
    this.#chatbotView.setInputEnabled(false);

    try {
      this.#abortController = new AbortController();

      const contentNode = this.#chatbotView.createStreamingBotMessage();
      const response = this.#promptService.prompt(
        userMsg,
        this.#abortController.signal
      );
      let fullResponse = "";
      let lastMessage = "noop";

      const updateText = () => {
        if (!fullResponse) return;
        if (fullResponse === lastMessage) return;
        this.#chatbotView.hideTypingIndicator();
        this.#chatbotView.updateStreamingBotMessage(contentNode, fullResponse);
      };

      const intervalId = setInterval(updateText, 200);
      const stopGenerating = () => {
        clearInterval(intervalId);
        updateText();
        this.#chatbotView.setInputEnabled(true);
      };
      this.#abortController.signal.addEventListener("abort", stopGenerating);
      for await (const chunk of response) {
        if (!chunk) continue;
        fullResponse += chunk;
      }

      console.log("full Response " + fullResponse);
      stopGenerating();
    } catch (error) {
      console.error(error);
      this.#chatbotView.hideTypingIndicator();
      if (error.name === "AbortError")
        return console.log("Request abort by user");

      this.#chatbotView.appendBotMessage("Erro ao obter resposta da AI");
      console.log("IA prompt error");
    }
  }

  async #onOpen() {
    const errors = await this.#checkRequirements();

    if (errors.length) {
      const messages = errors.join("\n\n");
      this.#chatbotView.appendBotMessage(messages);

      this.#chatbotView.setInputEnabled(false);
      return;
    }

    this.#chatbotView.setInputEnabled(true);
  }

  async #checkRequirements() {
    const errors = [];
    // @ts-ignore
    // const isChrome = window.chrome ;

    // const isChrome = navigator.userAgentData?.brands?.some(
    //   (b) => b.brand === "Google Chrome"
    // );

    // if (!isChrome) {
    //   errors.push(
    //     "⚠️ Este recurso só funciona no Google Chrome ou Chrome Canary (versão recente)."
    //   );
    // }
    // if (!("LanguageModel" in window)) {
    //   errors.push("⚠️ As APIs nativas de IA não estão ativas.");
    //   errors.push("Ative a seguinte flag em chrome://flags/:");
    //   errors.push(
    //     "- Prompt API for Gemini Nano (chrome://flags/#prompt-api-for-gemini-nano)"
    //   );
    //   errors.push("Depois reinicie o Chrome e tente novamente.");
    // }

    return errors;
  }

  async #checkIsDownloadable() {
    if (!("LanguageModel" in window)) {
      return false;
    }
    const IsDownloadable =
      (await window.LanguageModel.availability()) === "downloadable";
    return IsDownloadable;
  }
}
