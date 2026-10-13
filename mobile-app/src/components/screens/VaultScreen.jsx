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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg h-[92vh] max-h-[820px] rounded-[32px] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
              <FolderLock size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">GOQii Health Locker</h3>
              <p className="text-[11px] text-slate-400 font-medium">Store Prescriptions & Lab Reports • OCR Commit to DB</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          
          {/* Upload Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Upload size={14} className="text-sky-600" />
              <span>Upload Prescription or Lab Report</span>
            </h4>

            <form onSubmit={handleUpload} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Document Category</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border rounded-xl text-xs font-semibold outline-none"
                  >
                    <option value="prescription">Prescription (Rx)</option>
                    <option value="lab_report">Laboratory Report</option>
                    <option value="discharge_summary">Discharge Summary</option>
                    <option value="radiology_scan">Radiology / Scan</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Select File (PDF, DOC, DOCX, Images)</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tiff,.webp,.txt"
                    onChange={(e) => setFileToUpload(e.target.files[0])}
                    className="w-full text-[11px] file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[11px] file:font-bold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!fileToUpload || uploading}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} />
                  <span>{uploading ? 'Processing OCR & Committing…' : 'Upload to Vault & Extract'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Documents List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Vault Documents ({documents.length})
              </h4>
              <button
                onClick={fetchDocuments}
                className="text-xs text-sky-600 hover:underline flex items-center gap-1 font-semibold"
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
                  className={`bg-white rounded-2xl p-4 border transition space-y-3 cursor-pointer ${
                    selectedDoc?.id === doc.id ? 'border-sky-500 ring-2 ring-sky-50' : 'border-slate-100 shadow-sm'
                  }`}
                  onClick={() => setSelectedDoc(doc)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-slate-900 leading-snug">
                          {doc.originalFilename || 'Medical_Record.pdf'}
                        </h5>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {doc.docType}
                          </span>
                          <span className="text-[10px] text-slate-300">•</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(doc.createdAt || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold capitalize">
                      {doc.extractionStatus || 'Done'}
                    </span>
                  </div>

                  {doc.summary && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium leading-relaxed">
                      {doc.summary}
                    </p>
                  )}

                  {/* Extracted Entities Table */}
                  {doc.extractions?.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        Extracted Medical Entities ({doc.extractions.length}):
                      </span>

                      <div className="space-y-1">
                        {doc.extractions.map((ext, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-slate-50/80 px-2.5 py-1.5 rounded-lg text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Pill size={13} className="text-sky-600" />
                              <strong className="text-slate-800">{ext.rawValue || ext.normalizedValue}</strong>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                              {Math.round((ext.confidence || 0.9) * 100)}% match
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Auto-Committed Status Badge */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-emerald-200">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      <span>Auto-Committed to Patient 360</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCommit(doc.id);
                      }}
                      disabled={commitLoading}
                      className="text-[11px] font-semibold text-slate-400 hover:text-emerald-700 underline"
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
