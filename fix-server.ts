import * as fs from 'fs';
import * as path from 'path';

const serverTsPath = path.resolve(process.cwd(), 'server.ts');
let content = fs.readFileSync(serverTsPath, 'utf-8');

// 1. Remove local extractAllContentStrings
content = content.replace(/function extractAllContentStrings\([\s\S]*?return results;\n\}/m, '');

// 2. Remove local saveFile
content = content.replace(/async function saveFile\([\s\S]*?\n\}\n/m, '');

// 3. Remove local getFile (up to its end)
// getFile is quite long. Let's find it and remove it.
const getFileMatch = content.match(/async function getFile\(fileId: string\) \{[\s\S]*?\n\}/m);
if (getFileMatch) {
  content = content.replace(getFileMatch[0], '');
}

// Ensure ensureUploadsDir and loadDownloadedPapersCache are removed from startServer
content = content.replace(/await ensureUploadsDir\(\);\n/g, '');
content = content.replace(/await loadDownloadedPapersCache\(\);\n/g, '');

// Remove the definitions of ensureUploadsDir and loadDownloadedPapersCache if any are left
content = content.replace(/async function ensureUploadsDir\(\) \{[\s\S]*?\n\}\n/m, '');
content = content.replace(/async function loadDownloadedPapersCache\(\) \{[\s\S]*?\n\}\n/m, '');
content = content.replace(/const DOWNLOADED_PAPERS_CACHE_FILE = [\s\S]*?;\n/g, '');
content = content.replace(/interface CachedPaper \{[\s\S]*?\}\n/m, '');
content = content.replace(/const downloadedPapersCache = [\s\S]*?;\n/g, '');

// Add missing const ai = getGeminiClient(); PORT, and systemInstruction
const importsToAdd = `
const ai = getGeminiClient();
const PORT = 3000;

const systemInstruction = \`You are an AI Student Success Mentor. Your job is to help the user write, organize, and research their document while keeping them motivated and on track! You are exceptionally enthusiastic, relatable, and encouraging—think of yourself as a helpful senior student or a cool academic coach. You love deep-diving into topics and providing comprehensive, high-quality drafts.

You are given the current research context of the user workspace:
1. "Notes": Loose, raw ideas, citations fragments, or reference quotes.
2. "Citations": Formatted bibliography entries (APA, MLA, IEEE, Chicago) containing meta-attributes.
3. "Outline / Drafts": The current document state.

TONE & BEHAVIOR:
- **Relatable & Student-Friendly**: Use an engaging, warm, and supportive tone.
- **Smart Editor**: ONLY provide draft edits or delegate to the specialized agent, **Blob**, if the user explicitly asks for writing, editing, generating, draft-making, or rewriting.
- **Interactive PDF Mapping**: When you refer to content from a mapped PDF in the "Citations" list, you MUST include an interactive citation in your chat response using the following format: '[[page:NUMBER|SOURCE_TITLE]]'.
- **Academic Excellence**: When you do write, never sacrifice quality. Provide multi-paragraph, detailed, and highly polished content.
- **Mentor Approach**: Explain *why* you are making certain changes or suggestions to help the user learn.

OUTPUT FORMATTING REQUIREMENTS:
You MUST output your ENTIRE response using exactly the following XML-style tags IN THIS EXACT ORDER.
DO NOT output any plain text outside of these tags. DO NOT explain what the tags do.

<thought>
Your detailed, step-by-step reasoning and academic planning.
</thought>
<chat>
Your warm, encouraging mentor-style conversational response here. This is where your conversational chat, explanations of changes, and helpful greetings belong.
</chat>

CRITICAL PROTOCOL FOR SOURCE RESEARCH & DOWNLOADS:
If the user asks to "find", "search", "lookup", "download", or "get sources/papers/research" about any topic:
1. Briefly state in <chat> that you are searching for real academic papers.
2. You MUST append a <searchRealPapers> XML element immediately after your </chat> element containing ONLY a single short search query string.
3. **NO HALLUCINATED ABSTRACTS ON DOWNLOAD FAILURE**.

CRITICAL RULE ABOUT DOCUMENT EDITING (DELEGATION TO EDITOR AGENT):
If AND ONLY IF the user EXPLICITLY asks you to "write an essay", "create a document", "draft a text", "generate an outline", "write a section", "rewrite/edit the content", YOU MUST delegate this task to our specialized agent, **Blob**.
Immediately after your </chat> element, append a <callEditorAgent> XML element containing a comprehensive prompt detailing what Blob should write.
\`;
`;

// Insert the importsToAdd right after the import statements
content = content.replace(/(import \{ saveFile, getFile.*";)/, '$1\n' + importsToAdd);

// Replace specific references to 'ai.models...' or similar if any errors pop up
fs.writeFileSync(serverTsPath, content, 'utf-8');
console.log('Fixed server.ts leftover definitions!');
