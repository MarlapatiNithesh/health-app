/**
 * LangChain ChatModel Factory
 * Instantiates provider-agnostic ChatModel implementations (Google Gemini, OpenAI, or resilient clinical fallback).
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage } from '@langchain/core/messages';
import { medibotConfig } from '../config/medibot-config.js';
import { logger } from '../../logger.js';

export class MediBotLLMFactory {
  /**
   * Create primary clinical reasoning ChatModel.
   */
  static createChatModel(options = {}) {
    const geminiKey = options.geminiApiKey || medibotConfig.gemini.apiKey;
    const openaiKey = options.openaiApiKey || medibotConfig.openai.apiKey;

    if (geminiKey) {
      try {
        return new ChatGoogleGenerativeAI({
          apiKey: geminiKey,
          model: options.model || medibotConfig.gemini.model,
          temperature: options.temperature ?? medibotConfig.gemini.temperature,
          maxOutputTokens: options.maxTokens ?? medibotConfig.gemini.maxOutputTokens,
        });
      } catch (err) {
        logger.warn('Failed to initialize ChatGoogleGenerativeAI, checking OpenAI...', { error: err.message });
      }
    }

    if (openaiKey) {
      try {
        return new ChatOpenAI({
          apiKey: openaiKey,
          model: options.model || medibotConfig.openai.model,
          temperature: options.temperature ?? medibotConfig.openai.temperature,
          maxTokens: options.maxTokens ?? medibotConfig.openai.maxTokens,
        });
      } catch (err) {
        logger.warn('Failed to initialize ChatOpenAI, falling back to mock provider', { error: err.message });
      }
    }

    logger.info('No external LLM API key detected; initializing Resilient Fallback Runnable');
    return MediBotLLMFactory.createFallbackModel();
  }

  /**
   * Generates a specialist clinical doctor response based on prompt state.
   */
  static generateSpecialistFallbackResponse(systemPrompt = '', userMessage = '') {
    const isComplete = /Assessment Complete|CLINICAL ASSESSMENT COMPLETE DIRECTIVE/i.test(systemPrompt);
    const hasNextField = /Required Next Clinical Dimension:\s*\[([A-Z_]+)\]/i.exec(systemPrompt);
    const nextField = hasNextField ? hasNextField[1].toLowerCase() : null;

    if (isComplete) {
      return `🎯 Primary Focus: Comprehensive Clinical Consultation & Differential Triage

Thank you for sharing those detailed observations with me. As your senior clinical specialist, I have carefully reviewed your symptoms alongside your clinical profile.

### 🩺 Clinical Impression & Differential Considerations
Based on your clinical description, these symptoms most commonly align with a primary tension-vascular episode (such as a migraine or severe tension headache), or acute localized inflammation depending on progression. While serious acute intracranial causes are less likely given the absence of acute trauma or high fever, continuous monitoring remains essential.
- **Migraine Headaches**: Characterized by unilateral or bilateral pulsating pain, often moderate to severe, with sensory sensitivities.
- **Tension-Type Vascular Pattern**: Musculoskeletal and vascular interplay, often triggered by stress, posture, or fatigue.

### 🩹 Practical At-Home Care & Supportive Relief
- **Sensory Rest**: Rest in a quiet, dimly lit room away from screen glare and bright ambient light.
- **Targeted Hydration**: Maintain steady hydration with water or electrolyte liquids.
- **Soothing Comfort**: Apply a cold or warm compress across your forehead or the nape of your neck according to comfort.
- **Avoid Triggers**: Avoid skipping meals, dehydration, or abrupt caffeine shifts while recovering.

### ⚠️ Red Flag Warning Signs (Seek Emergency Care Immediately)
Please seek immediate in-person emergency medical evaluation (go to the nearest emergency department or call emergency services) if you develop:
- A sudden "thunderclap" onset reaching maximum intensity within seconds
- High fever accompanied by a stiff neck, confusion, or altered mental status
- Focal neurological deficits (sudden weakness, numbness, difficulty speaking, or vision loss)
- A new severe headache following recent head injury

### 📋 Recommended Next Clinical Steps
If your discomfort persists beyond 24-48 hours, worsens in intensity, or recurs frequently, please schedule an in-person consultation with your physician or primary care clinic for physical and neurological examination.

### 🤝 Follow-Up & Clinical Alignment
Is there anything else concerning you, or any other symptoms you'd like to check today?

Was this consultation helpful for you? (Please tap 👍 or 👎 or share your feedback below—this directly helps train and refine our clinical AI accuracy for future care).

### Follow-up & Feedback Questions:
- Yes, this was very helpful!
- I have another symptom to discuss
- When should I see a doctor?
- All good for now, thank you!`;
    }

    if (nextField === 'severity') {
      return `🎯 Primary Focus: Symptom Severity & Pain Intensity Assessment

I understand, and I appreciate you describing this for me. In clinical triage, calibrating symptom intensity helps us determine medical urgency and safe home-care thresholds. 

On a scale from 0 to 10 (where 0 is completely pain-free and 10 is the worst pain imaginable), how severe does the discomfort feel right now?

### Follow-up & Feedback Questions:
- Mild discomfort (1 to 3 / 10)
- Moderate discomfort (4 to 6 / 10)
- Severe pain (7 to 9 / 10)
- Worst pain imaginable (10 / 10)`;
    }

    if (nextField === 'duration') {
      return `🎯 Primary Focus: Symptom Duration & Trajectory Check

Thank you for clarifying that. Understanding the timeline helps us establish whether this is an acute self-limiting episode or a subacute progression requiring closer clinical oversight.

How long have you been experiencing this discomfort?

### Follow-up & Feedback Questions:
- Just started a few hours ago
- 1 to 2 days
- Around 3 to 7 days
- More than a week`;
    }

    if (nextField === 'onset') {
      return `🎯 Primary Focus: Symptom Onset & Velocity Analysis

Understood. In clinical diagnostic evaluation, identifying how fast the sensation arrived helps distinguish acute vascular events from progressive tension or inflammatory patterns.

Did this discomfort come on suddenly (reaching peak intensity within minutes) or did it build up gradually over hours or days?

### Follow-up & Feedback Questions:
- Came on suddenly (within minutes)
- Built up gradually over a few hours
- Slowly developed over several days`;
    }

    if (nextField === 'character') {
      return `🎯 Primary Focus: Sensation Quality & Mechanism Check

Thank you for sharing that. The physical quality of the sensation reveals important clues about the underlying physiological mechanism.

How would you describe what the sensation feels like?

### Follow-up & Feedback Questions:
- Throbbing or pulsating
- Sharp and stabbing
- Dull, constant aching pressure
- Burning or tingling sensation`;
    }

    if (nextField === 'location') {
      return `🎯 Primary Focus: Anatomic Focus & Localization

Thank you. Pinpointing the anatomical epicenter allows us to evaluate specific nerve distribution and vascular territories.

Where on your head or body is the discomfort primarily centered?

### Follow-up & Feedback Questions:
- One side only (left or right temple / forehead)
- Both temples or across forehead
- Back of head and neck
- Diffuse / generalized all over`;
    }

    if (nextField === 'radiation') {
      return `🎯 Primary Focus: Radiation & Referral Pathway Check

Thank you. Tracking whether the sensation travels or radiates helps identify dermatomal nerve pathways or referred discomfort.

Does the discomfort stay confined to one specific area, or does it radiate or spread anywhere else?

### Follow-up & Feedback Questions:
- Stays strictly in one spot
- Spreads into neck or shoulder
- Radiates into jaw or face
- Spreads across the entire head`;
    }

    if (nextField === 'aggravatingfactors' || nextField === 'relievingfactors') {
      return `🎯 Primary Focus: Environmental Triggers & Relief Factors

Thank you. Identifying specific triggers and relief patterns helps confirm neurovascular sensitivities and informs effective supportive care.

Have you noticed any triggers that worsen the discomfort (such as bright light, sound, or movement), or anything that has provided relief?

### Follow-up & Feedback Questions:
- Bright light and screen glare worsen it
- Loud sounds or stress worsen it
- Resting in a dark room helps
- Nothing seems to help so far`;
    }

    if (nextField === 'associatedsymptoms') {
      return `🎯 Primary Focus: Accompanying Symptoms & Autonomic Screening

Thank you. Screening for associated symptoms allows us to evaluate systemic involvement and rule out complex neurological presentations.

Are you experiencing any other accompanying symptoms alongside this—such as nausea, visual changes, or dizziness?

### Follow-up & Feedback Questions:
- Nausea or stomach upset
- Sensitivity to light and sound
- Feeling dizzy or lightheaded
- No other symptoms present`;
    }

    // Default specialist opening
    return `🎯 Primary Focus: Specialist Clinical Consultation Intake

Hello, I am Dr. MediBot, your clinical specialist. I am here to help evaluate what you are experiencing with thorough, personalized clinical attention.

To begin our clinical evaluation, could you describe the primary symptom that is troubling you today and how severe it feels right now?

### Follow-up & Feedback Questions:
- I have a headache or head pressure
- I have chest tightness or pain
- I have stomach or abdominal discomfort
- I have general fever or body aches`;
  }

  /**
   * Resilient Fallback model for offline/test environments without API keys.
   */
  static createFallbackModel() {
    return {
      async invoke(messages, options = {}) {
        const sysMsg = Array.isArray(messages) ? messages.find((m) => m._getType?.() === 'system' || m.role === 'system') : null;
        const lastMsg = Array.isArray(messages) ? messages[messages.length - 1] : messages;
        const sysText = typeof sysMsg?.content === 'string' ? sysMsg.content : '';
        const userText = typeof lastMsg?.content === 'string' ? lastMsg.content : '';

        const reply = MediBotLLMFactory.generateSpecialistFallbackResponse(sysText, userText);

        return new AIMessage({
          content: reply,
          response_metadata: {
            modelName: 'medibot-clinical-specialist-engine',
            tokens: { input: Math.round((sysText.length + userText.length) / 4), output: Math.round(reply.length / 4) },
          },
        });
      },
      bindTools(tools) {
        return this;
      },
    };
  }
}


