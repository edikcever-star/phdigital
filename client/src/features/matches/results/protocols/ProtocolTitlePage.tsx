import React, { useState } from "react";

// -----------------------------------------------------------
// ТИПЫ
// -----------------------------------------------------------
type DbBool = boolean | 0 | 1 | null | undefined;

export interface MatchPlayerDto {
  id: number;
  fullName?: string;
  displayName?: string;
  number?: number | null;
  jerseyNumber?: number | null;
  playedDigital?: DbBool;
  playedPhysical?: DbBool;
}

export interface OfficialDto {
  id: number;
  fullName: string;
  role: string;
}

export interface MatchTeamSlot {
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

export interface ProtocolTitlePageProps {
  match: {
    id: number;
    stage: string | null;
    matchNumber: string | null;
    scheduledAt: string | null;
    expectedViewers: number | null;
    
    // Поля счета
    scoreDigitalTeam1?: number | null;
    scoreDigitalTeam2?: number | null;
    scorePhysicalTeam1?: number | null;
    scorePhysicalTeam2?: number | null;
    scoreTotalTeam1?: number | null;
    scoreTotalTeam2?: number | null;
    
    // Статистика, замены, нарушения (для второй страницы)
    team1Stats?: { frags?: number; deaths?: number; acp?: number; pcp?: number; dcp?: number };
    team2Stats?: { frags?: number; deaths?: number; acp?: number; pcp?: number; dcp?: number };
    substitutions?: Array<{ teamName?: string; playerOut?: string; playerIn?: string; time?: string }>;
    violations?: Array<{ type?: 'warning' | 'disqualification'; playerName?: string; teamName?: string; reason?: string; time?: string }>;
    staff?: Array<{ role: string; fullName: string }>;
  };
  team1: MatchTeamSlot;
  team2: MatchTeamSlot;
  competition: {
    name: string;
    venue: string | null;
  };
}

// -----------------------------------------------------------
// ХЕЛПЕРЫ
// -----------------------------------------------------------
const toBool = (value: DbBool, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  return fallback;
};

// Интерактивная ячейка с галочкой (✓)
function MarkCell({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <button
      type="button"
      onClick={() => setChecked((v) => !v)}
      className="w-full min-h-[24px] flex items-center justify-center text-base font-bold outline-none hover:bg-gray-100 transition-colors"
    >
      {checked ? "✓" : ""}
    </button>
  );
}

// -----------------------------------------------------------
// КОМПОНЕНТ
// -----------------------------------------------------------
export const ProtocolTitlePage: React.FC<ProtocolTitlePageProps> = ({
  match,
  team1,
  team2,
  competition,
}) => {
  // Форматирование даты
  let matchTime = "";
  let matchDate = new Date().toLocaleDateString("ru-RU");
  if (match?.scheduledAt) {
    const d = new Date(match.scheduledAt);
    matchTime = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    matchDate = d.toLocaleDateString("ru-RU");
  }

  // --- ДАННЫЕ ДЛЯ ВТОРОЙ СТРАНИЦЫ ---
  const t1Name = team1?.compTeam?.name || "Команда 1";
  const t2Name = team2?.compTeam?.name || "Команда 2";
  const t1Stats = match?.team1Stats || {};
  const t2Stats = match?.team2Stats || {};
  const subs = match?.substitutions || [];
  const warnings = match?.violations?.filter(v => v.type === 'warning') || [];
  const dqs = match?.violations?.filter(v => v.type === 'disqualification') || [];
  
  const matchJudge = match?.staff?.find(s => s.role === 'match_judge')?.fullName || "";
  const digitalJudge = match?.staff?.find(s => s.role === 'digital_judge')?.fullName || "";
  const physicalJudge = match?.staff?.find(s => s.role === 'physical_judge')?.fullName || "";
  const secretary = match?.staff?.find(s => s.role === 'secretary')?.fullName || "";

  const getRepresentative = (team: any) => {
    const rep = team?.officials?.find((o: any) => o.role?.toLowerCase().includes("представитель"));
    return rep?.fullName || "";
  };
  const t1Rep = getRepresentative(team1);
  const t2Rep = getRepresentative(team2);

  // Заглушки пустых строк для игроков (Страница 1)
  const renderEmptyRows = (count: number, startIdx: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <tr key={`empty-${i}`}>
        <td className="border border-black py-1 px-2 text-center text-sm">{startIdx + i}</td>
        <td className="border border-black py-1 px-2"></td>
        <td className="border border-black py-1 px-2 text-center"><MarkCell defaultChecked={false} /></td>
        <td className="border border-black py-1 px-2 text-center"><MarkCell defaultChecked={false} /></td>
      </tr>
    ));
  };

  // Рендер официальных лиц (Страница 1)
  const renderOfficials = (officials: OfficialDto[] = []) => {
    const rows = [];
    const source = officials?.length ? officials : [
      { id: -1, fullName: "", role: "Тренер" },
      { id: -2, fullName: "", role: "Представитель" },
    ];

    for (let i = 0; i < Math.max(2, source.length); i++) {
      const off = source[i] ?? { id: -(i + 1), fullName: "", role: "" };
      rows.push(
        <tr key={off.id}>
          <td className="border border-black py-1 px-2 text-center text-sm">{i + 1}</td>
          <td colSpan={2} className="border border-black py-1 px-2">
            <input type="text" defaultValue={off.fullName || ""} placeholder={i === 0 ? "ФИО тренера" : "ФИО представителя"} className="w-full bg-transparent outline-none text-sm" />
          </td>
          <td className="border border-black py-1 px-2">
            <input type="text" defaultValue={off.role || ""} className="w-full text-center bg-transparent outline-none text-sm" />
          </td>
        </tr>
      );
    }
    return rows;
  };

  // Хелперы для таблиц (Страница 2)
  const renderSubsRows = (count: number) => {
    return Array.from({ length: Math.max(count, subs.length) }).map((_, i) => {
      const sub = subs[i] || {};
      return (
        <tr key={i}>
          <td className="border border-black py-1 px-1">{i + 1}</td>
          <td className="border border-black py-0"><input type="text" defaultValue={sub.teamName || ""} className="w-full text-center outline-none bg-transparent" /></td>
          <td className="border border-black py-0"><input type="text" defaultValue={sub.playerOut || ""} className="w-full text-center outline-none bg-transparent" /></td>
          <td className="border border-black py-0"><input type="text" defaultValue={sub.playerIn || ""} className="w-full text-center outline-none bg-transparent" /></td>
          <td className="border border-black py-0"><input type="text" defaultValue={sub.time || ""} className="w-full text-center outline-none bg-transparent" /></td>
        </tr>
      );
    });
  };

  const renderViolationRows = (arr: any[], minCount: number) => {
    return Array.from({ length: Math.max(minCount, arr.length) }).map((_, i) => {
      const v = arr[i] || {};
      return (
        <tr key={i}>
          <td className="border border-black py-1 px-1">{i + 1}</td>
          <td className="border border-black py-0 px-1 text-left"><input type="text" defaultValue={v.playerName || ""} className="w-full outline-none bg-transparent" /></td>
          <td className="border border-black py-0"><input type="text" defaultValue={v.teamName || ""} className="w-full text-center outline-none bg-transparent" /></td>
          <td className="border border-black py-0 px-1 text-left"><input type="text" defaultValue={v.reason || ""} className="w-full outline-none bg-transparent" /></td>
          <td className="border border-black py-0"><input type="text" defaultValue={v.time || ""} className="w-full text-center outline-none bg-transparent" /></td>
        </tr>
      );
    });
  };

  return (
    <div className="font-sans print:w-full">
      
      {/* ============================================================== */}
      {/* СТРАНИЦА 1: ЗАЯВКИ КОМАНД */}
      {/* ============================================================== */}
      <div className="bg-white text-black w-[210mm] min-h-[297mm] mx-auto p-8 print:p-0 print:break-after-page mb-8 print:mb-0">
        
        {/* ЗАГОЛОВОК */}
        <div className="text-center font-bold mb-6 border-2 border-blue-800 p-2">
          <div className="text-xl">ПРОТОКОЛ МАТЧА</div>
          <textarea 
            rows={2} 
            defaultValue={competition?.name || "НАЗВАНИЕ СОРЕВНОВАНИЯ"} 
            className="w-full text-center bg-transparent outline-none uppercase text-lg leading-tight resize-none font-bold overflow-hidden" 
          />
          <div className="uppercase text-md mt-1">ДИСЦИПЛИНА «Двоеборье - тактическая стрельба»</div>
          <div className="uppercase text-md mt-1">ВИД ПРОГРАММЫ «CS2 + ЛАЗЕРТАГ»</div>
        </div>

        {/* ИНФО О МАТЧЕ (Таблица) */}
        <table className="w-full border-collapse border border-black mb-6 text-sm text-center">
          <tbody>
            <tr>
              <td className="border border-black p-2 font-semibold w-[200px] text-left">Адрес:</td>
              <td colSpan={2} className="border border-black p-2 text-left">
                <input type="text" defaultValue={competition?.venue || ""} placeholder="Место проведения" className="w-full outline-none bg-transparent" />
              </td>
              <td className="border border-black p-2 w-[150px]">
                <input type="text" defaultValue={matchDate} placeholder="ДД.ММ.ГГГГ" className="w-full text-center outline-none bg-transparent" />
              </td>
            </tr>
            <tr className="bg-gray-100 font-semibold">
              <td className="border border-black p-2">Время начала матча</td>
              <td className="border border-black p-2">Стадия Соревнования</td>
              <td colSpan={2} className="border border-black p-2">Количество зрителей</td>
            </tr>
            <tr>
              <td className="border border-black p-2">
                <input type="text" defaultValue={matchTime} placeholder="ЧЧ:ММ" className="w-full text-center outline-none bg-transparent" />
              </td>
              <td className="border border-black p-2">
                <input type="text" defaultValue={match?.stage || match?.matchNumber || `Матч ${match?.id}`} className="w-full text-center outline-none bg-transparent" />
              </td>
              <td colSpan={2} className="border border-black p-2">
                <input type="text" defaultValue={match?.expectedViewers || ""} placeholder="-" className="w-full text-center outline-none bg-transparent" />
              </td>
            </tr>
          </tbody>
        </table>

        {/* ЗАЯВКА КОМАНДЫ 1 */}
        <div className="font-bold text-center bg-gray-200 border border-black py-1 uppercase text-sm border-b-0">Заявка Команды 1</div>
        <table className="w-full border-collapse border border-black mb-6 text-sm text-center">
          <thead>
            <tr className="bg-gray-100">
              <th colSpan={2} className="border border-black p-1 font-semibold w-1/2">Название команды</th>
              <th colSpan={2} className="border border-black p-1 font-semibold w-1/2">Регион</th>
            </tr>
            <tr>
              <th colSpan={2} className="border border-black p-1 font-bold text-lg"><input type="text" defaultValue={team1?.compTeam?.name || "Команда 1"} className="w-full text-center outline-none bg-transparent font-bold" /></th>
              <th colSpan={2} className="border border-black p-1"><input type="text" defaultValue={team1?.compTeam?.region || ""} placeholder="Регион" className="w-full text-center outline-none bg-transparent" /></th>
            </tr>
            <tr className="bg-gray-100">
              <th className="border border-black p-1 w-10">№</th>
              <th className="border border-black p-1">Ф.И.О</th>
              <th className="border border-black p-1 w-32">Цифровой этап</th>
              <th className="border border-black p-1 w-32">Физический этап</th>
            </tr>
          </thead>
          <tbody>
            {team1?.players?.slice(0, 7).map((p, idx) => (
              <tr key={p.id}>
                <td className="border border-black py-1 px-2">{idx + 1}</td>
                <td className="border border-black py-1 px-2 text-left">
                   <input type="text" defaultValue={p.fullName || p.displayName || ""} className="w-full outline-none bg-transparent text-sm" />
                </td>
                <td className="border border-black py-1 px-2 font-bold p-0">
                  <MarkCell defaultChecked={toBool(p.playedDigital, true)} />
                </td>
                <td className="border border-black py-1 px-2 font-bold p-0">
                  <MarkCell defaultChecked={toBool(p.playedPhysical, true)} />
                </td>
              </tr>
            ))}
            {renderEmptyRows(Math.max(0, 7 - (team1?.players?.length || 0)), (team1?.players?.length || 0) + 1)}
            
            <tr className="bg-gray-200 font-semibold">
              <td colSpan={4} className="border border-black p-1">Официальные лица команды</td>
            </tr>
            <tr className="bg-gray-100 font-semibold">
              <td className="border border-black p-1">№</td>
              <td colSpan={2} className="border border-black p-1">ФИО</td>
              <td className="border border-black p-1">Должность</td>
            </tr>
            {renderOfficials(team1?.officials)}
            <tr className="bg-gray-200">
              <td colSpan={2} className="border border-black p-2 font-bold text-center">Представитель</td>
              <td className="border border-black p-2 text-center text-xs text-gray-500">Подпись</td>
              <td className="border border-black p-2 text-center text-xs text-gray-500">ФИО</td>
            </tr>
          </tbody>
        </table>

        {/* ЗАЯВКА КОМАНДЫ 2 */}
        <div className="font-bold text-center bg-gray-200 border border-black py-1 uppercase text-sm border-b-0">Заявка Команды 2</div>
        <table className="w-full border-collapse border border-black mb-6 text-sm text-center">
          <thead>
            <tr className="bg-gray-100">
              <th colSpan={2} className="border border-black p-1 font-semibold w-1/2">Название команды</th>
              <th colSpan={2} className="border border-black p-1 font-semibold w-1/2">Регион</th>
            </tr>
            <tr>
              <th colSpan={2} className="border border-black p-1 font-bold text-lg"><input type="text" defaultValue={team2?.compTeam?.name || "Команда 2"} className="w-full text-center outline-none bg-transparent font-bold" /></th>
              <th colSpan={2} className="border border-black p-1"><input type="text" defaultValue={team2?.compTeam?.region || ""} placeholder="Регион" className="w-full text-center outline-none bg-transparent" /></th>
            </tr>
            <tr className="bg-gray-100">
              <th className="border border-black p-1 w-10">№</th>
              <th className="border border-black p-1">Ф.И.О</th>
              <th className="border border-black p-1 w-32">Цифровой этап</th>
              <th className="border border-black p-1 w-32">Физический этап</th>
            </tr>
          </thead>
          <tbody>
            {team2?.players?.slice(0, 7).map((p, idx) => (
              <tr key={p.id}>
                <td className="border border-black py-1 px-2">{idx + 1}</td>
                <td className="border border-black py-1 px-2 text-left">
                   <input type="text" defaultValue={p.fullName || p.displayName || ""} className="w-full outline-none bg-transparent text-sm" />
                </td>
                <td className="border border-black py-1 px-2 font-bold p-0">
                  <MarkCell defaultChecked={toBool(p.playedDigital, true)} />
                </td>
                <td className="border border-black py-1 px-2 font-bold p-0">
                  <MarkCell defaultChecked={toBool(p.playedPhysical, true)} />
                </td>
              </tr>
            ))}
            {renderEmptyRows(Math.max(0, 7 - (team2?.players?.length || 0)), (team2?.players?.length || 0) + 1)}
            
            <tr className="bg-gray-200 font-semibold">
              <td colSpan={4} className="border border-black p-1">Официальные лица команды</td>
            </tr>
            <tr className="bg-gray-100 font-semibold">
              <td className="border border-black p-1">№</td>
              <td colSpan={2} className="border border-black p-1">ФИО</td>
              <td className="border border-black p-1">Должность</td>
            </tr>
            {renderOfficials(team2?.officials)}
            <tr className="bg-gray-200">
              <td colSpan={2} className="border border-black p-2 font-bold text-center">Представитель</td>
              <td className="border border-black p-2 text-center text-xs text-gray-500">Подпись</td>
              <td className="border border-black p-2 text-center text-xs text-gray-500">ФИО</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ============================================================== */}
      {/* СТРАНИЦА 2: ИТОГОВЫЙ РЕЗУЛЬТАТ (ТВОЯ КАРТИНКА) */}
      {/* ============================================================== */}
      <div className="bg-white text-black w-[210mm] min-h-[297mm] mx-auto p-[10mm] print:p-0">
        
        {/* ТАБЛИЦА 1: ИТОГОВЫЙ РЕЗУЛЬТАТ */}
        <table className="w-full border-collapse border border-black text-center text-[13px] font-semibold mb-2">
          <tbody>
            <tr>
              <td colSpan={11} className="border border-black bg-blue-50 text-blue-900 font-bold text-lg p-1.5">
                Итоговый результат
              </td>
            </tr>
            
            <tr>
              <td rowSpan={3} colSpan={2} className="border border-black bg-[#d9d9d9] font-bold text-base w-[20%]">
                <input type="text" defaultValue={t1Name} className="w-full text-center outline-none bg-transparent font-bold" />
              </td>
              <td colSpan={3} className="border border-black font-bold text-base w-[18%]">
                <input type="text" defaultValue={match?.scoreTotalTeam1 ?? ""} className="w-full text-center outline-none bg-transparent font-bold" />
              </td>
              <td className="border border-black bg-[#e6e6e6] font-bold w-[24%] p-1">Итоговый счет</td>
              <td colSpan={3} className="border border-black font-bold text-base w-[18%]">
                <input type="text" defaultValue={match?.scoreTotalTeam2 ?? ""} className="w-full text-center outline-none bg-transparent font-bold" />
              </td>
              <td rowSpan={3} colSpan={2} className="border border-black bg-[#d9d9d9] font-bold text-base w-[20%]">
                <input type="text" defaultValue={t2Name} className="w-full text-center outline-none bg-transparent font-bold" />
              </td>
            </tr>

            <tr>
              <td colSpan={3} className="border border-black">
                <input type="text" defaultValue={match?.scoreDigitalTeam1 ?? ""} className="w-full text-center outline-none bg-transparent" />
              </td>
              <td className="border border-black bg-[#e6e6e6] p-1">Цифровой сегмент</td>
              <td colSpan={3} className="border border-black">
                <input type="text" defaultValue={match?.scoreDigitalTeam2 ?? ""} className="w-full text-center outline-none bg-transparent" />
              </td>
            </tr>

            <tr>
              <td colSpan={3} className="border border-black">
                <input type="text" defaultValue={match?.scorePhysicalTeam1 ?? ""} className="w-full text-center outline-none bg-transparent" />
              </td>
              <td className="border border-black bg-[#e6e6e6] p-1">Физический сегмент</td>
              <td colSpan={3} className="border border-black">
                <input type="text" defaultValue={match?.scorePhysicalTeam2 ?? ""} className="w-full text-center outline-none bg-transparent" />
              </td>
            </tr>

            <tr>
              <td className="border border-black bg-[#e6e6e6] p-1 w-[10%]">Фраги</td>
              <td className="border border-black bg-[#e6e6e6] p-1 w-[10%]">Смерти</td>
              <td className="border border-black bg-[#e6e6e6] p-1 w-[6%] text-[11px]">АЦП</td>
              <td className="border border-black bg-[#e6e6e6] p-1 w-[6%] text-[11px]">ПЦП</td>
              <td className="border border-black bg-[#e6e6e6] p-1 w-[6%] text-[11px]">ДЦП</td>
              
              <td rowSpan={2} className="border border-black bg-[#e6e6e6] p-1 font-bold leading-tight">
                Доп.<br />Показатели
              </td>
              
              <td className="border border-black bg-[#e6e6e6] p-1 w-[6%] text-[11px]">АЦП</td>
              <td className="border border-black bg-[#e6e6e6] p-1 w-[6%] text-[11px]">ПЦП</td>
              <td className="border border-black bg-[#e6e6e6] p-1 w-[6%] text-[11px]">ДЦП</td>
              <td className="border border-black bg-[#e6e6e6] p-1 w-[10%]">Фраги</td>
              <td className="border border-black bg-[#e6e6e6] p-1 w-[10%]">Смерти</td>
            </tr>

            <tr className="bg-[#f2f2f2]">
              <td className="border border-black p-1"><input type="text" defaultValue={t1Stats?.frags ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
              <td className="border border-black p-1"><input type="text" defaultValue={t1Stats?.deaths ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
              <td className="border border-black p-1"><input type="text" defaultValue={t1Stats?.acp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
              <td className="border border-black p-1"><input type="text" defaultValue={t1Stats?.pcp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
              <td className="border border-black p-1"><input type="text" defaultValue={t1Stats?.dcp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
              
              <td className="border border-black p-1"><input type="text" defaultValue={t2Stats?.acp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
              <td className="border border-black p-1"><input type="text" defaultValue={t2Stats?.pcp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
              <td className="border border-black p-1"><input type="text" defaultValue={t2Stats?.dcp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
              <td className="border border-black p-1"><input type="text" defaultValue={t2Stats?.frags ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
              <td className="border border-black p-1"><input type="text" defaultValue={t2Stats?.deaths ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
            </tr>
          </tbody>
        </table>

        {/* Легенда */}
        <div className="text-[12px] font-bold text-left mb-6 leading-tight">
          АЦП – Активация Цифрового пламени<br />
          ПЦП – Подрыв Цифрового пламени<br />
          ДЦП – Деактивация Цифрового пламени
        </div>

        {/* ТАБЛИЦА 2: ЗАМЕНЫ */}
        <div className="text-center font-bold text-[15px] mb-1">Замены</div>
        <table className="w-full border-collapse border border-black text-[13px] text-center mb-6">
          <thead>
            <tr className="bg-[#e6e6e6]">
              <th className="border border-black p-1 w-8">№</th>
              <th className="border border-black p-1 w-[25%]">Команда</th>
              <th className="border border-black p-1 w-[25%]">Вышел</th>
              <th className="border border-black p-1 w-[25%]">Зашел</th>
              <th className="border border-black p-1 w-[20%]">Время</th>
            </tr>
          </thead>
          <tbody>
            {renderSubsRows(4)}
          </tbody>
        </table>

        {/* ТАБЛИЦА 3: НАРУШЕНИЯ ПРАВИЛ */}
        <div className="text-center font-bold text-[15px] mb-1">Нарушения правил</div>
        <table className="w-full border-collapse border border-black text-[13px] text-center mb-6">
          <thead>
            <tr className="bg-[#e6e6e6]">
              <th className="border border-black p-1 w-8">№</th>
              <th className="border border-black p-1 w-[35%]">Ф.И.О</th>
              <th className="border border-black p-1 w-[20%]">Команда</th>
              <th className="border border-black p-1 w-[25%]">Причина</th>
              <th className="border border-black p-1 w-[15%]">Время</th>
            </tr>
            <tr className="bg-[#e6e6e6]">
              <td colSpan={5} className="border border-black font-bold p-1">Предупреждения</td>
            </tr>
          </thead>
          <tbody>
            {renderViolationRows(warnings, 3)}
            <tr className="bg-[#e6e6e6]">
              <td colSpan={5} className="border border-black font-bold p-1">Дисквалификации</td>
            </tr>
            {renderViolationRows(dqs, 2)}
          </tbody>
        </table>

        {/* ПРОЧИЕ ЗАМЕЧАНИЯ */}
        <div className="text-left font-bold text-[15px] mb-2">Прочие замечания:</div>
        <textarea className="w-full border-b border-black outline-none bg-transparent resize-none h-12 text-[13px]" />

        {/* ПОДПИСИ */}
        <table className="w-full border-collapse border border-black text-[13px] text-center mt-6 font-bold">
          <thead>
            <tr>
              <th className="border border-black p-2 w-[35%]">Должность</th>
              <th className="border border-black p-2 w-[30%]">Подпись</th>
              <th className="border border-black p-2 w-[35%]">ФИО</th>
            </tr>
          </thead>
          <tbody className="font-semibold text-left">
            <tr>
              <td className="border border-black px-2 py-2.5">Матчевый судья</td>
              <td className="border border-black px-2 py-2.5"></td>
              <td className="border border-black px-2 py-2.5"><input type="text" defaultValue={matchJudge} className="w-full outline-none bg-transparent" /></td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-2.5">Судья цифрового гейма</td>
              <td className="border border-black px-2 py-2.5"></td>
              <td className="border border-black px-2 py-2.5"><input type="text" defaultValue={digitalJudge} className="w-full outline-none bg-transparent" /></td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-2.5">Судья функционального гейма</td>
              <td className="border border-black px-2 py-2.5"></td>
              <td className="border border-black px-2 py-2.5"><input type="text" defaultValue={physicalJudge} className="w-full outline-none bg-transparent" /></td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-2.5">Представитель команды 1</td>
              <td className="border border-black px-2 py-2.5"></td>
              <td className="border border-black px-2 py-2.5"><input type="text" defaultValue={t1Rep} className="w-full outline-none bg-transparent" /></td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-2.5">Представитель команды 2</td>
              <td className="border border-black px-2 py-2.5"></td>
              <td className="border border-black px-2 py-2.5"><input type="text" defaultValue={t2Rep} className="w-full outline-none bg-transparent" /></td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-2.5 font-bold">Секретарь</td>
              <td className="border border-black px-2 py-2.5"></td>
              <td className="border border-black px-2 py-2.5"><input type="text" defaultValue={secretary} className="w-full outline-none bg-transparent" /></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
};