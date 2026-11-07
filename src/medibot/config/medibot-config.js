/**
 * MediBot Configuration
 * Centralized settings for LangChain models, LangGraph execution, embeddings, and clinical thresholds.
 */

export const medibotConfig = {
  // LLM Model Providers
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    temperature: 0.2,
    maxOutputTokens: 2048,
    timeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS || '25000', 10),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    maxTokens: 2048,
  },
  huggingFace: {
    apiKey: process.env.HUGGINGFACE_API_KEY || '',
  },

  // Embeddings Configuration
  embeddings: {
    provider: process.env.EMBEDDING_PROVIDER || 'gemini', // 'gemini' | 'openai' | 'deterministic'
    geminiModel: 'text-embedding-004',
    openaiModel: 'text-embedding-3-small',
    dimension: 768, // Default 768 matches guideline_embeddings and clinical_embeddings schema
    memoryDimension: 384, // 384 matches patient_memory table schema
  },

  // Document Ingestion & Chunking
  chunking: {
    chunkSize: 500,
    chunkOverlap: 80,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  },

  // RAG Retrieval Parameters
  rag: {
    maxPatientChunks: 8,
    maxGuidelines: 3,
    maxDocuments: 5,
    maxSemanticMemories: 2,
    similarityThreshold: 0.65,
  },

  // Conversation Limits
  conversation: {
    maxPriorEncounters: 4,
    maxContextMessages: 30,
    criticMaxAttempts: 2,
  },

  // Red Flag Emergency Patterns
  redFlagPatterns: [
    { trigger: 'chest pain', message: 'Severe chest pain or pressure requires immediate emergency attention.', regex: /\b(?:severe\s+)?chest\s+pain\b/i },
    { trigger: 'shortness of breath', message: 'Difficulty breathing or sudden shortness of breath is a critical symptom.', regex: /\b(?:shortness\s+of\s+breath|difficulty\s+breathing|can't\s+breathe|cannot\s+breathe)\b/i },
    { trigger: 'loss of consciousness', message: 'Fainting or loss of consciousness requires urgent clinical evaluation.', regex: /\b(?:loss\s+of\s+consciousness|fainting|passed\s+out|fainted)\b/i },
    { trigger: 'sudden weakness', message: 'Sudden weakness or numbness on one side of the face/body may indicate stroke.', regex: /\b(?:sudden\s+weakness|facial\s+droop|arm\s+weakness|face\s+drooping)\b/i },
    { trigger: 'slurred speech', message: 'Sudden slurred speech or confusion may indicate stroke. Call emergency services.', regex: /\b(?:slurred\s+speech|cannot\s+speak\s+clearly|can't\s+speak)\b/i },
    { trigger: 'anaphylaxis', message: 'Signs of anaphylaxis (throat swelling, hives, difficulty breathing) are life-threatening.', regex: /\b(?:anaphylaxis|throat\s+swelling|closing\s+up|severe\s+allergic\s+reaction)\b/i },
    { trigger: 'suicidal ideation', message: 'If you are having thoughts of harming yourself, please reach out immediately to emergency services or a crisis helpline.', regex: /\b(?:want\s+to\s+die|kill\s+myself|end\s+my\s+life|suicid|self.harm|harm\s+myself)\b/i },
    { trigger: 'severe bleeding', message: 'Severe or uncontrolled bleeding requires immediate emergency care.', regex: /\b(?:severe\s+bleeding|uncontrolled\s+bleeding|bleeding\s+heavily|haemorrhage|hemorrhage)\b/i },
  ],

  // Intent Classification Mapping
  intentMapping: [
    { intent: 'symptom_report', regex: /\b(?:pain|fever|cough|symptom|ache|sore|dizzy|nausea|hurt|feel\s+(?:sick|bad|ill|unwell)|breathless|swelling|rash|bleed|vomit|diarrhoea|diarrhea|fatigue|tired|weak)\b/i },
    { intent: 'medication_question', regex: /\b(?:medicine|drug|pill|prescription|dose|dosage|medication|tablet|capsule|take|refill|pharmacy|side effect|interaction)\b/i },
    { intent: 'factual_record_query', regex: /\b(?:record|history|diagnosis|condition|allergy|allergies|blood\s+group|profile)\b/i },
    { intent: 'health_trend_question', regex: /\b(?:trend|heart\s+rate|hrv|sleep|spo2|oxygen|activity|steps|calories|wearable|tracker)\b/i },
    { intent: 'document_question', regex: /\b(?:document|file|report|test|lab|result|scan|x-ray|mri|upload|pdf)\b/i },
    { intent: 'general_health_question', regex: /\b(?:diet|exercise|healthy|nutrition|workout|wellness)\b/i },
  ],
};

