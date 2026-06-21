import React from "react";
import { Icon as IconifyIcon, IconProps } from "@iconify/react";

// Explicit manual mappings for style overrides to make sure each icon maps to the best Solar variant
const styleOverrides: Record<string, string> = {
  "lock-bold": "bold",
  "link-bold": "bold",
  "star-fill": "bold",
  "star-bold": "bold",
  "dots-three-bold": "bold",
  "info-bold": "bold",
  "download-simple-bold": "bold",
  "caret-right-bold": "bold",
  "file-pdf-fill": "bold",
  "markdown-logo-fill": "bold",
  "file-txt-bold": "bold",
  "trash-bold": "bold",
  "plus-bold": "bold",
  "check-bold": "bold",
  "dots-three-outline-fill": "bold",
  "caret-down-bold": "bold",
  "wrench-fill": "bold",
  "calculator-fill": "bold",
  "percent-fill": "bold",
  "scales-fill": "bold",
  "check-square-fill": "bold",
  "chart-pie-slice-fill": "bold",
  "clock-counter-clockwise-fill": "bold",
  "play-fill": "bold",
  "bookmark-simple-fill": "bold",
  "shield-check": "linear",
  "plugs-connected": "linear",
  "patch-check-fill": "bold",
  "warning-circle-fill": "bold",
  "x-circle-fill": "bold",
  "share-network-fill": "bold",
  "paint-brush-broad": "linear",
};

