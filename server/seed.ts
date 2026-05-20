import db from "./db/connection";
import {
  users,
  judges,             // Глобальный справочник судей
  competitions,
  competitionSettings,
  competitionTeams,
  competitionTeamPlayers, // Игроки команд
  competitionStaff,   // Судьи соревнования
  matches,
  matchTeams,
  matchStaff,         // Судьи матча
  digitalRounds,
  physicalRounds
} from "@shared/schema";

console.log("⏳ Начинаем полный сброс базы и посев данных...");

try {
  // 1. Очистка (важен порядок!)
  console.log("🧹 Очистка старых данных...");
  db.delete(digitalRounds).run();
  db.delete(physicalRounds).run();
  db.delete(matchStaff).run();
  db.delete(matchTeams).run();
  db.delete(matches).run();
  db.delete(competitionTeamPlayers).run();
  db.delete(competitionTeams).run();
  db.delete(competitionStaff).run();
  db.delete(competitionSettings).run();
  db.delete(competitions).run();
  db.delete(judges).run();
  db.delete(users).run(); 

  // 2. СОЗДАНИЕ ПОЛЬЗОВАТЕЛЕЙ (ПОЛЬЗОВАТЕЛИ СИСТЕМЫ)
  console.log("👨‍⚖️ Создание системных пользователей...");
  
  // Пароль без хэширования, так как в твоей схеме нет упоминаний bcrypt (только sha256 или plaintext)
  const pwd = "password123"; 

  const chiefUser = db.insert(users).values({
    displayName: "Алексей Иванов (Главный Судья)",
    role: "chief_judge",
    pinHash: null,
  }).returning().get();

  const secUser = db.insert(users).values({
    displayName: "Мария Смирнова (Главный Секретарь)",
    role: "chief_secretary",
    pinHash: null,
  }).returning().get();

  const techUser = db.insert(users).values({
    displayName: "Иван Техников (Тех. Секретарь)",
    role: "tech_secretary",
    pinHash: null,
  }).returning().get();

  // 3. СОЗДАНИЕ СУДЕЙ (СПРАВОЧНИК)
  console.log("👨‍⚖️ Заполнение справочника судей...");
  const chiefJudgeInfo = db.insert(judges).values({ fullName: "Алексей Иванов", category: "1 категория", defaultRole: "chief_judge" }).returning().get();
  const secretaryInfo = db.insert(judges).values({ fullName: "Мария Смирнова", category: "2 категория", defaultRole: "secretary" }).returning().get();
  const techJudgeInfo = db.insert(judges).values({ fullName: "Иван Техников", category: "2 категория", defaultRole: "tech_secretary" }).returning().get();

  // 4. СОЗДАНИЕ ТУРНИРА И НАСТРОЕК
  console.log("🏆 Создание турнира...");
  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);

  const comp = db.insert(competitions).values({
    name: "Phygital CS2 Championship 2026",
    status: "active",
    startDate: now.toISOString(),
    endDate: nextWeek.toISOString(),
    format: "olympic",
    createdBy: chiefUser.id,
  }).returning().get();

  db.insert(competitionSettings).values({
    competitionId: comp.id,
    digitalRoundWinPts: 1,
    physActivationPts: 2,
    physExplosionPts: 3,
    physDeactivationPts: 3,
    physFragWinPts: 2,
  }).run();

  // Добавляем судей в соревнование
  db.insert(competitionStaff).values([
    { competitionId: comp.id, judgeId: chiefJudgeInfo.id, staffRole: "chief_judge" },
    { competitionId: comp.id, judgeId: secretaryInfo.id, staffRole: "secretary" },
    { competitionId: comp.id, judgeId: techJudgeInfo.id, staffRole: "tech_secretary" },
  ]).run();

  // 5. СОЗДАНИЕ КОМАНД
  console.log("🛡️ Создание команд...");
  const vpTeam = db.insert(competitionTeams).values({
    competitionId: comp.id,
    name: "Virtus.pro",
  }).returning().get();

  const naviTeam = db.insert(competitionTeams).values({
    competitionId: comp.id,
    name: "Natus Vincere",
  }).returning().get();

  // 6. СОЗДАНИЕ ИГРОКОВ (в локальной команде соревнования)
  console.log("🎮 Создание игроков и составов (по 5 человек)...");
  
  const vpPlayersData = [
    { fullName: "Jame (Dzhami Ali)", number: 1, isReserve: false, isCaptain: true },
    { fullName: "FL1T (Evgenii Lebedev)", number: 2, isReserve: false, isCaptain: false },
    { fullName: "fame (Petr Bolyshev)", number: 3, isReserve: false, isCaptain: false },
    { fullName: "n0rb3r7 (David Danielyan)", number: 4, isReserve: false, isCaptain: false },
    { fullName: "mir (Nikolay Bityukov)", number: 5, isReserve: false, isCaptain: false },
  ];

  for (const p of vpPlayersData) {
    db.insert(competitionTeamPlayers).values({
      compTeamId: vpTeam.id,
      ...p
    }).run();
  }

  const naviPlayersData = [
    { fullName: "Aleksib (Aleksi Virolainen)", number: 1, isReserve: false, isCaptain: true },
    { fullName: "b1t (Valerij Vakhovsjkyj)", number: 2, isReserve: false, isCaptain: false },
    { fullName: "iM (Mihai Ivan)", number: 3, isReserve: false, isCaptain: false },
    { fullName: "jL (Justinas Lekavicius)", number: 4, isReserve: false, isCaptain: false },
    { fullName: "w0nderful (Ihor Zhdanov)", number: 5, isReserve: false, isCaptain: false },
  ];

  for (const p of naviPlayersData) {
    db.insert(competitionTeamPlayers).values({
      compTeamId: naviTeam.id,
      ...p
    }).run();
  }

  // 7. СОЗДАНИЕ МАТЧА
  console.log("⚔️ Создание матча Гранд-Финала...");
  const match = db.insert(matches).values({
    competitionId: comp.id,
    matchNumber: "Grand Final",
    stage: "Playoff",
    status: "setup", 
    createdBy: chiefUser.id,
  }).returning().get();

  // Привязываем команды к матчу
  db.insert(matchTeams).values([
    {
      matchId: match.id,
      compTeamId: vpTeam.id,
      teamSlot: 1,
      digitalStartSide: "CT",
      physicalStartSide: "defense",
    },
    {
      matchId: match.id,
      compTeamId: naviTeam.id,
      teamSlot: 2,
      digitalStartSide: "T",
      physicalStartSide: "attack",
    }
  ]).run();

  // Привязываем судей к матчу
  db.insert(matchStaff).values([
    { matchId: match.id, judgeId: chiefJudgeInfo.id, staffRole: "chief_judge" },
    { matchId: match.id, judgeId: secretaryInfo.id, staffRole: "secretary" },
    { matchId: match.id, judgeId: techJudgeInfo.id, staffRole: "digital_judge" }
  ]).run();

  console.log("\n========================================================");
  console.log("✅ БАЗА ИДЕАЛЬНО ЗАПОЛНЕНА!");
  console.log("🏆 Турнир: Phygital CS2 Championship 2026");
  console.log("⚔️ Матч (Гранд Финал): Virtus.pro vs Natus Vincere");
  console.log(`🆔 ID созданного матча: ${match.id}`);
  console.log("========================================================\n");
  
} catch (error) {
  console.error("❌ Ошибка при заполнении базы:", error);
}