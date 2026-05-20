/**
 * РОУТЫ ДОКУМЕНТОВ — ГЕНЕРАЦИЯ PDF
 *
 * GET /api/v1/matches/:id/pdf/protocol  — скачать полный протокол матча в PDF
 * GET /api/v1/matches/:id/pdf/summary   — скачать итоговый лист матча в PDF
 *
 * Роутер монтируется на /api/v1/matches, поэтому пути начинаются с /:id/pdf/...
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  generateMatchProtocolPdf,
  generateMatchSummaryPdf,
} from "../services/pdf.service";

const router = Router();

// -------------------------------------------------------
// GET /:id/pdf/protocol — полный протокол матча
// -------------------------------------------------------

router.get("/:id/pdf/protocol", requireAuth, async (req, res, next) => {
  try {
    const matchId = parseInt(req.params.id as string);

    if (isNaN(matchId)) {
      res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "Неверный идентификатор матча." },
      });
      return;
    }

    // Генерируем PDF — AppError пробрасывается в next() если матч не найден
    const pdfBuffer = await generateMatchProtocolPdf(matchId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="match-${matchId}-protocol.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------
// GET /:id/pdf/summary — краткий итоговый лист матча
// -------------------------------------------------------

router.get("/:id/pdf/summary", requireAuth, async (req, res, next) => {
  try {
    const matchId = parseInt(req.params.id as string);

    if (isNaN(matchId)) {
      res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "Неверный идентификатор матча." },
      });
      return;
    }

    // Генерируем PDF — AppError пробрасывается в next() если матч не найден
    const pdfBuffer = await generateMatchSummaryPdf(matchId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="match-${matchId}-summary.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
