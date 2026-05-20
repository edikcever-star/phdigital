/**
 * ДЕТАЛЬНАЯ СТРАНИЦА КОМАНДЫ
 *
 * Два таба: «Игроки» и «Персонал».
 * Администраторы могут добавлять, редактировать и удалять записи.
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import {
  fetchTeam,
  addPlayer,
  updatePlayer,
  deletePlayer,
  addOfficial,
  deleteOfficial,
} from "./teams.api";
import type {
  PlayerData,
  OfficialData,
  UpdatePlayerData,
} from "./teams.api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Users,
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
} from "lucide-react";
import type { GlobalTeamPlayer, GlobalTeamOfficial } from "@shared/schema";

// -------------------------------------------------------
// Роли игрока (позиции)
// -------------------------------------------------------

const POSITION_LABELS: Record<string, string> = {
  rifler: "Стрелок",
  sniper: "Снайпер",
  lurker: "Люркер",
  support: "Поддержка",
  igl: "IGL (лидер)",
};

// -------------------------------------------------------
// Роли персонала
// -------------------------------------------------------

const OFFICIAL_ROLE_LABELS: Record<string, string> = {
  head_coach: "Главный тренер",
  assistant_coach: "Помощник тренера",
  manager: "Менеджер",
  analyst: "Аналитик",
};

// -------------------------------------------------------
// Схемы валидации
// -------------------------------------------------------

const playerSchema = z.object({
  fullName: z.string().min(2, "Введите имя (минимум 2 символа)"),
  /** Номер хранится как строка в форме, преобразуется в число при отправке */
  numberStr: z.string().optional(),
  position: z.string().optional(),
  isReserve: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

type PlayerFormData = z.infer<typeof playerSchema>;

const officialSchema = z.object({
  fullName: z.string().min(2, "Введите имя (минимум 2 символа)"),
  role: z.string().min(1, "Выберите роль"),
});

type OfficialFormData = z.infer<typeof officialSchema>;

// -------------------------------------------------------
// Диалог добавления/редактирования игрока
// -------------------------------------------------------

interface PlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: number;
  /** Если передан — режим редактирования */
  player?: GlobalTeamPlayer;
}

