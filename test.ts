export const parseAssistantResponse = (text: string) => {
  let thought = "";
  let chat = "";
  let title = "";
  let replaceContent = "";
  let searchRealPapersQuery = "";

  const lowerText = text.toLowerCase();

  // If there are absolutely NO valid XML tags in the text, treat everything as chat content.
  const hasTag = lowerText.includes("<thought>") || 
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
    return { thought: "", chat: text.trim(), title: "", replaceContent: "", searchRealPapersQuery: "" };
  }

  // 1. Parse <thought>
  const thoughtStartTagIdx = lowerText.indexOf("<thought>");
  let thoughtStartIdx = thoughtStartTagIdx !== -1 ? thoughtStartTagIdx + 9 : -1;
  if (thoughtStartIdx === -1 && lowerText.trim().length > 0) {
    const firstTagIdx = Math.min(
      lowerText.indexOf("<chat>") !== -1 ? lowerText.indexOf("<chat>") : Infinity,
      lowerText.indexOf("<title>") !== -1 ? lowerText.indexOf("<title>") : Infinity,
      lowerText.indexOf("<replacecontent>") !== -1 ? lowerText.indexOf("<replacecontent>") : Infinity
    );
    if (firstTagIdx > 0 && firstTagIdx !== Infinity) {
      thoughtStartIdx = 0;
    } else if (firstTagIdx === Infinity) {
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
        return { thought, chat: "", title: "", replaceContent: "", searchRealPapersQuery: "" };
      }
    }

    thought = text.substring(thoughtStartIdx, thoughtEndIdx).trim();
  }

  // 2. Parse <chat>
  const chatStartTagIdx = lowerText.indexOf("<chat>", chatStartSearchIdx);
  let chatStartIdx = chatStartTagIdx !== -1 ? chatStartTagIdx + 6 : -1;
  if (chatStartIdx === -1 && chatStartSearchIdx > 0) {
    const nextTagIdx = Math.min(
      lowerText.indexOf("<title>", chatStartSearchIdx) !== -1 ? lowerText.indexOf("<title>", chatStartSearchIdx) : Infinity,
      lowerText.indexOf("<replacecontent>", chatStartSearchIdx) !== -1 ? lowerText.indexOf("<replacecontent>", chatStartSearchIdx) : Infinity
    );
    if (nextTagIdx !== Infinity && nextTagIdx > chatStartSearchIdx) {
      chatStartIdx = chatStartSearchIdx;
    } else if (nextTagIdx === Infinity) {
      chatStartIdx = chatStartSearchIdx;
    }
  }

  let chatEndIdx = -1;
  let titleStartSearchIdx = chatStartSearchIdx;

  if (chatStartIdx !== -1) {
    const chatEndTagIdx = lowerText.indexOf("</chat>", chatStartIdx);
    if (chatEndTagIdx !== -1) {
      chatEndIdx = chatEndTagIdx;
      titleStartSearchIdx = chatEndTagIdx + 7;
    } else {
      chat = text.substring(chatStartIdx).trim();
      return { thought, chat, title: "", replaceContent: "", searchRealPapersQuery: "" };
    }

    if (chatEndIdx !== -1) {
        chat = text.substring(chatStartIdx, chatEndIdx).trim();
    }
  }

  // ... [omitted title logic] ...

  // 4. Parse <searchRealPapers>
  const paperStartTagIdx = lowerText.lastIndexOf("<searchrealpapers>");
  if (paperStartTagIdx !== -1) {
    const paperStartIdx = paperStartTagIdx + 18;
    const paperEndTagIdx = lowerText.indexOf("</searchrealpapers>", paperStartIdx);
    if (paperEndTagIdx !== -1) {
      searchRealPapersQuery = text.substring(paperStartIdx, paperEndTagIdx).trim();
    } else {
      searchRealPapersQuery = text.substring(paperStartIdx).trim();
    }
  }

  if (searchRealPapersQuery && searchRealPapersQuery.includes("<")) {
     searchRealPapersQuery = searchRealPapersQuery.replace(/<[^>]*>?/gm, '').trim();
  }
  if (searchRealPapersQuery.length > 100) {
     searchRealPapersQuery = searchRealPapersQuery.substring(0, 100);
  }

  if (chat) {
    const srIdx = chat.toLowerCase().indexOf("<searchrealpapers>");
    if (srIdx !== -1) {
      chat = chat.substring(0, srIdx).trim();
    }
  }

  return { thought, chat, title, replaceContent, searchRealPapersQuery };
};

const res = parseAssistantResponse("<chat>Let's find some solid academic papers on DALL-E for you! ... \n\n<searchRealPapers>DALL-E generative AI text-to-image</searchRealPapers>");
console.log(res);

const res3 = parseAssistantResponse("Let's find some solid academic papers on DALL-E for you! ... \n\n<searchRealPapers>DALL-E generative AI text-to-image</searchRealPapers>");
console.log(res3);
