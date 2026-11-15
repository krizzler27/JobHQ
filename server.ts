import express from 'express';
import fs from 'node:fs';
import { ChildProcess, execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PY_PORT = 3001;
const PY_BASE = `http://127.0.0.1:${PY_PORT}`;

let pythonChild: ChildProcess | null = null;
let workerChild: ChildProcess | null = null;
let isShuttingDown = false;

function resolvePythonExecutable(): string {
  const isWin = process.platform === 'win32';
  const venvPython = isWin
    ? path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe')
    : path.resolve(process.cwd(), '.venv', 'bin', 'python');

  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  // Preflight alert if virtualenv is not yet initialized
  const setupScript = isWin ? 'install.bat' : './install.sh';
  console.warn(
    `[supervisor] Warning: Python virtualenv not found at ${venvPython}. Run ${setupScript} or 'uv sync' to initialize.`,
  );

  return isWin ? 'python' : 'python3';
}

function stopProcess(child: ChildProcess | null) {
  if (!child || child.killed || !child.pid) return;
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => {});
  } else {
    child.kill('SIGTERM');
  }
}

function stopPythonProcesses() {
  stopProcess(pythonChild);
  stopProcess(workerChild);
  pythonChild = null;
  workerChild = null;
}

function startPythonBackend() {
  const pythonBin = resolvePythonExecutable();
  const child = spawn(pythonBin, ['-m', 'backend'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PY_BACKEND_PORT: String(PY_PORT),
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pythonChild = child;

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(`[python] ${chunk}`);
  });
  child.stderr?.on('data', (chunk) => {
    process.stderr.write(`[python] ${chunk}`);
  });

  child.on('exit', (code) => {
    pythonChild = null;
    if (!isShuttingDown && code !== 0 && code !== null) {
      console.error(`[python] Backend exited unexpectedly with code ${code}`);
    }
  });

  return child;
}

function startPythonWorker() {
  const pythonBin = resolvePythonExecutable();
  const child = spawn(pythonBin, ['-m', 'backend.workers'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  workerChild = child;

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  child.on('exit', (code) => {
    workerChild = null;
    if (!isShuttingDown && code !== 0 && code !== null) {
      console.error(`[worker] Background worker exited unexpectedly with code ${code}`);
    }
  });

  return child;
}

async function waitForPythonReady(retries = 30): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${PY_BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // Wait for Python server startup
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  stopPythonProcesses();
  throw new Error('Python backend failed to become ready on port 3001');
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    return (
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      port === PORT
    );
  } catch {
    return false;
  }
}

function isAllowedHost(host: string | undefined): boolean {
  if (!host) return true;
  const hostname = host.split(':')[0].toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === HOST.toLowerCase();
}

async function startServer() {
  startPythonBackend();
  await waitForPythonReady();
  startPythonWorker();

  const app = express();

  // Security: Block DNS rebinding and cross-site drive-by attacks against localhost
  app.use((req, res, next) => {
    if (!isAllowedHost(req.headers.host)) {
      res.status(403).json({ error: 'Blocked: invalid host header.' });
      return;
    }

    const secFetchSite = req.headers['sec-fetch-site'];
    if (secFetchSite === 'cross-site') {
      res.status(403).json({ error: 'Blocked: unauthorized cross-site request.' });
      return;
    }

    if (!isAllowedOrigin(req.headers.origin)) {
      res.status(403).json({ error: 'Blocked: untrusted origin.' });
      return;
    }

    next();
  });

  app.use(express.json({ limit: '2mb' }));

  app.all('/api/*', async (req, res) => {
    try {
      const targetUrl = `${PY_BASE}${req.originalUrl}`;
      const headers: Record<string, string> = {};
      if (req.headers['content-type']) {
        headers['Content-Type'] = req.headers['content-type'];
      }

      const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase());
      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      });

      const contentType = upstream.headers.get('content-type') || 'application/json';
      const text = await upstream.text();
      res.status(upstream.status).setHeader('Content-Type', contentType).send(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Backend proxy error';
      res.status(502).json({ error: message });
    }
  });

  let vite: Awaited<ReturnType<typeof createViteServer>> | null = null;
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, HOST, () => {
    console.log(`Job Tracker running on http://localhost:${PORT} (bound to ${HOST})`);
  });

  const gracefulShutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    stopPythonProcesses();
    httpServer.close(() => {
      if (vite) {
        vite.close().finally(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGBREAK' as NodeJS.Signals, gracefulShutdown);
  process.on('exit', stopPythonProcesses);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  stopPythonProcesses();
  process.exit(1);
});
