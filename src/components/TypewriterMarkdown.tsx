import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from '@iconify/react';

export const TypewriterMarkdown = React.memo(({ content, timestamp, onCitationClick, isStreaming }: { content: string, timestamp: number, onCitationClick?: (page: number, title: string) => void, isStreaming?: boolean }) => {
  
  // Transform custom syntax [[page:N|Title]] into markdown links with special prefix
  // We use encodeURIComponent for the title to handle spaces and special chars in the hash URL
  const processedContent = (content || '').replace(/\[\[page:(\d+)\|(.+?)\]\]/g, (_, p, t) => {
    // Escape potentially breaking characters in title label for markdown
    const safeTitle = t.replace(/\]/g, '\\]');
    return `[${safeTitle} (p. ${p})](#cite-page-${p}-${encodeURIComponent(t)})`;
  });

  const components = {
    p: ({children}: any) => <p className="mb-4 last:mb-0 leading-relaxed text-[#d4d4d8] text-[15px]">{children}</p>,
    h1: ({children}: any) => <h1 className="text-2xl font-semibold mb-6 mt-4 text-white tracking-tight">{children}</h1>,
    h2: ({children}: any) => <h2 className="text-xl font-medium mb-4 mt-6 text-[#f4f4f5] tracking-tight">{children}</h2>,
    h3: ({children}: any) => <h3 className="text-lg font-medium mb-3 mt-5 text-[#e4e4e7]">{children}</h3>,
    ul: ({children}: any) => <ul className="list-disc pl-5 mb-4 text-[#d4d4d8] space-y-1.5 marker:text-zinc-500">{children}</ul>,
    ol: ({children}: any) => <ol className="list-decimal pl-5 mb-4 text-[#d4d4d8] space-y-1.5 marker:text-zinc-500">{children}</ol>,
    li: ({children}: any) => <li className="pl-1 leading-relaxed"><span className="text-[15px]">{children}</span></li>,
    blockquote: ({children, node}: any) => {
      const textContent = node && node.children ? node.children.map((c: any) => c.value || (c.children && c.children[0]?.value)).join('') : '';
      if (textContent && textContent.includes('Citation:')) {
        const citationMatch = textContent.match(/Citation:\s*(.*?)\s*-\s*(.*)/);
        if (citationMatch) {
          const title = citationMatch[1].trim();
          return (
             <blockquote 
               className="border-l-2 border-blue-500/50 pl-4 my-6 bg-blue-500/5 py-3 pr-4 rounded-r-lg hover:bg-blue-500/10 cursor-pointer transition-colors group"
               onClick={() => {
                 if (onCitationClick) {
                   onCitationClick(1, title);
                 }
               }}
             >
               <div className="flex items-center gap-2 mb-1.5">
                 <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Source Citation</span>
                 <svg className="w-3 h-3 text-blue-400/50 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                 </svg>
               </div>
               <p className="font-medium text-blue-100 text-sm italic">{title}</p>
               <cite className="text-blue-300/80 text-xs mt-1 block not-italic">— {citationMatch[2].trim()}</cite>
             </blockquote>
          );
        }
      }
      return <blockquote className="border-l-2 border-zinc-700 pl-4 my-4 italic text-zinc-400 py-1 bg-[#1a1a1c] rounded-r-lg">{children}</blockquote>;
    },
    code: ({node, inline, className, children, ...props}: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <div className="my-6 rounded-xl overflow-hidden border border-[#27272a] bg-[#1a1a1c]">
          <div className="bg-[#222222] px-4 py-2 border-b border-[#2d2d30] flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">{match[1]}</span>
          </div>
          <div className="overflow-x-auto p-4">
            <code className="block font-mono text-[13px] text-[#d4d4d8] leading-relaxed min-w-max" {...props}>
              {children}
            </code>
          </div>
        </div>
      ) : (
        <code className="bg-[#27272a] text-[#f4f4f5] px-1.5 py-0.5 rounded-md text-[13px] font-mono mx-0.5" {...props}>
          {children}
        </code>
      );
    },
    a: ({children, href, ...props}: any) => {
      if (href?.startsWith('#cite-page-')) {
        const dataStr = href.replace('#cite-page-', '');
        const firstHyphen = dataStr.indexOf('-');
        if (firstHyphen !== -1) {
          const page = parseInt(dataStr.substring(0, firstHyphen));
          const encodedTitle = dataStr.substring(firstHyphen + 1);
          try {
            const title = decodeURIComponent(encodedTitle);
            const cleanLabel = title.replace(/_/g, ' ');
            return (
              <button 
                onClick={() => onCitationClick?.(page, title)}
                className="inline-flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-blue-400 px-1.5 py-0.5 rounded text-[11px] font-mono border border-zinc-700 transition-colors mx-0.5 cursor-pointer align-middle"
              >
                <Icon icon="ph:bookmark-simple-fill" className="w-3 h-3" />
                📄 {cleanLabel} (p. {page})
              </button>
            );
          } catch (e) {
            // fallback
          }
        }
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline underline-offset-2 transition-colors" {...props}>{children}</a>;
    },
    strong: ({children}: any) => <strong className="font-semibold text-white">{children}</strong>,
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-4 custom-scrollbar-h">
        <table className="w-full border-collapse border border-zinc-800 text-[12px] leading-snug">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: any) => <thead className="bg-[#1a1a1a]">{children}</thead>,
    th: ({ children }: any) => <th className="border border-zinc-800 p-2 text-left font-bold text-zinc-100">{children}</th>,
    td: ({ children }: any) => <td className="border border-zinc-800 p-2 text-zinc-300">{children}</td>,
  };

  return (
    <div className={isStreaming ? "streaming-cursor" : ""}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});
