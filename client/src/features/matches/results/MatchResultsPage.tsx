import React, { useMemo, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { ScoreSummary } from "./ScoreSummary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  ChevronLeft,
  FileText,
  Lock,
  RefreshCcw,
  Trophy,
  Printer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { ApiSuccess } from "@shared/contracts/api";
import { useToast } from "@/hooks/use-toast";

// -----------------------------------------------------------
// ТИПЫ
// -----------------------------------------------------------
export type MatchStatus = "draft" | "setup" | "digitalphase" | "physicalphase" | "finished" | "approved" | "locked";
type DbBool = boolean | 0 | 1 | null | undefined;

interface MatchPlayerDto {
  id: number;
  fullName?: string;
  displayName?: string;
  number?: number | null;
  jerseyNumber?: number | null;
  playedDigital?: DbBool;
  playedPhysical?: DbBool;
}

interface OfficialDto {
  id: number;
  fullName: string;
  role: string;
}

interface MatchTeamSlot {
  compTeam: {
    id: number;
    name: string;
    region: string | null;
    competitionId: number;
  };
  teamSlot: 1 | 2;
  digitalStartSide: string | null;
  physicalStartSide: string | null;
  players?: MatchPlayerDto[];
  officials?: OfficialDto[];
}

interface MatchDetail {
  match: {
    id: number;
    competitionId: number;
    status: MatchStatus;
    matchNumber: string | null;
    stage: string | null;
    expectedViewers: number | null;
    scheduledAt: string | null;
    scoreDigitalTeam1: number | null;
    scoreDigitalTeam2: number | null;
    scorePhysicalTeam1: number | null;
    scorePhysicalTeam2: number | null;
    scoreTotalTeam1: number | null;
    scoreTotalTeam2: number | null;
    winnerTeamId: number | null;
    
    substitutions?: Array<{ teamName?: string; playerOut?: string; playerIn?: string; time?: string }>;
    violations?: Array<{ type?: 'warning' | 'disqualification'; playerName?: string; teamName?: string; reason?: string; time?: string }>;
    staff?: Array<{ role: string; fullName: string }>;
  };
  teams: MatchTeamSlot[];
}

interface CompetitionTeamDto {
  id: number;
  name: string;
  region: string | null;
  players?: MatchPlayerDto[];
  officials?: OfficialDto[];
}

// -----------------------------------------------------------
// ХЕЛПЕРЫ ДЛЯ НОРМАЛИЗАЦИИ ДАННЫХ
// -----------------------------------------------------------
const toBool = (value: DbBool, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  return fallback;
};

const getPlayerName = (player?: MatchPlayerDto) =>
  player?.fullName?.trim() || player?.displayName?.trim() || "";

const normalizeOfficials = (officials?: OfficialDto[]) =>
  (officials ?? []).map((o) => ({
    id: o.id,
    fullName: o.fullName ?? "",
    role: o.role ?? "",
  }));

function mergeTeamSlot(slot: MatchTeamSlot | undefined, competitionTeams: CompetitionTeamDto[]) {
  if (!slot) {
    return {
      compTeam: { id: 0, name: "", region: "", competitionId: 0 },
      teamSlot: 1 as 1 | 2,
      digitalStartSide: null,
      physicalStartSide: null,
      players: [] as MatchPlayerDto[],
      officials: [] as OfficialDto[],
    };
  }

  const compTeamFallback = competitionTeams.find((t) => t.id === slot.compTeam.id);

  const rawPlayers = slot.players && slot.players.length > 0 ? slot.players : compTeamFallback?.players ?? [];
  const rawOfficials = slot.officials && slot.officials.length > 0 ? slot.officials : compTeamFallback?.officials ?? [];

  return {
    ...slot,
    compTeam: {
      id: slot.compTeam.id,
      name: slot.compTeam.name || compTeamFallback?.name || "",
      region: slot.compTeam.region ?? compTeamFallback?.region ?? "",
      competitionId: slot.compTeam.competitionId,
    },
    players: rawPlayers.map((p) => ({
      id: p.id,
      fullName: getPlayerName(p),
      number: p.number ?? p.jerseyNumber ?? null,
      playedDigital: p.playedDigital === undefined ? null : toBool(p.playedDigital, true),
      playedPhysical: p.playedPhysical === undefined ? null : toBool(p.playedPhysical, true),
    })),
    officials: normalizeOfficials(rawOfficials),
  };
}

// -----------------------------------------------------------
// КОНФИГ СТАТУСОВ
// -----------------------------------------------------------
const MATCH_STATUS_CONFIG: Record<MatchStatus, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "bg-muted/50 text-muted-foreground" },
  setup: { label: "Настройка", className: "bg-blue-500/15 text-blue-400" },
  digitalphase: { label: "Цифровой этап", className: "bg-purple-500/15 text-purple-400" },
  physicalphase: { label: "Физический этап", className: "bg-yellow-500/15 text-yellow-400" },
  finished: { label: "Завершён", className: "bg-green-500/15 text-green-400" },
  approved: { label: "Утверждён", className: "bg-primary/15 text-primary" },
  locked: { label: "Заблокирован", className: "bg-orange-500/15 text-orange-400" },
};

function SectionHeader({ icon: Icon, title, count }: { icon: any; title: string; count?: number; }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {typeof count === "number" && <Badge variant="secondary" className="text-xs">{count}</Badge>}
    </div>
  );
}

function MarkCell({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <button type="button" onClick={() => setChecked((v) => !v)} className="w-full min-h-[24px] flex items-center justify-center text-base font-bold outline-none hover:bg-gray-100 transition-colors">
      {checked ? "✓" : ""}
    </button>
  );
}

