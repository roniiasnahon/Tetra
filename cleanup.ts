
import fs from 'fs/promises';
import path from 'path';

async function cleanup() {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const files = await fs.readdir(uploadsDir);

  for (const file of files) {
    if (file.endsWith('.bin')) {
      const filePath = path.join(uploadsDir, file);
      const buffer = await fs.readFile(filePath);
      
      if (buffer.length < 4 || buffer.subarray(0, 4).toString() !== '%PDF') {
        console.log(`Deleting corrupt file: ${file}`);
        await fs.unlink(filePath);
        const jsonFile = file.replace('.bin', '.json');
        await fs.unlink(path.join(uploadsDir, jsonFile)).catch(() => {});
      }
    }
  }
}

cleanup().catch(console.error);
