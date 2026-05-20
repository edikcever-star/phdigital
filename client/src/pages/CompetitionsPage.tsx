/**
 * СТРАНИЦА СОРЕВНОВАНИЙ
 * (Заглушка для Этапа 1 — будет реализована в Этапе 2)
 */
import AppShell from "@/components/layout/AppShell";
import { Trophy } from "lucide-react";

export default function CompetitionsPage() {
  return (
    <AppShell>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Соревнования</h2>
          <p className="text-sm text-muted-foreground">Модуль в разработке — Этап 2</p>
        </div>
      </div>
    </AppShell>
  );
}