// -----------------------------------------------------------
// КОМПОНЕНТ РЕДАКТОРА ПРОТОКОЛОВ (ПЕЧАТЬ PDF)
// -----------------------------------------------------------
// -----------------------------------------------------------
// КОМПОНЕНТ РЕДАКТОРА ПРОТОКОЛОВ (ПЕЧАТЬ PDF)
// -----------------------------------------------------------
// -----------------------------------------------------------
// КОМПОНЕНТ РЕДАКТОРА ПРОТОКОЛОВ (ПЕЧАТЬ PDF)
// -----------------------------------------------------------
// -----------------------------------------------------------
// КОМПОНЕНТ РЕДАКТОРА ПРОТОКОЛОВ (ПЕЧАТЬ PDF)
// -----------------------------------------------------------
function ProtocolEditor({ match, team1Slot, team2Slot, competition, digitalRounds, physicalRounds, onClose }: any) {
  const [activeTab, setActiveTab] = useState('title');

  let matchTime = "";
  let matchDate = new Date().toLocaleDateString("ru-RU");
  if (match?.scheduledAt) {
    const d = new Date(match.scheduledAt);
    matchTime = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    matchDate = d.toLocaleDateString("ru-RU");
  }

  const t1Name = team1Slot?.compTeam?.name || "Команда 1";
  const t2Name = team2Slot?.compTeam?.name || "Команда 2";
  const t1Id = team1Slot?.compTeam?.id;
  const t2Id = team2Slot?.compTeam?.id;

  const pageRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    if (!pageRef.current) return;

    const mod = await import("html2pdf.js");
    const html2pdf = (mod as any).default ?? (mod as any);

    const tabLabels: Record<string, string> = {
      title: "Титульный_лист",
      judges: "Судьи",
      matchflow: "Ход_матча",
      summary: "Итоги",
    };

    html2pdf()
      .set({
        margin: [8, 8, 10, 8],
        filename: `Протокол_${match?.matchNumber || match?.id || "матч"}_${tabLabels[activeTab] || activeTab}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          windowWidth: 794,
          backgroundColor: "#ffffff",
          onclone: (_doc: Document, el: HTMLElement) => {
            // ============================================================
            //  1. НОРМАЛИЗАЦИЯ КОРНЕВОГО КОНТЕЙНЕРА
            //  - фиксируем точную ширину листа
            //  - сбрасываем min-height (иначе первая страница пустая)
            //  - убираем shadow/padding под PDF-режим (у нас есть jsPDF margin)
            // ============================================================
            el.style.width = "210mm";
            el.style.maxWidth = "210mm";
            el.style.minHeight = "0";
            el.style.height = "auto";
            el.style.padding = "0";
            el.style.margin = "0";
            el.style.boxShadow = "none";
            el.style.boxSizing = "border-box";
            el.style.background = "#ffffff";
            el.style.overflow = "visible";

            // ============================================================
            //  2. ГЛОБАЛЬНЫЕ СТИЛИ ДЛЯ PDF
            //  Официальный документ: белый фон, чёрные рамки, без раскрасок
            // ============================================================
            const style = document.createElement("style");
            style.textContent = `
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-shadow: none !important;
              }
              /* Гасим все цветные фоны — официальный документ всегда белый */
              [class*="bg-gray"], [class*="bg-blue"], [class*="bg-slate"],
              [class*="bg-zinc"], [class*="bg-neutral"], [class*="bg-stone"],
              [class*="bg-red"], [class*="bg-green"], [class*="bg-yellow"],
              [class*="bg-amber"], [class*="bg-orange"], [class*="bg-purple"],
              [class*="bg-pink"], [class*="bg-indigo"], [class*="bg-cyan"],
              [class*="bg-teal"], [class*="bg-sky"], [class*="bg-emerald"],
              [class*="bg-lime"], [class*="bg-rose"], [class*="bg-violet"],
              [class*="bg-fuchsia"] {
                background-color: #ffffff !important;
                background-image: none !important;
              }
              /* Шапки таблиц — тонкий нейтральный фон для читаемости */
              thead, thead th, thead td, tr.bg-gray-100, tr.bg-gray-50 {
                background-color: #f4f4f4 !important;
              }
              /* Дополнительная зачистка: инлайновые фоны и градиенты */
              [style*="background"] {
                background-image: none !important;
              }
              /* Цветные рамки → чёрные */
              [class*="border-blue"], [class*="border-red"],
              [class*="border-green"], [class*="border-yellow"] {
                border-color: #000000 !important;
              }
              /* Текст — всегда чёрный */
              body, div, span, p, td, th, h1, h2, h3, h4, h5, h6, strong, b {
                color: #000000 !important;
              }
              /* Таблицы */
              table {
                width: 100% !important;
                border-collapse: collapse !important;
                page-break-inside: auto;
              }
              tr {
                page-break-inside: avoid !important;
                page-break-after: auto;
              }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              /* ВАЖНО: vertical-align работает только для inline-контента.
                 Поэтому делаем САМИ ячейки flex-контейнерами с центрированием.
                 Тогда div/span/наш .pdf-cell-text внутри встанут ровно по центру. */
              td, th {
                vertical-align: middle !important;
                padding: 4px 6px !important;
                word-wrap: break-word;
                overflow-wrap: break-word;
                hyphens: auto;
                overflow: hidden !important;
              }
              /* Главный фикс «плавающего» текста: содержимое ячейки центруется flex'ом */
              td > *, th > * {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
                min-height: 100% !important;
                margin: 0 !important;
                box-sizing: border-box !important;
              }
              /* Прямые текстовые узлы и наши span'ы из input/textarea */
              .pdf-cell-text {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
                min-height: 100% !important;
                line-height: 1.3 !important;
              }
              /* Левое выравнивание сохраняем там, где в исходнике явно указан text-left */
              td.text-left > *, th.text-left > *,
              td[class*="text-left"] > *, th[class*="text-left"] > *,
              .pdf-align-left {
                justify-content: flex-start !important;
                text-align: left !important;
              }
              td.text-right > *, th.text-right > *,
              td[class*="text-right"] > *, th[class*="text-right"] > * {
                justify-content: flex-end !important;
                text-align: right !important;
              }
              /* Заголовки не отрываются от следующего блока */
              h1, h2, h3, h4, .pdf-keep-with-next {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
              /* Подавляем эффекты hover/focus в клоне */
              *:hover, *:focus { background-color: inherit !important; }
            `;
            el.prepend(style);

            // ============================================================
            //  3. Помечаем заголовки разделов (болд текст перед таблицей)
            //  чтобы они не отрывались от таблицы при переносе страницы
            // ============================================================
            el.querySelectorAll<HTMLElement>('div').forEach((d) => {
              const next = d.nextElementSibling as HTMLElement | null;
              const cls = d.className || "";
              if (
                typeof cls === "string" &&
                /font-bold|text-center/.test(cls) &&
                next &&
                next.tagName === "TABLE"
              ) {
                d.classList.add("pdf-keep-with-next");
              }
            });

            // ============================================================
            //  4. INPUT → SPAN — flex-центрирование, выравнивание по исходному text-align
            // ============================================================
            el.querySelectorAll("input").forEach((inp) => {
              const input = inp as HTMLInputElement;
              const cs = window.getComputedStyle(input);
              const align = cs.textAlign || "center";
              const justify =
                align === "left" ? "flex-start"
                : align === "right" ? "flex-end"
                : "center";
              const span = document.createElement("span");
              span.className = "pdf-cell-text" + (align === "left" ? " pdf-align-left" : "");
              span.textContent = input.value || input.placeholder || "";
              span.style.cssText = [
                "display:flex",
                "align-items:center",
                `justify-content:${justify}`,
                "width:100%",
                "min-height:100%",
                `text-align:${align}`,
                `font-family:${cs.fontFamily}`,
                `font-size:${cs.fontSize}`,
                `font-weight:${cs.fontWeight}`,
                `text-transform:${cs.textTransform}`,
                "color:#000",
                "line-height:1.3",
                "padding:0",
                "margin:0",
                "background:transparent",
                "border:none",
              ].join(";");
              input.replaceWith(span);
            });

            // ============================================================
            //  5. TEXTAREA → SPAN — flex-центрирование с переносами
            // ============================================================
            el.querySelectorAll("textarea").forEach((ta) => {
              const area = ta as HTMLTextAreaElement;
              const cs = window.getComputedStyle(area);
              const align = cs.textAlign || "left";
              const justify =
                align === "left" ? "flex-start"
                : align === "right" ? "flex-end"
                : "center";
              const span = document.createElement("span");
              span.className = "pdf-cell-text" + (align === "left" ? " pdf-align-left" : "");
              span.textContent = area.value || area.placeholder || "";
              span.style.cssText = [
                "display:flex",
                "align-items:center",
                `justify-content:${justify}`,
                "width:100%",
                "min-height:100%",
                "white-space:pre-wrap",
                `text-align:${align}`,
                `font-family:${cs.fontFamily}`,
                `font-size:${cs.fontSize}`,
                `font-weight:${cs.fontWeight}`,
                `text-transform:${cs.textTransform}`,
                "color:#000",
                "line-height:1.3",
                "padding:0",
                "margin:0",
                "background:transparent",
                "border:none",
              ].join(";");
              area.replaceWith(span);
            });

            // ============================================================
            //  6. Скрываем всё служебное (кнопки, вкладки, панель управления)
            // ============================================================
            el.querySelectorAll<HTMLElement>(".print\\:hidden").forEach((n) => {
              n.style.display = "none";
            });
          },
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        // Режим переносов: уважаем CSS-правила, legacy-режим для совместимости,
        // и избегаем разрывов внутри строк/заголовков
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr", "thead", "h1", "h2", "h3", ".pdf-keep-with-next"] },
      })
      .from(pageRef.current)
      .save();
  };
  // --- АВТОМАТИЧЕСКИЙ ПОДСЧЕТ СТАТИСТИКИ ИЗ РАУНДОВ ---
  const safeDigital = Array.isArray(digitalRounds) ? digitalRounds : [];
  const safePhysical = Array.isArray(physicalRounds) ? physicalRounds : [];

  const calcStatsFromRounds = (teamNumber: 1 | 2) => {
    let stats = { frags: 0, deaths: 0, acp: 0, pcp: 0, dcp: 0 };
    const allRounds = [...safeDigital, ...safePhysical];
    if (allRounds.length === 0) return stats;

    allRounds.forEach((r: any) => {
      if (teamNumber === 1) {
        stats.frags += (r.fragsTeam1 || 0);
        stats.deaths += (r.fragsTeam2 || 0);
      } else {
        stats.frags += (r.fragsTeam2 || 0);
        stats.deaths += (r.fragsTeam1 || 0);
      }

      const isT1Attack = r.team1Side === "attack";
      const teamWasAttack = (teamNumber === 1 && isT1Attack) || (teamNumber === 2 && !isT1Attack);
      const teamWasDefense = (teamNumber === 1 && !isT1Attack) || (teamNumber === 2 && isT1Attack);

      if (r.status === "completed") {
        if (r.activation && teamWasAttack) stats.acp += 1;
        if (r.explosion && teamWasAttack) stats.pcp += 1;
        if (r.deactivation && teamWasDefense) stats.dcp += 1;
      }
    });

    return stats;
  };

  const t1Stats = calcStatsFromRounds(1);
  const t2Stats = calcStatsFromRounds(2);

  const subs = match?.substitutions || [];
  const warnings = match?.violations?.filter((v: any) => v.type === 'warning') || [];
  const dqs = match?.violations?.filter((v: any) => v.type === 'disqualification') || [];
  
  const matchJudge = match?.staff?.find((s: any) => s.role === 'match_judge')?.fullName || "";
  const digitalJudge = match?.staff?.find((s: any) => s.role === 'digital_judge')?.fullName || "";
  const physicalJudge = match?.staff?.find((s: any) => s.role === 'physical_judge')?.fullName || "";
  const secretary = match?.staff?.find((s: any) => s.role === 'secretary')?.fullName || "";

  const getRepresentative = (team: any) => {
    const rep = team?.officials?.find((o: any) => o.role?.toLowerCase().includes("представитель"));
    return rep?.fullName || "";
  };
  const t1Rep = getRepresentative(team1Slot);
  const t2Rep = getRepresentative(team2Slot);


  const renderEmptyRows = (count: number, startIdx: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <tr key={`empty-${i}`}>
        <td className="border border-black py-1 px-1 text-center text-[12px]">{startIdx + i}</td>
        <td className="border border-black py-1 px-2"><input type="text" className="w-full bg-transparent outline-none text-[12px]" /></td>
        <td className="border border-black py-1 px-1 text-center"><MarkCell defaultChecked={false} /></td>
        <td className="border border-black py-1 px-1 text-center"><MarkCell defaultChecked={false} /></td>
      </tr>
    ));
  };

  const renderOfficials = (officials: OfficialDto[] = []) => {
    const rows = [];
    const source = officials.length ? officials : [
      { id: -1, fullName: "", role: "Тренер" },
      { id: -2, fullName: "", role: "Представитель" },
    ];

    for (let i = 0; i < Math.max(2, source.length); i++) {
      const off = source[i] ?? { id: -(i + 1), fullName: "", role: "" };
      rows.push(
        <tr key={off.id}>
          <td className="border border-black py-1 px-1 text-center text-[12px]">{i + 1}</td>
          <td colSpan={2} className="border border-black py-1 px-2">
            <input type="text" defaultValue={off.fullName || ""} placeholder={i === 0 ? "ФИО тренера" : "ФИО представителя"} className="w-full bg-transparent outline-none text-[12px]" />
          </td>
          <td className="border border-black py-1 px-2">
            <input type="text" defaultValue={off.role || ""} className="w-full text-center bg-transparent outline-none text-[12px]" />
          </td>
        </tr>
      );
    }
    return rows;
  };

  // --- ХЕЛПЕРЫ ДЛЯ ХОДА МАТЧА ---
  const getRoundRowData = (roundNumber: number, roundsArray: any[]) => {
    const r = roundsArray.find(x => x.roundNumber === roundNumber);
    if (!r || r.status !== "completed") {
      return { t1A: "", t1P: "", t1D: "", t1O: "", t2A: "", t2P: "", t2D: "", t2O: "", t1Side: "", t2Side: "" };
    }

    const isT1Attack = r.team1Side === "attack";
    const t1Wins = r.winnerTeamId === t1Id;
    const t2Wins = r.winnerTeamId === t2Id;

    return {
      t1Side: isT1Attack ? "ATK" : "DEF",
      t2Side: !isT1Attack ? "ATK" : "DEF",
      t1A: (r.activation && isT1Attack) ? "1" : "",
      t1P: (r.explosion && isT1Attack) ? "1" : "",
      t1D: (r.deactivation && !isT1Attack) ? "1" : "",
      t1O: t1Wins ? "1" : "0",
      t2A: (r.activation && !isT1Attack) ? "1" : "",
      t2P: (r.explosion && !isT1Attack) ? "1" : "",
      t2D: (r.deactivation && isT1Attack) ? "1" : "",
      t2O: t2Wins ? "1" : "0",
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-200 overflow-y-auto flex flex-col">
      <style>{`@media print { @page { size: A4; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      
      {/* ПАНЕЛЬ УПРАВЛЕНИЯ (ИСПРАВЛЕННАЯ) */}
      <div className="print:hidden bg-white border-b shadow-md p-4 flex items-center justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button onClick={onClose} variant="ghost" className="text-gray-700 hover:text-black hover:bg-gray-100 font-medium">
            <ChevronLeft className="w-5 h-5 mr-1" /> Назад к матчу
          </Button>
          
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button 
              onClick={() => setActiveTab('title')} 
              className={cn("px-4 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'title' ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black")}
            >
              Титульный лист
            </button>
            <button 
              onClick={() => setActiveTab('judges')} 
              className={cn("px-4 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'judges' ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black")}
            >
              Судьи
            </button>
            <button 
              onClick={() => setActiveTab('matchflow')} 
              className={cn("px-4 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'matchflow' ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black")}
            >
              Ход матча
            </button>
            <button 
              onClick={() => setActiveTab('summary')} 
              className={cn("px-4 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'summary' ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black")}
            >
              Итоги
            </button>
          </div>
        </div>
        
        {/* КНОПКА СКАЧИВАНИЯ PDF (через системный принт диалог) */}
        <Button onClick={handleDownloadPdf} className="gap-2 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
  <FileText className="w-4 h-4" /> 
  Скачать PDF
</Button>
      </div>

      {/* ЛИСТ А4 */}
      <div className="flex-1 py-8 print:py-0 flex justify-center">
        <div ref={pageRef} className="bg-white w-[210mm] min-h-[297mm] shadow-lg print:shadow-none p-[10mm] print:p-0 font-sans text-black box-border relative">
          
          {/* ---- ВКЛАДКА 1: ТИТУЛЬНЫЙ ЛИСТ ---- */}
          {activeTab === 'title' && (
            <div className="w-full">
              <div className="text-center font-bold mb-4 border-[3px] border-blue-800 p-2">
                <div className="text-lg mb-1">ПРОТОКОЛ МАТЧА</div>
                <textarea rows={2} defaultValue={competition?.name || "НАЗВАНИЕ СОРЕВНОВАНИЯ"} className="w-full text-center bg-transparent outline-none uppercase text-base leading-tight resize-none font-bold overflow-hidden" />
                <input type="text" defaultValue="ДИСЦИПЛИНА «Двоеборье - тактическая стрельба»" className="w-full text-center bg-transparent outline-none uppercase text-sm mt-1 font-bold" />
                <input type="text" defaultValue="ВИД ПРОГРАММЫ «CS2 + ЛАЗЕРТАГ»" className="w-full text-center bg-transparent outline-none uppercase text-sm mt-0.5 font-bold" />
              </div>

              <table className="w-full border-collapse border border-black mb-4 text-[13px] text-center">
                <tbody>
                  <tr>
                    <td className="border border-black p-1.5 font-semibold w-[150px] text-left">Адрес:</td>
                    <td colSpan={2} className="border border-black p-1.5 text-left"><input type="text" defaultValue={competition?.venue || ""} placeholder="Место проведения" className="w-full bg-transparent outline-none" /></td>
                    <td className="border border-black p-1.5 w-[120px]"><input type="text" defaultValue={matchDate} placeholder="ДД.ММ.ГГГГ" className="w-full text-center bg-transparent outline-none" /></td>
                  </tr>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="border border-black p-1">Время начала матча</td>
                    <td className="border border-black p-1">Стадия Соревнования</td>
                    <td colSpan={2} className="border border-black p-1">Количество зрителей</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1"><input type="text" defaultValue={matchTime} placeholder="ЧЧ:ММ" className="w-full text-center bg-transparent outline-none" /></td>
                    <td className="border border-black p-1"><input type="text" defaultValue={match?.stage || match?.matchNumber || `Матч ${match?.id}`} className="w-full text-center bg-transparent outline-none" /></td>
                    <td colSpan={2} className="border border-black p-1"><input type="text" defaultValue={match?.expectedViewers || ""} placeholder="-" className="w-full text-center bg-transparent outline-none" /></td>
                  </tr>
                </tbody>
              </table>

              <div className="flex gap-4">
                {/* ЗАЯВКА КОМАНДЫ 1 */}
                <div className="w-1/2">
                  <div className="font-bold text-center bg-gray-200 border border-black py-0.5 uppercase text-[12px] border-b-0">Заявка Команды 1</div>
                  <table className="w-full border-collapse border border-black mb-4 text-[11px] text-center">
                    <thead>
                      <tr className="bg-gray-100">
                        <th colSpan={2} className="border border-black p-1 font-semibold w-1/2">Название команды</th>
                        <th colSpan={2} className="border border-black p-1 font-semibold w-1/2">Регион</th>
                      </tr>
                      <tr>
                        <th colSpan={2} className="border border-black p-1 font-bold text-sm"><input type="text" defaultValue={team1Slot.compTeam.name} className="w-full text-center bg-transparent outline-none font-bold" /></th>
                        <th colSpan={2} className="border border-black p-1"><input type="text" defaultValue={team1Slot.compTeam.region || ""} placeholder="Регион" className="w-full text-center bg-transparent outline-none" /></th>
                      </tr>
                      <tr className="bg-gray-100 leading-tight">
                        <th className="border border-black p-1 w-6">№</th>
                        <th className="border border-black p-1">Ф.И.О</th>
                        <th className="border border-black p-1 w-16">Цифр.<br/>этап</th>
                        <th className="border border-black p-1 w-16">Физ.<br/>этап</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team1Slot.players?.slice(0, 7).map((p: any, idx: number) => (
                        <tr key={p.id || idx}>
                          <td className="border border-black py-1 px-1">{idx + 1}</td>
                          <td className="border border-black py-1 px-2 text-left"><input type="text" defaultValue={p.fullName || ""} className="w-full bg-transparent outline-none text-[11px]" /></td>
                          <td className="border border-black py-1 px-1 font-bold border-collapse p-0"><MarkCell defaultChecked={toBool(p.playedDigital, true)} /></td>
                          <td className="border border-black py-1 px-1 font-bold border-collapse p-0"><MarkCell defaultChecked={toBool(p.playedPhysical, true)} /></td>
                        </tr>
                      ))}
                      {renderEmptyRows(Math.max(0, 7 - (team1Slot.players?.length || 0)), (team1Slot.players?.length || 0) + 1)}
                      <tr className="bg-gray-200 font-semibold"><td colSpan={4} className="border border-black p-1">Официальные лица команды</td></tr>
                      <tr className="bg-gray-100 font-semibold"><td className="border border-black p-1">№</td><td colSpan={2} className="border border-black p-1">ФИО</td><td className="border border-black p-1">Должн.</td></tr>
                      {renderOfficials(team1Slot.officials)}
                      <tr className="bg-gray-200">
                        <td colSpan={2} className="border border-black p-1.5 font-bold text-center">Представитель</td>
                        <td className="border border-black p-1.5 text-center text-[10px] text-gray-600">Подпись</td>
                        <td className="border border-black p-1.5 text-center text-[10px] text-gray-600">ФИО</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ЗАЯВКА КОМАНДЫ 2 */}
                <div className="w-1/2">
                  <div className="font-bold text-center bg-gray-200 border border-black py-0.5 uppercase text-[12px] border-b-0">Заявка Команды 2</div>
                  <table className="w-full border-collapse border border-black text-[11px] text-center">
                    <thead>
                      <tr className="bg-gray-100">
                        <th colSpan={2} className="border border-black p-1 font-semibold w-1/2">Название команды</th>
                        <th colSpan={2} className="border border-black p-1 font-semibold w-1/2">Регион</th>
                      </tr>
                      <tr>
                        <th colSpan={2} className="border border-black p-1 font-bold text-sm"><input type="text" defaultValue={team2Slot.compTeam.name} className="w-full text-center bg-transparent outline-none font-bold" /></th>
                        <th colSpan={2} className="border border-black p-1"><input type="text" defaultValue={team2Slot.compTeam.region || ""} placeholder="Регион" className="w-full text-center bg-transparent outline-none" /></th>
                      </tr>
                      <tr className="bg-gray-100 leading-tight">
                        <th className="border border-black p-1 w-6">№</th>
                        <th className="border border-black p-1">Ф.И.О</th>
                        <th className="border border-black p-1 w-16">Цифр.<br/>этап</th>
                        <th className="border border-black p-1 w-16">Физ.<br/>этап</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team2Slot.players?.slice(0, 7).map((p: any, idx: number) => (
                        <tr key={p.id || idx}>
                          <td className="border border-black py-1 px-1">{idx + 1}</td>
                          <td className="border border-black py-1 px-2 text-left"><input type="text" defaultValue={p.fullName || ""} className="w-full bg-transparent outline-none text-[11px]" /></td>
                          <td className="border border-black py-1 px-1 font-bold border-collapse p-0"><MarkCell defaultChecked={toBool(p.playedDigital, true)} /></td>
                          <td className="border border-black py-1 px-1 font-bold border-collapse p-0"><MarkCell defaultChecked={toBool(p.playedPhysical, true)} /></td>
                        </tr>
                      ))}
                      {renderEmptyRows(Math.max(0, 7 - (team2Slot.players?.length || 0)), (team2Slot.players?.length || 0) + 1)}
                      <tr className="bg-gray-200 font-semibold"><td colSpan={4} className="border border-black p-1">Официальные лица команды</td></tr>
                      <tr className="bg-gray-100 font-semibold"><td className="border border-black p-1">№</td><td colSpan={2} className="border border-black p-1">ФИО</td><td className="border border-black p-1">Должн.</td></tr>
                      {renderOfficials(team2Slot.officials)}
                      <tr className="bg-gray-200">
                        <td colSpan={2} className="border border-black p-1.5 font-bold text-center">Представитель</td>
                        <td className="border border-black p-1.5 text-center text-[10px] text-gray-600">Подпись</td>
                        <td className="border border-black p-1.5 text-center text-[10px] text-gray-600">ФИО</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---- ВКЛАДКА 2: СУДЬИ ---- */}
          {activeTab === 'judges' && (
            <div className="w-full h-full flex flex-col pt-8">
              <div className="text-center font-bold text-[22px] mb-2">Состав судейской бригады</div>
              <table className="w-full border-collapse border border-black text-[14px] text-center mb-10">
                <thead>
                  <tr className="bg-[#E5E7EB] font-bold">
                    <td className="border border-black p-2 w-[35%]">Должность</td>
                    <td className="border border-black p-2 w-[65%]">ФИО</td>
                  </tr>
                </thead>
                <tbody>
                  {[
                    "Заместитель главного судьи",
                    "Главный секретарь",
                    "Секретарь",
                    "Матчевый судья",
                    "Судья цифрового гейма",
                    "Судья цифрового гейма",
                    "Судья функционального гейма",
                    "Судья функционального гейма",
                    "Судья функционального гейма",
                    "Судья функционального гейма",
                    "Технический судья"
                  ].map((role, i) => (
                    <tr key={i}>
                      <td className="border border-black py-1.5 px-3 text-left bg-[#E5E7EB]">{role}</td>
                      <td className="border border-black py-1.5 px-2"><input type="text" className="w-full bg-transparent outline-none text-left" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-center font-bold text-[22px] mb-2">Выбор карты</div>
              <table className="w-full border-collapse border border-black text-[14px] text-center mb-10">
                <thead>
                  <tr className="font-bold">
                    <td className="border border-black p-2 w-[33%]"><input type="text" defaultValue={t1Name} className="w-full text-center bg-transparent outline-none font-bold" /></td>
                    <td className="border border-black p-2 w-[34%]">Бан и пик карт</td>
                    <td className="border border-black p-2 w-[33%]"><input type="text" defaultValue={t2Name} className="w-full text-center bg-transparent outline-none font-bold" /></td>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { map: "Ancient", t1: "", t2: "Ban 6" },
                    { map: "Dust 2", t1: "", t2: "Pick" },
                    { map: "Inferno", t1: "Ban 3", t2: "" },
                    { map: "Mirage", t1: "", t2: "Ban 2" },
                    { map: "Nuke", t1: "Ban 1", t2: "" },
                    { map: "Overpass", t1: "", t2: "Ban 4" },
                    { map: "Anubis", t1: "Ban 5", t2: "" }
                  ].map((row, i) => (
                    <tr key={i}>
                      <td className="border border-black py-1 px-2"><input type="text" defaultValue={row.t1} className="w-full text-center bg-transparent outline-none" /></td>
                      <td className="border border-black py-1 font-bold">{row.map}</td>
                      <td className="border border-black py-1 px-2"><input type="text" defaultValue={row.t2} className="w-full text-center bg-transparent outline-none" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="w-full border-collapse border border-black text-[14px] text-center">
                <thead>
                  <tr className="bg-[#E5E7EB] font-bold">
                    <td className="border border-black p-2 w-[35%]">Должность</td>
                    <td className="border border-black p-2 w-[20%]">Подпись</td>
                    <td className="border border-black p-2 w-[45%]">ФИО</td>
                  </tr>
                </thead>
                <tbody>
                  {[
                    "Матчевый судья",
                    "Судья цифрового гейма",
                    "Судья функционального гейма",
                    "Главный секретарь / Секретарь"
                  ].map((role, i) => (
                    <tr key={i} className="font-bold">
                      <td className="border border-black py-2 px-3 bg-[#E5E7EB] text-left">{role}</td>
                      <td className="border border-black py-2 px-2"></td>
                      <td className="border border-black py-2 px-2 font-normal"><input type="text" className="w-full text-left bg-transparent outline-none" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ---- НОВАЯ ВКЛАДКА: ХОД МАТЧА ---- */}
          {activeTab === 'matchflow' && (
            <div className="w-full h-full flex flex-col pt-8">
              <table className="w-full border-collapse border border-black text-[12px] text-center mb-6">
                <thead>
                  <tr>
                    <td colSpan={18} className="border border-black text-[#000] text-[18px] py-1 font-bold border-t-[4px] border-t-[#2F5597]">Ход матча</td>
                  </tr>
                  <tr>
                    <td colSpan={18} className="border border-black text-[14px] font-bold py-1 bg-white">Стартовые стороны:</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border border-black font-bold py-1 text-left px-2">Атака</td>
                    <td colSpan={16} className="border border-black py-1 text-left px-2"><input type="text" className="w-full bg-transparent outline-none" placeholder="Команда" /></td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border border-black font-bold py-1 text-left px-2">Защита:</td>
                    <td colSpan={16} className="border border-black py-1 text-left px-2"><input type="text" className="w-full bg-transparent outline-none" placeholder="Команда" /></td>
                  </tr>

                  <tr className="bg-black text-white h-2"><td colSpan={18}></td></tr>
                  <tr>
                    <td colSpan={9} className="border border-black font-bold py-1 text-[13px]">Цифровой сегмент</td>
                    <td colSpan={9} className="border border-black font-bold py-1 text-[13px]">Физический сегмент</td>
                  </tr>

                  <tr className="bg-white">
                    <td colSpan={4} className="border border-black font-bold py-2 px-1"><input type="text" defaultValue={t1Name} className="w-full text-center bg-transparent outline-none font-bold" /></td>
                    <td colSpan={1} className="border border-black text-[10px] leading-tight px-1">Команда</td>
                    <td colSpan={4} className="border border-black font-bold py-2 px-1"><input type="text" defaultValue={t2Name} className="w-full text-center bg-transparent outline-none font-bold" /></td>

                    <td colSpan={4} className="border border-black font-bold py-2 px-1"><input type="text" defaultValue={t1Name} className="w-full text-center bg-transparent outline-none font-bold" /></td>
                    <td colSpan={1} className="border border-black text-[10px] leading-tight px-1">Команда</td>
                    <td colSpan={4} className="border border-black font-bold py-2 px-1"><input type="text" defaultValue={t2Name} className="w-full text-center bg-transparent outline-none font-bold" /></td>
                  </tr>

                  <tr className="font-bold text-[11px] leading-none">
                    <td colSpan={4} className="border border-black border-b-0 pt-1">ЗАЩИТА</td>
                    <td colSpan={1} rowSpan={2} className="border border-black text-[10px] font-normal uppercase">СТОРОНА</td>
                    <td colSpan={4} className="border border-black border-b-0 pt-1">АТАКА</td>

                    <td colSpan={4} className="border border-black border-b-0 pt-1">ЗАЩИТА</td>
                    <td colSpan={1} rowSpan={2} className="border border-black text-[10px] font-normal uppercase">СТОРОНА</td>
                    <td colSpan={4} className="border border-black border-b-0 pt-1">АТАКА</td>
                  </tr>
                  
                  <tr className="text-[11px]">
                    <td className="border border-black w-6">А</td><td className="border border-black w-6">П</td><td className="border border-black w-6">Д</td><td className="border border-black w-6">О</td>
                    <td className="border border-black w-6">О</td><td className="border border-black w-6">А</td><td className="border border-black w-6">П</td><td className="border border-black w-6">Д</td>
                    <td className="border border-black w-6">А</td><td className="border border-black w-6">П</td><td className="border border-black w-6">Д</td><td className="border border-black w-6">О</td>
                    <td className="border border-black w-6">О</td><td className="border border-black w-6">А</td><td className="border border-black w-6">П</td><td className="border border-black w-6">Д</td>
                  </tr>
                </thead>
                <tbody>
                  {[
                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
                    "half",
                    13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, "OT"
                  ].map((roundNum, i) => {
                    if (roundNum === "half") {
                      return (
                        <tr key="half" className="text-[11px]">
                          <td className="border border-black">А</td><td className="border border-black">П</td><td className="border border-black">Д</td><td className="border border-black">О</td>
                          <td className="border border-black font-bold">Смена<br/>Сторон</td>
                          <td className="border border-black">О</td><td className="border border-black">А</td><td className="border border-black">П</td><td className="border border-black">Д</td>
                          
                          <td className="border border-black">А</td><td className="border border-black">П</td><td className="border border-black">Д</td><td className="border border-black">О</td>
                          <td className="border border-black font-bold">Смена<br/>Сторон</td>
                          <td className="border border-black">О</td><td className="border border-black">А</td><td className="border border-black">П</td><td className="border border-black">Д</td>
                        </tr>
                      );
                    }

                    const isOT = roundNum === "OT";
                    const rn = isOT ? 25 : (roundNum as number);
                    const dig = isOT ? { t1A: "", t1P: "", t1D: "", t1O: "", t2A: "", t2P: "", t2D: "", t2O: "" } : getRoundRowData(rn, safeDigital);
                    const phy = isOT ? { t1A: "", t1P: "", t1D: "", t1O: "", t2A: "", t2P: "", t2D: "", t2O: "" } : getRoundRowData(rn, safePhysical);

                    return (
                      <tr key={roundNum}>
                        <td className="border border-black bg-gray-300 py-0.5"><input type="text" defaultValue={dig.t1A} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black bg-gray-300 py-0.5"><input type="text" defaultValue={dig.t1P} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black py-0.5"><input type="text" defaultValue={dig.t1D} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black py-0.5"><input type="text" defaultValue={dig.t1O} className="w-full text-center bg-transparent outline-none" /></td>
                        
                        <td className="border border-black font-bold py-0.5 px-2 whitespace-nowrap">{isOT ? "ОТ" : `Р-${roundNum}`}</td>
                        
                        <td className="border border-black py-0.5"><input type="text" defaultValue={dig.t2O} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black py-0.5"><input type="text" defaultValue={dig.t2A} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black bg-gray-300 py-0.5"><input type="text" defaultValue={dig.t2P} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black bg-gray-300 py-0.5"><input type="text" defaultValue={dig.t2D} className="w-full text-center bg-transparent outline-none" /></td>

                        <td className="border border-black bg-gray-300 py-0.5"><input type="text" defaultValue={phy.t1A} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black bg-gray-300 py-0.5"><input type="text" defaultValue={phy.t1P} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black py-0.5"><input type="text" defaultValue={phy.t1D} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black py-0.5"><input type="text" defaultValue={phy.t1O} className="w-full text-center bg-transparent outline-none" /></td>
                        
                        <td className="border border-black font-bold py-0.5 px-2 whitespace-nowrap">{isOT ? "ОТ" : `Р-${roundNum}`}</td>
                        
                        <td className="border border-black py-0.5"><input type="text" defaultValue={phy.t2O} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black py-0.5"><input type="text" defaultValue={phy.t2A} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black bg-gray-300 py-0.5"><input type="text" defaultValue={phy.t2P} className="w-full text-center bg-transparent outline-none" /></td>
                        <td className="border border-black bg-gray-300 py-0.5"><input type="text" defaultValue={phy.t2D} className="w-full text-center bg-transparent outline-none" /></td>
                      </tr>
                    );
                  })}
                  
                  <tr>
                    <td colSpan={18} className="border border-black text-[12px] font-normal py-0.5">Итоговый результат по раундам:</td>
                  </tr>
                  <tr className="font-bold text-[14px]">
                    <td colSpan={9} className="border border-black border-r-4 py-1">
                      <input type="text" defaultValue={t1Name} className="w-full text-center bg-transparent outline-none" />
                      <div><input type="text" defaultValue={match?.scoreTotalTeam1 ?? ""} className="w-full text-center bg-transparent outline-none" /></div>
                    </td>
                    <td colSpan={9} className="border border-black py-1">
                      <input type="text" defaultValue={t2Name} className="w-full text-center bg-transparent outline-none" />
                      <div><input type="text" defaultValue={match?.scoreTotalTeam2 ?? ""} className="w-full text-center bg-transparent outline-none" /></div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="text-[12px] font-normal text-left leading-tight">
                А – Активация Цифрового пламени<br/>
                П – Подрыв Цифрового пламени<br/>
                Д – Деактивация Цифрового пламени<br/>
                О – Результат раунда
              </div>
            </div>
          )}

          {/* ---- ВКЛАДКА: ИТОГИ ---- */}
          {activeTab === 'summary' && (
            <div className="w-full h-full flex flex-col">
              {/* ТАБЛИЦА 1: СЧЕТ И СТАТИСТИКА */}
              <table className="w-full border-collapse border border-black text-center text-[13px] font-bold mb-1">
                <tbody>
                  <tr>
                    <td colSpan={11} className="border border-black bg-[#EBF1FA] text-[#000] text-[16px] py-1 border-t-[3px] border-t-[#4f81bd]">
                      Итоговый результат
                    </td>
                  </tr>
                  
                  <tr>
                    <td rowSpan={3} colSpan={2} className="border border-black bg-[#E5E7EB] p-2 leading-tight">
                      <input type="text" defaultValue={t1Name} className="w-full text-center outline-none bg-transparent font-bold uppercase text-[14px]" />
                    </td>
                    <td colSpan={3} className="border border-black bg-white text-[16px]">
                      <input type="text" defaultValue={match?.scoreTotalTeam1 ?? ""} className="w-full text-center outline-none bg-transparent font-bold" />
                    </td>
                    <td className="border border-black bg-[#E5E7EB] py-1 text-[12px]">Итоговый<br/>счет</td>
                    <td colSpan={3} className="border border-black bg-white text-[16px]">
                      <input type="text" defaultValue={match?.scoreTotalTeam2 ?? ""} className="w-full text-center outline-none bg-transparent font-bold" />
                    </td>
                    <td rowSpan={3} colSpan={2} className="border border-black bg-[#E5E7EB] p-2 leading-tight">
                      <input type="text" defaultValue={t2Name} className="w-full text-center outline-none bg-transparent font-bold uppercase text-[14px]" />
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={3} className="border border-black bg-white text-[14px] py-1">
                      <input type="text" defaultValue={match?.scoreDigitalTeam1 ?? ""} className="w-full text-center outline-none bg-transparent" />
                    </td>
                    <td className="border border-black bg-[#E5E7EB] text-[11px] leading-tight py-1">Цифровой<br/>сегмент</td>
                    <td colSpan={3} className="border border-black bg-white text-[14px] py-1">
                      <input type="text" defaultValue={match?.scoreDigitalTeam2 ?? ""} className="w-full text-center outline-none bg-transparent" />
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={3} className="border border-black bg-white text-[14px] py-1">
                      <input type="text" defaultValue={match?.scorePhysicalTeam1 ?? ""} className="w-full text-center outline-none bg-transparent" />
                    </td>
                    <td className="border border-black bg-[#E5E7EB] text-[11px] leading-tight py-1">Физический<br/>сегмент</td>
                    <td colSpan={3} className="border border-black bg-white text-[14px] py-1">
                      <input type="text" defaultValue={match?.scorePhysicalTeam2 ?? ""} className="w-full text-center outline-none bg-transparent" />
                    </td>
                  </tr>

                  <tr className="bg-[#E5E7EB]">
                    <td className="border border-black py-1.5 w-[11%]">Фраги</td>
                    <td className="border border-black py-1.5 w-[11%]">Смерти</td>
                    <td className="border border-black py-1.5 w-[6%] text-[11px]">АЦП</td>
                    <td className="border border-black py-1.5 w-[6%] text-[11px]">ПЦП</td>
                    <td className="border border-black py-1.5 w-[6%] text-[11px]">ДЦП</td>
                    <td rowSpan={2} className="border border-black py-1.5 w-[20%] text-[12px] leading-tight">Доп.<br />Показатели</td>
                    <td className="border border-black py-1.5 w-[6%] text-[11px]">АЦП</td>
                    <td className="border border-black py-1.5 w-[6%] text-[11px]">ПЦП</td>
                    <td className="border border-black py-1.5 w-[6%] text-[11px]">ДЦП</td>
                    <td className="border border-black py-1.5 w-[11%]">Фраги</td>
                    <td className="border border-black py-1.5 w-[11%]">Смерти</td>
                  </tr>

                  <tr className="bg-[#F2F2F2] font-normal text-[14px]">
                    <td className="border border-black py-1.5"><input type="text" defaultValue={t1Stats?.frags ?? 0} className="w-full text-center outline-none bg-transparent" /></td>
                    <td className="border border-black py-1.5"><input type="text" defaultValue={t1Stats?.deaths ?? 0} className="w-full text-center outline-none bg-transparent" /></td>
                    <td className="border border-black py-1.5"><input type="text" defaultValue={t1Stats?.acp ?? 0} className="w-full text-center outline-none bg-transparent" /></td>
                    <td className="border border-black py-1.5"><input type="text" defaultValue={t1Stats?.pcp ?? 0} className="w-full text-center outline-none bg-transparent" /></td>
                    <td className="border border-black py-1.5"><input type="text" defaultValue={t1Stats?.dcp ?? 0} className="w-full text-center outline-none bg-transparent" /></td>
                    
                    <td className="border border-black py-1.5"><input type="text" defaultValue={t2Stats?.acp ?? 0} className="w-full text-center outline-none bg-transparent" /></td>
                    <td className="border border-black py-1.5"><input type="text" defaultValue={t2Stats?.pcp ?? 0} className="w-full text-center outline-none bg-transparent" /></td>
                    <td className="border border-black py-1.5"><input type="text" defaultValue={t2Stats?.dcp ?? 0} className="w-full text-center outline-none bg-transparent" /></td>
                    <td className="border border-black py-1.5"><input type="text" defaultValue={t2Stats?.frags ?? 0} className="w-full text-center outline-none bg-transparent" /></td>
                    <td className="border border-black py-1.5"><input type="text" defaultValue={t2Stats?.deaths ?? 0} className="w-full text-center outline-none bg-transparent" /></td>
                  </tr>
                </tbody>
              </table>

              {/* Легенда */}
              <div className="text-[13px] font-bold text-left mb-6 leading-tight">
                АЦП - Активация Цифрового пламени<br />
                ПЦП – Подрыв Цифрового пламени<br />
                ДЦП – Деактивация Цифрового пламени
              </div>

              {/* ТАБЛИЦА 2: ЗАМЕНЫ */}
              <div className="text-center font-bold text-[16px] mb-1">Замены</div>
              <table className="w-full border-collapse border border-black text-[13px] text-center mb-6">
                <thead>
                  <tr className="bg-[#E5E7EB] font-bold">
                    <td className="border border-black p-1 w-8">№</td>
                    <td className="border border-black p-1 w-[28%]">Команда</td>
                    <td className="border border-black p-1 w-[24%]">Вышел</td>
                    <td className="border border-black p-1 w-[24%]">Зашел</td>
                    <td className="border border-black p-1 w-[16%]">Время</td>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="border border-black py-1 px-1">{i + 1}</td>
                      <td className="border border-black py-0"><input type="text" defaultValue={subs[i]?.teamName || ""} className="w-full text-center outline-none bg-transparent" /></td>
                      <td className="border border-black py-0"><input type="text" defaultValue={subs[i]?.playerOut || ""} className="w-full text-center outline-none bg-transparent" /></td>
                      <td className="border border-black py-0"><input type="text" defaultValue={subs[i]?.playerIn || ""} className="w-full text-center outline-none bg-transparent" /></td>
                      <td className="border border-black py-0"><input type="text" defaultValue={subs[i]?.time || ""} className="w-full text-center outline-none bg-transparent" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ТАБЛИЦА 3: НАРУШЕНИЯ ПРАВИЛ */}
              <div className="text-center font-bold text-[16px] mb-1">Нарушения правил</div>
              <table className="w-full border-collapse border border-black text-[13px] text-center mb-6">
                <thead>
                  <tr className="bg-[#E5E7EB] font-bold">
                    <td className="border border-black p-1 w-8">№</td>
                    <td className="border border-black p-1 w-[35%]">Ф.И.О</td>
                    <td className="border border-black p-1 w-[20%]">Команда</td>
                    <td className="border border-black p-1 w-[25%]">Причина</td>
                    <td className="border border-black p-1 w-[15%]">Время</td>
                  </tr>
                  <tr className="bg-[#E5E7EB]">
                    <td colSpan={5} className="border border-black font-bold p-1">Предупреждения</td>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`warn-${i}`}>
                      <td className="border border-black py-1 px-1">{i + 1}</td>
                      <td className="border border-black py-0 px-1"><input type="text" defaultValue={warnings[i]?.playerName || ""} className="w-full outline-none bg-transparent text-left" /></td>
                      <td className="border border-black py-0"><input type="text" defaultValue={warnings[i]?.teamName || ""} className="w-full outline-none bg-transparent text-center" /></td>
                      <td className="border border-black py-0 px-1"><input type="text" defaultValue={warnings[i]?.reason || ""} className="w-full outline-none bg-transparent text-left" /></td>
                      <td className="border border-black py-0"><input type="text" defaultValue={warnings[i]?.time || ""} className="w-full outline-none bg-transparent text-center" /></td>
                    </tr>
                  ))}
                  <tr className="bg-[#E5E7EB]">
                    <td colSpan={5} className="border border-black font-bold p-1">Дисквалификации</td>
                  </tr>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <tr key={`dq-${i}`}>
                      <td className="border border-black py-1 px-1">{i + 1}</td>
                      <td className="border border-black py-0 px-1"><input type="text" defaultValue={dqs[i]?.playerName || ""} className="w-full outline-none bg-transparent text-left" /></td>
                      <td className="border border-black py-0"><input type="text" defaultValue={dqs[i]?.teamName || ""} className="w-full outline-none bg-transparent text-center" /></td>
                      <td className="border border-black py-0 px-1"><input type="text" defaultValue={dqs[i]?.reason || ""} className="w-full outline-none bg-transparent text-left" /></td>
                      <td className="border border-black py-0"><input type="text" defaultValue={dqs[i]?.time || ""} className="w-full outline-none bg-transparent text-center" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ПРОЧИЕ ЗАМЕЧАНИЯ */}
              <div className="text-center font-bold text-[16px] mb-2 mt-auto">Прочие замечания:</div>
              <textarea className="w-full outline-none bg-transparent resize-none h-16 mb-4" />

              {/* ПОДПИСИ */}
              <table className="w-full border-collapse border border-black text-[14px] text-center mt-auto">
                <thead>
                  <tr className="font-bold">
                    <td className="border border-black p-2 w-[35%]">Должность</td>
                    <td className="border border-black p-2 w-[30%]">Подпись</td>
                    <td className="border border-black p-2 w-[35%]">ФИО</td>
                  </tr>
                </thead>
                <tbody className="font-bold text-left">
                  <tr>
                    <td className="border border-black px-2 py-1.5">Матчевый судья</td>
                    <td className="border border-black px-2 py-1.5"></td>
                    <td className="border border-black px-2 py-1.5 font-normal"><input type="text" defaultValue={matchJudge} className="w-full outline-none bg-transparent" /></td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1.5">Судья цифрового гейма</td>
                    <td className="border border-black px-2 py-1.5"></td>
                    <td className="border border-black px-2 py-1.5 font-normal"><input type="text" defaultValue={digitalJudge} className="w-full outline-none bg-transparent" /></td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1.5">Судья функционального гейма</td>
                    <td className="border border-black px-2 py-1.5"></td>
                    <td className="border border-black px-2 py-1.5 font-normal"><input type="text" defaultValue={physicalJudge} className="w-full outline-none bg-transparent" /></td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal">Представитель команды 1</td>
                    <td className="border border-black px-2 py-1.5"></td>
                    <td className="border border-black px-2 py-1.5 font-normal"><input type="text" defaultValue={t1Rep} className="w-full outline-none bg-transparent" /></td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal">Представитель команды 2</td>
                    <td className="border border-black px-2 py-1.5"></td>
                    <td className="border border-black px-2 py-1.5 font-normal"><input type="text" defaultValue={t2Rep} className="w-full outline-none bg-transparent" /></td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1.5">Секретарь</td>
                    <td className="border border-black px-2 py-1.5"></td>
                    <td className="border border-black px-2 py-1.5 font-normal"><input type="text" defaultValue={secretary} className="w-full outline-none bg-transparent" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// ОСНОВНАЯ СТРАНИЦА (ЭКРАН ПО УМОЛЧАНИЮ)
// -----------------------------------------------------------
export default function MatchResultsPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = parseInt(params.matchId ?? "0", 10);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const isChiefJudge = user?.role === "chief_judge";

  // Загрузка матча
  const { data: matchDetail, isLoading: matchLoading } = useQuery<ApiSuccess<MatchDetail>>({
    queryKey: ["/api/v1/matches", matchId, "results"],
    queryFn: () => apiRequest("GET", `/api/v1/matches/${matchId}`),
    enabled: matchId > 0,
  });

  const match = matchDetail?.data?.match;
  const teams = matchDetail?.data?.teams ?? [];
  const matchStatus = match?.status ?? "draft";
  const competitionId = match?.competitionId;

  // Загрузка раундов цифрового и физического этапов
  const { data: physicalRoundsResp } = useQuery<any>({
    queryKey: ["/api/v1/matches", matchId, "physical-rounds"],
    queryFn: () => apiRequest("GET", `/api/v1/matches/${matchId}/physical-rounds`),
    enabled: matchId > 0,
  });
  
  const { data: digitalRoundsResp } = useQuery<any>({
    queryKey: ["/api/v1/matches", matchId, "digital-rounds"],
    queryFn: () => apiRequest("GET", `/api/v1/matches/${matchId}/digital-rounds`),
    enabled: matchId > 0,
  });

  const physicalRounds = physicalRoundsResp?.data || physicalRoundsResp?.rounds || [];
  const digitalRounds = digitalRoundsResp?.data || digitalRoundsResp?.rounds || [];

  // Загрузка данных соревнования
  const { data: compDetail } = useQuery<any>({
    queryKey: ["/api/v1/competitions", competitionId],
    queryFn: () => apiRequest("GET", `/api/v1/competitions/${competitionId}`),
    enabled: !!competitionId,
  });
  
  // Загрузка полного списка команд соревнования (fallback)
  const { data: competitionTeamsResp } = useQuery<ApiSuccess<CompetitionTeamDto[]>>({
    queryKey: ["/api/v1/competitions", competitionId, "teams"],
    queryFn: () => apiRequest("GET", `/api/v1/competitions/${competitionId}/teams`),
    enabled: !!competitionId,
  });

  const competition = compDetail?.data;
  const competitionTeams = competitionTeamsResp?.data ?? [];

  const rawTeam1Slot = teams.find((t) => t.teamSlot === 1);
  const rawTeam2Slot = teams.find((t) => t.teamSlot === 2);

  // Склеиваем данные
  const team1Slot = useMemo(() => mergeTeamSlot(rawTeam1Slot, competitionTeams), [rawTeam1Slot, competitionTeams]);
  const team2Slot = useMemo(() => mergeTeamSlot(rawTeam2Slot, competitionTeams), [rawTeam2Slot, competitionTeams]);

  const transitionMutation = useMutation({
    mutationFn: (targetStatus: MatchStatus) => apiRequest("POST", `/api/v1/matches/${matchId}/transition`, { targetStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/matches", matchId, "results"] });
      toast({ title: "Успех", description: "Статус обновлён." });
    }
  });

  if (matchLoading) return <AppShell><div className="p-6"><Skeleton className="w-full h-40" /></div></AppShell>;
  
  // ОТКРЫТ РЕДАКТОР ПРОТОКОЛОВ:
  if (isEditorOpen) {
    return <ProtocolEditor 
      match={match} 
      team1Slot={team1Slot} 
      team2Slot={team2Slot} 
      competition={competition} 
      digitalRounds={digitalRounds}
      physicalRounds={physicalRounds}
      onClose={() => setIsEditorOpen(false)} 
    />;
  }

  // ОБЫЧНЫЙ ИНТЕРФЕЙС СТРАНИЦЫ
  const statusConfig = MATCH_STATUS_CONFIG[matchStatus as MatchStatus] || MATCH_STATUS_CONFIG.draft;

  return (
    <AppShell activeMatchId={matchId} activeMatchStatus={matchStatus}>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1 as unknown as string)} className="text-muted-foreground mr-2 hover:text-foreground transition-colors"><ChevronLeft className="w-5 h-5" /></button>
            <Trophy className="w-5 h-5 text-primary" />
            <div className="flex flex-col">
              <h1 className="text-lg font-black uppercase">Итоги матча</h1>
              <span className="text-xs text-muted-foreground font-bold">{match?.matchNumber || `Матч #${matchId}`}</span>
            </div>
            <Badge variant="outline" className={cn("ml-4 text-[10px] px-2 py-0.5 border uppercase tracking-widest", statusConfig.className)}>
              {statusConfig.label}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsEditorOpen(true)} className="font-bold text-xs uppercase bg-blue-600 hover:bg-blue-700 text-white">
              <FileText className="w-4 h-4 mr-2" /> Протоколы (PDF)
            </Button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-muted/10">
           <div className="max-w-4xl mx-auto space-y-6">
              <ScoreSummary
                team1Name={team1Slot.compTeam.name} team2Name={team2Slot.compTeam.name}
                digitalTeam1={match?.scoreDigitalTeam1 || 0} digitalTeam2={match?.scoreDigitalTeam2 || 0}
                physicalTeam1={match?.scorePhysicalTeam1 || 0} physicalTeam2={match?.scorePhysicalTeam2 || 0}
                totalTeam1={match?.scoreTotalTeam1 || 0} totalTeam2={match?.scoreTotalTeam2 || 0}
                penaltyTeam1={0} penaltyTeam2={0} winnerTeamSlot={match?.winnerTeamId === team1Slot.compTeam.id ? 1 : match?.winnerTeamId === team2Slot.compTeam.id ? 2 : null}
              />
              
              {isChiefJudge && (
                <div className="rounded-xl border border-border bg-card p-5">
                   <SectionHeader icon={CheckCircle2} title="Управление статусом" />
                   <div className="flex gap-2">
                     {matchStatus === "finished" && <Button onClick={() => transitionMutation.mutate("approved")} disabled={transitionMutation.isPending}>Утвердить</Button>}
                     {matchStatus === "approved" && (
                       <>
                         <Button onClick={() => transitionMutation.mutate("locked")} variant="destructive" disabled={transitionMutation.isPending}><Lock className="w-4 h-4 mr-2" /> Заблокировать</Button>
                         <Button onClick={() => transitionMutation.mutate("finished")} variant="outline" disabled={transitionMutation.isPending}><RefreshCcw className="w-4 h-4 mr-2" /> Вернуть на финиш</Button>
                       </>
                     )}
                   </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </AppShell>
  );
}