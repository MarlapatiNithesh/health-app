/**
 * MediBot Prompt Ingestion Engine
 * Ingests, formats, and binds dynamic clinical contexts (Patient 360, RAG chunks,
 * episodic memories, emotional states, and symptom triage progress) into LangChain prompt templates.
 */

import { CLINICAL_SYSTEM_PROMPT_TEMPLATE } from './prompt-templates.js';

export class MediBotPromptIngester {
  /**
   * Ingest context and produce a complete formatted system prompt string.
   */
  static async ingestClinicalPrompt({
    patientContext = {},
    ragEvidence = null,
    semanticMemory = [],
    priorEncounters = [],
    emotionState = null,
    symptomState = null,
    nextField = null,
    isSymptomIntent = false,
    assessmentComplete = false,
  }) {
    // 1. Demographics
    const demographics = [
      patientContext.name ? `Name: ${patientContext.name}` : null,
      patientContext.gender ? `Gender: ${patientContext.gender}` : null,
      patientContext.bloodGroup ? `Blood Group: ${patientContext.bloodGroup}` : null,
      patientContext.dateOfBirth ? `DOB: ${patientContext.dateOfBirth}` : null,
    ].filter(Boolean).join(', ') || 'Standard profile';

    // 2. Conditions
    const conditions = (patientContext.activeConditions || [])
      .map((c) => `${c.name || c.conditionName}${c.code ? ` (${c.code})` : ''}`)
      .join(', ') || 'None recorded';

    // 3. Medications
    const medications = (patientContext.activeMedications || [])
      .map((m) => `${m.name || m.medicationName}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`)
      .join(', ') || 'None active';

    // 4. Allergies
    const allergies = (patientContext.allergies || [])
      .map((a) => `${a.substance || a.name || a.allergen}${a.severity ? ` [${a.severity}]` : ''}`)
      .join(', ') || 'No known drug allergies (NKDA)';

    // 5. Recent Labs
    const recentLabs = (patientContext.recentLabs || [])
      .map((l) => `${l.name || l.testName}: ${l.valueNum || l.valueText || ''} ${l.unit || ''} (Ref: ${l.refLow || '?'}-${l.refHigh || '?'})`)
      .join('; ') || 'None on file';

    // 6. Vitals
    const vitals = patientContext.recentVitals
      ? Object.entries(patientContext.recentVitals)
          .map(([k, v]) => `${k}: ${v?.value || v}`)
          .join(', ')
      : 'No recent telemetry recorded';

    // 7. RAG Evidence (Patient documents & vector chunks)
    let ragEvidenceText = 'No relevant prior documents retrieved.';
    if (ragEvidence) {
      const parts = [];
      if (ragEvidence.vectorChunks && ragEvidence.vectorChunks.length > 0) {
        parts.push(
          'Clinical Document Chunks:\n' +
          ragEvidence.vectorChunks
            .map((c, i) => `[Chunk ${i + 1} - Sec: ${c.section || 'General'}] ${c.contentText}`)
            .join('\n')
        );
      }
      if (ragEvidence.documents && ragEvidence.documents.length > 0) {
        parts.push(
          'Uploaded Documents Summary:\n' +
          ragEvidence.documents
            .map((d) => `- ${d.originalFilename || d.docType}: ${d.summary || 'Uploaded document'}`)
            .join('\n')
        );
      }
      if (parts.length > 0) {
        ragEvidenceText = parts.join('\n\n');
      }
    }

    // 8. Prior Encounters
    const priorEncountersText = (priorEncounters || [])
      .slice(0, 3)
      .map((e, idx) => `[Visit ${idx + 1} (${e.createdAt ? new Date(e.createdAt).toLocaleDateString() : 'recent'})] Intent: ${e.intent || 'General'}, Summary: ${e.summary || 'None'}`)
      .join('\n') || 'None recorded.';

    // 9. Semantic Memory
    const semanticMemoryText = (semanticMemory || [])
      .slice(0, 2)
      .map((m, idx) => `[Recall ${idx + 1}]: ${typeof m === 'string' ? m : m.summaryText || JSON.stringify(m)}`)
      .join('\n') || 'No previous relevant memories retrieved.';

    // 10. Emotion & Guidance
    let emotionGuidance = 'Patient affect appears calm and neutral. Maintain standard empathetic clinical tone.';
    if (emotionState?.emotion && emotionState.emotion !== 'neutral') {
      emotionGuidance = `Detected Patient Emotion: ${emotionState.emotion.toUpperCase()} (Intensity: ${emotionState.intensity || 'moderate'}). Tone Directive: ${emotionState.guidance || 'Respond with reassurance, warmth, and supportive validation.'}`;
    }

    // 11. Symptom State & Next Field
    let symptomStateText = 'No active symptom report being evaluated.';
    let isAssessmentActive = 'false';
    let nextFieldDirective = 'None (Open medical discussion)';

    const fieldGuidanceMap = {
      severity: {
        rationale: 'Calibrating symptom intensity determines clinical acuity, triage urgency, and safe home management thresholds.',
        questionGuidance: 'Ask the patient to rate their discomfort on a standardized 0 to 10 scale (0 = completely pain-free, 10 = worst imaginable pain).',
        options: [
          'Mild discomfort (1 to 3 / 10)',
          'Moderate discomfort (4 to 6 / 10)',
          'Severe pain (7 to 9 / 10)',
          'Worst pain imaginable (10 / 10)',
        ],
      },
      duration: {
        rationale: 'Establishes whether the condition is hyperacute (<24h), acute, subacute, or chronic, directly shaping differential diagnosis.',
        questionGuidance: 'Ask how long this episode has been present and whether it is persistent or intermittent.',
        options: [
          'Just started a few hours ago',
          '1 to 2 days',
          '3 to 7 days',
          'More than a week',
        ],
      },
      onset: {
        rationale: 'Distinguishes sudden-onset emergencies (e.g. thunderclap vascular events) from progressive inflammatory or tension processes.',
        questionGuidance: 'Ask whether the discomfort began abruptly (reaching maximum intensity in seconds or minutes) or built up gradually.',
        options: [
          'Came on suddenly (within minutes)',
          'Built up gradually over a few hours',
          'Slowly developed over several days',
        ],
      },
      character: {
        rationale: 'Identifies the pathophysiological mechanism (e.g. vascular throbbing vs. neuropathic burning vs. muscular dull pressure vs. visceral colicky ache).',
        questionGuidance: 'Ask the patient to describe the physical sensation (throbbing, sharp, dull ache, heavy pressure, or burning).',
        options: [
          'Throbbing or pulsating',
          'Sharp or stabbing sensation',
          'Dull, constant aching pressure',
          'Burning or tingling sensation',
        ],
      },
      location: {
        rationale: 'Pinpoints the precise anatomical origin and nerve distribution (e.g., unilateral temporal vs. occipital vs. retro-orbital).',
        questionGuidance: 'Ask where on the body the discomfort is most intensely felt, and whether it is localized to one side or bilateral.',
        options: [
          'One side only (left or right temple / forehead)',
          'Both temples or across forehead',
          'Back of the head and upper neck',
          'Diffuse / generalized all over',
        ],
      },
      radiation: {
        rationale: 'Traces dermatomal or referral patterns (e.g., cardiac radiation to left arm/jaw, or cervical root radiation to shoulder).',
        questionGuidance: 'Ask whether the discomfort spreads or radiates to any other anatomical region.',
        options: [
          'Stays strictly in one spot',
          'Spreads into neck or shoulder',
          'Radiates into jaw or face',
          'Spreads across the entire head',
        ],
      },
      aggravatingFactors: {
        rationale: 'Reveals environmental, biomechanical, or sensory triggers (e.g., photophobia, movement, food triggers, coughing).',
        questionGuidance: 'Inquire whether specific activities, bright lights, sounds, or postural changes noticeably worsen the discomfort.',
        options: [
          'Bright light and screen glare worsen it',
          'Loud sounds or stress worsen it',
          'Physical movement or bending forward worsens it',
          'Nothing specific seems to make it worse',
        ],
      },
      relievingFactors: {
        rationale: 'Assesses response to resting, dark environments, temperature modalities, or hydration, confirming benign vs. resistant patterns.',
        questionGuidance: 'Ask what, if anything, has provided partial or temporary relief so far.',
        options: [
          'Resting in a dark, quiet room helps',
          'Cold or warm compress brings relief',
          'Hydration and lying down eases it',
          'Nothing has provided relief yet',
        ],
      },
      associatedSymptoms: {
        rationale: 'Screens for systemic involvement, autonomic activation, or neurological red flags (e.g., nausea, aura, fever, dizziness).',
        questionGuidance: 'Ask whether any other symptoms are occurring alongside the main complaint, such as nausea, visual changes, or dizziness.',
        options: [
          'Nausea or stomach queasiness',
          'Sensitivity to light and sound',
          'Dizziness or lightheadedness',
          'No other symptoms present',
        ],
      },
      primarySymptom: {
        rationale: 'Clarifies the chief complaint to establish the diagnostic baseline.',
        questionGuidance: 'Warmly ask the patient to describe the primary health concern or symptom that prompted their consultation today.',
        options: [
          'Headache or head pressure',
          'Chest pain or tightness',
          'Stomach or abdominal pain',
          'Fever or full-body aches',
        ],
      },
    };

    if (isSymptomIntent && symptomState) {
      isAssessmentActive = assessmentComplete ? 'Assessment Complete (Sufficient Information Gathered)' : 'Active - Gathering Clinical Details';
      const fields = Object.entries(symptomState)
        .filter(([k, v]) => v && !['riskAssessed', 'riskLevel', 'triggeredRules', 'summaryGenerated'].includes(k))
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
      symptomStateText = fields.length > 0 ? fields.join(' | ') : 'Initiating assessment';

      if (!assessmentComplete && nextField) {
        const guide = fieldGuidanceMap[nextField] || {
          rationale: `Gathering detail on ${nextField}.`,
          questionGuidance: `Inquire specifically about ${nextField}.`,
          options: [
            'Mild / Occasional',
            'Moderate / Noticeable',
            'Severe / Continuous',
            'Not sure / Other',
          ],
        };
        const optionsList = guide.options.map((opt) => `- ${opt}`).join('\n');

        nextFieldDirective = `
ACTIVE SPECIALIST QUESTIONING DIRECTIVE:
Ask specifically about: ${nextField.toUpperCase()}. Keep your question simple and single-focused.
- Required Next Clinical Dimension: [${nextField.toUpperCase()}]
- Clinical Rationale: ${guide.rationale}
- Question Objective: ${guide.questionGuidance}
- Specialist Doctor Instruction:
  1. START with the Primary Focus badge:
     🎯 Primary Focus: [3 to 6 word summary of chief symptom being explored]
  2. BEDSIDE VALIDATION: Acknowledge the patient's discomfort with sincere clinical empathy and active listening.
  3. SPECIALIST INQUIRY: Share a brief (1 sentence) clinical rationale explaining why this detail is valuable, followed by EXACTLY ONE natural, focused question targeting ${nextField}.
  4. INTERACTIVE CHIPS: Conclude with these exact 3-4 quick-response choices under "### Follow-up & Feedback Questions:":
${optionsList}
  5. DO NOT bundle multiple questions or provide premature differential diagnosis yet.
`.trim();
      } else if (assessmentComplete) {
        nextFieldDirective = `
CLINICAL ASSESSMENT COMPLETE DIRECTIVE:
All key fields collected. Summarize differential assessment and advise next clinical steps.
- Diagnostic Status: Sufficient clinical details have been obtained for a comprehensive specialist consultation.
- Specialist Doctor Instruction:
  1. START with the Primary Focus badge:
     🎯 Primary Focus: [3 to 6 word summary, e.g. "Comprehensive Clinical Evaluation & Triage Plan"]
  2. BEDSIDE SYNTHESIS: Warmly synthesize the complete symptom constellation (onset, duration, severity, character, aggravating factors, and location).
  3. SYSTEMATIC CONSULTATION SECTIONS (Maintain Exact Icons & Headers):
     ### 🩺 Clinical Impression & Differential Considerations
     - Share 2-3 plausible differential possibilities in accessible terms (e.g. migraine, tension headache with vascular features).
     ### 🩹 Practical At-Home Care & Supportive Relief
     - Detail 3-4 safe, evidence-based self-care comfort measures (dark room rest, hydration, cool/warm compress, trigger avoidance).
     ### ⚠️ Red Flag Warning Signs (Seek Emergency Care Immediately)
     - List acute red flags that require emergency room evaluation (sudden thunderclap onset, fever with neck stiffness, focal weakness, slurred speech).
     ### 📋 Recommended Next Clinical Steps
     - Actionable advice on consulting an in-person physician or urgent care clinic.
     ### 🤝 Follow-Up & Clinical Alignment
     - Open follow-up invitation: "Is there anything else concerning you, or any other symptoms you'd like to check today?"
     - Model accuracy feedback request: "Was this consultation helpful for you? (Please tap 👍 or 👎 or share your feedback below—this directly helps train and refine our clinical AI accuracy for future care)."
  4. CLOSING CHIPS: Include quick reply chips under "### Follow-up & Feedback Questions:":
     - Yes, this was very helpful!
     - I have another symptom to discuss
     - When should I see a doctor?
     - All good for now, thank you!
`.trim();
      }
    }

    // Ingest into LangChain template
    return await CLINICAL_SYSTEM_PROMPT_TEMPLATE.format({
      demographics,
      conditions,
      medications,
      allergies,
      recentLabs,
      vitals,
      ragEvidenceText,
      priorEncountersText,
      semanticMemoryText,
      emotionGuidance,
      symptomStateText,
      isAssessmentActive,
      nextFieldDirective,
    });
  }
}

