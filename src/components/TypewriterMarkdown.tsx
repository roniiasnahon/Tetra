import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from '@iconify/react';

const previewCache = new Map<string, any>();

const CitationLink = ({ 
  num, 
  text, 
  href, 
  hostname, 
  isStandardLink, 
  children 
}: { 
  num?: string; 
  text?: string; 
  href: string; 
  hostname: string; 
  isStandardLink?: boolean; 
  children?: React.ReactNode 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPosition, setCardPosition] = useState<React.CSSProperties>({
    bottom: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    marginBottom: "8px"
  });

  useEffect(() => {
    if (!href) return;
    
    // Check cache
    if (isHovered && !previewData && previewCache.has(href)) {
      setPreviewData(previewCache.get(href));
      return;
    }

    // Load preview data asynchronously on hover
    if (isHovered && !previewData && !isLoading) {
      setIsLoading(true);
      fetch(`/api/link-preview?url=${encodeURIComponent(href)}`)
        .then((res) => {
          if (!res.ok) throw new Error("Status " + res.status);
          return res.json();
        })
        .then((data) => {
          previewCache.set(href, data);
          setPreviewData(data);
        })
        .catch((err) => {
          console.warn("Failed to load preview for", href, err);
          const fallbackData = {
            title: text || hostname || 'Source Link',
            description: `Click to visit ${hostname || 'website'}.`,
            image: '',
            siteName: hostname || 'External Source'
          };
          previewCache.set(href, fallbackData);
          setPreviewData(fallbackData);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isHovered, href, previewData, isLoading, hostname, text]);

  useEffect(() => {
    if (isHovered && triggerRef.current) {
      const updatePosition = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const cardWidth = 340;
        const cardHeight = 155; // Estimated safe height matching our content padding

        const style: React.CSSProperties = {
          position: "absolute",
          width: `${cardWidth}px`,
          zIndex: 9999,
        };

        // Determine left horizontal alignment relative to trigger
        const spaceLeft = rect.left;
        const spaceRight = viewportWidth - rect.right;
        const halfCard = cardWidth / 2;

        if (spaceLeft > halfCard && spaceRight > halfCard) {
          // Centered is safe
          style.left = "50%";
          style.transform = "translateX(-50%)";
        } else if (spaceLeft <= halfCard) {
          // Too close to left: flush with left edge of screen + padding
          const offset = -rect.left + 12;
          style.left = `${offset}px`;
          style.transform = "none";
        } else {
          // Too close to right: flush with right edge of screen - padding
          const offset = -(viewportWidth - rect.right - 12);
          style.right = `${offset}px`;
          style.transform = "none";
        }

        // Determine vertical positioning (above vs below trigger)
        if (rect.top > cardHeight + 24) {
          // Space above is sufficient -> Place ABOVE
          style.bottom = "100%";
          style.top = "auto";
          style.marginBottom = "8px";
        } else {
          // Not enough space above -> Place BELOW
          style.top = "100%";
          style.bottom = "auto";
          style.marginTop = "8px";
        }

        setCardPosition(style);
      };

      updatePosition();

      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [isHovered]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(false);
  };

  const activeTitle = previewData?.title || text || hostname || 'Source';
  const activeDesc = previewData?.description || (isLoading ? 'Loading preview details...' : `Reference link to ${hostname || 'source'}`);
  const activeImage = previewData?.image || '';
  const activeSiteName = previewData?.siteName || hostname || 'Source';
  
  // Custom YouTube extraction for interactive UI thumbnail
  let youtubeId = '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = href.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    youtubeId = match[2];
  }

  // Use MQ YouTube thumbnail by default if match found and image is empty
  const thumbnailToUse = activeImage || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : '');

  return (
    <span 
      ref={triggerRef}
      className={isStandardLink ? "relative inline select-text" : "relative inline-block align-middle select-none mx-0.5"}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isStandardLink ? (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="underline decoration-dashed decoration-skip-ink underline-offset-[3px] text-inherit cursor-pointer hover:text-[#f4f4f5] transition-colors inline" 
          title={text ? `${text} (${href})` : href}
        >
          {children || text || href}
        </a>
      ) : (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="citation-card-link inline-flex items-center gap-1.5 bg-[#27272a] hover:bg-[#323235] px-2.5 py-1 rounded-full text-[12px] font-normal border border-zinc-700/30 transition-all align-middle select-none" 
          title={text ? `${text} (${href})` : href}
        >
          {hostname && (
            <img 
              src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`} 
              alt="" 
              className="w-3.5 h-3.5 rounded-[3px] opacity-90 group-hover:opacity-100 transition-opacity shrink-0 object-contain select-none" 
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          )}
          <span className="truncate max-w-[200px] leading-tight shrink-0 font-medium tracking-tight">
            {text || hostname || 'Source'}
          </span>
        </a>
      )}

      {/* Floating Hover Card */}
      {isHovered && (
        <div 
          ref={cardRef}
          style={cardPosition}
          className="absolute bg-[#18181b] border border-[#2e3138] rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.6)] p-4.5 z-50 text-left transition-all flex flex-col gap-3 select-text"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex gap-4 justify-between items-start">
            {/* Left side text */}
            <div className="flex-1 min-w-0">
              <div className="text-white text-[13.5px] font-semibold leading-tight tracking-tight mb-1 break-words line-clamp-2">
                {activeTitle}
              </div>
              <div className="text-[#a1a1aa] text-[11.5px] leading-normal break-words line-clamp-3">
                {activeDesc}
              </div>
            </div>

            {/* Right side Thumbnail Image */}
            {thumbnailToUse && (
              <div className="relative w-24 h-15 rounded-xl overflow-hidden shrink-0 bg-black/40 border border-zinc-800/10 self-start">
                <img 
                  src={thumbnailToUse} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
                
                {/* Custom Overlay Play Button for YouTube previews */}
                {(youtubeId || previewData?.isVideo) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="bg-black/80 text-white rounded-full p-1 shadow-md">
                      <Icon icon="ph:play-fill" className="w-3 h-3 text-white" />
                    </span>
                    <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] font-semibold text-zinc-300 px-1 rounded-sm">
                      4m
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Row Brand Metadata */}
          <div className="flex items-center gap-1.5 pt-2.5 border-t border-zinc-800/40 text-[11px] text-[#a1a1aa] font-medium leading-none">
            {hostname && (
              <img 
                src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`} 
                alt="" 
                className="w-3.5 h-3.5 rounded-[3px] opacity-100 object-contain select-none" 
              />
            )}
            <span className="capitalize">{activeSiteName}</span>
            <span className="text-zinc-600 font-bold select-none">•</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Verified Reference</span>
          </div>
        </div>
      )}
    </span>
  );
};

