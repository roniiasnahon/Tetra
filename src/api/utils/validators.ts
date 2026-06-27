import { z } from "zod";

export const SendVerificationSchema = z.object({
  email: z.string().email(),
});

export const VerifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

export const CustomTokenSchema = z.object({
  idToken: z.string().min(1),
});

export const OcrImageSchema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().min(1),
});

export const DownloadPdfSchema = z.object({
  url: z.string().url(),
});

export const ResolveDoiSchema = z.object({
  doi: z.string().min(1),
});

export const ParseTextSchema = z.object({
  text: z.string().min(1),
});

export const SynthesizeSchema = z.object({
  papers: z.array(z.any()),
  userQuery: z.string(),
});

export const SummarizeUrlSchema = z.object({
  url: z.string().url(),
  type: z.string().optional(),
});

export const GenerateTitleSchema = z.object({
  userQuery: z.string().min(1),
});

export const ChatSchema = z.object({
  message: z.string().optional(),
  history: z.array(z.any()).optional(),
  context: z.string().optional(),
  citations: z.array(z.any()).optional(),
  workspaceDraft: z.string().optional(),
});

export const SearchArxivSchema = z.object({
  query: z.string().min(1),
});

export const GeneratePdfSchema = z.object({
  title: z.string(),
  author: z.string().optional(),
  year: z.string().optional(),
  abstract: z.string().optional(),
  fullText: z.string(),
});

export const AnalyzeStatsSchema = z.object({
  textContent: z.string().min(1),
  filename: z.string().optional(),
});

export const GenerateQuizSchema = z.object({
  content: z.string().min(1),
  title: z.string().optional(),
});

export const GenerateNotesSchema = z.object({
  content: z.string().min(1),
  title: z.string().optional(),
});

export const VoyageEmbedSchema = z.object({
  texts: z.array(z.string()),
  model: z.string().optional(),
});

export const VoyageRerankSchema = z.object({
  query: z.string().min(1),
  documents: z.array(z.string()),
  topK: z.number().nullable().optional(),
  model: z.string().optional(),
});

// GET Request schemas
export const LinkPreviewSchema = z.object({
  url: z.string().url(),
});

export const FileIdSchema = z.object({
  id: z.string().min(1),
});

export const SearchPapersSchema = z.object({
  q: z.string().optional(),
});
