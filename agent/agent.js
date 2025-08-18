import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import fs from "fs/promises";
import fssync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

// ESM helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Import ESM tools directly
import { read_file, write_file, read_many_files, search_file_content, replace, fileExists } from "../tools/read_write_search_file.js";
import { listDirectory } from "../tools/list_directory.js";
import { glob, globWithStats } from "../tools/glob_files.js";
import { runShellCommand as systemRun } from "../tools/run_shell_command.js";

// Import CJS tools via createRequire to avoid ESM/CJS interop issues
const { extractPageData } = require("../tools/page-extractor.js");
const { takeResponsiveScreenshots } = require("../tools/responsive-screenshots.js");

// Utility: map file extension to MIME type for data URLs
const mimeFromExtension = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    default: return "application/octet-stream";
  }
};

const fileToDataUrl = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  const mime = mimeFromExtension(filePath);
  const base64 = buffer.toString("base64");
  return `data:${mime};base64,${base64}`;
};

// Tool registry mapping per ai_agent_system_prompt.md
const buildToolRegistry = () => ({
  "page.extract": async (params = {}) => {
    const { url, outputDir, options } = params;
    if (!url) throw new Error("page.extract requires 'url'");
    return await extractPageData(url, outputDir, options);
  },
  "shots.capture": async (params = {}) => {
    const { url, outputDir, options } = params;
    if (!url) throw new Error("shots.capture requires 'url'");
    return await takeResponsiveScreenshots(url, outputDir, options);
  },
  "files.read": async (params = {}) => {
    const { filePath, encoding } = params;
    return await read_file(filePath, encoding);
  },
  "files.readMany": async (params = {}) => {
    const { filePaths, options } = params;
    return await read_many_files(filePaths, options);
  },
  "files.write": async (params = {}) => {
    const { filePath, content, options } = params;
    return await write_file(filePath, content, options);
  },
  "files.search": async (params = {}) => {
    const { filePaths, pattern, options } = params;
    return await search_file_content(filePaths, pattern, options);
  },
  "files.replace": async (params = {}) => {
    const { filePath, searchValue, replaceValue, options } = params;
    return await replace(filePath, searchValue, replaceValue, options);
  },
  "files.exists": async (params = {}) => {
    const { filePath } = params;
    return await fileExists(filePath);
  },
  "fs.list": async (params = {}) => {
    const { dirPath, options } = params;
    return await listDirectory(dirPath, options);
  },
  "fs.glob": async (params = {}) => {
    const { pattern, options } = params;
    return await glob(pattern, options);
  },
  "fs.globWithStats": async (params = {}) => {
    const { pattern, options } = params;
    return await globWithStats(pattern, options);
  },
  "system.run": async (params = {}) => {
    const { command, options } = params;
    return await systemRun(command, options);
  }
});

// Robust JSON extraction from model output
const extractJsonObject = (text) => {
  if (!text || typeof text !== "string") return null;
  let candidate = text.trim();
  // Strip fenced code block if present
  const fenceMatch = candidate.match(/```[a-zA-Z]*\n([\s\S]*?)\n```/);
  if (fenceMatch) candidate = fenceMatch[1].trim();
  // Fast path
  try { return JSON.parse(candidate); } catch {}
  // Try to find first JSON object substring
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const sub = candidate.slice(start, end + 1);
    try { return JSON.parse(sub); } catch {}
  }
  return null;
};

export class WebsiteCloneAgent {
  constructor(options = {}) {
    const modelName = options.model || process.env.OPENAI_MODEL || "gpt-4.1";
    this.model = new ChatOpenAI({
      model: modelName
    });
    this.messages = [];
    this.toolRegistry = buildToolRegistry();
    this.maxSteps = options.maxSteps || 20;
    this.systemPromptPath = options.systemPromptPath || path.resolve(__dirname, "./ai_agent_system_prompt.md");
    this._systemPrompt = null;
  }

  async loadSystemPrompt() {
    if (this._systemPrompt) return this._systemPrompt;
    const content = await fs.readFile(this.systemPromptPath, "utf8");
    this._systemPrompt = content;
    return content;
  }

  reset() {
    this.messages = [];
  }

  getHistory() {
    return this.messages;
  }

  async run(userInput) {
    const systemPrompt = await this.loadSystemPrompt();
    if (!Array.isArray(this.messages) || this.messages.length === 0) {
      this.messages = [new SystemMessage(systemPrompt)];
    }
    this.messages.push(new HumanMessage(userInput));

    for (let step = 0; step < this.maxSteps; step++) {
      const response = await this.model.invoke(this.messages);
      this.messages.push(new AIMessage(response.content));

      const contentStr = typeof response.content === "string"
        ? response.content
        : (Array.isArray(response.content)
          ? response.content.map(p => (typeof p === "object" && p && "text" in p ? p.text : "")).join("")
          : "");

      const json = extractJsonObject(contentStr);

      // If model signaled final output
      if (json && json.final === true) {
        console.log("\n=== Final Result ===");
        try { console.log(JSON.stringify(json, null, 2)); } catch { console.log(String(json)); }
        return { final: true, result: json, messages: this.messages };
      }

      // If tool call requested
      if (json && json.tool) {
        const { tool, params, id, reasoning } = json;
        console.log("\n--- Tool call ---");
        if (id) console.log(`id: ${id}`);
        console.log(`tool: ${tool}`);
        if (reasoning) console.log(`reasoning: ${reasoning}`);
        try { console.log(`params: ${JSON.stringify(params || {}, null, 2)}`); } catch {}
        const toolFn = this.toolRegistry[tool];
        if (!toolFn) {
          // Inform the model about the invalid tool
          this.messages.push(new HumanMessage({
            text: `Tool not found: ${tool}. Please choose a valid tool.`,
          }));
          continue;
        }

        let result;
        try {
          result = await toolFn(params || {});
        } catch (err) {
          this.messages.push(new HumanMessage({
            text: `Tool ${tool} failed: ${err.message}`
          }));
          continue;
        }

        // If screenshots taken, attach images
        if (tool === "shots.capture" && Array.isArray(result)) {
          const images = [];
          for (const shot of result) {
            if (shot && shot.file && fssync.existsSync(shot.file)) {
              try {
                const dataUrl = await fileToDataUrl(shot.file);
                images.push({ type: "image_url", image_url: { url: dataUrl } });
              } catch {}
            }
          }
          console.log("tool result (shots.capture):");
          try { console.log(JSON.stringify(result, null, 2)); } catch { console.log(String(result)); }

          const textPart = { type: "text", text: JSON.stringify({ id, tool, ok: true, resultSummary: result.map(r => ({ viewport: r.viewport, file: r.file, error: r.error || null })) }, null, 2) };
          this.messages.push(new HumanMessage([textPart, ...images]));
          continue;
        }

        // Default: return tool result as text context
        console.log(`tool result (${tool}):`);
        try { console.log(JSON.stringify(result, null, 2)); } catch { console.log(String(result)); }
        this.messages.push(new HumanMessage({
          text: JSON.stringify({ id, tool, ok: true, result }, null, 2)
        }));
        continue;
      }

      // If neither tool call nor final JSON, continue loop to let model refine
    }

    return { final: false, result: null, messages: this.messages };
  }
}

export const createWebsiteCloneAgent = (options = {}) => new WebsiteCloneAgent(options);


