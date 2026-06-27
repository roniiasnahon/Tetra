import * as fs from 'fs';
import * as path from 'path';

const serverTsPath = path.resolve(process.cwd(), 'server.ts');
let content = fs.readFileSync(serverTsPath, 'utf-8');

if (!content.includes('LinkPreviewSchema')) {
  content = content.replace(
    'VoyageRerankSchema',
    'VoyageRerankSchema,\n  LinkPreviewSchema,\n  FileIdSchema,\n  SearchPapersSchema'
  );
}

const replacements = [
  {
    regex: /app\.get\("\/api\/link-preview", async \(req, res\) => \{\n\s*try \{\n\s*const \{ url \} = req\.query;/,
    replace: 'app.get("/api/link-preview", async (req, res) => {\n    try {\n      const { url } = LinkPreviewSchema.parse(req.query);'
  },
  {
    regex: /app\.get\("\/api\/files\/:id", async \(req, res\) => \{\n\s*try \{\n\s*const file = await getFile\(req\.params\.id\);/,
    replace: 'app.get("/api/files/:id", async (req, res) => {\n    try {\n      const { id } = FileIdSchema.parse(req.params);\n      const file = await getFile(id);'
  },
  {
    regex: /app\.get\("\/api\/files\/:id\/raw-text", async \(req, res\) => \{\n\s*try \{\n\s*const file = await getFile\(req\.params\.id\);/,
    replace: 'app.get("/api/files/:id/raw-text", async (req, res) => {\n    try {\n      const { id } = FileIdSchema.parse(req.params);\n      const file = await getFile(id);'
  },
  {
    regex: /app\.get\("\/api\/research\/papers", async \(req, res\) => \{\n\s*try \{\n\s*const query = req\.query\.q;/,
    replace: 'app.get("/api/research/papers", async (req, res) => {\n    try {\n      const { q: query } = SearchPapersSchema.parse(req.query);'
  }
];

let modified = content;
for (const r of replacements) {
  modified = modified.replace(r.regex, r.replace);
}

// Fix parameter usages that might still refer to req.params.id manually
modified = modified.replace(/console\.log\(\`\[OCR\] Auto-running OCR on uploaded image \$\{req\.params\.id\} via Gemini API\.\.\.\`\);/, 'console.log(`[OCR] Auto-running OCR on uploaded image ${id} via Gemini API...`);');


fs.writeFileSync(serverTsPath, modified, 'utf-8');
console.log('GET validators applied');
