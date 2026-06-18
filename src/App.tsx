import { openUrl } from "@tauri-apps/plugin-opener";
import React, { useState, useEffect, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { marked } from "marked";
import { MainChat } from "./components/MainChat";
import { TypewriterMarkdown } from "./components/TypewriterMarkdown";
import { DynamicShimmer } from "./components/DynamicShimmer";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "@iconify/react";
import { MaterialIcon } from "./components/MaterialIcon";

interface ShimProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
  fill?: boolean;
  size?: number;
}

const mapLucideToMaterialSize = (className: string = '', size?: number) => {
  if (size !== undefined) {
    return `text-[${size}px] ${className}`;
  }
  let sizeClass = 'text-[18px]'; // default size replacing w-4 h-4
  if (className.includes('w-3.5') || className.includes('h-3.5')) {
    sizeClass = 'text-[15px]';
  } else if (className.includes('w-3') || className.includes('h-3')) {
    sizeClass = 'text-[13px]';
  } else if (className.includes('w-5') || className.includes('h-5')) {
    sizeClass = 'text-[20px]';
  } else if (className.includes('w-6') || className.includes('h-6')) {
    sizeClass = 'text-[24px]';
  } else if (className.includes('w-8') || className.includes('h-8')) {
    sizeClass = 'text-[32px]';
  }
  return `${sizeClass} ${className}`;
};

const makeIcon = (name: string, fillDefault = false) => {
  return ({ className = '', fill = fillDefault, size, ...props }: ShimProps) => (
    <MaterialIcon
      name={name}
      fill={fill}
      className={mapLucideToMaterialSize(className, size)}
      {...props}
    />
  );
};

const Edit2 = makeIcon('edit');
const ExternalLink = makeIcon('open_in_new');
const Unlink = makeIcon('link_off');
const LinkIcon = makeIcon('link');
const PanelRight = makeIcon('view_sidebar');
const Coffee = makeIcon('coffee');
const X = makeIcon('close');
import { StatisticsTools } from "./components/StatisticsTools";
import { SidePanel } from "./components/SidePanel";
import { Settings } from "./components/Settings";
import { AuthenticationScreen } from "./components/AuthenticationScreen";
import { DesktopAuthBridge } from "./components/DesktopAuthBridge";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ToastContainer, showToast } from "./components/Toast";

// Firebase imports
import {
  auth,
  db,
  OperationType,
  handleFirestoreError,
  signInWithPopup,
  googleProvider,
  signOut,
} from "./firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocFromServer,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FolderItem {
  id: string;
  name: string;
  createdAt: number;
}

interface PaperItem {
  author: string;
  title: string;
  description: string;
  url?: string;
  added?: string;
  fullTextStatus?: string;
  viewed?: string;
  fileType?: string;
  summary?: string;
  fileId?: string;
  mimetype?: string;
  extractedText?: string;
  folderId?: string;
  notes?: string;
}

export interface Tab {
  id: string;
  type: "home" | "document" | "library" | "chat" | "tools" | "settings";
  title: string;
  originalTitle?: string;
  content?: string;
  fileId?: string;
  mimetype?: string;
  messages?: ChatMessage[];
  folderId?: string;
  chatInput?: string;
  undoStack?: string[];
  redoStack?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thought?: string;
  timestamp: number;
  isHidden?: boolean;
  attachment?: {
    fileId: string;
    fileName: string;
    mimetype: string;
    url: string;
  };
}

