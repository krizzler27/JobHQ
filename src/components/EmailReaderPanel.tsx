import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { api } from '../api';
import type {
  DownloadedModel,
  LlmBackend,
  LlmTestResult,
  ModelDownloadStatus,
  RecommendedSlm,
} from '../types';

interface EmailReaderPanelProps {
  llmBackend: LlmBackend;
  llmModelPath: string;
  onChangeBackend: (backend: LlmBackend) => void;
  onChangeModelPath: (path: string) => void;
}

export const EmailReaderPanel: React.FC<EmailReaderPanelProps> = ({
  llmBackend,
  llmModelPath,
  onChangeBackend,
  onChangeModelPath,
}) => {
  const [models, setModels] = useState<RecommendedSlm[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [runnerInstalled, setRunnerInstalled] = useState(true);
  const [downloadStatus, setDownloadStatus] = useState<ModelDownloadStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);

  const loadRecommendations = () => {
    api
      .getRecommendedSlms()
      .then((res) => {
        setModels(Array.isArray(res?.models) ? res.models : []);
        setRunnerInstalled(Boolean(res?.llama_cpp_installed));
        setDownloadedModels(
          Array.isArray(res?.downloaded_models) ? res.downloaded_models : [],
        );
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadRecommendations();
    api
      .getDownloadStatus()
      .then((st) => {
        setDownloadStatus(st || null);
        if (Array.isArray(st?.downloaded_models)) {
          setDownloadedModels(st.downloaded_models);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (downloadStatus?.status !== 'downloading') return;
    const timer = setInterval(async () => {
      try {
        const st = await api.getDownloadStatus();
        setDownloadStatus(st || null);
        if (Array.isArray(st?.downloaded_models)) {
          setDownloadedModels(st.downloaded_models);
        }
        if (st?.status === 'completed' && st.path) {
          onChangeModelPath(st.path);
          onChangeBackend('llama_cpp_python');
          setTestResult({
            ok: true,
            backend: 'llama_cpp_python',
            message: `Downloaded ${st.filename} and selected it.`,
          });
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [downloadStatus?.status, onChangeBackend, onChangeModelPath]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testLlmEngine({
        llm_backend: llmBackend,
        llm_model_path: llmModelPath,
      });
      setTestResult(res);
    } catch (err) {
      setTestResult({
        ok: false,
        backend: llmBackend,
        message: err instanceof Error ? err.message : 'Could not verify reader setup.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDownload = async (modelId: string) => {
    setTestResult(null);
    try {
      const st = await api.downloadLlmModel(modelId);
      setDownloadStatus(st || null);
      if (Array.isArray(st?.downloaded_models)) {
        setDownloadedModels(st.downloaded_models);
      }
      if (st?.status === 'completed' && st.path) {
        onChangeModelPath(st.path);
        onChangeBackend('llama_cpp_python');
        setTestResult({
          ok: true,
          backend: 'llama_cpp_python',
          message: `Ready to use ${st.filename}.`,
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        backend: 'llama_cpp_python',
        message: err instanceof Error ? err.message : 'Download failed.',
      });
    }
  };

  const safeModels = Array.isArray(models) ? models : [];
  const safeDownloaded = Array.isArray(downloadedModels) ? downloadedModels : [];
  const isDownloaded = (filename: string) =>
    safeDownloaded.some((d) => d.filename === filename);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => {
            onChangeBackend('rules');
            setTestResult(null);
          }}
          className={`p-3 rounded-md border text-left transition-colors ${
            llmBackend === 'rules'
              ? 'bg-blue-50 border-blue-600'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-semibold text-slate-900">
            Built-in Reader (Recommended)
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Fast, free, and works right away with nothing extra to download.
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            onChangeBackend('llama_cpp_python');
            setTestResult(null);
          }}
          className={`p-3 rounded-md border text-left transition-colors ${
            llmBackend === 'llama_cpp_python'
              ? 'bg-blue-50 border-blue-600'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-semibold text-slate-900">
            Local AI Model (Optional)
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Runs privately on your computer to help read unusual recruiter emails.
          </div>
        </button>
      </div>

      {llmBackend === 'llama_cpp_python' && (
        <div className="space-y-3">
          {runnerInstalled ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Local AI runner is installed. Pick a model below to download, or enter a local file path.
              </span>
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 space-y-1">
              <div className="font-semibold">Step 1: Install the Local AI Runner</div>
              <p>
                Run <code className="font-mono-tabular">install.bat</code> (Windows),{' '}
                <code className="font-mono-tabular">./install.sh</code> (Mac/Linux), or{' '}
                <code className="font-mono-tabular">uv sync</code> in your project folder, then restart the app.
              </p>
            </div>
          )}

          {safeModels.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Pick a Local AI Model (Works on 8 GB RAM laptops)
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click Download once. Files are saved inside your local <code className="font-mono-tabular">models</code> folder and CPU speed is tuned automatically.
                </p>
              </div>

              {downloadStatus?.status === 'downloading' && (
                <div className="rounded border border-blue-200 bg-white px-3 py-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span>Downloading {downloadStatus.filename}...</span>
                    <span className="font-mono-tabular font-medium">
                      {downloadStatus.percent}% ({downloadStatus.downloaded_mb} / {downloadStatus.total_mb || '?'} MB)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${Math.max(4, downloadStatus.percent)}%` }}
                    />
                  </div>
                </div>
              )}

              {downloadStatus?.status === 'error' && downloadStatus.error && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
                  {downloadStatus.error}
                </div>
              )}

              <div className="space-y-1.5">
                {safeModels.map((m) => {
                  const localPath = `./models/${m.filename}`;
                  const ready = isDownloaded(m.filename);
                  const selected = llmModelPath === localPath;
                  const busyDownloading =
                    downloadStatus?.status === 'downloading' && downloadStatus.model_id === m.id;

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white border rounded px-3 py-2 ${
                        selected ? 'border-blue-500' : 'border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900">
                          {m.name}
                          <span className="font-normal text-slate-500">
                            {' · '}
                            {m.size_label}
                            {' · '}
                            {m.ram_gb}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">{m.best_for}</div>
                      </div>

                      {ready ? (
                        <button
                          type="button"
                          onClick={() => {
                            onChangeModelPath(localPath);
                            setTestResult(null);
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded border whitespace-nowrap shrink-0 ${
                            selected
                              ? 'bg-blue-50 border-blue-600 text-blue-700'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {selected ? 'Selected' : 'Use Model'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={downloadStatus?.status === 'downloading'}
                          onClick={() => handleDownload(m.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-60 whitespace-nowrap shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {busyDownloading ? 'Downloading...' : 'Download'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Model File Path (auto-filled after download, or paste your own)
              </label>
              <input
                type="text"
                value={llmModelPath}
                onChange={(e) => onChangeModelPath(e.target.value)}
                placeholder="./models/qwen2.5-3b-instruct-q4_k_m.gguf"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono-tabular focus:border-blue-600 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0"
            >
              {testing ? 'Checking...' : 'Check Setup'}
            </button>
          </div>
        </div>
      )}

      {llmBackend === 'rules' && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs text-slate-600">
            Ready to use right away. If a Local AI model is ever offline, the app falls back to this automatically.
          </span>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded whitespace-nowrap shrink-0"
          >
            {testing ? 'Checking...' : 'Check Setup'}
          </button>
        </div>
      )}

      {testResult && (
        <div
          className={`flex items-start gap-2 text-xs rounded-md border px-3 py-2 ${
            testResult.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}
    </div>
  );
};
