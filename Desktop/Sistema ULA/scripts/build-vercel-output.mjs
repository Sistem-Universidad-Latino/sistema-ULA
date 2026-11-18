import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const isVercel = Boolean(process.env.VERCEL) || process.argv.includes('--force');

if (!isVercel) {
  console.log('[build-vercel-output] Entorno local detectado (sin VERCEL=1); omitiendo generación de .vercel/output.');
  process.exit(0);
}

const distDir = path.join(projectRoot, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('[build-vercel-output] Error: no existe el directorio dist/. Ejecuta vite build primero.');
  process.exit(1);
}

const outputDir = path.join(projectRoot, '.vercel', 'output');
const staticDir = path.join(outputDir, 'static');
const funcDir = path.join(outputDir, 'functions', 'api', 'send-email.func');

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(staticDir, { recursive: true });
fs.mkdirSync(funcDir, { recursive: true });

// 1. Copiar archivos estáticos generados por Vite a .vercel/output/static
fs.cpSync(distDir, staticDir, { recursive: true });

// 2. Detectar versión de Node compatible para .vc-config.json
const nodeMajor = Number(process.versions.node.split('.')[0]) || 20;
const supportedMajor = [20, 22, 24].includes(nodeMajor) ? nodeMajor : 20;
const runtime = `nodejs${supportedMajor}.x`;

fs.writeFileSync(
  path.join(funcDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
  'utf8'
);

fs.writeFileSync(
  path.join(funcDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime,
      handler: 'index.js',
      launcherType: 'Nodejs',
      shouldAddHelpers: true,
      maxDuration: 30,
    },
    null,
    2
  ) + '\n',
  'utf8'
);

// 3. Copiar api/send-email.cjs como handler de la función serverless
fs.copyFileSync(path.join(projectRoot, 'api', 'send-email.cjs'), path.join(funcDir, 'index.js'));

// 4. Escribir .vercel/output/config.json (Build Output API v3)
fs.writeFileSync(
  path.join(outputDir, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api/send-email$', dest: '/api/send-email' },
        { src: '^/api/incidencias/exportar-email$', dest: '/api/send-email' },
        { handle: 'filesystem' },
        { src: '^/api/(.*)$', dest: 'https://sistema-ula-backend-18ld.onrender.com/api/$1' },
        { src: '^/upload-pdf$', dest: 'https://sistema-ula-backend-18ld.onrender.com/upload-pdf' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2
  ) + '\n',
  'utf8'
);

console.log('[build-vercel-output] Generado .vercel/output (Build Output API v3) con runtime ' + runtime + '.');
