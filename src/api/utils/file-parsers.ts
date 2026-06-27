import zlib from "zlib";
import axios from "axios";

export function decompressResponse(buffer: Buffer, contentEncoding?: string): Buffer {
  if (!buffer || buffer.length === 0) return buffer;
  const encoding = (contentEncoding || "").toLowerCase().trim();

  if (encoding === "gzip") {
    try { return zlib.gunzipSync(buffer); } catch (e: any) {}
  } else if (encoding === "deflate") {
    try { return zlib.inflateSync(buffer); } catch (e: any) {}
  } else if (encoding === "br") {
    try { return zlib.brotliDecompressSync(buffer); } catch (e: any) {}
  }

  // Fallback signature checks
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
    try { return zlib.gunzipSync(buffer); } catch (e: any) {}
  }
  if (buffer[0] === 0x78 && (buffer[1] === 0x01 || buffer[1] === 0x9c || buffer[1] === 0xda)) {
    try { return zlib.inflateSync(buffer); } catch (e: any) {}
  }

  return buffer;
}

export function tryDecompressFallback(buffer: Buffer): Buffer {
  if (!buffer || buffer.length < 4) return buffer;
  if (buffer.length >= 4 && buffer.toString("utf-8", 0, 4) === "%PDF") return buffer;

  try {
    const brotliOut = zlib.brotliDecompressSync(buffer);
    if (brotliOut.length >= 4 && brotliOut.toString("utf-8", 0, 4) === "%PDF") return brotliOut;
  } catch (e) {}

  try {
    const gzipOut = zlib.gunzipSync(buffer);
    if (gzipOut.length >= 4 && gzipOut.toString("utf-8", 0, 4) === "%PDF") return gzipOut;
  } catch (e) {}

  try {
    const deflateOut = zlib.inflateSync(buffer);
    if (deflateOut.length >= 4 && deflateOut.toString("utf-8", 0, 4) === "%PDF") return deflateOut;
  } catch (e) {}

  return buffer;
}

export function extractAllContentStrings(
  obj: any,
  excludedKeys: string[] = ["title", "author", "fileType", "added", "fullTextStatus", "id"]
): string[] {
  let results: string[] = [];
  if (obj === null || obj === undefined) return results;

  if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (trimmed && trimmed !== "..." && !trimmed.toLowerCase().startsWith("note") && !trimmed.toLowerCase().startsWith("document")) {
      results.push(trimmed);
    }
    return results;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) results.push(...extractAllContentStrings(item, excludedKeys));
    return results;
  }

  if (typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      if (excludedKeys.includes(key)) continue;
      results.push(...extractAllContentStrings(obj[key], excludedKeys));
    }
  }

  return results;
}

export function cleanJsonLeak(text: string): string {
  if (!text) return "";
  let clean = text.trim();

  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

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

  return clean.trim();
}

export function cleanAndParseJSON(responseText: string): any {
  let cleaned = (responseText || "").trim();
  if (!cleaned) return {};

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const jsonMatch = cleaned?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const candidate = jsonMatch[0];
      try {
        return JSON.parse(candidate);
      } catch (e) {
        let repaired = candidate.trim();
        if (!repaired.endsWith("}")) {
          if (repaired.includes('"') && repaired.split('"').length % 2 === 0) repaired += '"';
          repaired += "}";
          try { return JSON.parse(repaired); } catch (e2) {}
        }
      }
    }

    try {
      const sanitized = cleaned.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "");
      return JSON.parse(sanitized);
    } catch (err2) {
      const obj: any = {};
      const titleMatch = cleaned?.match(/"title"\s*:\s*"([^"]+)"/i);
      const authorMatch = cleaned?.match(/"author"\s*:\s*"([^"]+)"/i);
      const summaryMatch = cleaned?.match(/"summary"\s*:\s*"([\s\S]+?)"\s*(?:,|\})/i);
      const fileTypeMatch = cleaned?.match(/"fileType"\s*:\s*"([^"]+)"/i);

      if (titleMatch) obj.title = titleMatch[1];
      if (authorMatch) obj.author = authorMatch[1];
      if (summaryMatch) obj.summary = summaryMatch[1];
      else obj.summary = cleanJsonLeak(responseText);
      if (fileTypeMatch) obj.fileType = fileTypeMatch[1];

      if (obj.title || obj.summary) return obj;
      throw err;
    }
  }
}