const ImageCarousel = ({ images }: { images: Array<{ url: string; alt: string }> }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftBtn, setShowLeftBtn] = useState(false);
  const [showRightBtn, setShowRightBtn] = useState(false);

  const checkScroll = () => {
    const el = containerRef.current;
    if (el) {
      setShowLeftBtn(el.scrollLeft > 5);
      setShowRightBtn(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      checkScroll();
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      
      const ob = new ResizeObserver(checkScroll);
      ob.observe(el);
      
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
        ob.disconnect();
      };
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const el = containerRef.current;
    if (el) {
      const scrollAmount = el.clientWidth * 0.75;
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (!images || images.length === 0) return null;

  return (
    <div className="relative group w-full my-4" id="web-search-image-carousel">
      {/* Scrollable Container */}
      <div
        ref={containerRef}
        className="flex overflow-x-auto gap-3.5 scroll-smooth snap-x snap-mandatory py-1 pb-3 scrollbar-none"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {images.map((img, idx) => (
          <div
            key={idx}
            className="w-[210px] md:w-[250px] shrink-0 snap-align-start flex flex-col transition-all"
          >
            {/* Image Border/Canvas Box */}
            <div className="aspect-square w-full rounded-[14px] overflow-hidden flex items-center justify-center relative">
              <img
                src={img.url}
                alt={img.alt || "Search result image"}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            
            {/* Description/Caption text */}
            {img.alt && (
              <div className="mt-2 flex-1 flex flex-col justify-start">
                <p className="text-[12px] font-medium leading-relaxed text-[#c3c3c9] line-clamp-2 md:line-clamp-3 font-sans tracking-tight">
                  {img.alt}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Elegant Nav Scroll Buttons (No glows, flat style) */}
      {showLeftBtn && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-12 md:top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#1e1e21] border border-[#2e2e33] text-zinc-300 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
          title="Scroll Left"
        >
          <Icon icon="ph:caret-left-bold" className="w-4 h-4" />
        </button>
      )}
      {showRightBtn && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-12 md:top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#1e1e21] border border-[#2e2e33] text-zinc-300 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
          title="Scroll Right"
        >
          <Icon icon="ph:caret-right-bold" className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

function groupImagesIntoCarousel(content: string): string {
  if (!content) return content;
  
  // Regex to match markdown images
  const imageRegex = /!\[([^\]]*?)\]\((https?:\/\/[^\s\)]+)\)/g;
  
  const matches: Array<{ full: string; alt: string; url: string; index: number }> = [];
  let match;
  while ((match = imageRegex.exec(content)) !== null) {
    matches.push({
      full: match[0],
      alt: match[1],
      url: match[2],
      index: match.index
    });
  }

  if (matches.length === 0) return content;

  let result = "";
  let lastIdx = 0;
  
  let i = 0;
  while (i < matches.length) {
    let j = i;
    while (j + 1 < matches.length) {
      const currentEnd = matches[j].index + matches[j].full.length;
      const nextStart = matches[j+1].index;
      const interText = content.substring(currentEnd, nextStart).trim();
      if (interText === "" || interText === "\\n" || interText === "*" || interText.replace(/[\s\n\-\*]/g, "") === "") {
        j++;
      } else {
        break;
      }
    }

    const startIdx = matches[i].index;
    const endIdx = matches[j].index + matches[j].full.length;
    const groupedImages = matches.slice(i, j + 1).map(m => ({ url: m.url, alt: m.alt }));

    result += content.substring(lastIdx, startIdx);

    if (groupedImages.length > 1) {
      const dataStr = encodeURIComponent(JSON.stringify(groupedImages));
      result += `[ImageCarousel](https://carousel.local?data=${dataStr})`;
    } else {
      // Just emit the original single image markdown
      result += content.substring(startIdx, endIdx);
    }

    lastIdx = endIdx;
    i = j + 1;
  }
  
  result += content.substring(lastIdx);
  return result;
}

export const TypewriterMarkdown = React.memo(({ content, timestamp, onCitationClick, isStreaming }: { content: string, timestamp: number, onCitationClick?: (page: number, title: string) => void, isStreaming?: boolean }) => {
  
  // Transform custom syntax [[page:N|Title]] into markdown links with special prefix
  // We use encodeURIComponent for the title to handle spaces and special chars in the hash URL
  const processedContent = groupImagesIntoCarousel(
    (content || '').replace(/\[\[page:(\d+)\|(.+?)\]\]/g, (_, p, t) => {
      // Escape potentially breaking characters in title label for markdown
      const safeTitle = t.replace(/\]/g, '\\]');
      return `[${safeTitle} (p. ${p})](#cite-page-${p}-${encodeURIComponent(t)})`;
    })
  );

  const components = {
    p: ({children}: any) => <div className="mb-4 last:mb-0 leading-relaxed text-[#d4d4d8] text-[15px]">{children}</div>,
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
    pre: ({ children }: any) => <>{children}</>,
    code: ({node, inline, className, children, ...props}: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const strChildren = String(children);
      const isBlock = !inline && (!!match || strChildren.includes('\n'));
      
      if (isBlock && !match && (strChildren.includes('##') || strChildren.includes('- '))) {
         // Custom rendering for mistakenly indented markdown outlines
         return (
           <div className="my-4 py-2 px-4 border-l-2 border-[#27272a] bg-[#141415]/50 rounded-r-xl">
              {strChildren.split('\n').map((line, i) => {
                 const trimmed = line.trim();
                 if (!trimmed) return null;
                 if (trimmed.startsWith('### ')) return <h4 key={i} className="font-medium text-white mt-3 mb-1">{trimmed.replace(/^[#\s]+/, '')}</h4>;
                 if (trimmed.startsWith('## ')) return <h3 key={i} className="font-semibold text-white mt-4 mb-2">{trimmed.replace(/^[#\s]+/, '')}</h3>;
                 if (trimmed.startsWith('# ')) return <h2 key={i} className="font-bold text-white text-lg mt-5 mb-2">{trimmed.replace(/^[#\s]+/, '')}</h2>;
                 if (trimmed.startsWith('- ')) return <div key={i} className="flex gap-2 ml-2 my-1"><span className="text-zinc-500">•</span> <span className="text-[#d4d4d8] leading-relaxed">{trimmed.replace(/^-\s*/, '')}</span></div>;
                 if (trimmed.startsWith('* ')) return <div key={i} className="flex gap-2 ml-2 my-1"><span className="text-zinc-500">•</span> <span className="text-[#d4d4d8] leading-relaxed">{trimmed.replace(/^\*\s*/, '')}</span></div>;
                 return <p key={i} className="text-[#d4d4d8] leading-relaxed my-1">{trimmed}</p>;
              })}
           </div>
         );
      }

      return isBlock ? (
        <div className="my-6 rounded-xl overflow-hidden border border-[#27272a] bg-[#1a1a1c]">
          {match && (
            <div className="bg-[#222222] px-4 py-2 border-b border-[#2d2d30] flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">{match[1]}</span>
            </div>
          )}
          <div className="overflow-x-auto p-4">
            <code className="block font-mono text-[13px] text-[#d4d4d8] leading-relaxed min-w-max whitespace-pre-wrap" {...props}>
              {children}
            </code>
          </div>
        </div>
      ) : (
        <code className="text-[#f4f4f5] font-mono text-[13px]" {...props}>
          {children}
        </code>
      );
    },
    a: ({children, href, ...props}: any) => {
      if (href?.startsWith('https://carousel.local?data=')) {
        try {
          const jsonStr = decodeURIComponent(href.substring('https://carousel.local?data='.length));
          const images = JSON.parse(jsonStr);
          return <ImageCarousel images={images} />;
        } catch (e) {
          console.error("Failed to parse carousel images:", e);
          return null;
        }
      }

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

      // Check for inline source citations [1] Title Formats...
      const innerText = Array.isArray(children) ? children.join('') : String(children);
      const citeMatch = innerText.match(/^\[(\d+)\]\s*(.*)/);
      if (citeMatch && href && href.startsWith('http')) {
        const num = citeMatch[1];
        let text = citeMatch[2].trim();
        
        // Clean up any leading punctuation/separators
        text = text.replace(/^[\s\-\|]+/, '').trim();

        let hostname = '';
        try {
          hostname = new URL(href).hostname;
        } catch {}

        if (!text && hostname) {
           text = hostname.replace(/^www\./, '');
        }

        return (
          <CitationLink 
            num={num} 
            text={text} 
            href={href} 
            hostname={hostname} 
          />
        );
      }

      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        let hostname = '';
        try {
          hostname = new URL(href).hostname;
        } catch {}
        return (
          <CitationLink 
            href={href} 
            hostname={hostname} 
            isStandardLink={true}
          >
            {children}
          </CitationLink>
        );
      }

      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="underline decoration-dashed decoration-skip-ink underline-offset-[3px] text-inherit cursor-pointer hover:text-[#f4f4f5] transition-colors inline" 
          {...props}
        >
          {children}
        </a>
      );
    },
    strong: ({children}: any) => <strong className="font-semibold text-white">{children}</strong>,
    img: ({ src, alt }: any) => {
      return (
        <span className="block my-5 max-w-full overflow-hidden">
          <img 
            src={src} 
            alt={alt || "Search result image"} 
            className="w-full max-h-[380px] object-cover rounded-[14px] block" 
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {alt && (
            <span className="block text-[12px] text-[#c3c3c9] mt-2 font-sans font-medium leading-relaxed tracking-tight">{alt}</span>
          )}
        </span>
      );
    },
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
