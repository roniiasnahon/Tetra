import React from "react";
import { motion } from "motion/react";
import { Icon } from "@iconify/react";

interface ChartModalProps {
  closeChartModal: () => void;
  chartType: "bar" | "line" | "pie";
  setChartType: (type: "bar" | "line" | "pie") => void;
  chartTitle: string;
  setChartTitle: (title: string) => void;
  colors?: string[];
  chartDataColor: string;
  setChartDataColor: (color: string) => void;
  chartLabels: string[];
  setChartLabels: (labels: string[]) => void;
  chartValues: (string | number)[];
  setChartValues: (values: any[]) => void;
  chartIndividualColors: string[];
  setChartIndividualColors: (colors: string[]) => void;
  handleInsertChart: () => void;
  chartBeingEdited: any;
}

export const ChartModal: React.FC<ChartModalProps> = ({
  closeChartModal,
  chartType,
  setChartType,
  chartTitle,
  setChartTitle,
  colors,
  chartDataColor,
  setChartDataColor,
  chartLabels,
  setChartLabels,
  chartValues,
  setChartValues,
  chartIndividualColors,
  setChartIndividualColors,
  handleInsertChart,
  chartBeingEdited,
}) => {
  const [openRowColorPickerIdx, setOpenRowColorPickerIdx] = React.useState<number | null>(null);

  return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#2d2d30] rounded-2xl w-full max-w-4xl p-6 relative text-zinc-300 flex flex-col max-h-[90vh]"
            >
              <button
                onClick={closeChartModal}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <Icon icon="ph:x" className="w-5 h-5" />
              </button>

              <div className="mb-4 text-left">
                <h3 className="text-sm font-semibold text-zinc-150 uppercase tracking-wider">Embed Chart/Graph</h3>
                <p className="text-xs text-zinc-500">Design and insert fully responsive data visualizations into your documents.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-1 flex-1">
                {/* Left side: Form Settings */}
                <div className="space-y-4 text-left">
                  {/* Chart Type Selector */}
                  <div>
                    <span className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Chart Type</span>
                    <div className="flex gap-4 border-b border-[#27272a] pb-2 px-0.5">
                      {[
                        { id: "bar", label: "Bar Chart", icon: "ph:chart-bar" },
                        { id: "line", label: "Line Chart", icon: "ph:chart-line" },
                        { id: "pie", label: "Doughnut", icon: "ph:chart-pie" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setChartType(t.id as any)}
                          className={`py-1 px-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border-b-2 -mb-[10px] ${
                            chartType === t.id
                              ? "border-zinc-250 text-white"
                              : "border-transparent text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <Icon icon={t.icon} className="w-3.5 h-3.5" />
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Chart Title</label>
                    <input
                      type="text"
                      value={chartTitle}
                      onChange={(e) => setChartTitle(e.target.value)}
                      placeholder="e.g. Sales Analysis"
                      className="w-full bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3.5 py-2 text-xs text-[#f4f4f5] outline-none transition-colors"
                    />
                  </div>

                  {/* Color Schemes */}
                  <div>
                    <span className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Color Scheme presets</span>
                    <div className="flex flex-wrap gap-2.5">
                      {[
                        { id: "multicolor", label: "Multicolor", colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"] },
                        { id: "blue", label: "Blue Slate", colors: ["#3b82f6"] },
                        { id: "emerald", label: "Emerald", colors: ["#10b981"] },
                        { id: "purple", label: "Amethyst", colors: ["#8b5cf6"] },
                        { id: "amber", label: "Amber", colors: ["#f59e0b"] },
                        { id: "rose", label: "Crimson", colors: ["#f43f5e"] },
                        { id: "cyan", label: "Cyan", colors: ["#06b6d4"] },
                        { id: "orange", label: "Sunset Orange", colors: ["#f97316"] },
                        { id: "pink", label: "Hot Pink", colors: ["#ec4899"] },
                        { id: "indigo", label: "Indigo Sky", colors: ["#6366f1"] },
                        { id: "slate", label: "Cool Slate", colors: ["#64748b"] },
                        { id: "forest", label: "Forest Green", colors: ["#22c55e"] }
                      ].map((scheme) => (
                        <button
                          key={scheme.id}
                          type="button"
                          title={scheme.label}
                          onClick={() => setChartDataColor(scheme.id)}
                          className={`flex items-center justify-center w-7 h-7 rounded-full transition-all cursor-pointer overflow-hidden ring-offset-2 ring-offset-[#121212] ${
                            chartDataColor === scheme.id
                              ? "ring-2 ring-zinc-400 scale-110"
                              : "ring-1 ring-[#27272a] hover:ring-zinc-500 hover:scale-105"
                          }`}
                        >
                          {scheme.id === "multicolor" ? (
                            <div className="w-full h-full" style={{ background: "conic-gradient(#10b981, #3b82f6, #8b5cf6, #f59e0b, #10b981)" }} />
                          ) : (
                            <div className="w-full h-full" style={{ backgroundColor: scheme.colors[0] }} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Data Series Fields */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider">Data Series ({chartLabels.length})</span>
                      <button
                        type="button"
                        onClick={() => {
                          setChartLabels([...chartLabels, `Group ${String.fromCharCode(65 + chartLabels.length)}`]);
                          setChartValues([...chartValues, 50]);
                          if (chartIndividualColors) {
                            setChartIndividualColors([...chartIndividualColors, ""]);
                          }
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white bg-[#1a1a1c] border border-[#27272a] px-2.5 py-1 rounded-lg transition-colors cursor-pointer mr-[34px]"
                      >
                        + Add Row
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                      {chartLabels.map((lbl, idx) => {
                        const schemeColors: Record<string, string[]> = {
                          multicolor: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#f97316", "#6366f1"],
                          emerald: ["#10b981", "#34d399", "#059669", "#a7f3d0", "#047857", "#065f46"],
                          blue: ["#3b82f6", "#60a5fa", "#2563eb", "#bfdbfe", "#1d4ed8", "#1e40af"],
                          purple: ["#8b5cf6", "#a78bfa", "#7c3aed", "#ddd6fe", "#6d28d9", "#5b21b6"],
                          amber: ["#f59e0b", "#fbbf24", "#d97706", "#fde68a", "#b45309", "#92400e"],
                          rose: ["#f43f5e", "#fb7185", "#e11d48", "#fecdd3", "#be123c", "#9f1239"],
                          cyan: ["#06b6d4", "#22d3ee", "#0891b2", "#cffafe", "#0e7490", "#155e75"],
                          orange: ["#f97316", "#fb923c", "#ea580c", "#ffedd5", "#c2410c", "#9a3412"],
                          pink: ["#ec4899", "#f472b6", "#db2777", "#fce7f3", "#be185d", "#9d174d"],
                          indigo: ["#6366f1", "#818cf8", "#4f46e5", "#e0e7ff", "#4338ca", "#3730a3"],
                          slate: ["#64748b", "#94a3b8", "#475569", "#f1f5f9", "#334155", "#1e293b"],
                          forest: ["#22c55e", "#4ade80", "#16a34a", "#dcfce7", "#15803d", "#14532d"]
                        };
                        const activeColors = schemeColors[chartDataColor] || schemeColors.blue;
                        const defaultRowColor = chartDataColor === "multicolor" ? activeColors[idx % activeColors.length] : activeColors[0];
                        const activeRowColor = (chartIndividualColors && chartIndividualColors[idx]) || defaultRowColor;

                        return (
                          <div key={idx} className="flex gap-2 items-center relative">
                            {/* Color Selector */}
                            <div className="relative shrink-0">
                              <button
                                type="button"
                                onClick={() => setOpenRowColorPickerIdx(openRowColorPickerIdx === idx ? null : idx)}
                                className="w-[26px] h-[26px] rounded-lg border border-[#27272a] hover:border-zinc-500 cursor-pointer flex items-center justify-center transition-all focus:outline-none"
                                style={{ backgroundColor: activeRowColor }}
                                title="Set Item Color"
                              >
                                <Icon icon="ph:paint-brush-broad" className="w-3.5 h-3.5 text-zinc-900 bg-white/80 p-0.5 rounded-md" />
                              </button>

                              {openRowColorPickerIdx === idx && (
                                <div className="absolute left-0 top-[32px] z-[150] bg-[#161618] border border-[#2d2d30] rounded-xl p-2.5 shadow-2xl w-44 flex flex-col gap-2">
                                  <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-left">Select Color</div>
                                  <div className="grid grid-cols-4 gap-1.5 justify-items-center">
                                    {[
                                      "#3b82f6", "#10b981", "#8b5cf6", "#ec4899",
                                      "#f59e0b", "#f43f5e", "#0ea5e9", "#eab308",
                                      "#f97316", "#6366f1", "#14b8a6", "#84cc16",
                                      "#22c55e", "#64748b", "#a1a1aa", "#ffffff"
                                    ].map((paletteColor) => (
                                      <button
                                        key={paletteColor}
                                        type="button"
                                        onClick={() => {
                                          const updatedColors = [...chartIndividualColors];
                                          while (updatedColors.length <= idx) {
                                            updatedColors.push("");
                                          }
                                          updatedColors[idx] = paletteColor;
                                          setChartIndividualColors(updatedColors);
                                          setOpenRowColorPickerIdx(null);
                                        }}
                                        className="w-5 h-5 rounded-md cursor-pointer border border-[#27272a] hover:scale-110 transition-transform block"
                                        style={{ backgroundColor: paletteColor }}
                                      />
                                    ))}
                                  </div>
                                  <div className="border-t border-[#27272a] pt-1.5 flex items-center justify-between gap-1">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase">Custom Pick</span>
                                    <input
                                      type="color"
                                      value={activeRowColor.startsWith("#") && activeRowColor.length === 7 ? activeRowColor : "#3b82f6"}
                                      onChange={(e) => {
                                        const updatedColors = [...chartIndividualColors];
                                        while (updatedColors.length <= idx) {
                                          updatedColors.push("");
                                        }
                                        updatedColors[idx] = e.target.value;
                                        setChartIndividualColors(updatedColors);
                                      }}
                                      className="w-7 h-5 bg-transparent border-none cursor-pointer outline-none rounded shrink-0 p-0"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedColors = [...chartIndividualColors];
                                      while (updatedColors.length <= idx) {
                                        updatedColors.push("");
                                      }
                                      updatedColors[idx] = "";
                                      setChartIndividualColors(updatedColors);
                                      setOpenRowColorPickerIdx(null);
                                    }}
                                    className="w-full text-center text-[9px] text-[#71717a] hover:text-white bg-zinc-805 hover:bg-zinc-800 py-1 rounded transition-colors"
                                  >
                                    Use Scheme Default
                                  </button>
                                </div>
                              )}
                            </div>

                            <span className="text-[10px] text-zinc-650 font-mono w-4 text-center">{idx + 1}</span>
                            <input
                              type="text"
                              value={lbl}
                              onChange={(e) => {
                                const updated = [...chartLabels];
                                updated[idx] = e.target.value;
                                setChartLabels(updated);
                              }}
                              className="flex-1 bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3 py-1.5 text-xs text-[#f4f4f5] outline-none transition-colors"
                              placeholder="Label"
                            />
                            <input
                              type="number"
                              value={chartValues[idx]}
                              onChange={(e) => {
                                const updated = [...chartValues];
                                const parsedVal = parseFloat(e.target.value);
                                updated[idx] = isNaN(parsedVal) ? 0 : parsedVal;
                                setChartValues(updated);
                              }}
                              className="w-20 bg-[#161616] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3 py-1.5 text-xs text-right text-[#f4f4f5] outline-none font-mono transition-colors"
                              placeholder="Value"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (chartLabels.length > 2) {
                                  setChartLabels(chartLabels.filter((_, i) => i !== idx));
                                  setChartValues(chartValues.filter((_, i) => i !== idx));
                                  if (chartIndividualColors) {
                                    setChartIndividualColors(chartIndividualColors.filter((_, i) => i !== idx));
                                  }
                                }
                              }}
                              disabled={chartLabels.length <= 2}
                              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 cursor-pointer transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
                            >
                              <Icon icon="ph:trash" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right side: Preview */}
                <div className="flex flex-col h-full text-left">
                  <span className="text-[10px] text-[#71717a] font-bold uppercase mb-1.5 block tracking-wider">Preview</span>
                  <div className="flex-1 bg-[#09090b] border border-[#27272a] rounded-2xl p-4 flex flex-col items-center justify-center min-h-[220px]">
                    {chartTitle && (
                      <div className="w-full text-center mb-3">
                        <span className="text-[11px] font-semibold text-zinc-450 uppercase tracking-wider font-sans">{chartTitle}</span>
                      </div>
                    )}
                    
                    {/* Render raw SVG dynamically based on inputs for preview */}
                    <div className="w-full max-w-[340px] md:max-w-full">
                      {(() => {
                        const vals = chartValues.map(v => {
                          const n = Number(v);
                          return isNaN(n) ? 0 : n;
                        });
                        const maxVal = Math.max(...vals, 1);
                        const width = 450;
                        const height = 240;

                        const schemeColors: Record<string, string[]> = {
                          multicolor: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#f97316", "#6366f1"],
                          emerald: ["#10b981", "#34d399", "#059669", "#a7f3d0", "#047857", "#065f46"],
                          blue: ["#3b82f6", "#60a5fa", "#2563eb", "#bfdbfe", "#1d4ed8", "#1e40af"],
                          purple: ["#8b5cf6", "#a78bfa", "#7c3aed", "#ddd6fe", "#6d28d9", "#5b21b6"],
                          amber: ["#f59e0b", "#fbbf24", "#d97706", "#fde68a", "#b45309", "#92400e"],
                          rose: ["#f43f5e", "#fb7185", "#e11d48", "#fecdd3", "#be123c", "#9f1239"],
                          cyan: ["#06b6d4", "#22d3ee", "#0891b2", "#cffafe", "#0e7490", "#155e75"],
                          orange: ["#f97316", "#fb923c", "#ea580c", "#ffedd5", "#c2410c", "#9a3412"],
                          pink: ["#ec4899", "#f472b6", "#db2777", "#fce7f3", "#be185d", "#9d174d"],
                          indigo: ["#6366f1", "#818cf8", "#4f46e5", "#e0e7ff", "#4338ca", "#3730a3"],
                          slate: ["#64748b", "#94a3b8", "#475569", "#f1f5f9", "#334155", "#1e293b"],
                          forest: ["#22c55e", "#4ade80", "#16a34a", "#dcfce7", "#15803d", "#14532d"]
                        };
                        const colors = schemeColors[chartDataColor] || schemeColors.blue;

                        if (chartType === "bar") {
                          const paddingLeft = 35;
                          const paddingRight = 10;
                          const paddingTop = 25;
                          const paddingBottom = 30;
                          const graphWidth = width - paddingLeft - paddingRight;
                          const graphHeight = height - paddingTop - paddingBottom;

                          return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                              {/* Grid lines */}
                              {[0, 1, 2, 3, 4].map((i) => {
                                const y = paddingTop + (graphHeight * i) / 4;
                                const gridVal = Math.round(maxVal - (maxVal * i) / 4);
                                return (
                                  <React.Fragment key={i}>
                                    <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#27272a" strokeDasharray="3,3" />
                                    <text x={paddingLeft - 6} y={y + 3} fill="#71717a" fontSize="9" textAnchor="end">{gridVal}</text>
                                  </React.Fragment>
                                );
                              })}

                              {/* Bars */}
                              {chartLabels.map((lbl, idx) => {
                                const val = vals[idx] || 0;
                                const barHeight = (val / maxVal) * graphHeight;
                                const x = paddingLeft + 15 + idx * ((graphWidth - 20) / chartLabels.length);
                                const y = paddingTop + graphHeight - barHeight;
                                const barWidth = Math.max(12, ((graphWidth - 20) / chartLabels.length) * 0.6);
                                const fill = (chartIndividualColors && chartIndividualColors[idx]) || (chartDataColor === "multicolor" ? colors[idx % colors.length] : colors[0]);

                                return (
                                  <g key={idx}>
                                    <rect x={x} y={y} width={barWidth} height={Math.max(2, barHeight)} rx="3" fill={fill} />
                                    <text x={x + barWidth / 2} y={y - 4} fill="#f4f4f5" fontSize="8" fontWeight="600" textAnchor="middle">{val}</text>
                                    <text x={x + barWidth / 2} y={paddingTop + graphHeight + 12} fill="#a1a1aa" fontSize="8" textAnchor="middle">{lbl}</text>
                                  </g>
                                );
                              })}
                            </svg>
                          );
                        } else if (chartType === "line") {
                          const paddingLeft = 35;
                          const paddingRight = 10;
                          const paddingTop = 25;
                          const paddingBottom = 30;
                          const graphWidth = width - paddingLeft - paddingRight;
                          const graphHeight = height - paddingTop - paddingBottom;
                          const stepX = chartLabels.length > 1 ? graphWidth / (chartLabels.length - 1) : graphWidth;

                          const pts = vals.map((val, idx) => {
                            const x = paddingLeft + idx * stepX;
                            const y = paddingTop + graphHeight - (val / maxVal) * graphHeight;
                            return { x, y, val, lbl: chartLabels[idx] };
                          });

                          let pathD = pts.length > 0 ? `M ${pts[0].x} ${pts[0].y}` : "";
                          let areaD = pts.length > 0 ? `M ${paddingLeft} ${paddingTop + graphHeight} L ${pts[0].x} ${pts[0].y}` : "";
                          for (let i = 1; i < pts.length; i++) {
                            pathD += ` L ${pts[i].x} ${pts[i].y}`;
                            areaD += ` L ${pts[i].x} ${pts[i].y}`;
                          }
                          if (pts.length > 0) {
                            areaD += ` L ${pts[pts.length - 1].x} ${paddingTop + graphHeight} Z`;
                          }

                          const stroke = colors[0];
                          const fillOpacity = chartDataColor === "multicolor" ? colors[1] || stroke : stroke;

                          return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                              {/* Grid lines */}
                              {[0, 1, 2, 3, 4].map((i) => {
                                const y = paddingTop + (graphHeight * i) / 4;
                                const gridVal = Math.round(maxVal - (maxVal * i) / 4);
                                return (
                                  <React.Fragment key={i}>
                                    <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#27272a" strokeDasharray="3,3" />
                                    <text x={paddingLeft - 6} y={y + 3} fill="#71717a" fontSize="9" textAnchor="end">{gridVal}</text>
                                  </React.Fragment>
                                );
                              })}

                              {/* Fill area */}
                              {pts.length > 0 && (
                                <path d={areaD} fill={fillOpacity} fillOpacity="0.12" />
                              )}
                              
                              {/* Line */}
                              {pts.length > 0 && (
                                <path d={pathD} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              )}

                              {/* Dots */}
                              {pts.map((pt, idx) => {
                                const ptColor = (chartIndividualColors && chartIndividualColors[idx]) || stroke;
                                return (
                                  <g key={idx}>
                                    <circle cx={pt.x} cy={pt.y} r={3.5} fill={ptColor} stroke="#121212" strokeWidth="1" />
                                    <text x={pt.x} y={pt.y - 6} fill="#f4f4f5" fontSize="8" fontWeight="600" textAnchor="middle">{pt.val}</text>
                                    <text x={pt.x} y={paddingTop + graphHeight + 12} fill="#a1a1aa" fontSize="8" textAnchor="middle">{pt.lbl}</text>
                                  </g>
                                );
                              })}
                            </svg>
                          );
                        } else {
                          // Pie/Doughnut Chart
                          const cx = 130;
                          const cy = 110;
                          const r = 70;
                          const cut = 40;
                          const totalVal = vals.reduce((a, b) => a + b, 0) || 1;
                          let cumulativeAngle = 0;

                          return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                              {chartLabels.map((lbl, idx) => {
                                const val = vals[idx] || 0;
                                const pct = val / totalVal;
                                const angle = pct * 360;

                                const rad1 = (cumulativeAngle - 90) * (Math.PI / 180);
                                const rad2 = (cumulativeAngle + angle - 90) * (Math.PI / 180);

                                const x1_out = cx + r * Math.cos(rad1);
                                const y1_out = cy + r * Math.sin(rad1);
                                const x2_out = cx + r * Math.cos(rad2);
                                const y2_out = cy + r * Math.sin(rad2);

                                const x1_in = cx + cut * Math.cos(rad1);
                                const y1_in = cy + cut * Math.sin(rad1);
                                const x2_in = cx + cut * Math.cos(rad2);
                                const y2_in = cy + cut * Math.sin(rad2);

                                const largeArc = angle > 180 ? 1 : 0;
                                const fill = (chartIndividualColors && chartIndividualColors[idx]) || colors[idx % colors.length];

                                let pathStr = "";
                                if (pct >= 0.999) {
                                  pathStr = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
                                } else {
                                  pathStr = `M ${x1_in} ${y1_in} L ${x1_out} ${y1_out} A ${r} ${r} 0 ${largeArc} 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${cut} ${cut} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z`;
                                }

                                const gElement = (
                                  <g key={idx}>
                                    {pct >= 0.999 ? (
                                      <>
                                        <circle cx={cx} cy={cy} r={r} fill="none" stroke={fill} strokeWidth={r - cut} />
                                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="transparent" strokeWidth="1.5" />
                                        <circle cx={cx} cy={cy} r={cut} fill="none" stroke="transparent" strokeWidth="1.5" />
                                      </>
                                    ) : (
                                      <path d={pathStr} fill={fill} stroke="transparent" strokeWidth="1.5" />
                                    )}
                                  </g>
                                );

                                cumulativeAngle += angle;
                                return gElement;
                              })}
                              {/* Center details */}
                              <circle cx={cx} cy={cy} r={cut - 2} fill="transparent" />
                              <text x={cx} y={cy - 2} fill="#71717a" fontSize="8" textAnchor="middle" fontWeight="600">TOTAL</text>
                              <text x={cx} y={cy + 9} fill="#f4f4f5" fontSize="11" textAnchor="middle" fontWeight="700">
                                {vals.reduce((a, b) => a + b, 0)}
                              </text>

                              {/* Legends */}
                              <g transform="translate(240, 25)">
                                {chartLabels.map((lbl, idx) => {
                                  const val = vals[idx] || 0;
                                  const pct = val / totalVal;
                                  const fill = (chartIndividualColors && chartIndividualColors[idx]) || colors[idx % colors.length];
                                  return (
                                    <g key={idx} transform={`translate(0, ${idx * 16})`}>
                                      <rect width="8" height="8" rx="2" fill={fill} />
                                      <text x="14" y="8" fill="#f4f4f5" fontSize="9" fontWeight="500">{lbl}</text>
                                      <text x="180" y="8" fill="#71717a" fontSize="9" textAnchor="end">{val} ({Math.round(pct * 100)}%)</text>
                                    </g>
                                  );
                                })}
                              </g>
                            </svg>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-[#2d2d30]">
                <button
                  onClick={closeChartModal}
                  className="px-4 py-2 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInsertChart}
                  className="px-5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  {chartBeingEdited ? "Update Chart" : "Insert Chart"}
                </button>
              </div>
            </motion.div>
          </motion.div>
  );
};
