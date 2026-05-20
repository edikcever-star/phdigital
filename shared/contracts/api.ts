/**
 * API КОНТРАКТЫ — DTO для REST API
 *
 * Эти типы используются как на сервере (формирование ответов),
 * так и на клиенте (типизация запросов и ответов).
 *
 * Принципы:
 * - DTO могут агрегировать данные из нескольких таблиц
 * - Клиент получает готовые агрегаты, а не плоские записи БД
 * - Все вычисляемые поля включены в DTO
 */

import type {
  User,
  Judge,
  MapRecord,
  ViolationTypeRecord,
  GlobalTeam,
  GlobalTeamPlayer,
  GlobalTeamOfficial,
  Competition,
  CompetitionSettings,
  CompetitionTeam,
  CompetitionTeamPlayer,
  CompetitionTeamOfficial,
  Match,
  MatchTeam,
  MatchTeamPlayer,
  MatchTeamOfficial,
  MatchStaff,
  DigitalRound,
  DigitalRoundPlayerStats,
  PhysicalRound,
  PhysicalRoundPlayerStats,
  MatchViolation,
  MatchSubstitution,
  MatchStatus,
  UserRole,
} from "../schema";

// -----------------------------------------------------------
// AUTH
// -----------------------------------------------------------

export interface LoginRequest {
  displayName: string;
  role: UserRole;
  pin?: string;
}

export interface AuthUser {
  id: number;
  displayName: string;
  role: UserRole;
}

// -----------------------------------------------------------
// COMPETITIONS
// -----------------------------------------------------------

export interface CompetitionWithStats extends Competition {
  teamCount: number;
  matchCount: number;
  settings?: CompetitionSettings;
}

export interface CompetitionDetailDTO extends Competition {
  settings: CompetitionSettings;
  teams: CompetitionTeamWithRoster[];
  staff: (MatchStaff & { judge: Judge })[];
  matches: MatchSummaryDTO[];
}

// -----------------------------------------------------------
// TEAMS
// -----------------------------------------------------------

export interface GlobalTeamWithRoster extends GlobalTeam {
  players: GlobalTeamPlayer[];
  officials: GlobalTeamOfficial[];
}

export interface CompetitionTeamWithRoster extends CompetitionTeam {
  players: CompetitionTeamPlayer[];
  officials: CompetitionTeamOfficial[];
}

// -----------------------------------------------------------
// MATCHES
// -----------------------------------------------------------

export interface MatchSummaryDTO {
  id: number;
  competitionId: number;
  matchNumber: string | null;
  stage: string | null;
  scheduledAt: string | null;
  status: MatchStatus;
  team1: { id: number; name: string } | null;
  team2: { id: number; name: string } | null;
  scoreTotalTeam1: number | null;
  scoreTotalTeam2: number | null;
  winnerTeamId: number | null;
}

export interface MatchSetupDTO {
  match: Match;
  teams: Array<MatchTeam & { team: CompetitionTeam }>;
  players: MatchTeamPlayer[];
  officials: MatchTeamOfficial[];
  staff: Array<MatchStaff & { judge: Judge }>;
  mapVeto: import("../schema").MatchMapVeto[];
}

// -----------------------------------------------------------
// DIGITAL PHASE
// -----------------------------------------------------------

export interface DigitalRoundWithStats extends DigitalRound {
  playerStats?: DigitalRoundPlayerStats[];
  // Имена команд для отображения (денормализация для скорости)
  team1Name?: string;
  team2Name?: string;
}

export interface DigitalPhaseDTO {
  rounds: DigitalRoundWithStats[];
  teamStats: {
    team1: {
      compTeamId: number;
      name: string;
      roundsWon: number;
      totalPoints: number;
      totalKills: number;
      totalDeaths: number;
    };
    team2: {
      compTeamId: number;
      name: string;
      roundsWon: number;
      totalPoints: number;
      totalKills: number;
      totalDeaths: number;
    };
  };
  currentHalf: number;
  sidesSwitched: boolean;
}

