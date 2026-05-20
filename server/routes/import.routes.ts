/**
 * РОУТЫ ИМПОРТА СТАТИСТИКИ
 *
 * POST /api/v1/matches/:id/import/preview  — загрузить файл, вернуть превью
 * POST /api/v1/matches/:id/import/apply    — применить импорт к данным матча
 * GET  /api/v1/matches/:id/imports         — история импортов (MVP: пусто)
 */

import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { requireAuth, getCurrentUser } from "../middleware/auth.middleware";
import { AppError, Errors } from "../middleware/error.middleware";
import type { ImportPreviewDTO, ImportPreviewRow } from "../../shared/contracts/api";
import {
  updateDigitalRound,
  getDigitalRounds,
  updatePhysicalRound,
  getPhysicalRounds,
} from "../services/round.service";
import { getMatchById } from "../services/match.service";

const router = Router();
router.use(requireAuth);

// Multer — храним файл в памяти, не записываем на диск
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Ограничение размера файла: 10 МБ
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    // Принимаем только Excel и CSV форматы
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new AppError(400, "INVALID_FILE_TYPE", "Неверный формат файла. Допустимы: .xlsx, .xls, .csv"));
    }
  },
});

// -------------------------------------------------------
// Допустимые типы импорта
// -------------------------------------------------------
type ImportType = "digital_stats" | "physical_stats" | "players";

const VALID_IMPORT_TYPES: ImportType[] = ["digital_stats", "physical_stats", "players"];

/**
 * Валидирует одну строку данных в зависимости от типа импорта.
 * Возвращает массив строк с описанием ошибок (пустой массив = строка валидна).
 */
function validateRow(row: Record<string, unknown>, importType: ImportType): string[] {
  const errors: string[] = [];

  if (importType === "digital_stats") {
    // Ожидаем: roundNumber (число), winnerSide (CT|T)
    if (row.roundNumber === null || row.roundNumber === undefined || row.roundNumber === "") {
      errors.push("Отсутствует поле roundNumber");
    } else if (isNaN(Number(row.roundNumber))) {
      errors.push("Поле roundNumber должно быть числом");
    }

    if (row.winnerSide === null || row.winnerSide === undefined || row.winnerSide === "") {
      errors.push("Отсутствует поле winnerSide");
    } else if (!["CT", "T"].includes(String(row.winnerSide))) {
      errors.push("Поле winnerSide должно быть CT или T");
    }
  } else if (importType === "physical_stats") {
    // Ожидаем: roundNumber (число), team1Score (число), team2Score (число)
    if (row.roundNumber === null || row.roundNumber === undefined || row.roundNumber === "") {
      errors.push("Отсутствует поле roundNumber");
    } else if (isNaN(Number(row.roundNumber))) {
      errors.push("Поле roundNumber должно быть числом");
    }

    if (row.team1Score === null || row.team1Score === undefined || row.team1Score === "") {
      errors.push("Отсутствует поле team1Score");
    } else if (isNaN(Number(row.team1Score))) {
      errors.push("Поле team1Score должно быть числом");
    }

    if (row.team2Score === null || row.team2Score === undefined || row.team2Score === "") {
      errors.push("Отсутствует поле team2Score");
    } else if (isNaN(Number(row.team2Score))) {
      errors.push("Поле team2Score должно быть числом");
    }
  } else if (importType === "players") {
    // Ожидаем: firstName (строка), lastName (строка)
    if (!row.firstName || String(row.firstName).trim() === "") {
      errors.push("Отсутствует поле firstName");
    }

    if (!row.lastName || String(row.lastName).trim() === "") {
      errors.push("Отсутствует поле lastName");
    }
  }

  return errors;
}

