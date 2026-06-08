import React, { useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { pdfjs } from 'react-pdf';

export function StatisticsTools({
  onAddHistory,
  selectedHistoryItem,
  onClearSelectedHistoryItem,
  activeTab: controlledActiveTab,
  onChangeActiveTab
}: {
  onAddHistory?: (item: any) => void;
  selectedHistoryItem?: any;
  onClearSelectedHistoryItem?: () => void;
  activeTab?: 'slovin' | 'percentage' | 'weighted' | 'likert' | 'ai' | 'citation';
  onChangeActiveTab?: (tab: 'slovin' | 'percentage' | 'weighted' | 'likert' | 'ai' | 'citation') => void;
} = {}) {
  const [internalActiveTab, setInternalActiveTab] = useState<'slovin' | 'percentage' | 'weighted' | 'likert' | 'ai' | 'citation'>('slovin');

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = onChangeActiveTab !== undefined ? onChangeActiveTab : setInternalActiveTab;

  // Slovin State
  const [population, setPopulation] = useState('1000');
  const [marginOfError, setMarginOfError] = useState('0.05');

  // Percentage State
  const [part, setPart] = useState('75');
  const [total, setTotal] = useState('250');

  // Weighted Mean State
  const [entries, setEntries] = useState([
    { value: '95', weight: '3' },
    { value: '88', weight: '4' },
    { value: '92', weight: '2' }
  ]);
  
  // Likert State
  const [likertChoices, setLikertChoices] = useState([
    { label: 'Strongly Agree', weight: 5, count: '42' },
    { label: 'Agree', weight: 4, count: '35' },
    { label: 'Neutral', weight: 3, count: '18' },
    { label: 'Disagree', weight: 2, count: '10' },
    { label: 'Strongly Disagree', weight: 1, count: '5' }
  ]);

  // Citation Generator State
  const [citationSourceType, setCitationSourceType] = useState<'book' | 'journal' | 'website'>('book');
  const [copiedStyleId, setCopiedStyleId] = useState<string | null>(null);
  const [citationFields, setCitationFields] = useState({
    authors: 'Smith, John; Doe, Jane',
    title: 'Research Methods in Social Sciences',
    publisher: 'Oxford University Press',
    year: '2021',
    edition: '3rd',
    journal: 'Academic Social Inquiry',
    volume: '24',
    issue: '2',
    pages: '115-130',
    doi: '10.1017/asi.2021.5',
    url: 'https://doi.org/10.1017/asi.2021.5',
    siteName: 'Social Studies Portal',
    pubDate: '2021-04-12',
    accessDate: '2026-06-08'
  });

  const triggerCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStyleId(label);
    setTimeout(() => setCopiedStyleId(null), 2000);
  };

  const getAuthorsList = (raw: string): string[] => {
    if (!raw.trim()) return [];
    return raw.split(';').map(a => a.trim()).filter(Boolean);
  };

  const formatAPAAuthors = (authors: string[]): string => {
    if (authors.length === 0) return 'Anonymous';
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
    return `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;
  };

  const formatMLAAuthors = (authors: string[]): string => {
    if (authors.length === 0) return 'Anonymous';
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
    return `${authors[0]}, et al`;
  };

  const formatIEEEAuthors = (authors: string[]): string => {
    if (authors.length === 0) return 'Anonymous';
    const initName = (auth: string) => {
      if (auth.includes(',')) {
        const parts = auth.split(',');
        const last = parts[0].trim();
        const first = parts[1].trim();
        return `${first.charAt(0)}. ${last}`;
      }
      return auth;
    };
    if (authors.length === 1) return initName(authors[0]);
    if (authors.length === 2) return `${initName(authors[0])} and ${initName(authors[1])}`;
    return `${initName(authors[0])} et al.`;
  };

  const generateCitationText = (
    sourceType: 'book' | 'journal' | 'website',
    style: 'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee',
    fields: typeof citationFields
  ) => {
    const rawAuthors = getAuthorsList(fields.authors);
    const apaAuthors = formatAPAAuthors(rawAuthors);
    const mlaAuthors = formatMLAAuthors(rawAuthors);
    const ieeeAuthors = formatIEEEAuthors(rawAuthors);

    const firstAuthorLastName = () => {
      if (rawAuthors.length === 0) return "Anonymous";
      const first = rawAuthors[0];
      if (first.includes(',')) return first.split(',')[0].trim();
      return first.split(' ')[0].trim();
    };

    if (sourceType === 'book') {
      const yr = fields.year || 'n.d.';
      const edSuffix = fields.edition ? ` (${fields.edition} ed.)` : '';
      const pub = fields.publisher || '[Publisher Unknown]';
      const bTitle = fields.title || 'Untitled Book';

      switch (style) {
        case 'apa':
          return {
            reference: `${apaAuthors} (${yr}). *${bTitle}*${edSuffix}. ${pub}.`,
            inText: `(${firstAuthorLastName()}${rawAuthors.length > 2 ? ' et al.' : rawAuthors.length === 2 ? ' & ' + (rawAuthors[1].includes(',') ? rawAuthors[1].split(',')[0].trim() : rawAuthors[1]) : ''}, ${yr})`
          };
        case 'mla': {
          const edMLASuffix = fields.edition ? `, ${fields.edition} ed.` : '';
          return {
            reference: `${mlaAuthors}. *${bTitle}*${edMLASuffix}, ${pub}, ${yr}.`,
            inText: `(${firstAuthorLastName()})`
          };
        }
        case 'chicago': {
          const edChSuffix = fields.edition ? `, ${fields.edition} ed.` : '';
          return {
            reference: `${mlaAuthors}. *${bTitle}*${edChSuffix}. ${pub}, ${yr}.`,
            inText: `(${firstAuthorLastName()} ${yr})`
          };
        }
        case 'harvard': {
          const edHarvSuffix = fields.edition ? `, ${fields.edition} edn` : '';
          return {
            reference: `${apaAuthors} ${yr}, *${bTitle}*${edHarvSuffix}, ${pub}.`,
            inText: `(${firstAuthorLastName()} ${yr})`
          };
        }
        case 'ieee':
          return {
            reference: `[1] ${ieeeAuthors}, *${bTitle}*, ${fields.edition ? fields.edition + ' ed. ' : ''}${pub}, ${yr}.`,
            inText: `[1]`
          };
      }
    } else if (sourceType === 'journal') {
      const yr = fields.year || 'n.d.';
      const artTitle = fields.title || 'Untitled Article';
      const jName = fields.journal || 'Untitled Journal';
      const vol = fields.volume ? `, ${fields.volume}` : '';
      const issueStr = fields.issue ? `(${fields.issue})` : '';
      const pg = fields.pages ? `, ${fields.pages}` : '';
      const doiStr = fields.doi ? ` https://doi.org/${fields.doi}` : '';

      switch (style) {
        case 'apa':
          return {
            reference: `${apaAuthors} (${yr}). ${artTitle}. *${jName}*${vol}${issueStr}${pg}.${doiStr}`,
            inText: `(${firstAuthorLastName()}${rawAuthors.length > 2 ? ' et al.' : rawAuthors.length === 2 ? ' & ' + (rawAuthors[1].includes(',') ? rawAuthors[1].split(',')[0].trim() : rawAuthors[1]) : ''}, ${yr})`
          };
        case 'mla': {
          const volStr = fields.volume ? `, vol. ${fields.volume}` : '';
          const issStr = fields.issue ? `, no. ${fields.issue}` : '';
          const pgStr = fields.pages ? `, pp. ${fields.pages}` : '';
          return {
            reference: `${mlaAuthors}. "${artTitle}." *${jName}*${volStr}${issStr}, ${yr}${pgStr}.${doiStr ? ' ' + doiStr : ''}`,
            inText: `(${firstAuthorLastName()}${fields.pages ? ' ' + fields.pages.split('-')[0].trim() : ''})`
          };
        }
        case 'chicago': {
          const volStr = fields.volume ? ` ${fields.volume}` : '';
          const issStr = fields.issue ? `, no. ${fields.issue}` : '';
          const pgStr = fields.pages ? `: ${fields.pages}` : '';
          return {
            reference: `${mlaAuthors}. "${artTitle}." *${jName}*${volStr}${issStr} (${yr})${pgStr}.${doiStr ? ' ' + doiStr : ''}`,
            inText: `(${firstAuthorLastName()} ${yr}${fields.pages ? ', ' + fields.pages.split('-')[0].trim() : ''})`
          };
        }
        case 'harvard': {
          const volStr = fields.volume ? `, vol. ${fields.volume}` : '';
          const issStr = fields.issue ? `, no. ${fields.issue}` : '';
          const pgStr = fields.pages ? `, pp. ${fields.pages}` : '';
          return {
            reference: `${apaAuthors} ${yr}, '${artTitle}', *${jName}*${volStr}${issStr}${pgStr}.${doiStr ? ' ' + doiStr : ''}`,
            inText: `(${firstAuthorLastName()} ${yr})`
          };
        }
        case 'ieee': {
          const volStr = fields.volume ? `, vol. ${fields.volume}` : '';
          const issStr = fields.issue ? `, no. ${fields.issue}` : '';
          const pgStr = fields.pages ? `, pp. ${fields.pages}` : '';
          return {
            reference: `[1] ${ieeeAuthors}, "${artTitle}," *${jName}*${volStr}${issStr}${pgStr}, ${yr}.${fields.doi ? ' doi: ' + fields.doi + '.' : ''}`,
            inText: `[1]`
          };
        }
      }
    } else {
      const yr = fields.pubDate ? fields.pubDate.split('-')[0] : 'n.d.';
      const pDate = fields.pubDate || 'n.d.';
      const webTitle = fields.title || 'Untitled Webpage';
      const sName = fields.siteName || 'Website';
      const accDate = fields.accessDate || 'June 8, 2026';
      const u = fields.url || 'https://...';

      const formatDateMLA = (dStr: string) => {
        if (!dStr || dStr === 'n.d.') return '';
        const parts = dStr.split('-');
        if (parts.length < 3) return dStr;
        const yVal = parts[0];
        const moNum = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
        return `${day} ${months[moNum-1] || parts[1]} ${yVal}`;
      };

      switch (style) {
        case 'apa':
          return {
            reference: `${apaAuthors} (${pDate}). *${webTitle}*. ${sName}. ${u}`,
            inText: `(${firstAuthorLastName()}, ${yr})`
          };
        case 'mla':
          return {
            reference: `${mlaAuthors}. "${webTitle}." *${sName}*, ${formatDateMLA(pDate)}, ${u}. Accessed ${formatDateMLA(accDate)}.`,
            inText: `("${webTitle.substring(0, 15)}...")`
          };
        case 'chicago':
          return {
            reference: `${mlaAuthors}. "${webTitle}." ${sName}. Last modified ${pDate}. ${u}.`,
            inText: `(${firstAuthorLastName()} ${yr})`
          };
        case 'harvard':
          return {
            reference: `${apaAuthors} ${yr}, *${webTitle}*, ${sName}, viewed ${formatDateMLA(accDate)}, <${u}>.`,
            inText: `(${firstAuthorLastName()} ${yr})`
          };
        case 'ieee':
          return {
            reference: `[1] ${ieeeAuthors}, "${webTitle}," *${sName}*, ${yr}. [Online]. Available: ${u}. [Accessed: ${accDate}].`,
            inText: `[1]`
          };
      }
    }
  };

  // AI Analysis State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  React.useEffect(() => {
    if (selectedHistoryItem) {
      setActiveTab(selectedHistoryItem.type);
      if (selectedHistoryItem.type === 'slovin') {
        setPopulation(selectedHistoryItem.parameters.population || '1000');
        setMarginOfError(selectedHistoryItem.parameters.marginOfError || '0.05');
      } else if (selectedHistoryItem.type === 'percentage') {
        setPart(selectedHistoryItem.parameters.part || '75');
        setTotal(selectedHistoryItem.parameters.total || '250');
      } else if (selectedHistoryItem.type === 'weighted') {
        setEntries(selectedHistoryItem.parameters.entries || []);
      } else if (selectedHistoryItem.type === 'likert') {
        if (selectedHistoryItem.parameters.likertChoices) {
          setLikertChoices(selectedHistoryItem.parameters.likertChoices);
        } else if (selectedHistoryItem.parameters.likertCounts) {
          const counts = selectedHistoryItem.parameters.likertCounts;
          setLikertChoices([
            { label: 'Strongly Agree', weight: 5, count: counts[0] || '0' },
            { label: 'Agree', weight: 4, count: counts[1] || '0' },
            { label: 'Neutral', weight: 3, count: counts[2] || '0' },
            { label: 'Disagree', weight: 2, count: counts[3] || '0' },
            { label: 'Strongly Disagree', weight: 1, count: counts[4] || '0' }
          ]);
        }
      } else if (selectedHistoryItem.type === 'citation') {
        setCitationSourceType(selectedHistoryItem.parameters.sourceType || 'book');
        setCitationFields(selectedHistoryItem.parameters.fields || {});
      } else if (selectedHistoryItem.type === 'ai') {
        setFileName(selectedHistoryItem.parameters.fileName || '');
        setAnalysisResult(selectedHistoryItem.parameters.analysisResult || '');
      }
      onClearSelectedHistoryItem?.();
    }
  }, [selectedHistoryItem]);

  const addLikertChoice = () => {
    const weights = likertChoices.map(c => c.weight);
    const minWeight = weights.length > 0 ? Math.min(...weights) : 1;
    const nextWeight = minWeight - 1;
    setLikertChoices([
      ...likertChoices,
      { label: `Choice #${likertChoices.length + 1}`, weight: nextWeight > 0 ? nextWeight : 1, count: '0' }
    ]);
  };

  const removeLikertChoice = (indexToRemove: number) => {
    if (likertChoices.length <= 1) return;
    setLikertChoices(likertChoices.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsAnalyzing(true);
    setFileName(file.name);
    setAnalysisResult('');

    try {
      // 1. Upload the file to memory/disk
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed.");
      const uploadText = await uploadRes.text();
      if (uploadText.trim().startsWith("<!doctype") || uploadText.trim().startsWith("<html")) {
        throw new Error("File upload failed. The engine returned an HTML error page instead of JSON. Check the server configuration.");
      }
      const uploadData = JSON.parse(uploadText);
      const fileId = uploadData.fileId;

      // 2. Extract text from the uploaded file
      let textContent = "";
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const pdfFileRes = await fetch(`/api/files/${fileId}`);
        if (!pdfFileRes.ok) throw new Error("Failed to load PDF file from workspace.");
        const arrayBuffer = await pdfFileRes.arrayBuffer();

        const loadingTask = pdfjs.getDocument({
          data: arrayBuffer,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
          cMapPacked: true,
        });
        const pdfDoc = await loadingTask.promise;
        let fullText = "";
        const numPagesToParse = Math.min(pdfDoc.numPages, 15);
        for (let pageNum = 1; pageNum <= numPagesToParse; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const tContent = await page.getTextContent();
          const pageText = tContent.items
            .map((item: any) => item.str)
            .join(" ");
          fullText += `--- Page ${pageNum} of ${pdfDoc.numPages} ---\n${pageText}\n\n`;
        }
        textContent = fullText;
      } else {
        const textRes = await fetch(`/api/files/${fileId}/raw-text`);
        if (textRes.ok) {
           const textResText = await textRes.text();
           if (!textResText.trim().startsWith("<!doctype") && !textResText.trim().startsWith("<html")) {
             const textData = JSON.parse(textResText);
             textContent = textData.success && textData.text ? textData.text : "";
           }
        }
      }

      if (!textContent) throw new Error("Could not extract any content from the file.");

      // 3. Send text to Mistral for analysis
      const analysisRes = await fetch("/api/statistics/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textContent, filename: file.name })
      });

      if (!analysisRes.ok) throw new Error("Analysis failed.");
      const analysisText = await analysisRes.text();
      if (analysisText.trim().startsWith("<!doctype") || analysisText.trim().startsWith("<html")) {
        throw new Error("Analysis failed. The AI endpoint returned HTML instead of JSON. Ensure your server is running and the API keys are configured.");
      }
      const analysisData = JSON.parse(analysisText);
      
      const resultText = analysisData.analysis || "No analysis provided.";
      setAnalysisResult(resultText);

      // Save to Tools history!
      onAddHistory?.({
        type: 'ai',
        title: `Cosmi Audit (${file.name})`,
        parameters: { fileName: file.name, analysisResult: resultText },
        result: `Cosmi AI Data analysis complete`
      });
    } catch (err: any) {
      console.error(err);
      setAnalysisResult(`**Error:** ${err.message || 'Failed to analyze file.'}`);
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Custom renders for Markdown components to style tables dynamically
  const markdownComponents = {
    table: ({ children }: any) => (
      <div className="my-5 overflow-hidden border border-[#27272a] rounded-xl bg-[#0d0d0e]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11.5px] min-w-[500px]">
            {children}
          </table>
        </div>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="border-b border-[#27272a] bg-[#161618] text-[#a1a1aa] font-medium">
        {children}
      </thead>
    ),
    tbody: ({ children }: any) => (
      <tbody className="divide-y divide-[#1e1e20] text-[#e4e4e7]">
        {children}
      </tbody>
    ),
    tr: ({ children }: any) => (
       <tr className="hover:bg-zinc-900/30 transition-colors">
         {children}
       </tr>
    ),
    th: ({ children }: any) => (
      <th className="px-4 py-3 font-semibold tracking-wide text-[#f4f4f5] border-r border-[#27272a] last:border-r-0 uppercase text-[9.5px]">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="px-4 py-2.5 text-[#d4d4d8] leading-relaxed border-r border-[#1e1e20] last:border-r-0 font-jakarta">
        {children}
      </td>
    ),
    h1: ({ children }: any) => <h1 className="text-base font-bold text-[#f4f4f5] mt-6 mb-3 border-b border-[#27272a] pb-2 flex items-center gap-1.5">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-sm font-semibold text-[#f4f4f5] mt-5 mb-2.5">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-xs font-semibold text-[#e4e4e7] mt-4 mb-2">{children}</h3>,
    p: ({ children }: any) => <p className="leading-relaxed mb-3.5 text-[#d4d4d8] text-[12px]">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc pl-5 mb-3.5 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-3.5 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="text-[12px] text-[#d4d4d8]">{children}</li>,
    blockquote: ({ children }: any) => <blockquote className="border-l-2 border-zinc-500 pl-3 italic my-4 text-zinc-400 bg-zinc-900/20 py-1 rounded-r">{children}</blockquote>,
    code: ({ node, inline, className, children, ...props }: any) => (
      <code className="bg-[#1a1a1c] border border-[#27272a] text-[#f4f4f5] rounded px-1 py-0.5 text-[10.5px] font-mono" {...props}>
        {children}
      </code>
    )
  };

  const renderSlovinLeft = () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Population Size (N)</label>
          <div className="relative">
            <input 
              type="number" 
              value={population}
              min="1"
              onChange={e => setPopulation(e.target.value)}
              className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-[12px] text-[#f4f4f5] outline-none transition-colors"
              placeholder="e.g. 1000"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-[#52525b] font-mono">N</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Margin of Error (e)</label>
          <div className="relative">
            <input 
              type="number" 
              value={marginOfError}
              step="0.01"
              min="0.001"
              max="0.99"
              onChange={e => setMarginOfError(e.target.value)}
              className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-[12px] text-[#f4f4f5] outline-none transition-colors"
              placeholder="e.g. 0.05"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-[#52525b] font-mono">e</span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#0e0e0f] text-[11px] text-[#71717a] leading-relaxed">
          <div className="font-semibold text-[#a1a1aa] mb-1">
            Slovin's Formula Indicator
          </div>
          Used when estimating sample sizes from a known finite population size. It provides a simple approximation of the target sample count necessary for confidence limits.
        </div>
      </div>
    );
  };

  const renderSlovinRight = () => {
    const N = parseFloat(population);
    const e = parseFloat(marginOfError);
    let n = 0;
    let valid = false;
    let denom = 1;
    let eSq = 0;
    let product = 0;

    if (N > 0 && e > 0) {
      eSq = Math.pow(e, 2);
      product = N * eSq;
      denom = 1 + product;
      n = N / denom;
      valid = true;
    }

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <h3 className="text-xs font-semibold text-[#e4e4e7] pt-8 pb-3 border-b border-[#222225] uppercase tracking-wide px-8 shrink-0">
          Calculation Breakdown
        </h3>
        <div className="px-8 pt-6 pb-8 overflow-y-auto scrollbar-thin scrollbar-thumb-[#27272a] hover:scrollbar-thumb-[#3f3f46] flex-1">
          {valid ? (
            <div className="space-y-4 font-mono text-[11.5px] text-[#a1a1aa]">
              <div className="p-3 bg-[#161618] rounded-lg text-center text-[#f4f4f5] text-sm font-semibold">
                n = N / (1 + N · e²)
              </div>
              <div className="space-y-2 pt-2">
                <div className="flex justify-between border-b border-[#1b1b1d] pb-2">
                  <span>1. Slope of Error (e²)</span>
                  <span className="text-[#e4e4e7]">{eSq.toFixed(5)}</span>
                </div>
                <div className="flex justify-between border-b border-[#1b1b1d] pb-2">
                  <span>2. Product (N · e²)</span>
                  <span className="text-[#e4e4e7]">{product.toFixed(4)}</span>
                </div>
                <div className="flex justify-between border-b border-[#1b1b1d] pb-2">
                  <span>3. Denominator (1 + N · e²)</span>
                  <span className="text-[#e4e4e7]">{denom.toFixed(4)}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span>4. Unrounded size (n)</span>
                  <span className="text-zinc-500">{n.toFixed(4)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#52525b] italic">Please provide valid population and margin of error parameters.</p>
          )}
        </div>

        {valid && (
          <div className="space-y-3 mt-4">
            <div className="p-4 bg-zinc-900/40 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">Required Sample Size</div>
                <div className="text-[11px] text-[#52525b] italic">(Rounded up to next whole count)</div>
              </div>
              <div className="text-3xl font-bold font-mono text-[#f4f4f5]">{Math.ceil(n)}</div>
            </div>
            
            <button
              onClick={() => {
                onAddHistory?.({
                  type: 'slovin',
                  title: `Slovin Sample (N=${N}, e=${e})`,
                  parameters: { population, marginOfError },
                  result: `Required sample size: ${Math.ceil(n)}`
                });
              }}
              className="w-full py-2 bg-[#161617] hover:bg-zinc-800 text-[11px] font-medium text-[#e4e4e7] rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#222225] shadow-none select-none"
            >
              Save to Tools History
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderPercentageLeft = () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Subgroup/Part Count</label>
          <input 
            type="number" 
            value={part}
            min="0"
            onChange={e => setPart(e.target.value)}
            className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-[12px] text-[#f4f4f5] outline-none transition-colors"
            placeholder="e.g. 75"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Total Population</label>
          <input 
            type="number" 
            value={total}
            min="1"
            onChange={e => setTotal(e.target.value)}
            className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-[12px] text-[#f4f4f5] outline-none transition-colors"
            placeholder="e.g. 250"
          />
        </div>
        <div className="p-4 rounded-xl bg-[#0e0e0f] text-[11px] text-[#71717a] leading-relaxed">
          <div className="font-semibold text-[#a1a1aa] mb-1">
            Percentage Distribution
          </div>
          Calculates the proportional percentage representation of a target group within a grand total. Used frequently in demographic profiling of respondents.
        </div>
      </div>
    );
  };

  const renderPercentageRight = () => {
    const p = parseFloat(part);
    const t = parseFloat(total);
    const pct = (t > 0) ? (p / t) * 100 : 0;
    const remaining = 100 - pct;
    const isValid = !isNaN(p) && !isNaN(t) && t > 0;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <h3 className="text-xs font-semibold text-[#e4e4e7] pt-8 pb-3 border-b border-[#222225] uppercase tracking-wide px-8 shrink-0">
          Proportional Breakdown
        </h3>
        <div className="px-8 pt-6 pb-8 overflow-y-auto scrollbar-thin scrollbar-thumb-[#27272a] hover:scrollbar-thumb-[#3f3f46] flex-1">
          {isValid ? (
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between font-mono text-[11px] text-[#a1a1aa]">
                  <span>Formula</span>
                  <span className="text-zinc-400">(Part / Total) · 100 %</span>
                </div>
                <div className="flex justify-between font-mono text-[11px] text-[#a1a1aa]">
                  <span>Subgroup fraction</span>
                  <span className="text-[#e4e4e7]">{p} / {t} = {(p / t).toFixed(4)}</span>
                </div>
              </div>

              {/* Dynamic Stacked Bar Progress Representation */}
              <div className="pt-4 space-y-2">
                <div className="flex h-3 w-full bg-[#1a1a1c] rounded-md overflow-hidden">
                  <div className="bg-[#10b981] h-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                  <div className="bg-[#27272a] h-full transition-all duration-300" style={{ width: `${remaining}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] text-[#71717a] font-mono">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span> Target ({pct.toFixed(1)}%)</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#27272a]"></span> Remaining ({remaining.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#52525b] italic">Please provide a valid part count and a total greater than zero.</p>
          )}
        </div>

        {isValid && (
          <div className="space-y-3 mt-4">
            <div className="p-4 bg-zinc-900/40 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">Calculated Proportion</div>
                <div className="text-[11px] text-[#52525b] italic">Ratio = {(p / t).toFixed(5)}</div>
              </div>
              <div className="text-3xl font-bold font-mono text-[#10b981]">{pct.toFixed(2)}%</div>
            </div>

            <button
              onClick={() => {
                onAddHistory?.({
                  type: 'percentage',
                  title: `Portion (${p} of ${t})`,
                  parameters: { part, total },
                  result: `Proportion: ${pct.toFixed(2)}%`
                });
              }}
              className="w-full py-2 bg-[#161617] hover:bg-zinc-800 text-[11px] font-medium text-[#e4e4e7] rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#222225] shadow-none select-none"
            >
              Save to Tools History
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderWeightedMeanLeft = () => {
    return (
      <div className="space-y-4">
        <label className="text-[10px] text-[#71717a] font-bold uppercase block tracking-wider">Entries (Value & Dynamic Weights)</label>
        <div className="space-y-2.5">
          {entries.map((entry, idx) => (
             <div key={idx} className="flex gap-2 relative group items-center">
                <div className="text-[10.5px] font-mono text-zinc-650 w-4 text-center">{idx + 1}</div>
                <input 
                  type="number" 
                  placeholder="Value (x)"
                  value={entry.value}
                  onChange={e => {
                    const newEntries = [...entries];
                    newEntries[idx].value = e.target.value;
                    setEntries(newEntries);
                  }}
                  className="flex-1 min-w-0 bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3.5 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
                />
                <input 
                  type="number" 
                  placeholder="Weight (w)"
                  value={entry.weight}
                  onChange={e => {
                    const newEntries = [...entries];
                    newEntries[idx].weight = e.target.value;
                    setEntries(newEntries);
                  }}
                  className="flex-1 min-w-0 bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3.5 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
                />
                {entries.length > 1 && (
                  <button 
                    onClick={() => {
                        const newEntries = entries.filter((_, i) => i !== idx);
                        setEntries(newEntries);
                    }}
                    className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                  >
                     <Icon icon="ph:trash" className="w-3.5 h-3.5" />
                  </button>
                )}
             </div>
          ))}
        </div>
        <button 
          onClick={() => setEntries([...entries, { value: '', weight: '' }])}
          className="w-full py-2 flex justify-center items-center gap-1.5 text-[11px] text-[#a1a1aa] hover:text-[#f4f4f5] border border-dashed border-[#27272a] hover:border-[#52525b] rounded-xl transition-colors cursor-pointer"
        >
          Add Value Entry Row
        </button>
      </div>
    );
  };

  const renderWeightedMeanRight = () => {
    let sumWeight = 0;
    let sumValueWeight = 0;
    let isValid = false;
    const validatedRows: Array<{ val: number, wt: number, product: number }> = [];

    entries.forEach(entry => {
      const v = parseFloat(entry.value);
      const w = parseFloat(entry.weight);
      if (!isNaN(w) && !isNaN(v)) {
        sumWeight += w;
        sumValueWeight += (v * w);
        validatedRows.push({ val: v, wt: w, product: v * w });
        isValid = true;
      }
    });

    const mean = (isValid && sumWeight > 0) ? sumValueWeight / sumWeight : 0;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <h3 className="text-xs font-semibold text-[#e4e4e7] pt-8 pb-3 border-b border-[#222225] uppercase tracking-wide px-8 shrink-0">
          Weighted Valuation
        </h3>
        <div className="px-8 pt-6 pb-8 overflow-y-auto scrollbar-thin scrollbar-thumb-[#27272a] hover:scrollbar-thumb-[#3f3f46] flex-1">
          {isValid && validatedRows.length > 0 ? (
            <div className="space-y-3.5">
              <div className="overflow-x-auto rounded-lg max-h-[160px] overflow-y-auto">
                <table className="w-full text-left text-[10.5px] border-collapse">
                  <thead>
                    <tr className="bg-[#161618] border-b border-[#1e1e20] text-[#71717a] font-mono">
                      <th className="px-3 py-1.5 font-semibold text-[#a1a1aa]">Value (x)</th>
                      <th className="px-3 py-1.5 font-semibold text-[#a1a1aa]">Weight (w)</th>
                      <th className="px-3 py-1.5 font-semibold text-[#a1a1aa] text-right">Product (x · w)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#18181a] font-mono text-[#a1a1aa]">
                    {validatedRows.map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-900/10">
                        <td className="px-3 py-1.5">{row.val}</td>
                        <td className="px-3 py-1.5">{row.wt}</td>
                        <td className="px-3 py-1.5 text-right text-[#e4e4e7]">{row.product.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#131314] font-semibold text-[#f4f4f5]">
                      <td className="px-3 py-2">Totals</td>
                      <td className="px-3 py-2 text-indigo-400">{sumWeight}</td>
                      <td className="px-3 py-2 text-right text-emerald-400">{sumValueWeight.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="p-2.5 bg-[#161618] rounded-lg font-mono text-[10px] text-[#71717a] space-y-1">
                 <div>Weighted Mean = Σ(x · w) / Σw</div>
                 <div className="text-[#a1a1aa]">Mean = {sumValueWeight.toFixed(2)} / {sumWeight}</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#52525b] italic">Enter at least one valid numeric pair to render weighted assessment.</p>
          )}
        </div>

        {isValid && (
          <div className="space-y-3 mt-4">
            <div className="p-4 bg-zinc-900/40 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">Weighted Average</div>
                <div className="text-[11px] text-[#52525b] italic">Elements evaluated = {validatedRows.length}</div>
              </div>
              <div className="text-3xl font-bold font-mono text-[#38bdf8]">{mean.toFixed(4)}</div>
            </div>

            <button
              onClick={() => {
                onAddHistory?.({
                  type: 'weighted',
                  title: `Weighted Mean (${validatedRows.length} items)`,
                  parameters: { entries },
                  result: `Weighted mean: ${mean.toFixed(4)}`
                });
              }}
              className="w-full py-2 bg-[#161617] hover:bg-zinc-800 text-[11px] font-medium text-[#e4e4e7] rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#222225] shadow-none select-none"
            >
              Save to Tools History
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderLikertLeft = () => {
    return (
      <div className="space-y-4">
        <label className="text-[10px] text-[#71717a] font-bold uppercase block tracking-wider mb-2">Likert scale point parameters & frequencies</label>
        
        {/* Table/List Headings */}
        <div className="grid grid-cols-12 gap-2 px-1 text-[9px] text-[#52525b] font-bold uppercase tracking-wider select-none">
          <div className="col-span-6">Label / Choice</div>
          <div className="col-span-2 text-center">Pts</div>
          <div className="col-span-3 text-center">Count</div>
          <div className="col-span-1"></div>
        </div>

        <div className="space-y-2">
          {likertChoices.map((choice, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              {/* Text Label Option */}
              <div className="col-span-6">
                <input 
                  type="text" 
                  value={choice.label}
                  onChange={e => {
                    const newChoices = [...likertChoices];
                    newChoices[idx].label = e.target.value;
                    setLikertChoices(newChoices);
                  }}
                  className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
                  placeholder="e.g. Agree"
                />
              </div>

              {/* Weight Value */}
              <div className="col-span-2">
                <input 
                  type="number" 
                  value={choice.weight}
                  onChange={e => {
                    const newChoices = [...likertChoices];
                    newChoices[idx].weight = parseInt(e.target.value, 10) || 0;
                    setLikertChoices(newChoices);
                  }}
                  className="w-full text-center bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-2 py-2 text-[12px] text-[#f4f4f5] font-mono outline-none transition-colors"
                  placeholder="Pts"
                />
              </div>

              {/* Frequency Count */}
              <div className="col-span-3">
                <input 
                  type="number" 
                  min="0"
                  value={choice.count}
                  onChange={e => {
                    const newChoices = [...likertChoices];
                    newChoices[idx].count = e.target.value;
                    setLikertChoices(newChoices);
                  }}
                  className="w-full text-center bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-2 py-2 text-[12px] text-[#f4f4f5] font-mono outline-none transition-colors"
                  placeholder="Count"
                />
              </div>

              {/* Delete row button */}
              <div className="col-span-1 flex justify-center">
                <button
                  onClick={() => removeLikertChoice(idx)}
                  disabled={likertChoices.length <= 1}
                  className="p-1.5 text-zinc-650 hover:text-red-400 disabled:opacity-30 rounded transition-colors cursor-pointer"
                  title="Remove this response row"
                >
                  <Icon icon="ph:trash" className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addLikertChoice}
          className="w-full py-2 flex justify-center items-center gap-1.5 text-[11px] text-[#a1a1aa] hover:text-[#f4f4f5] border border-[#222225] bg-[#161617] hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer select-none"
        >
          <Icon icon="ph:plus" className="w-3.5 h-3.5" /> Add Points Scale Row
        </button>
      </div>
    );
  };

  const renderLikertRight = () => {
    let sumWeight = 0;
    let sumValueWeight = 0;
    let isValid = false;

    const itemCounts = likertChoices.map(c => parseInt(c.count, 10));

    likertChoices.forEach((c, idx) => {
      const countVal = itemCounts[idx];
      if (!isNaN(countVal) && countVal >= 0) {
        sumWeight += countVal;
        sumValueWeight += countVal * c.weight;
        isValid = true;
      }
    });

    const mean = (isValid && sumWeight > 0) ? sumValueWeight / sumWeight : 0;

    // Progressive verbal interpretation spanning across minimum and maximum weights
    const weights = likertChoices.map(c => c.weight);
    const wMax = weights.length > 0 ? Math.max(...weights) : 5;
    const wMin = weights.length > 0 ? Math.min(...weights) : 1;
    const span = wMax - wMin;

    let interpretation = "No responses entered";
    let colorClass = "text-[#71717a]";

    if (isValid && sumWeight > 0) {
      const percentage = span > 0 ? (mean - wMin) / span : 1;
      if (percentage >= 0.8) {
        interpretation = "Very High / Strongly Favorable";
        colorClass = "text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/50";
      } else if (percentage >= 0.6) {
        interpretation = "High / Favorable";
        colorClass = "text-blue-400 bg-blue-950/20 px-2 py-0.5 rounded border border-blue-900/50";
      } else if (percentage >= 0.4) {
        interpretation = "Moderate / Neutral";
        colorClass = "text-zinc-300 bg-zinc-900/30 px-2 py-0.5 rounded border border-zinc-700/50";
      } else if (percentage >= 0.2) {
        interpretation = "Low / Unfavorable";
        colorClass = "text-orange-400 bg-orange-950/20 px-2 py-0.5 rounded border border-orange-900/50";
      } else {
        interpretation = "Very Low / Strongly Unfavorable";
        colorClass = "text-red-400 bg-red-950/20 px-2 py-0.5 rounded border border-red-900/50";
      }
    }

    const getBarColorClass = (idx: number) => {
      const colors = [
        'bg-[#10b981]', // Emerald
        'bg-[#3b82f6]', // Blue
        'bg-[#6366f1]', // Indigo
        'bg-[#f59e0b]', // Amber
        'bg-[#e11d48]', // Rose
        'bg-[#8b5cf6]', // Violet
        'bg-[#06b6d4]', // Cyan
      ];
      return colors[idx % colors.length];
    };

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <h3 className="text-xs font-semibold text-[#e4e4e7] pt-8 pb-3 border-b border-[#222225] uppercase tracking-wide px-8 shrink-0">
          Survey Allocation Chart
        </h3>
        <div className="px-8 pt-6 pb-8 overflow-y-auto scrollbar-thin scrollbar-thumb-[#27272a] hover:scrollbar-thumb-[#3f3f46] flex-1">
          {isValid && sumWeight > 0 ? (
            <div className="space-y-3">
              <div className="space-y-2">
                {likertChoices.map((c, idx) => {
                  const count = itemCounts[idx] || 0;
                  const ratio = sumWeight > 0 ? count / sumWeight : 0;
                  const pct = ratio * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[10px] text-[#52525b] font-mono">
                         <span>{c.label} (Weight: {c.weight}, Vol: {count})</span>
                         <span>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full bg-[#161618] rounded overflow-hidden">
                        <div className={`h-full ${getBarColorClass(idx)} transition-all duration-300`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#52525b] italic">Provide count quantities to chart distributions.</p>
          )}
        </div>

        {isValid && sumWeight > 0 && (
          <div className="space-y-3 mt-4">
            <div className="space-y-3 pt-4">
              <div className="p-2 bg-[#161618] rounded-xl flex items-center justify-between text-[11px] text-[#71717a]">
                 <span>Weighted Summation</span>
                 <span className="font-mono text-[#e4e4e7]">{sumValueWeight} / {sumWeight} respondents</span>
              </div>
              <div className="p-4 bg-zinc-900/40 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">Likert Grand Index</span>
                  <span className="text-2xl font-bold font-mono text-white">{mean.toFixed(3)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#1d1d20]">
                  <span className="text-[10px] text-[#52525b] uppercase font-bold">Interpretation</span>
                  <span className={`text-[11px] font-medium font-jakarta ${colorClass}`}>{interpretation}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                onAddHistory?.({
                  type: 'likert',
                  title: `Likert Scale (${sumWeight} respondents)`,
                  parameters: { likertChoices },
                  result: `Index: ${mean.toFixed(3)}`
                });
              }}
              className="w-full py-2 bg-[#161617] hover:bg-zinc-800 text-[11px] font-medium text-[#e4e4e7] rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#222225] shadow-none select-none"
            >
              Save to Tools History
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderAiLeft = () => {
    return (
      <div className="space-y-4">
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`p-6 border border-dashed rounded-xl flex flex-col items-center justify-center bg-[#111111] transition-all duration-200 text-center relative ${dragActive ? 'border-zinc-550 bg-[#161616]' : 'border-[#222224] hover:border-zinc-850'}`}
        >
           <input 
             type="file"
             ref={fileInputRef}
             className="hidden"
             accept=".pdf,.csv,.txt,.json,.doc,.docx"
             onChange={e => {
               if (e.target.files && e.target.files[0]) {
                 handleFileUpload(e.target.files[0]);
               }
             }}
           />
           <Icon icon="ph:upload-simple" className={`w-8 h-8 mb-3 text-zinc-500 ${isAnalyzing ? 'animate-bounce' : ''}`} />
           <button
             onClick={() => fileInputRef.current?.click()}
             disabled={isAnalyzing}
             className="py-2 px-5 bg-[#27272a] hover:bg-[#333336] text-[#f4f4f5] text-[12px] font-medium rounded-lg transition-colors flex items-center gap-2 mb-2 disabled:opacity-50 cursor-pointer"
           >
             {isAnalyzing ? "Processing..." : "Select File"}
           </button>
           <p className="text-[10px] text-[#71717a]">or drag and drop your file here</p>
           <p className="text-[9px] text-zinc-650 mt-2">Supports PDF, CSV, TXT, JSON, DOCX up to 15MB</p>
        </div>

        {fileName && (
          <div className="flex items-center gap-2.5 p-3.5 bg-[#121213] rounded-xl">
            <div className="p-2 bg-zinc-900 rounded-lg">
              <Icon icon={fileName.toLowerCase().endsWith('.pdf') ? 'ph:file-pdf' : 'ph:file-text'} className="text-zinc-400 w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
               <div className="text-xs text-zinc-200 truncate font-semibold font-jakarta">{fileName}</div>
               <div className="text-[10px] text-[#52525b] font-mono">
                 {isAnalyzing ? 'Extracting text and executing AI parsing...' : 'Analysis completed successfully'}
               </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAiRight = () => {
    return (
      <div className="flex flex-col h-full">
        <h3 className="text-xs font-semibold text-[#e4e4e7] pt-8 pb-3 border-b border-[#222225] uppercase tracking-wide px-8 shrink-0">
          Deep Analytical Insights
        </h3>
        <div className="flex-1 min-h-0 overflow-y-auto px-8 pt-6 pb-8 select-text scrollbar-thin scrollbar-thumb-zinc-850">
          {isAnalyzing ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 pt-12">
                <Icon icon="ph:spinner-gap" className="animate-spin text-zinc-400 w-8 h-8" />
                <p className="text-xs text-[#a1a1aa]">Cosmi is evaluating the context claim patterns...</p>
                <span className="text-[9.5px] font-mono text-[#52525b]">This may take 10-15 seconds depending on file length.</span>
              </div>
            ) : analysisResult ? (
              <div className="markdown-body prose prose-invert max-w-none text-[12px] text-[#d4d4d8] font-sans">
                 <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as any}>{analysisResult}</ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-600">
                <Icon icon="ph:file-magnifying-glass" className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-xs italic">Upload a structured dataset or notes file on the left to activate statistical breakdown and table formulation output.</p>
              </div>
            )}
          </div>
        </div>
    );
  };

  const renderCitationLeft = () => {
    const setField = (field: string, val: string) => {
      setCitationFields(prev => ({ ...prev, [field]: val }));
    };

    return (
      <div className="space-y-4">
        {/* Source Type Toggle */}
        <div>
          <label className="text-[10px] text-[#71717a] font-bold uppercase mb-2 block tracking-wider">Source Type</label>
          <div className="grid grid-cols-3 gap-1 bg-[#161616] p-0.5 rounded-xl">
            {(['book', 'journal', 'website'] as const).map(type => (
              <button
                key={type}
                onClick={() => setCitationSourceType(type)}
                className={`py-1.5 text-[10px] font-bold capitalize rounded-lg transition-colors cursor-pointer select-none ${citationSourceType === type ? 'bg-[#27272a] text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Input fields based on select type */}
        <div className="space-y-3.5">
          <div>
            <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Authors (Semicolon separated)</label>
            <input 
              type="text"
              value={citationFields.authors}
              onChange={e => setField('authors', e.target.value)}
              className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
              placeholder="e.g. Smith, John; Doe, Jane"
            />
            <p className="text-[9px] text-[#52525b] mt-1">Format: LastName, FirstName; LastName, FirstName</p>
          </div>

          <div>
            <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">
              {citationSourceType === 'book' ? 'Book Title' : citationSourceType === 'journal' ? 'Article Title' : 'Page / Article Title'}
            </label>
            <input 
              type="text"
              value={citationFields.title}
              onChange={e => setField('title', e.target.value)}
              className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
              placeholder="e.g. Title of the work"
            />
          </div>

          {citationSourceType === 'book' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Publisher</label>
                  <input 
                    type="text"
                    value={citationFields.publisher}
                    onChange={e => setField('publisher', e.target.value)}
                    className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
                    placeholder="e.g. Oxford Press"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Pub Year</label>
                  <input 
                    type="text"
                    value={citationFields.year}
                    onChange={e => setField('year', e.target.value)}
                    className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
                    placeholder="e.g. 2021"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Edition (Optional)</label>
                <input 
                  type="text"
                  value={citationFields.edition}
                  onChange={e => setField('edition', e.target.value)}
                  className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
                  placeholder="e.g. 3rd"
                />
              </div>
            </>
          )}

          {citationSourceType === 'journal' && (
            <>
              <div>
                <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Journal Name</label>
                <input 
                  type="text"
                  value={citationFields.journal}
                  onChange={e => setField('journal', e.target.value)}
                  className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
                  placeholder="e.g. Nature"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Vol</label>
                  <input 
                    type="text"
                    value={citationFields.volume}
                    onChange={e => setField('volume', e.target.value)}
                    className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-2 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors font-mono"
                    placeholder="24"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Issue</label>
                  <input 
                    type="text"
                    value={citationFields.issue}
                    onChange={e => setField('issue', e.target.value)}
                    className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-2 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors font-mono"
                    placeholder="2"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Pages</label>
                  <input 
                    type="text"
                    value={citationFields.pages}
                    onChange={e => setField('pages', e.target.value)}
                    className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-2 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors font-mono"
                    placeholder="115-130"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Pub Year</label>
                  <input 
                    type="text"
                    value={citationFields.year}
                    onChange={e => setField('year', e.target.value)}
                    className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
                    placeholder="2021"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">DOI (Optional)</label>
                  <input 
                    type="text"
                    value={citationFields.doi}
                    onChange={e => setField('doi', e.target.value)}
                    className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors font-mono"
                    placeholder="e.g. 10.1002/art.1"
                  />
                </div>
              </div>
            </>
          )}

          {citationSourceType === 'website' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Site Name</label>
                  <input 
                    type="text"
                    value={citationFields.siteName}
                    onChange={e => setField('siteName', e.target.value)}
                    className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
                    placeholder="e.g. Wikipedia"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Publisher</label>
                  <input 
                    type="text"
                    value={citationFields.publisher}
                    onChange={e => setField('publisher', e.target.value)}
                    className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
                    placeholder="e.g. Wikimedia Foundation"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">URL</label>
                <input 
                  type="text"
                  value={citationFields.url}
                  onChange={e => setField('url', e.target.value)}
                  className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors font-mono text-[11px]"
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Pub Date</label>
                  <input 
                    type="date"
                    value={citationFields.pubDate}
                    onChange={e => setField('pubDate', e.target.value)}
                    className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Access Date</label>
                  <input 
                    type="date"
                    value={citationFields.accessDate}
                    onChange={e => setField('accessDate', e.target.value)}
                    className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors font-mono"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderCitationRight = () => {
    const styles: Array<{ id: 'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee'; label: string }> = [
      { id: 'apa', label: 'APA (7th Edition)' },
      { id: 'mla', label: 'MLA (9th Edition)' },
      { id: 'chicago', label: 'Chicago (Author-Date)' },
      { id: 'harvard', label: 'Harvard Style' },
      { id: 'ieee', label: 'IEEE Style' }
    ];

    const generateFormattedMarkdown = (styleId: 'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee') => {
      return generateCitationText(citationSourceType, styleId, citationFields);
    };

    const sampleCiteAPA = generateFormattedMarkdown('apa');

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#222225] px-8 pt-8 pb-3 shrink-0">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wide">
            Formatted References Stack
          </h3>
          <span className="text-[10px] text-[#71717a] font-mono capitalize px-2 py-0.5 bg-[#161618] border border-[#222225] rounded-md font-bold">
            {citationSourceType} Format
          </span>
        </div>

        <div className="px-8 pt-6 pb-8 overflow-y-auto scrollbar-thin scrollbar-thumb-[#27272a] hover:scrollbar-thumb-[#3f3f46] flex-1">
          <div className="flex flex-col divide-y divide-[#1e1e20]">
            {styles.map(style => {
              const res = generateFormattedMarkdown(style.id);
              return (
                <div key={style.id} className="py-4 space-y-3 hover:bg-white/[0.02] transition-colors -mx-8 px-8">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#8e8e93] font-bold uppercase tracking-wide font-mono">{style.label}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => triggerCopy(res.reference.replace(/\*(.*?)\*/g, '$1'), `${style.id}-ref`)}
                        className="py-1 px-2 hover:bg-[#27272a] border border-transparent hover:border-[#3f3f46] text-[10px] text-zinc-300 rounded transition font-medium select-none cursor-pointer"
                      >
                        {copiedStyleId === `${style.id}-ref` ? 'Copied Reference!' : 'Copy Bibliography'}
                      </button>
                      <button
                        onClick={() => triggerCopy(res.inText, `${style.id}-text`)}
                        className="py-1 px-2 hover:bg-[#27272a] border border-transparent hover:border-[#3f3f46] text-[10px] text-zinc-300 rounded transition font-medium select-none cursor-pointer"
                      >
                        {copiedStyleId === `${style.id}-text` ? 'Copied In-Text!' : 'Copy In-Text'}
                      </button>
                    </div>
                  </div>

                  {/* Previews */}
                  <div className="space-y-2">
                    <div className="text-[11.5px] text-zinc-200 leading-relaxed font-sans select-all">
                      {res.reference.replace(/\*(.*?)\*/g, '$1')}
                    </div>
                    <div className="flex gap-2 items-center text-[10px]">
                      <span className="text-[#52525b] uppercase font-bold tracking-wider font-mono">In-Text Citation:</span>
                      <span className="text-zinc-400 font-mono select-all">{res.inText}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => {
            onAddHistory?.({
              type: 'citation',
              title: `Citation: ${citationFields.title || 'Untitled'}`,
              parameters: { sourceType: citationSourceType, fields: citationFields },
              result: sampleCiteAPA.reference
            });
          }}
          className="w-full py-2.5 bg-[#161617] hover:bg-zinc-800 text-[11px] font-bold text-[#e4e4e7] rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#222225] shadow-none select-none"
        >
          Save to Tools History
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex flex-col md:flex-row overflow-hidden items-stretch h-full md:divide-x divide-[#222225] min-h-0">
         {/* Left Side: Parameters / Files */}
         <div className="w-full md:w-4/12 flex flex-col justify-start overflow-hidden mb-8 md:mb-0 border-b md:border-b-0 border-[#222225] h-full">
            <h3 className="text-xs font-semibold text-[#e4e4e7] pt-8 pb-3 border-b border-[#222225] uppercase tracking-wide px-8 shrink-0">
              Tool Parameters
            </h3>
            <div className="px-8 pt-6 pb-6 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-[#27272a] hover:scrollbar-thumb-[#3f3f46] flex-1">
              {activeTab === 'slovin' && renderSlovinLeft()}
              {activeTab === 'percentage' && renderPercentageLeft()}
              {activeTab === 'weighted' && renderWeightedMeanLeft()}
              {activeTab === 'likert' && renderLikertLeft()}
              {activeTab === 'ai' && renderAiLeft()}
              {activeTab === 'citation' && renderCitationLeft()}
            </div>
         </div>

         {/* Right Side: Outputs / Graphs / AI Summaries */}
         <div className="w-full md:w-8/12 flex flex-col items-stretch h-full overflow-hidden"> {/* Wrap right side here without inner bg */}
            {activeTab === 'slovin' && renderSlovinRight()}
            {activeTab === 'percentage' && renderPercentageRight()}
            {activeTab === 'weighted' && renderWeightedMeanRight()}
            {activeTab === 'likert' && renderLikertRight()}
            {activeTab === 'ai' && renderAiRight()}
            {activeTab === 'citation' && renderCitationRight()}
         </div>
      </div>
    </div>
  );
}
