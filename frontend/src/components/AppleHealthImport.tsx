import { useState, useRef } from 'react';
import { Upload, Apple, CheckCircle, AlertCircle, FileArchive } from 'lucide-react';
import { api } from '../api';
import type { ImportResult } from '../types';

export default function AppleHealthImport({ onImportComplete }: { onImportComplete?: () => void }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.zip') && !name.endsWith('.xml')) {
      setError('Please upload an Apple Health export (.zip or .xml file)');
      return;
    }

    setImporting(true);
    setError('');
    setResult(null);

    try {
      const res = await api.importAppleHealth(file);
      setResult(res);
      onImportComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Apple size={24} /> Apple Health Import
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Import weight and workout data from your Apple Health export
        </p>
      </div>

      {/* How to export instructions */}
      <div className="card">
        <h2 className="font-semibold text-white mb-3">How to export from Apple Health</h2>
        <ol className="space-y-2 text-slate-300 text-sm">
          <li className="flex gap-2">
            <span className="text-emerald-400 font-bold shrink-0">1.</span>
            Open the <strong>Health</strong> app on your iPhone
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 font-bold shrink-0">2.</span>
            Tap your <strong>profile picture</strong> (top right)
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 font-bold shrink-0">3.</span>
            Scroll down and tap <strong>"Export All Health Data"</strong>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 font-bold shrink-0">4.</span>
            AirDrop or save the <strong>export.zip</strong> to your Mac
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 font-bold shrink-0">5.</span>
            Upload the ZIP file below
          </li>
        </ol>
      </div>

      {/* Upload area */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`card cursor-pointer transition-all text-center py-12 border-2 border-dashed ${
          dragOver
            ? 'border-emerald-400 bg-emerald-500/10'
            : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.xml"
          onChange={handleInputChange}
          className="hidden"
        />

        {importing ? (
          <>
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold">Importing health data...</p>
            <p className="text-slate-400 text-sm mt-1">This may take a moment for large exports</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileArchive size={28} className="text-slate-400" />
            </div>
            <p className="text-white font-semibold">
              {dragOver ? 'Drop your file here' : 'Drag & drop your export.zip here'}
            </p>
            <p className="text-slate-400 text-sm mt-1">or click to browse</p>
            <p className="text-slate-500 text-xs mt-3">Accepts .zip or .xml files</p>
          </>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="card border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-start gap-3">
            <CheckCircle size={22} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold">Import complete!</p>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div className="text-center bg-slate-700/50 rounded-xl py-3">
                  <p className="text-2xl font-bold text-emerald-400">{result.weights}</p>
                  <p className="text-slate-400 text-xs">Weight entries</p>
                </div>
                <div className="text-center bg-slate-700/50 rounded-xl py-3">
                  <p className="text-2xl font-bold text-blue-400">{result.workouts}</p>
                  <p className="text-slate-400 text-xs">Workouts</p>
                </div>
                <div className="text-center bg-slate-700/50 rounded-xl py-3">
                  <p className="text-2xl font-bold text-slate-400">{result.skipped}</p>
                  <p className="text-slate-400 text-xs">Duplicates skipped</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <p className="text-yellow-400 text-xs mt-3">
                  {result.errors.length} parse warnings (non-critical)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Import failed</p>
              <p className="text-slate-400 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
