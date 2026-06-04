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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  isHidden?: boolean;
  thought?: string;
  suggestion?: SuggestionPayload; 
}
