/**
 * LangGraph Node: Prompt Rewrite
 * Appends the Clinical Critic's safety objection to the conversation context
 * so the reasoning model can regenerate a safe alternative.
 */

import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { logger } from '../../../logger.js';

export function createPromptRewriteNode() {
  return async function promptRewriteNode(state) {
    const { draftResponse, criticReason, criticAttempts } = state;

    logger.warn('promptRewriteNode: Preparing prompt correction for critic objection', {
      criticReason,
      attempt: criticAttempts,
    });

    const correctionMsg = `[CRITICAL REVIEW BOARD]: Your previous draft was rejected by the Attending Physician because: ${criticReason}. Please rewrite your response to address the patient safely while avoiding the cited issue.`;

    const updatedMessages = [
      new AIMessage(draftResponse || ''),
      new HumanMessage(correctionMsg),
    ];

    return {
      messages: updatedMessages,
      criticAttempts: (criticAttempts || 0) + 1,
    };
  };
}

