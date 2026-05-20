/**
 * СЕРВИС ГЕНЕРАЦИИ PDF
 *
 * Генерирует PDF-документы протоколов матчей с использованием pdfmake.
 * Поддерживает два формата:
 * - Полный протокол матча (все раунды, нарушения, итоги)
 * - Итоговый лист (краткая версия: только шапка и финальный счёт)
 */

import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions, Content, Style } from "pdfmake/interfaces";
import { createRequire } from "module";
import { getMatchById } from "./match.service";
import { getDigitalRounds, getPhysicalRounds } from "./round.service";
import { getMatchViolations } from "./violation.service";
import db from "../db/connection";
import { competitions } from "@shared/schema";
import { eq } from "drizzle-orm";

// -------------------------------------------------------
// Инициализация pdfmake с встроенными шрифтами Roboto
// -------------------------------------------------------

// Используем createRequire для загрузки CommonJS-модуля vfs_fonts из ESM-контекста.
// vfs_fonts.js экспортирует объект напрямую: { "Roboto-Regular.ttf": "<base64>", ... }
const require = createRequire(import.meta.url);
const vfsFonts = require("pdfmake/build/vfs_fonts") as Record<string, string>;

const printer = new PdfPrinter({
  Roboto: {
    normal: Buffer.from(vfsFonts["Roboto-Regular.ttf"], "base64"),
    bold: Buffer.from(vfsFonts["Roboto-Medium.ttf"], "base64"),
    italics: Buffer.from(vfsFonts["Roboto-Italic.ttf"], "base64"),
    bolditalics: Buffer.from(vfsFonts["Roboto-MediumItalic.ttf"], "base64"),
  },
});

// -------------------------------------------------------
// Вспомогательная функция: конвертация PDF-документа в Buffer
// -------------------------------------------------------

function pdfToBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

// -------------------------------------------------------
// Вспомогательные утилиты форматирования
// -------------------------------------------------------

