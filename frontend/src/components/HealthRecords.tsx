import { useEffect, useState, useRef } from 'react';
import {
  FileText, Upload, Trash2, ChevronDown, ChevronUp, AlertCircle,
  Stethoscope, TestTube, Pill, Syringe, Eye, ClipboardList, FileArchive, Lightbulb,
} from 'lucide-react';
import { api } from '../api';
import type { HealthRecord, LabResult } from '../types';

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  lab_results:   { label: 'Lab Results',   icon: <TestTube size={14} />,      color: 'text-blue-400 bg-blue-400/10' },
  visit_notes:   { label: 'Visit Notes',   icon: <Stethoscope size={14} />,   color: 'text-emerald-400 bg-emerald-400/10' },
  imaging:       { label: 'Imaging',       icon: <Eye size={14} />,           color: 'text-purple-400 bg-purple-400/10' },
  medication:    { label: 'Medication',    icon: <Pill size={14} />,          color: 'text-orange-400 bg-orange-400/10' },
  immunization:  { label: 'Immunization',  icon: <Syringe size={14} />,       color: 'text-yellow-400 bg-yellow-400/10' },
  vitals:        { label: 'Vitals',        icon: <ClipboardList size={14} />, color: 'text-red-400 bg-red-400/10' },
  referral:      { label: 'Referral',      icon: <FileText size={14} />,      color: 'text-cyan-400 bg-cyan-400/10' },
  general:       { label: 'General',       icon: <FileText size={14} />,      color: 'text-slate-400 bg-slate-400/10' },
  pending:       { label: 'Processing',    icon: <FileText size={14} />,      color: 'text-slate-500 bg-slate-500/10' },
};

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.general;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  normal:   { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Normal' },
  high:     { bg: 'bg-red-500/15',     text: 'text-red-400',     label: 'High' },
  low:      { bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  label: 'Low' },
  critical: { bg: 'bg-red-500/25',     text: 'text-red-300',     label: 'Critical' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.normal;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function LabResultRow({ lab }: { lab: LabResult }) {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS_STYLES[lab.status] || STATUS_STYLES.normal;

  return (
    <div className={`rounded-xl border ${lab.status === 'critical' ? 'border-red-500/40' : lab.status === 'high' || lab.status === 'low' ? 'border-slate-600' : 'border-slate-700/50'}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-2 h-8 rounded-full shrink-0 ${lab.status === 'normal' ? 'bg-emerald-500' : lab.status === 'critical' ? 'bg-red-500' : lab.status === 'high' ? 'bg-red-400' : 'bg-yellow-400'}`} />
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium">{lab.test_name}</p>
            <p className="text-slate-500 text-xs mt-0.5">Ref: {lab.reference_range}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-sm font-bold ${s.text}`}>{lab.value}</span>
          <StatusBadge status={lab.status} />
          {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-slate-700/50 pt-3 ml-5">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">What this measures</p>
            <p className="text-slate-300 text-sm">{lab.explanation}</p>
          </div>
          <div>
            <p className={`text-xs uppercase tracking-wide mb-1 ${lab.status === 'normal' ? 'text-emerald-500' : 'text-yellow-500'}`}>
              {lab.status === 'normal' ? 'How to maintain' : 'How to improve'}
            </p>
            <p className="text-slate-300 text-sm">{lab.improvement}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordCard({ record, onDelete }: { record: HealthRecord; onDelete: (id: number) => void }) {
  const [open, setOpen] = useState(false);

  const labResults = record.lab_results || [];
  const abnormalCount = labResults.filter(l => l.status !== 'normal').length;

  return (
    <div className="card">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 ${(CATEGORY_META[record.category] || CATEGORY_META.general).color}`}>
              {(CATEGORY_META[record.category] || CATEGORY_META.general).icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-medium text-sm truncate">{record.filename}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <CategoryBadge category={record.category} />
                {record.record_date && (
                  <span className="text-slate-500 text-xs">{formatDate(record.record_date)}</span>
                )}
                {labResults.length > 0 && (
                  <span className="text-slate-500 text-xs">
                    {labResults.length} tests
                    {abnormalCount > 0 && (
                      <span className="text-yellow-400 ml-1">({abnormalCount} flagged)</span>
                    )}
                  </span>
                )}
              </div>
              {record.summary && (
                <p className="text-slate-400 text-sm mt-2 line-clamp-2">{record.summary}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onDelete(record.id); }}
              className="btn-danger"
            >
              <Trash2 size={13} />
            </button>
            {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
          </div>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-slate-700 pt-4">
          {/* Summary */}
          {record.summary && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <FileText size={14} className="text-blue-400" /> Summary
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">{record.summary}</p>
            </div>
          )}

          {/* Lab Results Detail */}
          {labResults.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TestTube size={14} className="text-blue-400" /> Lab Results ({labResults.length} tests)
                </span>
                <div className="flex items-center gap-3 text-xs font-normal">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-500">{labResults.filter(l => l.status === 'normal').length} Normal</span>
                  </span>
                  {labResults.filter(l => l.status === 'high').length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-slate-500">{labResults.filter(l => l.status === 'high').length} High</span>
                    </span>
                  )}
                  {labResults.filter(l => l.status === 'low').length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span className="text-slate-500">{labResults.filter(l => l.status === 'low').length} Low</span>
                    </span>
                  )}
                </div>
              </h3>

              {/* Show abnormal results first */}
              <div className="space-y-2">
                {labResults
                  .sort((a, b) => {
                    const order: Record<string, number> = { critical: 0, high: 1, low: 2, normal: 3 };
                    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
                  })
                  .map((lab, i) => (
                    <LabResultRow key={i} lab={lab} />
                  ))}
              </div>
            </div>
          )}

          {/* Key Findings */}
          {record.key_findings && record.key_findings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <AlertCircle size={14} className="text-yellow-400" /> Key Findings
              </h3>
              <ul className="space-y-1.5">
                {record.key_findings.map((f, i) => (
                  <li key={i} className="text-slate-300 text-sm flex gap-2">
                    <span className="text-yellow-400 shrink-0 mt-0.5">*</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {record.recommendations && record.recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Lightbulb size={14} className="text-emerald-400" /> Recommendations
              </h3>
              <ul className="space-y-1.5">
                {record.recommendations.map((r, i) => (
                  <li key={i} className="text-slate-300 text-sm flex gap-2">
                    <span className="text-emerald-400 shrink-0 mt-0.5">→</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-slate-700/30 rounded-xl px-4 py-3">
            <p className="text-slate-500 text-xs">
              This AI-generated analysis is for informational purposes only and is not medical advice.
              Always discuss health records and recommendations with your healthcare provider.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HealthRecords() {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    try {
      const data = await api.getHealthRecords();
      // Parse JSON fields if they come as strings
      const parsed = data.map(r => ({
        ...r,
        key_findings: typeof r.key_findings === 'string' ? JSON.parse(r.key_findings) : r.key_findings,
        recommendations: typeof r.recommendations === 'string' ? JSON.parse(r.recommendations) : r.recommendations,
        lab_results: typeof r.lab_results === 'string' ? JSON.parse(r.lab_results) : (r.lab_results || []),
      }));
      setRecords(parsed);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setUploading(true);
    setUploadError('');

    try {
      const result = await api.uploadHealthRecords(files);
      const errors = result.results.filter(r => r.error);
      if (errors.length > 0) {
        setUploadError(`${errors.length} file(s) failed: ${errors.map(e => e.error).join(', ')}`);
      }
      await loadRecords();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  }

  async function handleDelete(id: number) {
    await api.deleteHealthRecord(id);
    setRecords(prev => prev.filter(r => r.id !== id));
  }

  const categories = ['all', ...new Set(records.map(r => r.category))];
  const filtered = filter === 'all' ? records : records.filter(r => r.category === filter);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Stethoscope size={24} /> Health Records
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Upload records from your patient portal for AI-powered analysis
        </p>
      </div>

      {/* Upload area */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`card cursor-pointer transition-all text-center py-10 border-2 border-dashed ${
          dragOver
            ? 'border-emerald-400 bg-emerald-500/10'
            : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.csv,.html,.jpg,.jpeg,.png,.webp,.gif"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />

        {uploading ? (
          <>
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold">Analyzing your health records...</p>
            <p className="text-slate-400 text-sm mt-1">AI is reading and summarizing your documents</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload size={28} className="text-slate-400" />
            </div>
            <p className="text-white font-semibold">
              {dragOver ? 'Drop your files here' : 'Upload health records'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Drag & drop or click to browse — PDF, images, or text files
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Lab results, visit notes, imaging reports, prescriptions, etc.
            </p>
          </>
        )}
      </div>

      {uploadError && (
        <div className="card border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{uploadError}</p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {records.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-500 text-sm">Filter:</span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === cat
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-500 hover:text-white hover:bg-slate-700'
              }`}
            >
              {cat === 'all' ? `All (${records.length})` : `${(CATEGORY_META[cat] || CATEGORY_META.general).label} (${records.filter(r => r.category === cat).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Records list */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(record => (
            <RecordCard key={record.id} record={record} onDelete={handleDelete} />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="card text-center py-12">
          <FileArchive size={40} className="mx-auto mb-4 text-slate-600" />
          <p className="text-white font-semibold text-lg">No health records yet</p>
          <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
            Upload documents from your patient portal — lab results, visit summaries,
            imaging reports, or any health-related records. AI will analyze and summarize them
            with recommendations tailored to your fitness goals.
          </p>
        </div>
      ) : (
        <div className="card text-center py-8 text-slate-500 text-sm">
          No records match this filter.
        </div>
      )}
    </div>
  );
}
