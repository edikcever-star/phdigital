import React from "react";
import type { ProtocolTitlePageProps } from "./ProtocolTitlePage";

export const ProtocolPhysicalPage: React.FC<ProtocolTitlePageProps> = ({ team1, team2, competition }) => {
  const renderPlayers = (team: any) => {
    const players = team?.players?.filter((p: any) => p.playedPhysical !== false).slice(0, 5) || [];
    
    return (
      <table className="w-full border-collapse border border-black mb-6 text-sm text-center">
        <thead>
          <tr className="bg-gray-200">
            <th colSpan={5} className="border border-black p-1 uppercase font-bold text-left px-2">{team?.compTeam?.name}</th>
          </tr>
          <tr className="bg-gray-100">
            <th className="border border-black p-1 w-8">№</th>
            <th className="border border-black p-1 text-left px-2">ФИО Игрока</th>
            <th className="border border-black p-1 w-20">Поражения (Фраги)</th>
            <th className="border border-black p-1 w-20">Штрафы</th>
            <th className="border border-black p-1 w-24">Примечание</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p: any, idx: number) => (
            <tr key={p.id}>
              <td className="border border-black py-1 px-1">{idx + 1}</td>
              <td className="border border-black py-1 px-2 text-left"><input type="text" defaultValue={p.fullName || p.displayName || ""} className="w-full outline-none bg-transparent text-sm" /></td>
              <td className="border border-black py-1 px-1"><input type="text" className="w-full text-center outline-none bg-transparent" /></td>
              <td className="border border-black py-1 px-1"><input type="text" className="w-full text-center outline-none bg-transparent" /></td>
              <td className="border border-black py-1 px-1"><input type="text" className="w-full text-center outline-none bg-transparent" /></td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, 5 - players.length) }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td className="border border-black py-1 px-1">{players.length + i + 1}</td>
              <td className="border border-black py-1 px-2"><input type="text" className="w-full outline-none bg-transparent text-sm" /></td>
              <td className="border border-black py-1 px-1"></td><td className="border border-black py-1 px-1"></td>
              <td className="border border-black py-1 px-1"></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="bg-white text-black w-[210mm] min-h-[297mm] mx-auto p-8 font-sans print:p-0 print:w-full">
      <div className="text-center font-bold mb-6 border-2 border-yellow-600 p-2">
        <div className="text-xl">ПРОТОКОЛ ФИЗИЧЕСКОГО ЭТАПА (ЛАЗЕРТАГ)</div>
        <textarea rows={1} defaultValue={competition?.name || ""} className="w-full text-center bg-transparent outline-none uppercase text-md resize-none font-bold overflow-hidden" />
      </div>

      {renderPlayers(team1)}
      {renderPlayers(team2)}

      <div className="mt-10 space-y-6">
        <div className="flex justify-between items-end">
          <div className="font-bold">Судья физического этапа</div>
          <div className="border-b border-black w-48 text-center text-xs text-gray-500">подпись</div>
          <div className="border-b border-black w-64"><input type="text" placeholder="ФИО судьи" className="w-full text-center outline-none bg-transparent" /></div>
        </div>
      </div>
    </div>
  );
};