const linkifyHtml = (html: string): string => {
  if (!html) return "";
  const tokens = html.split(/(<[^>]+>)/);
  let insideAnchor = false;

  const urlPattern =
    /(\b(?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]|\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;

  const processedTokens = tokens.map((token, index) => {
    if (index % 2 === 1) {
      const lowerToken = token.toLowerCase();
      if (
        lowerToken.slice(0, 3) === "<a " ||
        lowerToken.slice(0, 3) === "<a>"
      ) {
        insideAnchor = true;
      } else if (lowerToken === "</a>") {
        insideAnchor = false;
      }
      return token;
    }

    if (insideAnchor) {
      return token;
    }

    // Process URLs
    let tokenText = token.replace(urlPattern, (url) => {
      const href = url.toLowerCase().startsWith("www.") ? `http://${url}` : url;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline cursor-pointer">${url}</a>`;
    });

    // Process double bracket citations [[page:2|Title]]
    tokenText = tokenText.replace(/\[\[page:(\d+)\|(.+?)\]\]/g, (_, p, t) => {
      const cleanLabel = t.replace(/_/g, " ");
      const href = `#cite-page-${p}-${encodeURIComponent(t)}`;
      return `<a href="${href}" class="inline-flex items-center gap-1 bg-zinc-800/80 hover:bg-zinc-700/80 text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded text-[11px] font-mono border border-zinc-700 transition-colors mx-0.5 cursor-pointer align-middle select-all" data-page="${p}" data-title="${t}">📄 ${cleanLabel} (p. ${p})</a>`;
    });

    return tokenText;
  });

  return processedTokens.join("");
};

const renderLinkifiedText = (text: string) => {
  if (!text) return "";
  const urlPattern =
    /(\b(?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]|\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
  const parts = text.split(urlPattern);

  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (urlPattern.test(part)) {
      const href = part.toLowerCase().startsWith("www.")
        ? `http://${part}`
        : part;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline cursor-pointer break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

// Unified TypewriterMarkdown is now imported from original component file

const parseAssistantResponse = (text: string) => {
  let thought = "";
  let chat = "";
  let title = "";
  let replaceContent = "";
  let searchRealPapersQuery = "";

  const lowerText = text.toLowerCase();

  // If there are absolutely NO valid XML tags in the text, treat everything as chat content.
  const hasTag =
    lowerText.includes("<thought>") ||
    lowerText.includes("</thought>") ||
    lowerText.includes("<chat>") ||
    lowerText.includes("</chat>") ||
    lowerText.includes("<title>") ||
    lowerText.includes("</title>") ||
    lowerText.includes("<replacecontent>") ||
    lowerText.includes("</replacecontent>") ||
    lowerText.includes("<searchrealpapers>") ||
    lowerText.includes("</searchrealpapers>");

  if (!hasTag) {
    return {
      thought: "",
      chat: text.trim(),
      title: "",
      replaceContent: "",
      searchRealPapersQuery: "",
    };
  }

  // 1. Parse <thought>
  const thoughtStartTagIdx = lowerText.indexOf("<thought>");
  let thoughtStartIdx = thoughtStartTagIdx !== -1 ? thoughtStartTagIdx + 9 : -1;
  if (thoughtStartIdx === -1 && lowerText.trim().length > 0) {
    const firstTagIdx = Math.min(
      lowerText.indexOf("<chat>") !== -1
        ? lowerText.indexOf("<chat>")
        : Infinity,
      lowerText.indexOf("<title>") !== -1
        ? lowerText.indexOf("<title>")
        : Infinity,
      lowerText.indexOf("<replacecontent>") !== -1
        ? lowerText.indexOf("<replacecontent>")
        : Infinity,
    );
    if (firstTagIdx > 0 && firstTagIdx !== Infinity) {
      thoughtStartIdx = 0;
    }
  }

  let thoughtEndIdx = -1;
  let chatStartSearchIdx = 0;

  if (thoughtStartIdx !== -1) {
    const thoughtEndTagIdx = lowerText.indexOf("</thought>", thoughtStartIdx);
    if (thoughtEndTagIdx !== -1) {
      thoughtEndIdx = thoughtEndTagIdx;
      chatStartSearchIdx = thoughtEndTagIdx + 10;
    } else {
      const chatTagIdx = lowerText.indexOf("<chat>", thoughtStartIdx);
      if (chatTagIdx !== -1) {
        thoughtEndIdx = chatTagIdx;
        chatStartSearchIdx = chatTagIdx;
      } else {
        // Still inside thought block, no chat/title tags should be parsed yet!
        thought = text.substring(thoughtStartIdx).trim();
        return {
          thought,
          chat: "",
          title: "",
          replaceContent: "",
          searchRealPapersQuery: "",
        };
      }
    }

    thought = text.substring(thoughtStartIdx, thoughtEndIdx).trim();
  }

  // 2. Parse <chat>
  const chatStartTagIdx = lowerText.indexOf("<chat>", chatStartSearchIdx);
  let chatStartIdx = chatStartTagIdx !== -1 ? chatStartTagIdx + 6 : -1;

  if (chatStartIdx === -1 && chatStartSearchIdx >= 0) {
    const nextTagIdx = Math.min(
      lowerText.indexOf("<title>", chatStartSearchIdx) !== -1
        ? lowerText.indexOf("<title>", chatStartSearchIdx)
        : Infinity,
      lowerText.indexOf("<replacecontent>", chatStartSearchIdx) !== -1
        ? lowerText.indexOf("<replacecontent>", chatStartSearchIdx)
        : Infinity,
    );
    if (nextTagIdx !== Infinity && nextTagIdx > chatStartSearchIdx) {
      chatStartIdx = chatStartSearchIdx;
    } else if (nextTagIdx === Infinity) {
      chatStartIdx = chatStartSearchIdx;
    }
  }

  let chatEndIdx = -1;
  let titleStartSearchIdx = chatStartSearchIdx;

  const stripSearchTags = (str: string) => {
    let res = str;
    const idx = res.toLowerCase().indexOf("<searchrealpapers");
    if (idx !== -1) res = res.substring(0, idx).trim();
    const idx2 = res.toLowerCase().indexOf("<calleditoragent");
    if (idx2 !== -1) res = res.substring(0, idx2).trim();
    return res;
  };

  if (chatStartIdx !== -1) {
    const chatEndTagIdx = lowerText.indexOf("</chat>", chatStartIdx);
    if (chatEndTagIdx !== -1) {
      chatEndIdx = chatEndTagIdx;
      titleStartSearchIdx = chatEndTagIdx + 7;
    } else {
      // If </chat> is missing, but they started a <title> or <replacecontent> or <searchrealpapers>,
      // we can use those as the end of the chat!
      const titleTagIdx = lowerText.indexOf("<title>", chatStartIdx);
      const contentTagIdx = lowerText.indexOf("<replacecontent>", chatStartIdx);
      const paperTagIdx = lowerText.indexOf("<searchrealpapers>", chatStartIdx);
      const callAgentTagIdx = lowerText.indexOf("<calleditoragent>", chatStartIdx);

      const candidates = [titleTagIdx, contentTagIdx, paperTagIdx, callAgentTagIdx].filter(
        (idx) => idx !== -1,
      );

      if (candidates.length > 0) {
        chatEndIdx = Math.min(...candidates);
        titleStartSearchIdx = chatEndIdx;
      } else {
        // If we haven't reached the </chat> tag yet, we shouldn't attempt
        // to parse any following <title> or <replacecontent> blocks because we are still
        // actively streaming the chat segment. This prevents any mentioned markdown tags in conversational text.
        chat = text.substring(chatStartIdx).trim();
        chat = stripSearchTags(chat);

        // Clean any leaking unclosed tags from streaming chat in progress
        chat = chat
          .replace(
            /<(title|replacecontent|searchrealpapers|thought|calleditoragent)[\s\S]*/gi,
            "",
          )
          .trim();
        return {
          thought,
          chat,
          title: "",
          replaceContent: "",
          searchRealPapersQuery: "",
        };
      }
    }

    chat = text.substring(chatStartIdx, chatEndIdx).trim();
    chat = stripSearchTags(chat);
  }

  // 3. Parse <title> and <replacecontent> starting from after the chat block ends
  const titleStartTagIdx = lowerText.indexOf("<title>", titleStartSearchIdx);
  const titleStartIdx = titleStartTagIdx !== -1 ? titleStartTagIdx + 7 : -1;

  let titleEndIdx = -1;
  let contentStartSearchIdx = titleStartSearchIdx;

  if (titleStartIdx !== -1) {
    const titleEndTagIdx = lowerText.indexOf("</title>", titleStartIdx);
    if (titleEndTagIdx !== -1) {
      titleEndIdx = titleEndTagIdx;
      contentStartSearchIdx = titleEndTagIdx + 8;
    } else {
      const contentTagIdx = lowerText.indexOf(
        "<replacecontent>",
        titleStartIdx,
      );
      if (contentTagIdx !== -1) {
        titleEndIdx = contentTagIdx;
        contentStartSearchIdx = contentTagIdx;
      }
    }

    if (titleEndIdx !== -1) {
      title = text.substring(titleStartIdx, titleEndIdx).trim();
    } else {
      title = text.substring(titleStartIdx).trim();
    }
  }

  const contentStartTagIdx = lowerText.indexOf(
    "<replacecontent>",
    contentStartSearchIdx,
  );
  const contentStartIdx =
    contentStartTagIdx !== -1 ? contentStartTagIdx + 16 : -1;
  if (contentStartIdx !== -1) {
    const contentEndTagIdx = lowerText.indexOf(
      "</replacecontent>",
      contentStartIdx,
    );
    if (contentEndTagIdx !== -1) {
      replaceContent = text.substring(contentStartIdx, contentEndTagIdx).trim();
      const followUpText = text.substring(contentEndTagIdx + 17).trim();
      if (followUpText) {
        chat = chat + "\n\n" + followUpText;
      }
    } else {
      replaceContent = text.substring(contentStartIdx).trim();
    }
  }

  // 4. Parse <searchRealPapers>
  const paperStartTagIdx = lowerText.lastIndexOf("<searchrealpapers>");
  if (paperStartTagIdx !== -1) {
    const paperStartIdx = paperStartTagIdx + 18;
    const paperEndTagIdx = lowerText.indexOf(
      "</searchrealpapers>",
      paperStartIdx,
    );
    if (paperEndTagIdx !== -1) {
      searchRealPapersQuery = text
        .substring(paperStartIdx, paperEndTagIdx)
        .trim();
    } else {
      searchRealPapersQuery = text.substring(paperStartIdx).trim();
    }
  }

  // Fallback: If it's still containing XML tags due to LLM hallucinations:
  if (searchRealPapersQuery && searchRealPapersQuery.includes("<")) {
    searchRealPapersQuery = searchRealPapersQuery
      .replace(/<[^>]*>?/gm, "")
      .trim();
  }
  if (searchRealPapersQuery.length > 100) {
    searchRealPapersQuery = searchRealPapersQuery.substring(0, 100);
  }

  // Clean any hallucinated or unclosed tags from chat, title, and replaceContent
  if (chat) {
    const srIdx = chat.toLowerCase().indexOf("<searchrealpapers>");
    if (srIdx !== -1) {
      chat = chat.substring(0, srIdx).trim();
    }
    chat = chat
      .replace(
        /<\/?(title|replacecontent|searchrealpapers|thought|chat)[^>]*>?/gi,
        "",
      )
      .trim();
  }

  if (title) {
    title = title
      .replace(
        /<\/?(title|replacecontent|searchrealpapers|thought|chat)[^>]*>?/gi,
        "",
      )
      .trim();
  }

  if (replaceContent) {
    replaceContent = replaceContent
      .replace(/<\/replacecontent>[\s\S]*/gi, "")
      .trim();
    replaceContent = replaceContent
      .replace(
        /<\/?(title|replacecontent|searchrealpapers|thought|chat)[^>]*>?/gi,
        "",
      )
      .trim();
  }

  return { thought, chat, title, replaceContent, searchRealPapersQuery };
};

const extractTextFromPdf = async (url: string): Promise<string> => {
  try {
    let pdfUrlToLoad = url;

    // Only download if it's an external URL (starts with http)
    if (url.startsWith("http")) {
      const response = await fetch("/api/research/download-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      pdfUrlToLoad = `/api/files/${data.fileId}`;
    }

    const response = await fetch(pdfUrlToLoad);
    if (!response.ok)
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();

    // Quick validation of PDF header
    const header = new TextDecoder().decode(
      new Uint8Array(arrayBuffer.slice(0, 4)),
    );
    if (!header.startsWith("%PDF")) {
      const sample = new TextDecoder().decode(
        new Uint8Array(arrayBuffer.slice(0, 10)),
      );
      console.warn(
        `File is not a valid PDF. Expected %PDF, got: '${header}'. Sample: '${sample}'. Falling back to raw text/HTML extraction.`,
      );

      const fileIdMatch = pdfUrlToLoad.match(/\/api\/files\/([^\/]+)/);
      if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        try {
          const rawTextRes = await fetch(`/api/files/${fileId}/raw-text`);
          if (rawTextRes.ok) {
            const rawTextData = await rawTextRes.json();
            if (rawTextData.success && rawTextData.text) {
              let cleanText = rawTextData.text;
              if (
                cleanText.toLowerCase().includes("<html") ||
                cleanText.toLowerCase().includes("<!doctype")
              ) {
                cleanText = cleanText
                  .replace(
                    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                    "",
                  )
                  .replace(
                    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
                    "",
                  )
                  .replace(/<[^>]+>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
              }
              return cleanText;
            }
          }
        } catch (e) {
          console.error("Failed raw-text fallback fetch:", e);
        }
      }

      // Final fallback: decode arrayBuffer directly as UTF-8 string
      try {
        let cleanText = new TextDecoder().decode(arrayBuffer);
        if (
          cleanText.toLowerCase().includes("<html") ||
          cleanText.toLowerCase().includes("<!doctype")
        ) {
          cleanText = cleanText
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }
        return cleanText;
      } catch (decodeErr) {
        console.error("Failed arrayBuffer string decode:", decodeErr);
      }
      return "";
    }

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
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || "")
        .join(" ");
      fullText += `--- Page ${pageNum} of ${pdfDoc.numPages} ---\n${pageText}\n\n`;
    }
    return fullText;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    return "";
  }
};

const cleanJsonLeakFront = (text: string): string => {
  if (!text) return "";
  let clean = text.trim();

  // If the text starts with markdown block
  if (clean.startsWith("```")) {
    clean = clean
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  // Check if it has hallmarks of raw json
  if (
    clean.includes('":') ||
    clean.includes('",') ||
    clean.includes('{"') ||
    clean.includes('"}') ||
    clean.includes('"],') ||
    clean.includes('"]}') ||
    clean.includes("} }")
  ) {
    clean = clean.replace(/",\s*"[a-zA-Z0-9_]+"\s*:\s*\{/g, "\n\n");
    clean = clean.replace(/",\s*"[a-zA-Z0-9_]+"\s*:\s*\[/g, "\n\n");
    clean = clean.replace(/",\s*"[a-zA-Z0-9_]+"\s*:\s*"/g, "\n\n");
    clean = clean.replace(/",\s*"[a-zA-Z0-9_]+"\s*:\s*/g, "\n\n");

    clean = clean.replace(/[\{\}\[\]]/g, " ");

    clean = clean.replace(/"[a-zA-Z0-9_]+"\s*:\s*"/g, " ");
    clean = clean.replace(/"[a-zA-Z0-9_]+"\s*:\s*/g, " ");

    clean = clean.replace(/"\s*,\s*"/g, "\n\n");
    clean = clean.replace(/"\s*:\s*"/g, ": ");

    clean = clean.replace(/([^\w])"([^\w])/g, "$1$2");

    if (clean.startsWith('"') && clean.endsWith('"')) {
      clean = clean.substring(1, clean.length - 1);
    }

    clean = clean.replace(/\r/g, "");
    clean = clean.replace(/\n{3,}/g, "\n\n");
    clean = clean.replace(/[ \t]+/g, " ");
  }

  return clean.trim();
};

const PDF_CACHE_NAME = "rapid-pdf-cache-v1";

const preCachePdfFile = async (fileId: string, blob: Blob) => {
  const fileUrl = `/api/files/${fileId}`;
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await window.caches.open(PDF_CACHE_NAME);
      const response = new Response(blob, {
        headers: { "Content-Type": "application/pdf" },
      });
      await cache.put(fileUrl, response);
      console.log(`Pre-cached uploaded/received PDF ${fileId} in Cache Storage.`);
    } catch (e) {
      console.warn("Failed to pre-cache PDF response in Cache Storage:", e);
    }
  }

  if (typeof window !== "undefined") {
    const win = window as any;
    if (!win.__pdfMemoryCache) {
      win.__pdfMemoryCache = new Map();
    }
    const blobUrl = URL.createObjectURL(blob);
    win.__pdfMemoryCache.set(fileId, blobUrl);
  }
};

const getOrCreateCachedPdf = async (fileId: string): Promise<string> => {
  const fileUrl = `/api/files/${fileId}`;

  // 1. First check the local session memory cache URL mapped directly
  if (typeof window !== "undefined") {
    const win = window as any;
    if (!win.__pdfMemoryCache) {
      win.__pdfMemoryCache = new Map();
    }
    const memCache = win.__pdfMemoryCache;
    if (memCache.has(fileId)) {
      return memCache.get(fileId)!;
    }
  }

  // 2. Next check browser's persistent Cache Storage API
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await window.caches.open(PDF_CACHE_NAME);
      const cachedResponse = await cache.match(fileUrl);
      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        const objUrl = URL.createObjectURL(blob);
        const win = window as any;
        if (win.__pdfMemoryCache) {
          win.__pdfMemoryCache.set(fileId, objUrl);
        }
        return objUrl;
      }

      // If not cached persistently, fetch, cache, and return local object URL
      const response = await fetch(fileUrl);
      if (response.ok) {
        // Save a clone to Cache Storage for next time
        await cache.put(fileUrl, response.clone());
        const blob = await response.blob();
        const objUrl = URL.createObjectURL(blob);
        const win = window as any;
        if (win.__pdfMemoryCache) {
          win.__pdfMemoryCache.set(fileId, objUrl);
        }
        return objUrl;
      }
    } catch (e) {
      console.warn("Cache Storage API error/fallback to standard fetch:", e);
    }
  }

  // 3. Fallback to direct network URL if all local disk/blob helpers fail
  return fileUrl;
};


const formatAbstractText = (text: string) => {
  if (!text) return "";
  const cleanedText = cleanJsonLeakFront(text);
  let cleanText = cleanedText.replace(/^Abstract\s*[:\-]*\s*/i, "").trim();
  if (cleanText.includes("\n\n")) return cleanText;

  // Protect common abbreviations by temporarily replacing their periods
  const protectedText = cleanText
    .replace(
      /\b(Mr|Mrs|Ms|Dr|Prof|Rev|Hon|St|Assoc)\.(\s+)/g,
      "$1_PROTECTED_DOT_$2",
    )
    .replace(/\b(e\.g|i\.e|etc|vs|al)\.(\s+)/g, "$1_PROTECTED_DOT_$2")
    .replace(/([A-Z])\.(\s+)([A-Z])/g, "$1_PROTECTED_DOT_$2$3"); // Protect initials like "Julius D. Selle"

  // Split on punctuation followed by a space and a capital letter
  const parts = protectedText.split(/([.!?]+)\s+(?=[A-Z])/);
  if (!parts || parts.length <= 8) return cleanText;

  let formatted = "";
  let sentenceCount = 0;

  for (let i = 0; i < parts.length; i += 2) {
    const textPart = parts[i];
    const punctuation = parts[i + 1] || "";

    formatted += textPart + punctuation + " ";
    sentenceCount++;

    if (sentenceCount % 4 === 0 && i < parts.length - 2) {
      formatted += "\n\n";
    }
  }

  // Restore the protected abbreviations
  formatted = formatted.replace(/_PROTECTED_DOT_/g, ".");

  return formatted.trim();
};

export default function App() {
  const isReadOnly = false;
  const isElectronApp = typeof window !== 'undefined' && (
    (window as any).electron !== undefined || 
    navigator.userAgent.toLowerCase().includes('electron') ||
    (window as any).ipcRenderer !== undefined ||
    (window as any).process?.versions?.electron !== undefined
  );
  const cleanTitleStr = (t?: string) =>
    t ? t.replace(/[*#]/g, "").trim() : "";

  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  const [showBuyCoffeeModal, setShowBuyCoffeeModal] = useState(false);
  const [supportAmountPaid, setSupportAmountPaid] = useState<string | null>(
    null,
  );
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<
    "files" | "chats" | "tools" | "library"
  >("files");

  const [activeToolsTab, setActiveToolsTab] = useState<
    "slovin" | "percentage" | "weighted" | "likert" | "ai" | "citation"
  >("slovin");
  const [isStatsSectionOpen, setIsStatsSectionOpen] = useState(true);
  const [isHistorySectionOpen, setIsHistorySectionOpen] = useState(true);

  const openToolsTab = (
    toolType:
      | "slovin"
      | "percentage"
      | "weighted"
      | "likert"
      | "ai"
      | "citation",
  ) => {
    setActiveToolsTab(toolType);
    const toolsTab = tabs.find((t) => t.type === "tools");
    if (!toolsTab) {
      const newId = `tools-${Date.now()}`;
      setTabs((prev) => [
        ...prev,
        { id: newId, type: "tools", title: "Statistics Tools" },
      ]);
      setActiveTabId(newId);
    } else {
      setActiveTabId(toolsTab.id);
    }
  };

  const [toolsHistory, setToolsHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("toolsHistory");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedToolsHistoryItem, setSelectedToolsHistoryItem] = useState<
    any | null
  >(null);

  const addToolsHistoryItem = (item: any) => {
    const newItem = {
      ...item,
      id: `tool-hist-${Date.now()}`,
      timestamp: Date.now(),
    };
    setToolsHistory((prev) => {
      // Avoid duplicate computations with active parameters
      const filtered = prev.filter(
        (p) =>
          !(
            p.type === item.type &&
            JSON.stringify(p.parameters) === JSON.stringify(item.parameters)
          ),
      );
      const updated = [newItem, ...filtered].slice(0, 30);
      try {
        localStorage.setItem("toolsHistory", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save tools history to localStorage:", e);
      }
      return updated;
    });
  };

  const deleteToolsHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setToolsHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem("toolsHistory", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to update tools history in localStorage:", err);
      }
      return updated;
    });
    if (selectedToolsHistoryItem?.id === id) {
      setSelectedToolsHistoryItem(null);
    }
  };

  const loadToolsHistoryItem = (item: any) => {
    setSelectedToolsHistoryItem(item);
    setActiveToolsTab(item.type);

    // Select the active tools tab or insert a new tab of type tools
    const toolsTab = tabs.find((t) => t.type === "tools");
    if (!toolsTab) {
      const newId = `tools-${Date.now()}`;
      setTabs((prev) => [
        ...prev,
        { id: newId, type: "tools", title: "Statistics Tools" },
      ]);
      setActiveTabId(newId);
    } else {
      setActiveTabId(toolsTab.id);
    }
    setSidebarView("tools");
  };

  // Tab Management
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      const cached = localStorage.getItem(`cosmi_tabs_${uid}`);
      return cached
        ? JSON.parse(cached)
        : [{ id: "initial-home", type: "home", title: "Home" }];
    } catch {
      return [{ id: "initial-home", type: "home", title: "Home" }];
    }
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      const cached = localStorage.getItem(`cosmi_activeTabId_${uid}`);
      return cached || "initial-home";
    } catch {
      return "initial-home";
    }
  });
  const [activeAssistantTabId, setActiveAssistantTabId] = useState<
    string | null
  >(null);
  const ignoreNextTabSyncRef = useRef(false);
  const loadedTabIdRef = useRef<string>("initial-home");
  const activeTabIdRef = useRef(activeTabId);
  const activeAssistantTabIdRef = useRef(activeAssistantTabId);
  const tabsRef = useRef(tabs);
  const activeTab = React.useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId],
  );

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    activeAssistantTabIdRef.current = activeAssistantTabId;
  }, [activeAssistantTabId]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  // Editor Styles and Customizations
  const [editorFont, setEditorFont] = useState("font-jakarta");
  const [editorFontSize, setEditorFontSize] = useState(18);
  const [currentSelectionSize, setCurrentSelectionSize] = useState(18);
  const [editorAlign, setEditorAlign] = useState<
    "left" | "center" | "right" | "justify"
  >("left");
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isMoreToolsOpen, setIsMoreToolsOpen] = useState(false);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [tableGrid, setTableGrid] = useState({ r: 0, c: 0 });
  
  // Chart creation modal state
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [chartTitle, setChartTitle] = useState("");
  const [chartDataColor, setChartDataColor] = useState<string>("blue");
  const [chartLabels, setChartLabels] = useState<string[]>(["Group A", "Group B", "Group C", "Group D"]);
  const [chartValues, setChartValues] = useState<number[]>([45, 60, 30, 50]);
  const [chartIndividualColors, setChartIndividualColors] = useState<string[]>([]);
  const [openRowColorPickerIdx, setOpenRowColorPickerIdx] = useState<number | null>(null);
  const [chartBeingEdited, setChartBeingEdited] = useState<HTMLElement | null>(null);

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Tab deletion confirmation modal state
  const [tabIdToDelete, setTabIdToDelete] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Link and Table context menu and rename modal state
  const [linkContextMenu, setLinkContextMenu] = useState<{
    x: number;
    y: number;
    target: HTMLAnchorElement;
  } | null>(null);
  const [tableContextMenu, setTableContextMenu] = useState<{
    x: number;
    y: number;
    target: HTMLTableElement;
    cell: HTMLTableCellElement | null;
  } | null>(null);
  const [chartContextMenu, setChartContextMenu] = useState<{
    x: number;
    y: number;
    target: HTMLElement;
  } | null>(null);
  const [showLinkRenameModal, setShowLinkRenameModal] = useState(false);
  const [linkToRename, setLinkToRename] = useState<{
    target: HTMLAnchorElement;
    initialText: string;
    initialUrl: string;
  } | null>(null);
  const [renameText, setRenameText] = useState("");
  const [renameUrl, setRenameUrl] = useState("");

  // Library toolbar and interaction states
  const [selectedPapers, setSelectedPapers] = useState<string[]>([]);
  const [displayDensity, setDisplayDensity] = useState<
    "comfortable" | "compact"
  >("comfortable");
  const [sortBy, setSortBy] = useState<"title" | "added" | "viewed">("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [isDisplayDropdownOpen, setIsDisplayDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isHomeCreateDropdownOpen, setIsHomeCreateDropdownOpen] =
    useState(false);
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const [isChatDropdownOpen, setIsChatDropdownOpen] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [isRenamingChat, setIsRenamingChat] = useState<string | null>(null);
  const [renamingChatText, setRenamingChatText] = useState("");

  const handleRenameChat = (e: React.KeyboardEvent | React.FocusEvent) => {
    if ("key" in e && e.key !== "Enter" && e.key !== "Escape") return;

    if (isRenamingChat) {
      if (!("key" in e) || e.key === "Enter") {
        const newTitle = renamingChatText.trim() || "Untitled";
        setTabs(
          tabs.map((t) =>
            t.id === isRenamingChat ? { ...t, title: newTitle } : t,
          ),
        );
        showToast(`Chat renamed to "${newTitle}"`, "success");
      }
      setIsRenamingChat(null);
    }
  };

  const requestDeleteTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isElectronApp) {
      setTabIdToDelete(id);
      setIsDeleteConfirmOpen(true);
    } else {
      deleteTab(id);
    }
  };

  const deleteTab = async (id: string) => {
    const closedTab = tabs.find((t) => t.id === id);
    const closedTitle = closedTab ? closedTab.title : "Tab";

    if (tabs.length <= 1 && tabs[0].id === id) {
      const newId = `chat-${Date.now()}`;
      setTabs([{ id: newId, type: "chat", title: "Untitled" }]);
      setActiveTabId(newId);
      setActiveAssistantTabId(newId);
      setMessages([]);
    } else {
      const updatedTabs = tabs.filter((t) => t.id !== id);
      const tabToDeleteIndex = tabs.findIndex((t) => t.id === id);
      setTabs(updatedTabs);

      if (activeTabId === id) {
        const nextTab =
          updatedTabs[tabToDeleteIndex] ||
          updatedTabs[tabToDeleteIndex - 1] ||
          updatedTabs[0];
        setActiveTabId(nextTab.id);
      }

      if (activeAssistantTabId === id) {
        const nextAssistantTab = updatedTabs.find((t) => t.type === "chat");
        if (nextAssistantTab) {
          setActiveAssistantTabId(nextAssistantTab.id);
          setMessages(nextAssistantTab.messages || []);
        } else {
          setActiveAssistantTabId(null);
          setMessages([]);
        }
      }
    }

    showToast(`Closed "${closedTitle}"`, "info");

    const uid = currentUser ? currentUser.uid : "guest";
    if (currentUser && storageMode === "database") {
      const path = `users/${currentUser.uid}/chats/${id}`;
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "chats", id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    } else {
      setAllChats((prev) => {
        const next = prev.filter((c) => c.id !== id);
        localStorage.setItem(`cosmi_chats_${uid}`, JSON.stringify(next));
        return next;
      });
    }
    setIsChatMenuOpen(false);
    setIsAssistantChatDropdownOpen(false);
  };
  const [isAssistantChatDropdownOpen, setIsAssistantChatDropdownOpen] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [currentPdfPage, setCurrentPdfPage] = useState<number>(1);
  const [pdfScale, setPdfScale] = useState<number>(1);
  const [pdfViewMode, setPdfViewMode] = useState<Record<string, "pdf" | "overview">>({});
  const [activePdfBlobUrl, setActivePdfBlobUrl] = useState<string | null>(null);
  const [isBlobLoading, setIsBlobLoading] = useState<boolean>(false);
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedLinkType, setGeneratedLinkType] = useState<
    "workspace" | "library" | null
  >(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [addDropdownNested, setAddDropdownNested] = useState<string | null>(
    null,
  );
  const [newPaperTitle, setNewPaperTitle] = useState("");
  const [newPaperAuthors, setNewPaperAuthors] = useState("");
  const [newPaperType, setNewPaperType] = useState<"Note" | "Document">(
    "Document",
  );
  const [newPaperDescription, setNewPaperDescription] = useState("");

  // Link summarizer states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [importType, setImportType] = useState<
    "url" | "gdoc" | "youtube" | null
  >(null);
  const [importUrl, setImportUrl] = useState("");
  const [isAnalyzingLink, setIsAnalyzingLink] = useState(false);
  const [linkAnalyzeStatus, setLinkAnalyzeStatus] = useState("");
  const [linkAnalyzeError, setLinkAnalyzeError] = useState("");
  const [activeViewingPaper, setActiveViewingPaper] =
    useState<PaperItem | null>(null);

  const handleLinkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;

    setIsAnalyzingLink(true);
    setLinkAnalyzeError("");
    setLinkAnalyzeStatus("Locating source address and resolving hostname...");

    const step1 = setTimeout(() => {
      setLinkAnalyzeStatus(
        "Fetching public content and stripping raw templates...",
      );
    }, 1500);

    const step2 = setTimeout(() => {
      setLinkAnalyzeStatus(
        "Sending text stream to Gemini API for literature review synthesis...",
      );
    }, 4500);

    try {
      const response = await fetch("/api/research/summarize-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl, type: importType }),
      });

      clearTimeout(step1);
      clearTimeout(step2);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze that URL.");
      }

      const resData = await response.json();
      if (resData.success && resData.data) {
        const withFolder = {
          ...resData.data,
          folderId: selectedFolderId || folders[0]?.id || "f1",
        };
        dbSetPaper(withFolder);
        setImportModalOpen(false);
        setImportUrl("");
        setLinkAnalyzeStatus("");
        setActiveViewingPaper(withFolder);

        // Auto-create and switch to a new document tab with the synthesized content
        const newTabId = `link-${Date.now()}`;
        const initialContent = markdownToHtml(
          resData.data.summary || resData.data.description || "",
        );
        setTabs((prev) => [
          ...prev,
          {
            id: newTabId,
            type: "document",
            title: resData.data.title,
            content: initialContent,
          },
        ]);
        setActiveTabId(newTabId);
      } else {
        throw new Error(
          "Link parsing completed, but returned empty synthesis data.",
        );
      }
    } catch (err: any) {
      console.error(err);
      clearTimeout(step1);
      clearTimeout(step2);
      setLinkAnalyzeError(
        err.message ||
          "An unexpected failure occurred while analyzing this link.",
      );
    } finally {
      setIsAnalyzingLink(false);
    }
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      setLinkContextMenu(null);
      setTableContextMenu(null);
      setPdfContextMenu(null);
      setIsCreateDropdownOpen(false);
      setIsHomeCreateDropdownOpen(false);
      setIsDisplayDropdownOpen(false);
      setIsSortDropdownOpen(false);
      setIsFilterDropdownOpen(false);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (activeTab && activeTab.fileId && activeTab.mimetype === "application/pdf") {
      setIsBlobLoading(true);
      getOrCreateCachedPdf(activeTab.fileId)
        .then((blobUrl) => {
          if (active) {
            setActivePdfBlobUrl(blobUrl);
            setIsBlobLoading(false);
          }
        })
        .catch((err) => {
          console.error("Local caching PDF load error:", err);
          if (active) {
            setActivePdfBlobUrl(`/api/files/${activeTab.fileId}`);
            setIsBlobLoading(false);
          }
        });
    } else {
      setActivePdfBlobUrl(null);
      setIsBlobLoading(false);
    }
    return () => {
      active = false;
    };
  }, [activeTab?.fileId, activeTab?.mimetype]);

  const editorRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef("");
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const parentNode = range.commonAncestorContainer.parentElement;

        if (parentNode) {
          const parentStyle = window.getComputedStyle(parentNode);
          const sizeStr = parentStyle.fontSize;
          if (sizeStr) {
            const parsed = parseInt(sizeStr);
            if (!isNaN(parsed)) {
              setCurrentSelectionSize(parsed);
              return;
            }
          }
        }
      }
      setCurrentSelectionSize(editorFontSize);
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, [editorFontSize]);

  const changeSelectedFontSize = (increase: boolean) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    if (selection.isCollapsed) {
      setEditorFontSize((prev) => {
        const next = increase ? prev + 1 : prev - 1;
        const clamped = Math.min(72, Math.max(12, next));
        setCurrentSelectionSize(clamped);
        return clamped;
      });
      return;
    }

    const currentSize = currentSelectionSize;
    const nextSize = increase ? currentSize + 1 : currentSize - 1;
    const clampedSize = Math.max(12, Math.min(72, nextSize));

    try {
      document.execCommand("styleWithCSS", false, "true");
      const tempFontName = `___fs_${Date.now()}___`;
      document.execCommand("fontName", false, tempFontName);

      const editor = editorRef.current;
      if (editor) {
        const selector = `font[face="${tempFontName}"], span[style*="font-family: ${tempFontName}"], span[style*='font-family: "${tempFontName}"']`;
        const targets = editor.querySelectorAll(selector);

        targets.forEach((el) => {
          const element = el as HTMLElement;
          element.style.fontFamily = "";
          element.removeAttribute("face");
          element.style.fontSize = `${clampedSize}px`;
          // ensure normal line height to prevent shifts
          element.style.lineHeight = "normal";
        });
      }

      setCurrentSelectionSize(clampedSize);
    } catch (e) {
      console.error("Font resize failed:", e);
      setEditorFontSize((prev) => (increase ? prev + 1 : prev - 1));
    }

    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastContentRef.current = html;
      setDocumentContent(html);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
      );
    }
  };

  const pushToUndo = () => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === activeTabId) {
          const undoStack = t.undoStack || [];
          if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== currentHtml) {
            return {
              ...t,
              undoStack: [...undoStack.slice(-99), currentHtml],
              redoStack: [], // Clear redo stack on key change
            };
          }
        }
        return t;
      })
    );
  };

  const handleUndo = () => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    let targetHtml: string | null = null;
    
    setTabs((prev) => {
      const currentTab = prev.find((t) => t.id === activeTabId);
      if (!currentTab) return prev;
      const undoStack = currentTab.undoStack || [];
      if (undoStack.length === 0) {
        return prev;
      }
      const previousHtml = undoStack[undoStack.length - 1];
      targetHtml = previousHtml;
      const newUndoStack = undoStack.slice(0, -1);
      const redoStack = currentTab.redoStack || [];
      const newRedoStack = [...redoStack, currentHtml];
      
      return prev.map((t) =>
        t.id === activeTabId
          ? { ...t, content: previousHtml, undoStack: newUndoStack, redoStack: newRedoStack }
          : t
      );
    });

    if (targetHtml !== null) {
      editorRef.current.innerHTML = targetHtml;
      lastContentRef.current = targetHtml;
      setDocumentContent(targetHtml);
      setDocSaveStatus("saving");
    } else {
      document.execCommand("undo");
    }
  };

  const handleRedo = () => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    let targetHtml: string | null = null;

    setTabs((prev) => {
      const currentTab = prev.find((t) => t.id === activeTabId);
      if (!currentTab) return prev;
      const redoStack = currentTab.redoStack || [];
      if (redoStack.length === 0) {
        return prev;
      }
      const nextHtml = redoStack[redoStack.length - 1];
      targetHtml = nextHtml;
      const newRedoStack = redoStack.slice(0, -1);
      const undoStack = currentTab.undoStack || [];
      const newUndoStack = [...undoStack, currentHtml];

      return prev.map((t) =>
        t.id === activeTabId
          ? { ...t, content: nextHtml, undoStack: newUndoStack, redoStack: newRedoStack }
          : t
      );
    });

    if (targetHtml !== null) {
      editorRef.current.innerHTML = targetHtml;
      lastContentRef.current = targetHtml;
      setDocumentContent(targetHtml);
      setDocSaveStatus("saving");
    } else {
      document.execCommand("redo");
    }
  };

  const handleFormat = (command: string, value?: string) => {
    if (command === "undo") {
      handleUndo();
      return;
    }
    if (command === "redo") {
      handleRedo();
      return;
    }
    pushToUndo();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastContentRef.current = html;
      setDocumentContent(html);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
      );
    }
  };

  const handleInsertTable = (rows: number = 2, cols: number = 3) => {
    if (!editorRef.current) return;
    pushToUndo();
    
    // Ensure the editor has focus before trying selection
    if (document.activeElement !== editorRef.current) {
      editorRef.current.focus();
    }
    
    let thead = `<thead><tr style="background-color:#1a1a1c; border-bottom:1px solid #27272a;">`;
    for (let i = 0; i < cols; i++) {
        thead += `<th style="padding:10px 12px; text-align:left; font-weight:600; color:#e4e4e7; border-right:${i < cols - 1 ? '1px solid #27272a' : 'none'};">Header ${i + 1}</th>`;
    }
    thead += `</tr></thead>`;

    let tbody = `<tbody>`;
    for (let r = 0; r < rows; r++) {
        tbody += `<tr style="border-bottom:${r < rows - 1 ? '1px solid #27272a' : 'none'};">`;
        for (let c = 0; c < cols; c++) {
            tbody += `<td style="padding:10px 12px; color:#d4d4d8; border-right:${c < cols - 1 ? '1px solid #27272a' : 'none'};">Row ${r + 1}, Cell ${c + 1}</td>`;
        }
        tbody += `</tr>`;
    }
    tbody += `</tbody>`;

    const tableHTML = `<table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:13px; border:1px solid #27272a; border-radius:8px; overflow:hidden;">${thead}${tbody}</table><p><br></p>`;
    
    let success = false;
    try {
      success = document.execCommand("insertHTML", false, tableHTML);
    } catch (e) {
      console.warn("execCommand failed:", e);
    }
    
    // Fallback if execCommand fails (e.g. no selection range or unsupported)
    if (!success) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Ensure range is within our editor
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          const el = document.createElement("div");
          el.innerHTML = tableHTML;
          const frag = document.createDocumentFragment();
          let node, lastNode;
          while ((node = el.firstChild)) {
            lastNode = frag.appendChild(node);
          }
          range.insertNode(frag);
          if (lastNode) {
            range.setStartAfter(lastNode);
            range.setEndAfter(lastNode);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else {
          editorRef.current.innerHTML += tableHTML;
        }
      } else {
        editorRef.current.innerHTML += tableHTML;
      }
    }
    
    // Sync state
    const html = editorRef.current.innerHTML;
    lastContentRef.current = html;
    setDocumentContent(html);
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
    );
    setDocSaveStatus("saving");
  };

  const handleRemoveTable = () => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let node = selection.anchorNode as Node | null;
      let tableEl = null;
      while (node && node !== editorRef.current) {
        if (node.nodeName === "TABLE") {
          tableEl = node as HTMLTableElement;
          break;
        }
        node = node.parentNode;
      }
      if (tableEl) {
        tableEl.remove();
        // Sync state
        const html = editorRef.current.innerHTML;
        lastContentRef.current = html;
        setDocumentContent(html);
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
        );
        setDocSaveStatus("saving");
      }
    }
  };

  const handleInsertChart = () => {
    if (!editorRef.current) return;
    pushToUndo();
    
    // Filter out empty rows or invalid values
    const labels = chartLabels.map(l => l.trim() || "Item");
    const values = chartValues.map(v => isNaN(v) ? 0 : v);
    const maxVal = Math.max(...values, 1);

    // Color schemes that fit our clean visual design
    const schemeColors: Record<string, string[]> = {
      multicolor: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#f97316", "#6366f1"],
      emerald: ["#10b981", "#34d399", "#059669", "#a7f3d0", "#047857", "#065f46"],
      blue: ["#3b82f6", "#60a5fa", "#2563eb", "#bfdbfe", "#1d4ed8", "#1e40af"],
      purple: ["#8b5cf6", "#a78bfa", "#7c3aed", "#ddd6fe", "#6d28d9", "#5b21b6"],
      amber: ["#f59e0b", "#fbbf24", "#d97706", "#fde68a", "#b45309", "#92400e"],
      rose: ["#f43f5e", "#fb7185", "#e11d48", "#fecdd3", "#be123c", "#9f1239"],
      cyan: ["#06b6d4", "#22d3ee", "#0891b2", "#cffafe", "#0e7490", "#155e75"],
      orange: ["#f97316", "#fb923c", "#ea580c", "#ffedd5", "#c2410c", "#9a3412"],
      pink: ["#ec4899", "#f472b6", "#db2777", "#fce7f3", "#be185d", "#9d174d"],
      indigo: ["#6366f1", "#818cf8", "#4f46e5", "#e0e7ff", "#4338ca", "#3730a3"],
      slate: ["#64748b", "#94a3b8", "#475569", "#f1f5f9", "#334155", "#1e293b"],
      forest: ["#22c55e", "#4ade80", "#16a34a", "#dcfce7", "#15803d", "#14532d"]
    };

    const activeColors = schemeColors[chartDataColor] || schemeColors.blue;

    let svgContent = "";
    const width = 500;
    const height = 300;

    if (chartType === "bar") {
      const paddingLeft = 45;
      const paddingRight = 20;
      const paddingTop = 35;
      const paddingBottom = 40;
      const graphWidth = width - paddingLeft - paddingRight;
      const graphHeight = height - paddingTop - paddingBottom;

      // Grid lines
      const yTicks = 4;
      let gridLines = "";
      for (let i = 0; i <= yTicks; i++) {
        const y = paddingTop + (graphHeight * i) / yTicks;
        const gridVal = Math.round(maxVal - (maxVal * i) / yTicks);
        gridLines += `
          <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#27272a" stroke-dasharray="3,3" />
          <text x="${paddingLeft - 8}" y="${y + 4}" fill="#71717a" font-size="10" font-family="sans-serif" text-anchor="end">${gridVal}</text>
        `;
      }

      // Draw Bars
      const nBars = labels.length;
      const barSpacing = Math.min(24, graphWidth / (nBars * 2.5));
      const totalSpacingWidth = barSpacing * (nBars + 1);
      const remainingWidth = graphWidth - totalSpacingWidth;
      const barWidth = Math.max(16, remainingWidth / nBars);

      let bars = "";
      for (let i = 0; i < nBars; i++) {
        const val = values[i];
        const barHeight = (val / maxVal) * graphHeight;
        const x = paddingLeft + barSpacing + i * (barWidth + barSpacing);
        const y = paddingTop + graphHeight - barHeight;
        const color = (chartIndividualColors && chartIndividualColors[i]) || (chartDataColor === "multicolor" ? activeColors[i % activeColors.length] : activeColors[0]);

        bars += `
          <g>
            <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(2, barHeight)}" rx="4" fill="${color}" />
            <text x="${x + barWidth / 2}" y="${y - 6}" fill="#f4f4f5" font-size="10" font-family="sans-serif" font-weight="600" text-anchor="middle">${val}</text>
            <text x="${x + barWidth / 2}" y="${paddingTop + graphHeight + 16}" fill="#a1a1aa" font-size="10" font-family="sans-serif" text-anchor="middle">${labels[i]}</text>
          </g>
        `;
      }

      svgContent = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="display:block; background:transparent;">
          ${gridLines}
          ${bars}
        </svg>
      `;

    } else if (chartType === "line") {
      const paddingLeft = 45;
      const paddingRight = 20;
      const paddingTop = 35;
      const paddingBottom = 40;
      const graphWidth = width - paddingLeft - paddingRight;
      const graphHeight = height - paddingTop - paddingBottom;

      // Grid lines
      const yTicks = 4;
      let gridLines = "";
      for (let i = 0; i <= yTicks; i++) {
        const y = paddingTop + (graphHeight * i) / yTicks;
        const gridVal = Math.round(maxVal - (maxVal * i) / yTicks);
        gridLines += `
          <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#27272a" stroke-dasharray="3,3" />
          <text x="${paddingLeft - 8}" y="${y + 4}" fill="#71717a" font-size="10" font-family="sans-serif" text-anchor="end">${gridVal}</text>
        `;
      }

      const nPoints = labels.length;
      const stepX = nPoints > 1 ? graphWidth / (nPoints - 1) : graphWidth;

      const points = values.map((val, i) => {
        const x = paddingLeft + i * stepX;
        const y = paddingTop + graphHeight - (val / maxVal) * graphHeight;
        return { x, y, val, label: labels[i] };
      });

      // Path
      let pathD = "";
      let areaD = `M ${paddingLeft} ${paddingTop + graphHeight}`;

      if (points.length > 0) {
        pathD = `M ${points[0].x} ${points[0].y}`;
        areaD += ` L ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          pathD += ` L ${points[i].x} ${points[i].y}`;
          areaD += ` L ${points[i].x} ${points[i].y}`;
        }
        areaD += ` L ${points[points.length - 1].x} ${paddingTop + graphHeight} Z`;
      }

      const strokeColor = activeColors[0];
      const fillColor = chartDataColor === "multicolor" ? activeColors[1] || strokeColor : strokeColor;

      let markers = "";
      points.forEach((pt, i) => {
        const ptColor = (chartIndividualColors && chartIndividualColors[i]) || strokeColor;
        markers += `
          <g>
            <circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="${ptColor}" stroke="#121212" stroke-width="1.5" />
            <text x="${pt.x}" y="${pt.y - 8}" fill="#f4f4f5" font-size="10" font-family="sans-serif" font-weight="600" text-anchor="middle">${pt.val}</text>
            <text x="${pt.x}" y="${paddingTop + graphHeight + 16}" fill="#a1a1aa" font-size="10" font-family="sans-serif" text-anchor="middle">${pt.label}</text>
          </g>
        `;
      });

      svgContent = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="display:block; background:transparent;">
          ${gridLines}
          <path d="${areaD}" fill="${fillColor}" fill-opacity="0.12" />
          <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          ${markers}
        </svg>
      `;

    } else {
      // Pie Chart
      const cx = 180;
      const cy = 150;
      const r = 95;
      const cut = 55;

      const totalVal = values.reduce((a, b) => a + b, 0) || 1;
      let cumulativeAngle = 0;

      let slices = "";
      let legendItems = "";

      for (let i = 0; i < labels.length; i++) {
        const val = values[i];
        const pct = val / totalVal;
        const angle = pct * 360;

        const rad1 = (cumulativeAngle - 90) * (Math.PI / 180);
        const rad2 = (cumulativeAngle + angle - 90) * (Math.PI / 180);

        const x1_out = cx + r * Math.cos(rad1);
        const y1_out = cy + r * Math.sin(rad1);
        const x2_out = cx + r * Math.cos(rad2);
        const y2_out = cy + r * Math.sin(rad2);

        const x1_in = cx + cut * Math.cos(rad1);
        const y1_in = cy + cut * Math.sin(rad1);
        const x2_in = cx + cut * Math.cos(rad2);
        const y2_in = cy + cut * Math.sin(rad2);

        const largeArc = angle > 180 ? 1 : 0;
        const color = (chartIndividualColors && chartIndividualColors[i]) || activeColors[i % activeColors.length];

        let pathStr = "";
        if (pct >= 0.999) {
          pathStr = `
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${r - cut}" />
          `;
        } else {
          pathStr = `
            <path d="M ${x1_in} ${y1_in} L ${x1_out} ${y1_out} A ${r} ${r} 0 ${largeArc} 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${cut} ${cut} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z" fill="${color}" stroke="transparent" stroke-width="1.5" />
          `;
        }

        slices += pathStr;

        const midAngle = cumulativeAngle + angle / 2;
        const midRad = (midAngle - 90) * (Math.PI / 180);
        const tx = cx + (r * 0.75) * Math.cos(midRad);
        const ty = cy + (r * 0.75) * Math.sin(midRad);

        if (pct > 0.05) {
          slices += `<text x="${tx}" y="${ty + 4}" fill="#ffffff" font-size="9.5" font-family="sans-serif" font-weight="600" text-anchor="middle">${Math.round(pct * 100)}%</text>`;
        }

        legendItems += `
          <g transform="translate(0, ${i * 24})">
            <rect width="12" height="12" rx="3" fill="${color}" />
            <text x="20" y="10" fill="#f4f4f5" font-size="11.5" font-family="sans-serif" font-weight="500">${labels[i]}</text>
            <text x="135" y="10" fill="#71717a" font-size="11" font-family="sans-serif" text-anchor="end">${val} (${Math.round(pct * 100)}%)</text>
          </g>
        `;

        cumulativeAngle += angle;
      }

      svgContent = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="display:block; background:transparent;">
          ${slices}
          <circle cx="${cx}" cy="${cy}" r="${cut - 2}" fill="transparent" />
          <text x="${cx}" y="${cy - 3}" fill="#71717a" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="600" letter-spacing="0.5">TOTAL</text>
          <text x="${cx}" y="${cy + 11}" fill="#f4f4f5" font-size="15" font-family="sans-serif" text-anchor="middle" font-weight="700">${values.reduce((a, b) => a + b, 0)}</text>
          
          <g transform="translate(325, ${Math.max(40, 150 - (labels.length * 24) / 2)})">
            ${legendItems}
          </g>
        </svg>
      `;
    }

    const chartState = { chartType, chartTitle, chartDataColor, chartLabels, chartValues, chartIndividualColors };
    const encodedState = btoa(encodeURIComponent(JSON.stringify(chartState)));
    
    const chartWrapperHTML = `
      <div class="chart-embed-wrapper" data-chart-state="${encodedState}" contenteditable="false" style="display:block; margin:24px auto; max-width:540px; text-align:center;">
        ${svgContent}
      </div>
    `;
    const chartHTML = chartWrapperHTML + `<p><br></p>`;

    const targetChart = editorRef.current?.querySelector('[data-is-editing="true"]') as HTMLElement | null;

    if (targetChart) {
      const el = document.createElement("div");
      el.innerHTML = chartWrapperHTML;
      const frag = document.createDocumentFragment();
      while (el.firstChild) {
        frag.appendChild(el.firstChild);
      }
      targetChart.parentNode?.replaceChild(frag, targetChart);
    } else if (chartBeingEdited && chartBeingEdited.parentNode) {
      const el = document.createElement("div");
      el.innerHTML = chartWrapperHTML;
      const frag = document.createDocumentFragment();
      while (el.firstChild) {
        frag.appendChild(el.firstChild);
      }
      chartBeingEdited.parentNode.replaceChild(frag, chartBeingEdited);
    } else {
      if (document.activeElement !== editorRef.current) {
        editorRef.current.focus();
      }

      let success = false;
      try {
        success = document.execCommand("insertHTML", false, chartHTML);
      } catch (e) {
        console.warn("execCommand failed:", e);
      }

      if (!success) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (editorRef.current.contains(range.commonAncestorContainer)) {
            range.deleteContents();
            const el = document.createElement("div");
            el.innerHTML = chartHTML;
            const frag = document.createDocumentFragment();
            let node, lastNode;
            while ((node = el.firstChild)) {
              lastNode = frag.appendChild(node);
            }
            range.insertNode(frag);
            if (lastNode) {
              range.setStartAfter(lastNode);
              range.setEndAfter(lastNode);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          } else {
            editorRef.current.innerHTML += chartHTML;
          }
        } else {
          editorRef.current.innerHTML += chartHTML;
        }
      }
    }

    // Sync state
    const html = editorRef.current.innerHTML;
    lastContentRef.current = html;
    setDocumentContent(html);
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
    );
    setDocSaveStatus("saving");
    
    // Clean up temporary edit tokens
    if (editorRef.current) {
      editorRef.current.querySelectorAll('[data-is-editing="true"]').forEach((el) => {
        el.removeAttribute('data-is-editing');
      });
    }
    setChartBeingEdited(null);
    setIsChartModalOpen(false);
  };

  const closeChartModal = () => {
    if (editorRef.current) {
      editorRef.current.querySelectorAll('[data-is-editing="true"]').forEach((el) => {
        el.removeAttribute('data-is-editing');
      });
    }
    setChartBeingEdited(null);
    setIsChartModalOpen(false);
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.style.textAlign = editorAlign;
    }
  }, [editorAlign]);

  // Document Metadata State
  const [documentTitle, setDocumentTitle] = useState("");
  const [docSaveStatus, setDocSaveStatus] = useState<"saved" | "saving" | null>(
    "saved",
  );

  // PDF Annotation States
  const [selectionText, setSelectionText] = useState("");
  const [selectionPos, setSelectionPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pdfContextMenu, setPdfContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedPageNum, setSelectedPageNum] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [activeHighlightColor, setActiveHighlightColor] = useState("#fef08a");
  const [folderName, setFolderName] = useState("");
  const [savedNoteName, setSavedNoteName] = useState("");

  // Authentication & session loaded state
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const cached = localStorage.getItem("cosmi_user_snapshot");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Handle desktop deep linking callbacks (Electron & Tauri)
  useEffect(() => {
    let unsubscribeDeepLink: (() => void) | undefined;

    const setupDeepLinkListener = async () => {
      const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
      const isTauri = typeof window !== 'undefined' && ('___TAURI___' in window || (window as any).__TAURI__ !== undefined);

      if (isElectron && (window as any).electron?.onDeepLink) {
        console.log("Electron: Registering deep link listener");
        unsubscribeDeepLink = (window as any).electron.onDeepLink(async (urlStr: string) => {
          try {
            console.log("Electron received deep link:", urlStr);
            const url = new URL(urlStr);
            const token = url.searchParams.get('token');
            const googleIdToken = url.searchParams.get('id_token') || url.searchParams.get('googleIdToken');
            
            if (token) {
              const { signInWithCustomToken } = await import('firebase/auth');
              await signInWithCustomToken(auth, token);
              console.log("Electron authenticated successfully with custom token");
            } else if (googleIdToken) {
              const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
              const credential = GoogleAuthProvider.credential(googleIdToken);
              await signInWithCredential(auth, credential);
              console.log("Electron authenticated successfully with Google ID token");
            }
          } catch (err) {
            console.error("Electron deep link authentication error:", err);
          }
        });
      } else if (isTauri) {
        try {
          console.log("Tauri: Registering deep link listener");
          const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
          const unlisten = await onOpenUrl(async (urls) => {
            try {
              console.log("Tauri received deep link:", urls[0]);
              const url = new URL(urls[0]);
              const token = url.searchParams.get('token');
              if (token) {
                const { signInWithCustomToken } = await import('firebase/auth');
                await signInWithCustomToken(auth, token);
                console.log("Tauri authenticated successfully with custom token");
              }
            } catch (err) {
              console.error("Tauri custom token login fail:", err);
            }
          });
          unsubscribeDeepLink = () => {
            unlisten();
          };
        } catch (err) {
          console.error("Tauri deep link initialization fail:", err);
        }
      }
    };

    setupDeepLinkListener();

    return () => {
      if (unsubscribeDeepLink) {
        unsubscribeDeepLink();
      }
    };
  }, []);

  // Handle desktop authentication redirection bypass & system browser google callback flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_callback') === '1') {
      // Handled by DesktopAuthBridge component entirely, skip this effect
      return;
    }

    const isElectron = () => typeof window !== 'undefined' && (
      (window as any).electron !== undefined || 
      navigator.userAgent.toLowerCase().includes('electron') ||
      (window as any).ipcRenderer !== undefined ||
      (window as any).process?.versions?.electron !== undefined
    );
    const isTauri = () => typeof window !== 'undefined' && ('___TAURI___' in window || (window as any).__TAURI__ !== undefined);
    
    if (isElectron() || isTauri()) {
      console.log("Desktop shell detected (Electron/Tauri): Skipping third-party storage auth redirects.");
      return;
    }
    
    const checkRedirect = async () => {
      const params = new URLSearchParams(window.location.search);
      const isCallback = params.get('google_callback') === '1';

      try {
        const { getRedirectResult, signInWithRedirect } = await import('firebase/auth');
        const result = await getRedirectResult(auth);
        
        if (result?.user) {
          console.log('Redirect login success', result.user);
          if (isCallback) {
            const idToken = await result.user.getIdToken();
            try {
              const res = await fetch('/api/auth/custom-token', {
                method: 'POST',
                body: JSON.stringify({ idToken }),
                headers: { 'Content-Type': 'application/json' }
              });
              if (!res.ok) throw new Error("Failed to fetch custom token");
              const { customToken } = await res.json();
              if (customToken) {
                window.location.href = `cosmiwise://auth?token=${customToken}`;
              }
            } catch (fetchErr) {
              console.error("Custom token error:", fetchErr);
            }
            return;
          }
        } else if (isCallback) {
          if (!auth.currentUser) {
            const { signInWithRedirect } = await import('firebase/auth');
            await signInWithRedirect(auth, googleProvider);
          } else {
            // Already logged in from dynamic session, directly retrieve token & deep link back
            const idToken = await auth.currentUser.getIdToken();
            try {
              const res = await fetch('/api/auth/custom-token', {
                method: 'POST',
                body: JSON.stringify({ idToken }),
                headers: { 'Content-Type': 'application/json' }
              });
              if (res.ok) {
                const { customToken } = await res.json();
                window.location.href = `cosmiwise://auth?token=${customToken}`;
              }
            } catch (err) {
              console.error("Custom token error on currentUser:", err);
            }
          }
        }
      } catch (err: any) {
        console.error('redirect result error:', err.code, err.message);
      }
    };
    checkRedirect();
  }, []);

  const currentUserIdRef = useRef<string | null>(
    currentUser ? currentUser.uid : null,
  );
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [storageMode, setStorageMode] = useState<"local" | "database">(() => {
    return (localStorage.getItem("cosmi_settings_storage_mode") as "local" | "database") || "local";
  });

  const lastLocalEditTimeRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
  const lastReceivedSnapshotTabsStr = useRef<string>("");

  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [isCloudMenuOpen, setIsCloudMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Folder Management State
  const [folders, setFolders] = useState<FolderItem[]>(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      const cached = localStorage.getItem(`cosmi_folders_${uid}`);
      return cached
        ? JSON.parse(cached)
        : [
            {
              id: "f1",
              name: "My Research",
              createdAt: Date.now() - 172800000,
            },
          ];
    } catch {
      return [
        { id: "f1", name: "My Research", createdAt: Date.now() - 172800000 },
      ];
    }
  });
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderTempName, setRenamingFolderTempName] =
    useState<string>("");
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [isDeleteFolderModalOpen, setIsDeleteFolderModalOpen] = useState(false);
  const [activeMoveFolderDropdown, setActiveMoveFolderDropdown] = useState<
    string | null
  >(null);
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({ f1: true, f2: true, f3: false });

  // Research Papers Data
  const [papers, setPapers] = useState<PaperItem[]>(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      const cached = localStorage.getItem(`cosmi_papers_${uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Dynamic Tab Title Management
  useEffect(() => {
    if (!activeTab) {
      document.title = "Cosmi";
      return;
    }

    switch (activeTab.type) {
      case "home":
        document.title = "Cosmi";
        break;
      case "library":
        if (selectedFolderId) {
          const folderObj = folders.find((f) => f.id === selectedFolderId);
          document.title = `Cosmi - ${folderObj?.name || "Library"}`;
        } else {
          document.title = "Cosmi - Library";
        }
        break;
      case "document": {
        const titleStr =
          activeTab.title && activeTab.title.trim() !== ""
            ? activeTab.title
            : "Untitled Document";
        document.title = `Cosmi - ${titleStr}`;
        break;
      }
      case "chat": {
        const titleStr =
          activeTab.title && activeTab.title.trim() !== ""
            ? activeTab.title
            : "Chat";
        document.title = `Cosmi - ${titleStr}`;
        break;
      }
      default: {
        const titleStr =
          activeTab.title && activeTab.title.trim() !== ""
            ? activeTab.title
            : "Workspace";
        document.title = `Cosmi - ${titleStr}`;
      }
    }
  }, [activeTab, selectedFolderId, folders]);

  // Database helper wrappers to sync automatically to Firestore or guest local state
  const dbSetFolder = async (folder: FolderItem) => {
    const isRename = folders.some((f) => f.id === folder.id);
    if (currentUser && storageMode === "database") {
      try {
        await setDoc(doc(db, "users", currentUser.uid, "folders", folder.id), {
          id: folder.id,
          name: folder.name,
          createdAt: folder.createdAt,
        });
        showToast(
          isRename
            ? `Folder renamed to "${folder.name}"`
            : `Folder "${folder.name}" created successfully`,
          "success",
        );
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `users/${currentUser.uid}/folders/${folder.id}`,
        );
        showToast(
          `Failed to save folder: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    } else {
      setFolders((prev) => {
        if (prev.some((f) => f.id === folder.id)) {
          return prev.map((f) => (f.id === folder.id ? folder : f));
        }
        return [...prev, folder];
      });
      showToast(
        isRename
          ? `Folder renamed to "${folder.name}"`
          : `Folder "${folder.name}" created successfully`,
        "success",
      );
    }
  };

  const dbDeleteFolder = async (folderId: string) => {
    const folderName = folders.find((f) => f.id === folderId)?.name || "Folder";

    // Close tabs associated with deleted papers
    const papersToDelete = papers.filter((p) => p.folderId === folderId);
    if (papersToDelete.length > 0) {
      const titlesToDelete = papersToDelete.map((p) => p.title);
      setTabs((prev) => {
        const tabsToDelete = prev.filter(
          (t) => t.type === "document" && titlesToDelete.includes(t.title),
        );
        if (tabsToDelete.length === 0) return prev;

        const updated = prev.filter(
          (t) => t.type !== "document" || !titlesToDelete.includes(t.title),
        );

        if (updated.length === 0) {
          const newId = `chat-${Date.now()}`;
          setActiveTabId(newId);
          setActiveAssistantTabId(newId);
          setMessages([]);
          return [{ id: newId, type: "chat", title: "Untitled" }];
        }

        if (tabsToDelete.some((t) => t.id === activeTabId)) {
          setActiveTabId(updated[0].id);
        }

        return updated;
      });
    }

    if (currentUser && storageMode === "database") {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "folders", folderId));
        for (const p of papersToDelete) {
          const paperId = encodeURIComponent(p.title).replace(/\./g, "%2E");
          await deleteDoc(doc(db, "users", currentUser.uid, "papers", paperId));
        }
        showToast(
          `Folder "${folderName}" and its documents deleted successfully`,
          "success",
        );
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `users/${currentUser.uid}/folders/${folderId}`,
        );
        showToast(
          `Failed to delete folder: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    } else {
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setPapers((prev) => prev.filter((p) => p.folderId !== folderId));
      showToast(
        `Folder "${folderName}" and its documents deleted successfully`,
        "success",
      );
    }
  };

  const dbSetPaper = async (paper: PaperItem, silent = false) => {
    const paperId = encodeURIComponent(paper.title).replace(/\./g, "%2E");
    const isNew = !papers.some((p) => p.title === paper.title);
    const hasFolderChanged = papers.some(
      (p) => p.title === paper.title && p.folderId !== paper.folderId,
    );

    if (currentUser && storageMode === "database") {
      try {
        await setDoc(doc(db, "users", currentUser.uid, "papers", paperId), {
          author: paper.author || "",
          title: paper.title || "",
          description: paper.description || "",
          url: paper.url || "",
          added: paper.added || "",
          fullTextStatus: paper.fullTextStatus || "",
          viewed: paper.viewed || "",
          fileType: paper.fileType || "",
          summary: paper.summary || "",
          fileId: paper.fileId || "",
          mimetype: paper.mimetype || "",
          extractedText: paper.extractedText || "",
          folderId: paper.folderId || "",
          notes: paper.notes || "",
        });

        if (!silent) {
          if (hasFolderChanged) {
            const destFolder =
              folders.find((f) => f.id === paper.folderId)?.name || "Default";
            showToast(`Moved "${paper.title}" to ${destFolder}`, "success");
          } else if (isNew) {
            showToast(
              `Document "${paper.title}" added to workspace`,
              "success",
            );
          }
        }
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `users/${currentUser.uid}/papers/${paperId}`,
        );
        showToast(
          `Failed to save document: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    } else {
      setPapers((prev) => {
        if (prev.some((p) => p.title === paper.title)) {
          return prev.map((p) => (p.title === paper.title ? paper : p));
        }
        return [paper, ...prev];
      });

      if (!silent) {
        if (hasFolderChanged) {
          const destFolder =
            folders.find((f) => f.id === paper.folderId)?.name || "Default";
          showToast(`Moved "${paper.title}" to ${destFolder}`, "success");
        } else if (isNew) {
          showToast(`Document "${paper.title}" added to workspace`, "success");
        }
      }
    }
  };

  const createNewDocument = (targetFolderId?: string) => {
    const newId = `doc-${Date.now()}`;
    const folder = targetFolderId || selectedFolderId || folders[0]?.id || "f1";
    const newDoc: Tab = {
      id: newId,
      type: "document",
      title: "Untitled",
      originalTitle: "Untitled",
      content: "",
      folderId: folder,
    };

    lastLocalEditTimeRef.current = Date.now();
    setTabs((prev) => [...prev, newDoc]);
    setActiveTabId(newId);
    setSidebarView("files");
    saveDraftToLibrary(newDoc);
    showToast(`New draft document created`, "success");
    return newId;
  };

  const dbDeletePaper = async (paperTitle: string) => {
    const paperId = encodeURIComponent(paperTitle).replace(/\./g, "%2E");

    // Close any open document tabs associated with this paper
    setTabs((prev) => {
      const tabsToDelete = prev.filter(
        (t) => t.type === "document" && t.title === paperTitle,
      );
      if (tabsToDelete.length === 0) return prev;

      const updated = prev.filter(
        (t) => t.type !== "document" || t.title !== paperTitle,
      );

      if (updated.length === 0) {
        const newId = `chat-${Date.now()}`;
        setActiveTabId(newId);
        setActiveAssistantTabId(newId);
        setMessages([]);
        return [{ id: newId, type: "chat", title: "Untitled" }];
      }

      if (tabsToDelete.some((t) => t.id === activeTabId)) {
        setActiveTabId(updated[0].id);
      }

      return updated;
    });

    if (currentUser && storageMode === "database") {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "papers", paperId));
        showToast(`Document "${paperTitle}" deleted successfully`, "success");
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `users/${currentUser.uid}/papers/${paperId}`,
        );
        showToast(
          `Failed to delete document: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    } else {
      setPapers((prev) => prev.filter((p) => p.title !== paperTitle));
      showToast(`Document "${paperTitle}" deleted successfully`, "success");
    }
  }  // Real-time Firestore synchronization effect
  useEffect(() => {
    let unsubscribeUser = () => {};
    let unsubFolders = () => {};
    let unsubPapers = () => {};
    let unsubChats = () => {};
    let unsubAnnos = () => {};

    const setupListeners = async (user: any) => {
      // Clean up previous listeners
      unsubFolders();
      unsubPapers();
      unsubChats();
      unsubAnnos();

      if (user && storageMode === "database") {
        // --- PRIVATE PERSISTENT MODE ---
        // Save/Sync profile
        try {
          setDoc(
            doc(db, "users", user.uid),
            {
              uid: user.uid,
              email: user.email || "",
              displayName: user.displayName || "Researcher",
              lastActive: Date.now(),
              createdAt: user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now(),
            },
            { merge: true },
          );
        } catch (error) {
          console.error("Failed saving user profile:", error);
        }

        // Hydrate from localStorage first for instant UI response
        try {
          const cachedFolders = localStorage.getItem(`cosmi_folders_${user.uid}`);
          if (cachedFolders) setFolders(JSON.parse(cachedFolders));
          const cachedPapers = localStorage.getItem(`cosmi_papers_${user.uid}`);
          if (cachedPapers) setPapers(JSON.parse(cachedPapers));
          const cachedTabs = localStorage.getItem(`cosmi_tabs_${user.uid}`);
          if (cachedTabs) setTabs(JSON.parse(cachedTabs));
          const cachedActiveTabId = localStorage.getItem(`cosmi_activeTabId_${user.uid}`);
          if (cachedActiveTabId) setActiveTabId(cachedActiveTabId);
          const cachedMessages = localStorage.getItem(`cosmi_messages_${user.uid}`);
          if (cachedMessages) setMessages(JSON.parse(cachedMessages));
        } catch {}

        // Load workspace session state from server
        try {
          const sessionDoc = await getDocFromServer(
            doc(db, "users", user.uid, "workspace", "session"),
          );
          if (sessionDoc.exists()) {
            const data = sessionDoc.data();
            if (data.tabs && data.tabs.length > 0) setTabs(data.tabs);
            if (data.activeTabId) setActiveTabId(data.activeTabId);
            if (data.messages) setMessages(data.messages);
          }
        } catch (error) {
          console.error("Failed loading workspace session:", error);
        } finally {
          setIsSessionLoaded(true);
        }

        // Real-time listeners
        const foldersColRef = collection(db, "users", user.uid, "folders");
        unsubFolders = onSnapshot(foldersColRef, (snapshot) => {
          const loadedFolders: FolderItem[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            loadedFolders.push({
              id: doc.id,
              name: data.name || "Untitled Folder",
              createdAt: data.createdAt || Date.now(),
            });
          });
          if (loadedFolders.length > 0) {
            setFolders(loadedFolders);
          } else {
            const defaultFolder: FolderItem = { id: "f1", name: "My Research", createdAt: Date.now() };
            setDoc(doc(db, "users", user.uid, "folders", defaultFolder.id), defaultFolder);
          }
        });

        const papersColRef = collection(db, "users", user.uid, "papers");
        unsubPapers = onSnapshot(papersColRef, (snapshot) => {
          const loadedPapers: PaperItem[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            loadedPapers.push({
              author: typeof data.author === "string" ? data.author : String(data.author || ""),
              title: typeof data.title === "string" ? data.title : String(data.title || ""),
              description: typeof data.description === "string" ? data.description : String(data.description || ""),
              url: data.url || "",
              added: data.added || "",
              fullTextStatus: data.fullTextStatus || "",
              viewed: data.viewed || "",
              fileType: data.fileType || "",
              summary: data.summary || "",
              fileId: data.fileId || "",
              mimetype: data.mimetype || "",
              extractedText: data.extractedText || "",
              folderId: data.folderId || "",
              notes: data.notes || "",
            });
          });
          setPapers(loadedPapers);
        });

        const chatsColRef = collection(db, "users", user.uid, "chats");
        unsubChats = onSnapshot(chatsColRef, (snapshot) => {
          const loadedChats: Tab[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            loadedChats.push({
              id: doc.id,
              type: "chat",
              title: data.title || "Untitled",
              messages: data.messages || [],
            });
          });
          setAllChats(loadedChats.sort((a,b) => {
            const aLast = a.messages && a.messages.length > 0 ? a.messages[a.messages.length - 1].timestamp : 0;
            const bLast = b.messages && b.messages.length > 0 ? b.messages[b.messages.length - 1].timestamp : 0;
            return bLast - aLast;
          }));
        });

        const annosColRef = collection(db, "users", user.uid, "annotations");
        unsubAnnos = onSnapshot(annosColRef, (snapshot) => {
          const groupedAnnos: Record<string, any[]> = {};
          snapshot.forEach((doc) => {
            const data = doc.data();
            const fileId = data.fileId || "default";
            if (!groupedAnnos[fileId]) groupedAnnos[fileId] = [];
            groupedAnnos[fileId].push({
              id: doc.id,
              fileId,
              text: data.text || "",
              comment: data.comment || "",
              page: data.page || 1,
              color: data.color || "#fef08a",
              timestamp: data.timestamp || Date.now(),
            });
          });
          Object.keys(groupedAnnos).forEach((fileId) => {
            localStorage.setItem(
              `annotations_${fileId}`,
              JSON.stringify(groupedAnnos[fileId]),
            );
          });
          window.dispatchEvent(new Event("annotationsUpdated"));
        });
      } else if (user && storageMode === "local") {
        // --- PRIVATE SECURED LOCAL STORAGE MODE FOR USER ---
        setIsSessionLoaded(true);
        try {
          const cachedFolders = localStorage.getItem(`cosmi_folders_${user.uid}`);
          setFolders(cachedFolders ? JSON.parse(cachedFolders) : [{ id: "f1", name: "My Research", createdAt: Date.now() - 172800000 }]);
          const cachedPapers = localStorage.getItem(`cosmi_papers_${user.uid}`);
          setPapers(cachedPapers ? JSON.parse(cachedPapers) : []);
          const cachedTabs = localStorage.getItem(`cosmi_tabs_${user.uid}`);
          setTabs(cachedTabs ? JSON.parse(cachedTabs) : [{ id: "initial-home", type: "home", title: "Home" }]);
          const cachedActiveTabId = localStorage.getItem(`cosmi_activeTabId_${user.uid}`);
          setActiveTabId(cachedActiveTabId || "initial-home");
          const cachedMessages = localStorage.getItem(`cosmi_messages_${user.uid}`);
          setMessages(cachedMessages ? JSON.parse(cachedMessages) : []);
          const cachedChats = localStorage.getItem(`cosmi_chats_${user.uid}`);
          setAllChats(cachedChats ? JSON.parse(cachedChats) : []);
        } catch {
          setFolders([{ id: "f1", name: "My Research", createdAt: Date.now() - 172800000 }]);
          setPapers([]);
          setTabs([{ id: "initial-home", type: "home", title: "Home" }]);
          setActiveTabId("initial-home");
          setMessages([]);
          setAllChats([]);
        }
      } else {
        // --- GUEST / OFFLINE MODE ---
        setIsSessionLoaded(true);
        try {
          const cachedFolders = localStorage.getItem(`cosmi_folders_guest`);
          setFolders(cachedFolders ? JSON.parse(cachedFolders) : [{ id: "f1", name: "My Research", createdAt: Date.now() - 172800000 }]);
          const cachedPapers = localStorage.getItem(`cosmi_papers_guest`);
          setPapers(cachedPapers ? JSON.parse(cachedPapers) : []);
          const cachedTabs = localStorage.getItem(`cosmi_tabs_guest`);
          setTabs(cachedTabs ? JSON.parse(cachedTabs) : [{ id: "initial-home", type: "home", title: "Home" }]);
          const cachedActiveTabId = localStorage.getItem(`cosmi_activeTabId_guest`);
          setActiveTabId(cachedActiveTabId || "initial-home");
          const cachedMessages = localStorage.getItem(`cosmi_messages_guest`);
          setMessages(cachedMessages ? JSON.parse(cachedMessages) : []);
          const cachedChats = localStorage.getItem(`cosmi_chats_guest`);
          setAllChats(cachedChats ? JSON.parse(cachedChats) : []);
        } catch {
          setFolders([{ id: "f1", name: "My Research", createdAt: Date.now() - 172800000 }]);
          setPapers([]);
          setTabs([{ id: "initial-home", type: "home", title: "Home" }]);
          setActiveTabId("initial-home");
          setMessages([]);
          setAllChats([]);
        }
      }
    };

    const syncUserToLocal = (user: any) => {
      if (user) {
        const userToStore = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
        localStorage.setItem("cosmi_user_snapshot", JSON.stringify(userToStore));
      } else {
        localStorage.removeItem("cosmi_user_snapshot");
      }
    };

    // Handle login breakout trigger
    // (code removed)

    // Handle Firebase Redirect result (removed as Tauri breakout is preferred)

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      syncUserToLocal(user);
      setCurrentUser(user);
      currentUserIdRef.current = user ? user.uid : null;
      
      const uid = user ? user.uid : "guest";
      const userCallMe = localStorage.getItem(`cosmi_settings_call_me_${uid}`) || "";
      setCallMe(userCallMe);
      
      setupListeners(user);

      setIsAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubFolders();
      unsubPapers();
      unsubChats();
      unsubAnnos();
    };
  }, [storageMode]);

  const handleGoogleLogin = async () => {
    // Detect if we are inside Electron or Tauri
    const isElectron = () => typeof window !== "undefined" && (
      (window as any).electron !== undefined || 
      navigator.userAgent.toLowerCase().includes("electron") ||
      (window as any).ipcRenderer !== undefined ||
      (window as any).process?.versions?.electron !== undefined
    );
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    // Use system browser breakout for Tauri and Electron environments
    // because Firebase Auth popup/redirect doesn't support custom desktop protocols or wrappers securely.
    const needsSystemBrowserBreakout = isTauri || isElectron();

    if (needsSystemBrowserBreakout) {
      const redirectUrl = "https://cosmiwise.vercel.app/?google_callback=1";
      if (isElectron()) {
        if ((window as any).electron?.openUrl) {
          (window as any).electron.openUrl(redirectUrl);
        } else {
          window.open(redirectUrl, "_blank");
        }
      } else if (isTauri) {
        try {
          const { openUrl } = await import("@tauri-apps/plugin-opener");
          await openUrl(redirectUrl);
        } catch (err) {
          console.error("Tauri breakout failed:", err);
        }
      }
    } else {
      // Normal web behavior: use the popup
      await signInWithPopup(auth, googleProvider);
    }
  };

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const handleSearchPapers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSynthesis(null);
    try {
      const resp = await fetch(
        `/api/research/papers?q=${encodeURIComponent(searchQuery)}`,
      );
      const data = await resp.json();
      setSearchResults(data.papers || (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSynthesize = async () => {
    if (searchResults.length === 0) return;
    setIsSynthesizing(true);
    try {
      const resp = await fetch("/api/research/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papers: searchResults, userQuery: searchQuery }),
      });
      const data = await resp.json();
      setSynthesis(data.synthesis);
    } catch (err) {
      console.error("Synthesis failed:", err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const addPaperToLibrary = async (paper: any) => {
    const authors =
      paper.authors?.map((a: any) => a.name).join(", ") || "Unknown Author";
    const targetFolder = selectedFolderId || folders[0]?.id || "f1";

    // Extract actual text if file exists and it is not a pdf
    let extractedText = "";
    if (paper.fileId) {
      try {
        extractedText = await extractTextFromPdf(`/api/files/${paper.fileId}`);
      } catch (err) {
        console.error(
          "Failed to extract text for paper saved to library:",
          err,
        );
      }
    }

    const newPaper: PaperItem = {
      author: authors,
      title: paper.title,
      description:
        paper.abstract || `Paper from ${paper.venue || "Academic Repository"}`,
      added: "Today",
      fullTextStatus: paper.fileId ? "Mapped" : "Available",
      viewed: "Just now",
      fileType: "Document",
      summary: paper.abstract || "",
      fileId: paper.fileId || "",
      mimetype: paper.mimetype || "",
      extractedText: extractedText,
      folderId: targetFolder,
    };
    dbSetPaper(newPaper);

    // Auto-create and switch to a new document tab with the added document's content
    const newTabId = paper.fileId
      ? `view-${paper.fileId}`
      : `added-${Date.now()}`;

    let initialContent = "";
    const isPdfValue =
      paper.mimetype === "application/pdf" ||
      paper.title.toLowerCase().endsWith(".pdf");
    if (extractedText && !isPdfValue) {
      initialContent = `<div class="p-6 text-zinc-300 max-w-3xl mx-auto">
        <h1 class="text-3xl font-medium tracking-tight mb-2 text-white">${paper.title}</h1>
        <p class="text-[11px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">Document File: ${paper.title}</p>
        <div class="h-[1px] bg-zinc-800 mb-6"></div>
        <div class="space-y-4 leading-relaxed">${extractedText
          .split("\n\n")
          .map((p: string) =>
            p.trim() ? `<p>${p.replace(/\n/g, "<br/>")}</p>` : "",
          )
          .join("")}</div>
      </div>`;
    } else {
      initialContent = `<h3>${paper.title}</h3><p><em>${authors}</em></p><p>${newPaper.description}</p>`;
    }

    setTabs((prev) => {
      // Avoid adding duplicate tabs if already open
      const existing = prev.find((t) => t.title === paper.title);
      if (existing) {
        return prev;
      }
      return [
        ...prev,
        {
          id: newTabId,
          type: "document",
          title: paper.title,
          content: initialContent,
          fileId: paper.fileId || "",
          mimetype: paper.mimetype || "",
          folderId: targetFolder,
        },
      ];
    });

    const existingTab = tabs.find((t) => t.title === paper.title);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      setActiveTabId(newTabId);
    }
  };

  // AI Assistant Chat Messages
  const [allChats, setAllChats] = useState<Tab[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      const cached = localStorage.getItem(`cosmi_messages_${uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [chatInput, setChatInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("auto");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [callMe, setCallMe] = useState(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      return localStorage.getItem(`cosmi_settings_call_me_${uid}`) || "";
    } catch {
      return "";
    }
  });
  const [assistantInput, setAssistantInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [researchStatus, setResearchStatus] = useState<
    "fetching" | "downloading" | "polishing" | "editor_agent" | null
  >(null);
  const aiWritingTabIdRef = useRef<string | null>(null);
  const [isChatSuggestionsDismissed, setIsChatSuggestionsDismissed] =
    useState(false);
  const [selectedFileLabel, setSelectedFileLabel] = useState<string | null>(
    null,
  );
  const [attachedFile, setAttachedFile] = useState<{
    fileId: string;
    fileName: string;
    mimetype: string;
    url: string;
  } | null>(null);

  const saveDraftToLibrary = async (tab: Tab) => {
    if (tab.type !== "document") return;

    // We do not auto-save PDF documents as drafts, they are managed via upload/import.
    if (tab.fileId || tab.mimetype === "application/pdf") return;

    const paperTitle =
      tab.title && tab.title.trim() ? tab.title.trim() : "Untitled";
    const paperId = encodeURIComponent(paperTitle).replace(/\./g, "%2E");

    // If the title changed, delete the old document
    if (tab.originalTitle && tab.originalTitle !== paperTitle) {
    if (currentUser && storageMode === "database") {
      const oldPaperId = encodeURIComponent(tab.originalTitle).replace(
        /\./g,
        "%2E",
      );
      try {
        await deleteDoc(
          doc(db, "users", currentUser.uid, "papers", oldPaperId),
        );
      } catch (err) {
        console.error("Failed to delete renamed draft", err);
      }
    }

      // Update tab's originalTitle so we don't try to delete it again
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tab.id ? { ...t, originalTitle: paperTitle } : t,
        ),
      );
    }

    const draftPaper: PaperItem = {
      author: "Workspace Draft",
      title: paperTitle,
      description:
        (tab.content || "").substring(0, 100).replace(/<[^>]*>/g, "") + "...",
      added: "Just now",
      fullTextStatus: "Draft",
      viewed: "Active",
      fileType: "Document",
      summary: tab.content || "",
      folderId: tab.folderId || folders[0]?.id || "f1",
    };

    if (currentUser && storageMode === "database") {
      const path = `users/${currentUser.uid}/papers/${paperId}`;
      try {
        await setDoc(
          doc(db, "users", currentUser.uid, "papers", paperId),
          draftPaper,
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // Reflect the change locally in the papers array
    setPapers((prev) => {
      const filtered = prev.filter(
        (p) =>
          encodeURIComponent(p.title).replace(/\./g, "%2E") !== paperId &&
          p.title !== tab.originalTitle,
      );
      return [draftPaper, ...filtered];
    });
  };

  const saveChatToLibrary = async (targetUserId: string, chatTab: Tab) => {
    if (!chatTab || chatTab.type !== "chat") return;
    
    const uid = currentUser ? currentUser.uid : "guest";
    
    if (storageMode === "database" && currentUser) {
      const path = `users/${targetUserId}/chats/${chatTab.id}`;
      try {
        const chatDocRef = doc(db, "users", targetUserId, "chats", chatTab.id);
        await setDoc(
          chatDocRef,
          {
            title: chatTab.title || "Untitled",
            messages: chatTab.messages || [],
            updatedAt: Date.now(),
          },
          { merge: true },
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    } else {
      setAllChats((prev) => {
        const filtered = prev.filter((c) => c.id !== chatTab.id);
        const updatedChat = {
          ...chatTab,
          messages: chatTab.messages || [],
        };
        const next = [updatedChat, ...filtered];
        localStorage.setItem(`cosmi_chats_${uid}`, JSON.stringify(next));
        return next;
      });
    }
  };

  const updateChatMessages = (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
    skipTabsUpdate = true,
  ) => {
    setMessages((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!skipTabsUpdate) {
        let targetTabId =
          activeAssistantTabIdRef.current || activeTabIdRef.current;
        const currentTab = tabsRef.current.find((t) => t.id === targetTabId);
        let foundChat = false;

        if (!currentTab || currentTab.type !== "chat") {
          const firstChat = tabsRef.current.find((t) => t.type === "chat");
          if (firstChat) {
            targetTabId = firstChat.id;
            foundChat = true;
          }
        } else {
          foundChat = true;
        }

        let updatedTabs = tabsRef.current;
        if (!foundChat) {
          const newChatId = `chat-${Date.now()}`;
          targetTabId = newChatId;
          const newChatTab: Tab = {
            id: newChatId,
            type: "chat",
            title: "New chat",
            messages: next,
          };
          updatedTabs = [...updatedTabs, newChatTab];
          // We can't setState inside setState cleanly, but we can setTabs:
          setTimeout(() => setActiveAssistantTabId(newChatId), 0);
        }

        updatedTabs = updatedTabs.map((t) =>
          t.id === targetTabId ? { ...t, messages: next } : t,
        );
        setTabs(updatedTabs);

        // Also save to persistent chat library
        const chatTab = updatedTabs.find((t) => t.id === targetTabId);
        if (chatTab) {
          saveChatToLibrary(currentUser?.uid || "guest", chatTab);
        }
      }
      return next;
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const assistantMessageIdRef = useRef<string | null>(null);

  // Auto Scroll Chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, isAiTyping]);

  // Presence reporting loop has been removed

  // Sync workspace session to Firestore periodically when changes occur
  useEffect(() => {
    if (!isSessionLoaded || !tabs || tabs.length === 0) return;

    if (currentUser && storageMode === "database") {
      const handler = setTimeout(() => {
        const sessionRef = doc(
          db,
          "users",
          currentUser.uid,
          "workspace",
          "session",
        );
        const cleanTabs = JSON.parse(JSON.stringify(tabs));
        const cleanMessages = JSON.parse(JSON.stringify(messages));

        setDoc(
          sessionRef,
          {
            tabs: cleanTabs,
            activeTabId,
            messages: cleanMessages,
          },
          { merge: true },
        ).catch((err) => console.error("Workspace sync failed:", err));
      }, 1500);
      return () => clearTimeout(handler);
    }
  }, [tabs, activeTabId, messages, currentUser, isSessionLoaded]);

  // Synchronize workspace changes to LocalStorage instantly
  useEffect(() => {
    const uid = currentUser ? currentUser.uid : "guest";
    localStorage.setItem(`cosmi_folders_${uid}`, JSON.stringify(folders));
  }, [folders, currentUser]);

  useEffect(() => {
    const uid = currentUser ? currentUser.uid : "guest";
    localStorage.setItem(`cosmi_papers_${uid}`, JSON.stringify(papers));
  }, [papers, currentUser]);

  useEffect(() => {
    const uid = currentUser ? currentUser.uid : "guest";
    localStorage.setItem(`cosmi_tabs_${uid}`, JSON.stringify(tabs));
  }, [tabs, currentUser]);

  useEffect(() => {
    const uid = currentUser ? currentUser.uid : "guest";
    localStorage.setItem(`cosmi_activeTabId_${uid}`, activeTabId);
  }, [activeTabId, currentUser]);

  useEffect(() => {
    const uid = currentUser ? currentUser.uid : "guest";
    localStorage.setItem(`cosmi_messages_${uid}`, JSON.stringify(messages));
  }, [messages, currentUser]);

  // PDF Annotation Helpers & Highlight Engine
  const highlightPDFSpans = () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab || !activeTab.id) return;
    const fileKey = activeTab.fileId || activeTab.id;
    const saved = localStorage.getItem(`annotations_${fileKey}`);
    if (!saved) return;
    try {
      const annos = JSON.parse(saved);
      if (!annos || annos.length === 0) return;

      annos.forEach((anno: any) => {
        const pageContainer = document.getElementById(`pdf-page-${anno.page}`);
        if (!pageContainer) return;

        const textLayer = pageContainer.querySelector(
          ".react-pdf__Page__textContent",
        );
        if (!textLayer) return;

        const spans = textLayer.querySelectorAll("span");
        spans.forEach((span: any) => {
          if (
            span.textContent &&
            span.textContent.includes(anno.text) &&
            !span.dataset.annotated
          ) {
            span.dataset.annotated = "true";
            const originalHTML = span.innerHTML;
            const highlightColor = anno.color || "#fef08a";
            span.innerHTML = originalHTML
              .split(anno.text)
              .join(
                `<mark style="background-color: ${highlightColor} !important; color: transparent !important; -webkit-text-fill-color: transparent !important; opacity: 0.55 !important; mix-blend-mode: multiply !important; border-radius: 2px; padding: 1px 0px; box-shadow: none;">${anno.text}</mark>`,
              );
          }
        });
      });
    } catch (e) {
      console.warn("Error highlighting spans", e);
    }
  };

  useEffect(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    let intervalId: any;
    if (activeTab && activeTab.mimetype === "application/pdf") {
      highlightPDFSpans();
      intervalId = setInterval(highlightPDFSpans, 1500);
    }

    const handleUpdate = () => {
      highlightPDFSpans();
    };

    window.addEventListener("annotationsUpdated", handleUpdate);
    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("annotationsUpdated", handleUpdate);
    };
  }, [activeTabId, pdfNumPages]);

  useEffect(() => {
    if (!pdfNumPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry that is intersecting the most
        let maxRatio = 0;
        let mostVisibleId = null;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisibleId = entry.target.id;
          }
        });

        if (mostVisibleId) {
          const pageNum = parseInt(
            (mostVisibleId as string).replace("pdf-page-", ""),
          );
          if (!isNaN(pageNum)) {
            setCurrentPdfPage(pageNum);
          }
        }
      },
      {
        root: document.getElementById("pdf-scroll-container"),
        rootMargin: "0px",
        threshold: [0.1, 0.4, 0.6, 0.8],
      },
    );

    // We delay the observation to let the DOM settle
    const timeout = setTimeout(() => {
      const pageContainers = document.querySelectorAll(".pdf-page-wrapper");
      pageContainers.forEach((container) => observer.observe(container));
    }, 500);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [pdfNumPages, activeTabId]);

  const findPageFromNode = (node: Node | null): number | null => {
    let current: HTMLElement | null = node as HTMLElement;
    while (current) {
      if (current.id && current.id.startsWith("pdf-page-")) {
        const num = parseInt(current.id.replace("pdf-page-", ""));
        if (!isNaN(num)) return num;
      }
      current = current.parentElement;
    }
    return null;
  };

  const handlePdfMouseUp = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      setSelectionText(text);

      const pageNum =
        findPageFromNode(selection.anchorNode) ||
        findPageFromNode(selection.focusNode);
      setSelectedPageNum(pageNum);
    } else {
      const target = e.target as HTMLElement;
      if (target && !target.closest(".pdf-annotation-popover")) {
        setSelectionText("");
        setSelectionPos(null);
        setSelectedPageNum(null);
        setCommentDraft("");
      }
    }
  };

  const handlePdfContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate smart positioning for the context menu to keep it within viewport
    const menuWidth = 220;
    const menuHeight = 580; // Larger estimate for more items
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    // Bottom boundary check - if x is still above menu height, we might want to flip it
    if (y < 0) y = 10;

    setPdfContextMenu({ x, y });

    // Also try to capture selection if any (in case mouseup didn't fire as expected)
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      setSelectionText(text);
      const pageNum =
        findPageFromNode(selection.anchorNode) ||
        findPageFromNode(selection.focusNode);
      setSelectedPageNum(pageNum);
    }
  };

  // Word count helper
  const wordCount = (() => {
    const rawText =
      `${documentTitle} ${folderName} ${savedNoteName} ` +
      papers.map((p) => `${p.author} ${p.title} ${p.description}`).join(" ");
    const cleaned = rawText.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    return cleaned.split(/\s+/).filter(Boolean).length;
  })();

  const [documentContent, setDocumentContent] = useState(() => {
    return "";
  });

  // When activeTabId, tabs, or isSessionLoaded changes, pull the corresponding tab's values and title into states and the editor
  useEffect(() => {
    if (ignoreNextTabSyncRef.current) {
      ignoreNextTabSyncRef.current = false;
      loadedTabIdRef.current = activeTabId;
      return;
    }
    const targetTab = tabs.find((t) => t.id === activeTabId);
    const isDocNotPdf =
      targetTab &&
      targetTab.type === "document" &&
      (!targetTab.fileId ||
        !(
          targetTab.mimetype === "application/pdf" ||
          targetTab.title.toLowerCase().endsWith(".pdf")
        ));

    if (isDocNotPdf) {
      setDocumentTitle(targetTab.title || "Untitled");
      setDocumentContent(targetTab.content || "");
      setDocSaveStatus("saved");
      setChatInput("");
      if (editorRef.current && document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = targetTab.content || "";
        lastContentRef.current = targetTab.content || "";
      }
    } else if (targetTab && targetTab.type === "chat") {
      setMessages(targetTab.messages || []);
      setActiveAssistantTabId(targetTab.id);
      setChatInput(targetTab.chatInput || "");
    } else {
      setChatInput("");
      if (activeTabId !== "initial-home") {
        setDocumentTitle("Untitled");
        setDocumentContent("");
        if (editorRef.current && document.activeElement !== editorRef.current) {
          editorRef.current.innerHTML = "";
          lastContentRef.current = "";
        }
      }
    }
    loadedTabIdRef.current = activeTabId;
  }, [activeTabId, tabs, isSessionLoaded]);

  // Debounced auto-save of active document draft to Firestore/LocalStorage
  useEffect(() => {
    if (docSaveStatus !== "saving") return;

    const timer = setTimeout(async () => {
      const currentTab = tabs.find((t) => t.id === activeTabId);
      if (
        currentTab &&
        currentTab.type === "document" &&
        (!currentTab.fileId ||
          !(
            currentTab.mimetype === "application/pdf" ||
            currentTab.title.toLowerCase().endsWith(".pdf")
          ))
      ) {
        try {
          await saveDraftToLibrary(currentTab);
        } catch (err) {
          console.error("Auto-save failed to update paper draft:", err);
        }
      }
      setDocSaveStatus("saved");
    }, 400); // 400ms debounce for fast and modern response

    return () => clearTimeout(timer);
  }, [docSaveStatus, documentTitle, documentContent, activeTabId, tabs]);

  // Helper to convert Markdown to HTML for the editor
  const markdownToHtml = (markdown: string) => {
    if (!markdown) return "";
    try {
      // Clean JSON leak and replace literal escaped newlines with actual newline characters
      const cleaned = cleanJsonLeakFront(markdown);
      let formattedMarkdown = cleaned.replace(/\\n/g, "\n");

      // Attempt to add spacing to massive walls of text
      if (
        formattedMarkdown.length > 500 &&
        !formattedMarkdown.includes("\n\n")
      ) {
        formattedMarkdown = formatAbstractText(formattedMarkdown);
      }

      // Trim outer whitespace so that heading tags (like ## Introduction)
      // placed at the start/ends are parsed as actual headings, not inline text.
      const trimmedMarkdown = formattedMarkdown.trim();
      const htmlText = marked.parse(trimmedMarkdown, {
        gfm: true,
        breaks: false,
      }) as string;
      return linkifyHtml(htmlText);
    } catch (e) {
      console.error("Markdown conversion failed", e);
      return linkifyHtml(markdown.replace(/\\n/g, "\n"));
    }
  };

  const handlePaperClick = (paper: PaperItem) => {
    const existingTab = tabs.find((t) => t.title === paper.title);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTabId = paper.fileId
        ? `view-${paper.fileId}`
        : `view-${Date.now()}`;

      let initialContent = "";
      const isPdfValue =
        paper.mimetype === "application/pdf" ||
        paper.title.toLowerCase().endsWith(".pdf");
      if (paper.extractedText && !isPdfValue) {
        initialContent = `<div class="p-6 text-zinc-300 max-w-3xl mx-auto">
          <h1 class="text-3xl font-medium tracking-tight mb-2 text-white">${paper.title}</h1>
          <p class="text-[11px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">Document File: ${paper.title}</p>
          <div class="h-[1px] bg-zinc-800 mb-6"></div>
          <div class="space-y-4 leading-relaxed">${paper.extractedText
            .split("\n\n")
            .map((p) => (p.trim() ? `<p>${p.replace(/\n/g, "<br/>")}</p>` : ""))
            .join("")}</div>
        </div>`;
      } else {
        initialContent = markdownToHtml(
          paper.summary || paper.description || "",
        );
      }

      setTabs((prev) => [
        ...prev,
        {
          id: newTabId,
          type: "document",
          title: paper.title,
          content: initialContent,
          fileId: paper.fileId,
          mimetype: paper.mimetype,
          folderId: paper.folderId,
        },
      ]);
      setActiveTabId(newTabId);
    }
  };

  // intel fallback response generator for offline or key-missing states
  const getFallbackResponse = React.useCallback(
    (query: string): { text: string; suggestion?: any } => {
      const lowercase = query.toLowerCase();

      // Check for inline edits from the user
      if (lowercase.includes("rename") || lowercase.includes("change title")) {
        const newTitleMatch = query.match(
          /(?:rename|change title|title to) ["']?(.+?)["']?$/i,
        );
        const title = newTitleMatch
          ? newTitleMatch[1]
          : `Updated Title - ${new Date().toLocaleTimeString()}`;
        return {
          text: `I have updated the document title to "${title}" as you requested.`,
          suggestion: { type: "edit_document", title: title },
        };
      }

      if (
        lowercase.includes("remove") ||
        lowercase.includes("delete") ||
        lowercase.includes("clear")
      ) {
        return {
          text: `I've cleared out the requested section as directed.`,
          suggestion: {
            type: "edit_document",
            replaceContent: "Cleared workspace...",
          },
        };
      }

      if (
        lowercase.includes("add") ||
        lowercase.includes("draft") ||
        lowercase.includes("write")
      ) {
        return {
          text: `I have drafted and inserted a new academic synthesis section directly into your document.`,
          suggestion: {
            type: "edit_document",
            appendContent:
              "\n\nScholarly consensus indicates that cognitive consolidation is a highly physical, lifestyle-dependent adaptation. It requires both cortical neurodevelopmental responsiveness and striatal automation pathways, which are actively catalyzed by aerobic and cognitive stressors.",
          },
        };
      }

      if (
        lowercase.includes("hi") ||
        lowercase.includes("hello") ||
        lowercase.includes("hey") ||
        lowercase.includes("help") ||
        lowercase.includes("greet")
      ) {
        return {
          text: `I'm ready to help you crush your research! If you have any source material (like PDFs or notes), click the paperclip icon inside the chat box or use the "Plus" button in the Workspace sidebar to add them. 

I can help you:
1. **Analyze Sources**: Pull out key arguments and data points from your papers.
2. **Draft Content**: Write high-quality, long-form academic text.
3. **Structure Outlines**: Organize your thoughts into a logical flow.

What's on your mind?`,
        };
      }

      return {
        text: `I'm all set to help you with your project!
 
You haven't added any sources to this workspace yet. Feel free to upload your research papers or drop some notes in the "Notes" section. 
 
Once you have content, I can help you draft sections, summarize findings, or format your bibliography in APA, MLA, or Chicago style.`,
      };
    },
    [],
  );

  const handleCitationClick = React.useCallback(
    (page: number, title: string) => {
      const normalizedTarget = title.replace(/_/g, " ").trim().toLowerCase();

      // 1. Try to find a matching tab
      let targetTab = tabs.find((t) => {
        if (!t.title) return false;
        const normalizedTabTitle = t.title
          .replace(/_/g, " ")
          .trim()
          .toLowerCase();
        return (
          normalizedTabTitle.includes(normalizedTarget) ||
          normalizedTarget.includes(normalizedTabTitle)
        );
      });

      if (targetTab) {
        if (activeTabId !== targetTab.id) {
          setActiveTabId(targetTab.id);
        }

        // Wait for tab transfer then scroll to target page id element
        setTimeout(() => {
          const pageEl = document.getElementById(`pdf-page-${page}`);
          if (pageEl) {
            pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 500);
      } else {
        // 2. Try to locate the paper in the library/papers state list and load it dynamically
        const matchedPaper = papers.find((p) => {
          if (!p.title) return false;
          const normalizedPaperTitle = p.title
            .replace(/_/g, " ")
            .trim()
            .toLowerCase();
          return (
            normalizedPaperTitle.includes(normalizedTarget) ||
            normalizedTarget.includes(normalizedPaperTitle)
          );
        });

        if (matchedPaper) {
          handlePaperClick(matchedPaper);
          setTimeout(() => {
            const pageEl = document.getElementById(`pdf-page-${page}`);
            if (pageEl) {
              pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 800);
        }
      }
    },
    [tabs, activeTabId, papers],
  );

  // Sending chat messages
  const handleSendMessage = async (
    customText?: string,
    options: { isHidden?: boolean; fromSidePanel?: boolean } = {},
  ) => {
    let textToSend = "";
    if (customText) {
      textToSend = customText;
    } else {
      const isFromAssistant =
        options.fromSidePanel || activeTab.type !== "chat";
      textToSend = isFromAssistant ? assistantInput : chatInput;
    }

    if (!textToSend.trim()) return;

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: textToSend,
      timestamp: Date.now(),
      isHidden: options.isHidden ?? false,
      attachment: attachedFile ? { ...attachedFile } : undefined,
    };

    setAttachedFile(null);

    updateChatMessages((prev) => [...prev, userMessage], false);
    if (!customText) {
      const isFromAssistant =
        options.fromSidePanel || activeTab.type !== "chat";
      if (isFromAssistant) {
        setAssistantInput("");
      } else {
        setChatInput("");
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, chatInput: "" } : t)),
        );
      }
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsAiTyping(true);

    // Generate a title for this chat session EARLIER if it's currently "Untitled" or "New chat"
    const currentTabId = activeTabIdRef.current;
    const currentTab = tabsRef.current.find((t) => t.id === currentTabId);
    if (
      currentTab &&
      currentTab.type === "chat" &&
      (currentTab.title === "Untitled" || currentTab.title === "New chat")
    ) {
      // Fire and forget (don't await) so it runs in parallel with the main stream
      fetch("/api/research/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userQuery: textToSend }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((titleData) => {
          if (titleData?.title) {
            setTabs((prev) => {
              const updatedTabs = prev.map((t) =>
                t.id === currentTabId ? { ...t, title: titleData.title } : t,
              );
              const updatedTab = updatedTabs.find(
                (t) => t.id === currentTabId,
              );
              if (updatedTab) {
                saveChatToLibrary(currentUser?.uid || "guest", updatedTab).catch(
                  console.error,
                );
              }
              return updatedTabs;
            });
          }
        })
        .catch((errTitle) =>
          console.error("Failed to generate title", errTitle),
        );
    }

    try {
      // Try hitting our real server-side Gemini research chat endpoint!
      const currentAttachment = attachedFile ? {
        fileId: attachedFile.fileId,
        fileName: attachedFile.fileName,
        mimetype: attachedFile.mimetype,
        url: attachedFile.url
      } : null;

      const response = await fetch("/api/research/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage]
            .slice(-20)
            .map((m) => ({ 
              role: m.role, 
              content: m.content,
              attachment: m.attachment ? { fileId: m.attachment.fileId, fileName: m.attachment.fileName, mimetype: m.attachment.mimetype } : undefined
            })),
          model: (currentAttachment && !currentAttachment.mimetype?.startsWith("image/")) ? "mistral-large-latest" : selectedModel,
          webSearch: webSearchEnabled,
          attachment: currentAttachment,
          context: {
            notes: [
              `Document Title: ${documentTitle}`,
              `Saved under folder: ${folderName}`,
              `Note context: ${savedNoteName}`,
            ],
            citations: papers.map((p, idx) => ({
              title: p.title,
              authors: p.author,
              source: "Academic Import Database",
              year: p.author.match(/\d{4}/)?.[0] || "2023",
              format: "APA",
              fullText:
                idx < 15
                  ? (p.extractedText || p.summary || "").substring(0, 15000)
                  : (p.summary || "").substring(0, 3000),
            })),
            outline: [
              {
                id: "sec-main",
                level: 1,
                title: documentTitle,
                points: [folderName, savedNoteName],
                draftContent: documentContent,
                linkedCitations: [],
              },
            ],
          },
        }),
        signal: controller.signal,
      });

      // Clear the uploader uis instantly after starting request
      setAttachedFile(null);

      if (!response.ok) {
        throw new Error("API server returned status " + response.status);
      }

      assistantMessageIdRef.current = String(Date.now() + 1);
      updateChatMessages(
        (prev) => [
          ...prev,
          {
            id: assistantMessageIdRef.current!,
            role: "assistant",
            content: "",
            thought: "",
            timestamp: Date.now(),
          },
        ],
        false,
      );

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let hasSwitchedToDoc = false;
      let targetTabIdForAi: string | undefined;
      let streamBuffer = "";
      let hasTriggeredDownloadPaper = false;
      let lastGeneratedHtml = "";
      let lastGeneratedTitle = "";

      aiWritingTabIdRef.current = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split("\n");
          // Keep the last incomplete line in the buffer
          streamBuffer = lines.pop() || "";

          if (lines.length > 0) {
            updateChatMessages((prev) => prev); // Final update to sync tabs
          }

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            if (trimmedLine.startsWith("data: ")) {
              const data = trimmedLine.slice(6).trim();
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.status === "editor_agent") {
                  setResearchStatus("editor_agent");
                } else if (parsed.status === "editor_agent_done") {
                  setResearchStatus(null);
                }
                if (parsed.text) {
                  accumulatedText += parsed.text;

                  // Extract <chat>
                  const {
                    thought,
                    chat,
                    title: parsedTitle,
                    replaceContent: parsedContent,
                    searchRealPapersQuery,
                  } = parseAssistantResponse(accumulatedText);

                  if (chat !== undefined) {
                    updateChatMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageIdRef.current
                          ? { ...m, content: chat }
                          : m,
                      ),
                    );
                  }

                  if (thought !== undefined) {
                    updateChatMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageIdRef.current
                          ? { ...m, thought: thought }
                          : m,
                      ),
                    );
                  }

                  if (parsedTitle) {
                    setDocumentTitle(parsedTitle);
                    lastGeneratedTitle = parsedTitle;
                  }

                  // Process real paper search
                  if (
                    searchRealPapersQuery &&
                    accumulatedText
                      .toLowerCase()
                      .includes("</searchrealpapers>") &&
                    !hasTriggeredDownloadPaper
                  ) {
                    hasTriggeredDownloadPaper = true;
                    setResearchStatus("fetching");
                    try {
                      fetch("/api/search-arxiv", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query: searchRealPapersQuery }),
                      })
                        .then((res) => res.json())
                        .then(async (resData) => {
                          if (resData.success && resData.papers) {
                            setResearchStatus("downloading");
                            const newPapers = await Promise.all(
                              resData.papers.map(async (p: any) => {
                                if (p.fileId) setResearchStatus("polishing");
                                return {
                                  title: p.title,
                                  author: p.author,
                                  description: p.abstract,
                                  url: p.url,
                                  added: "Today",
                                  fullTextStatus: p.fileId
                                    ? "Mapped"
                                    : "Link Only",
                                  viewed: "Yes",
                                  fileType: "Document",
                                  summary: p.abstract || "",
                                  fileId: p.fileId,
                                  mimetype: p.mimetype || "application/pdf",
                                  extractedText: p.fileId
                                    ? await extractTextFromPdf(
                                        `/api/files/${p.fileId}`,
                                      )
                                    : "",
                                  folderId:
                                    selectedFolderId || folders[0]?.id || "f1",
                                };
                              }),
                            );

                            newPapers.forEach((np) => {
                              dbSetPaper(np);
                            });
                            setResearchStatus(null);

                            // Auto-trigger messages for each found paper depending on if file downloaded successfully
                            newPapers.forEach((p) => {
                              if (!p.fileId) {
                                setTimeout(() => {
                                  const assistantMsg: ChatMessage = {
                                    id: String(Date.now() + Math.random()),
                                    role: "assistant",
                                    content: `### ⚠️ Could not auto-download: ${p.title}\n\nThe full-text document is hosted behind a restricted publisher credential check or locked portal.\n\n* **Direct Link:** [Open original paper URL in browser](${p.url || "#"}) ↗\n* **Suggested Alternative:** Look for this title on open repositories like Google Scholar, ResearchGate, or arXiv.\n* **Manual Upload:** If you already have the PDF file downloaded locally on your device, simply drag and drop or click upload inside your folders sidebar to instantly parse, summarize, and cite the document here!`,
                                    timestamp: Date.now(),
                                  };
                                  updateChatMessages(
                                    (prev) => [...prev, assistantMsg],
                                    false,
                                  );
                                }, 1000);
                              }
                            });

                            const newTabs = newPapers
                              .filter((p: any) => p.fileId)
                              .flatMap((p: any) => {
                                let html = "";
                                if (p.extractedText) {
                                  const pages = p.extractedText.split(
                                    /--- Page \d+ of \d+ ---/,
                                  );
                                  const markers =
                                    p.extractedText.match(
                                      /--- Page (\d+) of \d+ ---/g,
                                    ) || [];

                                  html = `<div class="p-6 text-zinc-300 max-w-3xl mx-auto">
                                 <h1 class="text-3xl font-medium tracking-tight mb-2 text-white">${p.title}</h1>
                                 <p class="text-[11px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">Mapped Document: ${p.title}</p>
                                 <div class="h-[1px] bg-zinc-800 mb-6"></div>`;

                                  pages.forEach(
                                    (pageContent: string, idx: number) => {
                                      if (!pageContent.trim() && idx === 0)
                                        return;
                                      const pageNumMatch =
                                        idx > 0
                                          ? markers[idx - 1].match(/\d+/)
                                          : null;
                                      const pageNum = pageNumMatch
                                        ? pageNumMatch[0]
                                        : idx === 0
                                          ? "1"
                                          : idx.toString();

                                      html += `<div id="pdf-page-${pageNum}" class="mb-10 pt-4 border-t border-zinc-800/30 group/page">
                                   <div class="text-[10px] font-mono text-zinc-600 mb-4 uppercase tracking-widest group-hover/page:text-zinc-400 transition-colors">Page ${pageNum}</div>
                                   <div class="space-y-4 leading-relaxed">${pageContent
                                     .trim()
                                     .split("\n\n")
                                     .map((para: string) =>
                                       para.trim()
                                         ? `<p>${para.replace(/\n/g, "<br/>")}</p>`
                                         : "",
                                     )
                                     .join("")}</div>
                                 </div>`;
                                    },
                                  );
                                  html += `</div>`;
                                }

                                const overviewHtml = markdownToHtml(`## ${p.title}\n\n**Overview:**\n\n${formatAbstractText(p.summary || "I have successfully indexed this paper.")}`);

                                return [
                                  {
                                    id: `overview-${p.fileId}`,
                                    type: "document" as const,
                                    title: `Overview: ${p.title}`,
                                    content: overviewHtml,
                                    folderId: selectedFolderId || folders[0]?.id || "f1",
                                  },
                                  {
                                    id: `view-${p.fileId}`,
                                    type: "document" as const,
                                    title: p.title,
                                    content: html,
                                    fileId: p.fileId,
                                    mimetype: "application/pdf",
                                    folderId:
                                      selectedFolderId || folders[0]?.id || "f1",
                                  }
                                ];
                              });

                            if (newTabs.length > 0) {
                              setTabs((prev) => [...prev, ...newTabs]);
                              setTimeout(() => {
                                ignoreNextTabSyncRef.current = true;
                                setActiveTabId(newTabs[0].id);
                              }, 100);
                            }
                          }
                        })
                        .catch((err) => {
                          console.error("Error searching Arxiv:", err);
                          setResearchStatus(null);
                        });
                    } catch (err) {
                      console.error("Failed to make arxiv request", err);
                    }
                  }

                  if (
                    parsedContent &&
                    parsedContent.length > 5 &&
                    !parsedContent.trim().startsWith("</") &&
                    !parsedContent.trim().startsWith(">")
                  ) {
                    if (!hasSwitchedToDoc) {
                      hasSwitchedToDoc = true;

                      // Determine the target tab ID synchronously to avoid closure lag issues
                      const currentActive = tabs.find(
                        (t) => t.id === activeTabId,
                      );
                      const emptyDocTab = tabs.find(
                        (t) =>
                          t.type === "document" &&
                          !t.fileId &&
                          (!t.content ||
                            t.content.trim() === "" ||
                            t.content.trim() === "<p><br></p>"),
                      );

                      if (
                        currentActive &&
                        currentActive.type === "document" &&
                        !currentActive.fileId &&
                        (!currentActive.content ||
                          currentActive.content.trim() === "" ||
                          currentActive.content.trim() === "<p><br></p>")
                      ) {
                        targetTabIdForAi = currentActive.id;
                      } else if (emptyDocTab) {
                        targetTabIdForAi = emptyDocTab.id;
                      } else {
                        targetTabIdForAi = "doc-" + Date.now();
                      }

                      aiWritingTabIdRef.current = targetTabIdForAi;

                      setTabs((prev) => {
                        const exists = prev.find(
                          (t) => t.id === targetTabIdForAi,
                        );
                        if (exists) return prev;
                        return [
                          ...prev,
                          {
                            id: targetTabIdForAi!,
                            type: "document",
                            title: parsedTitle || "Untitled Document",
                            content: "",
                          },
                        ];
                      });

                      // Set active tab ID outside of the setTabs functional update
                      setTimeout(() => {
                        if (targetTabIdForAi) {
                          ignoreNextTabSyncRef.current = true;
                          setActiveTabId(targetTabIdForAi);
                        }
                      }, 0);
                    }

                    let rawContent = parsedContent;

                    // Strip conversational prologue before the first markdown header
                    const headingIndex = rawContent.indexOf("## ");
                    const h1Index = rawContent.indexOf("# ");
                    let firstValidIndex = -1;
                    if (headingIndex !== -1 && h1Index !== -1)
                      firstValidIndex = Math.min(headingIndex, h1Index);
                    else firstValidIndex = Math.max(headingIndex, h1Index);

                    if (firstValidIndex > 0) {
                      const introPart = rawContent.substring(
                        0,
                        firstValidIndex,
                      );
                      if (
                        /((?:Awesome)|(?:Sure)|(?:I've)|(?:I’ve)|(?:I’ll)|(?:I'll)|(?:Here)|(?:Got it)|(?:chat message))/i.test(
                          introPart,
                        )
                      ) {
                        rawContent = rawContent.substring(firstValidIndex);
                      }
                    }

                    rawContent = rawContent.trim();
                    const htmlContent = markdownToHtml(rawContent);
                    lastGeneratedHtml = htmlContent;

                    // Update the tabs array directly to ensure it preserves across navigation
                    if (targetTabIdForAi) {
                      setTabs((prev) =>
                        prev.map((t) =>
                          t.id === targetTabIdForAi
                            ? {
                                ...t,
                                content: htmlContent,
                                title: parsedTitle || t.title,
                              }
                            : t,
                        ),
                      );

                      // If this tab is currently being viewed, update the active editor state too
                      // We compare against the latest activeTabId from the closure-wrapped state or better yet, check current activeTabId
                      // Note: in effects/handlers, state might be stale if not careful, but usually handlers use the latest state if they are closure-wrapped
                      // To be safe, we can use a ref or check window state, but usually activeTabId is fresh enough in the async loop
                      // Wait, in a while loop, activeTabId value is captured at the start of the function.
                      // We should use an functional update or check a Ref for the LATEST active ID.
                      if (activeTabIdRef.current === targetTabIdForAi) {
                        setDocumentContent(htmlContent);
                        if (editorRef.current) {
                          editorRef.current.innerHTML = htmlContent;
                          lastContentRef.current = htmlContent;
                        }
                        if (parsedTitle) setDocumentTitle(parsedTitle);
                      }
                    } else {
                      // Fallback if no target tab was identified
                      setDocumentContent(htmlContent);
                      if (editorRef.current) {
                        editorRef.current.innerHTML = htmlContent;
                        lastContentRef.current = htmlContent;
                      }
                      if (parsedTitle) setDocumentTitle(parsedTitle);
                    }
                  }
                }
              } catch (e) {
                // ignore partial JSON parse errors just in case
              }
            }
          }
        }
      }

      updateChatMessages((prev) => prev, false);
      setIsAiTyping(false);
      aiWritingTabIdRef.current = null;

      if (targetTabIdForAi && lastGeneratedHtml) {
        const finalTitle = lastGeneratedTitle || "Untitled Document";
        const finalTabObj: Tab = {
          id: targetTabIdForAi,
          type: "document",
          title: finalTitle,
          content: lastGeneratedHtml,
          folderId: selectedFolderId || folders[0]?.id || "f1",
        };
        saveDraftToLibrary(finalTabObj);
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        console.log("AI streaming was aborted by the user.");
        return; // Exit without triggering the fallback
      }
      setIsAiTyping(false);
      aiWritingTabIdRef.current = null;
      console.warn(
        "Express server research LLM failed, using deep local simulation rules:",
        e,
      );
      // Fallback safely to our local academic intelligence
      const fallbackPayload = getFallbackResponse(textToSend);
      const simulatedAnswer = fallbackPayload.text;

      if (fallbackPayload.suggestion) {
        if (fallbackPayload.suggestion.type === "edit_document") {
          if (fallbackPayload.suggestion.title) {
            const newTitle = fallbackPayload.suggestion.title;
            setDocumentTitle(newTitle);
            setTabs((prev) =>
              prev.map((t) =>
                t.id === activeTabId ? { ...t, title: newTitle } : t,
              ),
            );
          }
          if (fallbackPayload.suggestion.appendContent) {
            const htmlContent = markdownToHtml(
              fallbackPayload.suggestion.appendContent,
            );
            setDocumentContent((prev) => {
              const newContent = prev + htmlContent;
              setTabs((prevTabs) =>
                prevTabs.map((t) =>
                  t.id === activeTabId ? { ...t, content: newContent } : t,
                ),
              );
              if (editorRef.current) {
                editorRef.current.innerHTML = newContent;
                lastContentRef.current = newContent;
              }
              return newContent;
            });
          }
          if (fallbackPayload.suggestion.replaceContent) {
            const htmlContent = markdownToHtml(
              fallbackPayload.suggestion.replaceContent,
            );
            setDocumentContent(htmlContent);
            setTabs((prev) =>
              prev.map((t) =>
                t.id === activeTabId ? { ...t, content: htmlContent } : t,
              ),
            );
            if (editorRef.current) {
              editorRef.current.innerHTML = htmlContent;
              lastContentRef.current = htmlContent;
            }
          }
        }
      }

      setTimeout(() => {
        updateChatMessages((prev) => {
          const idx = prev.findIndex(
            (m) => m.id === assistantMessageIdRef.current,
          );
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], content: simulatedAnswer };
            return next;
          }
          return [
            ...prev,
            {
              id: String(Date.now() + 1),
              role: "assistant",
              content: simulatedAnswer,
              timestamp: Date.now(),
            },
          ];
        });

        // Generate fallback title
        const currentTab = tabsRef.current.find(
          (t) => t.id === activeTabIdRef.current,
        );
        if (
          currentTab &&
          currentTab.type === "chat" &&
          (currentTab.title === "Untitled" || currentTab.title === "New chat")
        ) {
          const generatedFallbackTitle =
            textToSend.split(" ").slice(0, 3).join(" ") + "...";
          setTabs((prev) =>
            prev.map((t) =>
              t.id === currentTab.id
                ? { ...t, title: generatedFallbackTitle }
                : t,
            ),
          );
        }

        updateChatMessages((prev) => prev, false);
        setIsAiTyping(false);
      }, 1000);
      return;
    } finally {
      setIsAiTyping(false);
    }
  };

  // Paperclip file click trigger
  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  // Dynamic sort and filter logic
  const allLibraryItems = [...papers];

  const filteredPapers = allLibraryItems.filter((p) => {
    const matchesSearch = searchFilter
      ? p.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.author &&
          p.author.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (p.summary &&
          p.summary.toLowerCase().includes(searchFilter.toLowerCase()))
      : true;

    const matchesType = filterType === "all" ? true : p.fileType === filterType;
    return matchesSearch && matchesType;
  });

  const sortedPapers = [...filteredPapers].sort((a, b) => {
    let valA = "";
    let valB = "";

    if (sortBy === "title") {
      valA = a.title || "";
      valB = b.title || "";
    } else if (sortBy === "added") {
      valA = a.added || "";
      valB = b.added || "";
    } else if (sortBy === "viewed") {
      valA = a.viewed || "";
      valB = b.viewed || "";
    }

    const orderMultiplier = sortOrder === "asc" ? 1 : -1;
    return valA.localeCompare(valB) * orderMultiplier;
  });

  const isCallback = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("google_callback") === "1";
  if (isCallback) {
    return <DesktopAuthBridge />;
  }

  if (isAuthLoading) {
    return (
      <div className="h-screen bg-[#070707] flex flex-col items-center justify-center font-sans animate-none select-none">
        {/* Brand Lockup: cosmi word in lowercase, Plus Jakarta font, then logo beside it */}
        <div className="flex items-center gap-2.5 mb-6">
          <span className="text-3xl font-semibold tracking-normal text-white font-jakarta lowercase">
            cosmi
          </span>
          <img
            src="/cosmi.png"
            alt="Cosmi"
            className="w-8 h-8 select-none grayscale invert object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* LinkedIn-style loading below */}
        <div className="w-36 h-[2px] bg-zinc-800/80 rounded-full overflow-hidden relative">
          <div className="animate-slide-progress rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthenticationScreen onGoogleSignIn={handleGoogleLogin} />;
  }

  return (
    <div className="h-screen bg-[#070707] text-[#e4e4e7] font-sans flex selection:bg-[#262626] overflow-hidden relative">
      {isElectronApp && (
        <>
          <div className="fixed top-0 left-0 right-0 h-[38px] z-[9998] [-webkit-app-region:drag] pointer-events-none" />
          <div className="fixed top-0 right-0 h-[38px] flex items-center z-[9999] [-webkit-app-region:no-drag]">
            <button onClick={() => (window as any).electron?.minimize?.()} className="h-full px-4 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center">
              <Icon icon="ph:minus" className="w-[14px] h-[14px]" />
            </button>
            <button onClick={() => (window as any).electron?.maximize?.()} className="h-full px-4 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center">
              <Icon icon="ph:square" className="w-[12px] h-[12px]" />
            </button>
            <button onClick={() => (window as any).electron?.close?.()} className="h-full px-4 text-zinc-400 hover:text-white hover:bg-red-500 transition-colors cursor-pointer flex items-center justify-center">
              <Icon icon="ph:x" className="w-[14px] h-[14px]" />
            </button>
          </div>
        </>
      )}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.html,.csv,.json"
        onChange={async (e) => {
          const uploaderId = currentUserIdRef.current;
          const file = e.target.files?.[0];
          if (file) {
            const toastId = "upload-main-" + Date.now();
            showToast(
              `Uploading and mapping "${file.name}" (0%)...`,
              "loading",
              60000,
              toastId,
            );
            try {
              const data = await new Promise<any>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const formData = new FormData();
                formData.append("file", file);

                xhr.upload.addEventListener("progress", (event) => {
                  if (event.lengthComputable) {
                    const percent = Math.round(
                      (event.loaded / event.total) * 100,
                    );
                    showToast(
                      `Uploading and mapping "${file.name}" (${percent}%)...`,
                      "loading",
                      60000,
                      toastId,
                    );
                  }
                });

                xhr.addEventListener("load", () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                      resolve(JSON.parse(xhr.responseText));
                    } catch (err) {
                      reject(new Error("Invalid server response"));
                    }
                  } else {
                    let errMsg = `Server responded with status ${xhr.status}`;
                    reject(new Error(errMsg));
                  }
                });

                xhr.addEventListener("error", () =>
                  reject(new Error("Network upload error")),
                );
                xhr.addEventListener("abort", () =>
                  reject(new Error("Upload aborted")),
                );

                xhr.open("POST", "/api/upload");
                xhr.send(formData);
              });

              if (currentUserIdRef.current !== uploaderId) return;
              if (data.success) {
                const fileLabel = data.fileName;
                const titlePlaceholder = fileLabel.replace(/\.[^/.]+$/, "");
                const isImage = data.mimetype?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(fileLabel.toLowerCase().split('.').pop() || "");

                if (isImage) {
                  setAttachedFile({
                    fileId: data.fileId,
                    fileName: data.fileName,
                    mimetype: data.mimetype,
                    url: `/api/files/${data.fileId}`
                  });
                  showToast(`"${file.name}" attached successfully to chat.`, "success", 4000, toastId);
                  return;
                } else {
                  setAttachedFile({
                    fileId: data.fileId,
                    fileName: data.fileName,
                    mimetype: data.mimetype,
                    url: `/api/files/${data.fileId}`
                  });
                  setSelectedModel("mistral-large-latest");
                }

                let extractedText = "";
                let summaryInfo = `This academic resource was uploaded and incorporated into your workspace. Select 'Ask Assistant' to summarize patterns or find citations.`;
                let pagesCountString = "";

                if (fileLabel.toLowerCase().endsWith(".pdf")) {
                  // Pre-cache PDF in client-side storage so next view and parser is instant
                  preCachePdfFile(data.fileId, file);
                  try {
                    extractedText = await extractTextFromPdf(
                      `/api/files/${data.fileId}`,
                    );
                    if (extractedText) {
                      summaryInfo = `This PDF document is parsed and indexed successfully. You can write essays or ask questions about its exact contents.`;
                      // Count pages mapped
                      const pagesMatch = extractedText.match(
                        /--- Page \d+ of \d+ ---/g,
                      );
                      if (pagesMatch) {
                        pagesCountString = ` (${pagesMatch.length} pages mapped)`;
                      }
                    }
                  } catch (pdfErr) {
                    console.error("PDF mapping failed", pdfErr);
                  }
                } else if (
                  fileLabel.toLowerCase().endsWith(".docx") ||
                  fileLabel.toLowerCase().endsWith(".txt") ||
                  fileLabel.toLowerCase().endsWith(".md") ||
                  fileLabel.toLowerCase().endsWith(".html") ||
                  fileLabel.toLowerCase().endsWith(".htm")
                ) {
                  try {
                    const textRes = await fetch(
                      `/api/files/${data.fileId}/raw-text`,
                    );
                    if (textRes.ok) {
                      const textData = await textRes.json();
                      if (textData.success && textData.text) {
                        let cleanText = textData.text;
                        if (
                          fileLabel.toLowerCase().endsWith(".html") ||
                          fileLabel.toLowerCase().endsWith(".htm")
                        ) {
                          // Strip script / style tags and HTML tags for elegant context
                          cleanText = cleanText
                            .replace(
                              /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                              "",
                            )
                            .replace(
                              /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
                              "",
                            )
                            .replace(/<[^>]+>/g, " ")
                            .replace(/\s+/g, " ")
                            .trim();
                        }
                        extractedText = cleanText;
                        summaryInfo = `This document is parsed and mapped successfully. You can start synthesizing your notes, analyzing findings, and asking the Assistant specifically about its claims Simon.`;
                        const words = extractedText
                          .trim()
                          .split(/\s+/)
                          .filter(Boolean).length;
                        pagesCountString = ` (${words} words mapped)`;
                      }
                    }
                  } catch (docxErr) {
                    console.error("Docx/Text/HTML mapping failed", docxErr);
                  }
                }

                if (currentUserIdRef.current !== uploaderId) return;

                const targetFolder = selectedFolderId || folders[0]?.id || "f1";
                const parsedPaper: PaperItem = {
                  author: "Unknown Author",
                  title: titlePlaceholder,
                  description: `Uploaded draft document: ${fileLabel}`,
                  added: "Today",
                  fullTextStatus: "Available",
                  viewed: "Just now",
                  fileType: "Document",
                  summary: summaryInfo,
                  fileId: data.fileId,
                  mimetype: data.mimetype,
                  extractedText: extractedText,
                  folderId: targetFolder,
                };
                dbSetPaper(parsedPaper, true);

                const newId = `doc-${Date.now()}`;
                let initialContent = "";
                if (extractedText) {
                  const pages = extractedText.split(/--- Page \d+ of \d+ ---/);
                  const markers =
                    extractedText.match(/--- Page (\d+) of \d+ ---/g) || [];

                  initialContent = `<div class="p-6 text-zinc-300 max-w-3xl mx-auto">
                    <h1 class="text-3xl font-medium tracking-tight mb-2 text-white">${titlePlaceholder}</h1>
                    <p class="text-[11px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">Mapped Document: ${fileLabel}${pagesCountString}</p>
                    <div class="h-[1px] bg-zinc-800 mb-6"></div>`;

                  pages.forEach((pageContent: string, idx: number) => {
                    if (!pageContent.trim() && idx === 0) return;
                    const pageNumMatch =
                      idx > 0 ? markers[idx - 1].match(/\d+/) : null;
                    const pageNum = pageNumMatch
                      ? pageNumMatch[0]
                      : idx === 0
                        ? "1"
                        : idx.toString();

                    initialContent += `<div id="pdf-page-${pageNum}" class="mb-10 pt-4 border-t border-zinc-800/30 group/page">
                      <div class="text-[10px] font-mono text-zinc-600 mb-4 uppercase tracking-widest group-hover/page:text-zinc-400 transition-colors">Page ${pageNum}</div>
                      <div class="space-y-4 leading-relaxed">${pageContent
                        .trim()
                        .split("\n\n")
                        .map((p) =>
                          p.trim() ? `<p>${p.replace(/\n/g, "<br/>")}</p>` : "",
                        )
                        .join("")}</div>
                    </div>`;
                  });
                  initialContent += `</div>`;
                } else {
                  initialContent = `<div class="p-6 text-zinc-300 max-w-3xl mx-auto">
                      <h1 class="text-3xl font-medium tracking-tight mb-2 text-white">${titlePlaceholder}</h1>
                      <p class="text-[11px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">Document File: ${fileLabel}${pagesCountString}</p>
                      <div class="h-[1px] bg-zinc-800 mb-6"></div>
                      <p class="mb-4 leading-relaxed">The file has been uploaded securely and mapped. You can start synthesizing your notes, analyzing findings, and asking the Assistant specifically about its claims.</p>
                    </div>`;
                }

                setTabs((prev) => [
                  ...prev,
                  {
                    id: newId,
                    type: "document",
                    title: titlePlaceholder,
                    content: initialContent,
                    fileId: data.fileId,
                    mimetype: data.mimetype,
                    folderId: targetFolder,
                  },
                ]);
                setActiveTabId(newId);
                setSidebarView("files");
                setIsCreateDropdownOpen(false);
                setIsAssistantOpen(true);
                showToast(
                  `"${fileLabel}" uploaded and structured successfully!`,
                  "success",
                  3000,
                  toastId,
                );

                if (extractedText) {
                  setTimeout(() => {
                    handleSendMessage(
                      `Please thoroughly analyze the newly uploaded document titled "${fileLabel}". Here are the contents: \n\n${extractedText.substring(0, 10000)}\n\nProvide a comprehensive summary, highlight the main findings, and explain key claims in detail.`,
                      { isHidden: true },
                    );
                  }, 500);
                } else {
                  setTimeout(() => {
                    const assistantMsg: ChatMessage = {
                      id: String(Date.now()),
                      role: "assistant",
                      content: `### Document Mapped: ${fileLabel}\n\nI have successfully indexed **${fileLabel}** and mapped it to your workspace. The document metadata has been saved.`,
                      timestamp: Date.now(),
                    };
                    updateChatMessages(
                      (prev) => [...prev, assistantMsg],
                      false,
                    );
                  }, 500);
                }
              }
            } catch (err: any) {
              console.error("Upload failed", err);
              const errMsg =
                err?.message ||
                "The server returned an unexpected error format.";
              showToast(`Upload failed: ${errMsg}`, "error", 4000, toastId);
              // Inform the user via assistant message nicely
              setMessages((prev) => [
                ...prev,
                {
                  id: String(Date.now()),
                  role: "assistant",
                  content: `⚠️ **Upload failed**: ${errMsg}\n\n*Make sure the file is a valid PDF, DOC, or DOCX, and is under 15MB.*`,
                  timestamp: Date.now(),
                },
              ]);
            } finally {
              e.target.value = "";
            }
          }
        }}
      />

      {/* Left Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="flex flex-col h-full shrink-0 overflow-hidden bg-[#070707] font-jakarta"
          >
            {/* Primary Navigation Grid */}
            <nav className="px-3 grid grid-cols-4 gap-2 mb-3 relative">
              {[
                {
                  icon: "ph:pencil-line",
                  label: "Create",
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setIsCreateDropdownOpen(!isCreateDropdownOpen);
                  },
                  active: isCreateDropdownOpen,
                },
                {
                  icon: "ph:house",
                  label: "Home",
                  onClick: () => {
                    const homeTab = tabs.find((t) => t.type === "home");
                    if (homeTab) setActiveTabId(homeTab.id);
                    setSidebarView("files");
                  },
                  active: sidebarView === "files" || sidebarView === "chats",
                },
                {
                  icon: "ph:books",
                  label: "Library",
                  onClick: () => {
                    const libTab = tabs.find((t) => t.type === "library");
                    if (libTab) {
                      setActiveTabId(libTab.id);
                      setSidebarView("library");
                    } else {
                      const newId = `lib-${Date.now()}`;
                      setTabs([
                        ...tabs,
                        { id: newId, type: "library", title: "Library" },
                      ]);
                      setActiveTabId(newId);
                      setSidebarView("library");
                    }
                  },
                  active: sidebarView === "library",
                },
                {
                  icon: "ph:squares-four",
                  label: "Tools",
                  onClick: () => {
                    let toolsTab = tabs.find((t) => t.type === "tools");
                    if (!toolsTab) {
                      const newId = `tools-${Date.now()}`;
                      setTabs([
                        ...tabs,
                        { id: newId, type: "tools", title: "Statistics Tools" },
                      ]);
                      setActiveTabId(newId);
                    } else {
                      setActiveTabId(toolsTab.id);
                    }
                    setSidebarView("tools");
                  },
                  active: sidebarView === "tools",
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 transition-all duration-300 cursor-pointer ${
                    item.active
                      ? "text-white scale-105"
                      : "text-[#3f3f46] hover:text-[#a1a1aa] hover:bg-[#111111]"
                  }`}
                >
                  <Icon icon={item.icon} className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              ))}

              {/* Create Dropdown */}
              <AnimatePresence>
                {isCreateDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 5, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-3 w-48 bg-[#18181b] border border-[#27272a] rounded-xl py-1.5 z-[70]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        createNewDocument();
                        setIsCreateDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                    >
                      <Icon
                        icon="ph:file-text"
                        className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                      />
                      <span className="font-medium">New Document</span>
                    </button>
                    <button
                      onClick={() => {
                        const newId = `chat-${Date.now()}`;
                        setTabs([
                          ...tabs,
                          { id: newId, type: "chat", title: "Untitled" },
                        ]);
                        setActiveTabId(newId);
                        setIsCreateDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                    >
                      <Icon
                        icon="ph:chat-circle"
                        className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                      />
                      <span className="font-medium">New Chat</span>
                    </button>
                    <button
                      onClick={() => {
                        const newFolderId = `folder-${Date.now()}`;
                        const newFolder = {
                          id: newFolderId,
                          name: "Untitled Folder",
                          createdAt: Date.now(),
                        };
                        dbSetFolder(newFolder);
                        setSelectedFolderId(newFolderId);

                        // Open Library tab
                        const libTab = tabs.find((t) => t.type === "library");
                        if (libTab) {
                          setActiveTabId(libTab.id);
                        } else {
                          const newId = `lib-${Date.now()}`;
                          setTabs([
                            ...tabs,
                            { id: newId, type: "library", title: "Library" },
                          ]);
                          setActiveTabId(newId);
                        }
                        setIsCreateDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                    >
                      <Icon
                        icon="ph:folder-simple-plus"
                        className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                      />
                      <span className="font-medium">New Folder</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                    >
                      <Icon
                        icon="ph:upload-simple"
                        className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                      />
                      <span className="font-medium">Upload File</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </nav>

            {/* Files/Chats Toggle Tabs (Only shown when in files/chats mode) */}
            {(sidebarView === "files" || sidebarView === "chats") && (
              <div className="mx-3 mb-4 p-1 bg-[#111111] rounded-lg flex items-center gap-1">
                <button
                  onClick={() => setSidebarView("files")}
                  className={`flex-1 py-1 text-[11px] font-medium rounded-[6px] transition-all ${sidebarView === "files" ? "text-[#f4f4f5] bg-[#27272a]" : "text-[#71717a] hover:text-[#a1a1aa]"}`}
                >
                  Files
                </button>
                <button
                  onClick={() => setSidebarView("chats")}
                  className={`flex-1 py-1 text-[11px] font-medium rounded-[6px] transition-all ${sidebarView === "chats" ? "text-[#f4f4f5] bg-[#27272a]" : "text-[#71717a] hover:text-[#a1a1aa]"}`}
                >
                  Chats
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-3">
              {sidebarView === "files" && (
                <div className="space-y-2 select-none">
                  <div className="flex items-center justify-between px-2 mb-1.5">
                    <span className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">
                      Workspace Folders
                    </span>
                    <button
                      onClick={() => {
                        const newFolderId = `folder-${Date.now()}`;
                        dbSetFolder({
                          id: newFolderId,
                          name: "Untitled Folder",
                          createdAt: Date.now(),
                        });
                      }}
                      className="p-1 hover:bg-[#27272a] rounded text-[#71717a] hover:text-[#f4f4f5] transition-colors cursor-pointer"
                      title="New Folder"
                    >
                      <Icon
                        icon="ph:folder-simple-plus"
                        className="w-3.5 h-3.5"
                      />
                    </button>
                  </div>
                  {folders.map((folder) => {
                    const isExpanded = !!expandedFolders[folder.id];
                    const folderFiles = allLibraryItems.filter(
                      (item) => item.folderId === folder.id,
                    );
                    const isSelected =
                      selectedFolderId === folder.id &&
                      activeTab.type === "library";

                    return (
                      <div key={folder.id} className="space-y-0.5">
                        {/* Folder Row */}
                        <div
                          className={`flex items-center gap-1.5 p-1.5 rounded-lg transition-all group ${
                            isSelected
                              ? "bg-[#27272a]/40 text-white"
                              : "hover:bg-[#161616] text-[#a1a1aa] hover:text-white"
                          }`}
                        >
                          <button
                            onClick={() => {
                              setExpandedFolders((prev) => ({
                                ...prev,
                                [folder.id]: !prev[folder.id],
                              }));
                            }}
                            className="p-0.5 hover:bg-[#27272a] rounded text-[#71717a] hover:text-[#f4f4f5] cursor-pointer"
                          >
                            <Icon
                              icon="ph:caret-right"
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                            />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedFolderId(folder.id);
                              // Expand on select
                              setExpandedFolders((prev) => ({
                                ...prev,
                                [folder.id]: true,
                              }));

                              // Switch active tab to Library
                              const libTab = tabs.find(
                                (t) => t.type === "library",
                              );
                              if (libTab) {
                                setActiveTabId(libTab.id);
                              } else {
                                const newId = `lib-${Date.now()}`;
                                setTabs([
                                  ...tabs,
                                  {
                                    id: newId,
                                    type: "library",
                                    title: "Library",
                                  },
                                ]);
                                setActiveTabId(newId);
                              }
                            }}
                            className="flex-1 flex items-center justify-between min-w-0 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon
                                icon={
                                  isExpanded ? "ph:folder-open" : "ph:folder"
                                }
                                className={`w-4 h-4 shrink-0 col-[#52525b] ${isSelected ? "text-blue-400" : "text-zinc-500"}`}
                              />
                              <span className="text-xs font-semibold truncate text-[#a1a1aa] group-hover:text-white">
                                {folder.name}
                              </span>
                            </div>
                          </button>
                        </div>

                        {/* Nested Items */}
                        {isExpanded && (
                          <div className="pl-3.5 space-y-0.5 border-l border-[#27272a]/40 ml-3.5 my-1">
                            {folderFiles.length === 0 ? (
                              <div className="py-1 px-1.5 text-[10.5px] italic text-[#52525b] select-none">
                                Empty folder
                              </div>
                            ) : (
                              folderFiles.map((file, fIdx) => (
                                <button
                                  key={fIdx}
                                  onClick={() => handlePaperClick(file)}
                                  className="w-full flex items-center gap-1.5 pr-1 pl-1 py-1 rounded-[6px] text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#161616]/40 transition-all text-left min-w-0 cursor-pointer group"
                                  title={file.title}
                                >
                                  <Icon
                                    icon="ph:file-text"
                                    className="w-3.5 h-3.5 text-zinc-600 shrink-0 group-hover:text-zinc-400"
                                  />
                                  <span className="text-[11.5px] truncate font-medium flex-1 text-zinc-400 group-hover:text-white">
                                    {file.title}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {sidebarView === "chats" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2 mb-1">
                    <span className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">
                      Recent Chats
                    </span>
                    <button
                      onClick={() => {
                        const newId = `chat-${Date.now()}`;
                        const newChatTab: Tab = {
                          id: newId,
                          type: "chat",
                          title: "New chat",
                          messages: [],
                        };
                        setTabs([...tabs, newChatTab]);
                        setActiveTabId(newId);
                        saveChatToLibrary(currentUser?.uid || "guest", newChatTab);
                      }}
                      className="p-1 hover:bg-[#27272a] rounded text-[#71717a] hover:text-[#f4f4f5] transition-colors cursor-pointer"
                      title="New Chat"
                    >
                      <Icon icon="ph:plus" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {allChats.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-[#27272a] rounded-xl">
                      <Icon
                        icon="ph:chat-circle-dots"
                        className="w-8 h-8 text-[#27272a] mx-auto mb-2"
                      />
                      <p className="text-[11px] text-[#52525b]">
                        No recent chats
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {allChats.map((chatTab) => {
                        const isCurrent = chatTab.id === activeTabId;
                        const isOpen = tabs.some((t) => t.id === chatTab.id);
                        return (
                          <div
                            key={chatTab.id}
                            className={`group flex items-center justify-between px-2 py-1.5 rounded-lg transition-all ${
                              isCurrent
                                ? "bg-[#27272a]/50 text-white"
                                : "hover:bg-[#161616] text-[#a1a1aa] hover:text-[#f4f4f5]"
                            }`}
                          >
                            <button
                              onClick={() => {
                                if (isOpen) {
                                  setActiveTabId(chatTab.id);
                                } else {
                                  setTabs((prev) => [...prev, chatTab]);
                                  setActiveTabId(chatTab.id);
                                }
                              }}
                              className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                            >
                              <span className="text-xs truncate font-medium">
                                {cleanTitleStr(chatTab.title)}
                              </span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  window.confirm(
                                    "Are you sure you want to delete this chat permanently?",
                                  )
                                ) {
                                  deleteTab(chatTab.id);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#27272a] hover:text-[#ef4444] rounded transition-all cursor-pointer"
                              title="Delete Chat"
                            >
                              <Icon icon="ph:trash" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {sidebarView === "library" && (
                <div className="space-y-3">
                  <h3 className="text-[10px] text-[#52525b] uppercase font-bold tracking-wider px-2">
                    Citations ({papers.length})
                  </h3>
                  {papers.length === 0 ? (
                    <div className="px-2 py-6 border border-dashed border-zinc-800 rounded-xl text-center flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                        <Icon icon="ph:books" className="w-4 h-4" />
                      </div>
                      <p className="text-[11px] text-zinc-500 font-medium tracking-tight">
                        Library is empty
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {papers.map((paper, idx) => (
                        <div
                          key={idx}
                          className="relative p-3 bg-[#0a0a0a] border border-zinc-800/60 rounded-xl hover:border-zinc-700/80 transition-all duration-300 group overflow-hidden shadow-sm hover:shadow-md"
                        >
                          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                              <Icon icon="ph:bookmark-simple" className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-zinc-100 font-medium leading-tight mb-1 line-clamp-2">
                                {paper.title}
                              </p>
                              <p className="text-[10.5px] text-zinc-500 truncate flex items-center gap-1.5 mb-2.5">
                                <Icon icon="ph:user" className="w-3 h-3" />
                                {paper.author}
                              </p>
                              
                              <button
                                onClick={() => {
                                  const citation = `\n\n> *Citation: ${paper.title} - ${paper.author}*`;
                                  setDocumentContent((prev) => prev + citation);
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 border border-transparent hover:border-zinc-600/50 text-zinc-300 text-[10px] font-medium transition-all opacity-0 group-hover:opacity-100 w-full justify-center active:scale-[0.98] cursor-pointer"
                              >
                                <Icon icon="ph:quotes" className="w-3 h-3" />
                                Cite this paper
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {sidebarView === "tools" && (
                <div className="space-y-4 px-2 text-left select-none">
                  {/* Statistics Nest */}
                  <div className="space-y-1">
                    <button
                      onClick={() => setIsStatsSectionOpen(!isStatsSectionOpen)}
                      className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] text-[#71717a] hover:text-zinc-200 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon icon="ph:wrench-fill" className="w-3.5 h-3.5" />
                        <span>Tools</span>
                      </div>
                      <Icon
                        icon="ph:caret-down"
                        className={`w-3 h-3 transition-transform duration-200 ${isStatsSectionOpen ? "" : "-rotate-90"}`}
                      />
                    </button>

                    {isStatsSectionOpen && (
                      <div className="space-y-0.5 mt-1">
                        {[
                          {
                            id: "slovin",
                            label: "Slovin's Formula",
                            icon: "ph:calculator-fill",
                            color: "text-[#38bdf8]",
                          },
                          {
                            id: "percentage",
                            label: "Percentage Calc",
                            icon: "ph:percent-fill",
                            color: "text-[#10b981]",
                          },
                          {
                            id: "weighted",
                            label: "Weighted Mean",
                            icon: "ph:scales-fill",
                            color: "text-[#60a5fa]",
                          },
                          {
                            id: "likert",
                            label: "Likert Scale",
                            icon: "ph:check-square-fill",
                            color: "text-[#f59e0b]",
                          },
                          {
                            id: "ai",
                            label: "Cosmi Audit",
                            icon: "cosmi.png",
                            color: "",
                          },
                          {
                            id: "citation",
                            label: "Citation Generator",
                            icon: "ph:article-fill",
                            color: "text-[#fb7185]",
                          },
                        ].map((item) => {
                          const isCurrentlySelected =
                            activeToolsTab === item.id &&
                            activeTab.type === "tools";
                          return (
                            <button
                              key={item.id}
                              onClick={() => openToolsTab(item.id as any)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer text-left ${
                                isCurrentlySelected
                                  ? "bg-[#27272a] text-[#f4f4f5] font-medium"
                                  : "text-zinc-400 hover:text-zinc-200 hover:bg-[#161617]/50"
                              }`}
                            >
                              {item.icon.endsWith(".png") ? (
                                <img
                                  src={`/${item.icon}`}
                                  className="w-3.5 h-3.5 object-contain shrink-0"
                                  alt=""
                                />
                              ) : (
                                <Icon
                                  icon={item.icon}
                                  className={`w-3.5 h-3.5 ${item.color}`}
                                />
                              )}
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* History Nest */}
                  <div className="space-y-1 pt-2 border-t border-[#1e1e20]">
                    <button
                      onClick={() =>
                        setIsHistorySectionOpen(!isHistorySectionOpen)
                      }
                      className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] text-[#71717a] hover:text-zinc-200 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon
                          icon="ph:clock-counter-clockwise-fill"
                          className="w-3.5 h-3.5"
                        />
                        <span>History</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {toolsHistory.length > 0 && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setToolsHistory([]);
                              localStorage.removeItem("toolsHistory");
                            }}
                            className="text-[9px] text-[#52525b] hover:text-[#a1a1aa] transition-colors cursor-pointer lowercase font-normal tracking-normal"
                          >
                            clear all
                          </span>
                        )}
                        <Icon
                          icon="ph:caret-down"
                          className={`w-3 h-3 transition-transform duration-200 ${isHistorySectionOpen ? "" : "-rotate-90"}`}
                        />
                      </div>
                    </button>

                    {isHistorySectionOpen && (
                      <div className="space-y-1 mt-1">
                        {toolsHistory.length === 0 ? (
                          <div className="px-2 py-4 border border-dashed border-[#27272a]/60 rounded-xl text-center bg-[#0c0c0d]/40 my-1">
                            <p className="text-[10px] text-[#52525b]">
                              No computations saved
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                            {toolsHistory.map((item) => {
                              let iconName = "ph:calculator-fill";
                              let colorClass = "text-zinc-400";
                              if (item.type === "percentage") {
                                iconName = "ph:percent-fill";
                                colorClass = "text-[#10b981]";
                              } else if (item.type === "weighted") {
                                iconName = "ph:scales-fill";
                                colorClass = "text-[#38bdf8]";
                              } else if (item.type === "likert") {
                                iconName = "ph:check-square-fill";
                                colorClass = "text-[#f59e0b]";
                              } else if (item.type === "ai") {
                                iconName = "cosmi.png";
                                colorClass = "";
                              } else if (item.type === "citation") {
                                iconName = "ph:article-fill";
                                colorClass = "text-[#fb7185]";
                              }

                              return (
                                <div
                                  key={item.id}
                                  onClick={() => loadToolsHistoryItem(item)}
                                  className="group p-2 bg-[#0e0e0f]/80 hover:bg-[#121213] rounded-lg transition-all cursor-pointer relative"
                                >
                                  <button
                                    onClick={(e) =>
                                      deleteToolsHistoryItem(item.id, e)
                                    }
                                    className="absolute top-1 right-1 p-1 text-zinc-650 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete history item"
                                  >
                                    <Icon
                                      icon="ph:trash"
                                      className="w-2.5 h-2.5"
                                    />
                                  </button>
                                  <div className="flex items-start gap-1.5 text-left">
                                    {iconName.endsWith(".png") ? (
                                      <img
                                        src={`/${iconName}`}
                                        className="w-3 h-3 mt-0.5 object-contain shrink-0"
                                        alt=""
                                      />
                                    ) : (
                                      <Icon
                                        icon={iconName}
                                        className={`w-3 h-3 mt-0.5 shrink-0 ${colorClass}`}
                                      />
                                    )}
                                    <div className="flex-1 min-w-0 pr-3 text-left">
                                      <div className="text-[10px] font-medium text-zinc-300 truncate leading-tight">
                                        {item.title}
                                      </div>
                                      <div className="text-[9px] text-[#71717a] font-mono mt-0.5 truncate uppercase">
                                        {item.result}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Section */}
            <div className="mt-auto p-3">
              <button
                onClick={() => setShowBuyCoffeeModal(true)}
                className="w-full flex items-center gap-2.5 px-2 py-2 text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#1a1a1a] rounded-lg text-[12px] font-medium transition-all cursor-pointer group"
              >
                <Coffee className="w-3.5 h-3.5 text-[#52525b] group-hover:text-[#e3a088]" />
                <span>Buy me a coffee</span>
              </button>

              {/* User Profile Header */}
              <div className="p-1 mt-2 relative">
                {currentUser ? (
                  <>
                    <button
                      onClick={() =>
                        setIsProfileDropdownOpen(!isProfileDropdownOpen)
                      }
                      className="w-full flex items-center gap-2.5 text-[#f4f4f5] text-[12px] hover:bg-[#1a1a1a] p-1.5 rounded-lg transition-colors group cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#27272a] flex-shrink-0 flex items-center justify-center overflow-hidden border border-[#3f3f46]">
                        <img
                          src={
                            localStorage.getItem("cosmi_settings_avatar_url") ||
                            currentUser.photoURL ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.email || "Ron")}`
                          }
                          alt="Avatar"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="truncate font-medium flex-1 text-left">
                        {localStorage.getItem(`cosmi_settings_full_name_${currentUser?.uid || "guest"}`) ||
                          currentUser.displayName ||
                          currentUser.email ||
                          "Google Account"}
                      </span>
                      <Icon
                        icon="ph:caret-down"
                        className={`w-3.5 h-3.5 text-[#71717a] group-hover:text-[#f4f4f5] shrink-0 transition-transform duration-200 ${isProfileDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence>
                      {isProfileDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setIsProfileDropdownOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-3 right-3 bottom-full mb-1 z-40 bg-[#161616] border border-[#2d2d30] rounded-xl py-1.5 overflow-hidden"
                          >
                            <div className="px-3 py-2 border-b border-[#2d2d30] mb-1">
                              <p className="text-[10px] text-[#52525b] uppercase font-bold tracking-wider">
                                Account
                              </p>
                              <p className="text-[12px] text-[#e4e4e7] truncate">
                                {currentUser.email}
                              </p>
                            </div>
                            <button 
                              onClick={() => {
                                setIsProfileDropdownOpen(false);
                                setIsSettingsModalOpen(true);
                              }}
                              className="w-full text-left px-3 py-1.5 text-[12px] text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-[#e4e4e7] transition-colors flex items-center gap-2">
                              <Icon icon="ph:gear" className="w-3.5 h-3.5" />
                              Settings
                            </button>
                            <button
                              onClick={async () => {
                                setIsLoggingOut(true);
                                setIsProfileDropdownOpen(false);
                                // Hold for 3.5 seconds to show the shimmering "Logging out..." screen
                                setTimeout(async () => {
                                  try {
                                    await signOut(auth);
                                    setIsLoggingOut(false);
                                    // Clear local storage for a fresh start
                                    localStorage.removeItem(
                                      "cosmi_user_snapshot",
                                    );
                                  } catch (err) {
                                    console.error("Sign out error:", err);
                                    setIsLoggingOut(false);
                                  }
                                }, 3500);
                              }}
                              className="w-full text-left px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-950/20 transition-colors flex items-center gap-2 cursor-pointer animate-none"
                            >
                              <Icon
                                icon="ph:sign-out"
                                className="w-3.5 h-3.5"
                              />
                              Log out
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-[#1a1a1a] p-1.5 rounded-lg transition-colors group cursor-pointer text-[12px] font-medium"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#1c1c1e] border border-[#27272a] flex-shrink-0 flex items-center justify-center text-zinc-400 group-hover:text-zinc-200">
                      <Icon
                        icon="ph:google-logo"
                        className="w-3.5 h-3.5 text-zinc-400"
                      />
                    </div>
                    <span className="truncate flex-1 text-left">
                      Sign in with Google
                    </span>
                    <Icon
                      icon="ph:sign-in"
                      className="w-3.5 h-3.5 text-[#71717a] group-hover:text-[#f4f4f5] shrink-0"
                    />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content (Editor Column) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <header className="relative h-[38px] flex items-end shrink-0 bg-[#070707] px-2 [-webkit-app-region:drag]">
          <div className="flex items-center gap-3 h-full pb-1.5 pt-1.5 group z-20 bg-[#070707] pr-2 [-webkit-app-region:no-drag]">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`transition-all duration-300 cursor-pointer p-1 rounded-md ${isSidebarOpen ? "opacity-0 group-hover:opacity-100 bg-[#1a1a1a] text-[#f4f4f5]" : "text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#1a1a1a]"}`}
              title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
            >
              <Icon icon="ph:sidebar-simple" className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* Tabs Container */}
          <div
            className="flex-1 flex items-end h-full ml-1 gap-0 overflow-x-auto custom-scrollbar-h min-w-0 [-webkit-app-region:no-drag]"
            style={{
              paddingRight: isElectronApp 
                ? (isAssistantOpen ? "150px" : "235px") 
                : (isAssistantOpen ? "16px" : "96px"),
              WebkitMaskImage: !isAssistantOpen
                ? (isElectronApp
                    ? "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 230px), rgba(0,0,0,0) calc(100% - 140px))"
                    : "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 90px), rgba(0,0,0,0) 100%)")
                : (isElectronApp
                    ? "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 145px), rgba(0,0,0,0) 100%)"
                    : "none"),
              maskImage: !isAssistantOpen
                ? (isElectronApp
                    ? "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 230px), rgba(0,0,0,0) calc(100% - 140px))"
                    : "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 90px), rgba(0,0,0,0) 100%)")
                : (isElectronApp
                    ? "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 145px), rgba(0,0,0,0) 100%)"
                    : "none"),
            }}
          >
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTabId(tab.id);
                  if (tab.type === "tools") setSidebarView("tools");
                  else if (tab.type === "library") setSidebarView("library");
                  else if (tab.type === "chat") setSidebarView("chats");
                  else setSidebarView("files");
                }}
                className={`flex items-center gap-2 px-4 h-[32px] rounded-t-[8px] transition-colors cursor-pointer text-[13px] chrome-tab ${
                  activeTabId === tab.id
                    ? "bg-[#121212] text-[#e4e4e7] chrome-tab-active"
                    : "bg-transparent text-[#a1a1aa] hover:bg-[#121214] border-none"
                }`}
              >
                {tab.type === "home" ? (
                  <Icon icon="ph:house" className="w-3.5 h-3.5" />
                ) : tab.type === "library" ? (
                  <Icon icon="ph:books" className="w-3.5 h-3.5" />
                ) : tab.type === "chat" ? (
                  <Icon icon="ph:chat-circle" className="w-3.5 h-3.5" />
                ) : tab.type === "tools" ? (
                  <Icon icon="ph:squares-four" className="w-3.5 h-3.5" />
                ) : (
                  <Icon icon="ph:pencil-line" className="w-3.5 h-3.5" />
                )}
                <span className="truncate max-w-[130px]">
                  {tab.type === "home"
                    ? "Home"
                    : tab.type === "library"
                      ? "Library"
                      : tab.type === "tools"
                        ? "Tools"
                        : (tab.id === activeTabId &&
                          tab.type === "document" &&
                          (!tab.fileId || tab.mimetype !== "application/pdf")
                            ? documentTitle
                            : cleanTitleStr(tab.title)) || "Untitled"}
                </span>

                {tabs.length > 1 && (
                  <button
                    onClick={(e) => requestDeleteTab(tab.id, e)}
                    className="ml-2 hover:text-white p-0.5 rounded-sm hover:bg-white/10"
                  >
                    <Icon icon="ph:x" className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Add Tab Button */}
            <div
              onClick={() => {
                const newId = `home-${Date.now()}`;
                setTabs([...tabs, { id: newId, type: "home", title: "Home" }]);
                setActiveTabId(newId);
              }}
              className="flex items-center justify-center p-2 mb-0.5 ml-1 rounded-md hover:bg-[#1a1a1a] text-[#86868b] hover:text-[#e4e4e7] transition-colors cursor-pointer"
            >
              <Icon icon="ph:plus-circle" className="w-4 h-4" />
            </div>
          </div>

          {/* Right Header Navigation & Panel Controls */}
          {!isAssistantOpen && (
            <div className={`absolute bottom-[3px] z-20 flex items-center [-webkit-app-region:no-drag] ${isElectronApp ? "right-[145px]" : "right-2"}`}>
              <button
                onClick={() => setIsAssistantOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#222222] hover:border-[#3f3f46] transition-all cursor-pointer text-[12px] font-medium font-jakarta active:scale-[0.98] whitespace-nowrap"
                title="Open Assistant Source"
              >
                <img
                  src="/cosmi.png"
                  alt="Blob"
                  className="w-3.5 h-3.5 object-contain"
                />
                <span>Blob</span>
              </button>
            </div>
          )}
        </header>

        {/* Main Editor Component Container */}
        <div className="relative flex-1 bg-[#121212] rounded-2xl flex flex-row overflow-hidden min-w-0 transition-all">
          <div className="flex-1 flex flex-col min-w-0">
            {activeTab.type === "home" ? (
              <div className="flex-1 overflow-y-auto focus:outline-none scroll-smooth">
                <div className="max-w-[800px] mx-auto w-full p-8 md:p-14 lg:p-20 flex flex-col justify-center min-h-full">
                  {(() => {
                    const hour = new Date().getHours();
                    let timeGreeting = "Good evening";
                    if (hour < 12) timeGreeting = "Good morning";
                    else if (hour < 18) timeGreeting = "Good afternoon";
                    const customFullName = localStorage.getItem(`cosmi_settings_full_name_${currentUser?.uid || "guest"}`);
                    const preferredName = callMe || (customFullName ? customFullName.trim().split(" ")[0] : (currentUser?.displayName ? currentUser.displayName.split(" ")[0] : ""));
                    return (
                      <h1 className="text-3xl md:text-4xl text-[#f4f4f5] font-medium tracking-tight mb-8">
                        {timeGreeting}
                        {preferredName ? `, ${preferredName}` : ""}.
                      </h1>
                    );
                  })()}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                    <button
                      onClick={() => {
                        const docTab = tabs.find(
                          (t) => t.type === "document" && !t.fileId,
                        );
                        if (docTab) {
                          setActiveTabId(docTab.id);
                        } else {
                          createNewDocument();
                        }
                      }}
                      className="flex items-center p-4 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#222222] transition-colors rounded-3xl text-left cursor-pointer group"
                    >
                      <div className="mr-5">
                        <Icon
                          icon="ph:pencil-line"
                          className="w-7 h-7 text-[#f4f4f5]"
                        />
                      </div>
                      <div>
                        <h3 className="text-[#e4e4e7] font-medium text-sm">
                          Resume Document
                        </h3>
                        <p className="text-[#a1a1aa] text-xs mt-0.5 truncate max-w-[200px]">
                          {tabs.find((t) => t.type === "document" && !t.fileId)
                            ?.title || "Untitled Document"}
                        </p>
                      </div>
                    </button>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsHomeCreateDropdownOpen(
                            !isHomeCreateDropdownOpen,
                          );
                        }}
                        className={`flex w-full items-center p-4 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#222222] transition-all rounded-3xl text-left cursor-pointer group ${isHomeCreateDropdownOpen ? "ring-1 ring-zinc-500 bg-[#222222]" : ""}`}
                      >
                        <div className="mr-5">
                          <Icon
                            icon="ph:plus-circle"
                            className={`w-7 h-7 text-[#e4e4e7] transition-transform ${isHomeCreateDropdownOpen ? "rotate-45" : ""}`}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-[#e4e4e7] font-medium text-sm">
                            Create New
                          </h3>
                          <p className="text-[#a1a1aa] text-xs mt-0.5">
                            Start a blank hypothesis
                          </p>
                        </div>
                        <Icon
                          icon="ph:caret-down"
                          className={`w-4 h-4 text-[#71717a] transition-transform ${isHomeCreateDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      <AnimatePresence>
                        {isHomeCreateDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 8, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 w-56 bg-[#18181b] border border-[#27272a] rounded-2xl py-2 z-[70] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                createNewDocument();
                                setIsHomeCreateDropdownOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                            >
                              <Icon
                                icon="ph:file-text"
                                className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors"
                              />
                              <span className="font-medium text-xs text-left">
                                New Document
                              </span>
                            </button>

                            <button
                              onClick={() => {
                                const newId = `chat-${Date.now()}`;
                                setTabs([
                                  ...tabs,
                                  {
                                    id: newId,
                                    type: "chat",
                                    title: "Untitled",
                                  },
                                ]);
                                setActiveTabId(newId);
                                setIsHomeCreateDropdownOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                            >
                              <Icon
                                icon="ph:chat-circle"
                                className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors"
                              />
                              <span className="font-medium text-xs text-left">
                                Talk to Cosmi
                              </span>
                            </button>

                            <div className="h-[1px] bg-[#27272a] mx-4 my-1" />

                            <button
                              onClick={() => {
                                const newFolderId = `folder-${Date.now()}`;
                                dbSetFolder({
                                  id: newFolderId,
                                  name: "Untitled Folder",
                                  createdAt: Date.now(),
                                });
                                setIsHomeCreateDropdownOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                            >
                              <Icon
                                icon="ph:folder-simple-plus"
                                className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors"
                              />
                              <span className="font-medium text-xs text-left">
                                New Folder
                              </span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <h2 className="text-sm font-semibold text-[#a1a1aa] uppercase tracking-wider mb-6">
                    Recent Folders
                  </h2>
                  <div className="relative group/carousel">
                    <div
                      className="flex overflow-x-auto gap-4 pb-6 custom-scrollbar-h scroll-smooth"
                      style={{
                        WebkitMaskImage:
                          "linear-gradient(to right, rgba(0,0,0,1) 82%, rgba(0,0,0,0) 98%)",
                        maskImage:
                          "linear-gradient(to right, rgba(0,0,0,1) 82%, rgba(0,0,0,0) 98%)",
                      }}
                    >
                      {folders.slice(0, 6).map((folder, idx) => (
                        <button
                          key={folder.id}
                          onClick={() => {
                            setSelectedFolderId(folder.id);
                            const libraryTab = tabs.find(
                              (t) => t.type === "library",
                            );
                            if (libraryTab) {
                              setActiveTabId(libraryTab.id);
                            } else {
                              const newId = `library-${Date.now()}`;
                              setTabs([
                                ...tabs,
                                {
                                  id: newId,
                                  type: "library",
                                  title: "Library",
                                },
                              ]);
                              setActiveTabId(newId);
                            }
                          }}
                          className="flex flex-col items-start p-6 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#222222] transition-all duration-300 rounded-[28px] text-left cursor-pointer group min-w-[240px] shrink-0"
                        >
                          <div className="mb-4">
                            <Icon
                              icon="ph:folder-user"
                              className="w-10 h-10 text-[#f4f4f5]"
                            />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[#e4e4e7] font-medium text-base truncate mb-1">
                              {folder.name}
                            </h3>
                            <p className="text-[#71717a] text-xs">
                              {idx === 0
                                ? "Recently updated"
                                : idx === 1
                                  ? "Last week"
                                  : "Research project"}
                            </p>
                          </div>
                        </button>
                      ))}
                      {/* Spacer for right padding in overflow */}
                      <div className="min-w-[40px] shrink-0 h-full" />
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab.type === "chat" ? (
              <div className="flex-1 flex flex-col bg-[#121212] relative overflow-hidden">
                {/* Chat Header */}
                <header className="h-[52px] flex items-center justify-between px-4 shrink-0 relative border-b border-[#1c1c1f] z-45">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      {isRenamingChat === activeTab.id ? (
                        <input
                          autoFocus
                          value={renamingChatText}
                          onChange={(e) => setRenamingChatText(e.target.value)}
                          onKeyDown={handleRenameChat}
                          onBlur={handleRenameChat}
                          className="bg-[#1a1a1a] text-[#e4e4e7] text-[13px] font-medium px-3 py-1.5 rounded-xl border border-[#3f3f46] outline-none w-48"
                        />
                      ) : (
                        <button
                          onClick={() =>
                            setIsChatDropdownOpen(!isChatDropdownOpen)
                          }
                          className="flex items-center gap-1.5 text-[#e4e4e7] hover:bg-[#1a1a1a] px-3 py-1.5 rounded-xl transition-colors cursor-pointer group"
                        >
                          <span className="font-medium text-[13px]">
                            {cleanTitleStr(activeTab.title)}
                          </span>
                          <Icon
                            icon="ph:caret-down"
                            className={`w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-transform ${isChatDropdownOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                      )}

                      {isChatDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsChatDropdownOpen(false)}
                          />
                          <div className="absolute top-full left-0 mt-1.5 w-64 bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 max-h-72 overflow-y-auto shadow-2xl">
                            <div className="px-2.5 py-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider select-none">
                              All Chats
                            </div>
                            {tabs
                              .filter((t) => t.type === "chat")
                              .map((chatTab) => (
                                <button
                                  key={chatTab.id}
                                  onClick={() => {
                                    setActiveTabId(chatTab.id);
                                    setIsChatDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer ${
                                    chatTab.id === activeTabId
                                      ? "bg-[#27272a] text-white"
                                      : "text-zinc-400 hover:text-white hover:bg-[#222222]"
                                  }`}
                                >
                                  <Icon
                                    icon="ph:chat-circle"
                                    className="w-4 h-4 shrink-0 text-zinc-500"
                                  />
                                  <span className="text-xs font-medium truncate">
                                    {cleanTitleStr(chatTab.title)}
                                  </span>
                                </button>
                              ))}
                            <div className="border-t border-[#2d2d30] my-1" />
                            <button
                              onClick={() => {
                                const newId = `chat-${Date.now()}`;
                                setTabs([
                                  ...tabs,
                                  {
                                    id: newId,
                                    type: "chat",
                                    title: "Untitled",
                                  },
                                ]);
                                setActiveTabId(newId);
                                setIsChatDropdownOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-zinc-400 hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
                            >
                              <Icon
                                icon="ph:plus"
                                className="w-4 h-4 shrink-0 text-zinc-500"
                              />
                              <span className="text-xs font-semibold">
                                New Chat
                              </span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const newId = `chat-${Date.now()}`;
                        setTabs([
                          ...tabs,
                          { id: newId, type: "chat", title: "Untitled" },
                        ]);
                        setActiveTabId(newId);
                      }}
                      className="p-2 text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#1a1a1a] rounded-xl transition-colors cursor-pointer"
                      title="New Chat"
                    >
                      <Icon icon="ph:plus" className="w-4 h-4" />
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setIsChatMenuOpen(!isChatMenuOpen)}
                        className={`p-2 text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#1a1a1a] rounded-xl transition-colors cursor-pointer ${isChatMenuOpen ? "bg-[#1a1a1a] text-[#e4e4e7]" : ""}`}
                      >
                        <Icon
                          icon="ph:dots-three-outline-fill"
                          className="w-4 h-4"
                        />
                      </button>

                      {isChatMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsChatMenuOpen(false)}
                          />
                          <div className="absolute top-full right-0 mt-1.5 w-40 bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1 flex flex-col gap-0.5 shadow-2xl">
                            <button
                              onClick={() => {
                                setIsRenamingChat(activeTab.id);
                                setRenamingChatText(activeTab.title);
                                setIsChatMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-zinc-400 hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
                            >
                              <Icon
                                icon="ph:pencil-simple"
                                className="w-4 h-4"
                              />
                              <span className="text-xs font-medium">
                                Rename
                              </span>
                            </button>
                            <button
                              onClick={() => deleteTab(activeTab.id)}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                              <Icon icon="ph:trash" className="w-4 h-4" />
                              <span className="text-xs font-medium">
                                Delete chat
                              </span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </header>

                {/* Chat Content Area replaced */}
                <MainChat
                  tab={activeTab}
                  messages={messages}
                  chatInput={chatInput}
                  setChatInput={setChatInput}
                  isAiTyping={isAiTyping}
                  handleSendMessage={async (customText, options) => {
                    await handleSendMessage(customText, options);
                  }}
                  researchStatus={researchStatus}
                  currentUser={currentUser}
                  isOnline={isOnline}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  webSearchEnabled={webSearchEnabled}
                  setWebSearchEnabled={setWebSearchEnabled}
                  attachedFile={attachedFile}
                  setAttachedFile={setAttachedFile}
                  handlePaperclipClick={handlePaperclipClick}
                  handleStopGeneration={() => {
                    abortControllerRef.current?.abort();
                    setIsAiTyping(false);
                    updateChatMessages((prev) => prev, false);
                  }}
                />
              </div>
            ) : activeTab.type === "library" ? (
              <div className="flex-1 overflow-y-auto focus:outline-none bg-[#121212] flex flex-col">
                <div className="w-full px-[1px] py-6 flex-1 flex flex-col">
                  {/* Header section - Millimeter margin from edge */}
                  <div className="flex items-center justify-between mb-8 px-4">
                    <div>
                      <h1 className="text-2xl text-[#f4f4f5] font-medium tracking-tight">
                        {selectedFolderId
                          ? folders.find((f) => f.id === selectedFolderId)
                              ?.name || "Library"
                          : "Library"}
                      </h1>
                      {!selectedFolderId && (
                        <p className="text-[#71717a] text-[11px] mt-1">
                          Files, research assets, and citation repository
                        </p>
                      )}
                    </div>

                    <div className="relative w-64">
                      <Icon
                        icon="ph:magnifying-glass"
                        className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500"
                      />
                      <input
                        type="text"
                        placeholder="Search collection..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-[#27272a] rounded-lg pl-9 pr-3 py-1.5 text-zinc-200 text-xs focus:border-zinc-400 focus:outline-none placeholder:text-zinc-600 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Toolbar - Aligned precisely with table edge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 select-none relative px-4 text-zinc-400">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsDisplayDropdownOpen(!isDisplayDropdownOpen);
                            setIsSortDropdownOpen(false);
                            setIsFilterDropdownOpen(false);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            isDisplayDropdownOpen
                              ? "bg-[#27272a] text-white border-zinc-500"
                              : "bg-[#1a1a1a] hover:bg-[#222222] border-[#27272a] text-[#e4e4e7]"
                          }`}
                        >
                          <Icon icon="ph:rows" className="w-3.5 h-3.5" />
                          <span>Display</span>
                        </button>
                        {isDisplayDropdownOpen && (
                          <div className="absolute left-0 mt-1.5 w-44 bg-[#121212] border border-[#27272a] rounded-lg py-1 shadow-xl z-50 text-xs text-zinc-300">
                            <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                              Density
                            </div>
                            <button
                              onClick={() => {
                                setDisplayDensity("comfortable");
                                setIsDisplayDropdownOpen(false);
                              }}
                              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                            >
                              <span>Comfortable</span>
                              {displayDensity === "comfortable" && (
                                <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setDisplayDensity("compact");
                                setIsDisplayDropdownOpen(false);
                              }}
                              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                            >
                              <span>Compact</span>
                              {displayDensity === "compact" && (
                                <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSortDropdownOpen(!isSortDropdownOpen);
                            setIsDisplayDropdownOpen(false);
                            setIsFilterDropdownOpen(false);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            isSortDropdownOpen
                              ? "bg-[#27272a] text-white border-zinc-500"
                              : "bg-[#1a1a1a] hover:bg-[#222222] border-[#27272a] text-[#e4e4e7]"
                          }`}
                        >
                          <Icon icon="ph:arrows-down-up" className="w-3.5 h-3.5" />
                          <span>Sort</span>
                        </button>
                        {isSortDropdownOpen && (
                          <div className="absolute left-0 mt-1.5 w-48 bg-[#121212] border border-[#27272a] rounded-lg py-1 shadow-xl z-50 text-xs text-zinc-300">
                            <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                              Sort By
                            </div>
                            <button
                              onClick={() => setSortBy("title")}
                              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                            >
                              <span>Title</span>
                              {sortBy === "title" && (
                                <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                              )}
                            </button>
                            <button
                              onClick={() => setSortBy("added")}
                              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                            >
                              <span>Date Added</span>
                              {sortBy === "added" && (
                                <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                              )}
                            </button>
                            <button
                              onClick={() => setSortBy("viewed")}
                              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                            >
                              <span>Last Viewed</span>
                              {sortBy === "viewed" && (
                                <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                              )}
                            </button>

                            <div className="my-1 border-t border-[#27272a]" />

                            <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                              Direction
                            </div>
                            <button
                              onClick={() => setSortOrder("asc")}
                              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                            >
                              <span>Ascending</span>
                              {sortOrder === "asc" && (
                                <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                              )}
                            </button>
                            <button
                              onClick={() => setSortOrder("desc")}
                              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                            >
                              <span>Descending</span>
                              {sortOrder === "desc" && (
                                <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsFilterDropdownOpen(!isFilterDropdownOpen);
                            setIsDisplayDropdownOpen(false);
                            setIsSortDropdownOpen(false);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            isFilterDropdownOpen
                              ? "bg-[#27272a] text-white border-zinc-500"
                              : "bg-[#1a1a1a] hover:bg-[#222222] border-[#27272a] text-[#e4e4e7]"
                          }`}
                        >
                          <Icon icon="ph:sliders-horizontal" className="w-3.5 h-3.5" />
                          <span>Filter</span>
                        </button>
                        {isFilterDropdownOpen && (
                          <div className="absolute left-0 mt-1.5 w-44 bg-[#121212] border border-[#27272a] rounded-lg py-1 shadow-xl z-50 text-xs text-zinc-300">
                            <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                              File Type
                            </div>
                            <button
                              onClick={() => {
                                setFilterType("all");
                                setIsFilterDropdownOpen(false);
                              }}
                              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                            >
                              <span>All Files</span>
                              {filterType === "all" && (
                                <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setFilterType("Note");
                                setIsFilterDropdownOpen(false);
                              }}
                              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                            >
                              <span>Notes</span>
                              {filterType === "Note" && (
                                <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setFilterType("Document");
                                setIsFilterDropdownOpen(false);
                              }}
                              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                            >
                              <span>Documents</span>
                              {filterType === "Document" && (
                                <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:ml-auto text-xs w-full sm:w-auto justify-between sm:justify-end">
                      <span className="text-[#71717a] text-[11px] font-medium mr-1 select-none">
                        {sortedPapers.length} files in library
                      </span>
                      <div className="relative">
                        <button
                          onClick={() => {
                            setIsAddDropdownOpen(!isAddDropdownOpen);
                            setAddDropdownNested(null);
                          }}
                          className={`flex items-center gap-1.5 px-4 py-1.5 font-semibold rounded-xl transition-all cursor-pointer ${isAddDropdownOpen ? "bg-white text-zinc-950" : "bg-zinc-200 hover:bg-white text-zinc-950"}`}
                        >
                          <span className="text-[11px]">Add</span>
                          <Icon
                            icon="ph:caret-down"
                            className={`w-3 h-3 transition-transform ${isAddDropdownOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        <AnimatePresence>
                          {isAddDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 8, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 8, scale: 0.95 }}
                              className="absolute right-0 mt-2 w-52 bg-[#18181b] border border-[#27272a] rounded-xl py-1.5 z-[60]"
                            >
                              <button
                                onClick={() => {
                                  createNewDocument();
                                  setIsAddDropdownOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                              >
                                <Icon
                                  icon="ph:file-plus"
                                  className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                                />
                                <span className="font-medium">
                                  New document
                                </span>
                              </button>

                              <button
                                onClick={() => {
                                  handlePaperclipClick();
                                  setIsAddDropdownOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                              >
                                <Icon
                                  icon="ph:upload-simple"
                                  className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                                />
                                <span className="font-medium">File upload</span>
                              </button>

                              <button
                                onClick={() => {
                                  const newFolderId = `folder-${Date.now()}`;
                                  dbSetFolder({
                                    id: newFolderId,
                                    name: "Untitled Folder",
                                    createdAt: Date.now(),
                                  });
                                  setIsAddDropdownOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                              >
                                <Icon
                                  icon="ph:folder-plus"
                                  className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                                />
                                <span className="font-medium">New folder</span>
                              </button>

                              <div className="h-[1px] bg-[#27272a] my-1 mx-2" />

                              <div className="relative">
                                <button
                                  onMouseEnter={() =>
                                    setAddDropdownNested("import")
                                  }
                                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group ${addDropdownNested === "import" ? "bg-[#27272a] text-white" : ""}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <Icon
                                      icon="ph:download-simple"
                                      className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                                    />
                                    <span className="font-medium">Import</span>
                                  </div>
                                  <Icon
                                    icon="ph:caret-right"
                                    className="w-3 h-3 text-zinc-500"
                                  />
                                </button>

                                <AnimatePresence>
                                  {addDropdownNested === "import" && (
                                    <motion.div
                                      initial={{ opacity: 0, x: -8 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      exit={{ opacity: 0, x: -8 }}
                                      className="absolute right-full top-0 mr-1 w-48 bg-[#18181b] border border-[#27272a] rounded-xl py-1.5 z-[70]"
                                      onMouseLeave={() =>
                                        setAddDropdownNested(null)
                                      }
                                    >
                                      <button
                                        onClick={() => {
                                          setImportType("url");
                                          setImportModalOpen(true);
                                          setImportUrl("");
                                          setLinkAnalyzeError("");
                                          setLinkAnalyzeStatus("");
                                          setIsAddDropdownOpen(false);
                                          setAddDropdownNested(null);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                                      >
                                        <Icon
                                          icon="ph:link"
                                          className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                                        />
                                        <span className="font-medium">
                                          Public URL
                                        </span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setImportType("gdoc");
                                          setImportModalOpen(true);
                                          setImportUrl("");
                                          setLinkAnalyzeError("");
                                          setLinkAnalyzeStatus("");
                                          setIsAddDropdownOpen(false);
                                          setAddDropdownNested(null);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                                      >
                                        <img
                                          src="https://www.gstatic.com/images/branding/product/1x/docs_2020q4_48dp.png"
                                          alt="Google Docs"
                                          className="w-4 h-4 object-contain"
                                          referrerPolicy="no-referrer"
                                        />
                                        <span className="font-medium">
                                          Google Docs
                                        </span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setImportType("youtube");
                                          setImportModalOpen(true);
                                          setImportUrl("");
                                          setLinkAnalyzeError("");
                                          setLinkAnalyzeStatus("");
                                          setIsAddDropdownOpen(false);
                                          setAddDropdownNested(null);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                                      >
                                        <img
                                          src="https://www.gstatic.com/images/branding/product/1x/youtube_64dp.png"
                                          alt="YouTube"
                                          className="w-4 h-4 object-contain"
                                          referrerPolicy="no-referrer"
                                        />
                                        <span className="font-medium">
                                          YouTube
                                        </span>
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Real Folder & File System - Responsive Design with zero-glow buttons */}
                  {selectedFolderId === null ? (
                    <div className="flex-1 flex flex-col px-4 select-none">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs uppercase font-mono tracking-wider font-bold text-zinc-500">
                          Folders
                        </h2>
                      </div>

                      <div className="bg-[#121212] overflow-x-auto border border-[#27272a] rounded-xl flex flex-col">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                          <thead>
                            <tr className="border-b border-[#27272a] bg-[#161616]/40 text-[#71717a] text-[10.5px] font-jakarta tracking-wider uppercase">
                              <th className="py-3 pl-6 pr-3 font-semibold text-[#8a8a93]">
                                Folder Name
                              </th>
                              <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                                Items
                              </th>
                              <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                                Created Date
                              </th>
                              <th className="py-3 pr-6 pl-3 font-semibold text-[#8a8a93] text-right">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1e1e20] text-xs">
                            {folders.map((folder) => {
                              const folderFiles = sortedPapers.filter(
                                (p) => p.folderId === folder.id,
                              );
                              return (
                                <tr
                                  key={folder.id}
                                  onClick={() => setSelectedFolderId(folder.id)}
                                  className="hover:bg-[#1a1a1a]/40 transition-colors group cursor-pointer"
                                >
                                  <td className={`pl-6 pr-3 font-medium ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}>
                                    <div className="flex items-center gap-3">
                                      <Icon
                                        icon="ph:folder-open"
                                        className="w-4 h-4 text-zinc-400"
                                      />
                                      {renamingFolderId === folder.id ? (
                                        <input
                                          autoFocus
                                          value={renamingFolderTempName}
                                          onChange={(e) =>
                                            setRenamingFolderTempName(
                                              e.target.value,
                                            )
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              dbSetFolder({
                                                ...folder,
                                                name:
                                                  renamingFolderTempName.trim() ||
                                                  "Untitled Folder",
                                              });
                                              setRenamingFolderId(null);
                                            } else if (e.key === "Escape") {
                                              setRenamingFolderId(null);
                                            }
                                          }}
                                          onBlur={() => {
                                            dbSetFolder({
                                              ...folder,
                                              name:
                                                renamingFolderTempName.trim() ||
                                                "Untitled Folder",
                                            });
                                            setRenamingFolderId(null);
                                          }}
                                          className="bg-[#1a1a1a] border border-[#27272a] text-zinc-300 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-zinc-500 w-full max-w-[200px]"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : (
                                        <span className="text-[#f4f4f5] max-w-[300px] truncate">
                                          {folder.name}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className={`px-3 text-zinc-400 font-jakarta ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}>
                                    {folderFiles.length} item
                                    {folderFiles.length !== 1 ? "s" : ""}
                                  </td>
                                  <td className={`px-3 text-zinc-500 ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}>
                                    {new Date(
                                      folder.createdAt,
                                    ).toLocaleDateString()}
                                  </td>
                                  <td className={`pr-6 pl-3 ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}>
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRenamingFolderId(folder.id);
                                          setRenamingFolderTempName(
                                            folder.name,
                                          );
                                        }}
                                        className="p-1.5 hover:bg-[#27272a] rounded text-zinc-400 hover:text-white transition-colors"
                                        title="Rename Folder"
                                      >
                                        <Icon
                                          icon="ph:pencil-simple"
                                          className="w-3.5 h-3.5"
                                        />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFolderToDelete(folder);
                                          setIsDeleteFolderModalOpen(true);
                                        }}
                                        className="p-1.5 hover:bg-[#27272a] rounded text-red-400 hover:text-red-350 transition-colors"
                                        title="Delete Folder"
                                      >
                                        <Icon
                                          icon="ph:trash"
                                          className="w-3.5 h-3.5"
                                        />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    // Deep Folder Contents Viewer
                    <div className="flex-1 flex flex-col px-4">
                      {/* Navigation Path */}
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          onClick={() => setSelectedFolderId(null)}
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <Icon icon="ph:caret-left" className="w-3.5 h-3.5" />
                          <span>All Folders</span>
                        </button>
                        <span className="text-[#27272a] text-xs">/</span>
                        <div className="flex items-center gap-2">
                          <Icon
                            icon="ph:folder-open"
                            className="w-3.5 h-3.5 text-zinc-400"
                          />
                          <span className="text-xs font-semibold text-white">
                            {folders.find((f) => f.id === selectedFolderId)
                              ?.name || "Browsing Directory"}
                          </span>
                        </div>
                      </div>

                      {/* Filtered Folder Papers */}
                      {(() => {
                        const folderPapers = sortedPapers.filter(
                          (p) => p.folderId === selectedFolderId,
                        );
                        return folderPapers.length === 0 ? (
                          <div className="py-20 text-center border border-dashed border-[#27272a] rounded-xl bg-[#161616]/20">
                            <Icon
                              icon="ph:folder"
                              className="w-10 h-10 text-zinc-600 mx-auto mb-4 animate-pulse"
                            />
                            <h3 className="text-[#e4e4e7] text-sm font-medium mb-1">
                              Folder is Empty
                            </h3>
                            <p className="text-[#52525b] text-xs max-w-sm mx-auto mb-4">
                              No assets have been added here yet. Create some
                              research notes or upload files to fill it!
                            </p>
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() =>
                                  createNewDocument(
                                    selectedFolderId || folders[0]?.id,
                                  )
                                }
                                className="px-3.5 py-1.5 bg-zinc-200 hover:bg-white text-zinc-900 rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                New Document
                              </button>
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-3.5 py-1.5 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#252528] text-zinc-200 rounded-lg text-xs font-medium cursor-pointer"
                              >
                                Upload PDF File
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-[#121212] overflow-x-auto border border-[#27272a] rounded-xl min-h-[260px]">
                            <table className="w-full text-left border-collapse min-w-[950px]">
                              <thead>
                                <tr className="border-b border-[#27272a] bg-[#1a1a1a]/40 text-[#71717a] text-[10.5px] font-jakarta tracking-wider uppercase">
                                  <th className="w-[44px] pl-4 py-3">
                                    <button
                                      onClick={() => {
                                        const folderNames = folderPapers.map(
                                          (p) => p.title,
                                        );
                                        const allSelected = folderNames.every(
                                          (name) =>
                                            selectedPapers.includes(name),
                                        );
                                        if (allSelected) {
                                          setSelectedPapers(
                                            selectedPapers.filter(
                                              (name) =>
                                                !folderNames.includes(name),
                                            ),
                                          );
                                        } else {
                                          setSelectedPapers([
                                            ...new Set([
                                              ...selectedPapers,
                                              ...folderNames,
                                            ]),
                                          ]);
                                        }
                                      }}
                                      className="w-3.5 h-3.5 rounded-sm border border-[#27272a] bg-[#1a1a1a] flex items-center justify-center hover:border-zinc-500 transition-colors cursor-pointer"
                                    >
                                      {folderPapers
                                        .map((p) => p.title)
                                        .every((name) =>
                                          selectedPapers.includes(name),
                                        ) ? (
                                        <div className="w-1.5 h-1.5 bg-zinc-200 rounded-[1px]" />
                                      ) : folderPapers.some((p) =>
                                          selectedPapers.includes(p.title),
                                        ) ? (
                                        <div className="w-1.5 h-[1px] bg-zinc-400" />
                                      ) : null}
                                    </button>
                                  </th>
                                  <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                                    Title
                                  </th>
                                  <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                                    Folder
                                  </th>
                                  <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                                    Authors
                                  </th>
                                  <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                                    Added
                                  </th>
                                  <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                                    Viewed
                                  </th>
                                  <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                                    Type
                                  </th>
                                  <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                                    Summary
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#1e1e20] text-xs">
                                {folderPapers.map((paper, idx) => {
                                  const isChecked = selectedPapers.includes(
                                    paper.title,
                                  );
                                  const openUpward =
                                    idx > 0 && idx >= folderPapers.length - 2;
                                  return (
                                    <tr
                                      key={idx}
                                      onClick={() => handlePaperClick(paper)}
                                      className={`hover:bg-[#1a1a1a]/40 transition-colors group cursor-pointer ${isChecked ? "bg-[#1a1a1a]/25" : ""}`}
                                    >
                                      <td
                                        className={`w-[44px] pl-4 ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isChecked) {
                                            setSelectedPapers(
                                              selectedPapers.filter(
                                                (t) => t !== paper.title,
                                              ),
                                            );
                                          } else {
                                            setSelectedPapers([
                                              ...selectedPapers,
                                              paper.title,
                                            ]);
                                          }
                                        }}
                                      >
                                        <div
                                          className={`w-3.5 h-3.5 rounded-sm border border-[#27272a] flex items-center justify-center transition-colors ${isChecked ? "bg-zinc-200 border-zinc-200" : "bg-[#1a1a1a]"}`}
                                        >
                                          {isChecked && (
                                            <Icon
                                              icon="ph:check"
                                              className="w-2.5 h-2.5 text-[#121212]"
                                            />
                                          )}
                                        </div>
                                      </td>
                                      <td className={`px-3 font-medium ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}>
                                        <div className="flex items-center gap-2.5">
                                          {paper.fileType === "Note" ? (
                                            <Icon
                                              icon="ph:file-text"
                                              className="w-4 h-4 text-zinc-400"
                                            />
                                          ) : (
                                            <Icon
                                              icon="ph:article"
                                              className="w-4 h-4 text-zinc-300"
                                            />
                                          )}
                                          <span className="text-[#f4f4f5] truncate max-w-[240px]">
                                            {paper.title}
                                          </span>
                                        </div>
                                      </td>
                                      <td
                                        className={`px-3 ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div
                                          className="relative inline-flex items-center"
                                          tabIndex={0}
                                          onBlur={(e) => {
                                            if (
                                              !e.currentTarget.contains(
                                                e.relatedTarget as Node,
                                              )
                                            ) {
                                              setActiveMoveFolderDropdown(null);
                                            }
                                          }}
                                        >
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveMoveFolderDropdown(
                                                activeMoveFolderDropdown ===
                                                  paper.title
                                                  ? null
                                                  : paper.title,
                                              );
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer w-full min-w-[130px] max-w-[140px] justify-between ${activeMoveFolderDropdown === paper.title ? "bg-[#27272a] text-white" : "bg-transparent text-zinc-300 hover:bg-[#27272a] hover:text-white"}`}
                                          >
                                            <span className="text-[11px] truncate">
                                              {paper.folderId
                                                ? folders.find(
                                                    (f) =>
                                                      f.id === paper.folderId,
                                                  )?.name || "Library"
                                                : "Library"}
                                            </span>
                                            <Icon
                                              icon="ph:caret-down"
                                              className={`w-3 h-3 shrink-0 transition-transform ${activeMoveFolderDropdown === paper.title ? "rotate-180" : ""}`}
                                            />
                                          </button>

                                          <AnimatePresence>
                                            {activeMoveFolderDropdown ===
                                              paper.title && (
                                              <motion.div
                                                initial={{
                                                  opacity: 0,
                                                  y: openUpward ? -4 : 4,
                                                  scale: 0.95,
                                                }}
                                                animate={{
                                                  opacity: 1,
                                                  y: 0,
                                                  scale: 1,
                                                }}
                                                exit={{
                                                  opacity: 0,
                                                  y: openUpward ? -4 : 4,
                                                  scale: 0.95,
                                                }}
                                                transition={{ duration: 0.1 }}
                                                className={`absolute left-0 ${openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"} w-48 bg-[#18181b] border border-[#27272a] rounded-xl py-1.5 z-[70]`}
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                              >
                                                <button
                                                  onClick={() => {
                                                    dbSetPaper({
                                                      ...paper,
                                                      folderId: "",
                                                    });
                                                    setActiveMoveFolderDropdown(
                                                      null,
                                                    );
                                                  }}
                                                  className="w-full flex items-center px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer text-left font-medium"
                                                >
                                                  Library
                                                </button>
                                                {folders.map((folder) => (
                                                  <button
                                                    key={folder.id}
                                                    onClick={() => {
                                                      dbSetPaper({
                                                        ...paper,
                                                        folderId: folder.id,
                                                      });
                                                      setActiveMoveFolderDropdown(
                                                        null,
                                                      );
                                                    }}
                                                    className="w-full flex items-center px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer text-left truncate font-medium"
                                                  >
                                                    {folder.name}
                                                  </button>
                                                ))}
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      </td>
                                      <td className={`px-3 text-zinc-400 ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}>
                                        {paper.author || "—"}
                                      </td>
                                      <td className={`px-3 text-zinc-500 ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}>
                                        {paper.added || "—"}
                                      </td>
                                      <td className={`px-3 text-zinc-500 ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}>
                                        {paper.viewed || "—"}
                                      </td>
                                      <td className={`px-3 text-zinc-400 capitalize ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}>
                                        {paper.fileType || "—"}
                                      </td>
                                      <td className={`px-3 text-[#52525b] ${displayDensity === "compact" ? "py-1.5" : "py-3.5"}`}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveViewingPaper(paper);
                                          }}
                                          className="px-2.5 py-1 bg-transparent hover:bg-[#27272a] text-zinc-300 hover:text-white font-sans text-[11px] rounded-lg transition-all cursor-pointer flex items-center gap-1.5 font-medium select-none"
                                        >
                                          <Icon
                                            icon="ph:eye"
                                            className="w-3.5 h-3.5"
                                          />
                                          <span>View Summary</span>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Floating Selection Pill based on screenshot */}
                  <AnimatePresence>
                    {selectedPapers.length > 0 && (
                      <motion.div
                        initial={{ y: 20, x: "-50%", opacity: 0 }}
                        animate={{ y: 0, x: "-50%", opacity: 1 }}
                        exit={{ y: 20, x: "-50%", opacity: 0 }}
                        transition={{
                          type: "spring",
                          damping: 25,
                          stiffness: 350,
                        }}
                        className="fixed bottom-10 left-1/2 z-50 flex items-center gap-6 px-6 py-3 bg-[#111112] border border-[#27272a] rounded-full select-none font-jakarta"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 bg-[#0070f3] rounded flex items-center justify-center">
                            <Icon
                              icon="ph:check-bold"
                              className="w-2.5 h-2.5 text-white"
                            />
                          </div>
                          <span className="text-sm text-white whitespace-nowrap">
                            {selectedPapers.length}{" "}
                            {selectedPapers.length === 1 ? "file" : "files"}{" "}
                            selected
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {selectedPapers.length === 1 && (
                            <button
                              onClick={() => {
                                const match = papers.find(
                                  (p) => p.title === selectedPapers[0],
                                );
                                if (match) {
                                  setActiveViewingPaper(match);
                                }
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1a1a1a] rounded-lg text-white text-[13px] transition-colors cursor-pointer"
                            >
                              <Icon
                                icon="ph:eye"
                                className="w-4 h-4 text-zinc-400"
                              />
                              <span>View Summary</span>
                            </button>
                          )}
                          <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1a1a1a] rounded-lg text-white text-[13px] transition-colors cursor-pointer">
                            <Icon icon="ph:folder" className="w-4 h-4" />
                            <span>Add to folder</span>
                          </button>

                          <button
                            onClick={() => {
                              selectedPapers.forEach((title) =>
                                dbDeletePaper(title),
                              );
                              setSelectedPapers([]);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1a1a1a] rounded-lg text-white text-[13px] transition-colors cursor-pointer"
                          >
                            <span>Delete selection</span>
                          </button>

                          <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1a1a1a] rounded-lg text-white text-[13px] transition-colors cursor-pointer">
                            <Icon
                              icon="ph:download-simple"
                              className="w-4 h-4"
                            />
                            <span>Export</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>


                {/* Zero-Glow Add Item Table Modal */}
              </div>
            ) : activeTab.type === "tools" ? (
              <div className="flex-1 overflow-hidden focus:outline-none bg-[#121212] flex flex-col pt-8 w-full h-full min-h-0">
                <div className="w-full h-full flex flex-col min-h-0">
                  <h1 className="text-xl text-[#f4f4f5] font-semibold tracking-tight pb-4 border-b border-[#222225] px-8 shrink-0">
                    {activeToolsTab === "slovin"
                      ? "Slovin's Margin of Error & Sample Size"
                      : activeToolsTab === "percentage"
                        ? "Percentage Calculator & Distribution"
                        : activeToolsTab === "weighted"
                          ? "Weighted Arithmetic Mean"
                          : activeToolsTab === "likert"
                            ? "Likert Scale Response Indexer"
                            : activeToolsTab === "citation"
                              ? "Academic Citation Generator"
                              : "Cosmi AI Data Analyst"}
                  </h1>
                  <div className="flex-1 min-h-0 flex flex-col">
                    <StatisticsTools
                      onAddHistory={addToolsHistoryItem}
                      selectedHistoryItem={selectedToolsHistoryItem}
                      onClearSelectedHistoryItem={() =>
                        setSelectedToolsHistoryItem(null)
                      }
                      activeTab={activeToolsTab}
                      onChangeActiveTab={setActiveToolsTab}
                    />
                  </div>
                </div>
              </div>
            ) : activeTab.fileId && activeTab.mimetype === "application/pdf" ? (
              <div
                className="flex-1 flex flex-col bg-[#0b0b0c] h-full overflow-hidden"
                id="pdf-viewer-workspace"
              >
                {/* PDF Viewer Display Body */}
                <div className="h-[44px] flex items-center justify-between px-4 bg-[#1e1e1e] border-b border-[#27272a] shrink-0 z-10 relative">
                  {/* Left Spacer for absolute centering balance */}
                  <div className="w-8" />

                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4">
                    <div className="flex items-center text-sm font-medium text-zinc-400 select-none">
                        <span className="text-zinc-200 min-w-[20px] text-center">
                          {currentPdfPage}
                        </span>
                        <span className="mx-1.5 text-zinc-600">/</span>
                        <span>{pdfNumPages || "-"}</span>
                      </div>
                      <div className="flex items-center box-border border border-[#27272a] rounded overflow-hidden">
                        <button
                          onClick={() =>
                            setPdfScale(Math.max(0.25, pdfScale - 0.25))
                          }
                          disabled={pdfScale <= 0.25}
                          className="w-7 h-7 flex items-center justify-center bg-[#1e1e1e] hover:bg-[#27272a] hover:text-white text-zinc-400 disabled:opacity-30 disabled:hover:bg-[#1e1e1e] disabled:hover:text-zinc-400 transition-colors"
                          title="Zoom out"
                        >
                          <Icon icon="ph:minus" className="w-4 h-4" />
                        </button>
                        <div className="w-[1px] h-4 bg-[#27272a]" />
                        <div className="w-[50px] text-center text-xs font-medium text-zinc-200">
                          {Math.round(pdfScale * 100)}%
                        </div>
                        <div className="w-[1px] h-4 bg-[#27272a]" />
                        <button
                          onClick={() =>
                            setPdfScale(Math.min(5, pdfScale + 0.25))
                          }
                          disabled={pdfScale >= 5}
                          className="w-7 h-7 flex items-center justify-center bg-[#1e1e1e] hover:bg-[#27272a] hover:text-white text-zinc-400 disabled:opacity-30 disabled:hover:bg-[#1e1e1e] disabled:hover:text-zinc-400 transition-colors"
                          title="Zoom in"
                        >
                          <Icon icon="ph:plus" className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center box-border border border-[#27272a] rounded overflow-hidden">
                        <button
                          onClick={() => {
                            const page = document.getElementById(
                              `pdf-page-${Math.max(1, currentPdfPage - 1)}`,
                            );
                            if (page) page.scrollIntoView({ behavior: "smooth" });
                          }}
                          disabled={currentPdfPage <= 1}
                          className="w-7 h-7 flex items-center justify-center bg-[#1e1e1e] hover:bg-[#27272a] hover:text-white text-zinc-400 disabled:opacity-30 disabled:hover:bg-[#1e1e1e] disabled:hover:text-zinc-400 transition-colors"
                        >
                          <Icon icon="ph:caret-up" className="w-4 h-4" />
                        </button>
                        <div className="w-[1px] h-4 bg-[#27272a]" />
                        <button
                          onClick={() => {
                            const page = document.getElementById(
                              `pdf-page-${Math.min(pdfNumPages || 1, currentPdfPage + 1)}`,
                            );
                            if (page) page.scrollIntoView({ behavior: "smooth" });
                          }}
                          disabled={currentPdfPage >= (pdfNumPages || 1)}
                          className="w-7 h-7 flex items-center justify-center bg-[#1e1e1e] hover:bg-[#27272a] hover:text-white text-zinc-400 disabled:opacity-30 disabled:hover:bg-[#1e1e1e] disabled:hover:text-zinc-400 transition-colors"
                        >
                          <Icon icon="ph:caret-down" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  <div className="flex items-center gap-3">
                    {!isSidePanelOpen && (
                      <button
                        onClick={() => setIsSidePanelOpen(true)}
                        className="p-1.5 text-[#a1a1aa] hover:text-[#f4f4f5] transition-all cursor-pointer rounded-md hover:bg-[#27272a]"
                        title="Toggle Side Panel"
                        id="pdf-panel-toggle"
                      >
                        <PanelRight className="w-[18px] h-[18px]" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 w-full bg-[#1e1e1e] relative min-h-0 overflow-hidden">
                  <div
                    className="w-full h-full overflow-y-auto bg-[#0f0f10] custom-scrollbar-v"
                    onMouseUp={handlePdfMouseUp}
                    onContextMenu={handlePdfContextMenu}
                    id="pdf-scroll-container"
                  >
                    {isBlobLoading || !activePdfBlobUrl ? (
                      <div className="text-zinc-500 font-mono text-sm py-12 flex items-center justify-center gap-3">
                        <div className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                        Loading Cached PDF...
                      </div>
                    ) : (
                      <Document
                        file={activePdfBlobUrl}
                        onLoadSuccess={({ numPages }) => setPdfNumPages(numPages)}
                        className="flex flex-col items-center py-8 gap-6"
                        loading={
                          <div className="text-zinc-500 font-mono text-sm py-12 flex items-center justify-center gap-3">
                            <div className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                            Loading PDF Renderer...
                          </div>
                        }
                        error={
                          <div className="text-red-400 py-12">
                            Failed to load PDF file.
                          </div>
                        }
                      >
                        {Array.from(new Array(pdfNumPages || 0), (el, index) => (
                          <div
                            key={`page_container_${index + 1}`}
                            id={`pdf-page-${index + 1}`}
                            className="relative pdf-page-wrapper"
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handlePdfContextMenu(e);
                            }}
                            style={{ transformOrigin: "top center" }}
                          >
                            <Page
                              pageNumber={index + 1}
                              renderTextLayer={true}
                              renderAnnotationLayer={true}
                              className="bg-[#18181b] border border-[#27272a] text-[#e4e4e7] relative"
                              width={800}
                              scale={pdfScale}
                            />
                          </div>
                        ))}
                      </Document>
                    )}
                  </div>

                  {/* Popover UI over PDF text selection */}
                  {selectionText && selectionPos && (
                    <div
                      className="absolute z-50 pdf-annotation-popover bg-[#161618] border border-[#2d2d30] rounded-xl p-3 shadow-2xl flex flex-col gap-2 min-w-[280px] max-w-sm"
                      style={{
                        left: `${selectionPos.x}px`,
                        top: `${selectionPos.y}px`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <div className="text-[11px] font-mono text-zinc-400 select-none pb-1.5 border-b border-[#2d2d30] flex items-center justify-between">
                        <span>Page {selectedPageNum || 1} Annotation</span>
                        <button
                          onClick={() => {
                            setSelectionText("");
                            setSelectionPos(null);
                          }}
                          className="text-zinc-500 hover:text-zinc-300 cursor-pointer p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="bg-[#121212]/50 text-[11px] italic text-zinc-300 p-2 rounded border border-[#222224] max-h-24 overflow-y-auto select-none break-words whitespace-pre-wrap">
                        "{selectionText}"
                      </div>

                      {/* Highlights selection color */}
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="text-[10px] text-zinc-500 font-medium select-none">
                          Color:
                        </span>
                        <div className="flex items-center gap-1">
                          {[
                            {
                              name: "Yellow",
                              value: "#fef08a",
                              class: "bg-yellow-200",
                            },
                            {
                              name: "Green",
                              value: "#bbf7d0",
                              class: "bg-green-200",
                            },
                            {
                              name: "Blue",
                              value: "#bfdbfe",
                              class: "bg-blue-200",
                            },
                            {
                              name: "Pink",
                              value: "#fbcfe8",
                              class: "bg-pink-200",
                            },
                          ].map((clr) => (
                            <button
                              key={clr.value}
                              onClick={() => setActiveHighlightColor(clr.value)}
                              className={`w-4 h-4 rounded-full transition-transform cursor-pointer border ${activeHighlightColor === clr.value ? "ring-1 ring-zinc-400 border-white scale-110" : "border-transparent hover:scale-105"} ${clr.class}`}
                              title={clr.name}
                            />
                          ))}
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Type your comment or thesis notes..."
                        className="w-full bg-[#121212] border border-[#27272a] focus:border-zinc-700 rounded-lg p-2 text-[12px] text-[#f4f4f5] outline-none transition-colors resize-none placeholder:text-zinc-650"
                      />

                      <button
                        onClick={async () => {
                          if (!selectionText) return;

                          const newAnno = {
                            id: `anno-${Date.now()}`,
                            fileId: activeTab.fileId || activeTab.id,
                            text: selectionText,
                            comment: commentDraft.trim(),
                            page: selectedPageNum || 1,
                            color: activeHighlightColor,
                            timestamp: Date.now(),
                          };

                          const storageKey = `annotations_${activeTab.id || activeTab.fileId}`;
                          const currentAnnosStr =
                            localStorage.getItem(storageKey) || "[]";
                          let currentAnnos = [];
                          try {
                            currentAnnos = JSON.parse(currentAnnosStr);
                          } catch (_) {}
                          const updated = [...currentAnnos, newAnno];
                          localStorage.setItem(
                            storageKey,
                            JSON.stringify(updated),
                          );

                          window.dispatchEvent(new Event("annotationsUpdated"));

                          if (currentUser && storageMode === "database") {
                            try {
                              await setDoc(
                                doc(
                                  db,
                                  "users",
                                  currentUser.uid,
                                  "annotations",
                                  newAnno.id,
                                ),
                                {
                                  ...newAnno,
                                  uid: currentUser.uid,
                                },
                              );
                            } catch (err) {
                              handleFirestoreError(
                                err,
                                OperationType.WRITE,
                                `users/${currentUser.uid}/annotations/${newAnno.id}`,
                              );
                            }
                          }

                          setSelectionText("");
                          setSelectionPos(null);
                          setSelectedPageNum(null);
                          setCommentDraft("");

                          setTimeout(highlightPDFSpans, 100);
                        }}
                        className="w-full py-1.5 bg-zinc-700 hover:bg-zinc-600 font-bold text-white text-[11px] rounded-lg transition-colors cursor-pointer text-center select-none"
                      >
                        Save Annotation
                      </button>
                    </div>
                  )}

                  {pdfContextMenu && (
                    <div
                      className="fixed z-[100] bg-[#161618] border border-[#2d2d30] rounded-xl py-1.5 shadow-2xl min-w-[200px] select-none"
                      style={{
                        left: `${pdfContextMenu.x}px`,
                        top: `${pdfContextMenu.y}px`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          if (selectionText) {
                            navigator.clipboard.writeText(selectionText);
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent group mt-0.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            icon="ph:copy"
                            className="w-4 h-4 text-zinc-500 group-hover:text-white"
                          />
                          <span>Copy Selection</span>
                        </div>
                        <span className="text-[9px] text-zinc-600 font-mono">
                          ⌘C
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectionText && !selectionPos) {
                            const outerWorkspace = document.getElementById(
                              "pdf-viewer-workspace",
                            );
                            if (outerWorkspace) {
                              const containerRect =
                                outerWorkspace.getBoundingClientRect();
                              let posX = pdfContextMenu!.x - containerRect.left;
                              let posY =
                                pdfContextMenu!.y - containerRect.top - 180; // Offset up

                              // Intelligence: keep popover in container bounds
                              const popWidth = 280;
                              if (posX - popWidth / 2 < 10)
                                posX = popWidth / 2 + 10;
                              if (
                                posX + popWidth / 2 >
                                containerRect.width - 10
                              )
                                posX = containerRect.width - popWidth / 2 - 10;
                              if (posY < 10)
                                posY =
                                  pdfContextMenu!.y - containerRect.top + 20; // Flip to bottom if too high

                              setSelectionPos({ x: posX, y: posY });
                            }
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:note-pencil"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Annotate</span>
                      </button>

                      <button
                        onClick={async () => {
                          if (!selectionText) return;
                          const newAnno = {
                            id: `anno-${Date.now()}`,
                            fileId: activeTab.fileId || activeTab.id,
                            text: selectionText,
                            comment: "",
                            page: selectedPageNum || 1,
                            color: activeHighlightColor,
                            timestamp: Date.now(),
                          };
                          const storageKey = `annotations_${activeTab.id || activeTab.fileId}`;
                          const currentAnnosStr =
                            localStorage.getItem(storageKey) || "[]";
                          let currentAnnos = [];
                          try {
                            currentAnnos = JSON.parse(currentAnnosStr);
                          } catch (_) {}
                          localStorage.setItem(
                            storageKey,
                            JSON.stringify([...currentAnnos, newAnno]),
                          );
                          window.dispatchEvent(new Event("annotationsUpdated"));
                          if (currentUser && storageMode === "database") {
                            try {
                              await setDoc(
                                doc(
                                  db,
                                  "users",
                                  currentUser.uid,
                                  "annotations",
                                  newAnno.id,
                                ),
                                {
                                  ...newAnno,
                                  uid: currentUser.uid,
                                },
                              );
                            } catch {}
                          }
                          setPdfContextMenu(null);
                          setSelectionText("");
                          setSelectionPos(null);
                          setTimeout(highlightPDFSpans, 100);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:highlighter"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Quick Highlight</span>
                      </button>

                      <div className="h-[1px] bg-[#2d2d30] mx-2 my-1" />

                      <button
                        onClick={() => {
                          if (selectionText) {
                            window.open(
                              `https://www.google.com/search?q=${encodeURIComponent(selectionText)}`,
                              "_blank",
                            );
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="logos:google-icon"
                          className="w-4 h-4"
                        />
                        <span>Google Search</span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectionText) {
                            setChatInput(
                              `Summarize this selection from the PDF: "${selectionText}"`,
                            );
                            if (!isSidePanelOpen) setIsSidePanelOpen(true);
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:text-align-left"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Summarize Selection</span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectionText) {
                            setChatInput(
                              `I found this interesting in the text: "${selectionText}". Can you explain it or link it to my existing research?`,
                            );
                            if (!isSidePanelOpen) setIsSidePanelOpen(true);
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:sparkle"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Research Assistant</span>
                      </button>

                      <div className="h-[1px] bg-[#2d2d30] mx-2 my-1" />

                      <button
                        onClick={() => {
                          if (selectionText) {
                            window.open(
                              `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(selectionText)}&op=translate`,
                              "_blank",
                            );
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:translate"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Translate Selection</span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectionText) {
                            window.open(
                              `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(selectionText)}`,
                              "_blank",
                            );
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="simple-icons:wikipedia"
                          className="w-4 h-4 text-[#f8f9fa]"
                        />
                        <span>Wikipedia Search</span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectionText) {
                            window.open(
                              `https://www.merriam-webster.com/dictionary/${encodeURIComponent(selectionText)}`,
                              "_blank",
                            );
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:book-open"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Define / Dictionary</span>
                      </button>

                      <div className="h-[1px] bg-[#2d2d30] mx-2 my-1" />

                      <button
                        onClick={() => {
                          if (selectionText) {
                            const utterance = new SpeechSynthesisUtterance(
                              selectionText,
                            );
                            window.speechSynthesis.speak(utterance);
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:speaker-high"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Read Selection</span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectionText) {
                            setChatInput(
                              `Create a flashcard from this selection: "${selectionText}"`,
                            );
                            if (!isSidePanelOpen) setIsSidePanelOpen(true);
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:cards"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Create Flashcard</span>
                      </button>

                      <button
                        onClick={() => {
                          window.print();
                          setPdfContextMenu(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors group"
                      >
                        <Icon
                          icon="ph:printer"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Print Page</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative flex-1 flex flex-col h-full overflow-hidden">
                {/* Repositioned Auto-Save Indicator next to SidePanel icon */}
                <div
                  className={`absolute top-3.5 z-30 transition-all duration-200 ${isSidePanelOpen ? "right-4" : "right-12"} flex items-center gap-2.5`}
                >
                  {docSaveStatus === "saving" ? (
                    <span className="flex items-center gap-1.5 text-zinc-400 bg-[#121212]/80 px-2.5 py-1.5 rounded-lg backdrop-blur-sm select-none text-[11px] font-mono h-8">
                      <Icon
                        icon="ph:spinner-gap"
                        className="w-3.5 h-3.5 animate-spin text-zinc-400"
                      />
                      <span>Saving...</span>
                    </span>
                  ) : docSaveStatus === "saved" ? (
                    <span className="flex items-center gap-1.5 text-emerald-500 font-medium bg-[#121212]/80 px-2.5 py-1.5 rounded-lg backdrop-blur-sm select-none text-[11px] font-mono h-8">
                      <Icon
                        icon="ph:cloud-check"
                        className="w-4 h-4 text-emerald-500"
                      />
                      <span>Saved to Cloud Workers</span>
                    </span>
                  ) : null}

                  {/* Share button removed */}
                </div>
                {!isSidePanelOpen && (
                  <button
                    onClick={() => setIsSidePanelOpen(true)}
                    className="absolute top-3 right-3 z-30 p-2 text-[#a1a1aa] hover:text-[#f4f4f5] transition-all cursor-pointer"
                    title="Toggle Side Panel"
                  >
                    <PanelRight className="w-5 h-5" />
                  </button>
                )}
                {/* Floating Pill Formatting Bar - Compact, clean, with a 3-dots overflow menu to prevent layout wrapping or overlapping */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[#161616]/95 backdrop-blur-md border border-[#2d2d30] rounded-full px-3.5 h-[44px] flex items-center justify-center gap-x-2 text-[12px] text-[#a1a1aa] select-none max-w-[calc(100%-1.5rem)] md:max-w-max shadow-xl transition-all duration-200">
                  {/* Font Selector */}
                  <div className="flex items-center relative h-full shrink-0">
                    <button
                      onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                      className="flex items-center gap-1.5 px-2.5 h-8 hover:bg-[#2c2c2e] transition-colors rounded-lg text-[#e4e4e7] cursor-pointer"
                    >
                      <span className="font-medium text-[11px] min-w-[70px] text-left">
                        {editorFont === "font-jakarta"
                          ? "Plus Jakarta"
                          : editorFont === "font-serif"
                            ? "Lora (Serif)"
                            : editorFont === "font-sans"
                              ? "Inter (Sans)"
                              : "Plus Jakarta (Alt)"}
                      </span>
                      <Icon
                        icon="ph:caret-down"
                        className={`w-3 h-3 text-[#71717a] transition-transform duration-200 ${isFontDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence>
                      {isFontDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: -8, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="absolute left-0 bottom-full mb-2 z-50 bg-[#161616] border border-[#2d2d30] rounded-xl py-1.5 min-w-[140px] overflow-hidden"
                        >
                          {[
                            { value: "font-jakarta", label: "Plus Jakarta" },
                            { value: "font-serif", label: "Lora (Serif)" },
                            { value: "font-sans", label: "Inter (Sans)" },
                            { value: "font-mono", label: "Plus Jakarta (Alt)" },
                          ].map((font) => (
                            <button
                              key={font.value}
                              onClick={() => {
                                setEditorFont(font.value);
                                setIsFontDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center justify-between group cursor-pointer ${
                                editorFont === font.value
                                  ? "bg-[#2c2c2e] text-[#f4f4f5]"
                                  : "text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-[#e4e4e7]"
                              }`}
                            >
                              <span className={font.value}>{font.label}</span>
                              {editorFont === font.value && (
                                <Icon
                                  icon="ph:check"
                                  className="w-3 h-3 text-blue-400"
                                />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="h-4 w-[1px] bg-[#2d2d30] shrink-0" />

                  {/* Font Size Adjusters */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => changeSelectedFontSize(false)}
                      className="hover:bg-[#2c2c2e] hover:text-white rounded-lg transition-colors text-[13px] font-medium w-7 h-7 flex items-center justify-center cursor-pointer"
                      title="Decrease Selection Font Size"
                    >
                      -
                    </button>
                    <span className="text-[11.5px] font-mono w-8 text-center text-[#e4e4e7]">
                      {currentSelectionSize}px
                    </span>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => changeSelectedFontSize(true)}
                      className="hover:bg-[#2c2c2e] hover:text-white rounded-lg transition-colors text-[13px] font-medium w-7 h-7 flex items-center justify-center cursor-pointer"
                      title="Increase Selection Font Size"
                    >
                      +
                    </button>
                  </div>

                  <div className="h-4 w-[1px] bg-[#2d2d30] shrink-0" />

                  {/* Formatting controls */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFormat("undo")}
                      className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                      title="Undo"
                    >
                      <Icon icon="ph:arrow-u-up-left" className="w-4 h-4" />
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFormat("redo")}
                      className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                      title="Redo"
                    >
                      <Icon icon="ph:arrow-u-up-right" className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="h-4 w-[1px] bg-[#2d2d30] shrink-0" />

                  {/* Core Styles Always Visible */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFormat("bold")}
                      className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                      title="Bold Selection"
                    >
                      <Icon icon="ph:text-b" className="w-4 h-4" />
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFormat("italic")}
                      className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                      title="Italic Selection"
                    >
                      <Icon icon="ph:text-italic" className="w-4 h-4" />
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFormat("underline")}
                      className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                      title="Underline Selection"
                    >
                      <Icon icon="ph:text-underline" className="w-4 h-4" />
                    </button>
                    <div className="relative flex items-center gap-1">
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setIsTablePickerOpen(!isTablePickerOpen);
                          setTableGrid({ r: 0, c: 0 });
                        }}
                        className={`p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022] ${isTablePickerOpen ? "bg-[#2c2c2e] text-white" : ""}`}
                        title="Insert Table"
                      >
                        <Icon icon="ph:table" className="w-4 h-4" />
                      </button>
                      
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setChartBeingEdited(null);
                          setIsChartModalOpen(true);
                        }}
                        className={`p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022] ${isChartModalOpen ? "bg-[#2c2c2e] text-white" : ""}`}
                        title="Insert Chart/Graph"
                      >
                        <Icon icon="ph:chart-bar" className="w-4 h-4" />
                      </button>

                      <AnimatePresence>
                        {isTablePickerOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: -8, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute bottom-full left-0 mb-2 z-50 bg-[#1a1a1c] border border-[#2d2d30] rounded-lg p-3 shadow-xl flex flex-col gap-3 min-w-[140px]"
                          >
                            <div className="flex flex-col gap-1">
                              {[...Array(Math.max(6, Math.min(10, tableGrid.r + 2)))].map((_, rowIndex) => (
                                <div key={rowIndex} className="flex gap-1">
                                  {[...Array(Math.max(6, Math.min(10, tableGrid.c + 2)))].map((_, colIndex) => (
                                    <div
                                      key={colIndex}
                                      className={`w-4 h-4 border border-[#3f3f3f] rounded-[2px] cursor-pointer transition-colors ${
                                        rowIndex < tableGrid.r && colIndex < tableGrid.c ? "bg-emerald-500/80 border-emerald-500" : "hover:bg-[#2a2a2c]"
                                      }`}
                                      onMouseEnter={() => setTableGrid({ r: rowIndex + 1, c: colIndex + 1 })}
                                      onClick={() => {
                                        handleInsertTable(rowIndex + 1, colIndex + 1);
                                        setIsTablePickerOpen(false);
                                      }}
                                    />
                                  ))}
                                </div>
                              ))}
                            </div>
                            <div className="text-[11px] text-center text-zinc-400 font-mono">
                              {tableGrid.r > 0 && tableGrid.c > 0 ? `${tableGrid.r} × ${tableGrid.c}` : "Select size"}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="h-4 w-[1px] bg-[#2d2d30] shrink-0" />

                  {/* Three Dots Overflow Dropdown Menu */}
                  <div className="relative flex items-center shrink-0">
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setIsMoreToolsOpen(!isMoreToolsOpen)}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022] ${isMoreToolsOpen ? "bg-[#2c2c2e] text-white" : ""}`}
                      title="More formatting"
                    >
                      <Icon icon="ph:dots-three-bold" className="w-5 h-5" />
                    </button>

                    <AnimatePresence>
                      {isMoreToolsOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: -8, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="absolute right-0 bottom-full mb-2 z-50 bg-[#161616] border border-[#2d2d30] rounded-xl p-3 shadow-2xl flex flex-col gap-3 min-w-[200px]"
                        >
                          {/* Alignment section */}
                          <div>
                            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1 select-none text-left">
                              Alignment
                            </div>
                            <div className="flex items-center gap-0.5 bg-[#1e1e20] p-1 rounded-lg border border-[#27272a]">
                              {[
                                {
                                  id: "left",
                                  icon: "ph:text-align-left",
                                  format: "justifyLeft",
                                  label: "Left",
                                },
                                {
                                  id: "center",
                                  icon: "ph:text-align-center",
                                  format: "justifyCenter",
                                  label: "Center",
                                },
                                {
                                  id: "right",
                                  icon: "ph:text-align-right",
                                  format: "justifyRight",
                                  label: "Right",
                                },
                                {
                                  id: "justify",
                                  icon: "ph:text-align-justify",
                                  format: "justifyFull",
                                  label: "Justify",
                                },
                              ].map((align) => (
                                <button
                                  key={align.id}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setEditorAlign(align.id as any);
                                    handleFormat(align.format);
                                  }}
                                  className={`flex-1 p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
                                    editorAlign === align.id
                                      ? "text-[#f4f4f5] bg-[#2d2d30]"
                                      : "text-[#a1a1aa] hover:text-white hover:bg-[#252527]"
                                  }`}
                                  title={`Align ${align.label}`}
                                >
                                  <Icon icon={align.icon} className="w-4 h-4" />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="h-[1px] bg-[#2d2d30]" />

                          {/* Styles section */}
                          <div>
                            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1 select-none text-left">
                              Styles
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleFormat("strikethrough")}
                                className="p-1 rounded-md transition-colors cursor-pointer text-[#a1a1aa] hover:text-white hover:bg-[#202022] flex items-center justify-center"
                                title="Strikethrough Selection"
                              >
                                <Icon
                                  icon="ph:text-strikethrough"
                                  className="w-4 h-4"
                                />
                              </button>
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleFormat("subscript")}
                                className="p-1 rounded-md transition-colors cursor-pointer text-[#a1a1aa] hover:text-white hover:bg-[#202022] flex items-center justify-center"
                                title="Subscript"
                              >
                                <Icon
                                  icon="ph:text-subscript"
                                  className="w-4 h-4"
                                />
                              </button>
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleFormat("superscript")}
                                className="p-1 rounded-md transition-colors cursor-pointer text-[#a1a1aa] hover:text-white hover:bg-[#202022] flex items-center justify-center"
                                title="Superscript"
                              >
                                <Icon
                                  icon="ph:text-superscript"
                                  className="w-4 h-4"
                                />
                              </button>
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleFormat("removeFormat")}
                                className="p-1 rounded-md transition-colors cursor-pointer text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202022] flex items-center justify-center"
                                title="Clear Formatting"
                              >
                                <Icon icon="ph:eraser" className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="h-[1px] bg-[#2d2d30]" />

                          {/* Text Color Section */}
                          <div>
                            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1.5 select-none text-left flex items-center gap-1">
                              <Icon icon="ph:palette" className="w-3.5 h-3.5" />
                              <span>Text Color</span>
                            </div>
                            <div className="grid grid-cols-8 gap-1.5 p-1 bg-[#1e1e20] rounded-lg border border-[#27272a]">
                              {[
                                {
                                  name: "White",
                                  value: "#ffffff",
                                  class: "bg-white border border-[#2d2d30]",
                                },
                                {
                                  name: "Gray",
                                  value: "#a1a1aa",
                                  class: "bg-zinc-400",
                                },
                                {
                                  name: "Red",
                                  value: "#ef4444",
                                  class: "bg-red-500",
                                },
                                {
                                  name: "Orange",
                                  value: "#f97316",
                                  class: "bg-orange-500",
                                },
                                {
                                  name: "Yellow",
                                  value: "#eab308",
                                  class: "bg-yellow-500",
                                },
                                {
                                  name: "Green",
                                  value: "#22c55e",
                                  class: "bg-green-500",
                                },
                                {
                                  name: "Blue",
                                  value: "#3b82f6",
                                  class: "bg-blue-500",
                                },
                                {
                                  name: "Purple",
                                  value: "#a855f7",
                                  class: "bg-purple-500",
                                },
                              ].map((color) => (
                                <button
                                  key={color.value}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() =>
                                    handleFormat("foreColor", color.value)
                                  }
                                  className={`w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110 active:scale-95 ${color.class}`}
                                  title={color.name}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Highlight Section */}
                          <div>
                            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1.5 select-none text-left flex items-center gap-1">
                              <Icon
                                icon="ph:highlighter"
                                className="w-3.5 h-3.5"
                              />
                              <span>Highlight</span>
                            </div>
                            <div className="grid grid-cols-8 gap-1.5 p-1 bg-[#1e1e20] rounded-lg border border-[#27272a]">
                              {[
                                {
                                  name: "None",
                                  value: "transparent",
                                  class:
                                    "border border-dashed border-zinc-600 bg-transparent flex items-center justify-center",
                                },
                                {
                                  name: "Yellow",
                                  value: "#fef08a",
                                  class: "bg-yellow-200 text-black",
                                },
                                {
                                  name: "Green",
                                  value: "#bbf7d0",
                                  class: "bg-green-200",
                                },
                                {
                                  name: "Blue",
                                  value: "#bfdbfe",
                                  class: "bg-blue-200",
                                },
                                {
                                  name: "Pink",
                                  value: "#fbcfe8",
                                  class: "bg-pink-200",
                                },
                                {
                                  name: "Purple",
                                  value: "#e9d5ff",
                                  class: "bg-purple-200",
                                },
                                {
                                  name: "Orange",
                                  value: "#fed7aa",
                                  class: "bg-orange-200",
                                },
                                {
                                  name: "Red",
                                  value: "#fca5a5",
                                  class: "bg-red-200",
                                },
                              ].map((color) => (
                                <button
                                  key={color.value}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() =>
                                    handleFormat("hiliteColor", color.value)
                                  }
                                  className={`w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110 active:scale-95 ${color.class}`}
                                  title={color.name}
                                >
                                  {color.value === "transparent" && (
                                    <span className="text-[9px] text-zinc-400 select-none">
                                      ×
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="h-[1px] bg-[#2d2d30]" />

                          {/* List inserts */}
                          <div>
                            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1 select-none text-left">
                              Insert
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleFormat("insertUnorderedList");
                                  setIsMoreToolsOpen(false);
                                }}
                                className="p-1 rounded-md transition-colors cursor-pointer text-[#a1a1aa] hover:text-white hover:bg-[#202022] flex items-center justify-center"
                                title="Bullet List"
                              >
                                <Icon
                                  icon="ph:list-bullets"
                                  className="w-4 h-4"
                                />
                              </button>
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleFormat("insertOrderedList");
                                  setIsMoreToolsOpen(false);
                                }}
                                className="p-1 rounded-md transition-colors cursor-pointer text-[#a1a1aa] hover:text-white hover:bg-[#202022] flex items-center justify-center"
                                title="Numbered List"
                              >
                                <Icon
                                  icon="ph:list-numbers"
                                  className="w-4 h-4"
                                />
                              </button>
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleFormat("insertHorizontalRule");
                                  setIsMoreToolsOpen(false);
                                }}
                                className="p-1 rounded-md transition-colors cursor-pointer text-[#a1a1aa] hover:text-white hover:bg-[#202022] flex items-center justify-center"
                                title="Horizontal Rule"
                              >
                                <Icon icon="ph:minus" className="w-4 h-4" />
                              </button>
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setIsTablePickerOpen(true);
                                  setIsMoreToolsOpen(false);
                                }}
                                className="p-1 rounded-md transition-colors cursor-pointer text-[#a1a1aa] hover:text-white hover:bg-[#202022] flex items-center justify-center"
                                title="Table"
                              >
                                <Icon icon="ph:table" className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Independent Scrollable Document Surface */}
                <div className="flex-1 overflow-y-auto p-8 pb-24 md:p-14 md:pb-28 lg:p-20 lg:pb-32 focus:outline-none scroll-smooth">
                  <div
                    className={`max-w-[720px] mx-auto space-y-[1.5rem] ${editorFont} text-[#d4d4d8]`}
                    style={{
                      fontSize: `${editorFontSize}px`,
                      textAlign: editorAlign,
                    }}
                  >
                    {/* Main Document Title */}
                    <TextareaAutosize
                      key={`doc-title-${activeTabId}`}
                      id={`doc-title-${activeTabId}`}
                      name={`doc-title-${activeTabId}`}
                      autoComplete="off"
                      readOnly={isReadOnly}
                      value={documentTitle}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        lastLocalEditTimeRef.current = Date.now();
                        setDocumentTitle(newTitle);
                        setTabs((prev) =>
                          prev.map((t) =>
                            t.id === activeTabId
                              ? { ...t, title: newTitle }
                              : t,
                          ),
                        );
                        setDocSaveStatus("saving");
                      }}
                      onBlur={(e) => {
                        const currentTab = tabs.find(
                          (t) => t.id === activeTabId,
                        );
                        if (currentTab)
                          saveDraftToLibrary({
                            ...currentTab,
                            title: e.target.value,
                          });
                      }}
                      placeholder="Untitled"
                      className="w-full bg-transparent text-[#f4f4f5] tracking-tight font-normal pb-2 resize-none outline-none leading-[1.25] text-[2.2rem] md:text-[2.6rem] placeholder:text-[#3f3f46] font-jakarta"
                    />

                    {/* Main Document Content Area */}
                    <div className="min-h-[400px]">
                      <div
                        ref={editorRef}
                        contentEditable={!isReadOnly}
                        suppressContentEditableWarning
                        data-placeholder={isReadOnly ? "" : "Start writing..."}
                        className="w-full bg-transparent text-inherit outline-none min-h-[400px] leading-relaxed focus:outline-none markdown-body"
                        onInput={(e) => {
                          const html = e.currentTarget.innerHTML;
                          
                          // Typing session manager for undo/redo snapshots
                          if (!isTypingRef.current) {
                            pushToUndo();
                            isTypingRef.current = true;
                          }
                          if (typingTimerRef.current) {
                            clearTimeout(typingTimerRef.current);
                          }
                          typingTimerRef.current = setTimeout(() => {
                            isTypingRef.current = false;
                          }, 1200);

                          lastContentRef.current = html;
                          lastLocalEditTimeRef.current = Date.now();
                          setDocumentContent(html);
                          setTabs((prev) =>
                            prev.map((t) =>
                              t.id === activeTabId
                                ? { ...t, content: html }
                                : t,
                            ),
                          );
                          setDocSaveStatus("saving");
                        }}
                        onKeyDown={(e) => {
                          const isMod = e.metaKey || e.ctrlKey;
                          if (isMod && e.key.toLowerCase() === "z") {
                            e.preventDefault();
                            if (e.shiftKey) {
                              handleRedo();
                            } else {
                              handleUndo();
                            }
                          } else if (isMod && e.key.toLowerCase() === "y") {
                            e.preventDefault();
                            handleRedo();
                          }
                        }}
                        onBlur={() => {
                          isTypingRef.current = false;
                          if (typingTimerRef.current) {
                            clearTimeout(typingTimerRef.current);
                          }
                          if (editorRef.current) {
                            const originalHtml = editorRef.current.innerHTML;
                            const html = linkifyHtml(originalHtml);
                            if (html !== originalHtml) {
                              editorRef.current.innerHTML = html;
                            }
                            lastContentRef.current = html;
                            setDocumentContent(html);
                            setTabs((prev) =>
                              prev.map((t) =>
                                t.id === activeTabId
                                  ? { ...t, content: html }
                                  : t,
                              ),
                            );
                            const currentTab = tabs.find(
                              (t) => t.id === activeTabId,
                            );
                            if (currentTab)
                              saveDraftToLibrary({
                                ...currentTab,
                                content: html,
                              });
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          pushToUndo();
                          isTypingRef.current = false;
                          if (typingTimerRef.current) {
                            clearTimeout(typingTimerRef.current);
                          }
                          const text = e.clipboardData.getData("text/plain");
                          if (text) {
                            const urlPattern =
                              /^(?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]$|^(?:www\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])$/i;
                            let htmlToInsert = "";
                            if (urlPattern.test(text.trim())) {
                              const href = text
                                .trim()
                                .toLowerCase()
                                .startsWith("www.")
                                ? `http://${text.trim()}`
                                : text.trim();
                              htmlToInsert = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline cursor-pointer">${text.trim()}</a>`;
                            } else {
                              htmlToInsert = linkifyHtml(
                                text
                                  .replace(/&/g, "&amp;")
                                  .replace(/</g, "&lt;")
                                  .replace(/>/g, "&gt;"),
                              );
                            }
                            document.execCommand(
                              "insertHTML",
                              false,
                              htmlToInsert,
                            );
                          }
                        }}
                        onContextMenu={(e) => {
                          const target = e.target as HTMLElement;
                          const anchor = target.closest("a");
                          const table = target.closest("table") as HTMLTableElement | null;
                          const chart = target.closest(".chart-embed-wrapper") as HTMLElement | null;
                          
                          if (anchor) {
                            e.preventDefault();
                            e.stopPropagation();
                            setTableContextMenu(null);
                            setChartContextMenu(null);
                            setLinkContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              target: anchor,
                            });
                          } else if (table) {
                            e.preventDefault();
                            e.stopPropagation();
                            setLinkContextMenu(null);
                            setChartContextMenu(null);
                            const cell = target.closest("th, td") as HTMLTableCellElement | null;
                            setTableContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              target: table,
                              cell: cell,
                            });
                          } else if (chart) {
                            e.preventDefault();
                            e.stopPropagation();
                            setLinkContextMenu(null);
                            setTableContextMenu(null);
                            setChartContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              target: chart,
                            });
                          } else {
                            setLinkContextMenu(null);
                            setTableContextMenu(null);
                            setChartContextMenu(null);
                          }
                        }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          const anchor = target.closest("a");
                          if (anchor) {
                            const href = anchor.getAttribute("href");
                            if (href) {
                              e.preventDefault();
                              e.stopPropagation();

                              if (href.startsWith("#cite-page-")) {
                                // Custom citation coordinates link
                                const dataStr = href.replace("#cite-page-", "");
                                const firstHyphen = dataStr.indexOf("-");
                                if (firstHyphen !== -1) {
                                  const page = parseInt(
                                    dataStr.substring(0, firstHyphen),
                                  );
                                  const encodedTitle = dataStr.substring(
                                    firstHyphen + 1,
                                  );
                                  try {
                                    const title =
                                      decodeURIComponent(encodedTitle);
                                    handleCitationClick(page, title);
                                  } catch (err) {
                                    console.error(
                                      "Failed parsing citation target",
                                      err,
                                    );
                                  }
                                }
                              } else {
                                // Standard external URL link
                                const tempLink = document.createElement("a");
                                tempLink.href = href;
                                tempLink.target = "_blank";
                                tempLink.rel = "noopener noreferrer";
                                document.body.appendChild(tempLink);
                                tempLink.click();
                                document.body.removeChild(tempLink);
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <SidePanel
            isOpen={isSidePanelOpen && activeTab.type === "document"}
            onClose={() => setIsSidePanelOpen(false)}
            tabId={activeTabId}
            activeTab={activeTab}
            papers={papers}
            onUpdatePaper={(updatedPaper) => {
              dbSetPaper(updatedPaper);
              if (
                activeViewingPaper &&
                activeViewingPaper.title === updatedPaper.title
              ) {
                setActiveViewingPaper(updatedPaper);
              }
            }}
            extractTextFromPdf={extractTextFromPdf}
          />
        </div>
      </div>

      {/* Right Section - AI Assistant Window Panel */}
      {isAssistantOpen && (
        <div className={`p-[4px] flex h-full shrink-0 ${isElectronApp ? "pt-[38px]" : ""}`}>
          <div className="w-[360px] md:w-[420px] bg-[#121212] rounded-2xl flex flex-col h-full shrink-0 overflow-hidden animate-slide-in relative">
            <div className={`flex flex-col h-full w-full transition-all duration-300 ${!isOnline ? "blur-[6px] select-none pointer-events-none" : ""}`}>
            {/* Assistant Header */}
            <div className={`h-[52px] flex items-center justify-between px-5 shrink-0 bg-[#121212] relative ${isElectronApp ? "" : "[-webkit-app-region:drag]"}`}>
              <div className="relative flex-1 min-w-0 pr-4 [-webkit-app-region:no-drag]">
                <button
                  onClick={() =>
                    setIsAssistantChatDropdownOpen(!isAssistantChatDropdownOpen)
                  }
                  className="flex items-center gap-2 text-[#e4e4e7] hover:bg-[#1c1c1f] px-3 py-1.5 rounded-xl transition-colors cursor-pointer group max-w-full"
                >
                  <span className="font-semibold text-[13px] tracking-tight text-[#f4f4f5] truncate max-w-[240px]">
                    {(() => {
                      const chatTabs = tabs.filter((t) => t.type === "chat");
                      const currentChat =
                        chatTabs.find(
                          (t) =>
                            t.id ===
                            (activeAssistantTabId || activeTabIdRef.current),
                        ) || (chatTabs.length > 0 ? chatTabs[0] : null);
                      return currentChat
                        ? currentChat.title
                        : "Research Assistant";
                    })()}
                  </span>
                  <Icon
                    icon="ph:caret-down"
                    className={`w-3.5 h-3.5 shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-transform ${isAssistantChatDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isAssistantChatDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAssistantChatDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1.5 w-[280px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 max-h-72 overflow-y-auto">
                      <div className="px-2.5 py-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider select-none">
                        All Conversations
                      </div>
                      {allChats.map((chatTab) => (
                        <button
                          key={chatTab.id}
                          onClick={() => {
                            const isOpen = tabs.some(
                              (t) => t.id === chatTab.id,
                            );
                            if (isOpen) {
                              setActiveTabId(chatTab.id);
                              setActiveAssistantTabId(chatTab.id);
                            } else {
                              setTabs((prev) => [...prev, chatTab]);
                              setActiveTabId(chatTab.id);
                              setActiveAssistantTabId(chatTab.id);
                            }
                            setIsAssistantChatDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer ${
                            chatTab.id ===
                            (activeAssistantTabId ||
                              tabs.find((t) => t.type === "chat")?.id)
                              ? "bg-[#27272a] text-white"
                              : "text-zinc-400 hover:text-white hover:bg-[#222222]"
                          }`}
                        >
                          <Icon
                            icon="ph:chat-circle"
                            className="w-4 h-4 shrink-0 text-zinc-500"
                          />
                          <span className="text-xs font-medium truncate">
                            {cleanTitleStr(chatTab.title)}
                          </span>
                        </button>
                      ))}
                      <div className="border-t border-[#2d2d30] my-1" />
                      <button
                        onClick={() => {
                          const newId = `chat-${Date.now()}`;
                          const newChatTab: Tab = {
                            id: newId,
                            type: "chat" as const,
                            title: "New chat",
                            messages: [],
                          };
                          setTabs([...tabs, newChatTab]);
                          setActiveAssistantTabId(newId);
                          setMessages([]);
                          setIsAssistantChatDropdownOpen(false);
                          saveChatToLibrary(currentUser?.uid || "guest", newChatTab);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-zinc-400 hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
                        title="New Chat"
                      >
                        <Icon
                          icon="ph:plus"
                          className="w-4 h-4 shrink-0 text-zinc-500"
                        />
                        <span className="text-xs font-semibold">New Chat</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setIsAssistantOpen(false)}
                className="text-[#52525b] hover:text-[#e4e4e7] transition-colors p-[4px] rounded-md hover:bg-[#1c1c1e] cursor-pointer shrink-0 [-webkit-app-region:no-drag]"
                aria-label="Close Assistant"
                title="Collapse Panel"
              >
                <Icon icon="ph:caret-double-right" className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Conversation Stream Pane (Scrollable completely independently from Left Editor view) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121212] flex flex-col min-h-0">
              {messages.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center py-12">
                  <img
                    src="/cosmi.png"
                    alt="Cosmi Logo"
                    className="w-24 h-24 md:w-32 md:h-32 opacity-25 select-none grayscale invert animate-fade-in"
                  />
                </div>
              ) : (
                messages
                  .filter((m) => !m.isHidden)
                  .map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col w-full ${
                        m.role === "user" ? "items-end" : "items-start"
                      } gap-1.5`}
                    >
                      {/* Separate Attachment Bubble */}
                      {m.role === "user" && m.attachment && (
                        <div className="mb-0.5 w-fit">
                          {m.attachment.mimetype?.startsWith("image/") ? (
                            <img 
                              src={m.attachment.url} 
                              alt="attachment" 
                              className="w-40 h-auto max-h-56 object-cover rounded-xl border border-zinc-800 pointer-events-auto cursor-zoom-in"
                              onClick={() => window.open(m.attachment!.url, "_blank")}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="max-w-[88%] bg-[#262626] text-white rounded-xl p-1.5 border border-zinc-800 flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                                <Icon icon="ph:file-text" className="w-[18px] h-[18px]" />
                              </div>
                              <div className="min-w-0 flex-1 pr-2 mt-0.5">
                                <p className="text-[11px] font-semibold text-zinc-300 truncate pr-2 max-w-[130px]">{m.attachment.fileName}</p>
                                <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wide">
                                  DOCUMENT FILE
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Text message bubble */}
                      {(!m.attachment || (m.content && m.content.trim().length > 0) || m.role !== "user") && (
                        <div
                          className={`${
                            m.role === "user"
                              ? "self-end max-w-[88%] bg-[#262626] text-white rounded-xl rounded-br-none p-3.5"
                              : "self-start max-w-full bg-transparent text-[#d4d4d8] py-2"
                          } text-[13px] leading-relaxed transition-all`}
                        >
                          {m.role === "assistant" && m.thought && (
                            <div className="mb-3">
                              <details className="group [&_summary::-webkit-details-marker]:hidden">
                                <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#71717a] hover:text-[#a1a1aa] transition-colors select-none w-fit">
                                  <Icon
                                    icon="ph:lightbulb"
                                    className="w-3.5 h-3.5"
                                  />
                                  <span>Thinking</span>
                                  <Icon
                                    icon="ph:caret-right"
                                    className="w-[10px] h-[10px] group-open:rotate-90 transition-transform"
                                  />
                                </summary>
                                <div className="mt-2 pl-3 border-l border-zinc-800 text-xs text-zinc-400 font-sans leading-relaxed markdown-body">
                                  <ReactMarkdown>{m.thought}</ReactMarkdown>
                                </div>
                              </details>
                            </div>
                          )}
                          <div
                            className={`select-text break-words ${m.role === "user" ? "whitespace-pre-wrap" : "markdown-body text-[#d4d4d8]"}`}
                          >
                            {m.role === "user" ? (
                              renderLinkifiedText(m.content)
                            ) : (
                              <TypewriterMarkdown
                                content={m.content}
                                timestamp={m.timestamp}
                                onCitationClick={handleCitationClick}
                                isStreaming={
                                  isAiTyping &&
                                  m.id === messages[messages.length - 1]?.id
                                }
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
              )}

              {/* Streaming loading animation state */}
              {(isAiTyping || researchStatus) && !(messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content?.trim() && !researchStatus) && (
                <div className="self-start bg-transparent py-2 max-w-full text-[13px] leading-relaxed select-none">
                  <DynamicShimmer
                    isAiTyping={isAiTyping}
                    researchStatus={researchStatus}
                    messages={messages}
                    webSearchEnabled={webSearchEnabled}
                  />
                </div>
              )}

              {/* Dummy Anchor for list focus */}
              <div ref={messagesEndRef} />
            </div>

            {/* Workspace Assistant Prompt Input Bar (Fixed at layout bottom) */}
            <div className="p-3.5 shrink-0 bg-[#121212]">
              {attachedFile && (
                <div className="mb-2 w-fit px-1 pt-1 animate-fade-in">
                  {attachedFile.mimetype?.startsWith("image/") ? (
                    <div className="relative group w-fit">
                      <img 
                        src={attachedFile.url} 
                        alt="attachment preview" 
                        className="w-16 h-16 object-cover rounded-xl border border-zinc-700"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        onClick={() => setAttachedFile(null)}
                        className="absolute -top-2 -right-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md hover:bg-zinc-700 font-semibold cursor-pointer"
                        title="Remove image"
                      >
                        <Icon icon="ph:x" className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#1a1a1c] border border-zinc-800 rounded-2xl px-3 py-2 flex items-center justify-between gap-3 shadow-sm max-w-[240px]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0 shadow-inner">
                          <Icon icon="ph:file-text" className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 pr-2 flex flex-col justify-center">
                          <p className="text-[12px] font-semibold text-zinc-200 truncate pr-1">{attachedFile.fileName}</p>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
                            DOCUMENT FILE
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setAttachedFile(null)}
                        className="text-zinc-500 hover:text-zinc-300 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-700"
                        title="Remove file"
                      >
                        <Icon icon="ph:x" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-[#222222] rounded-[10px] flex flex-col border border-transparent transition-colors">
                <textarea
                  key={`assistant-chat-input-${activeTabId}`}
                  id={`assistant-chat-input-${activeTabId}`}
                  name={`assistant-chat-input-${activeTabId}`}
                  autoComplete="off"
                  placeholder="Ask about your research, sources, or draft content..."
                  value={assistantInput}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(undefined, { fromSidePanel: true });
                    }
                  }}
                  className="w-full bg-transparent text-[13.5px] text-[#e4e4e7] placeholder-[#71717a] py-3 px-3.5 resize-none focus:outline-none min-h-[70px] leading-relaxed"
                />

                {/* Actions and Paper attachment triggers inside input frame */}
                <div className="flex justify-between items-center px-2 pb-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handlePaperclipClick}
                      className="text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#2d2d30] transition-colors p-[6px] rounded-md cursor-pointer flex items-center justify-center w-8 h-8 shrink-0 border border-transparent"
                      title="Upload File or Photo"
                    >
                      <Icon icon="ph:plus-bold" className="w-[16px] h-[16px]" />
                    </button>
                    <button
                      onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-[6px] transition-colors text-[11px] font-semibold cursor-pointer border ${
                        webSearchEnabled
                          ? "bg-zinc-800 border-zinc-700 text-white"
                          : "border-transparent text-[#71717a] hover:text-[#e4e4e7] bg-transparent hover:bg-[#2d2d30]"
                      }`}
                      title={webSearchEnabled ? "Disable web search grounding" : "Enable web search grounding"}
                    >
                      <Icon icon={webSearchEnabled ? "ph:globe-hemisphere-east-fill" : "ph:globe"} className="w-3.5 h-3.5 shrink-0" />
                      <span>Web</span>
                    </button>
                  </div>

                  {isAiTyping ? (
                    <button
                      onClick={() => {
                        abortControllerRef.current?.abort();
                        setIsAiTyping(false);
                        updateChatMessages((prev) => prev, false);
                      }}
                      className="text-[#ef4444] hover:bg-[#2d2d30] transition-colors p-[6px] rounded-md cursor-pointer relative"
                    >
                      <Icon
                        icon="ph:spinner-gap"
                        className="w-5 h-5 animate-spin"
                      />
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        handleSendMessage(undefined, { fromSidePanel: true })
                      }
                      disabled={!assistantInput.trim()}
                      className={`transition-colors p-[6px] rounded-md cursor-pointer ${
                        assistantInput.trim()
                          ? "text-[#f4f4f5] hover:bg-[#2d2d30]"
                          : "text-[#52525b] cursor-not-allowed"
                      }`}
                    >
                      <Icon icon="ph:paper-plane-right" className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            </div>

            {!isOnline && (
              <div className="absolute inset-0 bg-transparent z-[99] flex flex-col items-center justify-center p-6 text-center animate-fade-in pointer-events-auto">
                <div className="bg-[#1a1a1a]/95 border border-zinc-800 rounded-2xl p-6 max-w-xs flex flex-col items-center gap-3.5 shadow-xl select-none">
                  <div className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                    <Icon icon="ph:wifi-slash" className="w-[20px] h-[20px]" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-[13.5px] tracking-tight mb-1">
                      You are currently offline
                    </h3>
                    <p className="text-zinc-500 text-[11px] leading-relaxed">
                      Connect your account to the network to chat with the AI research assistant. Local notebook features, document drafting, and data analyses remain fully available.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {linkContextMenu && (
        <div
          id="link-context-menu"
          className="fixed z-[9999] bg-[#121212] border border-[#27272a] rounded-lg py-1 min-w-[160px] text-[#e4e4e7] select-none text-xs font-medium"
          style={{
            top: `${linkContextMenu.y}px`,
            left: `${linkContextMenu.x}px`,
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
        >
          <button
            id="btn-rename-hyperlink"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const t = linkContextMenu.target;
              setLinkToRename({
                target: t,
                initialText: t.innerText || t.textContent || "",
                initialUrl: t.getAttribute("href") || "",
              });
              setRenameText(t.innerText || t.textContent || "");
              setRenameUrl(t.getAttribute("href") || "");
              setShowLinkRenameModal(true);
              setLinkContextMenu(null);
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-[#202022] transition-colors flex items-center gap-2 text-zinc-200 cursor-pointer"
          >
            <Edit2 size={13} />
            <span>Rename hyperlink</span>
          </button>

          <button
            id="btn-open-hyperlink"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const href = linkContextMenu.target.getAttribute("href");
              if (href) {
                const tempLink = document.createElement("a");
                tempLink.href = href;
                tempLink.target = "_blank";
                tempLink.rel = "noopener noreferrer";
                document.body.appendChild(tempLink);
                tempLink.click();
                document.body.removeChild(tempLink);
              }
              setLinkContextMenu(null);
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-[#202022] transition-colors flex items-center gap-2 text-zinc-200 cursor-pointer border-t border-[#1a1a1c]"
          >
            <ExternalLink size={13} />
            <span>Open link</span>
          </button>

          <button
            id="btn-remove-hyperlink"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const t = linkContextMenu.target;
              if (t) {
                // Remove anchor tag, keeping the inline text content
                const parent = t.parentNode;
                if (parent) {
                  while (t.firstChild) {
                    parent.insertBefore(t.firstChild, t);
                  }
                  parent.removeChild(t);
                }

                // Sync to state
                if (editorRef.current) {
                  const html = editorRef.current.innerHTML;
                  lastContentRef.current = html;
                  setDocumentContent(html);
                }
              }
              setLinkContextMenu(null);
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-zinc-800 text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-2 border-t border-[#1a1a1c] cursor-pointer"
          >
            <Unlink size={13} />
            <span>Remove link</span>
          </button>
        </div>
      )}

      {tableContextMenu && (
        <div
          id="table-context-menu"
          className="fixed z-[9999] bg-[#121212] border border-[#27272a] rounded-lg py-1 min-w-[180px] text-[#e4e4e7] select-none text-xs font-medium shadow-2xl"
          style={{
            top: `${tableContextMenu.y}px`,
            left: `${tableContextMenu.x}px`,
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
        >
          {tableContextMenu.cell && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const curRow = targetCell?.closest("tr");
                  if (curRow && editorRef.current) {
                    const numCells = curRow.children.length;
                    const isHeader = curRow.closest("thead") !== null;
                    const newRow = document.createElement("tr");
                    newRow.style.borderBottom = "1px solid #27272a";
                    for (let i = 0; i < numCells; i++) {
                      const cellTag = isHeader ? "th" : "td";
                      const newCell = document.createElement(cellTag);
                      newCell.style.padding = "10px 12px";
                      newCell.style.color = isHeader ? "#e4e4e7" : "#d4d4d8";
                      if (isHeader) {
                        newCell.style.fontWeight = "600";
                        newCell.style.textAlign = "left";
                      }
                      if (i < numCells - 1) {
                        newCell.style.borderRight = "1px solid #27272a";
                      }
                      newCell.innerHTML = isHeader ? `Header` : `Cell`;
                      newRow.appendChild(newCell);
                    }
                    curRow.parentNode?.insertBefore(newRow, curRow);
                    
                    const html = editorRef.current.innerHTML;
                    lastContentRef.current = html;
                    setDocumentContent(html);
                    setTabs((prev) =>
                      prev.map((tb) =>
                        tb.id === activeTabId ? { ...tb, content: html } : tb,
                      ),
                    );
                    setDocSaveStatus("saving");
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#202022] hover:text-white transition-colors flex items-center gap-2 cursor-pointer text-zinc-300"
              >
                <Icon icon="ph:arrow-fat-up-light" className="w-[14px] h-[14px] text-zinc-400" />
                <span>Insert Row Above</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const curRow = targetCell?.closest("tr");
                  if (curRow && editorRef.current) {
                    const numCells = curRow.children.length;
                    const newRow = document.createElement("tr");
                    newRow.style.borderBottom = "1px solid #27272a";
                    for (let i = 0; i < numCells; i++) {
                      const cellTag = "td";
                      const newCell = document.createElement(cellTag);
                      newCell.style.padding = "10px 12px";
                      newCell.style.color = "#d4d4d8";
                      if (i < numCells - 1) {
                        newCell.style.borderRight = "1px solid #27272a";
                      }
                      newCell.innerHTML = `Cell`;
                      newRow.appendChild(newCell);
                    }
                    curRow.parentNode?.insertBefore(newRow, curRow.nextSibling);
                    
                    const html = editorRef.current.innerHTML;
                    lastContentRef.current = html;
                    setDocumentContent(html);
                    setTabs((prev) =>
                      prev.map((tb) =>
                        tb.id === activeTabId ? { ...tb, content: html } : tb,
                      ),
                    );
                    setDocSaveStatus("saving");
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#202022] hover:text-white transition-colors flex items-center gap-2 cursor-pointer text-zinc-300"
              >
                <Icon icon="ph:arrow-fat-down-light" className="w-[14px] h-[14px] text-zinc-400" />
                <span>Insert Row Below</span>
              </button>

              <div className="h-[1px] bg-[#2d2d30] my-1" />

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const table = tableContextMenu.target;
                  if (targetCell && table && editorRef.current) {
                    const colIndex = targetCell.cellIndex;
                    if (colIndex !== undefined && colIndex !== -1) {
                      const rows = table.querySelectorAll("tr");
                      rows.forEach((r) => {
                        const cells = Array.from(r.children);
                        const originCell = cells[colIndex];
                        if (originCell) {
                          const isHeader = originCell.nodeName === "TH";
                          const newCell = document.createElement(isHeader ? "th" : "td");
                          newCell.style.padding = "10px 12px";
                          newCell.style.color = isHeader ? "#e4e4e7" : "#d4d4d8";
                          newCell.innerHTML = isHeader ? "Header" : "Cell";
                          if (isHeader) {
                            newCell.style.fontWeight = "600";
                            newCell.style.textAlign = "left";
                          }
                          r.insertBefore(newCell, originCell);
                        }
                      });

                      table.querySelectorAll("tr").forEach((r) => {
                        const cells = Array.from(r.children) as HTMLElement[];
                        cells.forEach((cell, idx) => {
                          cell.style.borderRight = idx === cells.length - 1 ? "none" : "1px solid #27272a";
                        });
                      });

                      const html = editorRef.current.innerHTML;
                      lastContentRef.current = html;
                      setDocumentContent(html);
                      setTabs((prev) =>
                        prev.map((tb) =>
                          tb.id === activeTabId ? { ...tb, content: html } : tb,
                        ),
                      );
                      setDocSaveStatus("saving");
                    }
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#202022] hover:text-white transition-colors flex items-center gap-2 cursor-pointer text-zinc-300"
              >
                <Icon icon="ph:arrow-fat-left-light" className="w-[14px] h-[14px] text-zinc-400" />
                <span>Insert Column Left</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const table = tableContextMenu.target;
                  if (targetCell && table && editorRef.current) {
                    const colIndex = targetCell.cellIndex;
                    if (colIndex !== undefined && colIndex !== -1) {
                      const rows = table.querySelectorAll("tr");
                      rows.forEach((r) => {
                        const cells = Array.from(r.children);
                        const originCell = cells[colIndex];
                        if (originCell) {
                          const isHeader = originCell.nodeName === "TH";
                          const newCell = document.createElement(isHeader ? "th" : "td");
                          newCell.style.padding = "10px 12px";
                          newCell.style.color = isHeader ? "#e4e4e7" : "#d4d4d8";
                          newCell.innerHTML = isHeader ? "Header" : "Cell";
                          if (isHeader) {
                            newCell.style.fontWeight = "600";
                            newCell.style.textAlign = "left";
                          }
                          r.insertBefore(newCell, originCell.nextSibling);
                        }
                      });

                      table.querySelectorAll("tr").forEach((r) => {
                        const cells = Array.from(r.children) as HTMLElement[];
                        cells.forEach((cell, idx) => {
                          cell.style.borderRight = idx === cells.length - 1 ? "none" : "1px solid #27272a";
                        });
                      });

                      const html = editorRef.current.innerHTML;
                      lastContentRef.current = html;
                      setDocumentContent(html);
                      setTabs((prev) =>
                        prev.map((tb) =>
                          tb.id === activeTabId ? { ...tb, content: html } : tb,
                        ),
                      );
                      setDocSaveStatus("saving");
                    }
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#202022] hover:text-white transition-colors flex items-center gap-2 cursor-pointer text-zinc-300"
              >
                <Icon icon="ph:arrow-fat-right-light" className="w-[14px] h-[14px] text-zinc-400" />
                <span>Insert Column Right</span>
              </button>

              <div className="h-[1px] bg-[#2d2d30] my-1" />

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const curRow = targetCell?.closest("tr");
                  const table = tableContextMenu.target;
                  if (curRow && table && editorRef.current) {
                    curRow.remove();
                    if (table.querySelectorAll("tr").length === 0) {
                      table.remove();
                    }
                    
                    const html = editorRef.current.innerHTML;
                    lastContentRef.current = html;
                    setDocumentContent(html);
                    setTabs((prev) =>
                      prev.map((tb) =>
                        tb.id === activeTabId ? { ...tb, content: html } : tb,
                      ),
                    );
                    setDocSaveStatus("saving");
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#202022] text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Icon icon="ph:minus" className="w-[14px] h-[14px]" />
                <span>Remove Current Row</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const table = tableContextMenu.target;
                  if (targetCell && table && editorRef.current) {
                    const colIndex = targetCell.cellIndex;
                    if (colIndex !== undefined && colIndex !== -1) {
                      const rows = table.querySelectorAll("tr");
                      rows.forEach((r) => {
                        const cells = Array.from(r.children);
                        if (cells[colIndex]) {
                          cells[colIndex].remove();
                        }
                      });

                      const firstRow = table.querySelector("tr");
                      if (!firstRow || firstRow.children.length === 0) {
                        table.remove();
                      } else {
                        table.querySelectorAll("tr").forEach((r) => {
                          const cells = Array.from(r.children) as HTMLElement[];
                          cells.forEach((cell, idx) => {
                            cell.style.borderRight = idx === cells.length - 1 ? "none" : "1px solid #27272a";
                          });
                        });
                      }

                      const html = editorRef.current.innerHTML;
                      lastContentRef.current = html;
                      setDocumentContent(html);
                      setTabs((prev) =>
                        prev.map((tb) =>
                          tb.id === activeTabId ? { ...tb, content: html } : tb,
                        ),
                      );
                      setDocSaveStatus("saving");
                    }
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#202022] text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Icon icon="ph:columns-light" className="w-[14px] h-[14px]" />
                <span>Remove Current Column</span>
              </button>

              <div className="h-[1px] bg-[#2d2d30] my-1" />
            </>
          )}

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              pushToUndo();
              const t = tableContextMenu.target;
              if (t) {
                t.remove();
                if (editorRef.current) {
                  const html = editorRef.current.innerHTML;
                  lastContentRef.current = html;
                  setDocumentContent(html);
                  setTabs((prev) =>
                    prev.map((tb) =>
                      tb.id === activeTabId ? { ...tb, content: html } : tb,
                    ),
                  );
                  setDocSaveStatus("saving");
                }
              }
              setTableContextMenu(null);
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-[#202022] text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-2 cursor-pointer font-semibold"
          >
            <Icon icon="ph:trash" className="w-[14px] h-[14px]" />
            <span>Remove Entire Table</span>
          </button>
        </div>
      )}

      {chartContextMenu && (
        <div
          id="chart-context-menu"
          className="fixed z-[9999] bg-[#121212] border border-[#27272a] rounded-lg py-1 min-w-[180px] text-[#e4e4e7] select-none text-xs font-medium shadow-2xl"
          style={{
            top: `${chartContextMenu.y}px`,
            left: `${chartContextMenu.x}px`,
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const t = chartContextMenu.target;
              if (t) {
                const rawState = t.getAttribute('data-chart-state');
                if (rawState) {
                  try {
                    const decoded = JSON.parse(decodeURIComponent(atob(rawState)));
                    if (decoded.chartType) setChartType(decoded.chartType);
                    if (decoded.chartTitle !== undefined) setChartTitle(decoded.chartTitle);
                    if (decoded.chartDataColor) setChartDataColor(decoded.chartDataColor);
                    if (decoded.chartLabels) setChartLabels(decoded.chartLabels);
                    if (decoded.chartValues) setChartValues(decoded.chartValues);
                    if (decoded.chartIndividualColors) {
                      setChartIndividualColors(decoded.chartIndividualColors);
                    } else {
                      setChartIndividualColors([]);
                    }
                    setOpenRowColorPickerIdx(null);
                  } catch (err) {
                    console.warn("Could not decode chart state");
                  }
                }
                t.setAttribute('data-is-editing', 'true');
                setChartBeingEdited(t);
                setIsChartModalOpen(true);
              }
              setChartContextMenu(null);
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-[#202022] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Edit2 size={13} />
            <span>Modify Chart</span>
          </button>
          
          <div className="h-[1px] bg-[#1a1a1c] w-full" />
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              pushToUndo();
              const t = chartContextMenu.target;
              if (t) {
                // If it is followed by an empty p tag, maybe remove that too (optional, let's keep it simple)
                t.remove();
                if (editorRef.current) {
                  const html = editorRef.current.innerHTML;
                  lastContentRef.current = html;
                  setDocumentContent(html);
                  setTabs((prev) =>
                    prev.map((tb) =>
                      tb.id === activeTabId ? { ...tb, content: html } : tb,
                    ),
                  );
                  setDocSaveStatus("saving");
                }
              }
              setChartContextMenu(null);
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-[#202022] text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-2 cursor-pointer font-semibold"
          >
            <Icon icon="ph:trash" className="w-[14px] h-[14px]" />
            <span>Remove Chart</span>
          </button>
        </div>
      )}

      {showLinkRenameModal && linkToRename && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 select-none"
          onClick={() => {
            setShowLinkRenameModal(false);
            setLinkToRename(null);
          }}
        >
          <div
            className="bg-[#121212] border border-[#27272a] rounded-xl p-5 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[#f4f4f5] font-medium text-base mb-4 flex items-center gap-2 border-b border-[#222224] pb-2">
              <LinkIcon size={16} className="text-blue-400" />
              Rename Hyperlink
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Display Word/Text
                </label>
                <input
                  type="text"
                  className="w-full bg-[#1e1e1e] border border-[#27272a] rounded-lg px-3 py-2.5 text-zinc-200 text-xs focus:border-zinc-500 focus:outline-none placeholder:text-zinc-600 transition-colors"
                  placeholder="e.g., Disney History"
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const anchor = linkToRename.target;
                      if (anchor) {
                        anchor.innerText =
                          renameText.trim() || renameUrl.trim();
                        anchor.setAttribute("href", renameUrl.trim());
                        if (editorRef.current) {
                          const html = editorRef.current.innerHTML;
                          lastContentRef.current = html;
                          setDocumentContent(html);
                        }
                      }
                      setShowLinkRenameModal(false);
                      setLinkToRename(null);
                    }
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  URL Destination
                </label>
                <input
                  type="text"
                  className="w-full bg-[#1e1e1e] border border-[#27272a] rounded-lg px-3 py-2.5 text-zinc-200 text-xs focus:border-zinc-500 focus:outline-none placeholder:text-zinc-600 transition-colors cursor-text"
                  placeholder="https://..."
                  value={renameUrl}
                  onChange={(e) => setRenameUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const anchor = linkToRename.target;
                      if (anchor) {
                        anchor.innerText =
                          renameText.trim() || renameUrl.trim();
                        anchor.setAttribute("href", renameUrl.trim());
                        if (editorRef.current) {
                          const html = editorRef.current.innerHTML;
                          lastContentRef.current = html;
                          setDocumentContent(html);
                        }
                      }
                      setShowLinkRenameModal(false);
                      setLinkToRename(null);
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-[#222224]">
              <button
                onClick={() => {
                  setShowLinkRenameModal(false);
                  setLinkToRename(null);
                }}
                className="px-3.5 py-2 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const anchor = linkToRename.target;
                  if (anchor) {
                    anchor.innerText = renameText.trim() || renameUrl.trim();
                    anchor.setAttribute("href", renameUrl.trim());

                    if (editorRef.current) {
                      const html = editorRef.current.innerHTML;
                      lastContentRef.current = html;
                      setDocumentContent(html);
                    }
                  }
                  setShowLinkRenameModal(false);
                  setLinkToRename(null);
                  showToast("Hyperlink updated successfully", "success");
                }}
                className="px-3.5 py-2 rounded-lg text-xs bg-zinc-100 hover:bg-white text-black font-semibold transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Deletion Confirmation Modal */}
      {isDeleteFolderModalOpen && folderToDelete && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4 animate-fade-in"
          onClick={() => setIsDeleteFolderModalOpen(false)}
        >
          <div
            className="bg-[#1c1c1e] border border-zinc-800 rounded-[20px] w-full max-w-[320px] overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2 text-left">
                Delete Folder?
              </h3>
              <p className="text-zinc-400 text-[13px] leading-normal mb-6 text-left">
                Are you sure you want to delete{" "}
                <span className="text-zinc-200 font-semibold">
                  "{folderToDelete.name}"
                </span>
                ? All documents indexed within this folder will be removed.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsDeleteFolderModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    dbDeleteFolder(folderToDelete.id);
                    setIsDeleteFolderModalOpen(false);
                    setFolderToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[13px] font-semibold transition-all cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoggingOut && (
        <div className="fixed inset-0 z-[20000] bg-black flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center"
          >
            <h2
              className="text-lg font-medium tracking-tight text-white shimmer-text"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Logging out...
            </h2>
          </motion.div>
        </div>
      )}

      {/* Zero-Glow Multi-User Share Modal */}
      {isShareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
        >
          <div className="bg-[#121212] border border-[#27272a] rounded-2xl w-full max-w-lg p-6 relative animate-scale-up text-zinc-300">
            <button
              onClick={() => setIsShareModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer focus:outline-none"
            >
              <Icon icon="ph:x" className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1.5 text-[#f4f4f5]">
              <Icon
                icon="ph:share-network-fill"
                className="w-5 h-5 text-zinc-400"
              />
              <h3 className="text-base font-semibold leading-normal truncate">
                Share &ldquo;{documentTitle || "Untitled Document"}&rdquo;
              </h3>
            </div>
            <p className="text-zinc-400 text-xs mb-5">
              Generate a shareable link to this document.
            </p>

            {/* General Access removed as per user request to only share documents and owner only typing */}

            {/* Copier Input Bar */}
            <div className="space-y-1.5 mb-5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Shareable link
              </label>
              <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-grow min-w-0">
                  <Icon
                    icon="ph:link"
                    className="w-[15px] h-[15px] text-zinc-500 shrink-0"
                  />
                  {isSharingLoading ? (
                    <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-mono">
                      <Icon
                        icon="ph:spinner-gap"
                        className="w-3.5 h-3.5 animate-spin text-zinc-500"
                      />
                      <span>Generating shareable path...</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="bg-transparent text-[#f4f4f5] font-mono text-[11px] outline-none border-none p-0 w-full select-all cursor-text focus:outline-none"
                      placeholder="Link will be populated below"
                    />
                  )}
                </div>
                {!isSharingLoading && generatedLink && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      showToast("Copied link to clipboard!", "success");
                    }}
                    className="shrink-0 bg-zinc-200 hover:bg-white text-[#09090b] font-semibold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition-colors focus:outline-none"
                  >
                    Copy Link
                  </button>
                )}
              </div>
            </div>

            {/* People with Access Display */}
            <div className="border-t border-[#27272a] pt-4 mb-5">
              <h4 className="text-[11.5px] font-semibold text-[#f4f4f5] mb-3">
                People with access
              </h4>

              <div className="max-h-[140px] overflow-y-auto custom-scrollbar-v space-y-2.5 pr-1">
                {/* Current User */}
                <div className="flex items-center justify-between py-1 px-1 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 border border-[#27272a] overflow-hidden text-[#e4e4e7]">
                      {localStorage.getItem("cosmi_settings_avatar_url") || currentUser?.photoURL ? (
                        <img
                          src={localStorage.getItem("cosmi_settings_avatar_url") || currentUser?.photoURL || ""}
                          alt="You"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-xs font-bold uppercase">
                          {
                            (localStorage.getItem(`cosmi_settings_full_name_${currentUser?.uid || "guest"}`) ||
                              currentUser?.displayName ||
                              currentUser?.email?.split("@")[0] ||
                              "Y")[0]
                          }
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#f4f4f5] leading-none mb-1">
                        {localStorage.getItem(`cosmi_settings_full_name_${currentUser?.uid || "guest"}`) ||
                          currentUser?.displayName ||
                          currentUser?.email?.split("@")[0] ||
                          "Guest user"}{" "}
                        (You)
                      </p>
                      <p className="text-[9.5px] text-zinc-500">
                        {currentUser?.email || "Guest Session"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/40 px-2 py-0.5 rounded border border-[#27272a]">
                    Owner
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#27272a]">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2 bg-[#27272a] hover:bg-[#323235] text-zinc-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors focus:outline-none"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isSettingsModalOpen && (
          <Settings 
            currentUser={currentUser} 
            onClose={() => setIsSettingsModalOpen(false)} 
            webSearchEnabled={webSearchEnabled}
            setWebSearchEnabled={setWebSearchEnabled}
            editorFont={editorFont}
            setEditorFont={setEditorFont}
            editorFontSize={editorFontSize}
            setEditorFontSize={setEditorFontSize}
            callMe={callMe}
            setCallMe={setCallMe}
            storageMode={storageMode}
            setStorageMode={setStorageMode}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isChartModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#2d2d30] rounded-2xl w-full max-w-4xl p-6 relative text-zinc-300 flex flex-col max-h-[90vh]"
            >
              <button
                onClick={closeChartModal}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <Icon icon="ph:x" className="w-5 h-5" />
              </button>

              <div className="mb-4 text-left">
                <h3 className="text-sm font-semibold text-zinc-150 uppercase tracking-wider">Embed Chart/Graph</h3>
                <p className="text-xs text-zinc-500">Design and insert fully responsive data visualizations into your documents.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-1 flex-1">
                {/* Left side: Form Settings */}
                <div className="space-y-4 text-left">
                  {/* Chart Type Selector */}
                  <div>
                    <span className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Chart Type</span>
                    <div className="flex gap-4 border-b border-[#27272a] pb-2 px-0.5">
                      {[
                        { id: "bar", label: "Bar Chart", icon: "ph:chart-bar" },
                        { id: "line", label: "Line Chart", icon: "ph:chart-line" },
                        { id: "pie", label: "Doughnut", icon: "ph:chart-pie" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setChartType(t.id as any)}
                          className={`py-1 px-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border-b-2 -mb-[10px] ${
                            chartType === t.id
                              ? "border-zinc-250 text-white"
                              : "border-transparent text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <Icon icon={t.icon} className="w-3.5 h-3.5" />
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Chart Title</label>
                    <input
                      type="text"
                      value={chartTitle}
                      onChange={(e) => setChartTitle(e.target.value)}
                      placeholder="e.g. Sales Analysis"
                      className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3.5 py-2 text-xs text-[#f4f4f5] outline-none transition-colors"
                    />
                  </div>

                  {/* Color Schemes */}
                  <div>
                    <span className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Color Scheme presets</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: "multicolor", label: "Multicolor", colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"] },
                        { id: "blue", label: "Blue Slate", colors: ["#3b82f6"] },
                        { id: "emerald", label: "Emerald", colors: ["#10b981"] },
                        { id: "purple", label: "Amethyst", colors: ["#8b5cf6"] },
                        { id: "amber", label: "Amber", colors: ["#f59e0b"] },
                        { id: "rose", label: "Crimson", colors: ["#f43f5e"] },
                        { id: "cyan", label: "Cyan", colors: ["#06b6d4"] },
                        { id: "orange", label: "Sunset Orange", colors: ["#f97316"] },
                        { id: "pink", label: "Hot Pink", colors: ["#ec4899"] },
                        { id: "indigo", label: "Indigo Sky", colors: ["#6366f1"] },
                        { id: "slate", label: "Cool Slate", colors: ["#64748b"] },
                        { id: "forest", label: "Forest Green", colors: ["#22c55e"] }
                      ].map((scheme) => (
                        <button
                          key={scheme.id}
                          type="button"
                          onClick={() => setChartDataColor(scheme.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors cursor-pointer justify-between ${
                            chartDataColor === scheme.id
                              ? "border-zinc-500 bg-zinc-800/40 text-white"
                              : "border-[#27272a] bg-[#161616] text-zinc-400 hover:border-zinc-500"
                          }`}
                        >
                          <span className="truncate">{scheme.label}</span>
                          <div className="flex -space-x-1.5 shrink-0">
                            {scheme.colors.slice(0, 3).map((c, i) => (
                              <div key={i} className="w-2.5 h-2.5 rounded-full ring-1 ring-black" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Data Series Fields */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider">Data Series ({chartLabels.length})</span>
                      <button
                        type="button"
                        onClick={() => {
                          setChartLabels([...chartLabels, `Group ${String.fromCharCode(65 + chartLabels.length)}`]);
                          setChartValues([...chartValues, 50]);
                          if (chartIndividualColors) {
                            setChartIndividualColors([...chartIndividualColors, ""]);
                          }
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white bg-[#1a1a1c] border border-[#27272a] px-2.5 py-1 rounded-lg transition-colors cursor-pointer mr-[34px]"
                      >
                        + Add Row
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                      {chartLabels.map((lbl, idx) => {
                        const schemeColors: Record<string, string[]> = {
                          multicolor: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#f97316", "#6366f1"],
                          emerald: ["#10b981", "#34d399", "#059669", "#a7f3d0", "#047857", "#065f46"],
                          blue: ["#3b82f6", "#60a5fa", "#2563eb", "#bfdbfe", "#1d4ed8", "#1e40af"],
                          purple: ["#8b5cf6", "#a78bfa", "#7c3aed", "#ddd6fe", "#6d28d9", "#5b21b6"],
                          amber: ["#f59e0b", "#fbbf24", "#d97706", "#fde68a", "#b45309", "#92400e"],
                          rose: ["#f43f5e", "#fb7185", "#e11d48", "#fecdd3", "#be123c", "#9f1239"],
                          cyan: ["#06b6d4", "#22d3ee", "#0891b2", "#cffafe", "#0e7490", "#155e75"],
                          orange: ["#f97316", "#fb923c", "#ea580c", "#ffedd5", "#c2410c", "#9a3412"],
                          pink: ["#ec4899", "#f472b6", "#db2777", "#fce7f3", "#be185d", "#9d174d"],
                          indigo: ["#6366f1", "#818cf8", "#4f46e5", "#e0e7ff", "#4338ca", "#3730a3"],
                          slate: ["#64748b", "#94a3b8", "#475569", "#f1f5f9", "#334155", "#1e293b"],
                          forest: ["#22c55e", "#4ade80", "#16a34a", "#dcfce7", "#15803d", "#14532d"]
                        };
                        const activeColors = schemeColors[chartDataColor] || schemeColors.blue;
                        const defaultRowColor = chartDataColor === "multicolor" ? activeColors[idx % activeColors.length] : activeColors[0];
                        const activeRowColor = (chartIndividualColors && chartIndividualColors[idx]) || defaultRowColor;

                        return (
                          <div key={idx} className="flex gap-2 items-center relative">
                            {/* Color Selector */}
                            <div className="relative shrink-0">
                              <button
                                type="button"
                                onClick={() => setOpenRowColorPickerIdx(openRowColorPickerIdx === idx ? null : idx)}
                                className="w-[26px] h-[26px] rounded-lg border border-[#27272a] hover:border-zinc-500 cursor-pointer flex items-center justify-center transition-all focus:outline-none"
                                style={{ backgroundColor: activeRowColor }}
                                title="Set Item Color"
                              >
                                <Icon icon="ph:paint-brush-broad" className="w-3.5 h-3.5 text-zinc-900 bg-white/80 p-0.5 rounded-md" />
                              </button>

                              {openRowColorPickerIdx === idx && (
                                <div className="absolute left-0 top-[32px] z-[150] bg-[#161618] border border-[#2d2d30] rounded-xl p-2.5 shadow-2xl w-44 flex flex-col gap-2">
                                  <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-left">Select Color</div>
                                  <div className="grid grid-cols-4 gap-1.5 justify-items-center">
                                    {[
                                      "#3b82f6", "#10b981", "#8b5cf6", "#ec4899",
                                      "#f59e0b", "#f43f5e", "#0ea5e9", "#eab308",
                                      "#f97316", "#6366f1", "#14b8a6", "#84cc16",
                                      "#22c55e", "#64748b", "#a1a1aa", "#ffffff"
                                    ].map((paletteColor) => (
                                      <button
                                        key={paletteColor}
                                        type="button"
                                        onClick={() => {
                                          const updatedColors = [...chartIndividualColors];
                                          while (updatedColors.length <= idx) {
                                            updatedColors.push("");
                                          }
                                          updatedColors[idx] = paletteColor;
                                          setChartIndividualColors(updatedColors);
                                          setOpenRowColorPickerIdx(null);
                                        }}
                                        className="w-5 h-5 rounded-md cursor-pointer border border-[#27272a] hover:scale-110 transition-transform block"
                                        style={{ backgroundColor: paletteColor }}
                                      />
                                    ))}
                                  </div>
                                  <div className="border-t border-[#27272a] pt-1.5 flex items-center justify-between gap-1">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase">Custom Pick</span>
                                    <input
                                      type="color"
                                      value={activeRowColor.startsWith("#") && activeRowColor.length === 7 ? activeRowColor : "#3b82f6"}
                                      onChange={(e) => {
                                        const updatedColors = [...chartIndividualColors];
                                        while (updatedColors.length <= idx) {
                                          updatedColors.push("");
                                        }
                                        updatedColors[idx] = e.target.value;
                                        setChartIndividualColors(updatedColors);
                                      }}
                                      className="w-7 h-5 bg-transparent border-none cursor-pointer outline-none rounded shrink-0 p-0"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedColors = [...chartIndividualColors];
                                      while (updatedColors.length <= idx) {
                                        updatedColors.push("");
                                      }
                                      updatedColors[idx] = "";
                                      setChartIndividualColors(updatedColors);
                                      setOpenRowColorPickerIdx(null);
                                    }}
                                    className="w-full text-center text-[9px] text-[#71717a] hover:text-white bg-zinc-805 hover:bg-zinc-800 py-1 rounded transition-colors"
                                  >
                                    Use Scheme Default
                                  </button>
                                </div>
                              )}
                            </div>

                            <span className="text-[10px] text-zinc-650 font-mono w-4 text-center">{idx + 1}</span>
                            <input
                              type="text"
                              value={lbl}
                              onChange={(e) => {
                                const updated = [...chartLabels];
                                updated[idx] = e.target.value;
                                setChartLabels(updated);
                              }}
                              className="flex-1 bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3 py-1.5 text-xs text-[#f4f4f5] outline-none transition-colors"
                              placeholder="Label"
                            />
                            <input
                              type="number"
                              value={chartValues[idx]}
                              onChange={(e) => {
                                const updated = [...chartValues];
                                const parsedVal = parseFloat(e.target.value);
                                updated[idx] = isNaN(parsedVal) ? 0 : parsedVal;
                                setChartValues(updated);
                              }}
                              className="w-20 bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3 py-1.5 text-xs text-right text-[#f4f4f5] outline-none font-mono transition-colors"
                              placeholder="Value"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (chartLabels.length > 2) {
                                  setChartLabels(chartLabels.filter((_, i) => i !== idx));
                                  setChartValues(chartValues.filter((_, i) => i !== idx));
                                  if (chartIndividualColors) {
                                    setChartIndividualColors(chartIndividualColors.filter((_, i) => i !== idx));
                                  }
                                }
                              }}
                              disabled={chartLabels.length <= 2}
                              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 cursor-pointer transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
                            >
                              <Icon icon="ph:trash" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right side: Preview */}
                <div className="flex flex-col h-full text-left">
                  <span className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Preview</span>
                  <div className="flex-1 bg-[#09090b] border border-[#27272a] rounded-2xl p-4 flex flex-col items-center justify-center min-h-[220px]">
                    {chartTitle && (
                      <div className="w-full text-center mb-3">
                        <span className="text-[11px] font-semibold text-zinc-450 uppercase tracking-wider font-sans">{chartTitle}</span>
                      </div>
                    )}
                    
                    {/* Render raw SVG dynamically based on inputs for preview */}
                    <div className="w-full max-w-[340px] md:max-w-full">
                      {(() => {
                        const vals = chartValues.map(v => isNaN(v) ? 0 : v);
                        const maxVal = Math.max(...vals, 1);
                        const width = 450;
                        const height = 240;

                        const schemeColors: Record<string, string[]> = {
                          multicolor: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#f97316", "#6366f1"],
                          emerald: ["#10b981", "#34d399", "#059669", "#a7f3d0", "#047857", "#065f46"],
                          blue: ["#3b82f6", "#60a5fa", "#2563eb", "#bfdbfe", "#1d4ed8", "#1e40af"],
                          purple: ["#8b5cf6", "#a78bfa", "#7c3aed", "#ddd6fe", "#6d28d9", "#5b21b6"],
                          amber: ["#f59e0b", "#fbbf24", "#d97706", "#fde68a", "#b45309", "#92400e"],
                          rose: ["#f43f5e", "#fb7185", "#e11d48", "#fecdd3", "#be123c", "#9f1239"],
                          cyan: ["#06b6d4", "#22d3ee", "#0891b2", "#cffafe", "#0e7490", "#155e75"],
                          orange: ["#f97316", "#fb923c", "#ea580c", "#ffedd5", "#c2410c", "#9a3412"],
                          pink: ["#ec4899", "#f472b6", "#db2777", "#fce7f3", "#be185d", "#9d174d"],
                          indigo: ["#6366f1", "#818cf8", "#4f46e5", "#e0e7ff", "#4338ca", "#3730a3"],
                          slate: ["#64748b", "#94a3b8", "#475569", "#f1f5f9", "#334155", "#1e293b"],
                          forest: ["#22c55e", "#4ade80", "#16a34a", "#dcfce7", "#15803d", "#14532d"]
                        };
                        const colors = schemeColors[chartDataColor] || schemeColors.blue;

                        if (chartType === "bar") {
                          const paddingLeft = 35;
                          const paddingRight = 10;
                          const paddingTop = 25;
                          const paddingBottom = 30;
                          const graphWidth = width - paddingLeft - paddingRight;
                          const graphHeight = height - paddingTop - paddingBottom;

                          return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                              {/* Grid lines */}
                              {[0, 1, 2, 3, 4].map((i) => {
                                const y = paddingTop + (graphHeight * i) / 4;
                                const gridVal = Math.round(maxVal - (maxVal * i) / 4);
                                return (
                                  <React.Fragment key={i}>
                                    <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#27272a" strokeDasharray="3,3" />
                                    <text x={paddingLeft - 6} y={y + 3} fill="#71717a" fontSize="9" textAnchor="end">{gridVal}</text>
                                  </React.Fragment>
                                );
                              })}

                              {/* Bars */}
                              {chartLabels.map((lbl, idx) => {
                                const val = vals[idx] || 0;
                                const barHeight = (val / maxVal) * graphHeight;
                                const x = paddingLeft + 15 + idx * ((graphWidth - 20) / chartLabels.length);
                                const y = paddingTop + graphHeight - barHeight;
                                const barWidth = Math.max(12, ((graphWidth - 20) / chartLabels.length) * 0.6);
                                const fill = (chartIndividualColors && chartIndividualColors[idx]) || (chartDataColor === "multicolor" ? colors[idx % colors.length] : colors[0]);

                                return (
                                  <g key={idx}>
                                    <rect x={x} y={y} width={barWidth} height={Math.max(2, barHeight)} rx="3" fill={fill} />
                                    <text x={x + barWidth / 2} y={y - 4} fill="#f4f4f5" fontSize="8" fontWeight="600" textAnchor="middle">{val}</text>
                                    <text x={x + barWidth / 2} y={paddingTop + graphHeight + 12} fill="#a1a1aa" fontSize="8" textAnchor="middle">{lbl}</text>
                                  </g>
                                );
                              })}
                            </svg>
                          );
                        } else if (chartType === "line") {
                          const paddingLeft = 35;
                          const paddingRight = 10;
                          const paddingTop = 25;
                          const paddingBottom = 30;
                          const graphWidth = width - paddingLeft - paddingRight;
                          const graphHeight = height - paddingTop - paddingBottom;
                          const stepX = chartLabels.length > 1 ? graphWidth / (chartLabels.length - 1) : graphWidth;

                          const pts = vals.map((val, idx) => {
                            const x = paddingLeft + idx * stepX;
                            const y = paddingTop + graphHeight - (val / maxVal) * graphHeight;
                            return { x, y, val, lbl: chartLabels[idx] };
                          });

                          let pathD = pts.length > 0 ? `M ${pts[0].x} ${pts[0].y}` : "";
                          let areaD = pts.length > 0 ? `M ${paddingLeft} ${paddingTop + graphHeight} L ${pts[0].x} ${pts[0].y}` : "";
                          for (let i = 1; i < pts.length; i++) {
                            pathD += ` L ${pts[i].x} ${pts[i].y}`;
                            areaD += ` L ${pts[i].x} ${pts[i].y}`;
                          }
                          if (pts.length > 0) {
                            areaD += ` L ${pts[pts.length - 1].x} ${paddingTop + graphHeight} Z`;
                          }

                          const stroke = colors[0];
                          const fillOpacity = chartDataColor === "multicolor" ? colors[1] || stroke : stroke;

                          return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                              {/* Grid lines */}
                              {[0, 1, 2, 3, 4].map((i) => {
                                const y = paddingTop + (graphHeight * i) / 4;
                                const gridVal = Math.round(maxVal - (maxVal * i) / 4);
                                return (
                                  <React.Fragment key={i}>
                                    <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#27272a" strokeDasharray="3,3" />
                                    <text x={paddingLeft - 6} y={y + 3} fill="#71717a" fontSize="9" textAnchor="end">{gridVal}</text>
                                  </React.Fragment>
                                );
                              })}

                              {/* Fill area */}
                              {pts.length > 0 && (
                                <path d={areaD} fill={fillOpacity} fillOpacity="0.12" />
                              )}
                              
                              {/* Line */}
                              {pts.length > 0 && (
                                <path d={pathD} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              )}

                              {/* Dots */}
                              {pts.map((pt, idx) => {
                                const ptColor = (chartIndividualColors && chartIndividualColors[idx]) || stroke;
                                return (
                                  <g key={idx}>
                                    <circle cx={pt.x} cy={pt.y} r={3.5} fill={ptColor} stroke="#121212" strokeWidth="1" />
                                    <text x={pt.x} y={pt.y - 6} fill="#f4f4f5" fontSize="8" fontWeight="600" textAnchor="middle">{pt.val}</text>
                                    <text x={pt.x} y={paddingTop + graphHeight + 12} fill="#a1a1aa" fontSize="8" textAnchor="middle">{pt.lbl}</text>
                                  </g>
                                );
                              })}
                            </svg>
                          );
                        } else {
                          // Pie/Doughnut Chart
                          const cx = 130;
                          const cy = 110;
                          const r = 70;
                          const cut = 40;
                          const totalVal = vals.reduce((a, b) => a + b, 0) || 1;
                          let cumulativeAngle = 0;

                          return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                              {chartLabels.map((lbl, idx) => {
                                const val = vals[idx] || 0;
                                const pct = val / totalVal;
                                const angle = pct * 360;

                                const rad1 = (cumulativeAngle - 90) * (Math.PI / 180);
                                const rad2 = (cumulativeAngle + angle - 90) * (Math.PI / 180);

                                const x1_out = cx + r * Math.cos(rad1);
                                const y1_out = cy + r * Math.sin(rad1);
                                const x2_out = cx + r * Math.cos(rad2);
                                const y2_out = cy + r * Math.sin(rad2);

                                const x1_in = cx + cut * Math.cos(rad1);
                                const y1_in = cy + cut * Math.sin(rad1);
                                const x2_in = cx + cut * Math.cos(rad2);
                                const y2_in = cy + cut * Math.sin(rad2);

                                const largeArc = angle > 180 ? 1 : 0;
                                const fill = (chartIndividualColors && chartIndividualColors[idx]) || colors[idx % colors.length];

                                let pathStr = "";
                                if (pct >= 0.999) {
                                  pathStr = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
                                } else {
                                  pathStr = `M ${x1_in} ${y1_in} L ${x1_out} ${y1_out} A ${r} ${r} 0 ${largeArc} 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${cut} ${cut} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z`;
                                }

                                const gElement = (
                                  <g key={idx}>
                                    {pct >= 0.999 ? (
                                      <>
                                        <circle cx={cx} cy={cy} r={r} fill="none" stroke={fill} strokeWidth={r - cut} />
                                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="transparent" strokeWidth="1.5" />
                                        <circle cx={cx} cy={cy} r={cut} fill="none" stroke="transparent" strokeWidth="1.5" />
                                      </>
                                    ) : (
                                      <path d={pathStr} fill={fill} stroke="transparent" strokeWidth="1.5" />
                                    )}
                                  </g>
                                );

                                cumulativeAngle += angle;
                                return gElement;
                              })}
                              {/* Center details */}
                              <circle cx={cx} cy={cy} r={cut - 2} fill="transparent" />
                              <text x={cx} y={cy - 2} fill="#71717a" fontSize="8" textAnchor="middle" fontWeight="600">TOTAL</text>
                              <text x={cx} y={cy + 9} fill="#f4f4f5" fontSize="11" textAnchor="middle" fontWeight="700">
                                {vals.reduce((a, b) => a + b, 0)}
                              </text>

                              {/* Legends */}
                              <g transform="translate(240, 25)">
                                {chartLabels.map((lbl, idx) => {
                                  const val = vals[idx] || 0;
                                  const pct = val / totalVal;
                                  const fill = (chartIndividualColors && chartIndividualColors[idx]) || colors[idx % colors.length];
                                  return (
                                    <g key={idx} transform={`translate(0, ${idx * 16})`}>
                                      <rect width="8" height="8" rx="2" fill={fill} />
                                      <text x="14" y="8" fill="#f4f4f5" fontSize="9" fontWeight="500">{lbl}</text>
                                      <text x="180" y="8" fill="#71717a" fontSize="9" textAnchor="end">{val} ({Math.round(pct * 100)}%)</text>
                                    </g>
                                  );
                                })}
                              </g>
                            </svg>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-[#2d2d30]">
                <button
                  onClick={closeChartModal}
                  className="px-4 py-2 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInsertChart}
                  className="px-5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  {chartBeingEdited ? "Update Chart" : "Insert Chart"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/75 z-[110] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#27272a] rounded-2xl w-full max-w-lg p-6 relative text-zinc-300"
            >
              <button
                onClick={() => {
                  if (!isAnalyzingLink) {
                    setImportModalOpen(false);
                  }
                }}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer disabled:opacity-50"
                disabled={isAnalyzingLink}
              >
                <Icon icon="ph:x" className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-1.5">
                {importType === "youtube" ? (
                  <img
                    src="https://www.gstatic.com/images/branding/product/1x/youtube_64dp.png"
                    alt="YouTube"
                    className="w-5 h-5 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : importType === "gdoc" ? (
                  <img
                    src="https://www.gstatic.com/images/branding/product/1x/docs_2020q4_48dp.png"
                    alt="Google Docs"
                    className="w-5 h-5 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Icon
                    icon="ph:link"
                    className="w-5 h-5 text-zinc-400"
                  />
                )}
                <h3 className="text-[#f4f4f5] text-lg font-medium">
                  {importType === "youtube"
                    ? "Import & Summarize YouTube Video"
                    : importType === "gdoc"
                      ? "Import & Summarize Google Doc"
                      : "Import & Summarize Public URL"}
                </h3>
              </div>
              <p className="text-[#71717a] text-xs mb-5">
                {importType === "youtube"
                  ? "Input any public video link. We will resolve its title, channel name, and use the Gemini Success Mentor model to produce an academic summary."
                  : importType === "gdoc"
                    ? 'Paste a public Google Doc link. Ensure link sharing is enabled as "Anyone with the link can view". We will download and structure the text content.'
                    : "Paste any webpage, paper link, or blog article. We will crawl the clean document text and synthesize it into a library literature note."}
              </p>

              <form
                onSubmit={handleLinkImportSubmit}
                className="space-y-4 text-xs font-sans"
              >
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                    {importType === "youtube"
                      ? "YouTube Video Link"
                      : importType === "gdoc"
                        ? "Google Doc URL"
                        : "Public URL"}
                  </label>
                  <input
                    type="url"
                    required
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    disabled={isAnalyzingLink}
                    placeholder={
                      importType === "youtube"
                        ? "https://www.youtube.com/watch?v=F3GCo2Y-A9o"
                        : importType === "gdoc"
                          ? "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvGdBAnlgY5iK1mJH/edit"
                          : "https://en.wikipedia.org/wiki/Neuroplasticity"
                    }
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2.5 text-zinc-200 text-xs focus:border-zinc-500 focus:outline-none placeholder:text-zinc-600 transition-colors disabled:opacity-50"
                  />
                </div>

                {linkAnalyzeError && (
                  <div className="flex gap-2.5 items-start p-3.5 bg-red-950/20 border border-red-900/40 rounded-xl">
                    <Icon
                      icon="ph:warning-circle"
                      className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                    />
                    <span className="text-red-400 text-xs leading-relaxed font-medium">
                      {linkAnalyzeError}
                    </span>
                  </div>
                )}

                {isAnalyzingLink && (
                  <div className="flex flex-col gap-2.5 items-center justify-center p-6 bg-[#18181b] border border-[#27272a] rounded-xl text-center">
                    <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                    <div className="text-zinc-300 font-medium text-xs">
                      Analyzing and Synthesizing Link Source...
                    </div>
                    <div className="text-[10px] font-mono text-[#71717a] max-w-sm leading-relaxed">
                      {linkAnalyzeStatus}
                    </div>
                  </div>
                )}

                {!isAnalyzingLink && (
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setImportModalOpen(false)}
                      className="flex-1 py-2.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-zinc-200 hover:bg-white text-zinc-950 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
                    >
                      Import & Summarize
                    </button>
                  </div>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}

        {activeViewingPaper && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/75 z-[105] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#27272a] rounded-2xl w-full max-w-2xl p-6 relative text-zinc-300"
            >
              <button
                onClick={() => setActiveViewingPaper(null)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <Icon icon="ph:x" className="w-5 h-5" />
              </button>

              <h3 className="text-[#f4f4f5] text-xl font-medium leading-snug mb-1">
                {activeViewingPaper.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#71717a] border-b border-[#27272a] pb-4 mb-4">
                {activeViewingPaper.author && (
                  <div className="flex items-center gap-1">
                    <Icon
                      icon="ph:user"
                      className="w-3.5 h-3.5 text-zinc-500"
                    />
                    <span>{activeViewingPaper.author}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Icon
                    icon="ph:calendar"
                    className="w-3.5 h-3.5 text-zinc-500"
                  />
                  <span>
                    Added: {activeViewingPaper.added || "Today"}
                  </span>
                </div>
                {activeViewingPaper.url && (
                  <a
                    href={activeViewingPaper.url}
                    target="_blank"
                    rel="noreferrer"
                    referrerPolicy="no-referrer"
                    className="flex items-center gap-1 text-[#0070f3] hover:underline"
                  >
                    <Icon icon="ph:link" className="w-3.5 h-3.5" />
                    <span className="truncate max-w-xs">
                      {activeViewingPaper.url}
                    </span>
                  </a>
                )}
              </div>

              <div className="space-y-4 text-sm leading-relaxed max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                {activeViewingPaper.summary ? (
                  <div className="markdown-body prose prose-invert max-w-none text-sm text-[#d4d4d8] font-sans">
                    <ReactMarkdown>
                      {formatAbstractText(
                        activeViewingPaper.summary,
                      ).replace(/\\n/g, "\n")}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[#d4d4d8] font-sans whitespace-pre-wrap">
                    {activeViewingPaper.description
                      ? formatAbstractText(
                          activeViewingPaper.description,
                        ).replace(/\\n/g, "\n")
                      : ""}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center gap-4 mt-6 pt-4 border-t border-[#27272a]">
                <button
                  onClick={() => {
                    const summaryText =
                      activeViewingPaper.summary ||
                      activeViewingPaper.description;
                    navigator.clipboard.writeText(summaryText);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-[#27272a] hover:bg-[#1a1a1a] rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Icon icon="ph:copy" className="w-3.5 h-3.5" />
                  <span>Copy Summary</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveViewingPaper(null)}
                    className="px-5 py-2.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        <AnimatePresence>
          {isDeleteConfirmOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm px-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#121212] border border-[#2d2d30] rounded-2xl w-full max-w-sm p-6 relative text-zinc-300 shadow-2xl"
              >
                <div className="mb-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
                    <Icon icon="ph:warning-circle-bold" className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#f4f4f5] mb-2">Close Tab?</h3>
                  <p className="text-[13px] text-zinc-500 leading-relaxed font-jakarta">
                    Are you sure you want to close this tab? Any unsaved changes might be lost.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsDeleteConfirmOpen(false);
                      setTabIdToDelete(null);
                    }}
                    className="flex-1 py-2.5 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white text-[13px] font-bold rounded-xl cursor-pointer transition-colors border border-[#2d2d30]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (tabIdToDelete) {
                        deleteTab(tabIdToDelete);
                      }
                      setIsDeleteConfirmOpen(false);
                      setTabIdToDelete(null);
                    }}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-[13px] font-bold rounded-xl cursor-pointer transition-colors"
                  >
                    Close Tab
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {addModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 z-[105] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#27272a] rounded-2xl w-full max-w-lg p-6 relative"
            >
              <button
                onClick={() => setAddModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <Icon icon="ph:x" className="w-5 h-5" />
              </button>

              <h3 className="text-[#f4f4f5] text-lg font-medium mb-1">
                Add Library Entry
              </h3>
              <p className="text-[#71717a] text-xs mb-5">
                Manually record a dissertation reference summary or raw
                project findings
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newPaperTitle.trim()) return;

                  const newlyCreated: PaperItem = {
                    title: newPaperTitle,
                    author: newPaperAuthors.trim() || "",
                    fileType: newPaperType,
                    description:
                      newPaperDescription.trim() ||
                      "Manually inserted student draft documentation.",
                    added: "Today",
                    fullTextStatus: "Available",
                    viewed: "Just now",
                    summary: "",
                  };

                  dbSetPaper(newlyCreated);

                  // Create and switch to a new document tab with the content
                  const newTabId = `manual-${Date.now()}`;
                  setTabs((prev) => [
                    ...prev,
                    {
                      id: newTabId,
                      type: "document",
                      title: newPaperTitle,
                      content: `<p>${newlyCreated.description}</p>`,
                    },
                  ]);
                  setActiveTabId(newTabId);

                  setAddModalOpen(false);
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                    File type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPaperType("Document")}
                      className={`flex-1 py-2 text-center rounded-xl border font-medium cursor-pointer ${newPaperType === "Document" ? "bg-[#27272a] border-[#52525b] text-white" : "bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200"}`}
                    >
                      Document
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPaperType("Note")}
                      className={`flex-1 py-2 text-center rounded-xl border font-medium cursor-pointer ${newPaperType === "Note" ? "bg-[#27272a] border-[#52525b] text-white" : "bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200"}`}
                    >
                      Note
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newPaperTitle}
                    onChange={(e) => setNewPaperTitle(e.target.value)}
                    placeholder="e.g. Cognitive Rehabilitation Post Stroke"
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                    Authors (optional)
                  </label>
                  <input
                    type="text"
                    value={newPaperAuthors}
                    onChange={(e) => setNewPaperAuthors(e.target.value)}
                    placeholder="e.g. Graybiel, et al."
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                    Abstract / Description (optional)
                  </label>
                  <textarea
                    rows={2.5}
                    value={newPaperDescription}
                    onChange={(e) =>
                      setNewPaperDescription(e.target.value)
                    }
                    placeholder="Provide details about findings, hypotheses or methodology parameters..."
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-zinc-200 hover:bg-white text-zinc-950 font-semibold rounded-xl transition-colors cursor-pointer mt-2"
                >
                  Confirm and Add to Grid Structure
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showBuyCoffeeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#2d2d30] rounded-2xl w-full max-w-[420px] p-6 relative flex flex-col overflow-hidden select-none"
            >
              <button
                onClick={() => {
                  setShowBuyCoffeeModal(false);
                  setSupportAmountPaid(null);
                }}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer p-1 rounded-md hover:bg-[#1a1a1c] transition-colors"
                title="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>

              {supportAmountPaid ? (
                <div className="flex flex-col items-center text-center space-y-4 py-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                    <Coffee className="w-7 h-7" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-100 font-jakarta">
                      Support Succeeded!
                    </h3>
                    <span className="text-[10px] uppercase tracking-wider font-mono text-emerald-500 font-bold">
                      Official Workspace Patron
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed px-1">
                    Thank you deep down for your virtual donation of{" "}
                    <span className="text-emerald-400 font-bold">
                      {supportAmountPaid}
                    </span>
                    ! This supports daily Gemini token requests, web
                    parser microservices, and general app development.
                  </p>

                  <button
                    onClick={() => {
                      setShowBuyCoffeeModal(false);
                      setSupportAmountPaid(null);
                    }}
                    className="w-full py-2 bg-zinc-200 hover:bg-white text-zinc-950 rounded-xl font-bold text-xs transition-colors cursor-pointer mt-2"
                  >
                    Conclude & Return
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center space-y-4 pt-1">
                  {/* Coffee cup box */}
                  <div className="w-14 h-14 rounded-2xl bg-[#221714] border border-[#44312a] flex items-center justify-center text-[#e3a088]">
                    <Coffee className="w-7 h-7" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-zinc-100 font-jakarta">
                      Support AI Research Workspace
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                      Keep the model intelligence active ☕
                    </p>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed px-1">
                    If our draft optimizer, citation indexers, automatic
                    web synthesis, or new interactive study panels have
                    saved you time, consider buying us a coffee!
                  </p>

                  {/* Coffee visual selectors */}
                  <div className="w-full flex gap-2.5 pt-2">
                    {[
                      {
                        count: 1,
                        label: "1 Coffee",
                        price: "$5",
                        desc: "Warm Thanks!",
                      },
                      {
                        count: 3,
                        label: "3 Coffees",
                        price: "$15",
                        desc: "Keep it up!",
                      },
                      {
                        count: 5,
                        label: "5 Coffees",
                        price: "$25",
                        desc: "Pro sponsor!",
                      },
                    ].map((item) => (
                      <button
                        key={item.count}
                        onClick={() => setSupportAmountPaid(item.price)}
                        className="flex-1 bg-[#161618] border border-[#242426] hover:border-zinc-500 p-3 rounded-xl transition-all cursor-pointer flex flex-col items-center gap-1 group"
                      >
                        <span className="text-xs font-bold text-zinc-300 group-hover:text-white">
                          {item.label}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {item.price}
                        </span>
                        <span className="text-[9.5px] text-zinc-600 font-semibold">
                          {item.desc}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Direct exterior Support links */}
                  <div className="w-full space-y-2 pt-2">
                    <a
                      href="https://buymeacoffee.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-xl bg-zinc-200 hover:bg-white text-[#121212] font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Coffee className="w-3.5 h-3.5" />
                      <span>Support on BuyMeACoffee.com</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>

                    <button
                      onClick={() => {
                        setShowBuyCoffeeModal(false);
                      }}
                      className="w-full py-2 text-[10.5px] text-zinc-500 hover:text-zinc-300 font-medium transition-colors cursor-pointer"
                    >
                      Maybe next time, thanks!
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ToastContainer />
    </div>
  );
}