/** Форматирует дату ISO-строки в читаемый вид */
function formatDate(isoStr?: string | null): string {
  if (!isoStr) return "—";
  try {
    return new Date(isoStr).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

/** Переводит статус матча на русский */
function translateMatchStatus(status: string): string {
  const map: Record<string, string> = {
    draft: "Черновик",
    setup: "Настройка",
    digital_phase: "Цифровой этап",
    physical_phase: "Физический этап",
    finished: "Завершён",
    approved: "Утверждён",
    locked: "Заблокирован",
  };
  return map[status] ?? status;
}

/** Переводит фазу нарушения на русский */
function translatePhase(phase: string): string {
  const map: Record<string, string> = {
    general: "Общая",
    digital: "Цифровой",
    physical: "Физический",
  };
  return map[phase] ?? phase;
}

// -------------------------------------------------------
// Общие стили документа
// Все margins явно типизированы как кортежи [n,n,n,n] чтобы
// удовлетворить ограничения типа Style из pdfmake/interfaces
// -------------------------------------------------------

type M4 = [number, number, number, number];

const docStyles: Record<string, Style> = {
  header: { fontSize: 16, bold: true, margin: [0, 0, 0, 8] as M4 },
  subheader: { fontSize: 13, bold: true, margin: [0, 12, 0, 6] as M4 },
  sectionTitle: { fontSize: 11, bold: true, margin: [0, 10, 0, 4] as M4 },
  tableHeader: { bold: true, fillColor: "#eeeeee", fontSize: 9 },
  cell: { fontSize: 9 },
  label: { fontSize: 10, color: "#555555" },
  value: { fontSize: 10, bold: true },
  footer: { fontSize: 8, color: "#888888" },
};

// -------------------------------------------------------
// Вспомогательная: строка-заглушка "не найдено" для таблицы
// Использует any, т.к. pdfmake принимает объекты с colSpan
// -------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function emptyRow(colCount: number, text: string): any[] {
  return [
    { text, colSpan: colCount, alignment: "center", style: "cell" },
    ...Array(colCount - 1).fill({}),
  ];
}

// -------------------------------------------------------
// ЭКСПОРТИРУЕМЫЕ ФУНКЦИИ
// -------------------------------------------------------

/**
 * Сгенерировать PDF протокол матча (полная версия).
 * Включает: шапку, команды, цифровой этап, физический этап,
 * нарушения, итоговый счёт.
 *
 * @param matchId — ID матча
 * @returns Buffer с PDF-документом
 */
export async function generateMatchProtocolPdf(matchId: number): Promise<Buffer> {
  // Загружаем данные о матче (выбрасывает AppError если не найден)
  const matchDetail = getMatchById(matchId);
  const { match, teams } = matchDetail;

  // Загружаем данные соревнования
  const competition = db
    .select()
    .from(competitions)
    .where(eq(competitions.id, match.competitionId))
    .get();

  // Загружаем раунды и нарушения
  const digitalRoundsList = getDigitalRounds(matchId);
  const physicalRoundsList = getPhysicalRounds(matchId);
  const violations = getMatchViolations(matchId);

  // Определяем команды по слоту
  const team1 = teams.find((t) => t.teamSlot === 1);
  const team2 = teams.find((t) => t.teamSlot === 2);
  const team1Name = team1?.compTeam.name ?? "Команда 1";
  const team2Name = team2?.compTeam.name ?? "Команда 2";

  // Победитель
  const winnerTeam = teams.find((t) => t.compTeam.id === match.winnerTeamId);
  const winnerName = winnerTeam?.compTeam.name ?? "—";

  // ---- Блок 1: Шапка матча ----
  const headerBlock: Content = [
    { text: `ПРОТОКОЛ МАТЧА #${matchId}`, style: "header" },
    {
      table: {
        widths: ["auto", "*"],
        body: [
          [
            { text: "Соревнование:", style: "label" },
            { text: competition?.name ?? "—", style: "value" },
          ],
          [
            { text: "Дата:", style: "label" },
            { text: formatDate(match.scheduledAt ?? match.createdAt), style: "value" },
          ],
          [
            { text: "Статус:", style: "label" },
            { text: translateMatchStatus(match.status), style: "value" },
          ],
          ...(match.stage
            ? [[{ text: "Этап:", style: "label" }, { text: match.stage, style: "value" }]]
            : []),
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 8] as M4,
    },
  ];

  // ---- Блок 2: Команды ----
  const teamsBlock: Content = [
    { text: "КОМАНДЫ", style: "subheader" },
    {
      table: {
        widths: ["auto", "*"],
        body: [
          [
            { text: "Слот 1:", style: "label" },
            { text: team1Name, style: "value" },
          ],
          [
            { text: "Слот 2:", style: "label" },
            { text: team2Name, style: "value" },
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 8] as M4,
    },
  ];

  // ---- Блок 3: Цифровой этап ----
  const digitalScore1 = match.scoreDigitalTeam1 ?? 0;
  const digitalScore2 = match.scoreDigitalTeam2 ?? 0;

  // Заголовки таблицы раундов цифрового этапа
  const digitalTableHeader = [
    { text: "№", style: "tableHeader" },
    { text: "Статус", style: "tableHeader" },
    { text: "Победитель (ID)", style: "tableHeader" },
    { text: "Сторона T1", style: "tableHeader" },
    { text: "Сторона T2", style: "tableHeader" },
    { text: "Очки", style: "tableHeader" },
    { text: "Заметка", style: "tableHeader" },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const digitalTableBody: any[][] =
    digitalRoundsList.length > 0
      ? digitalRoundsList.map((r) => [
          { text: String(r.roundNumber), style: "cell" },
          { text: r.status, style: "cell" },
          { text: r.winnerTeamId ? String(r.winnerTeamId) : "—", style: "cell" },
          { text: r.team1Side ?? "—", style: "cell" },
          { text: r.team2Side ?? "—", style: "cell" },
          { text: String(r.pointsAwarded), style: "cell" },
          { text: r.note ?? "—", style: "cell" },
        ])
      : [emptyRow(7, "Раунды не найдены")];

  const digitalBlock: Content = [
    { text: "ЦИФРОВОЙ ЭТАП", style: "subheader" },
    {
      text: `Счёт: ${digitalScore1} : ${digitalScore2}`,
      style: "sectionTitle",
      margin: [0, 0, 0, 4] as M4,
    },
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      table: {
        headerRows: 1,
        widths: ["auto", "auto", "*", "auto", "auto", "auto", "*"],
        body: [digitalTableHeader, ...digitalTableBody],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 8] as M4,
    } as unknown as Content,
  ];

  // ---- Блок 4: Физический этап ----
  const physScore1 = match.scorePhysicalTeam1 ?? 0;
  const physScore2 = match.scorePhysicalTeam2 ?? 0;

  const physTableHeader = [
    { text: "№", style: "tableHeader" },
    { text: "Статус", style: "tableHeader" },
    { text: "Победитель (ID)", style: "tableHeader" },
    { text: "T1 фраги", style: "tableHeader" },
    { text: "T2 фраги", style: "tableHeader" },
    { text: "Очки", style: "tableHeader" },
    { text: "Штраф", style: "tableHeader" },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const physTableBody: any[][] =
    physicalRoundsList.length > 0
      ? physicalRoundsList.map((r) => [
          { text: String(r.roundNumber), style: "cell" },
          { text: r.status, style: "cell" },
          { text: r.winnerTeamId ? String(r.winnerTeamId) : "—", style: "cell" },
          { text: String(r.fragsTeam1), style: "cell" },
          { text: String(r.fragsTeam2), style: "cell" },
          { text: String(r.pointsAwarded), style: "cell" },
          { text: String(r.penaltyPoints), style: "cell" },
        ])
      : [emptyRow(7, "Раунды не найдены")];

  const physicalBlock: Content = [
    { text: "ФИЗИЧЕСКИЙ ЭТАП", style: "subheader" },
    {
      text: `Счёт: ${physScore1} : ${physScore2}`,
      style: "sectionTitle",
      margin: [0, 0, 0, 4] as M4,
    },
    {
      table: {
        headerRows: 1,
        widths: ["auto", "auto", "*", "auto", "auto", "auto", "auto"],
        body: [physTableHeader, ...physTableBody],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 8] as M4,
    } as unknown as Content,
  ];

  // ---- Блок 5: Нарушения (если есть) ----
  let violationsBlock: Content = [];
  if (violations.length > 0) {
    const violTableHeader = [
      { text: "Команда ID", style: "tableHeader" },
      { text: "Фаза", style: "tableHeader" },
      { text: "Раунд", style: "tableHeader" },
      { text: "Штраф (очки)", style: "tableHeader" },
      { text: "Заметка", style: "tableHeader" },
    ];

    const violTableRows = violations.map((v) => [
      { text: String(v.compTeamId), style: "cell" },
      { text: translatePhase(v.phase), style: "cell" },
      {
        text:
          v.roundNumber !== null && v.roundNumber !== undefined
            ? String(v.roundNumber)
            : "—",
        style: "cell",
      },
      { text: String(v.penaltyPts), style: "cell" },
      { text: v.note ?? "—", style: "cell" },
    ]);

    violationsBlock = [
      { text: "НАРУШЕНИЯ", style: "subheader" },
      {
        table: {
          headerRows: 1,
          widths: ["auto", "auto", "auto", "auto", "*"],
          body: [violTableHeader, ...violTableRows],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 8] as M4,
      } as unknown as Content,
    ];
  }

  // ---- Блок 6: Итоговый счёт ----
  const totalScore1 = match.scoreTotalTeam1 ?? 0;
  const totalScore2 = match.scoreTotalTeam2 ?? 0;

  const summaryBlock: Content = [
    { text: "ИТОГОВЫЙ СЧЁТ", style: "subheader" },
    {
      table: {
        widths: ["auto", "*"],
        body: [
          [
            { text: "Цифровой этап:", style: "label" },
            { text: `${digitalScore1} : ${digitalScore2}`, style: "value" },
          ],
          [
            { text: "Физический этап:", style: "label" },
            { text: `${physScore1} : ${physScore2}`, style: "value" },
          ],
          [
            { text: "Итого:", bold: true, fontSize: 12 },
            { text: `${totalScore1} : ${totalScore2}`, bold: true, fontSize: 12 },
          ],
          [
            { text: "Победитель:", style: "label" },
            { text: winnerName, bold: true, fontSize: 12, color: "#1a7a1a" },
          ],
        ],
      },
      layout: "noBorders",
    } as unknown as Content,
  ];

  // ---- Сборка итогового документа ----
  const docDefinition: TDocumentDefinitions = {
    content: [
      headerBlock,
      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#cccccc" },
        ],
      },
      teamsBlock,
      digitalBlock,
      physicalBlock,
      ...(violations.length > 0 ? [violationsBlock] : []),
      summaryBlock,
    ],
    styles: docStyles,
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
    },
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    footer: (currentPage: number, pageCount: number) => ({
      text: `Страница ${currentPage} из ${pageCount} | Сгенерировано: ${formatDate(new Date().toISOString())}`,
      style: "footer",
      alignment: "center",
      margin: [40, 10, 40, 0] as M4,
    }),
  };

  return pdfToBuffer(docDefinition);
}

/**
 * Сгенерировать PDF итоговый лист матча (краткая версия).
 * Содержит только шапку матча, команды и итоговый счёт.
 * Помещается на одну страницу.
 *
 * @param matchId — ID матча
 * @returns Buffer с PDF-документом
 */
export async function generateMatchSummaryPdf(matchId: number): Promise<Buffer> {
  // Загружаем данные о матче (выбрасывает AppError если не найден)
  const matchDetail = getMatchById(matchId);
  const { match, teams } = matchDetail;

  // Загружаем данные соревнования
  const competition = db
    .select()
    .from(competitions)
    .where(eq(competitions.id, match.competitionId))
    .get();

  // Определяем команды и победителя
  const team1 = teams.find((t) => t.teamSlot === 1);
  const team2 = teams.find((t) => t.teamSlot === 2);
  const team1Name = team1?.compTeam.name ?? "Команда 1";
  const team2Name = team2?.compTeam.name ?? "Команда 2";

  const winnerTeam = teams.find((t) => t.compTeam.id === match.winnerTeamId);
  const winnerName = winnerTeam?.compTeam.name ?? "—";

  const digitalScore1 = match.scoreDigitalTeam1 ?? 0;
  const digitalScore2 = match.scoreDigitalTeam2 ?? 0;
  const physScore1 = match.scorePhysicalTeam1 ?? 0;
  const physScore2 = match.scorePhysicalTeam2 ?? 0;
  const totalScore1 = match.scoreTotalTeam1 ?? 0;
  const totalScore2 = match.scoreTotalTeam2 ?? 0;

  const docDefinition: TDocumentDefinitions = {
    content: [
      // Заголовок
      {
        text: `ИТОГОВЫЙ ЛИСТ МАТЧА #${matchId}`,
        style: "header",
        alignment: "center",
      },
      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: "#333333" },
        ],
        margin: [0, 0, 0, 12] as M4,
      },

      // Шапка матча
      {
        table: {
          widths: ["auto", "*"],
          body: [
            [
              { text: "Соревнование:", style: "label" },
              { text: competition?.name ?? "—", style: "value" },
            ],
            [
              { text: "Дата:", style: "label" },
              { text: formatDate(match.scheduledAt ?? match.createdAt), style: "value" },
            ],
            [
              { text: "Статус:", style: "label" },
              { text: translateMatchStatus(match.status), style: "value" },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 16] as M4,
      } as unknown as Content,

      // Команды
      { text: "КОМАНДЫ", style: "sectionTitle" },
      {
        table: {
          widths: ["*", "auto", "*"],
          body: [
            [
              { text: team1Name, alignment: "right", bold: true, fontSize: 13 },
              { text: "VS", alignment: "center", bold: true, fontSize: 13, color: "#888888" },
              { text: team2Name, alignment: "left", bold: true, fontSize: 13 },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 4, 0, 16] as M4,
      } as unknown as Content,

      // Итоговый счёт
      { text: "ИТОГОВЫЙ СЧЁТ", style: "sectionTitle" },
      {
        table: {
          widths: ["*", "auto"],
          body: [
            [
              { text: "Цифровой этап:", style: "label" },
              { text: `${digitalScore1} : ${digitalScore2}`, style: "value" },
            ],
            [
              { text: "Физический этап:", style: "label" },
              { text: `${physScore1} : ${physScore2}`, style: "value" },
            ],
            [
              { text: "ИТОГО:", bold: true, fontSize: 12 },
              { text: `${totalScore1} : ${totalScore2}`, bold: true, fontSize: 14 },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 4, 0, 20] as M4,
      } as unknown as Content,

      // Победитель
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: `ПОБЕДИТЕЛЬ: ${winnerName}`,
                alignment: "center",
                bold: true,
                fontSize: 15,
                color: "#ffffff",
                fillColor: "#1a7a1a",
                margin: [10, 8, 10, 8] as M4,
              },
            ],
          ],
        },
        layout: "noBorders",
      } as unknown as Content,
    ],
    styles: docStyles,
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
    },
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    footer: (_currentPage: number, _pageCount: number) => ({
      text: `Сгенерировано: ${formatDate(new Date().toISOString())}`,
      style: "footer",
      alignment: "center",
      margin: [40, 10, 40, 0] as M4,
    }),
  };

  return pdfToBuffer(docDefinition);
}
