/**
 * КАЛЬКУЛЯТОР ОЧКОВ — Протокол матча. Фиджитал-спорт
 *
 * Этот модуль содержит ВСЮ математику подсчёта очков.
 * Он является единственным источником правил начисления.
 *
 * ВАЖНО:
 * - Этот код выполняется ТОЛЬКО на сервере (в score.service.ts)
 * - Клиент получает уже посчитанные результаты
 * - При изменении правил — меняем только этот файл
 *
 * Правила по умолчанию (настраиваются через competition_settings):
 * - CS2: каждый выигранный раунд = 1 очко
 * - Лазертаг: activation=2, explosion=3, deactivation=1, frag_win=1
 * - Штрафные очки вычитаются из итога команды
 */

import type { CompetitionSettings } from "../schema";

// -----------------------------------------------------------
// Типы для калькулятора
// -----------------------------------------------------------

export interface RoundResult {
  winnerTeamSlot: 1 | 2 | null; // null = ничья/отмена
  pointsTeam1: number;
  pointsTeam2: number;
}

export interface PhysicalRoundInput {
  winType: string | null;
  winnerTeamSlot: 1 | 2 | null;
  activation: boolean;
  explosion: boolean;
  deactivation: boolean;
  fragsTeam1: number;
  fragsTeam2: number;
  penaltyPoints: number; // применяется к проигравшей команде или к обеим
  penaltyTeamSlot?: 1 | 2 | null; // кому штраф (null = обеим)
}

export interface MatchScore {
  digitalTeam1: number;
  digitalTeam2: number;
  physicalTeam1: number;
  physicalTeam2: number;
  violationPenaltyTeam1: number;
  violationPenaltyTeam2: number;
  totalTeam1: number;
  totalTeam2: number;
  winnerTeamSlot: 1 | 2 | null;
  isMathematicalWin: boolean; // победа недостижима для второй команды
}

// -----------------------------------------------------------
// Расчёт очков за один раунд цифрового этапа
// -----------------------------------------------------------

/**
 * Рассчитывает очки за один раунд CS2.
 * В базовой модели: победитель получает digitalRoundWinPts.
 *
 * @param winnerTeamSlot - слот победителя (1 или 2) или null
 * @param settings - настройки соревнования
 */
export function calcDigitalRoundPoints(
  winnerTeamSlot: 1 | 2 | null,
  settings: Pick<CompetitionSettings, "digitalRoundWinPts">
): RoundResult {
  if (winnerTeamSlot === null) {
    return { winnerTeamSlot: null, pointsTeam1: 0, pointsTeam2: 0 };
  }
  return {
    winnerTeamSlot,
    pointsTeam1: winnerTeamSlot === 1 ? settings.digitalRoundWinPts : 0,
    pointsTeam2: winnerTeamSlot === 2 ? settings.digitalRoundWinPts : 0,
  };
}

// -----------------------------------------------------------
// Расчёт очков за один раунд физического этапа (лазертаг)
// -----------------------------------------------------------

/**
 * Рассчитывает очки за один раунд физического этапа.
 *
 * Правила начисления очков (по умолчанию):
 * - activation (A): 2 очка победителю
 * - explosion (P): 3 очка победителю
 * - deactivation (D): 1 очко победителю
 * - frag_win (убийство всех): 1 очко победителю
 * - Флаги могут комбинироваться (например A+P = 5 очков)
 *
 * Штрафные очки (penalty_points) — всегда отдельное поле раунда.
 * Никогда не хранятся в других полях.
 */
export function calcPhysicalRoundPoints(
  input: PhysicalRoundInput,
  settings: Pick<
    CompetitionSettings,
    | "physActivationPts"
    | "physExplosionPts"
    | "physDeactivationPts"
    | "physFragWinPts"
  >
): RoundResult {
  if (input.winnerTeamSlot === null) {
    return { winnerTeamSlot: null, pointsTeam1: 0, pointsTeam2: 0 };
  }

  let winnerPoints = 0;

  // Суммируем очки по флагам активности
  if (input.activation) winnerPoints += settings.physActivationPts;
  if (input.explosion) winnerPoints += settings.physExplosionPts;
  if (input.deactivation) winnerPoints += settings.physDeactivationPts;

  // Победа по фрагам (если нет флагов или тип frag_win)
  if (input.winType === "frag_win" || winnerPoints === 0) {
    winnerPoints = Math.max(winnerPoints, settings.physFragWinPts);
  }

  return {
    winnerTeamSlot: input.winnerTeamSlot,
    pointsTeam1: input.winnerTeamSlot === 1 ? winnerPoints : 0,
    pointsTeam2: input.winnerTeamSlot === 2 ? winnerPoints : 0,
  };
}

// -----------------------------------------------------------
// Расчёт итогового счёта матча
// -----------------------------------------------------------

/**
 * Рассчитывает полный итоговый счёт матча.
 *
 * Входные данные приходят из БД уже посчитанные по раундам.
 * Здесь только агрегируем и применяем веса и штрафы.
 *
 * Порядок расчёта:
 * 1. Суммируем очки цифрового этапа по раундам
 * 2. Суммируем очки физического этапа по раундам
 * 3. Вычитаем штрафные очки из нарушений
 * 4. Применяем весовые коэффициенты этапов
 * 5. Определяем победителя
 * 6. Проверяем математическую победу
 */