function PlayerDialog({
  open,
  onOpenChange,
  teamId,
  player,
}: PlayerDialogProps) {
  const { toast } = useToast();
  const isEditing = !!player;

  const form = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      fullName: player?.fullName ?? "",
      numberStr:
        player?.number !== null && player?.number !== undefined
          ? String(player.number)
          : "",
      position: player?.position ?? "",
      isReserve: player?.isReserve ?? false,
      notes: player?.notes ?? "",
    },
  });

  // Мутация добавления игрока
  const addMutation = useMutation({
    mutationFn: (data: PlayerData) => addPlayer(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/teams", teamId] });
      toast({ title: "Игрок добавлен" });
      handleClose();
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Мутация обновления игрока
  const updateMutation = useMutation({
    mutationFn: (data: UpdatePlayerData) =>
      updatePlayer(teamId, player!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/teams", teamId] });
      toast({ title: "Игрок обновлён" });
      handleClose();
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const isPending = addMutation.isPending || updateMutation.isPending;

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const onSubmit = (data: PlayerFormData) => {
    // Преобразуем строку номера в число (или undefined)
    const parsedNumber =
      data.numberStr && data.numberStr.trim() !== ""
        ? parseInt(data.numberStr, 10)
        : undefined;
    const payload: PlayerData = {
      fullName: data.fullName,
      number: parsedNumber !== undefined && !isNaN(parsedNumber)
        ? parsedNumber
        : undefined,
      position: data.position || undefined,
      isReserve: data.isReserve ?? false,
      notes: data.notes || undefined,
    };
    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      addMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        data-testid="player-dialog"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Редактировать игрока" : "Добавить игрока"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Полное имя */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Полное имя *</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-player-fullname"
                      placeholder="Иванов Иван"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Номер и позиция — в одной строке */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="numberStr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Номер</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-player-number"
                        type="number"
                        min={0}
                        placeholder="1"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Позиция</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-player-position">
                          <SelectValue placeholder="Выбрать..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(POSITION_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Заметки */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Заметки</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-player-notes"
                      placeholder="Дополнительная информация"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2">
              <Button
                data-testid="btn-cancel-player"
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                Отмена
              </Button>
              <Button
                data-testid="btn-submit-player"
                type="submit"
                disabled={isPending}
              >
                {isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                {isEditing ? "Сохранить" : "Добавить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------
// Диалог добавления официального лица
// -------------------------------------------------------

interface OfficialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: number;
}

function OfficialDialog({ open, onOpenChange, teamId }: OfficialDialogProps) {
  const { toast } = useToast();

  const form = useForm<OfficialFormData>({
    resolver: zodResolver(officialSchema),
    defaultValues: {
      fullName: "",
      role: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: OfficialData) => addOfficial(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/teams", teamId] });
      toast({ title: "Персонал добавлен" });
      handleClose();
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const onSubmit = (data: OfficialFormData) => {
    addMutation.mutate({ fullName: data.fullName, role: data.role });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        data-testid="official-dialog"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Добавить персонал</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Полное имя */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Полное имя *</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-official-fullname"
                      placeholder="Петров Пётр"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Роль */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Роль *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-official-role">
                        <SelectValue placeholder="Выбрать роль..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(OFFICIAL_ROLE_LABELS).map(
                        ([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2">
              <Button
                data-testid="btn-cancel-official"
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={addMutation.isPending}
              >
                Отмена
              </Button>
              <Button
                data-testid="btn-submit-official"
                type="submit"
                disabled={addMutation.isPending}
              >
                {addMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Добавить
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------
// Таб «Игроки»
// -------------------------------------------------------

interface PlayersTabProps {
  teamId: number;
  players: GlobalTeamPlayer[];
  isAdmin: boolean;
}

function PlayersTab({ teamId, players, isAdmin }: PlayersTabProps) {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editPlayer, setEditPlayer] = useState<GlobalTeamPlayer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GlobalTeamPlayer | null>(
    null
  );

  // Мутация удаления игрока
  const deleteMutation = useMutation({
    mutationFn: (playerId: number) => deletePlayer(teamId, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/teams", teamId] });
      toast({ title: "Игрок удалён" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (players.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-muted/50 border border-border">
            <Users className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">
              Нет игроков
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isAdmin
                ? "Добавьте первого игрока кнопкой выше"
                : "Игроки ещё не добавлены"}
            </p>
          </div>
          {isAdmin && (
            <Button
              data-testid="btn-add-player-empty"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Добавить игрока
            </Button>
          )}
        </div>

        {/* Диалог добавления */}
        <PlayerDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          teamId={teamId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Кнопка добавления (только admin) */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button
            data-testid="btn-add-player"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Добавить игрока
          </Button>
        </div>
      )}

      {/* Таблица игроков */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">№</TableHead>
              <TableHead>Имя</TableHead>
              <TableHead>Позиция</TableHead>
              <TableHead>Статус</TableHead>
              {isAdmin && (
                <TableHead className="w-20 text-right">Действия</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => (
              <TableRow
                key={player.id}
                data-testid={`player-row-${player.id}`}
              >
                {/* Номер */}
                <TableCell className="text-center font-mono text-xs text-muted-foreground">
                  {player.number ?? "—"}
                </TableCell>

                {/* Имя + заметка */}
                <TableCell>
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {player.fullName}
                    </span>
                    {player.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {player.notes}
                      </p>
                    )}
                  </div>
                </TableCell>

                {/* Позиция */}
                <TableCell>
                  {player.position ? (
                    <Badge variant="outline" className="text-xs font-normal">
                      {POSITION_LABELS[player.position] ?? player.position}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Запасной / Основной */}
                <TableCell>
                  {player.isReserve ? (
                    <Badge
                      variant="outline"
                      className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                    >
                      Запасной
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs bg-green-500/10 text-green-400 border-green-500/30"
                    >
                      Основной
                    </Badge>
                  )}
                </TableCell>

                {/* Действия (только admin) */}
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        data-testid={`btn-edit-player-${player.id}`}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditPlayer(player)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        data-testid={`btn-delete-player-${player.id}`}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(player)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Диалог добавления */}
      <PlayerDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        teamId={teamId}
      />

      {/* Диалог редактирования */}
      {editPlayer && (
        <PlayerDialog
          open={!!editPlayer}
          onOpenChange={(open) => !open && setEditPlayer(null)}
          teamId={teamId}
          player={editPlayer}
        />
      )}

      {/* Подтверждение удаления */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent data-testid="confirm-delete-player">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить игрока?</AlertDialogTitle>
            <AlertDialogDescription>
              Игрок «{deleteTarget?.fullName}» будет удалён из команды. Это
              действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              data-testid="btn-confirm-delete-player"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// -------------------------------------------------------
// Таб «Персонал»
// -------------------------------------------------------

interface OfficialsTabProps {
  teamId: number;
  officials: GlobalTeamOfficial[];
  isAdmin: boolean;
}

function OfficialsTab({ teamId, officials, isAdmin }: OfficialsTabProps) {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GlobalTeamOfficial | null>(
    null
  );

  // Мутация удаления официального лица
  const deleteMutation = useMutation({
    mutationFn: (officialId: number) => deleteOfficial(teamId, officialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/teams", teamId] });
      toast({ title: "Запись удалена" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (officials.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-muted/50 border border-border">
            <UserCog className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">
              Нет персонала
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isAdmin
                ? "Добавьте первого сотрудника кнопкой выше"
                : "Персонал ещё не добавлен"}
            </p>
          </div>
          {isAdmin && (
            <Button
              data-testid="btn-add-official-empty"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Добавить
            </Button>
          )}
        </div>

        {/* Диалог добавления */}
        <OfficialDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          teamId={teamId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Кнопка добавления (только admin) */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button
            data-testid="btn-add-official"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </Button>
        </div>
      )}

      {/* Таблица персонала */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Роль</TableHead>
              {isAdmin && (
                <TableHead className="w-16 text-right">Удалить</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {officials.map((official) => (
              <TableRow
                key={official.id}
                data-testid={`official-row-${official.id}`}
              >
                {/* Имя */}
                <TableCell className="font-medium text-sm text-foreground">
                  {official.fullName}
                </TableCell>

                {/* Роль */}
                <TableCell>
                  <Badge variant="outline" className="text-xs font-normal">
                    {OFFICIAL_ROLE_LABELS[official.role] ?? official.role}
                  </Badge>
                </TableCell>

                {/* Удалить (только admin) */}
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button
                      data-testid={`btn-delete-official-${official.id}`}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(official)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Диалог добавления */}
      <OfficialDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        teamId={teamId}
      />

      {/* Подтверждение удаления */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent data-testid="confirm-delete-official">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.fullName}» будет удалён из состава персонала. Это
              действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              data-testid="btn-confirm-delete-official"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// -------------------------------------------------------
// Основной компонент страницы
// -------------------------------------------------------

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  // Идентификатор команды
  const teamId = parseInt(id ?? "", 10);

  // Текущий пользователь — администратор
  const isAdmin =
    user?.role === "chief_judge" || user?.role === "chief_secretary";

  // Загрузка детальных данных команды
  const {
    data: team,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["/api/v1/teams", teamId],
    queryFn: () => fetchTeam(teamId),
    enabled: !isNaN(teamId),
  });

  // ---- Состояние загрузки ----
  if (isLoading) {
    return (
      <AppShell>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Шапка — скелетон */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          {/* Контент — скелетон */}
          <div
            data-testid="team-detail-loading"
            className="flex-1 p-6 space-y-4"
          >
            <Skeleton className="h-9 w-56" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ---- Состояние ошибки ----
  if (isError || !team) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-sm text-destructive font-medium">
              Ошибка загрузки
            </p>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Не удалось загрузить данные команды"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/teams")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к командам
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Шапка страницы */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0">
          {/* Кнопка «Назад» */}
          <Button
            data-testid="btn-back-to-teams"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={() => navigate("/teams")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {/* Название и регион */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">
              {team.name}
            </h1>
            {team.region && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground">
                  {team.region}
                </span>
              </div>
            )}
          </div>

          {/* Счётчики */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-xs gap-1">
              <Users className="w-3 h-3" />
              {team.players.length}
            </Badge>
            <Badge variant="secondary" className="text-xs gap-1">
              <UserCog className="w-3 h-3" />
              {team.officials.length}
            </Badge>
          </div>
        </div>

        {/* Контент с табами */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="players" className="max-w-3xl">
            <TabsList className="mb-6">
              <TabsTrigger
                data-testid="tab-players"
                value="players"
                className="gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                Игроки
                <Badge variant="secondary" className="text-xs ml-1">
                  {team.players.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                data-testid="tab-officials"
                value="officials"
                className="gap-1.5"
              >
                <UserCog className="w-3.5 h-3.5" />
                Персонал
                <Badge variant="secondary" className="text-xs ml-1">
                  {team.officials.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Таб игроков */}
            <TabsContent value="players">
              <PlayersTab
                teamId={teamId}
                players={team.players}
                isAdmin={isAdmin}
              />
            </TabsContent>

            {/* Таб персонала */}
            <TabsContent value="officials">
              <OfficialsTab
                teamId={teamId}
                officials={team.officials}
                isAdmin={isAdmin}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}
