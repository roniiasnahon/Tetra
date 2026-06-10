import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'fs';

// Ensure the public directory exists and has cosmi.png for static asset serving and build output
try {
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const srcIcon = path.resolve(process.cwd(), 'cosmi.png');
  const destIcon = path.resolve(publicDir, 'cosmi.png');
  if (fs.existsSync(srcIcon)) {
    fs.copyFileSync(srcIcon, destIcon);
    console.log('[Vite config] Successfully copied cosmi.png to public/');
  }
} catch (e) {
  console.error('[Vite config] Failed to copy cosmi.png to public:', e);
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
