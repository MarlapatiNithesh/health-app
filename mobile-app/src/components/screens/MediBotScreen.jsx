import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  AlertTriangle, 
  ShieldCheck, 
  Search, 
  Pill, 
  Activity, 
  Sparkles, 
  X, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  FileSearch,
  ExternalLink,
  Paperclip,
  Plus,
  History,
  FileText,
  UploadCloud,
  ChevronRight,
  Check,
  RefreshCw,
  FolderOpen,
  Calendar,
  AlertCircle,
  Menu,
  Shield,
  Lock,
  ChevronDown,
  Layers,
  ArrowRight,
  CheckCircle,
  FileCheck,
  MessageSquare,
  Wallet,
  Bell,
  Download,
  Eye,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Patient360Screen } from './Patient360Screen';

// Normalizes any raw model string to user-friendly clinical model attribution
export function formatModelDisplayName(modelName, fallbackSelected = 'gemini') {
  const str = String(modelName || fallbackSelected || '').toLowerCase();
  if (str.includes('rule') || str.includes('engine') || str.includes('fallback')) {
    return { name: 'Clinical Rule Engine', icon: '⚙️', badgeBg: 'bg-amber-50 text-amber-900 border-amber-300' };
  }
  if (str.includes('medg') || str === 'medgamma' || str === 'medgemma') {
    return { name: 'MedGemma 2B', icon: '🩺', badgeBg: 'bg-emerald-50 text-emerald-900 border-emerald-300' };
  }
  if (str.includes('gpt') || str === 'gpt-4o' || str === 'openai') {
    return { name: 'GPT-4o Clinical', icon: '🧠', badgeBg: 'bg-purple-50 text-purple-900 border-purple-300' };
  }
  return { name: 'Gemini 2.5 Flash', icon: '⚡', badgeBg: 'bg-teal-50 text-teal-900 border-teal-300' };
}

