import { InferenceClient } from "https://cdn.jsdelivr.net/npm/@huggingface/inference/+esm";

export class PromptService {
  #messages = [];
  #session = null;
  #isChrome = false;
  #hfClient = null;
  async init(initialPrompts) {
    this.#messages.push({
      role: "system",
      content: initialPrompts,
    });

    // Verificar se é Chrome
    this.#isChrome = navigator.userAgentData?.brands?.some(
      (b) => b.brand === "Google Chrome"
    );

    if (this.#isChrome && window.LanguageModel) {
      console.log("Usando API nativa do Chrome");
      return this.#createChromeSession();
    } else {
      console.log("Usando Hugging Face SDK");
      return this.#createHuggingFaceSession();
    }
  }

  async #createChromeSession() {
    this.#session = await LanguageModel.create({
      initialPrompts: this.#messages,
      expectedInputLanguages: ["pt"],
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          const percentage = (e.loaded / e.total) * 100;
          window.console.log(`Downloaded ${percentage.toFixed(2)}%`);
        });
      },
    });
    console.log(this.#session);
    return this.#session;
  }
  async #createHuggingFaceSession() {
    try {
      this.#hfClient = new InferenceClient("your-api-key");
      this.#session = {}; // Simular sessão para manter compatibilidade
      return this.#session;
    } catch (error) {
      console.error("Erro ao criar sessão Hugging Face:", error);
      throw error;
    }
  }

  prompt(text, signal) {
    this.#messages.push({
      role: "user",
      content: text,
    });

    if (this.#isChrome && this.#session) {
      return this.#session.promptStreaming(this.#messages, { signal });
    } else {
      return this.#huggingFacePrompt(this.#messages, signal);
    }
  }

  #huggingFacePrompt(messages, signal) {
    const self = this;
    return new ReadableStream({
      async start(controller) {
        const stream = self.#hfClient.chatCompletionStream({
          model: "deepseek-ai/DeepSeek-V3", // Modelo pode ser configurável
          messages: messages,
          max_tokens: 1000,
        });
        try {
          for await (const chunk of stream) {
            if (signal?.aborted) {
              controller.error(new DOMException("Aborted", "AbortError"));
              break;
            }
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(content);
            }
          }
          controller.close();
        } catch (error) {
          console.log(error);
          controller.error(error);
        }
      },
    });
  }
}