export function sniffMimeType(buffer: Buffer): { mimetype: string; extension: string; } {
  if (buffer.length >= 4 && buffer.toString("utf-8", 0, 4) === "%PDF") {
    return { mimetype: "application/pdf", extension: "pdf" };
  }

  const sample = buffer.toString("utf-8", 0, Math.min(buffer.length, 1024)).trim().toLowerCase();
  if (sample.startsWith("<") || sample.includes("<html") || sample.includes("<!doctype") || sample.includes("<head") || sample.includes("<body") || sample.includes("<title")) {
    return { mimetype: "text/html", extension: "html" };
  }

  if (sample.startsWith("{") || sample.startsWith("[")) {
    try { JSON.parse(sample); return { mimetype: "application/json", extension: "json" }; } catch (_) {
      if (sample.includes('"') && sample.includes(":")) return { mimetype: "application/json", extension: "json" };
    }
  }

  if (sample.startsWith("<?xml") || sample.includes("<xml") || sample.includes("<rss") || sample.includes("<feed")) {
    return { mimetype: "application/xml", extension: "xml" };
  }

  let isText = true;
  const checkLen = Math.min(buffer.length, 512);
  for (let i = 0; i < checkLen; i++) {
    const charCode = buffer[i];
    if (charCode === 0 || (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13)) {
      isText = false; break;
    }
  }

  if (isText && buffer.length > 0) return { mimetype: "text/plain", extension: "txt" };
  return { mimetype: "application/octet-stream", extension: "bin" };
}

export function extractTextFromHtml(html: string): string {
  let text = html;
  text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text.substring(0, 15000);
}

export async function extractDirectPdfFromLandingPage(landingPageUrl: string, htmlContent: string): Promise<Buffer | null> {
  try {
    const matches = htmlContent?.match(/href=["']([^"']+)["']/gi) || [];
    const candidateUrls: string[] = [];

    for (const match of matches) {
      const parts = match?.match(/href=["']([^"']+)["']/i);
      if (parts && parts[1]) {
        const link = parts[1];
        const lowerLink = link.toLowerCase();

        if (lowerLink.includes("bitstream") || lowerLink.includes("bitstreams") || lowerLink.includes("/download") || lowerLink.includes("/retrieve/") || lowerLink.includes("/datastream/") || lowerLink.includes("/stream/") || lowerLink.includes("/files/") || lowerLink.endsWith(".pdf") || lowerLink.includes(".pdf?") || lowerLink.includes("paper-pdf") || lowerLink.includes("article-pdf")) {
          let resolved = link;
          if (link.startsWith("//")) {
            resolved = `https:${link}`;
          } else if (link.startsWith("/")) {
            try {
              const u = new URL(landingPageUrl);
              resolved = `${u.protocol}//${u.host}${link}`;
            } catch (_) {}
          } else if (!link.startsWith("http")) {
            try {
              const u = new URL(landingPageUrl);
              const pathBase = u.origin + u.pathname.substring(0, u.pathname.lastIndexOf("/") + 1);
              resolved = `${pathBase}${link}`;
            } catch (_) {}
          }
          if (!candidateUrls.includes(resolved)) candidateUrls.push(resolved);
        }
      }
    }

    for (const link of candidateUrls) {
      if (link === landingPageUrl) continue;
      try {
        const res = await axios.get(link, {
          responseType: "arraybuffer",
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "application/pdf,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            Referer: landingPageUrl,
          },
        });
        const buf = Buffer.from(res.data);
        if (buf.length >= 4 && buf.toString("utf-8", 0, 4) === "%PDF") return buf;
      } catch (err: any) {}
    }
  } catch (err: any) {}
  return null;
}

