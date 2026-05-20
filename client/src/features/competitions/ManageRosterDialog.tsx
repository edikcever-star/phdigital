import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { addTeamPlayer, addTeamOfficial, removeTeamPlayer, removeTeamOfficial, setPlayerCaptain } from "./competitions.api";
import { Loader2, Trash2, UserPlus, ShieldPlus, Crown } from "lucide-react";

interface ManageRosterDialogProps {
  competitionId: number;
  team: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageRosterDialog({ competitionId, team, open, onOpenChange }: ManageRosterDialogProps) {
  const { toast } = useToast();

  const [playerName, setPlayerName] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");
  const [playerPosition, setPlayerPosition] = useState("");
  const [isReserve, setIsReserve] = useState(false);

  const [officialName, setOfficialName] = useState("");
  const [officialRole, setOfficialRole] = useState("coach");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [`/api/v1/competitions/${competitionId}/teams`] });

  // Добавить игрока
  const addPlayerMutation = useMutation({
    mutationFn: () =>
      addTeamPlayer(competitionId, team!.id, {
        fullName: playerName,
        number: playerNumber ? parseInt(playerNumber) : undefined,
        position: playerPosition || undefined,
        isReserve,
      }),
    onSuccess: () => {
      invalidate();
      setPlayerName(""); setPlayerNumber(""); setPlayerPosition(""); setIsReserve(false);
      toast({ title: "Игрок добавлен" });
    },
    onError: (err: Error) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  // Удалить игрока
  const removePlayerMutation = useMutation({
    mutationFn: (playerId: number) => removeTeamPlayer(competitionId, team!.id, playerId),
    onSuccess: () => { invalidate(); toast({ title: "Игрок удален" }); },
  });

  // Назначить / снять капитана
  const captainMutation = useMutation({
    mutationFn: ({ playerId, isCaptain }: { playerId: number; isCaptain: boolean }) =>
      setPlayerCaptain(competitionId, team!.id, playerId, isCaptain),
    onSuccess: () => { invalidate(); },
    onError: (err: Error) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  // Добавить персонал
  const addOfficialMutation = useMutation({
    mutationFn: () => addTeamOfficial(competitionId, team!.id, { fullName: officialName, role: officialRole }),
    onSuccess: () => {
      invalidate();
      setOfficialName(""); setOfficialRole("coach");
      toast({ title: "Персонал добавлен" });
    },
    onError: (err: Error) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  // Удалить персонал
  const removeOfficialMutation = useMutation({
    mutationFn: (officialId: number) => removeTeamOfficial(competitionId, team!.id, officialId),
    onSuccess: () => { invalidate(); toast({ title: "Персонал удален" }); },
  });

  if (!team) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Управление составом: {team.name}</DialogTitle>
          <DialogDescription>
            Добавляйте/удаляйте игроков и тренеров. Назначьте капитана нажав на корону 👑
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* ==================== СЕКЦИЯ ИГРОКОВ ==================== */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2 border-b pb-2">
              <UserPlus className="w-4 h-4 text-primary" /> Игроки
            </h3>

            {/* Форма добавления */}
            <div className="grid grid-cols-12 gap-2 items-end bg-muted/20 p-3 rounded-lg border">
              <div className="col-span-5 space-y-1">
                <Label className="text-xs">ФИО / Никнейм</Label>
                <Input
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder="Иванов Иван"
                  onKeyDown={e => e.key === "Enter" && playerName && addPlayerMutation.mutate()}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Номер</Label>
                <Input type="number" value={playerNumber} onChange={e => setPlayerNumber(e.target.value)} placeholder="99" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Позиция</Label>
                <Input value={playerPosition} onChange={e => setPlayerPosition(e.target.value)} placeholder="IGL" />
              </div>
              <div className="col-span-2 flex flex-col items-center justify-center space-y-1 pb-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Резерв</Label>
                <Switch checked={isReserve} onCheckedChange={setIsReserve} />
              </div>
              <div className="col-span-1">
                <Button
                  size="icon"
                  onClick={() => addPlayerMutation.mutate()}
                  disabled={!playerName.trim() || addPlayerMutation.isPending}
                  className="w-full"
                  title="Добавить игрока"
                >
                  {addPlayerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Список игроков */}
            <div className="space-y-1.5">
              {team.players && team.players.length > 0 ? (
                team.players.map((p: any) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${
                      p.isCaptain
                        ? "bg-amber-500/10 border-amber-500/40"
                        : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Кнопка назначения капитана */}
                      <button
                        onClick={() => captainMutation.mutate({ playerId: p.id, isCaptain: !p.isCaptain })}
                        disabled={captainMutation.isPending}
                        title={p.isCaptain ? "Снять капитана" : "Назначить капитаном"}
                        className={`transition-all hover:scale-110 ${
                          p.isCaptain ? "text-amber-500" : "text-muted-foreground/30 hover:text-amber-400"
                        }`}
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                      <span className="font-medium text-foreground">{p.fullName}</span>
                      {p.isCaptain && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-600 border-amber-500/30 border">
                          Капитан
                        </Badge>
                      )}
                      {p.isReserve && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-dashed">
                          Резерв
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {p.position && (
                        <span className="text-[10px] text-muted-foreground uppercase">{p.position}</span>
                      )}
                      {p.number && (
                        <Badge variant="secondary" className="text-xs px-1.5 min-w-[24px] justify-center">
                          #{p.number}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:bg-destructive/10"
                        onClick={() => removePlayerMutation.mutate(p.id)}
                        disabled={removePlayerMutation.isPending}
                        title="Удалить игрока"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground text-center border border-dashed rounded-md p-4">
                  Игроки ещё не добавлены
                </div>
              )}
            </div>
          </div>

          {/* ==================== СЕКЦИЯ ПЕРСОНАЛА ==================== */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2 border-b pb-2">
              <ShieldPlus className="w-4 h-4 text-primary" /> Персонал
            </h3>

            {/* Форма добавления */}
            <div className="grid grid-cols-12 gap-2 items-end bg-muted/20 p-3 rounded-lg border">
              <div className="col-span-7 space-y-1">
                <Label className="text-xs">ФИО</Label>
                <Input
                  value={officialName}
                  onChange={e => setOfficialName(e.target.value)}
                  placeholder="Петров Петр"
                  onKeyDown={e => e.key === "Enter" && officialName && addOfficialMutation.mutate()}
                />
              </div>
              <div className="col-span-4 space-y-1">
                <Label className="text-xs">Роль</Label>
                <Select value={officialRole} onValueChange={setOfficialRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coach">Тренер</SelectItem>
                    <SelectItem value="manager">Менеджер</SelectItem>
                    <SelectItem value="representative">Представитель</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Button
                  size="icon"
                  onClick={() => addOfficialMutation.mutate()}
                  disabled={!officialName.trim() || addOfficialMutation.isPending}
                  className="w-full"
                  title="Добавить персонал"
                >
                  {addOfficialMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldPlus className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Список персонала */}
            <div className="space-y-1.5">
              {team.officials && team.officials.length > 0 ? (
                team.officials.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between bg-card border border-border rounded-md px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{o.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {({ coach: "Тренер", manager: "Менеджер", representative: "Представитель" } as Record<string, string>)[o.role] || o.role}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                      onClick={() => removeOfficialMutation.mutate(o.id)}
                      disabled={removeOfficialMutation.isPending}
                      title="Удалить персонал"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground text-center border border-dashed rounded-md p-4">
                  Персонал ещё не добавлен
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}