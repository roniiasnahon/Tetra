/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AcademicNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface Citation {
  id: string;
  title: string;
  authors: string;
  source: string; // Journal, book title, web domain
  year: string;
  url?: string;
  doi?: string;
  format: 'APA' | 'MLA' | 'Chicago' | 'IEEE';
  quoteSnippet?: string; // Direct snippet from reference
}

export interface OutlineItem {
  id: string;
  level: 1 | 2 | 3; // 1 = Main, 2 = Sub-section, 3 = Detail-level
  title: string;
  points: string[]; // Bullet points/guidelines
  draftContent: string; // The draft paragraph for this section
  linkedCitations: string[]; // Citation IDs
}

export interface SuggestionPayload {
  type: 'outline' | 'citations' | 'draft_section';
  outline?: Omit<OutlineItem, 'id'>[];
  citations?: Omit<Citation, 'id'>[];
  draftMarkdown?: string;
  targetSectionId?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  createdAt: number;
}

export interface PaperItem {
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
  starred?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thought?: string;
  timestamp: number;
  isHidden?: boolean;
  isStreaming?: boolean;
  suggestion?: SuggestionPayload;
  attachment?: {
    fileId: string;
    fileName: string;
    mimetype: string;
    url: string;
  };
  groundingMetadata?: any;
}