export interface UpsertDigitalRoundRequest {
  roundNumber: number;
  half?: number;
  activation?: boolean;
  explosion?: boolean;
  deactivation?: boolean;
  result?: string;
  winnerTeamId?: number | null;
  winType?: string | null;
  note?: string | null;
  status?: string;
  extraData?: Record<string, unknown> | null;
  
  // ДОБАВЬ ЭТИ ДВЕ СТРОКИ:
  team1Deaths?: number;
  team2Deaths?: number;
}

// -----------------------------------------------------------
// PHYSICAL PHASE
// -----------------------------------------------------------

export interface PhysicalRoundWithStats extends PhysicalRound {
  playerStats?: PhysicalRoundPlayerStats[];
  team1Name?: string;
  team2Name?: string;
}

export interface PhysicalPhaseDTO {
  rounds: PhysicalRoundWithStats[];
  teamStats: {
    team1: {
      compTeamId: number;
      name: string;
      roundsWon: number;
      totalPoints: number;
      totalFrags: number;
      penaltyPoints: number;
    };
    team2: {
      compTeamId: number;
      name: string;
      roundsWon: number;
      totalPoints: number;
      totalFrags: number;
      penaltyPoints: number;
    };
  };
}

export interface UpsertPhysicalRoundRequest {
  roundNumber: number;
  fragsTeam1?: number;
  fragsTeam2?: number;
  activation?: boolean;
  explosion?: boolean;
  deactivation?: boolean;
  winType?: string | null;
  winnerTeamId?: number | null;
  penaltyPoints?: number;
  note?: string | null;
  status?: string;
}

// -----------------------------------------------------------
// LIVE PROTOCOL
// -----------------------------------------------------------

export interface LiveProtocolDTO {
  match: MatchSummaryDTO;
  currentScore: {
    digitalTeam1: number;
    digitalTeam2: number;
    physicalTeam1: number;
    physicalTeam2: number;
    totalTeam1: number;
    totalTeam2: number;
    violationPenaltyTeam1: number;
    violationPenaltyTeam2: number;
    winnerTeamSlot: 1 | 2 | null;
    isMathematicalWin: boolean;
  };
  digitalRounds: DigitalRoundWithStats[];
  physicalRounds: PhysicalRoundWithStats[];
  violations: MatchViolation[];
  substitutions: MatchSubstitution[];
  presenceUsers: PresenceUserDTO[];
}

// -----------------------------------------------------------
// VIOLATIONS & SUBSTITUTIONS
// -----------------------------------------------------------

export interface ViolationWithDetails extends MatchViolation {
  teamName: string;
  playerName?: string;
  violationTypeName?: string;
  registeredByName?: string;
}

export interface SubstitutionWithDetails extends MatchSubstitution {
  teamName: string;
  playerOutName: string;
  playerInName: string;
}

// -----------------------------------------------------------
// PRESENCE
// -----------------------------------------------------------

export interface PresenceUserDTO {
  userId: number;
  displayName: string;
  role: UserRole;
  currentView: string | null;
  isEditing: string | null;
  connectedAt: string;
}

// -----------------------------------------------------------
// IMPORT
// -----------------------------------------------------------

export interface ImportPreviewRow {
  rowIndex: number;
  data: Record<string, unknown>;
  errors: string[];
  isValid: boolean;
}

export interface ImportPreviewDTO {
  importId: number;
  filename: string;
  importType: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  columns: string[];
  preview: ImportPreviewRow[];
  columnMapping?: Record<string, string>;
}

// -----------------------------------------------------------
// SCORE (для WebSocket и REST)
// -----------------------------------------------------------

export interface ScoreDTO {
  matchId: number;
  digitalTeam1: number;
  digitalTeam2: number;
  physicalTeam1: number;
  physicalTeam2: number;
  totalTeam1: number;
  totalTeam2: number;
  violationPenaltyTeam1: number;
  violationPenaltyTeam2: number;
  winnerTeamId: number | null;
  isMathematicalWin: boolean;
}

// -----------------------------------------------------------
// ОБЩИЕ ТИПЫ ОТВЕТОВ
// -----------------------------------------------------------

export interface ApiSuccess<T = void> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = void> = ApiSuccess<T> | ApiError;
