import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { fetchCompetitionMatches, generateCompetitionBracket } from "./competitions.api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitMerge, Play } from "lucide-react";
import { useLocation } from "wouter";

interface BracketTabProps {
  competitionId: number;
  isAdmin: boolean;
}

export function BracketTab({ competitionId, isAdmin }: BracketTabProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: matches, isLoading } = useQuery({
    queryKey: [`/api/v1/competitions/${competitionId}/matches`],
    queryFn: () => fetchCompetitionMatches(competitionId),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateCompetitionBracket(competitionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/competitions/${competitionId}/matches`] });
      toast({ title: "Сетка успешно сгенерирована!" });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  // Простая группировка матчей по стадиям (для плей-офф)
  const groupedMatches = matches?.reduce((acc: any, match) => {
    const stage = match.stage || "Без стадии";
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(match);
    return acc;
  }, {});

  const hasMatches = matches && matches.length > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <GitMerge className="w-5 h-5 text-primary" />
          Турнирная сетка (Плей-офф)
        </h3>
        
        {isAdmin && !hasMatches && (
          <Button 
            onClick={() => {
              if (confirm("Внимание: Это действие перемешает команды и создаст матчи. Продолжить?")) {
                generateMutation.mutate();
              }
            }} 
            disabled={generateMutation.isPending}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Сгенерировать сетку
          </Button>
        )}
      </div>

      {!hasMatches ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border bg-muted/5">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <GitMerge className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-base font-medium text-foreground">Сетка ещё не сформирована</p>
          <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
            Добавьте все команды во вкладке "Команды", а затем нажмите кнопку генерации.
          </p>
        </div>
      ) : (
        <div className="flex gap-8 overflow-x-auto pb-8 pt-4">
          {/* Простая визуализация дерева (колонки по стадиям) */}
          {Object.entries(groupedMatches || {}).map(([stage, stageMatches]: [string, any]) => (
            <div key={stage} className="flex flex-col min-w-[280px] space-y-4">
              <h4 className="text-center font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">
                {stage}
              </h4>
              
              {stageMatches.map((match: any) => (
                <div 
                  key={match.id} 
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer relative"
                  onClick={() => navigate(`/matches/${match.id}/setup`)}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20"></div>
                  <div className="p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-muted-foreground font-mono">{match.matchNumber}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">{match.status === 'draft' ? 'Ожидание' : 'В игре'}</Badge>
                    </div>
                    
                    <div className="space-y-2">
                      {/* Команда 1 */}
                      <div className="flex justify-between items-center bg-muted/30 p-2 rounded-md border border-border/50">
                        <span className="text-sm font-medium truncate pr-2">{match.team1?.name || "TBD (Ожидается)"}</span>
                        <span className="font-bold text-sm">{match.scoreTotalTeam1 ?? "-"}</span>
                      </div>
                      
                      {/* Команда 2 */}
                      <div className="flex justify-between items-center bg-muted/30 p-2 rounded-md border border-border/50">
                        <span className="text-sm font-medium truncate pr-2">{match.team2?.name || "TBD (Ожидается)"}</span>
                        <span className="font-bold text-sm">{match.scoreTotalTeam2 ?? "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}