export function calcMatchScore(params: {
  digitalPointsTeam1: number;
  digitalPointsTeam2: number;
  physicalPointsTeam1: number;
  physicalPointsTeam2: number;
  violationPenaltyTeam1: number;
  violationPenaltyTeam2: number;
  settings: Pick<CompetitionSettings, "digitalWeight" | "physicalWeight">;
  // Параметры для математической победы
  remainingDigitalRounds?: number;
  remainingPhysicalRounds?: number;
  maxDigitalRoundPts?: number;
  maxPhysicalRoundPts?: number;
}): MatchScore {
  const {
    digitalPointsTeam1,
    digitalPointsTeam2,
    physicalPointsTeam1,
    physicalPointsTeam2,
    violationPenaltyTeam1,
    violationPenaltyTeam2,
    settings,
  } = params;

  // Взвешенные очки этапов с учётом весовых коэффициентов
  const weightedDigital1 = digitalPointsTeam1 * settings.digitalWeight;
  const weightedDigital2 = digitalPointsTeam2 * settings.digitalWeight;
  const weightedPhysical1 = physicalPointsTeam1 * settings.physicalWeight;
  const weightedPhysical2 = physicalPointsTeam2 * settings.physicalWeight;

  // Итог = цифровой + физический - штрафы
  const total1 = weightedDigital1 + weightedPhysical1 - violationPenaltyTeam1;
  const total2 = weightedDigital2 + weightedPhysical2 - violationPenaltyTeam2;

  let winnerTeamSlot: 1 | 2 | null = null;
  if (total1 > total2) winnerTeamSlot = 1;
  else if (total2 > total1) winnerTeamSlot = 2;

  // Проверка математической победы (победа недостижима для проигрывающей команды)
  let isMathematicalWin = false;
  if (params.remainingDigitalRounds !== undefined &&
      params.remainingPhysicalRounds !== undefined &&
      params.maxDigitalRoundPts !== undefined &&
      params.maxPhysicalRoundPts !== undefined) {
    const maxPossibleForLoser =
      params.remainingDigitalRounds * params.maxDigitalRoundPts * settings.digitalWeight +
      params.remainingPhysicalRounds * params.maxPhysicalRoundPts * settings.physicalWeight;

    if (winnerTeamSlot === 1 && total1 > total2 + maxPossibleForLoser) {
      isMathematicalWin = true;
    } else if (winnerTeamSlot === 2 && total2 > total1 + maxPossibleForLoser) {
      isMathematicalWin = true;
    }
  }

  return {
    digitalTeam1: weightedDigital1,
    digitalTeam2: weightedDigital2,
    physicalTeam1: weightedPhysical1,
    physicalTeam2: weightedPhysical2,
    violationPenaltyTeam1,
    violationPenaltyTeam2,
    totalTeam1: Math.max(0, total1), // не уходим в отрицательные значения
    totalTeam2: Math.max(0, total2),
    winnerTeamSlot,
    isMathematicalWin,
  };
}

// -----------------------------------------------------------
// Определение стороны команды по номеру раунда
// -----------------------------------------------------------

/**
 * Определяет сторону команды (T/CT) в конкретном раунде цифрового этапа.
 *
 * Правила CS2:
 * - Первая половина (раунды 1-half1): стартовая сторона
 * - Вторая половина (раунды half1+1 - half1+half2): стороны меняются
 * - Овертайм: чередование через каждые 3 раунда (MR3)
 */
export function getDigitalSideForRound(params: {
  roundNumber: number;
  teamSlot: 1 | 2;
  team1StartSide: "T" | "CT";
  team2StartSide: "T" | "CT";
  half1Rounds: number;
  half2Rounds: number;
}): "T" | "CT" {
  const { roundNumber, teamSlot, team1StartSide, team2StartSide, half1Rounds } = params;

  const startSide = teamSlot === 1 ? team1StartSide : team2StartSide;
  const oppositeSide = startSide === "T" ? "CT" : "T";

  if (roundNumber <= half1Rounds) {
    // Первая половина — стартовая сторона
    return startSide;
  }
  // Вторая половина и овертайм — стороны меняются
  return oppositeSide;
}

/**
 * Определяет сторону команды (attack/defense) в раунде физического этапа.
 *
 * Правила лазертага:
 * - Первые physSideSwitchRound раундов: стартовые стороны
 * - После physSideSwitchRound: стороны меняются
 */
export function getPhysicalSideForRound(params: {
  roundNumber: number;
  teamSlot: 1 | 2;
  team1StartSide: "attack" | "defense";
  team2StartSide: "attack" | "defense";
  sideSwitchRound: number;
}): "attack" | "defense" {
  const { roundNumber, teamSlot, team1StartSide, team2StartSide, sideSwitchRound } = params;

  const startSide = teamSlot === 1 ? team1StartSide : team2StartSide;
  const oppositeSide = startSide === "attack" ? "defense" : "attack";

  return roundNumber <= sideSwitchRound ? startSide : oppositeSide;
}
