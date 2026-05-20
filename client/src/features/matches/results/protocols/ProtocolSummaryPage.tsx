import React from "react";
import type { ProtocolTitlePageProps } from "./ProtocolTitlePage";

// Расширяем пропсы, чтобы TypeScript знал о полях со статистикой
export interface ProtocolSummaryPageProps extends ProtocolTitlePageProps {
  match: ProtocolTitlePageProps['match'] & {
    team1Stats?: { frags?: number; deaths?: number; acp?: number; pcp?: number; dcp?: number };
    team2Stats?: { frags?: number; deaths?: number; acp?: number; pcp?: number; dcp?: number };
    substitutions?: Array<{ teamName?: string; playerOut?: string; playerIn?: string; time?: string }>;
    violations?: Array<{ type?: 'warning' | 'disqualification'; playerName?: string; teamName?: string; reason?: string; time?: string }>;
    staff?: Array<{ role: string; fullName: string }>;
  };
}

export const ProtocolSummaryPage: React.FC<ProtocolSummaryPageProps> = ({
  match,
  team1,
  team2,
}) => {
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

  return (
    <div className="bg-white text-black w-[210mm] min-h-[297mm] mx-auto p-[10mm] print:p-0 font-sans print:break-after-page shadow-lg print:shadow-none box-border">
      
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
            <td className="border border-black py-1.5"><input type="text" defaultValue={t1Stats?.frags ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
            <td className="border border-black py-1.5"><input type="text" defaultValue={t1Stats?.deaths ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
            <td className="border border-black py-1.5"><input type="text" defaultValue={t1Stats?.acp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
            <td className="border border-black py-1.5"><input type="text" defaultValue={t1Stats?.pcp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
            <td className="border border-black py-1.5"><input type="text" defaultValue={t1Stats?.dcp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
            
            <td className="border border-black py-1.5"><input type="text" defaultValue={t2Stats?.acp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
            <td className="border border-black py-1.5"><input type="text" defaultValue={t2Stats?.pcp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
            <td className="border border-black py-1.5"><input type="text" defaultValue={t2Stats?.dcp ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
            <td className="border border-black py-1.5"><input type="text" defaultValue={t2Stats?.frags ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
            <td className="border border-black py-1.5"><input type="text" defaultValue={t2Stats?.deaths ?? ""} className="w-full text-center outline-none bg-transparent" /></td>
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
      <div className="text-center font-bold text-[16px] mb-2">Прочие замечания:</div>
      <textarea className="w-full outline-none bg-transparent resize-none h-16 mb-6" />

      {/* ПОДПИСИ */}
      <table className="w-full border-collapse border border-black text-[14px] text-center mt-2">
        <thead>
          <tr className="font-bold">
            <td className="border border-black p-2 w-[35%]">Должность</td>
            <td className="border border-black p-2 w-[30%]">Подпись</td>
            <td className="border border-black p-2 w-[35%]">ФИО</td>
          </tr>
        </thead>
        <tbody className="font-bold text-left">
          <tr>
            <td className="border border-black px-2 py-2.5">Матчевый судья</td>
            <td className="border border-black px-2 py-2.5"></td>
            <td className="border border-black px-2 py-2.5 font-normal"><input type="text" defaultValue={matchJudge} className="w-full outline-none bg-transparent" /></td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-2.5">Судья цифрового гейма</td>
            <td className="border border-black px-2 py-2.5"></td>
            <td className="border border-black px-2 py-2.5 font-normal"><input type="text" defaultValue={digitalJudge} className="w-full outline-none bg-transparent" /></td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-2.5">Судья функционального гейма</td>
            <td className="border border-black px-2 py-2.5"></td>
            <td className="border border-black px-2 py-2.5 font-normal"><input type="text" defaultValue={physicalJudge} className="w-full outline-none bg-transparent" /></td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-2.5 font-normal">Представитель команды 1</td>
            <td className="border border-black px-2 py-2.5"></td>
            <td className="border border-black px-2 py-2.5 font-normal"><input type="text" defaultValue={t1Rep} className="w-full outline-none bg-transparent" /></td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-2.5 font-normal">Представитель команды 2</td>
            <td className="border border-black px-2 py-2.5"></td>
            <td className="border border-black px-2 py-2.5 font-normal"><input type="text" defaultValue={t2Rep} className="w-full outline-none bg-transparent" /></td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-2.5">Секретарь</td>
            <td className="border border-black px-2 py-2.5"></td>
            <td className="border border-black px-2 py-2.5 font-normal"><input type="text" defaultValue={secretary} className="w-full outline-none bg-transparent" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};