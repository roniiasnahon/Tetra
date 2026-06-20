import React, { useState, useEffect } from "react";

interface DynamicShimmerProps {
  isAiTyping: boolean;
  researchStatus: "fetching" | "downloading" | "polishing" | "editor_agent" | null;
  messages: any[];
  webSearchEnabled: boolean;
}

export const DynamicShimmer: React.FC<DynamicShimmerProps> = ({
  isAiTyping,
  researchStatus,
  messages,
  webSearchEnabled,
}) => {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    if (isAiTyping || researchStatus) {
      setSecondsElapsed(0);
      const timer = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setSecondsElapsed(0);
    }
  }, [isAiTyping, researchStatus]);

  if (!isAiTyping && !researchStatus) return null;

  // If the last message is from the assistant and already has content,
  // we do not show the "Thinking..." or other preparation shimmers, as the AI is actively responding.
  const lastMsg = messages[messages.length - 1];
  const hasResponseStarted =
    lastMsg &&
    lastMsg.role === "assistant" &&
    lastMsg.content &&
    lastMsg.content.trim().length > 0;

  if (hasResponseStarted && !researchStatus) return null;

  let text = "Thinking...";

  if (researchStatus === "fetching") {
    text = "Fetching...";
  } else if (researchStatus === "downloading") {
    text = "Downloading...";
  } else if (researchStatus === "polishing") {
    text = "Polishing...";
  } else if (researchStatus === "editor_agent") {
    text = "🤖 Blob is drafting content...";
  } else {
    // Get last user query to establish context
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const query = lastUserMsg?.content?.toLowerCase() || "";
    const hasAttachment = !!lastUserMsg?.attachment;

    // Web search: query specifies searching/looking up online
    const isWebSearch =
      query.includes("search the web") ||
      query.includes("google") ||
      query.includes("look up") ||
      query.includes("find online") ||
      query.includes("search online") ||
      query.includes("web search");

    if (hasAttachment) {
      if (secondsElapsed < 1) {
        text = "Thinking...";
      } else if (secondsElapsed >= 4) {
        text = "Almost done...";
      } else {
        text = "Looking at the uploaded file...";
      }
    } else if (isWebSearch) {
      if (secondsElapsed < 2) {
        text = "Thinking...";
      } else if (secondsElapsed >= 5) {
        text = "Almost done...";
      } else {
        text = "Searching the web...";
      }
    } else if (query.includes("essay")) {
      text = "Making essay for you...";
    } else if (query.includes("outline")) {
      text = "Generating outline...";
    } else if (query.includes("poem") || query.includes("poetry")) {
      text = "Writing poem for you...";
    } else if (query.includes("summar")) {
      text = "Summarizing content...";
    } else if (query.includes("draft") || query.includes("write")) {
      text = "Drafting content...";
    } else if (
      query.includes("code") ||
      query.includes("program") ||
      query.includes("script") ||
      query.includes("function") ||
      query.includes("develop")
    ) {
      text = "Writing code...";
    } else if (query.includes("quiz") || query.includes("test")) {
      text = "Creating quiz...";
    } else if (
      query.includes("study") ||
      query.includes("learn") ||
      query.includes("explain")
    ) {
      text = "Generating study guide...";
    } else if (
      query.includes("research") ||
      query.includes("analyze") ||
      query.includes("analyse")
    ) {
      text = "Conducting research...";
    } else {
      text = "Thinking...";
    }
  }

  return <span className="shimmer-text font-medium">{text}</span>;
};
