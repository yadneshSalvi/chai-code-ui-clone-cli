const { ChatOpenAI } = require("@langchain/openai");

async function sendMessageToOpenAI(userMessage) {
  
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  const modelName = process.env.OPENAI_MODEL || "gpt-4.1";

  const model = new ChatOpenAI({
    model: modelName
  });

  const result = await model.invoke(userMessage);

  const content = result && result.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const text = content
      .map(part => (typeof part === "object" && part !== null && "text" in part ? part.text : ""))
      .join("");
    return String(text).trim();
  }

  return "";
}

async function* streamMessageToOpenAI(userMessage) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  const modelName = process.env.OPENAI_MODEL || "gpt-4.1";

  const model = new ChatOpenAI({
    model: modelName,
    streaming: true
  });

  const stream = await model.stream(userMessage);

  for await (const chunk of stream) {
    const content = chunk.content;
    if (content) {
      yield content;
    }
  }
}

module.exports = { sendMessageToOpenAI, streamMessageToOpenAI };

