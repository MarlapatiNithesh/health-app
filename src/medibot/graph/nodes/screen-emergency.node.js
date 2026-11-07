/**
 * LangGraph Node: Screen Emergency
 * Immediately screens the patient's incoming message against critical red-flag conditions.
 */

import { medibotConfig } from '../../config/medibot-config.js';

export function createScreenEmergencyNode() {
  return async function screenEmergencyNode(state) {
    const text = state.userMessage || '';

    for (const pattern of medibotConfig.redFlagPatterns) {
      if (pattern.regex.test(text)) {
        return {
          isEmergency: true,
          emergencyDetails: {
            trigger: pattern.trigger,
            message: pattern.message,
          },
        };
      }
    }

    return {
      isEmergency: false,
      emergencyDetails: null,
    };
  };
}