export async function robustDownloadPdf(url: string): Promise<Buffer> {
  const headers: any = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/pdf,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://www.google.com/",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
  };

  try {
    const domain = new URL(url).hostname;
    if (domain.includes("ajpmonline.org") || domain.includes("sciencedirect.com") || domain.includes("elsevier.com") || domain.includes("pubs.aip.org")) {
      headers["Referer"] = `https://${domain}/`;
      headers["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }
  } catch (e) {}

  const response = await axios.get(url, { responseType: "arraybuffer", headers: headers, timeout: 15000 });
  const contentEncodingRaw = response.headers ? response.headers["content-encoding"] || response.headers["Content-Encoding"] || "" : "";
  const contentEncoding = Array.isArray(contentEncodingRaw) ? contentEncodingRaw[0] : String(contentEncodingRaw);

  let decompressed = decompressResponse(Buffer.from(response.data), contentEncoding);
  decompressed = tryDecompressFallback(decompressed);

  const magic = decompressed.toString("utf-8", 0, 5);
  const isHtml = magic.trim().startsWith("<") || magic.trim().toLowerCase().startsWith("!doc") || magic.toLowerCase().includes("<html");

  if (isHtml) {
    const crawledPdf = await extractDirectPdfFromLandingPage(url, decompressed.toString("utf-8"));
    if (crawledPdf) return crawledPdf;
  }
  return decompressed;
}

export async function attemptBypassDownload(url: string): Promise<Buffer> {
  try {
    const buffer = await robustDownloadPdf(url);
    const sniffed = sniffMimeType(buffer);

    if (sniffed.mimetype === "application/pdf") return buffer;

    if (sniffed.mimetype === "text/html") {
      const titleMatch = buffer.toString("utf-8").match(/<title>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1] : "Unknown HTML Page";
      if (pageTitle.toLowerCase().includes("radware") || pageTitle.toLowerCase().includes("captcha") || pageTitle.toLowerCase().includes("blocked")) {
        throw new Error(`Access blocked by security filter (Radware/Captcha) at the source: ${pageTitle}`);
      }
      throw new Error(`Downloaded content is a web page ("${pageTitle}"), not a PDF. The source might be behind a login or proxy.`);
    }

    if (buffer.length > 100) return buffer;
    throw new Error("Downloaded file is empty or not a valid format");
  } catch (firstErr: any) {
    try {
      const lookupsUrls = [`https://api.openalex.org/works?filter=locations.landing_page_url:${encodeURIComponent(url)}&mailto=asnahonron@gmail.com`];
      const doiMatch = url?.match(/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i);
      if (doiMatch) {
        let doi = doiMatch[1];
        if (doi.endsWith(")")) doi = doi.substring(0, doi.length - 1);
        lookupsUrls.unshift(`https://api.openalex.org/works/https://doi.org/${doi}?mailto=asnahonron@gmail.com`);
      }

      for (const queryOaUrl of lookupsUrls) {
        try {
          const oaRes = await axios.get(queryOaUrl, { timeout: 10000 });
          const workData = oaRes.data;
          let entry = null;
          if (workData && workData.results && workData.results.length > 0) entry = workData.results[0];
          else if (workData && workData.id) entry = workData;

          if (entry) {
            const locations = entry.locations || [];
            for (const loc of locations) {
              const fallbackUrl = loc.pdf_url || loc.landing_page_url;
              if (fallbackUrl && fallbackUrl !== url) {
                try {
                  const buffer = await robustDownloadPdf(fallbackUrl);
                  if (buffer.toString("utf-8", 0, 4) === "%PDF") return buffer;
                } catch (fallbackErr: any) {}
              }
            }
          }
        } catch (itemErr: any) {}
      }
    } catch (oaErr: any) {}

    const doiMatch = url?.match(/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i);
    if (doiMatch) {
      let doi = doiMatch[1];
      if (doi.endsWith(")")) doi = doi.substring(0, doi.length - 1);
      try {
        const unpaywallUrl = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=asnahonron@gmail.com`;
        const unpaywallRes = await axios.get(unpaywallUrl, { timeout: 8000 });
        if (unpaywallRes.data && unpaywallRes.data.is_oa) {
          const unpaywallPdfLink = unpaywallRes.data.best_oa_location?.url_for_pdf;
          if (unpaywallPdfLink && unpaywallPdfLink !== url) {
            try {
              const buffer = await robustDownloadPdf(unpaywallPdfLink);
              if (buffer.toString("utf-8", 0, 4) === "%PDF") return buffer;
            } catch (err: any) {}
          }
          if (unpaywallRes.data.oa_locations) {
            for (const loc of unpaywallRes.data.oa_locations) {
              if (loc.url_for_pdf && loc.url_for_pdf !== url && loc.url_for_pdf !== unpaywallPdfLink) {
                try {
                  const buffer = await robustDownloadPdf(loc.url_for_pdf);
                  if (buffer.toString("utf-8", 0, 4) === "%PDF") return buffer;
                } catch (e: any) {}
              }
            }
          }
        }
      } catch (unpaywallErr: any) {}
    }

    throw firstErr;
  }
}
