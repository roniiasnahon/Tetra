import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import admin from "firebase-admin";
import PDFDocument from "pdfkit";

let r2Client: S3Client | null = null;
const R2_BUCKET = process.env.R2_BUCKET_NAME || "";

export function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const accountId = process.env.R2_ACCOUNT_ID?.trim() || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";
  const customEndpoint = process.env.R2_ENDPOINT?.trim() || "";

  if (!accessKeyId || !secretAccessKey) {
    console.warn("[STORAGE] Cloudflare R2 credentials missing");
    throw new Error("Cloudflare R2 credentials are missing.");
  }

  const endpoint = customEndpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  if (!endpoint) {
    throw new Error("Cloudflare R2 endpoint or R2_ACCOUNT_ID must be provided.");
  }

  console.log(`[STORAGE] Initializing Cloudflare R2 client for bucket: ${R2_BUCKET || "(not set)"}`);
  r2Client = new S3Client({
    region: "auto",
    endpoint: endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });

  return r2Client;
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) {
    return stream;
  }
  if (stream && typeof stream.transformToByteArray === "function") {
    const arr = await stream.transformToByteArray();
    return Buffer.from(arr);
  }
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function saveFile(
  fileId: string,
  data: { buffer: Buffer; mimetype: string; originalname: string },
) {
  const safeBuffer = Buffer.alloc(data.buffer.length);
  Buffer.from(data.buffer).copy(safeBuffer);

  if (
    (data.mimetype === "application/pdf" ||
      data.originalname.toLowerCase().endsWith(".pdf")) &&
    safeBuffer.length > 4
  ) {
    const magic = safeBuffer.toString("utf-8", 0, 5);
    if (!magic.startsWith("%PDF")) {
      console.warn(`[STORAGE] File ${fileId} might not be a valid PDF. Magic bytes: ${magic}`);
    }
  }

  try {
    const r2 = getR2Client();
    if (!R2_BUCKET) throw new Error("R2_BUCKET_NAME is not configured.");

    console.log(`[STORAGE] Uploading ${fileId} to Cloudflare R2 Storage...`);
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileId,
        Body: safeBuffer,
        ContentType: data.mimetype || "application/octet-stream",
      })
    );
    console.log(`[STORAGE] Successfully persisted ${fileId} to Cloudflare R2 Storage.`);
  } catch (storageErr: any) {
    console.warn(`[STORAGE] Cloudflare R2 Storage persistence failed for ${fileId}:`, storageErr.message || storageErr);
  }
}

export async function getFile(fileId: string) {
  try {
    const r2 = getR2Client();
    if (!R2_BUCKET) throw new Error("R2_BUCKET_NAME is not configured.");

    console.log(`[STORAGE] Fetching ${fileId} from Cloudflare R2 Storage...`);
    const response = await r2.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileId,
      })
    );

    if (response.Body) {
      const buffer = await streamToBuffer(response.Body);
      return {
        buffer,
        mimetype: response.ContentType || "application/octet-stream",
        originalname: fileId,
      };
    }
  } catch (err: any) {
    console.warn(`[STORAGE] Error retrieving ${fileId} from R2 Storage:`, err.message || err);
  }

  // SELF-HEALING FALLBACK via Firestore
  try {
    console.log(`[STORAGE] File ID ${fileId} not found. Initiating Firestore query for self-healing...`);
    const firestore = admin.firestore();
    const papersRef = firestore.collectionGroup("papers");
    const paperSnap = await papersRef.where("fileId", "==", fileId).limit(1).get();

    if (!paperSnap.empty) {
      const paperDoc = paperSnap.docs[0].data();
      const title = paperDoc.title || "Unknown Title";
      const author = paperDoc.author || "Unknown Author";
      const year = paperDoc.added || "2026";
      const abstract = paperDoc.summary || paperDoc.description || "No abstract available.";

      console.log(`[STORAGE] Found metadata in Firestore for ${fileId}. Reconstructing PDF...`);
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));

      doc.fontSize(22).font("Helvetica-Bold").text(title, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica-Oblique").text(`${author} (${year})`, { align: "center" });
      doc.moveDown(2);

      if (abstract && abstract !== "No abstract available.") {
        doc.fontSize(14).font("Helvetica-Bold").text("Research Abstract");
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica").text(abstract, { align: "justify", lineGap: 3 });
      }

      const pdfDataPromise = new Promise<Buffer>((resolve) => {
        doc.on("end", () => resolve(Buffer.concat(buffers)));
      });

      doc.end();
      const pdfData = await pdfDataPromise;

      const reconstructedData = {
        buffer: pdfData,
        mimetype: "application/pdf",
        originalname: `${title.replace(/[^a-zA-Z0-9]/g, "_")}_Scholar_Note.pdf`,
      };

      await saveFile(fileId, reconstructedData);
      return reconstructedData;
    }
  } catch (err: any) {
    console.warn(`[STORAGE] Self-healing lookup failed for ${fileId}: ${err.message || err}`);
  }

  return null;
}

export interface CachedPaper {
  fileId: string;
  title: string;
  pdfUrl?: string;
  mimetype: string;
}

export async function getCachedPaper(key: string): Promise<CachedPaper | null> {
  if (!key) return null;
  const hash = Buffer.from(key).toString("base64").replace(/[/+=]/g, "_");
  try {
    const doc = await admin.firestore().collection("downloadedPapersCache").doc(hash).get();
    if (doc.exists) {
      return doc.data() as CachedPaper;
    }
  } catch (e) {
    console.warn(`[CACHE] Failed to get cached paper:`, e);
  }
  return null;
}

export async function setCachedPaper(key: string, data: CachedPaper) {
  if (!key) return;
  const hash = Buffer.from(key).toString("base64").replace(/[/+=]/g, "_");
  try {
    await admin.firestore().collection("downloadedPapersCache").doc(hash).set(data);
  } catch (e) {
    console.warn(`[CACHE] Failed to set cached paper:`, e);
  }
}