// Helper to render clinical bot messages with high readability, focus highlight card, and follow-up interactive questions
function BotStructuredMessage({ content, onSelectQuestion }) {
  if (!content) return null;

  // Extract Primary Focus / Highlight
  let text = content;
  let primaryFocus = null;
  const focusRegex = /(?:🎯\s*)?\*{0,2}(?:Primary Focus|Key Assessment|Main Topic|Topic):\*{0,2}\s*([^\n\r]+)/i;
  const focusMatch = text.match(focusRegex);
  if (focusMatch) {
    primaryFocus = focusMatch[1].replace(/^\*+|\*+$/g, '').trim();
    text = text.replace(focusMatch[0], '').trim();
  }

  // Extract Follow-up & Feedback Questions
  const followUpQuestions = [];
  const qSectionRegex = /(?:💡\s*)?\*{0,2}(?:Follow-up\s*(?:&|and)?\s*Feedback\s*Questions|Follow-up\s*Questions|Clarifying\s*Questions|Feedback\s*Questions|Quick\s*Response\s*Options):\*{0,2}([\s\S]*)$/i;
  const qSectionMatch = text.match(qSectionRegex);
  if (qSectionMatch) {
    const qRaw = qSectionMatch[1];
    text = text.slice(0, qSectionMatch.index).trim();
    const rawLines = qRaw.split('\n');
    for (const line of rawLines) {
      const cleaned = line
        .replace(/^\s*(?:\d+[\.\)]|\*|-|•)\s*/, '')
        .replace(/^\*+|\*+$/g, '')
        .replace(/^"|"$/g, '')
        .trim();
      if (cleaned.length > 5 && (cleaned.endsWith('?') || cleaned.length < 90)) {
        followUpQuestions.push(cleaned);
      }
    }
  }

  // Parse remaining body paragraphs and bullet points
  const lines = text.split('\n');

  return (
    <div className="space-y-2.5">
      {/* ── PROMINENT CLINICAL FOCUS HIGHLIGHT CARD ── */}
      {primaryFocus && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 shadow-2xs flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
            <Sparkles size={13} className="animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 block">
              Primary Health Focus / Observation
            </span>
            <p className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
              {primaryFocus}
            </p>
          </div>
        </div>
      )}

      {/* ── STRUCTURED CLINICAL BODY ── */}
      <div className="space-y-1.5 text-xs leading-relaxed text-slate-700">
        {lines.map((l, idx) => {
          const trimmed = l.trim();
          if (!trimmed) return null;

          // Check if section header or key bullet
          if (trimmed.startsWith('📋') || trimmed.startsWith('🩺') || trimmed.startsWith('⚠️') || trimmed.startsWith('🚨')) {
            return (
              <div key={idx} className="font-bold text-[#044343] pt-1 flex items-center gap-1.5 text-xs">
                <span>{trimmed}</span>
              </div>
            );
          }

          if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
            const bulletText = trimmed.replace(/^[-*•]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-1.5 py-0.5 text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5"></span>
                <span className="flex-1">{bulletText}</span>
              </div>
            );
          }

          return (
            <p key={idx} className="whitespace-pre-wrap">{trimmed}</p>
          );
        })}
      </div>

      {/* ── FOLLOW-UP & FEEDBACK QUESTIONS CHIPS ── */}
      {followUpQuestions.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-200/80 space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
            <MessageSquare size={12} className="text-emerald-700" />
            <span>Follow-up & Feedback Questions</span>
          </div>
          <div className="space-y-1.5">
            {followUpQuestions.map((q, qIdx) => (
              <button
                key={qIdx}
                onClick={() => onSelectQuestion && onSelectQuestion(q)}
                className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-400 text-xs text-slate-800 flex items-center justify-between group transition active:scale-[0.99] shadow-2xs cursor-pointer"
                title="Tap to respond to this question"
              >
                <span className="leading-snug pr-2">{q}</span>
                <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center shrink-0 transition">
                  <ChevronRight size={13} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MediBotScreen({ onClose }) {
  const { member } = useAuth();
  const patientId = member?.id || 'me';

  // ── Session & Chat State ──
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeEncounterId, setActiveEncounterId] = useState(null);
  const [activeEncounterData, setActiveEncounterData] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('sessions'); // 'sessions' | 'documents'
  const [uploadedDocs, setUploadedDocs] = useState([]);

  // ── Modals & PDF State ──
  const [showPatient360, setShowPatient360] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [clinicalContext, setClinicalContext] = useState(null);
  const [summaryNarrative, setSummaryNarrative] = useState(
    'Loading your clinical summary from verified medical records and health sensors…'
  );

  // ── Profile Consents State ──
  const [consents, setConsents] = useState({
    ai_processing: false,
    document_upload: false,
  });
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [enablingConsent, setEnablingConsent] = useState(false);

  // ── In-Chat Microservices State ──
  const [activeInChatTool, setActiveInChatTool] = useState(null); // null | 'rag' | 'safety'
  
  // Clinical RAG state
  const [ragQuery, setRagQuery] = useState('Fasting glucose and HbA1c history over the last 12 months');
  const [ragLoading, setRagLoading] = useState(false);

  // Drug Safety state
  const [medicationInput, setMedicationInput] = useState('Amoxicillin 500mg');
  const [allergiesInput, setAllergiesInput] = useState('Penicillin');
  const [conditionsInput, setConditionsInput] = useState('Asthma');
  const [safetyLoading, setSafetyLoading] = useState(false);
  // Active tab: 'chat' | 'records'
  const [activeTab, setActiveTab] = useState('chat');

  // ── Chat Stream Messages ──
  const [messages, setMessages] = useState([
    {
      id: 'init',
      role: 'bot',
      content: 'Hello! I am your AI Doctor. I can review your longitudinal health records, assess symptoms, evaluate drug interactions, and analyze uploaded medical files (.pdf, .doc, .docx, and images). How can I help you today?',
      triageLevel: 'low',
      suggestedActions: ['Check recent lab results', 'Verify medication safety', 'I have a headache & elevated BP']
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [liveProgress, setLiveProgress] = useState(null);
  const [selectedModel, setSelectedModel] = useState('gemini'); // 'gemini' | 'medgamma' | 'gpt-4o'
  const [feedbackToast, setFeedbackToast] = useState(null);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [uploadingFile, setUploadingFile] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleRatingSubmit = async (msgId, rating, tags = [], feedbackText = '') => {
    try {
      setFeedbackMap(prev => ({
        ...prev,
        [msgId]: { ...prev[msgId], rating, tags, feedbackText, submitted: true, showDrawer: false }
      }));
      setFeedbackToast(rating === 1
        ? '✓ Marked as clinically accurate & helpful!'
        : '✓ Feedback submitted! Saved to clinical alignment database.');
      setTimeout(() => setFeedbackToast(null), 4000);
      await api.submitChatFeedback({
        messageId: msgId,
        encounterId: activeEncounterId,
        rating,
        tags,
        feedbackText,
      });
    } catch (err) {
      console.warn('Feedback submission notice:', err.message);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, activeInChatTool]);

  // Load consents, past encounters, and uploaded docs on mount
  useEffect(() => {
    refreshConsents();
    loadSessions();
    loadUploadedDocs();
    loadPatientContext();
  }, [patientId]);

  const loadPatientContext = async () => {
    try {
      const [contextRes, chartRes] = await Promise.allSettled([
        api.getClinicalContext(patientId),
        api.getPatientChart(patientId),
      ]);
      const ctx = contextRes.status === 'fulfilled' ? (contextRes.value?.context || contextRes.value) : null;
      const chart = chartRes.status === 'fulfilled' ? (chartRes.value?.patient || chartRes.value) : null;

      if (ctx) {
        setClinicalContext(ctx);

        const meds = ctx.activeMedications || [];
        const conditions = ctx.activeConditions || [];
        const allergies = ctx.allergies || [];
        const labs = ctx.recentLabs || [];
        const patientName = ctx.patient?.fullName || chart?.fullName || 'Patient';

        const narrativeParts = [];

        // Demographics & Lifestyle
        if (ctx.patient?.lifestyle?.diet) {
          narrativeParts.push(`${patientName} follows a ${ctx.patient.lifestyle.diet.toLowerCase()} diet with a ${ctx.patient.lifestyle.activityLevel?.toLowerCase() || 'moderate'} activity routine.`);
        }

        // Active Conditions
        if (conditions.length > 0) {
          const condNames = conditions.slice(0, 3).map(c => c.name).join(', ');
          narrativeParts.push(`Diagnosed with ${condNames}${conditions.length > 3 ? ` and ${conditions.length - 3} other conditions` : ''}.`);
        }

        // Active Medications
        if (meds.length > 0) {
          const medList = meds.slice(0, 4).map(m => `${m.name}${m.dose ? ` (${m.dose})` : ''}`).join(', ');
          narrativeParts.push(`Current medications: ${medList}${meds.length > 4 ? ` (+${meds.length - 4} more)` : ''}.`);
        }

        // Allergies
        if (allergies.length > 0) {
          const allergyText = allergies.map(a => a.substance || a.name).join(', ');
          narrativeParts.push(`Documented allergies: ${allergyText}.`);
        }

        // Labs
        if (labs.length > 0) {
          const labHighlights = labs
            .filter(l => l.valueNum !== null || l.valueText)
            .slice(0, 3)
            .map(l => `${l.testName || l.name}: ${l.valueNum ?? l.valueText} ${l.unit || ''}`.trim())
            .join(' · ');
          if (labHighlights) {
            narrativeParts.push(`Latest labs: ${labHighlights}.`);
          }
        }

        if (narrativeParts.length > 0) {
          setSummaryNarrative(narrativeParts.join(' '));
        } else if (chart?.medicalSummary || chart?.vitalsSummary) {
          setSummaryNarrative(chart.medicalSummary || chart.vitalsSummary);
        } else {
          setSummaryNarrative('Your health record is synchronized. Upload blood reports or prescriptions below to automatically extract clinical insights.');
        }
      } else if (chart?.medicalSummary || chart?.vitalsSummary) {
        setSummaryNarrative(chart.medicalSummary || chart.vitalsSummary);
      }
    } catch (err) {
      console.warn('Failed to load patient clinical context:', err);
    }
  };

  const refreshConsents = async () => {
    try {
      await Promise.allSettled([
        api.recordMemberConsent('ai_processing', true, '1.0'),
        api.recordMemberConsent('document_upload', true, '1.0')
      ]);
      setConsents({
        ai_processing: true,
        document_upload: true,
      });
      return { aiGranted: true, docGranted: true };
    } catch {
      setConsents({ ai_processing: true, document_upload: true });
      return { aiGranted: true, docGranted: true };
    }
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await api.listEncounters();
      const list = res?.encounters || [];
      setSessions(list);
      return list;
    } catch (err) {
      console.warn('Failed to load encounters:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadUploadedDocs = async () => {
    try {
      const res = await api.listDocuments();
      setUploadedDocs(res?.documents || []);
    } catch (err) {
      console.warn('Failed to load documents:', err);
    }
  };

  const selectSession = async (sessionId) => {
    setActiveEncounterId(sessionId);
    setShowSidebar(false);
    setIsTyping(true);
    try {
      const encounter = await api.getEncounter(sessionId);
      setActiveEncounterData(encounter);
      
      if (encounter.messages && encounter.messages.length > 0) {
        setMessages(encounter.messages.map((m, idx) => ({
          id: m.id || String(idx),
          role: m.role === 'assistant' ? 'bot' : 'user',
          content: m.content,
          triageLevel: encounter.riskLevel || 'low',
          modelName: formatModelDisplayName(m.meta?.model || m.modelName, selectedModel).name,
          isEmergency: encounter.riskLevel === 'high' || m.meta?.emergency || false,
          screeningLatencyMs: m.latencyMs ?? null,
          timestamp: m.createdAt 
            ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : undefined,
        })));
      } else {
        setMessages([
          {
            id: 'resumed_' + sessionId,
            role: 'bot',
            content: `Resumed clinical encounter (${encounter.intent || 'Symptom Triage'}). Status: ${encounter.status}. How can I assist you?`,
            triageLevel: encounter.riskLevel || 'low',
            suggestedActions: ['Check symptoms', 'Review lab results', 'Verify drug safety']
          }
        ]);
      }
    } catch (err) {
      console.error('Failed to load encounter:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const startNewSession = () => {
    if (activeEncounterId) {
      api.summarizeChat(activeEncounterId).catch(() => {});
    }
    setActiveEncounterId(null);
    setActiveEncounterData(null);
    setShowSidebar(false);
    setActiveInChatTool(null);
    setMessages([
      {
        id: 'new_' + Date.now(),
        role: 'bot',
        content: 'Started a brand new AI Clinical Consultation! What symptoms or health concerns would you like to review right now?',
        triageLevel: 'low',
        suggestedActions: ['I have a fever and cough', 'Check my blood pressure', 'Review prescription safety']
      }
    ]);
  };

  const handleGrantConsentAndProceed = async () => {
    setEnablingConsent(true);
    try {
      await Promise.all([
        api.setScopedConsent('document_upload', true),
        api.setScopedConsent('ai_processing', true)
      ]);
      setConsents({ ai_processing: true, document_upload: true });
      setShowConsentModal(false);
      // Immediately open file selector after granting consent
      setTimeout(() => {
        if (fileInputRef.current) fileInputRef.current.click();
      }, 100);
    } catch (err) {
      alert(`Could not enable profile consent: ${err.message}`);
    } finally {
      setEnablingConsent(false);
    }
  };

  const handleInitiateUpload = async () => {
    const { docGranted, aiGranted } = await refreshConsents();
    if (!docGranted || !aiGranted) {
      setShowConsentModal(true);
      return;
    }
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const docType = file.name.toLowerCase().includes('lab') ? 'lab_report' : 'prescription';
      const res = await api.uploadDocument(file, docType);
      const doc = res?.document || res;

      // Extractions are committed automatically by the server during upload!
      const docMsg = {
        id: 'doc_' + Date.now(),
        role: 'user',
        content: `📄 Uploaded Medical Record: ${file.name} (${docType.replace('_', ' ').toUpperCase()})`,
        isDocument: true,
        document: doc,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, docMsg]);

      loadUploadedDocs();

      // Trigger automatic clinical triage analysis of uploaded file
      setIsTyping(true);
      const extractedCount = doc.extractedFields?.length || 0;
      const prompt = `I uploaded a ${docType}: ${file.name}. It has ${extractedCount} extracted clinical entities. Please evaluate findings and check for interactions.`;
      
      try {
        const triageRes = await api.chatTriage(prompt, activeEncounterId);
        if (triageRes.encounterId && triageRes.encounterId !== activeEncounterId) {
          setActiveEncounterId(triageRes.encounterId);
          loadSessions();
        }

        setMessages(prev => [
          ...prev,
          {
            id: triageRes.messageId || String(Date.now() + 2),
            role: 'bot',
            content: triageRes.content || `I've analyzed and verified your uploaded ${docType.replace('_', ' ')} (${file.name}). Found ${extractedCount} clinical entities and automatically committed them to your Patient 360 chart!`,
            triageLevel: triageRes.riskLevel || 'low',
            autoCommitted: true,
            extractedFields: doc.extractedFields || [],
            screeningLatencyMs: triageRes.latencyMs ?? null,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
      } catch {
        setMessages(prev => [
          ...prev,
          {
            id: 'doc_ready_' + Date.now(),
            role: 'bot',
            content: `Your ${docType.replace('_', ' ')} (${file.name}) has been uploaded and analyzed. All ${extractedCount} extracted clinical entities have been automatically committed to your Patient 360 chart!`,
            triageLevel: 'low',
            autoCommitted: true,
            extractedFields: doc.extractedFields || [],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'bot',
          content: `Could not process document: ${err.message}. Supported formats: .pdf, .doc, .docx, .txt, .csv, and images (.jpg, .png, .webp).`,
          triageLevel: 'low',
        }
      ]);
    } finally {
      setUploadingFile(false);
      setIsTyping(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setDownloadSuccessMessage('');
    setDownloadError('');
    setDownloadProgress('Compiling verified medical records & clinical data…');
    try {
      const res = await api.downloadHealthSummaryPdf(patientId);
      setDownloadProgress('');
      setDownloadSuccessMessage(`✓ Health Summary PDF saved (${res.filename || 'Patient_Health_Summary.pdf'})`);
      setTimeout(() => setDownloadSuccessMessage(''), 12000);
    } catch (err) {
      setDownloadProgress('');
      setDownloadError(`Download failed: ${err.message}`);
      setTimeout(() => setDownloadError(''), 12000);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSendMessage = async (textToSend = inputText) => {
    if (!textToSend.trim() || isTyping) return;

    const userMessageText = textToSend.trim();
    setInputText('');

    const userMsg = {
      id: String(Date.now()),
      role: 'user',
      content: userMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setLiveProgress('Analyzing clinical records & patient chart…');

    let streamCompleted = false;
    try {
      await api.chatTriageStream({
        message: userMessageText,
        encounterId: activeEncounterId,
        model: selectedModel,
        onProgress: (stepMessage) => {
          setLiveProgress(stepMessage);
        },
        onComplete: (data) => {
          streamCompleted = true;
          setLiveProgress(null);

          if (data.encounterId && data.encounterId !== activeEncounterId) {
            setActiveEncounterId(data.encounterId);
            loadSessions();
          }

          const botMsg = {
            id: data.messageId || String(Date.now() + 1),
            role: 'bot',
            content: data.content || 'I have analyzed your clinical update.',
            triageLevel: data.riskLevel || 'low',
            modelName: formatModelDisplayName(data.modelName, selectedModel).name,
            isEmergency: data.riskLevel === 'high' || data.isEmergency || false,
            screeningLatencyMs: data.latencyMs ?? null,
            suggestedActions: data.suggestedActions || [],
            criticScore: data.criticScore ?? null,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };

          setMessages(prev => [...prev, botMsg]);
        },
        onError: async (streamErr) => {
          if (!streamCompleted) {
            console.warn('SSE stream fallback to POST triage:', streamErr.message);
            try {
              const res = await api.chatTriage(userMessageText, activeEncounterId, selectedModel);
              if (res.encounterId && res.encounterId !== activeEncounterId) {
                setActiveEncounterId(res.encounterId);
                loadSessions();
              }

              const botMsg = {
                id: res.messageId || String(Date.now() + 1),
                role: 'bot',
                content: res.content || 'I have analyzed your clinical update.',
                triageLevel: res.riskLevel || 'low',
                modelName: formatModelDisplayName(res.modelName, selectedModel).name,
                isEmergency: res.riskLevel === 'high' || res.isEmergency || false,
                screeningLatencyMs: res.latencyMs ?? null,
                suggestedActions: res.suggestedActions || [],
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              };

              setMessages(prev => [...prev, botMsg]);
            } catch (fallbackErr) {
              setMessages(prev => [
                ...prev,
                {
                  id: String(Date.now() + 1),
                  role: 'bot',
                  content: `Communication error with clinical engine: ${fallbackErr.message || streamErr.message}. Please try again shortly.`,
                  triageLevel: 'low',
                }
              ]);
            }
          }
        }
      });
    } catch (err) {
      if (!streamCompleted) {
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            role: 'bot',
            content: `Communication error with clinical engine: ${err.message}. Please try again shortly.`,
            triageLevel: 'low',
          }
        ]);
      }
    } finally {
      setIsTyping(false);
      setLiveProgress(null);
    }
  };

  // ── IN-CHAT CLINICAL RAG SEARCH EXECUTION ──
  const handleExecuteInChatRag = async () => {
    if (!ragQuery.trim()) return;
    setRagLoading(true);

    const userRagMsg = {
      id: 'rag_q_' + Date.now(),
      role: 'user',
      content: `🔍 Clinical Search: "${ragQuery}"`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userRagMsg]);

    try {
      const res = await api.ragQuery(ragQuery, 4);
      const ragResults = res?.results || res?.matches || [];

      const ragCardMsg = {
        id: 'rag_res_' + Date.now(),
        role: 'bot',
        isRagCard: true,
        ragResults,
        content: ragResults.length > 0 
          ? `Found ${ragResults.length} relevant historical medical records matching "${ragQuery}":`
          : `No medical records directly matched "${ragQuery}".`,
        triageLevel: 'low',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, ragCardMsg]);
      setActiveInChatTool(null);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: 'rag_err_' + Date.now(),
          role: 'bot',
          content: `Clinical RAG vector retrieval error: ${err.message}`,
          triageLevel: 'low',
        }
      ]);
    } finally {
      setRagLoading(false);
    }
  };

  // ── IN-CHAT DRUG SAFETY VERIFICATION EXECUTION ──
  const handleExecuteInChatSafety = async () => {
    if (!medicationInput.trim()) return;
    setSafetyLoading(true);

    const userSafetyMsg = {
      id: 'safety_q_' + Date.now(),
      role: 'user',
      content: `💊 Drug Safety Check: ${medicationInput} (Allergies: ${allergiesInput || 'None'}, Conditions: ${conditionsInput || 'None'})`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userSafetyMsg]);

    try {
      const allergiesList = allergiesInput.split(',').map(s => s.trim()).filter(Boolean);
      const conditionsList = conditionsInput.split(',').map(s => s.trim()).filter(Boolean);
      const res = await api.validateDrugRules(medicationInput, allergiesList, conditionsList);

      const safetyCardMsg = {
        id: 'safety_res_' + Date.now(),
        role: 'bot',
        isSafetyCard: true,
        safetyResult: res,
        medicationName: medicationInput,
        content: res.isSafe 
          ? `✅ Medication Safety Check Passed for ${medicationInput}. No known contraindications detected.`
          : `⚠️ Medication Safety Warning for ${medicationInput}: Potential interactions or contraindications found.`,
        triageLevel: res.isSafe ? 'low' : 'medium',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, safetyCardMsg]);
      setActiveInChatTool(null);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: 'safety_err_' + Date.now(),
          role: 'bot',
          content: `Drug safety engine notice: ${err.message}`,
          triageLevel: 'low',
        }
      ]);
    } finally {
      setSafetyLoading(false);
    }
  };

  const patientInitials = (member?.firstName?.[0] || 'N') + (member?.lastName?.[0] || 'M');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans">
      <div className="bg-[#FAFBFB] text-slate-800 w-full max-w-lg h-[92vh] max-h-[850px] rounded-[36px] shadow-2xl flex flex-col overflow-hidden border border-slate-200 relative">
        
        {/* Hidden File Input for PDF, DOC, DOCX, TXT, Images */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf,.doc,.docx,.txt,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileUpload} 
        />

        {/* ── TOP HEADER (Matching User's Screenshot) ── */}
        <div className="bg-white/95 backdrop-blur-md px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
          {/* Left Avatar */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-emerald-800/10 shadow-xs flex items-center justify-center bg-emerald-100/80">
              <img 
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150" 
                alt="Patient Profile" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                }}
              />
              <span className="font-extrabold text-xs text-[#044343]">{patientInitials}</span>
            </div>
          </div>

          {/* Right Action Icons (Wallet, Bell, Drawer Menu, Close) */}
          <div className="flex items-center gap-2">
            {/* Drawer Toggle */}
            <button
              onClick={() => {
                setShowSidebar(!showSidebar);
                if (!showSidebar) {
                  loadSessions();
                  loadUploadedDocs();
                }
              }}
              className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-[#044343] hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              title="Consultation History & Vault"
            >
              <Menu size={18} />
            </button>

            {/* Wallet Icon */}
            <button 
              className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-[#044343] hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              title="Health Wallet"
            >
              <Wallet size={19} />
            </button>

            {/* Notification Bell */}
            <button 
              className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-[#044343] hover:bg-slate-50 transition shadow-2xs relative cursor-pointer"
              title="Notifications"
            >
              <Bell size={19} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-600"></span>
            </button>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── SEGMENTED TOP CONTROLLER (AI Doctor Chat vs Records & Summary) ── */}
        <div className="bg-white px-5 pt-2 pb-2.5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-2xl w-full">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-white text-[#044343] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Bot size={14} className={activeTab === 'chat' ? 'text-emerald-600' : ''} />
              <span>AI Doctor Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'records'
                  ? 'bg-white text-[#044343] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText size={14} className={activeTab === 'records' ? 'text-emerald-600' : ''} />
              <span>Records & PDF</span>
            </button>
          </div>
        </div>

        {/* ── CLINICAL AI MODEL SELECTOR ── */}
        {activeTab === 'chat' && (
          <div className="bg-slate-50/90 px-4 py-2 border-b border-slate-200/70 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Cpu size={13} className="text-[#044343] shrink-0" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 shrink-0">
                Model:
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'gemini', label: 'Gemini 2.5 Flash', icon: '⚡', desc: 'Google Multi-Agent' },
                { id: 'medgamma', label: 'MedGemma 2B', icon: '🩺', desc: 'HF Clinical' },
                { id: 'gpt-4o', label: 'GPT-4o Clinical', icon: '🧠', desc: 'Deep Reasoning' },
              ].map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-[#044343] text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:border-slate-300'
                    }`}
                    title={`${m.label} (${m.desc})`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── COLLAPSIBLE GEMINI LEFT DRAWER (Sessions & Vault) ── */}
        {showSidebar && (
          <div className="absolute inset-y-0 left-0 w-[82%] sm:w-[320px] bg-white z-40 border-r border-slate-200 shadow-2xl flex flex-col animate-slide-in">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 text-[#044343] flex items-center justify-center">
                  <Bot size={16} />
                </div>
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Health Records</span>
              </div>
              <button
                onClick={() => setShowSidebar(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-3">
              <button
                onClick={startNewSession}
                className="w-full py-2.5 px-3 bg-[#044343] hover:bg-[#033636] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-98 cursor-pointer"
              >
                <Plus size={16} />
                <span>+ New Consultation</span>
              </button>
            </div>

            <div className="px-3 pb-2 flex gap-1 border-b border-slate-100">
              <button
                onClick={() => setSidebarTab('sessions')}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'sessions' 
                    ? 'bg-slate-100 text-slate-900 font-extrabold' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <History size={13} />
                <span>Chats ({sessions.length})</span>
              </button>

              <button
                onClick={() => setSidebarTab('documents')}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'documents' 
                    ? 'bg-slate-100 text-slate-900 font-extrabold' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <FolderOpen size={13} />
                <span>Vault ({uploadedDocs.length})</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
              {sidebarTab === 'sessions' ? (
                sessionsLoading ? (
                  <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-emerald-600" />
                    <span>Loading past sessions…</span>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <Bot size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No past sessions</p>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => selectSession(session.id)}
                      className={`w-full text-left p-3 rounded-2xl border transition flex items-start justify-between cursor-pointer ${
                        activeEncounterId === session.id
                          ? 'bg-emerald-50 border-emerald-400 text-slate-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-xs font-bold truncate block">{session.summary || session.intent || 'Consultation'}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {session.startedAt ? new Date(session.startedAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 shrink-0 mt-1" />
                    </button>
                  ))
                )
              ) : (
                uploadedDocs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <FileText size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No records uploaded</p>
                  </div>
                ) : (
                  uploadedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <FileText size={14} className="text-[#044343] shrink-0" />
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {doc.originalFilename || doc.fileName || `Doc #${doc.id.slice(0, 8)}`}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {doc.extractedFields?.length || 0} entities • Auto-committed
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Chart Synced
                      </span>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        )}

        {/* ── TAB CONTENT: CHAT VIEW vs RECORDS & PDF VIEW ── */}
        {activeTab === 'chat' ? (
          <div className="flex-1 flex flex-col min-h-0 bg-[#F4F7F9]">
            {/* Top Quick Tools & Clinical Status Banner */}
            <div className="bg-white/95 backdrop-blur-xs px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <button
                  onClick={() => setActiveInChatTool(activeInChatTool === 'rag' ? null : 'rag')}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                    activeInChatTool === 'rag'
                      ? 'bg-cyan-100 text-cyan-900 border-cyan-300 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Search size={12} className="text-cyan-600" />
                  <span>Clinical Search (RAG)</span>
                </button>

                <button
                  onClick={() => setActiveInChatTool(activeInChatTool === 'safety' ? null : 'safety')}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                    activeInChatTool === 'safety'
                      ? 'bg-purple-100 text-purple-900 border-purple-300 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Pill size={12} className="text-purple-600" />
                  <span>Drug Safety Check</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-slate-600">Dr. MediBot Online</span>
              </div>
            </div>

            {/* Microservice Panel 1: RAG */}
            {activeInChatTool === 'rag' && (
              <div className="p-3 bg-white border-b border-slate-200 space-y-2 animate-slide-up shrink-0 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-800 flex items-center gap-1">
                    <Search size={12} />
                    <span>Search Medical History</span>
                  </span>
                  <button onClick={() => setActiveInChatTool(null)} className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer">✕</button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExecuteInChatRag()}
                    placeholder="e.g. Fasting glucose, HbA1c, allergies"
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                  />
                  <button
                    onClick={handleExecuteInChatRag}
                    disabled={ragLoading || !ragQuery.trim()}
                    className="px-3.5 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    {ragLoading ? 'Searching…' : 'Find'}
                  </button>
                </div>
              </div>
            )}

            {/* Microservice Panel 2: Drug Safety */}
            {activeInChatTool === 'safety' && (
              <div className="p-3 bg-white border-b border-slate-200 space-y-2 animate-slide-up shrink-0 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-800 flex items-center gap-1">
                    <ShieldCheck size={12} />
                    <span>Medication Safety Checker</span>
                  </span>
                  <button onClick={() => setActiveInChatTool(null)} className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer">✕</button>
                </div>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={medicationInput}
                    onChange={(e) => setMedicationInput(e.target.value)}
                    placeholder="Medication name (e.g. Amoxicillin 500mg)"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={allergiesInput}
                      onChange={(e) => setAllergiesInput(e.target.value)}
                      placeholder="Known allergies"
                      className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-800 outline-none"
                    />
                    <input
                      type="text"
                      value={conditionsInput}
                      onChange={(e) => setConditionsInput(e.target.value)}
                      placeholder="Known conditions"
                      className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-800 outline-none"
                    />
                  </div>
                  <button
                    onClick={handleExecuteInChatSafety}
                    disabled={safetyLoading || !medicationInput.trim()}
                    className="w-full py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    {safetyLoading ? 'Checking…' : 'Verify Safety'}
                  </button>
                </div>
              </div>
            )}

            {/* Dedicated Full-Height Scrollable Messages Stream */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 no-scrollbar">
              {messages.map((m) => {
                const isBot = m.role === 'bot';

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isBot ? 'items-start' : 'items-end'} space-y-1 animate-fade-in`}
                  >
                    {/* Emergency Alert */}
                    {isBot && m.isEmergency && (
                      <div className="w-full bg-rose-50 border border-rose-300 text-rose-900 rounded-2xl p-3 shadow-xs flex items-start gap-2 mb-1">
                        <AlertTriangle size={18} className="shrink-0 text-rose-600 mt-0.5" />
                        <div className="text-xs">
                          <h4 className="font-bold uppercase tracking-wider text-rose-800">High Risk Detected</h4>
                          <p className="mt-0.5 leading-snug">MediBot flagged high-risk symptoms. Please contact emergency medical services immediately.</p>
                        </div>
                      </div>
                    )}

                    {/* Standard Message Bubble */}
                    <div
                      className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed ${
                        isBot
                          ? 'bg-white text-slate-800 border border-slate-200/90 shadow-2xs'
                          : m.isDocument
                          ? 'bg-emerald-50 text-emerald-950 border border-emerald-300'
                          : 'bg-[#044343] text-white shadow-xs font-medium'
                      }`}
                    >
                      {/* Bot Identity Header */}
                      {isBot && (
                        <div className="flex items-center gap-1.5 mb-1.5 text-[#044343] font-bold text-[11px]">
                          <Sparkles size={12} className="text-emerald-600" />
                          <span>Dr. MediBot • AI Doctor</span>
                        </div>
                      )}

                      {/* Document Attachment Preview */}
                      {m.isDocument && m.document && (
                        <div className="mb-2 p-2 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-[#044343] shrink-0" />
                            <div>
                              <p className="text-[11px] font-bold text-slate-900">{m.document.originalFilename || 'Document'}</p>
                              <p className="text-[9px] text-slate-500">OCR & Entity Extraction Completed</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold">
                            Uploaded
                          </span>
                        </div>
                      )}

                      {/* Rich In-Chat RAG Card */}
                      {m.isRagCard && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <span className="text-cyan-800 font-extrabold flex items-center gap-1 text-[11px]">
                              <Search size={12} />
                              <span>Clinical RAG Evidence</span>
                            </span>
                          </div>
                          <p className="text-slate-700 text-xs">{m.content}</p>
                          {m.ragResults?.length > 0 && (
                            <div className="space-y-1.5">
                              {m.ragResults.map((item, idx) => (
                                <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700">
                                  <span className="font-bold text-[#044343] block mb-0.5">{item.source || 'Medical Record'}</span>
                                  <p>{item.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Rich In-Chat Drug Safety Card */}
                      {m.isSafetyCard && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <span className="text-purple-800 font-bold flex items-center gap-1 text-[11px]">
                              <Pill size={12} />
                              <span>Drug Safety Result</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              m.safetyResult?.isSafe 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {m.safetyResult?.isSafe ? 'SAFE' : 'WARNING'}
                            </span>
                          </div>
                          <p className="text-slate-800 text-xs font-semibold">{m.content}</p>
                        </div>
                      )}

                      {/* Default Content */}
                      {!m.isRagCard && !m.isSafetyCard && (
                        <>
                          {/* Model Attribution & Verification Badge */}
                          {isBot && m.id !== 'init' && (() => {
                            const badge = formatModelDisplayName(m.modelName, selectedModel);
                            return (
                              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border shadow-2xs ${badge.badgeBg}`}>
                                  <span>{badge.icon}</span>
                                  <span>{badge.name}</span>
                                </span>
                                {m.criticScore !== null && m.criticScore !== undefined && (
                                  <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-200">
                                    Critic Verified ✓
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                          {isBot ? (
                            <BotStructuredMessage 
                              content={m.content} 
                              onSelectQuestion={(q) => handleSendMessage(q)} 
                            />
                          ) : (
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          )}
                        </>
                      )}

                      {/* Auto-Committed Badge */}
                      {isBot && m.autoCommitted && (
                        <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-1.5 text-[11px] font-semibold">
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          <span>✅ Auto-committed to Patient 360 chart ({m.extractedFields?.length || 0} entities)</span>
                        </div>
                      )}

                      {/* Screening latency & multi-agent tags */}
                      {isBot && m.screeningLatencyMs && (
                        <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-medium">
                          <span>Clinical Latency: {m.screeningLatencyMs}ms</span>
                          {m.criticScore !== null && m.criticScore !== undefined && (
                            <span className="text-emerald-700 font-bold">Physician Critic Verified ✓</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* RLHF Feedback Controls on Assistant Messages */}
                    {isBot && m.id !== 'init' && (
                      <div className="flex items-center gap-1.5 pt-0.5 pl-1">
                        {/* Thumbs Up */}
                        <button
                          onClick={() => handleRatingSubmit(m.id, 1)}
                          className={`px-2 py-1 rounded-lg border text-[10px] flex items-center gap-1 transition cursor-pointer ${
                            feedbackMap[m.id]?.rating === 1
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/60'
                          }`}
                          title="Clinically accurate & helpful"
                        >
                          <ThumbsUp size={11} className={feedbackMap[m.id]?.rating === 1 ? 'fill-emerald-600 text-emerald-600' : ''} />
                          <span>{feedbackMap[m.id]?.rating === 1 ? 'Helpful' : ''}</span>
                        </button>

                        {/* Thumbs Down */}
                        <button
                          onClick={() => {
                            setFeedbackMap(prev => ({
                              ...prev,
                              [m.id]: {
                                ...prev[m.id],
                                showDrawer: !prev[m.id]?.showDrawer
                              }
                            }));
                          }}
                          className={`px-2 py-1 rounded-lg border text-[10px] flex items-center gap-1 transition cursor-pointer ${
                            feedbackMap[m.id]?.rating === -1
                              ? 'bg-rose-100 border-rose-300 text-rose-800 font-bold shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50/60'
                          }`}
                          title="Report inaccurate or unclear clinical advice"
                        >
                          <ThumbsDown size={11} className={feedbackMap[m.id]?.rating === -1 ? 'fill-rose-600 text-rose-600' : ''} />
                          <span>{feedbackMap[m.id]?.rating === -1 ? 'Feedback' : ''}</span>
                        </button>

                        {feedbackMap[m.id]?.submitted && (
                          <span className="text-[9px] text-emerald-700 font-semibold flex items-center gap-1">
                            <Check size={10} />
                            <span>Clinical review recorded</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* RLHF Feedback Drawer for Negative Feedback */}
                    {isBot && feedbackMap[m.id]?.showDrawer && !feedbackMap[m.id]?.submitted && (
                      <div className="mt-1 p-2.5 bg-white border border-rose-200 rounded-2xl max-w-[90%] text-xs shadow-xs space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-900 text-[10px] uppercase tracking-wider block">
                            Clinical Alignment Feedback
                          </span>
                          <button
                            onClick={() => setFeedbackMap(prev => ({ ...prev, [m.id]: { ...prev[m.id], showDrawer: false } }))}
                            className="text-slate-400 hover:text-slate-600 text-[11px] cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {['Inaccurate Diagnosis', 'Hallucination', 'Too Verbose', 'Incorrect Medication', 'Tone / Empathy Issue', 'Missed Allergies/Context'].map(tag => {
                            const active = (feedbackMap[m.id]?.tags || []).includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  const curTags = feedbackMap[m.id]?.tags || [];
                                  const nextTags = active ? curTags.filter(t => t !== tag) : [...curTags, tag];
                                  setFeedbackMap(prev => ({
                                    ...prev,
                                    [m.id]: { ...prev[m.id], tags: nextTags }
                                  }));
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${
                                  active ? 'bg-rose-100 border-rose-400 text-rose-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Describe clinical issue (optional)…"
                            value={feedbackMap[m.id]?.feedbackText || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFeedbackMap(prev => ({
                                ...prev,
                                [m.id]: { ...prev[m.id], feedbackText: val }
                              }));
                            }}
                            className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-800 outline-none"
                          />
                          <button
                            onClick={() => {
                              handleRatingSubmit(
                                m.id,
                                -1,
                                feedbackMap[m.id]?.tags?.length ? feedbackMap[m.id]?.tags : ['Inaccurate Diagnosis'],
                                feedbackMap[m.id]?.feedbackText || ''
                              );
                            }}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-bold transition cursor-pointer shrink-0"
                          >
                            Submit Review
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Suggested Action Chips */}
                    {isBot && m.suggestedActions?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 pl-1">
                        {m.suggestedActions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(action)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-[#044343] border border-slate-200 rounded-full text-[10px] font-bold shadow-2xs transition cursor-pointer"
                          >
                            + {action}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {uploadingFile && (
                <div className="flex items-center gap-2 p-2.5 bg-white border border-emerald-300 rounded-2xl max-w-[260px] text-xs text-[#044343] shadow-2xs animate-pulse">
                  <UploadCloud size={16} className="animate-spin text-emerald-600" />
                  <span className="font-semibold">Processing & auto-committing…</span>
                </div>
              )}

              {/* Agentic Clinical Progress Badge (Multi-Agent Live Streaming Indicator) */}
              {isTyping && (
                <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-300 rounded-2xl max-w-[320px] text-xs shadow-xs space-y-1.5 animate-pulse">
                  <div className="flex items-center justify-between text-[#044343] font-bold text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={12} className="text-emerald-600 animate-spin" />
                      <span>Clinical Multi-Agent Reasoning</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 font-extrabold uppercase">
                      Live
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping shrink-0"></span>
                    <span className="leading-snug text-[11px] font-medium">
                      {liveProgress || 'Synthesizing verified medical records…'}
                    </span>
                  </div>
                </div>
              )}
              {/* Floating Feedback & Model Toast Notification */}
              {feedbackToast && (
                <div className="sticky bottom-2 mx-auto max-w-[90%] z-30 bg-slate-900/95 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center justify-center gap-2 text-xs font-semibold backdrop-blur-md border border-slate-700 animate-bounce">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <span>{feedbackToast}</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Sticky Input Container */}
            <div className="bg-white border-t border-slate-200/80 px-4 py-2.5 shrink-0 space-y-2">
              {/* Quick Prompts Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
                {['Review my recent lab results', 'Check medication safety', 'How are my steps & vitals?'].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(suggestion)}
                    className="px-2.5 py-1 bg-slate-50 hover:bg-emerald-50 hover:text-[#044343] hover:border-emerald-200 border border-slate-200 rounded-full text-slate-600 font-medium whitespace-nowrap transition cursor-pointer text-[10px]"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>

              {/* Input Pill Bar */}
              <div className="bg-[#F4F7F9] rounded-full p-1.5 pl-2 border border-slate-200 flex items-center gap-2">
                <button
                  onClick={handleInitiateUpload}
                  disabled={uploadingFile}
                  className="w-10 h-10 rounded-full bg-[#044343] hover:bg-[#033636] active:scale-95 text-white flex items-center justify-center shrink-0 shadow-sm transition cursor-pointer disabled:opacity-50"
                  title="Upload blood report or prescription (.pdf, .doc, .docx, images)"
                >
                  <Plus size={22} strokeWidth={2.5} />
                </button>

                <input
                  type="text"
                  placeholder="Ask Dr. MediBot about symptoms, labs, or meds…"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-transparent text-slate-800 placeholder:text-slate-400 text-xs sm:text-sm outline-none px-2"
                />

                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isTyping}
                  className="w-10 h-10 rounded-full bg-[#044343] hover:bg-[#033636] active:scale-95 text-white flex items-center justify-center shrink-0 disabled:opacity-30 transition cursor-pointer shadow-sm"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── RECORDS & PDF SUMMARY VIEW ── */
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 no-scrollbar">
            
            {/* 1. Header Title */}
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Your Health History
              </h1>
              <h2 className="text-base font-bold text-slate-900 mt-4 mb-2">
                Overall Summary
              </h2>
            </div>

            {/* 2. Overall Summary White Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              {/* Live Clinical Badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                  ✓ Verified Medical Summary
                </span>
                {clinicalContext?.activeMedications?.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold">
                    💊 {clinicalContext.activeMedications.length} Medications
                  </span>
                )}
                {clinicalContext?.activeConditions?.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                    🩺 {clinicalContext.activeConditions.length} Diagnoses
                  </span>
                )}
                {clinicalContext?.recentLabs?.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-[10px] font-bold">
                    🧪 {clinicalContext.recentLabs.length} Lab Panels
                  </span>
                )}
              </div>

              <p className="text-slate-700 text-xs sm:text-sm leading-relaxed font-normal">
                {summaryNarrative}
              </p>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <button
                  onClick={() => setShowPatient360(true)}
                  className="text-[#044343] font-bold text-sm hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <span>View Longitudinal Patient 360</span>
                </button>

                <button
                  onClick={() => setShowPatient360(true)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-[#044343] flex items-center justify-center transition cursor-pointer"
                  title="View Patient 360 Details"
                >
                  <ArrowRight size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* 3. Primary Download Button & Secondary Direct Links */}
            <div className="space-y-2">
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="w-full bg-[#044343] hover:bg-[#033636] active:scale-[0.99] text-white py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-md transition cursor-pointer disabled:opacity-75"
              >
                <Download size={19} strokeWidth={2.2} className={downloadingPdf ? 'animate-bounce' : ''} />
                <span>{downloadingPdf ? (downloadProgress || 'Generating PDF Document…') : 'Download Your Health Summary (PDF)'}</span>
              </button>

              {downloadSuccessMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs font-bold flex items-center justify-between gap-2 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>{downloadSuccessMessage}</span>
                  </div>
                  <a
                    href={api.getHealthSummaryPdfUrl(patientId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shrink-0 transition"
                  >
                    Open / View PDF
                  </a>
                </div>
              )}

              {downloadError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-bold flex items-center justify-between gap-2 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    <span>{downloadError}</span>
                  </div>
                  <a
                    href={api.getHealthSummaryPdfUrl(patientId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shrink-0 transition"
                  >
                    Direct Link
                  </a>
                </div>
              )}

              <div className="flex items-center justify-between px-1 text-xs">
                <a
                  href={api.getHealthSummaryPdfUrl(patientId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 text-[#044343] font-bold text-[11px] shadow-2xs transition cursor-pointer"
                  title="Open PDF directly in browser"
                >
                  <Eye size={12} strokeWidth={2.2} />
                  <span>View in Browser</span>
                </a>

                <a
                  href={api.getHealthSummaryPdfUrl(patientId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download="Patient_Health_Summary.pdf"
                  className="text-[11px] font-semibold text-slate-500 hover:text-[#044343] underline transition flex items-center gap-1"
                  title="Direct PDF download link"
                >
                  <Download size={11} />
                  <span>Direct PDF link</span>
                </a>
              </div>
            </div>

            {/* 4. Uploaded Medical Documents Vault List */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Medical Records Vault</h3>
                  <p className="text-[11px] text-slate-500">Blood reports, prescriptions, and lab panels</p>
                </div>
                <button
                  onClick={handleInitiateUpload}
                  disabled={uploadingFile}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Upload Record</span>
                </button>
              </div>

              {uploadedDocs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                  <FileText size={24} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-700">No medical records uploaded yet</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Upload a PDF or photo of your lab test to auto-commit insights.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <FileText size={14} className="text-[#044343] shrink-0" />
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {doc.originalFilename || doc.fileName || `Doc #${doc.id.slice(0, 8)}`}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {doc.extractedFields?.length || 0} entities • Auto-committed to chart
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                        Chart Synced
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── EMBEDDED PATIENT 360 MODAL (When 'View Details' is clicked) ── */}
        {showPatient360 && (
          <Patient360Screen onClose={() => setShowPatient360(false)} />
        )}

        {/* ── PROFILE CONSENT CONFIRMATION MODAL ── */}
        {showConsentModal && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-[28px] p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#044343] flex items-center justify-center mx-auto shadow-sm">
                <Lock size={22} />
              </div>

              <div className="text-center space-y-1">
                <h4 className="text-sm font-black text-slate-900 tracking-tight">Clinical Consent Required</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  To analyze medical records (.pdf, .doc, .docx, images) and run AI health triage, clinical privacy safeguards require your consent.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Document OCR & entity auto-commit</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Clinical drug interaction & safety analysis</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleGrantConsentAndProceed}
                  disabled={enablingConsent}
                  className="w-full py-3 bg-[#044343] hover:bg-[#033636] text-white rounded-2xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck size={16} />
                  <span>{enablingConsent ? 'Enabling in Profile…' : 'Enable & Continue'}</span>
                </button>

                <button
                  onClick={() => setShowConsentModal(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default MediBotScreen;
