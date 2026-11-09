import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { AegisPipelineOrchestrator } from './src/engine/pipelineOrchestrator';
import { AnalysisIntent, ZeroSourceDiagnosticCode } from './src/engine/types';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      engine: 'Aegis Open-World Live Retrieval & Financial Provenance Engine v2.0',
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const {
        query = 'Financial analysis of Wipro',
        explicitIntent,
        maxSources = 4,
        forcedDiagnosticMode = 'NONE',
        bypassCache = false
      } = req.body || {};

      const run = await AegisPipelineOrchestrator.executePipelineAsync({
        query: String(query),
        explicitIntent: explicitIntent as AnalysisIntent | undefined,
        maxSources: Number(maxSources) || 4,
        forcedDiagnosticMode: forcedDiagnosticMode as ZeroSourceDiagnosticCode,
        bypassCache: Boolean(bypassCache)
      });

      res.json(run);
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Live pipeline execution failed'
      });
    }
  });

  app.get('/api/regression-matrix', async (req, res) => {
    try {
      const maxSources = Number(req.query.maxSources) || 4;
      const results = await AegisPipelineOrchestrator.runFullRegressionMatrixAsync(maxSources);
      res.json({ results });
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Regression matrix execution failed'
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
        watch: null
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Aegis Full-Stack Live Evidence Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
