/**
 * LangGraph Node: Agent Reasoning
 * Executes the LangChain ChatModel with clinical tools, handling tool calls and generating
 * the differential diagnosis and patient guidance draft.
 */

import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { MediBotLLMFactory } from '../../models/llm-factory.js';
import { medibotConfig } from '../../config/medibot-config.js';
import { logger } from '../../../logger.js';

export function createAgentReasoningNode({ chatModel, tools = [], llmService = null }) {
  const modelWithTools = chatModel?.bindTools ? chatModel.bindTools(tools) : chatModel;

  return async function agentReasoningNode(state) {
    state.onProgress?.('Generating Differential Diagnosis and formulating clinical response...');

    const startTime = Date.now();
    const systemPrompt = state.systemPrompt;
    const historyMessages = state.messages || [];

    // Window history to prevent token overflow
    const maxContext = medibotConfig.conversation.maxContextMessages;
    const windowed = historyMessages.length > maxContext
      ? historyMessages.slice(-maxContext)
      : historyMessages;

    // Convert messages to LangChain BaseMessage instances
    const langchainMessages = [
      new SystemMessage(systemPrompt),
      ...windowed.map((m) => {
        if (typeof m.toDict === 'function' || m._getType) return m;
        if (m.role === 'assistant') return new AIMessage(m.content);
        return new HumanMessage(m.content);
      }),
    ];

    let draftContent = '';
    let modelName = 'medibot-clinical-ai';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      if (llmService?.generateWithToolCalling) {
        // Use existing tool calling loop wrapper if provided
        const toolHandlers = {};
        for (const t of tools) {
          toolHandlers[t.name] = (args) => t.invoke(args);
        }
        const res = await llmService.generateWithToolCalling({
          messages: windowed.map((m) => ({ role: m.role || 'user', content: m.content })),
          systemPrompt,
          toolHandlers,
        });
        draftContent = res.content;
        modelName = res.modelName || modelName;
        inputTokens = res.tokens?.input || 0;
        outputTokens = res.tokens?.output || 0;
      } else {
        // Direct LangChain invocation
        const response = await modelWithTools.invoke(langchainMessages);

        if (response.tool_calls && response.tool_calls.length > 0) {
          // Execute tool calls
          const toolResults = [];
          for (const tc of response.tool_calls) {
            const tool = tools.find((t) => t.name === tc.name);
            if (tool) {
              try {
                const out = await tool.invoke(tc.args);
                toolResults.push(`[Tool ${tc.name} output]: ${out}`);
              } catch (tErr) {
                toolResults.push(`[Tool ${tc.name} failed]: ${tErr.message}`);
              }
            }
          }
          // Follow-up generation with tool results
          langchainMessages.push(response);
          langchainMessages.push(new HumanMessage(toolResults.join('\n\n')));
          const secondResponse = await modelWithTools.invoke(langchainMessages);
          draftContent = typeof secondResponse.content === 'string' ? secondResponse.content : JSON.stringify(secondResponse.content);
        } else {
          draftContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        }

        modelName = response.response_metadata?.modelName || modelName;
        inputTokens = response.response_metadata?.usage?.input_tokens || Math.round((systemPrompt.length + state.userMessage.length) / 4);
        outputTokens = response.response_metadata?.usage?.output_tokens || Math.round(draftContent.length / 4);
      }
    } catch (err) {
      logger.warn('agentReasoningNode LLM error, falling back to specialist clinical response', { error: err.message });
      draftContent = MediBotLLMFactory.generateSpecialistFallbackResponse(systemPrompt, state.userMessage);
      modelName = 'medibot-specialist-engine';
    }

    const latencyMs = Date.now() - startTime;

    return {
      draftResponse: draftContent,
      modelRunMetrics: {
        modelName,
        modelVersion: '1.0',
        inputTokens,
        outputTokens,
        latencyMs,
      },
    };
  };
}

