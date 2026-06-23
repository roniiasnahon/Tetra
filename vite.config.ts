import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'fs';

// Ensure the public directory exists and has cosmi.png, authbg.jpg, and Logo.svg for static asset serving and build output
try {
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  const filesToCopy = ['cosmi.png', 'authbg.jpg', 'Logo.svg', 'Logo-v3.svg'];
  filesToCopy.forEach(filename => {
    const srcPath = path.resolve(process.cwd(), filename);
    const destPath = path.resolve(publicDir, filename);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[Vite config] Successfully copied ${filename} to public/`);
    }
  });
} catch (e) {
  console.error('[Vite config] Failed to copy assets to public directory:', e);
}

export default defineConfig(() => {
  return {
    publicDir: 'public',
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
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/uploads/**']
      },
    },
  };
});
