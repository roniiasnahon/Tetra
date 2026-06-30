import React from 'react';
import { pdfjs } from 'react-pdf';

export const linkifyHtml = (html: string): string => {
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

export const renderLinkifiedText = (text: string) => {
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

export const parseAssistantResponse = (text: string) => {
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

export const extractTextFromPdf = async (url: string): Promise<string> => {
  try {
    let pdfUrlToLoad = url;

    // Resolve via memory/browser Cache API first for instant performance and offline/local fallback
    const fileIdMatch = url.match(/\/api\/files\/([^\/]+)/);
    if (fileIdMatch) {
      const fileId = fileIdMatch[1];
      try {
        pdfUrlToLoad = await getOrCreateCachedPdf(fileId);
      } catch (cacheErr) {
        console.warn("Failed to retrieve PDF from cache, will try direct fetch:", cacheErr);
      }
    }

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
    const pageTexts: { [pageNum: number]: string } = {};
    const pagesNeedingOcr: number[] = [];

    for (let pageNum = 1; pageNum <= numPagesToParse; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || "")
          .join(" ")
          .trim();
        
        pageTexts[pageNum] = pageText;
        // If a page has virtually no selectable text, it's likely a scan or an image-based PDF
        if (pageText.length < 60) {
          pagesNeedingOcr.push(pageNum);
        }
      } catch (e) {
        console.error(`Failed getting text for page ${pageNum}:`, e);
      }
    }

    if (pagesNeedingOcr.length > 0) {
      console.log(`[OCR] Scanned PDF or images detected. Pages needing OCR: ${pagesNeedingOcr.join(", ")}`);
      for (const pageNum of pagesNeedingOcr) {
        try {
          const page = await pdfDoc.getPage(pageNum);
          // Render page to canvas at 1.5x scale for high OCR accuracy
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Wait for pdf.js to render the page onto our off-screen canvas
            await page.render({
              canvasContext: context,
              viewport: viewport,
              canvas: canvas,
            }).promise;

            const base64Data = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
            
            // Send base64 to server OCR endpoint
            const ocrRes = await fetch("/api/ocr-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ base64: base64Data, mimeType: "image/jpeg" })
            });
            if (ocrRes.ok) {
              const ocrData = await ocrRes.json();
              if (ocrData.success && ocrData.text) {
                // Prepend indicator that this was parsed using high-precision OCR
                pageTexts[pageNum] = `[OCR Transcribed Page]\n` + ocrData.text;
              }
            }
          }
        } catch (ocrErr) {
          console.error(`Failed OCR for page ${pageNum}:`, ocrErr);
        }
      }
    }

    for (let pageNum = 1; pageNum <= numPagesToParse; pageNum++) {
      const text = pageTexts[pageNum] || "";
      fullText += `--- Page ${pageNum} of ${pdfDoc.numPages} ---\n${text}\n\n`;
    }
    return fullText;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    return "";
  }
};

export const cleanJsonLeakFront = (text: string): string => {
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

export const PDF_CACHE_NAME = "rapid-pdf-cache-v1";

export const preCachePdfFile = async (fileId: string, blob: Blob) => {
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

export const getOrCreateCachedPdf = async (fileId: string): Promise<string> => {
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
        const blob = await response.blob();
        
        // Robust Header Validation: Ensure it's a valid PDF before caching
        const buffer = await blob.slice(0, 1024).arrayBuffer();
        const header = new TextDecoder().decode(new Uint8Array(buffer));
        if (!header.includes("%PDF-")) {
          console.error(`Invalid PDF detected at ${fileUrl}. Header: ${header.substring(0, 40)}`);
          if (header.includes("<head") || header.includes("<title") || header.includes("<!DOCTYPE")) {
            if (header.toLowerCase().includes("radware") || header.toLowerCase().includes("captcha")) {
              throw new Error("Access Blocked: The source website is protected by bot protection (Radware). Try downloading the PDF manually and uploading it here.");
            }
            throw new Error("Invalid PDF: The server returned a web page instead of a document. This can happen if the link is a landing page or requires a login.");
          }
          throw new Error("Invalid PDF structure: The file does not start with the expected PDF header (%PDF-).");
        }

        // Save a clone to Cache Storage for next time
        const reconstructedResponse = new Response(blob, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
        await cache.put(fileUrl, reconstructedResponse);

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


export const formatAbstractText = (text: string) => {
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
