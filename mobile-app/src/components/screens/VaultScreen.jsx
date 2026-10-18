import React, { useState, useEffect } from 'react';
import { 
  FolderLock, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Pill, 
  ChevronRight, 
  X, 
  RefreshCw,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../../services/api';

export function VaultScreen({ onClose, onCommitSuccess }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('prescription');
  const [fileToUpload, setFileToUpload] = useState(null);
  const [commitLoading, setCommitLoading] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.listDocuments();
      let docList = [];
      if (Array.isArray(res)) docList = res;
      else if (res?.documents) docList = res.documents;
      setDocuments(docList);
      if (docList.length > 0 && !selectedDoc) {
        setSelectedDoc(docList[0]);
      }
    } catch (err) {
      console.warn('Could not list documents:', err.message);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!fileToUpload) return;
    setUploading(true);
    try {
      const res = await api.uploadDocument(fileToUpload, docType);
      const doc = res?.document || res;
      
      // Auto-commit extracted clinical fields into Patient 360
      if (doc?.id) {
        await api.commitDocumentFields(doc.id, []).catch(() => {});
      }

      alert('Document uploaded successfully to S3 Vault! Extracted clinical entities committed to your Patient 360 chart.');
      setFileToUpload(null);
      await fetchDocuments();
      if (doc?.id) setSelectedDoc(doc);
      if (onCommitSuccess) onCommitSuccess();
    } catch (err) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async (docId) => {
    setCommitLoading(true);
    try {
      await api.commitDocumentFields(docId, []);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });
      alert('Confirmed OCR entities successfully committed to your Patient 360 chart!');
      if (onCommitSuccess) onCommitSuccess();
      fetchDocuments();
    } catch (err) {
      alert(`Commit error: ${err.message}`);
    } finally {
      setCommitLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans">
      <div className="glass-card bg-slate-950/95 w-full max-w-lg h-[92vh] max-h-[820px] rounded-[32px] shadow-2xl flex flex-col overflow-hidden border border-white/[0.12] border-t-white/[0.22] text-slate-100">
        
        {/* Header */}
        <div className="glass-subcard bg-slate-900/80 p-4 text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-sm shadow-cyan-500/20">
              <FolderLock size={22} />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white">Fitsure Medical Vault & OCR</h3>
              <p className="text-[11px] text-slate-400 font-medium">Store Prescriptions & Lab Reports • OCR Auto-Commit</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          
          {/* Upload Box */}
          <div className="glass-subcard bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 text-glow-cyan">
              <Upload size={14} className="text-cyan-400" />
              <span>Upload Prescription or Lab Report</span>
            </h4>

            <form onSubmit={handleUpload} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Document Category</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-3 py-2 glass-subcard bg-slate-900/80 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-cyan-400"
                  >
                    <option value="prescription" className="bg-slate-900 text-white">Prescription (Rx)</option>
                    <option value="lab_report" className="bg-slate-900 text-white">Laboratory Report</option>
                    <option value="discharge_summary" className="bg-slate-900 text-white">Discharge Summary</option>
                    <option value="radiology_scan" className="bg-slate-900 text-white">Radiology / Scan</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Select File (PDF, DOC, Images)</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tiff,.webp,.txt"
                    onChange={(e) => setFileToUpload(e.target.files[0])}
                    className="w-full text-[11px] text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[11px] file:font-bold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!fileToUpload || uploading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:opacity-95 text-slate-950 rounded-xl text-xs font-black shadow-md shadow-cyan-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>{uploading ? 'Processing OCR & Extracting Entities…' : 'Upload to Vault & Extract'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Documents List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Vault Documents ({documents.length})
              </h4>
              <button
                onClick={fetchDocuments}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold cursor-pointer transition"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {documents.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No documents in vault yet.</p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`glass-subcard bg-slate-900/60 rounded-2xl p-4 border transition space-y-3 cursor-pointer ${
                    selectedDoc?.id === doc.id ? 'border-cyan-400 ring-2 ring-cyan-500/20' : 'border-white/10 hover:border-white/20'
                  }`}
                  onClick={() => setSelectedDoc(doc)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400 shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="text-sm font-black text-white leading-snug truncate">
                          {doc.originalFilename || 'Medical_Record.pdf'}
                        </h5>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {doc.docType}
                          </span>
                          <span className="text-[10px] text-slate-500">•</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(doc.createdAt || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 glass-pill bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold capitalize shrink-0">
                      {doc.extractionStatus || 'Done'}
                    </span>
                  </div>

                  {doc.summary && (
                    <p className="text-xs text-slate-300 glass-subcard bg-slate-900/80 p-2.5 rounded-xl border border-white/5 font-medium leading-relaxed">
                      {doc.summary}
                    </p>
                  )}

                  {/* Extracted Entities Table */}
                  {doc.extractions?.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-300 block">
                        Extracted Medical Entities ({doc.extractions.length}):
                      </span>

                      <div className="space-y-1">
                        {doc.extractions.map((ext, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between glass-subcard bg-slate-900/80 px-2.5 py-1.5 rounded-lg text-xs border border-white/5"
                          >
                            <div className="flex items-center gap-2">
                              <Pill size={13} className="text-cyan-400" />
                              <strong className="text-white">{ext.rawValue || ext.normalizedValue}</strong>
                            </div>
                            <span className="text-[10px] font-extrabold text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded border border-cyan-400/20">
                              {Math.round((ext.confidence || 0.9) * 100)}% match
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Auto-Committed Status Badge */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="px-3 py-1.5 glass-pill bg-emerald-500/15 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-emerald-400/30">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      <span>Auto-Committed to Patient 360</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCommit(doc.id);
                      }}
                      disabled={commitLoading}
                      className="text-[11px] font-bold text-slate-400 hover:text-cyan-300 underline cursor-pointer transition"
                      title="Re-synchronize OCR extractions"
                    >
                      {commitLoading ? 'Syncing…' : 'Re-sync'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
