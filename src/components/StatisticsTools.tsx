import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './SolarIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'motion/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Custom, highly polished minimalist number input
function CustomNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  className = "",
  suffix,
  disabled = false,
  align = "left",
}: {
  value: string | number;
  onChange: (val: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  suffix?: string;
  disabled?: boolean;
  align?: "left" | "center" | "right";
}) {
  return (
    <div className="relative flex items-center w-full group">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={`w-full bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-[12px] text-[#f4f4f5] outline-none transition-colors ${
          align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"
        } ${suffix ? "pr-10" : "pr-3.5"} ${className}`}
      />
      
      {suffix && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center select-none pointer-events-none">
          <span className="text-[10px] text-[#52525b] font-mono">{suffix}</span>
        </div>
      )}
    </div>
  );
}

// Function to parse a raw string and split/render subsegments of LaTeX equations
function processStringForMath(str: string) {
  if (!str) return str;

  // Broad and extremely resilient regex that handles:
  // 1. $$ ... $$ (display)
  // 2. \\\[ ... \\\] (display)
  // 3. \\\( ... \\\) (inline)
  // 4. \$ ... \$ (inline)
  // 5. \[ ... \] or [ ... ] (brackets that enclose structured math symbols)
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\$\s](?:[^\$]*?[^\$\s])?\$|\\\[[\s\S]+?\\\]|\[\s*(?:\\text|\\frac|\\times|\\sum|\\alpha|\\beta|\\mu|\\sigma|\\partial|\\int|\\Delta|\\lambda|\\theta|\\pm|\\neq|\\cdot)[\s\S]+?\])/g;

  const parts = str.split(regex);
  if (parts.length === 1) return str;

  return parts.map((part, i) => {
    if (i % 2 === 0) {
      return part;
    }

    let displayMode = false;
    let mathText = part;

    if (mathText.startsWith('$$') && mathText.endsWith('$$')) {
      displayMode = true;
      mathText = mathText.slice(2, -2);
    } else if (mathText.startsWith('\\[') && mathText.endsWith('\\]')) {
      displayMode = true;
      mathText = mathText.slice(2, -2);
    } else if (mathText.startsWith('\\(') && mathText.endsWith('\\)')) {
      displayMode = false;
      mathText = mathText.slice(2, -2);
    } else if (mathText.startsWith('$') && mathText.endsWith('$')) {
      displayMode = false;
      mathText = mathText.slice(1, -1);
    } else if (mathText.startsWith('[') && mathText.endsWith(']')) {
      displayMode = true;
      mathText = mathText.slice(1, -1);
    }

    try {
      const html = katex.renderToString(mathText, {
        displayMode,
        throwOnError: false,
      });

      if (displayMode) {
        return (
          <span 
            key={i} 
            className="block my-4 overflow-x-auto text-center" 
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else {
        return (
          <span 
            key={i} 
            className="inline mx-0.5" 
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }
    } catch (e) {
      console.error("KaTeX parse error in Data Analysis Analyst:", e);
      return <span key={i} className="font-mono text-[10px] text-red-500">{part}</span>;
    }
  });
}

// Function to recursively process React children for embedded LaTeX patterns
function processMathInChildren(children: any): any {
  if (!children) return children;
  if (typeof children === 'string') {
    return processStringForMath(children);
  }
  if (Array.isArray(children)) {
    return children.map((item, index) => {
      if (typeof item === 'string') {
        const processed = processStringForMath(item);
        if (Array.isArray(processed)) {
          return <React.Fragment key={index}>{processed}</React.Fragment>;
        }
        return processed;
      }
      return item;
    });
  }
  return children;
}

function MathLaTex({ math, displayMode = false }: { math: string; displayMode?: boolean }) {
  try {
    const html = katex.renderToString(math, {
      displayMode,
      throwOnError: false,
    });
    return (
      <span 
        className={displayMode ? "block my-4 text-center overflow-visible" : "inline mx-0.5"}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch (e) {
    return <span className="font-mono text-[10px] text-red-500">{math}</span>;
  }
}

const TOOLS_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    toolParam: "Tool Parameters",
    calcBreakdown: "Calculation Breakdown",
    saveHistory: "Save to Tools History",
    interpretation: "Interpretation Guide",
    populat: "Population Size (N)",
    margin: "Margin of Error (e)",
    slovinDesc: "Used when estimating sample sizes from a known finite population size. It provides a simple approximation of the target sample count."
  },
  es: {
    toolParam: "Parámetros de la Herramienta",
    calcBreakdown: "Desglose del Cálculo",
    saveHistory: "Guardar en Historial",
    interpretation: "Guía de Interpretación",
    populat: "Tamaño de Población (N)",
    margin: "Margen de Error (e)",
    slovinDesc: "Se utiliza al calcular tamaños de muestra de una población conocida finita. Proporciona una aproximación sencilla."
  },
  fr: {
    toolParam: "Paramètres de Outil",
    calcBreakdown: "Répartition du calcul",
    saveHistory: "Enregistrer l'historique",
    interpretation: "Guide d'interprétation",
    populat: "Taille de la population (N)",
    margin: "Marge d'erreur (e)",
    slovinDesc: "Utilisé pour estimer la taille des échantillons..."
  },
  de: {
    toolParam: "Werkzeugparameter",
    calcBreakdown: "Berechnungsaufschlüsselung",
    saveHistory: "Im Verlauf speichern",
    interpretation: "Interpretationsleitfaden",
    populat: "Populationsgröße (N)",
    margin: "Fehlertoleranz (e)",
    slovinDesc: "Wird verwendet, um Probengrößen zu schätzen..."
  },
  it: {
    toolParam: "Parametri Strumento",
    calcBreakdown: "Ripartizione Calcolo",
    saveHistory: "Salva in Cronologia",
    interpretation: "Guida Interpretazione",
    populat: "Dimensione Popolazione (N)",
    margin: "Margine di Errore (e)",
    slovinDesc: "Utilizzato per stimare dimensioni campione..."
  },
  pt: {
    toolParam: "Parâmetros da Ferramenta",
    calcBreakdown: "Detalhamento do Cálculo",
    saveHistory: "Salvar no Histórico",
    interpretation: "Guia de Interpretação",
    populat: "Tamanho da População (N)",
    margin: "Margem de Erro (e)",
    slovinDesc: "Usado para estimar tamanhos de amostra..."
  },
  ar: {
    toolParam: "معلمات الأداة",
    calcBreakdown: "تفصيل الحساب",
    saveHistory: "حفظ في السجل",
    interpretation: "دليل التفسير",
    populat: "حجم السكان (N)",
    margin: "هامش الخطأ (e)",
    slovinDesc: "تُستخدم عند تقدير أحجام العينة..."
  },
  zh: {
    toolParam: "工具参数",
    calcBreakdown: "计算分类",
    saveHistory: "保存到历史记录",
    interpretation: "解释指南",
    populat: "人口规模 (N)",
    margin: "误差范围 (e)",
    slovinDesc: "用于从已知有限总体估计样本量。它提供了目标样本数的简单近似值。"
  },
  ja: {
    toolParam: "ツール パラメータ",
    calcBreakdown: "計算の内訳",
    saveHistory: "履歴に保存",
    interpretation: "解釈ガイド",
    populat: "母集団のサイズ (N)",
    margin: "許容誤差 (e)",
    slovinDesc: "既知の有限母集団からサンプルサイズを推定する場合に使用します。目標のサンプル数の簡単な近似値を提供します。"
  },
  hi: {
    toolParam: "उपकरण पैरामीटर",
    calcBreakdown: "गणना विवरण",
    saveHistory: "इतिहास में सहेजें",
    interpretation: "व्याख्या मार्गदर्शिका",
    populat: "जनसंख्या आकार (N)",
    margin: "त्रुटि का मार्जिन (e)",
    slovinDesc: "ज्ञात सीमित जनसंख्या आकार से नमूना आकारों का अनुमान लगाते समय उपयोग किया जाता है।"
  }
};

export function StatisticsTools({
  onAddHistory,
  selectedHistoryItem,
  onClearSelectedHistoryItem,
  activeTab: controlledActiveTab,
  onChangeActiveTab,
  appLanguage
}: {
  onAddHistory?: (item: any) => void;
  selectedHistoryItem?: any;
  onClearSelectedHistoryItem?: () => void;
  activeTab?: 'slovin' | 'percentage' | 'weighted' | 'likert' | 'ai' | 'citation';
  onChangeActiveTab?: (tab: 'slovin' | 'percentage' | 'weighted' | 'likert' | 'ai' | 'citation') => void;
  appLanguage?: string;
} = {}) {
  const currentLang = appLanguage || "en";
  const st = (key: string, defaultText: string) => TOOLS_TRANSLATIONS[currentLang]?.[key] || TOOLS_TRANSLATIONS["en"][key] || defaultText;

  const [internalActiveTab, setInternalActiveTab] = useState<'slovin' | 'percentage' | 'weighted' | 'likert' | 'ai' | 'citation'>('slovin');

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = onChangeActiveTab !== undefined ? onChangeActiveTab : setInternalActiveTab;

  // Slovin State
  const [population, setPopulation] = useState('1000');
  const [marginOfError, setMarginOfError] = useState('0.05');
  const [showSlovinInterpretation, setShowSlovinInterpretation] = useState(false);

  // Percentage State
  const [part, setPart] = useState('75');
  const [total, setTotal] = useState('250');
  const [showPercentageInterpretation, setShowPercentageInterpretation] = useState(false);

  // Weighted Mean State
  const [entries, setEntries] = useState([
    { value: '95', weight: '3' },
    { value: '88', weight: '4' },
    { value: '92', weight: '2' }
  ]);
  const [showWeightedMeanInterpretation, setShowWeightedMeanInterpretation] = useState(false);
  
  // Likert State
  const [likertChoices, setLikertChoices] = useState([
    { label: 'Strongly Agree', weight: 5, count: '42' },
    { label: 'Agree', weight: 4, count: '35' },
    { label: 'Neutral', weight: 3, count: '18' },
    { label: 'Disagree', weight: 2, count: '10' },
    { label: 'Strongly Disagree', weight: 1, count: '5' }
  ]);
  const [showLikertInterpretation, setShowLikertInterpretation] = useState(false);

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

  // Expanded Citation Management States
  const [citationInputMode, setCitationInputMode] = useState<'manual' | 'doi' | 'pdf'>('manual');
  const [doiInput, setDoiInput] = useState('');
  const [isResolvingDoi, setIsResolvingDoi] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfTasks, setPdfTasks] = useState<Array<{
    id: string;
    name: string;
    status: 'pending' | 'extracting' | 'parsing' | 'success' | 'error';
    errorMsg?: string;
  }>>([]);
  const [citationStatus, setCitationStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Saved/Organized Citations State
  const [savedCitations, setSavedCitations] = useState<Array<{
    id: string;
    sourceType: 'book' | 'journal' | 'website';
    fields: typeof citationFields;
    createdAt: number;
  }>>(() => {
    try {
      const stored = localStorage.getItem('organizedCitations');
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  });

  // Save to localStorage when updated
  const saveToCitationsLocalStorage = (list: any) => {
    try {
      localStorage.setItem('organizedCitations', JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save citations list to localStorage:', e);
    }
  };

  // Right Panel display switch between Active Formatter Preview and Organized Citation Library
  const [citationRightTab, setCitationRightTab] = useState<'preview' | 'library'>('library');
  
  // Library search and filter
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [libraryFormatFilter, setLibraryFormatFilter] = useState<'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee'>('apa');
  const [librarySearchType, setLibrarySearchType] = useState<'all' | 'book' | 'journal' | 'website'>('all');
  const [citationIdToDelete, setCitationIdToDelete] = useState<string | null>(null);
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
  const formatDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (formatDropdownRef.current && !formatDropdownRef.current.contains(event.target as Node)) {
        setIsFormatDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleResolveDoi = async () => {
    if (!doiInput.trim()) {
      setCitationStatus({ type: 'error', message: 'Please enter a valid DOI.' });
      return;
    }
    setIsResolvingDoi(true);
    setCitationStatus({ type: 'info', message: 'Resolving DOI metadata from OpenAlex indexes...' });
    try {
      const rawRes = await fetch("/api/citation/resolve-doi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doi: doiInput })
      });
      const data = await rawRes.json();
      if (data.success && data.metadata) {
        const meta = data.metadata;
        setCitationSourceType(meta.sourceType || 'journal');
        setCitationFields({
          authors: meta.authors || '',
          title: meta.title || '',
          publisher: meta.publisher || '',
          year: meta.year || '',
          edition: meta.edition || '',
          journal: meta.journal || '',
          volume: meta.volume || '',
          issue: meta.issue || '',
          pages: meta.pages || '',
          doi: meta.doi || doiInput,
          url: meta.url || '',
          siteName: meta.siteName || '',
          pubDate: meta.pubDate || '',
          accessDate: meta.accessDate || new Date().toISOString().split('T')[0]
        });
        setCitationStatus({ type: 'success', message: 'DOI metadata successfully parsed! Review fields below.' });
        setDoiInput('');
        setCitationInputMode('manual');
      } else {
        throw new Error(data.error || 'Failed to resolve DOI');
      }
    } catch (err: any) {
      console.error("DOI resolution error:", err);
      setCitationStatus({ type: 'error', message: err.message || 'Unable to resolve DOI automatically. Please enter manually.' });
    } finally {
      setIsResolvingDoi(false);
    }
  };

  const parsePdfCitation = async (file: File) => {
    await parseMultiplePdfCitations([file]);
  };

  const parseMultiplePdfCitations = async (files: File[]) => {
    setIsParsingPdf(true);
    setCitationStatus({ type: 'info', message: `Initializing batch parsing of ${files.length} PDF(s)...` });

    // Initialize tasks list
    const batchId = Date.now();
    const initialTasks = files.map((f, i) => ({
      id: `${f.name}-${batchId}-${i}-${Math.random().toString(36).substr(2, 5)}`,
      name: f.name,
      status: 'pending' as const,
    }));
    
    setPdfTasks(prev => [...initialTasks, ...prev]);

    let successCount = 0;
    let failCount = 0;

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      const taskId = initialTasks[idx].id;

      const updateTaskStatus = (status: 'pending' | 'extracting' | 'parsing' | 'success' | 'error', errorMsg?: string) => {
        setPdfTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, errorMsg } : t));
      };

      try {
        updateTaskStatus('extracting');
        setPdfFileName(file.name);
        
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({
          data: arrayBuffer,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
          cMapPacked: true,
        });
        const pdfDoc = await loadingTask.promise;
        let extractedText = "";
        
        const numPages = Math.min(pdfDoc.numPages, 2);
        for (let i = 1; i <= numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str || "").join(" ");
          extractedText += pageText + "\n";
        }

        if (!extractedText.trim()) {
          throw new Error("Could not extract legible characters from this PDF.");
        }

        updateTaskStatus('parsing');
        
        const response = await fetch("/api/citation/parse-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: extractedText })
        });

        const data = await response.json();
        if (data.success && data.metadata) {
          const meta = data.metadata;
          const extractedFields = {
            authors: meta.authors || "",
            title: meta.title || "",
            publisher: meta.publisher || "",
            year: meta.year || "",
            edition: meta.edition || "",
            journal: meta.journal || "",
            volume: meta.volume || "",
            issue: meta.issue || "",
            pages: meta.pages || "",
            doi: meta.doi || "",
            url: meta.url || "",
            siteName: meta.siteName || "",
            pubDate: meta.pubDate || "",
            accessDate: meta.accessDate || new Date().toISOString().split('T')[0]
          };

          // Populate the active editor with the last parsed file's contents
          setCitationSourceType(meta.sourceType || "journal");
          setCitationFields(extractedFields);

          // Auto-save this citation directly into the Organized Citation Library
          const newCitation = {
            id: `citation-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            sourceType: (meta.sourceType || "journal") as 'book' | 'journal' | 'website',
            fields: extractedFields,
            createdAt: Date.now()
          };
          
          setSavedCitations(prev => {
            const updated = [newCitation, ...prev];
            saveToCitationsLocalStorage(updated);
            return updated;
          });

          updateTaskStatus('success');
          successCount++;
        } else {
          throw new Error(data.error || "Failed parsing metadata from Mistral response.");
        }
      } catch (err: any) {
        console.error("PDF Parsing error:", err);
        updateTaskStatus('error', err.message || 'Verification token failed.');
        failCount++;
      }
    }

    setIsParsingPdf(false);
    if (successCount > 0 && failCount === 0) {
      setCitationStatus({ type: 'success', message: `All ${successCount} PDF(s) successfully analyzed and imported to library!` });
    } else if (successCount > 0) {
      setCitationStatus({ type: 'info', message: `Imported ${successCount} paper(s) to library. ${failCount} failed.` });
    } else {
      setCitationStatus({ type: 'error', message: `Could not parse the selected PDF file(s).` });
    }
  };

  const handlePdfUploadForCitation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await parseMultiplePdfCitations(Array.from(files));
  };

  const handlePdfDropForCitation = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files: File[] = [];
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind === 'file') {
          const file = e.dataTransfer.items[i].getAsFile();
          if (file && file.name.toLowerCase().endsWith('.pdf')) {
            files.push(file);
          }
        }
      }
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file && file.name.toLowerCase().endsWith('.pdf')) {
          files.push(file);
        }
      }
    }
    if (files.length === 0) return;
    await parseMultiplePdfCitations(files);
  };

  const addCitationToLibrary = () => {
    const newCitation = {
      id: `citation-${Date.now()}`,
      sourceType: citationSourceType,
      fields: { ...citationFields },
      createdAt: Date.now()
    };
    
    const updated = [newCitation, ...savedCitations];
    setSavedCitations(updated);
    saveToCitationsLocalStorage(updated);

    setCitationStatus({ type: 'success', message: 'Citation added to your organized library!' });
    setCitationRightTab('library');
  };

  const deleteCitationFromLibrary = (id: string) => {
    const updated = savedCitations.filter(c => c.id !== id);
    setSavedCitations(updated);
    saveToCitationsLocalStorage(updated);
    setCitationStatus({ type: 'info', message: 'Citation matching record removed.' });
  };

  const getFullFormattedBibliography = (style: 'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee') => {
    const list = savedCitations
      .filter(c => {
        if (librarySearchType === 'all') return true;
        return c.sourceType === librarySearchType;
      })
      .filter(c => {
        if (!librarySearchQuery.trim()) return true;
        const q = librarySearchQuery.toLowerCase();
        return (
          c.fields.title.toLowerCase().includes(q) ||
          c.fields.authors.toLowerCase().includes(q) ||
          (c.fields.journal && c.fields.journal.toLowerCase().includes(q)) ||
          (c.fields.publisher && c.fields.publisher.toLowerCase().includes(q))
        );
      });

    if (list.length === 0) return '';

    // Sort alphabetically by first author
    const sortedList = [...list].sort((a, b) => {
      const authA = a.fields.authors || 'zzzz';
      const authB = b.fields.authors || 'zzzz';
      return authA.localeCompare(authB);
    });

    return sortedList
      .map(c => generateCitationText(c.sourceType, style, c.fields).reference.replace(/\*(.*?)\*/g, '$1'))
      .join('\n\n');
  };

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
      let textContent = "";
      
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (['.csv', '.txt', '.json', '.md'].includes(fileExt)) {
         textContent = await file.text();
         // Basic truncation for huge datasets
         if (textContent.length > 50000) {
           textContent = textContent.substring(0, 50000) + "\n\n...[Data Truncated for AI Context Limits]";
         }
      } else if (fileExt === '.pdf') {
         const arrayBuffer = await file.arrayBuffer();
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
         // 1. Upload the file to memory/disk for .docx / specialized server parsing
         const formData = new FormData();
         formData.append("file", file);
         
         const uploadRes = await fetch("/api/upload", {
           method: "POST",
           body: formData,
         });

         const uploadText = await uploadRes.text();
         if (!uploadRes.ok) {
            if (uploadText.trim().startsWith("<!doctype") || uploadText.trim().startsWith("<html")) {
               throw new Error(`Upload failed (Status ${uploadRes.status}): Server returned an HTML error page. (It might be 413 Payload Too Large from Nginx).`);
            }
            throw new Error(`Upload failed (Status ${uploadRes.status}): ${uploadText.substring(0, 50)}`);
         }
         
         if (uploadText.trim().startsWith("<!doctype") || uploadText.trim().startsWith("<html")) {
           throw new Error(`File upload failed. Express skipped the '/api/upload' POST route and Vite returned 200 OK index.html.`);
         }
         
         const uploadData = JSON.parse(uploadText);
         const fileId = uploadData.fileId;

         // 2. Extract text from the uploaded file
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
        title: `Data Analysis (${file.name})`,
        parameters: { fileName: file.name, analysisResult: resultText },
        result: `Data analysis complete`
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
        {processMathInChildren(children)}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="px-4 py-2.5 text-[#d4d4d8] leading-relaxed border-r border-[#1e1e20] last:border-r-0 font-jakarta">
        {processMathInChildren(children)}
      </td>
    ),
    h1: ({ children }: any) => <h1 className="text-base font-bold text-[#f4f4f5] mt-6 mb-3 border-b border-[#27272a] pb-2 flex items-center gap-1.5">{processMathInChildren(children)}</h1>,
    h2: ({ children }: any) => <h2 className="text-sm font-semibold text-[#f4f4f5] mt-5 mb-2.5">{processMathInChildren(children)}</h2>,
    h3: ({ children }: any) => <h3 className="text-xs font-semibold text-[#e4e4e7] mt-4 mb-2">{processMathInChildren(children)}</h3>,
    p: ({ children }: any) => <p className="leading-relaxed mb-3.5 text-[#d4d4d8] text-[12px]">{processMathInChildren(children)}</p>,
    ul: ({ children }: any) => <ul className="list-disc pl-5 mb-3.5 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-3.5 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="pl-1 leading-relaxed text-[12px] text-[#d4d4d8]">{processMathInChildren(children)}</li>,
    blockquote: ({ children }: any) => <blockquote className="border-l-2 border-zinc-500 pl-3 italic my-4 text-zinc-400 bg-zinc-900/20 py-1 rounded-r">{processMathInChildren(children)}</blockquote>,
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
          <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">{st("populat", "Population Size (N)")}</label>
          <CustomNumberInput
            value={population}
            min={1}
            onChange={val => setPopulation(val)}
            placeholder="e.g. 1000"
            suffix="N"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">{st("margin", "Margin of Error (e)")}</label>
          <CustomNumberInput
            value={marginOfError}
            step={0.01}
            min={0.001}
            max={0.99}
            onChange={val => setMarginOfError(val)}
            placeholder="e.g. 0.05"
            suffix="e"
          />
        </div>
        <div className="p-4 rounded-xl bg-[#0e0e0f] text-[11px] text-[#71717a] leading-relaxed">
          <div className="font-semibold text-[#a1a1aa] mb-1">
            Slovin's Formula Indicator
          </div>
          {st("slovinDesc", "Used when estimating sample sizes from a known finite population size. It provides a simple approximation of the target sample count necessary for confidence limits.")}
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
        <div className="flex items-center justify-between px-8 pt-8 pb-3 shrink-0">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wide">
            {st("calcBreakdown", "Calculation Breakdown")}
          </h3>
          {valid && (
            <button
              onClick={() => {
                onAddHistory?.({
                  type: 'slovin',
                  title: `Slovin Sample (N=${N}, e=${e})`,
                  parameters: { population, marginOfError },
                  result: `Required sample size: ${Math.ceil(n)}`
                });
              }}
              className="py-1 px-2.5 hover:bg-zinc-800 border border-zinc-700/60 hover:text-white text-[10px] text-zinc-300 rounded-lg transition-colors font-bold select-none cursor-pointer flex items-center gap-1.5 bg-transparent shadow-none border-none outline-none active:scale-95"
            >
              <Icon icon="ph:bookmark-bold" className="w-3.5 h-3.5" />
              {st("saveHistory", "Save to Tools History")}
            </button>
          )}
        </div>
        <div className="px-8 pt-6 pb-8 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-[#27272a] hover:scrollbar-thumb-[#3f3f46] flex-1">
          {valid ? (
            <div className="space-y-4 font-mono text-[11.5px] text-[#a1a1aa]">
              <div className="py-12 flex items-center justify-center select-none scale-[1.75] origin-center">
                <MathLaTex math="n = \frac{N}{1 + N e^2}" displayMode={true} />
              </div>

              {/* Interpretation Accordion Moved Up */}
              <div className="relative z-10 rounded-xl overflow-hidden mt-2">
                <button 
                  onClick={() => setShowSlovinInterpretation(!showSlovinInterpretation)}
                  className="w-fit px-0 py-3 flex items-center gap-2 hover:opacity-80 transition-opacity group cursor-pointer border-none bg-transparent outline-none"
                >
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-zinc-200 transition-colors">{st("interpretation", "Interpretation Guide")}</span>
                  <Icon 
                    icon="ph:caret-down-bold" 
                    className={`w-3 h-3 text-zinc-500 transition-transform duration-300 ${showSlovinInterpretation ? 'rotate-180' : ''}`} 
                  />
                </button>
                <AnimatePresence>
                  {showSlovinInterpretation && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-0 pb-10 space-y-8 pt-4 border-t border-zinc-800/20">
                        {/* Primary Interpretation */}
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">1. Statistical Meaning</div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed font-sans">
                              To represent your population of <span className="text-zinc-100 font-bold border-b border-zinc-700/50">{N.toLocaleString()}</span> with a <span className="text-zinc-100 font-bold">{(e * 100).toFixed(1)}%</span> margin of error, you must survey at least <span className="text-zinc-100 font-bold">{Math.ceil(n)}</span> unique subjects.
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">2. Confidence Interval</div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed font-sans">
                              This result assumes a standard <span className="font-bold text-zinc-100">95% Confidence Level</span>. This means if you repeated the study 100 times, 95 of those times the population's true behavior would fall within your calculated error range.
                            </p>
                          </div>
                        </div>

                        {/* Manual Calculation Steps */}
                        <div className="space-y-4 pt-4 border-t border-zinc-800/10">
                          <div className="grid grid-cols-1 gap-4">
                            {[
                              { step: "1", title: "Square the Error", desc: <>Square the Margin of Error (<MathLaTex math="e^2" />): <span className="text-zinc-400">{e} × {e} = </span> <span className="text-zinc-200 font-mono">{eSq.toFixed(5)}</span></> },
                              { step: "2", title: "Scale by Population", desc: <>Multiply the result by the total population (<MathLaTex math="N \cdot e^2" />): <span className="text-zinc-400">{N} × {eSq.toFixed(5)} = </span> <span className="text-zinc-200 font-mono">{product.toFixed(4)}</span></> },
                              { step: "3", title: "Calculate Denominator", desc: <>Add 1 to the product to complete the divisor: <span className="text-zinc-400">1 + {product.toFixed(4)} = </span> <span className="text-zinc-200 font-mono">{denom.toFixed(4)}</span></> },
                              { step: "4", title: "Final Division", desc: <>Divide the total population by the divisor: <span className="text-zinc-400">{N} / {denom.toFixed(4)} = </span> <span className="text-zinc-200 font-mono">{n.toFixed(4)}</span></> },
                              { step: "5", title: "The 'Ceiling' Rule", desc: <>Always round up to the nearest whole integer. Since you cannot survey a partial person/unit, <span className="text-zinc-200 font-bold">{n.toFixed(4)}</span> becomes <span className="text-zinc-100 font-bold underline decoration-zinc-600">{Math.ceil(n)}</span>.</> },
                            ].map((s) => (
                              <div key={s.step} className="flex gap-3">
                                <div className="shrink-0 text-[10px] font-bold text-zinc-500 pt-0.5">
                                  {s.step}.
                                </div>
                                <div className="space-y-1">
                                  <div className="text-[11px] font-bold text-zinc-200 uppercase tracking-tight">{s.title}</div>
                                  <p className="text-[12px] text-zinc-400 leading-relaxed font-sans">{s.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2">
                          <p className="text-[11px] text-zinc-500 font-sans italic">
                            Note: Slovin's formula is a general approximation. For more rigorous research, consider stratified sampling or specialized Power Analysis.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
          <div className="px-8 py-5 border-t border-[#1e1e20] shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">Required Sample Size</div>
                <div className="text-[11px] text-[#52525b] italic">(Rounded up to next whole count)</div>
              </div>
              <div className="text-3xl font-bold font-mono text-[#f4f4f5]">{Math.ceil(n)}</div>
            </div>
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
          <CustomNumberInput
            value={part}
            min={0}
            onChange={val => setPart(val)}
            placeholder="e.g. 75"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Total Population</label>
          <CustomNumberInput
            value={total}
            min={1}
            onChange={val => setTotal(val)}
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
        <div className="flex items-center justify-between px-8 pt-8 pb-3 shrink-0">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wide">
            Proportional Breakdown
          </h3>
          {isValid && (
            <button
              onClick={() => {
                onAddHistory?.({
                  type: 'percentage',
                  title: `Portion (${p} of ${t})`,
                  parameters: { part, total },
                  result: `Proportion: ${pct.toFixed(2)}%`
                });
              }}
              className="py-1 px-2.5 hover:bg-zinc-800 border border-zinc-700/60 hover:text-white text-[10px] text-zinc-300 rounded-lg transition-colors font-bold select-none cursor-pointer flex items-center gap-1.5 bg-transparent shadow-none border-none outline-none active:scale-95"
            >
              <Icon icon="ph:bookmark-bold" className="w-3.5 h-3.5" />
              Save to Tools History
            </button>
          )}
        </div>
        <div className="px-8 pt-6 pb-8 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-[#27272a] hover:scrollbar-thumb-[#3f3f46] flex-1">
          {isValid ? (
            <div className="space-y-4">
              <div className="py-12 flex items-center justify-center select-none scale-[1.75] origin-center">
                <MathLaTex math="P = \left( \frac{\text{Part}}{\text{Total}} \right) \times 100" displayMode={true} />
              </div>

              {/* Interpretation Accordion */}
              <div className="relative z-10 rounded-xl overflow-hidden mt-2">
                <button 
                  onClick={() => setShowPercentageInterpretation(!showPercentageInterpretation)}
                  className="w-fit px-0 py-3 flex items-center gap-2 hover:opacity-80 transition-opacity group cursor-pointer border-none bg-transparent outline-none"
                >
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-zinc-200 transition-colors">Interpretation Guide</span>
                  <Icon 
                    icon="ph:caret-down-bold" 
                    className={`w-3 h-3 text-zinc-500 transition-transform duration-300 ${showPercentageInterpretation ? 'rotate-180' : ''}`} 
                  />
                </button>
                <AnimatePresence>
                  {showPercentageInterpretation && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-0 pb-10 space-y-8 pt-4 border-t border-zinc-800/20">
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Proportional Analysis</div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed font-sans">
                              The value <span className="text-zinc-100 font-bold border-b border-zinc-700/50">{p}</span> represents <span className="text-zinc-100 font-bold">{pct.toFixed(2)}%</span> of the entire dataset or group (<span className="text-zinc-200">{t}</span>).
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800/10">
                          <div className="grid grid-cols-1 gap-4">
                            {[
                              { step: "1", title: "Divide Values", desc: <>Divide the part by the total to find the decimal ratio: <span className="text-zinc-400">{p} / {t} = </span> <span className="text-zinc-200 font-mono">{(p/t).toFixed(5)}</span></> },
                              { step: "2", title: "Convert to Percentage", desc: <>Multiply by 100 to convert the decimal into a percent: <span className="text-zinc-400">{(p/t).toFixed(5)} × 100 = </span> <span className="text-zinc-100 font-bold border-b border-zinc-700/50">{pct.toFixed(2)}%</span></> },
                            ].map((s) => (
                              <div key={s.step} className="flex gap-3">
                                <div className="shrink-0 text-[10px] font-bold text-zinc-500 pt-0.5">{s.step}.</div>
                                <div className="space-y-1">
                                  <div className="text-[11px] font-bold text-zinc-200 uppercase tracking-tight">{s.title}</div>
                                  <p className="text-[12px] text-zinc-400 leading-relaxed font-sans">{s.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
          <div className="px-8 py-5 border-t border-[#1e1e20] shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">Calculated Proportion</div>
                <div className="text-[11px] text-[#52525b] italic">Ratio = {(p / t).toFixed(5)}</div>
              </div>
              <div className="text-3xl font-bold font-mono text-[#10b981]">{pct.toFixed(2)}%</div>
            </div>
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
                <CustomNumberInput 
                  placeholder="Value (x)"
                  value={entry.value}
                  onChange={val => {
                    const newEntries = [...entries];
                    newEntries[idx].value = val;
                    setEntries(newEntries);
                  }}
                  className="flex-1 min-w-0 py-2 px-3"
                />
                <CustomNumberInput 
                  placeholder="Weight (w)"
                  value={entry.weight}
                  onChange={val => {
                    const newEntries = [...entries];
                    newEntries[idx].weight = val;
                    setEntries(newEntries);
                  }}
                  className="flex-1 min-w-0 py-2 px-3"
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
        <div className="flex items-center justify-between px-8 pt-8 pb-3 shrink-0">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wide">
            Weighted Valuation
          </h3>
          {isValid && (
            <button
              onClick={() => {
                onAddHistory?.({
                  type: 'weighted',
                  title: `Weighted Mean (${validatedRows.length} items)`,
                  parameters: { entries },
                  result: `Weighted mean: ${mean.toFixed(4)}`
                });
              }}
              className="py-1 px-2.5 hover:bg-zinc-800 border border-zinc-700/60 hover:text-white text-[10px] text-zinc-300 rounded-lg transition-colors font-bold select-none cursor-pointer flex items-center gap-1.5 bg-transparent shadow-none border-none outline-none active:scale-95"
            >
              <Icon icon="ph:bookmark-bold" className="w-3.5 h-3.5" />
              Save to Tools History
            </button>
          )}
        </div>
        <div className="px-8 pt-6 pb-8 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-[#27272a] hover:scrollbar-thumb-[#3f3f46] flex-1">
          {isValid && validatedRows.length > 0 ? (
            <div className="space-y-4">
              <div className="py-12 flex items-center justify-center select-none scale-[1.75] origin-center">
                <MathLaTex math="\bar{x}_w = \frac{\sum_{i=1}^n w_i x_i}{\sum_{i=1}^n w_i}" displayMode={true} />
              </div>

              {/* Interpretation Accordion */}
              <div className="relative z-10 rounded-xl overflow-hidden mt-2">
                <button 
                  onClick={() => setShowWeightedMeanInterpretation(!showWeightedMeanInterpretation)}
                  className="w-fit px-0 py-3 flex items-center gap-2 hover:opacity-80 transition-opacity group cursor-pointer border-none bg-transparent outline-none"
                >
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-zinc-200 transition-colors">Interpretation Guide</span>
                  <Icon 
                    icon="ph:caret-down-bold" 
                    className={`w-3 h-3 text-zinc-500 transition-transform duration-300 ${showWeightedMeanInterpretation ? 'rotate-180' : ''}`} 
                  />
                </button>
                <AnimatePresence>
                  {showWeightedMeanInterpretation && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-0 pb-10 space-y-8 pt-4 border-t border-zinc-800/20">
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Significance</div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed font-sans">
                              The weighted mean of <span className="text-zinc-100 font-bold border-b border-zinc-700/50">{mean.toFixed(4)}</span> accounts for the varying importance (weights) assigned to each individual value.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800/10">
                          <div className="grid grid-cols-1 gap-4">
                            {[
                              { step: "1", title: "Calculate Products", desc: <>Multiply each individual value (<MathLaTex math="x" />) by its corresponding weight (<MathLaTex math="w" />). Current sum of products: <span className="text-zinc-100 font-mono">{sumValueWeight.toFixed(2)}</span></> },
                              { step: "2", title: "Sum the Weights", desc: <>Total the sum of all weights entered: <span className="text-zinc-100 font-mono">{sumWeight}</span></> },
                              { step: "3", title: "Final Division", desc: <>Divide the sum of products by the total weight: <span className="text-zinc-400">{sumValueWeight.toFixed(2)} / {sumWeight} = </span> <span className="text-zinc-100 font-bold border-b border-zinc-700/50">{mean.toFixed(4)}</span></> },
                            ].map((s) => (
                              <div key={s.step} className="flex gap-3">
                                <div className="shrink-0 text-[10px] font-bold text-zinc-500 pt-0.5">{s.step}.</div>
                                <div className="space-y-1">
                                  <div className="text-[11px] font-bold text-zinc-200 uppercase tracking-tight">{s.title}</div>
                                  <p className="text-[12px] text-zinc-400 leading-relaxed font-sans">{s.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="overflow-x-auto rounded-lg max-h-[220px] overflow-y-auto border border-zinc-900">
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
            </div>
          ) : (
            <p className="text-xs text-[#52525b] italic">Enter at least one valid numeric pair to render weighted assessment.</p>
          )}
        </div>

        {isValid && (
          <div className="px-8 py-5 border-t border-[#1e1e20] shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">Weighted Average</div>
                <div className="text-[11px] text-[#52525b] italic">Elements evaluated = {validatedRows.length}</div>
              </div>
              <div className="text-3xl font-bold font-mono text-[#38bdf8]">{mean.toFixed(4)}</div>
            </div>
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
                <CustomNumberInput 
                  value={choice.weight}
                  onChange={val => {
                    const newChoices = [...likertChoices];
                    newChoices[idx].weight = parseInt(val, 10) || 0;
                    setLikertChoices(newChoices);
                  }}
                  align="center"
                  placeholder="Pts"
                  className="py-2 px-1"
                />
              </div>

              {/* Frequency Count */}
              <div className="col-span-3">
                <CustomNumberInput 
                  min={0}
                  value={choice.count}
                  onChange={val => {
                    const newChoices = [...likertChoices];
                    newChoices[idx].count = val;
                    setLikertChoices(newChoices);
                  }}
                  align="center"
                  placeholder="Count"
                  className="py-2 px-1"
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
        <div className="flex items-center justify-between px-8 pt-8 pb-3 shrink-0">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wide">
            Survey Allocation Chart
          </h3>
          {isValid && sumWeight > 0 && (
            <button
              onClick={() => {
                onAddHistory?.({
                  type: 'likert',
                  title: `Likert Scale (${sumWeight} respondents)`,
                  parameters: { likertChoices },
                  result: `Index: ${mean.toFixed(3)}`
                });
              }}
              className="py-1 px-2.5 hover:bg-zinc-800 border border-zinc-700/60 hover:text-white text-[10px] text-zinc-300 rounded-lg transition-colors font-bold select-none cursor-pointer flex items-center gap-1.5 bg-transparent shadow-none border-none outline-none active:scale-95"
            >
              <Icon icon="ph:bookmark-bold" className="w-3.5 h-3.5" />
              Save to Tools History
            </button>
          )}
        </div>
        <div className="px-8 pt-6 pb-8 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-[#27272a] hover:scrollbar-thumb-[#3f3f46] flex-1">
          {isValid && sumWeight > 0 ? (
            <div className="space-y-4">
              <div className="py-12 flex items-center justify-center select-none scale-[1.75] origin-center">
                <MathLaTex math="\bar{x} = \frac{\sum (f \cdot w)}{\sum f}" displayMode={true} />
              </div>

              {/* Interpretation Accordion */}
              <div className="relative z-10 rounded-xl overflow-hidden mt-2">
                <button 
                  onClick={() => setShowLikertInterpretation(!showLikertInterpretation)}
                  className="w-fit px-0 py-3 flex items-center gap-2 hover:opacity-80 transition-opacity group cursor-pointer border-none bg-transparent outline-none"
                >
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-zinc-200 transition-colors">Interpretation Guide</span>
                  <Icon 
                    icon="ph:caret-down-bold" 
                    className={`w-3 h-3 text-zinc-500 transition-transform duration-300 ${showLikertInterpretation ? 'rotate-180' : ''}`} 
                  />
                </button>
                <AnimatePresence>
                  {showLikertInterpretation && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-0 pb-10 space-y-8 pt-4 border-t border-zinc-800/20">
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Current Sentiment</div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed font-sans">
                              The mean score of <span className="text-zinc-100 font-bold border-b border-zinc-700/50">{mean.toFixed(3)}</span> signifies a <span className={colorClass}>{interpretation}</span> stance based on your custom weight scaling (<span className="text-zinc-400">{wMin} to {wMax}</span>).
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800/10">
                          <div className="grid grid-cols-1 gap-4">
                            {[
                              { step: "1", title: "Calculate Frequencies", desc: <>Multiply each point weight (<MathLaTex math="w" />) by the number of responses (<MathLaTex math="f" />) for that category. Total sum: <span className="text-zinc-100 font-mono">{sumValueWeight}</span></> },
                              { step: "2", title: "Sum Respondents", desc: <>Total the number of people who participated in the survey: <span className="text-zinc-100 font-mono">{sumWeight}</span></> },
                              { step: "3", title: "Divide for Index", desc: <>Divide the total weighted sum by the number of respondents: <span className="text-zinc-400">{sumValueWeight} / {sumWeight} = </span> <span className="text-zinc-100 font-bold border-b border-zinc-700/50">{mean.toFixed(3)}</span></> },
                            ].map((s) => (
                              <div key={s.step} className="flex gap-3">
                                <div className="shrink-0 text-[10px] font-bold text-zinc-500 pt-0.5">{s.step}.</div>
                                <div className="space-y-1">
                                  <div className="text-[11px] font-bold text-zinc-200 uppercase tracking-tight">{s.title}</div>
                                  <p className="text-[12px] text-zinc-400 leading-relaxed font-sans">{s.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2 pt-2">
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
          <div className="px-8 py-5 border-t border-[#1e1e20] shrink-0 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-[#71717a]">
               <span>Weighted Summation</span>
               <span className="font-mono text-[#e4e4e7]">{sumValueWeight} / {sumWeight} respondents</span>
            </div>
            <div className="flex flex-col gap-2">
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
             className="py-2 px-5 bg-[#27272a] hover:bg-[#333336] text-[#f4f4f5] text-[12px] font-medium rounded-full transition-colors flex items-center gap-2 mb-2 disabled:opacity-50 cursor-pointer"
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
        <h3 className="text-xs font-semibold text-[#e4e4e7] pt-8 pb-3 uppercase tracking-wide px-8 shrink-0">
          Deep Analytical Insights
        </h3>
        <div className="flex-1 min-h-0 overflow-y-auto px-8 pt-6 pb-8 select-text scrollbar-thin scrollbar-thumb-zinc-850">
          {isAnalyzing ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 pt-12">
                <Icon icon="ph:spinner-gap" className="animate-spin text-zinc-400 w-8 h-8" />
                <p className="text-xs text-[#a1a1aa]">Analysis engine is evaluating the context claim patterns...</p>
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
        {/* Input Mode Navigation */}
        <div className="flex gap-1 bg-[#161616] p-1 rounded-xl mb-3">
          {(['manual', 'doi', 'pdf'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => {
                setCitationInputMode(mode);
                setCitationStatus(null);
              }}
              className={`flex-1 py-1.5 text-[10px] font-bold capitalize rounded-lg transition-colors cursor-pointer select-none text-center ${
                citationInputMode === mode 
                  ? 'bg-[#27272a] text-white' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {mode === 'manual' ? 'Manual Input' : mode === 'doi' ? 'DOI Resolving' : 'PDF Scan'}
            </button>
          ))}
        </div>

        {/* Status notification area within iframe bounds */}
        {citationStatus && (
          <div className={`p-2.5 rounded-lg text-[11px] flex items-start gap-2 ${
            citationStatus.type === 'success' 
              ? 'bg-emerald-950/40 border border-emerald-900/50 text-emerald-300' 
              : citationStatus.type === 'error' 
                ? 'bg-rose-950/40 border border-rose-900/50 text-rose-300' 
                : 'bg-blue-950/40 border border-blue-900/50 text-blue-300'
          }`}>
            <Icon 
              icon={
                citationStatus.type === 'success' 
                  ? 'ph:check-circle-bold' 
                  : citationStatus.type === 'error' 
                    ? 'ph:warning-circle-bold' 
                    : 'ph:info-bold'
              } 
              className="w-4 h-4 shrink-0 mt-0.5" 
            />
            <div className="flex-1">
              {citationStatus.message}
            </div>
            <button 
              onClick={() => setCitationStatus(null)} 
              className="text-zinc-500 hover:text-zinc-200"
            >
              <Icon icon="ph:x-bold" className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Render different panels based on selected mode */}
        {citationInputMode === 'doi' && (
          <div className="space-y-4 bg-[#161616]/40 p-5 rounded-xl border border-[#222225]">
            <div className="space-y-2">
              <label className="text-[10px] text-[#71717a] font-bold uppercase block tracking-wider">Provide Work DOI</label>
              <p className="text-[9px] text-[#52525b]">AI resolves DOI registry meta-values and syncs them automatically.</p>
              <input 
                type="text"
                value={doiInput}
                onChange={e => setDoiInput(e.target.value)}
                placeholder="e.g., 10.1017/asi.2021.5"
                className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] outline-none transition-colors font-mono"
              />
            </div>
            <button
              onClick={handleResolveDoi}
              disabled={isResolvingDoi}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold text-white rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none animate-none"
            >
              {isResolvingDoi ? (
                <>
                  <Icon icon="ph:spinner-gap" className="animate-spin w-3.5 h-3.5" />
                  Resolving doi registry...
                </>
              ) : (
                <>
                  <Icon icon="ph:radar-bold" className="w-3.5 h-3.5" />
                  Resolve DOI via AI
                </>
              )}
            </button>
          </div>
        )}

        {citationInputMode === 'pdf' && (
          <div className="space-y-4 bg-[#161616]/40 p-5 rounded-xl border border-[#222225]">
            <label className="text-[10px] text-[#71717a] font-bold uppercase block tracking-wider">Upload Research PDF(s)</label>
            <p className="text-[9px] text-[#52525b]">Select one or multiple PDFs to extract metadata structures automatically using Mistral.</p>
            
            <div 
              onClick={() => {
                const input = document.getElementById('citation-pdf-uploader');
                if (input) (input as HTMLInputElement).click();
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={handlePdfDropForCitation}
              className="border border-dashed border-[#2d2d30] hover:border-zinc-600 rounded-xl p-6 text-center cursor-pointer transition-colors space-y-2 bg-[#121212]/40"
            >
              <input 
                id="citation-pdf-uploader"
                type="file"
                accept=".pdf"
                onChange={handlePdfUploadForCitation}
                className="hidden"
                multiple
              />
              <Icon icon="ph:cloud-arrow-up-fill" className={`mx-auto w-8 h-8 ${isParsingPdf ? 'animate-bounce text-zinc-100' : 'text-zinc-500'}`} />
              <div className="text-[11px] text-zinc-300 font-medium">
                {isParsingPdf ? 'Processing drag/upload index...' : 'Click to Browse or Drag PDFs here'}
              </div>
              <p className="text-[9px] text-zinc-500 font-mono italic">Supports uploading multiple PDFs in parallel</p>
            </div>

            {pdfTasks.length > 0 && (
              <div className="border-t border-[#222225] pt-3 mt-3 space-y-1.5 max-h-[180px] overflow-y-auto scrollbar-thin">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Upload Queue ({pdfTasks.length})</span>
                  <button 
                    onClick={() => setPdfTasks([])}
                    className="text-[9px] text-zinc-400 hover:text-white font-bold bg-transparent border-none cursor-pointer select-none bg-none outline-none"
                  >
                    Clear All
                  </button>
                </div>
                {pdfTasks.map(task => (
                  <div key={task.id} className="bg-[#121212]/50 rounded-lg p-2 flex items-center justify-between text-xs border border-[#1b1b1e]">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Icon 
                        icon="ph:file-pdf-bold" 
                        className={`w-4 h-4 shrink-0 ${
                          task.status === 'success' ? 'text-emerald-500' :
                          task.status === 'error' ? 'text-rose-500' :
                          'text-zinc-400'
                        }`} 
                      />
                      <span className="truncate text-zinc-300 font-mono text-[10px] pr-1 min-w-0" title={task.name}>
                        {task.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      {task.status === 'pending' && (
                        <span className="text-[9px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded font-mono">Pending</span>
                      )}
                      {task.status === 'extracting' && (
                        <span className="text-[9px] text-amber-500 bg-amber-950/40 px-1.5 py-0.5 rounded font-mono animate-pulse flex items-center gap-1">
                          <Icon icon="ph:spinner" className="animate-spin w-2.5 h-2.5" /> Text
                        </span>
                      )}
                      {task.status === 'parsing' && (
                        <span className="text-[9px] text-sky-400 bg-[#0c4a6e]/40 px-1.5 py-0.5 rounded font-mono animate-pulse flex items-center gap-1">
                          <Icon icon="ph:sparkle" className="animate-pulse w-2.5 h-2.5 text-sky-400" /> Mistral
                        </span>
                      )}
                      {task.status === 'success' && (
                        <span className="text-[9px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5">
                          ✓ Saved
                        </span>
                      )}
                      {task.status === 'error' && (
                        <span className="text-[9px] text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded font-mono" title={task.errorMsg || "Parse failed"}>
                          ✕ Fail
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {citationInputMode === 'manual' && (
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
            
            <button
              onClick={addCitationToLibrary}
              className="w-full py-2.5 bg-zinc-200 hover:bg-white text-[11px] font-bold text-zinc-950 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none border-none animate-none"
            >
              <Icon icon="ph:bookmark-simple-fill" className="w-4 h-4" />
              Save to Citation Library
            </button>
          </div>
        )}
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

    if (citationRightTab === 'library') {
      const filteredLibrary = savedCitations
        .filter(c => {
          if (librarySearchType === 'all') return true;
          return c.sourceType === librarySearchType;
        })
        .filter(c => {
          if (!librarySearchQuery.trim()) return true;
          const q = librarySearchQuery.toLowerCase();
          return (
            c.fields.title.toLowerCase().includes(q) ||
            c.fields.authors.toLowerCase().includes(q) ||
            (c.fields.journal && c.fields.journal.toLowerCase().includes(q)) ||
            (c.fields.publisher && c.fields.publisher.toLowerCase().includes(q))
          );
        });

      return (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-8 pt-8 pb-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCitationRightTab('preview')}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer select-none py-1 text-xs flex items-center gap-1 border-none bg-transparent"
              >
                Preview Mode
              </button>
              <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wide">
                Organized Citations Library ({savedCitations.length})
              </h3>
            </div>
            
            {/* Download/Copy All */}
            {savedCitations.length > 0 && (
              <div className="flex items-center gap-1.5 relative animate-none" ref={formatDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsFormatDropdownOpen(!isFormatDropdownOpen)}
                  className="bg-[#161616] hover:bg-[#1f1f22] border border-[#27272a] rounded-lg text-[10px] text-zinc-300 px-2.5 py-1.5 outline-none flex items-center gap-1 transition-colors select-none cursor-pointer"
                >
                  <span>{styles.find(s => s.id === libraryFormatFilter)?.label || libraryFormatFilter.toUpperCase()}</span>
                  <Icon icon="ph:caret-down" className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${isFormatDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isFormatDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.1, ease: 'easeOut' }}
                      className="absolute right-0 top-full mt-1 bg-[#18181b] border border-[#27272a] rounded-xl py-1 z-[80] overflow-hidden shadow-xl min-w-[150px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {styles.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setLibraryFormatFilter(s.id);
                            setIsFormatDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[10px] flex items-center justify-between transition-colors cursor-pointer ${
                            libraryFormatFilter === s.id
                              ? 'bg-[#27272a] text-white font-medium'
                              : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
                          }`}
                        >
                          <span>{s.label}</span>
                          {libraryFormatFilter === s.id && (
                            <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={() => {
                    const text = getFullFormattedBibliography(libraryFormatFilter);
                    if (text) {
                      triggerCopy(text, 'all-bibliography');
                    }
                  }}
                  className="py-1.5 px-2.5 bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] text-[10px] text-white rounded-lg transition font-bold select-none cursor-pointer flex items-center gap-1 shadow-none outline-none border-none active:scale-[0.98]"
                >
                  <Icon icon="ph:copy-bold" className="w-3.5 h-3.5" />
                  {copiedStyleId === 'all-bibliography' ? 'Bibliography Copied!' : 'Copy Bibliography Index'}
                </button>
              </div>
            )}
          </div>

          {/* Search bar & Type Filters */}
          <div className="px-8 pt-3 pb-3 bg-[#121212]/30 flex flex-col sm:flex-row gap-2 shrink-0">
            <div className="flex-1 relative">
              <Icon icon="ph:magnifying-glass-bold" className="absolute left-3 top-2.5 text-zinc-500 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search library title, author, journal..."
                value={librarySearchQuery}
                onChange={e => setLibrarySearchQuery(e.target.value)}
                className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-[11px] text-zinc-200 outline-none transition-colors"
              />
              {librarySearchQuery && (
                <button
                  onClick={() => setLibrarySearchQuery('')}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-200 bg-transparent border-none"
                >
                  <Icon icon="ph:x-bold" className="w-3 h-3" />
                </button>
              )}
            </div>
            
            <div className="flex gap-1">
              {(['all', 'book', 'journal', 'website'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setLibrarySearchType(type)}
                  className={`px-2 py-1.5 text-[9px] font-bold rounded-lg transition-colors capitalize select-none cursor-pointer border-none bg-transparent ${
                    librarySearchType === type
                      ? 'bg-zinc-800 text-white border border-[#3f3f46]'
                      : 'text-zinc-400 hover:text-white border border-transparent'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Library Cards list */}
          <div className="px-8 pt-4 pb-8 overflow-y-auto scrollbar-thin scrollbar-thumb-[#27272a] hover:scrollbar-thumb-[#3f3f46] flex-1">
            {filteredLibrary.length === 0 ? (
              <div className="h-full py-16 flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
                <Icon icon="ph:notebook-bold" className="w-10 h-10 mb-1 text-zinc-600 opacity-40" />
                <p className="text-xs font-semibold text-zinc-400">
                  {savedCitations.length === 0 ? 'No citations in your library yet.' : 'No matching citations found.'}
                </p>
                <p className="text-[10px] text-zinc-600 max-w-xs">
                  {savedCitations.length === 0 
                    ? 'Populate metadata manually, resolve via DOIs, or scan PDFs on the left, then click "Save to Citation Library" to build your reference index.'
                    : 'Clear your search query or change headers filters to view your entire collection.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLibrary.map(citation => {
                  const itemStyles = styles.map(st => ({
                    id: st.id,
                    label: st.label,
                    cite: generateCitationText(citation.sourceType, st.id, citation.fields)
                  }));
                  
                  const activeCite = itemStyles.find(st => st.id === libraryFormatFilter)?.cite || itemStyles[0].cite;

                  return (
                    <div key={citation.id} className="p-4 bg-[#161616]/60 hover:bg-[#1c1c1e]/60 border border-[#222225] rounded-xl transition-all space-y-3 relative group">
                      <button
                        onClick={() => setCitationIdToDelete(citation.id)}
                        className="absolute top-4 right-4 text-zinc-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 cursor-pointer bg-transparent border-none outline-none"
                        title="Delete Citation"
                      >
                        <Icon icon="ph:trash-bold" className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-zinc-300 bg-zinc-800/50 border border-zinc-700/50 font-bold px-2 py-0.5 rounded-full uppercase font-mono">
                          {citation.sourceType}
                        </span>
                        {citation.fields.year && (
                          <span className="text-[9px] text-zinc-500 font-bold font-mono">
                            ({citation.fields.year})
                          </span>
                        )}
                        {citation.fields.doi && (
                          <span className="text-[9px] text-zinc-600 font-mono select-all truncate max-w-[150px]" title={`DOI: ${citation.fields.doi}`}>
                            doi:{citation.fields.doi}
                          </span>
                        )}
                      </div>

                      {/* Display Bibliography representation depending on global toggle */}
                      <div className="text-[11.5px] text-zinc-100 leading-relaxed font-sans pr-6 select-text">
                        {activeCite.reference.replace(/\*(.*?)\*/g, '$1')}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-[#222225]/60">
                        <span className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider">In-Text:</span>
                        <span className="text-[10px] text-zinc-300 font-mono bg-[#161616] px-1.5 py-0.5 border border-[#27272a] rounded select-all mb-1 sm:mb-0">
                          {activeCite.inText}
                        </span>
                        
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => triggerCopy(activeCite.reference.replace(/\*(.*?)\*/g, '$1'), `${citation.id}-ref`)}
                            className="text-[9px] text-zinc-400 hover:text-white px-2.5 py-1 bg-zinc-800/40 hover:bg-zinc-800 border border-[#27272a] rounded-full cursor-pointer transition-colors border-none"
                          >
                            {copiedStyleId === `${citation.id}-ref` ? 'Copied Bibli!' : 'Copy Bibliography'}
                          </button>
                          <button
                            onClick={() => triggerCopy(activeCite.inText, `${citation.id}-txt`)}
                            className="text-[9px] text-zinc-400 hover:text-white px-2.5 py-1 bg-zinc-800/40 hover:bg-zinc-800 border border-[#27272a] rounded-full cursor-pointer transition-colors border-none"
                          >
                            {copiedStyleId === `${citation.id}-txt` ? 'Copied In-Text!' : 'Copy In-Text'}
                          </button>
                          {/* Populate in form */}
                          <button
                            onClick={() => {
                              setCitationSourceType(citation.sourceType);
                              setCitationFields({ ...citation.fields });
                              setCitationInputMode('manual');
                              setCitationRightTab('preview');
                              setCitationStatus({ type: 'info', message: 'Populated details back to form editing panel.' });
                            }}
                            className="text-[9px] text-zinc-400 hover:text-white px-2.5 py-1 bg-zinc-800/40 hover:bg-zinc-800 border border-[#27272a] rounded-full cursor-pointer transition-colors border-none"
                            title="Load back for manual edits/re-formatting"
                          >
                            Load to Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Toggle Library / Preview */}
        <div className="flex items-center justify-between px-8 pt-8 pb-3 shrink-0">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wide">
            Formatted References Stack
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onAddHistory?.({
                  type: 'citation',
                  title: `Citation: ${citationFields.title || 'Untitled'}`,
                  parameters: { sourceType: citationSourceType, fields: citationFields },
                  result: sampleCiteAPA.reference
                });
                setCitationStatus({ type: 'success', message: 'Calculated outputs backed up inside history tabs!' });
              }}
              className="py-1 px-2.5 hover:bg-zinc-800 border border-zinc-700/60 hover:text-white text-[10px] text-zinc-300 rounded-lg transition-colors font-bold select-none cursor-pointer flex items-center gap-1.5 bg-transparent shadow-none border-none outline-none active:scale-95 group"
            >
              <Icon icon="ph:bookmark-bold" className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
              Save to Tools History
            </button>
            {savedCitations.length > 0 && (
              <button
                onClick={() => setCitationRightTab('library')}
                className="py-1 px-2.5 hover:bg-zinc-800 border border-zinc-700/60 hover:text-white text-[10px] text-zinc-300 rounded-lg transition-colors font-bold select-none cursor-pointer flex items-center gap-1.5 bg-transparent shadow-none border-none outline-none active:scale-95 group"
              >
                <Icon icon="ph:bookmark-bold" className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
                Open Library ({savedCitations.length})
              </button>
            )}
            <span className="text-[10px] text-[#71717a] font-mono capitalize px-2 py-0.5 bg-[#161618] border border-[#222225] rounded-md font-bold">
              {citationSourceType} Format
            </span>
          </div>
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
                        className="py-1 px-3 hover:bg-[#27272a] border border-transparent hover:border-[#3f3f46] text-[10px] text-zinc-300 rounded-full transition font-medium select-none cursor-pointer border-none bg-transparent shadow-none"
                      >
                        {copiedStyleId === `${style.id}-ref` ? 'Copied Reference!' : 'Copy Bibliography'}
                      </button>
                      <button
                        onClick={() => triggerCopy(res.inText, `${style.id}-text`)}
                        className="py-1 px-3 hover:bg-[#27272a] border border-transparent hover:border-[#3f3f46] text-[10px] text-zinc-300 rounded-full transition font-medium select-none cursor-pointer border-none bg-transparent shadow-none"
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
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col min-h-0 relative">
      <div className="flex flex-col md:flex-row overflow-hidden items-stretch h-full md:divide-x divide-[#222225] min-h-0">
         {/* Left Side: Parameters / Files */}
         <div className="w-full md:w-4/12 flex flex-col justify-start overflow-hidden mb-8 md:mb-0 border-b md:border-b-0 border-[#222225] h-full">
            <h3 className="text-xs font-semibold text-[#e4e4e7] pt-8 pb-3 uppercase tracking-wide px-8 shrink-0">
              {st("toolParam", "Tool Parameters")}
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

      {citationIdToDelete && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4 animate-fade-in"
          onClick={() => setCitationIdToDelete(null)}
        >
          <div
            className="bg-[#1c1c1e] border border-zinc-800 rounded-[20px] w-full max-w-[320px] overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2 text-left">
                Delete Citation?
              </h3>
              <p className="text-zinc-400 text-[13px] leading-normal mb-6 text-left font-sans">
                Are you sure you want to delete this citation? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setCitationIdToDelete(null)}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-xs font-semibold transition-colors cursor-pointer border border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteCitationFromLibrary(citationIdToDelete);
                    setCitationIdToDelete(null);
                  }}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-semibold transition-all cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