export const Icon = React.forwardRef<any, IconProps>(({ icon, ...props }, ref) => {
  let mappedIcon = icon;

  if (typeof icon === "string") {
    if (icon.startsWith("ph:")) {
      const phName = icon.substring(3);
      
      // Map base Phosphor names to the exact matching Solar base icon names
      const baseMapping: Record<string, string> = {
        "minus": "minus",
        "plus": "add",
        "plus-circle": "add-circle",
        "plus-bold": "add",
        "plus-circle-fill": "add-circle",
        "x": "close-circle",
        "square": "stop",
        "pencil-line": "pen-new-square",
        "pencil-simple": "pen",
        "note-pencil": "pen-new-square",
        "pencil": "pen",
        "house": "home-2",
        "books": "library",
        "notebook": "notebook",
        "wrench-fill": "tuning",
        "wrench": "tuning",
        "file-text": "document-text",
        "article": "document",
        "article-fill": "document-text",
        "chat-circle": "chat-round-line",
        "chat-circle-dots": "chat-round-dots",
        "chat-round-line": "chat-round-line",
        "folder": "folder",
        "folder-open": "folder-opened",
        "folder-plus": "add-folder",
        "folder-simple-plus": "add-folder",
        "folder-user": "folder-with-files",
        "upload-simple": "upload-minimalistic",
        "download-simple": "download-minimalistic",
        "download-simple-bold": "download-minimalistic",
        "caret-right": "alt-arrow-right",
        "caret-down": "alt-arrow-down",
        "caret-left": "alt-arrow-left",
        "caret-up": "alt-arrow-up",
        "trash": "trash-bin-trash",
        "trash-bold": "trash-bin-trash",
        "trash-simple": "trash-bin-trash",
        "bookmark-simple": "bookmark",
        "bookmark": "bookmark",
        "user": "user",
        "user-plus": "user-plus",
        "quotes": "quote-linear",
        "calculator-fill": "calculator",
        "calculator": "calculator",
        "percent": "sale",
        "percent-fill": "sale",
        "scales": "checklist-minimalistic",
        "scales-fill": "checklist-minimalistic",
        "check-square": "check-square",
        "check-square-fill": "check-square",
        "chart-pie-slice": "pie-chart",
        "chart-pie-slice-fill": "pie-chart",
        "chart-pie": "pie-chart",
        "chart-bar": "graph-up",
        "chart-line": "graph-up",
        "clock-counter-clockwise": "history",
        "clock-counter-clockwise-fill": "history",
        "gear": "settings",
        "gear-six": "settings",
        "envelope-simple": "letter",
        "envelope": "letter",
        "sign-out": "logout",
        "sign-in": "login",
        "sidebar-simple": "siderbar-minimalistic",
        "dots-three-outline": "menu-dots-bold",
        "dots-three-bold": "menu-dots",
        "dots-three": "menu-dots",
        "magnifying-glass": "magnifier",
        "magnifying-glass-bold": "magnifier",
        "rows": "list",
        "check": "check-circle",
        "check-bold": "check-circle",
        "arrows-down-up": "sort-vertical",
        "funnel": "filter",
        "sliders-horizontal": "slider-minimalistic-horizontal",
        "file-plus": "file-plus",
        "eye": "eye",
        "copy": "copy",
        "copy-bold": "copy",
        "highlighter": "paint-roller",
        "highlighter-circle": "paint-roller",
        "text-align-left": "align-left",
        "text-align-center": "align-center",
        "text-align-right": "align-right",
        "text-align-justify": "align-justify",
        "sparkle": "stars",
        "translate": "translation",
        "book-open": "book-open",
        "speaker-high": "volume-loud",
        "cards": "gallery",
        "printer": "printer",
        "lock": "lock",
        "link": "link",
        "star": "star",
        "info": "info-circle",
        "file-pdf": "document",
        "markdown-logo": "code",
        "file-txt": "document-text",
        "arrow-u-up-left": "undo-left",
        "arrow-u-up-right": "redo-right",
        "text-b": "text-bold",
        "text-italic": "text-italic",
        "text-underline": "text-underline",
        "table": "table",
        "text-strikethrough": "text-cross",
        "text-subscript": "text",
        "text-superscript": "text",
        "eraser": "eraser",
        "palette": "palette",
        "list-bullets": "list",
        "list-numbers": "list",
        "caret-double-right": "double-alt-arrow-right",
        "lightbulb": "lightbulb",
        "globe-hemisphere-east-fill": "global",
        "globe": "global",
        "spinner-gap": "refresh-circle",
        "spinner": "refresh-circle",
        "paper-plane-right": "send",
        "wifi-slash": "feed",
        "arrow-fat-up": "arrow-up",
        "arrow-fat-down": "arrow-down",
        "arrow-fat-left": "arrow-left",
        "arrow-fat-right": "arrow-right",
        "columns-light": "siderbar-minimalistic",
        "columns": "siderbar-minimalistic",
        "share-network": "share",
        "paint-brush-broad": "paint-roller",
        "warning-circle": "danger-circle",
        "warning-circle-fill": "danger-circle",
        "calendar": "calendar",
        "floppy-disk": "diskette",
        "shield-check": "shield-check",
        "stack": "layers",
        "plugs-connected": "link",
        "desktop": "laptop",
        "x-circle-fill": "close-circle",
        "sun": "sun",
        "moon": "moon",
        "cloud-arrow-up": "cloud-upload",
        "patch-check-fill": "check-circle"
      };

      let baseName = phName;
      let style = "linear"; // Default Solar style is linear

      // 1. Check if the exact full name matches baseMapping first to prevent loss of suffixes
      if (baseMapping[phName]) {
        baseName = phName;
      } else {
        // Fallback: detect and strip explicit styles from phosphor icon name
        if (phName.endsWith("-fill") || phName.endsWith("-bold") || phName.endsWith("-logo")) {
          style = "bold";
          baseName = phName.replace(/-fill$|-bold$|-logo$/, "");
        } else if (phName.endsWith("-light") || phName.endsWith("-simple") || phName.endsWith("-regular")) {
          baseName = phName.replace(/-light$|-simple$|-regular$/, "");
        }
      }

      // If we have an exact style override for the original full phosphor icon name, use it
      if (styleOverrides[phName]) {
        style = styleOverrides[phName];
      }

      const solarName = baseMapping[baseName] || baseName;
      
      // Special mappings for direct overrides or non-linear styles
      if (solarName === "check-circle" && style === "linear") {
        mappedIcon = `solar:check-circle-linear`;
      } else if (solarName === "close-circle" && style === "linear") {
        mappedIcon = `solar:close-circle-linear`;
      } else if (solarName === "danger-circle" && style === "linear") {
        mappedIcon = `solar:danger-circle-linear`;
      } else {
        mappedIcon = `solar:${solarName}-${style}`;
      }
    }
  }

  return <IconifyIcon icon={mappedIcon} ref={ref} {...props} />;
});