// -------------------------------------------------------
// POST /matches/:id/import/preview
// -------------------------------------------------------
router.post(
  "/matches/:id/import/preview",
  upload.single("file"),
  (req, res, next) => {
    try {
      // Проверяем наличие файла
      if (!req.file) {
        throw Errors.badRequest("Файл не загружен. Укажите поле 'file' в form-data.");
      }

      // Получаем и проверяем тип импорта из query-параметров
      const importType = req.query.importType as string;
      if (!importType || !VALID_IMPORT_TYPES.includes(importType as ImportType)) {
        throw Errors.badRequest(
          `Неверный тип импорта. Допустимы: ${VALID_IMPORT_TYPES.join(", ")}`
        );
      }

      const typedImportType = importType as ImportType;

      // Парсим файл через xlsx
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!sheet) {
        throw Errors.badRequest("Файл не содержит ни одного листа.");
      }

      // Преобразуем лист в массив объектов; defval: null — пустые ячейки = null
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];

      if (rows.length === 0) {
        throw Errors.badRequest("Файл пуст. Не найдено ни одной строки данных.");
      }

      // Формируем превью (первые 10 строк)
      const previewRows: ImportPreviewRow[] = rows.slice(0, 10).map((row, i) => {
        const rowErrors = validateRow(row, typedImportType);
        return {
          rowIndex: i + 1,
          data: row,
          errors: rowErrors,
          isValid: rowErrors.length === 0,
        };
      });

      // Считаем валидные/невалидные строки по ВСЕМУ файлу
      let validCount = 0;
      let invalidCount = 0;
      for (const row of rows) {
        const rowErrors = validateRow(row, typedImportType);
        if (rowErrors.length === 0) {
          validCount++;
        } else {
          invalidCount++;
        }
      }

      const result: ImportPreviewDTO = {
        importId: Date.now(),
        filename: req.file.originalname,
        importType: typedImportType,
        totalRows: rows.length,
        validRows: validCount,
        invalidRows: invalidCount,
        columns: Object.keys(rows[0] ?? {}),
        preview: previewRows,
      };

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------
// POST /matches/:id/import/apply
// -------------------------------------------------------
router.post("/matches/:id/import/apply", (req, res, next) => {
  try {
    const matchId = Number(req.params.id);

    if (isNaN(matchId)) {
      throw Errors.badRequest("Неверный идентификатор матча.");
    }

    const { importId, importType, rows } = req.body as {
      importId?: number;
      importType?: string;
      rows?: unknown[];
      matchId?: number;
      columnMapping?: Record<string, string>;
    };

    if (!importId) {
      throw Errors.badRequest("Отсутствует importId.");
    }

    if (!importType || !VALID_IMPORT_TYPES.includes(importType as ImportType)) {
      throw Errors.badRequest("Неверный или отсутствующий тип импорта.");
    }

    if (!Array.isArray(rows)) {
      throw Errors.badRequest("Поле rows должно быть массивом.");
    }

    // Получаем пользователя для передачи в сервисы
    const user = getCurrentUser(req);
    const userId = user.id;

    // Проверяем существование матча (выбрасывает AppError если не найден)
    getMatchById(matchId);

    let applied = 0;
    let skipped = 0;
    const applyErrors: string[] = [];

    if (importType === "digital_stats") {
      // Обновляем цифровые раунды матча
      // Строки ожидают поля: roundNumber, winnerSide?, map?, notes?
      const existingRounds = getDigitalRounds(matchId);

      for (const rawRow of rows) {
        const row = rawRow as Record<string, unknown>;
        const roundNumber = Number(row.roundNumber);

        if (isNaN(roundNumber)) {
          skipped++;
          applyErrors.push("Пропущена строка: roundNumber=" + String(row.roundNumber) + " не является числом");
          continue;
        }

        const round = existingRounds.find((r) => r.roundNumber === roundNumber);
        if (!round) {
          skipped++;
          applyErrors.push("Раунд " + String(roundNumber) + " не существует в матче — пропущен");
          continue;
        }

        try {
          // Собираем поля для обновления
          const updatePayload: Record<string, unknown> = {};

          // note: приоритет у notes, затем map (как заметка о карте)
          if (row.notes !== undefined && row.notes !== null) {
            updatePayload.note = String(row.notes);
          } else if (row.map !== undefined && row.map !== null) {
            updatePayload.note = String(row.map);
          }

          // result: текстовый итог раунда
          if (row.result !== undefined && row.result !== null) {
            updatePayload.result = String(row.result);
          }

          updateDigitalRound(round.id, updatePayload as any, userId);
          applied++;
        } catch (e) {
          skipped++;
          applyErrors.push("Ошибка при обновлении раунда " + String(roundNumber) + ": " + (e as Error).message);
        }
      }
    } else if (importType === "physical_stats") {
      // Обновляем физические раунды матча
      // Строки ожидают поля: roundNumber, team1Score?, team2Score?, penaltyPoints?, notes?
      const existingRounds = getPhysicalRounds(matchId);

      for (const rawRow of rows) {
        const row = rawRow as Record<string, unknown>;
        const roundNumber = Number(row.roundNumber);

        if (isNaN(roundNumber)) {
          skipped++;
          applyErrors.push("Пропущена строка: roundNumber=" + String(row.roundNumber) + " не является числом");
          continue;
        }

        const round = existingRounds.find((r) => r.roundNumber === roundNumber);
        if (!round) {
          skipped++;
          applyErrors.push("Раунд " + String(roundNumber) + " не существует в матче — пропущен");
          continue;
        }

        try {
          const updateData: Record<string, unknown> = {};

          // fragsTeam1 / fragsTeam2 — фраги команд (из полей team1Score/team2Score в файле)
          if (row.team1Score !== undefined && row.team1Score !== null) {
            updateData.fragsTeam1 = Number(row.team1Score);
          }
          if (row.team2Score !== undefined && row.team2Score !== null) {
            updateData.fragsTeam2 = Number(row.team2Score);
          }
          if (row.penaltyPoints !== undefined && row.penaltyPoints !== null) {
            updateData.penaltyPoints = Math.max(0, Number(row.penaltyPoints));
          }
          if (row.notes !== undefined && row.notes !== null) {
            updateData.note = String(row.notes);
          }

          updatePhysicalRound(round.id, updateData as any, userId);
          applied++;
        } catch (e) {
          skipped++;
          applyErrors.push("Ошибка при обновлении раунда " + String(roundNumber) + ": " + (e as Error).message);
        }
      }
    } else if (importType === "players") {
      // Импорт игроков через файл требует выбора команды — пропускаем в этой версии
      res.json({
        success: true,
        data: {
          applied: 0,
          skipped: rows.length,
          errors: ["Импорт игроков через файл требует выбора команды"],
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        applied,
        skipped,
        errors: applyErrors,
      },
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------
// GET /matches/:id/imports
// -------------------------------------------------------
router.get("/matches/:id/imports", (_req, res) => {
  // MVP: история импортов хранится в памяти клиента, не в БД
  // TODO: реализовать сохранение истории импортов в базе данных
  res.json({ success: true, data: [] });
});

export default router;
