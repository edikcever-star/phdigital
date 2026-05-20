/**
 * СТРАНИЦА СПРАВОЧНИКОВ
 *
 * Доступна только для chief_judge и chief_secretary.
 * Содержит три таба: Карты, Типы нарушений, Судьи.
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import {
  fetchMaps,
  deactivateMap,
  updateMap,
  fetchViolationTypes,
  updateViolationType,
  fetchJudges,
  deactivateJudge,
} from "./references.api";
import { MapDialog } from "./MapDialog";
import { ViolationTypeDialog } from "./ViolationTypeDialog";
import { JudgeDialog } from "./JudgeDialog";
import { VTYPE_LABELS } from "./ViolationTypeDialog";
import { useToast } from "@/hooks/use-toast";
import type { MapRecord, ViolationTypeRecord, Judge } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookOpen,
  Map,
  AlertTriangle,
  Users,
  Plus,
  Pencil,
  PowerOff,
  Power,
  ShieldAlert,
} from "lucide-react";

// ============================================================
// ТАБЛИЦА КАРТ
// ============================================================

interface MapsTabProps {
  isAdmin: boolean;
}

function MapsTab({ isAdmin }: MapsTabProps) {
  const { toast } = useToast();
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [editMap, setEditMap] = useState<MapRecord | null>(null);

  const { data: maps, isLoading } = useQuery({
    queryKey: ["/api/v1/references/maps"],
    queryFn: () => fetchMaps(false), // загружаем все, включая неактивные
  });

  // Мутация переключения активности карты
  const toggleMapMutation = useMutation({
    mutationFn: (map: MapRecord) =>
      updateMap(map.id, { isActive: !map.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/references/maps"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const openCreate = () => {
    setEditMap(null);
    setMapDialogOpen(true);
  };

  const openEdit = (map: MapRecord) => {
    setEditMap(map);
    setMapDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Заголовок таба */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Список карт CS2 для матча
        </p>
        {isAdmin && (
          <Button
            data-testid="btn-add-map"
            size="sm"
            className="gap-1.5"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4" />
            Добавить карту
          </Button>
        )}
      </div>

      {/* Таблица */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Статус</TableHead>
              {isAdmin && <TableHead className="text-right">Действия</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  {isAdmin && <TableCell />}
                </TableRow>
              ))}

            {!isLoading && (!maps || maps.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 3 : 2}
                  className="text-center py-8 text-muted-foreground text-sm"
                >
                  Карты не найдены
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              maps?.map((map) => (
                <TableRow key={map.id} className={!map.isActive ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{map.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        map.isActive
                          ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : "bg-muted/50 text-muted-foreground border-border"
                      }
                    >
                      {map.isActive ? "Активна" : "Неактивна"}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(map)}
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          data-testid={`btn-toggle-map-${map.id}`}
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => toggleMapMutation.mutate(map)}
                          disabled={toggleMapMutation.isPending}
                          title={map.isActive ? "Деактивировать" : "Активировать"}
                        >
                          {map.isActive ? (
                            <PowerOff className="w-3.5 h-3.5 text-destructive" />
                          ) : (
                            <Power className="w-3.5 h-3.5 text-green-400" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Диалог создания / редактирования карты */}
      <MapDialog
        open={mapDialogOpen}
        onOpenChange={setMapDialogOpen}
        editData={editMap}
      />
    </div>
  );
}

// ============================================================
// ТАБЛИЦА ТИПОВ НАРУШЕНИЙ
// ============================================================

interface ViolationTypesTabProps {
  isAdmin: boolean;
}

function ViolationTypesTab({ isAdmin }: ViolationTypesTabProps) {
  const { toast } = useToast();
  const [vtDialogOpen, setVtDialogOpen] = useState(false);
  const [editVt, setEditVt] = useState<ViolationTypeRecord | null>(null);

  const { data: vtypes, isLoading } = useQuery({
    queryKey: ["/api/v1/references/violation-types"],
    queryFn: () => fetchViolationTypes(false), // все, включая неактивные
  });

  // Мутация переключения активности типа нарушения
  const toggleVtMutation = useMutation({
    mutationFn: (vt: ViolationTypeRecord) =>
      updateViolationType(vt.id, { isActive: !vt.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/v1/references/violation-types"],
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const openCreate = () => {
    setEditVt(null);
    setVtDialogOpen(true);
  };

  const openEdit = (vt: ViolationTypeRecord) => {
    setEditVt(vt);
    setVtDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Типы нарушений и штрафы из регламента
        </p>
        {isAdmin && (
          <Button
            data-testid="btn-add-violation-type"
            size="sm"
            className="gap-1.5"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4" />
            Добавить тип
          </Button>
        )}
      </div>

      {/* Таблица */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Статья</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead>Штраф</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Статус</TableHead>
              {isAdmin && <TableHead className="text-right">Действия</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  {isAdmin && <TableCell />}
                </TableRow>
              ))}

            {!isLoading && (!vtypes || vtypes.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 5}
                  className="text-center py-8 text-muted-foreground text-sm"
                >
                  Типы нарушений не найдены
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              vtypes?.map((vt) => (
                <TableRow key={vt.id} className={!vt.isActive ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs">{vt.article}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    {vt.description}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {vt.penaltyPts > 0 ? `−${vt.penaltyPts} pts` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {VTYPE_LABELS[vt.vtype] ?? vt.vtype}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        vt.isActive
                          ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : "bg-muted/50 text-muted-foreground border-border"
                      }
                    >
                      {vt.isActive ? "Активен" : "Неактивен"}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(vt)}
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          data-testid={`btn-toggle-vt-${vt.id}`}
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => toggleVtMutation.mutate(vt)}
                          disabled={toggleVtMutation.isPending}
                          title={vt.isActive ? "Деактивировать" : "Активировать"}
                        >
                          {vt.isActive ? (
                            <PowerOff className="w-3.5 h-3.5 text-destructive" />
                          ) : (
                            <Power className="w-3.5 h-3.5 text-green-400" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Диалог */}
      <ViolationTypeDialog
        open={vtDialogOpen}
        onOpenChange={setVtDialogOpen}
        editData={editVt}
      />
    </div>
  );
}

// ============================================================
// ТАБЛИЦА СУДЕЙ
// ============================================================

interface JudgesTabProps {
  isAdmin: boolean;
}

function JudgesTab({ isAdmin }: JudgesTabProps) {
  const { toast } = useToast();
  const [judgeDialogOpen, setJudgeDialogOpen] = useState(false);
  const [editJudge, setEditJudge] = useState<Judge | null>(null);

  const { data: judges, isLoading } = useQuery({
    queryKey: ["/api/v1/references/judges"],
    queryFn: () => fetchJudges(false), // все, включая неактивных
  });

  // Мутация деактивации судьи (DELETE → soft delete)
  const deactivateMutation = useMutation({
    mutationFn: (judge: Judge) => deactivateJudge(judge.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/references/judges"] });
      toast({ title: "Судья деактивирован" });
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const openCreate = () => {
    setEditJudge(null);
    setJudgeDialogOpen(true);
  };

  const openEdit = (judge: Judge) => {
    setEditJudge(judge);
    setJudgeDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Глобальный реестр судей
        </p>
        {isAdmin && (
          <Button
            data-testid="btn-add-judge"
            size="sm"
            className="gap-1.5"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4" />
            Добавить судью
          </Button>
        )}
      </div>

      {/* Таблица */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ФИО</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Должность</TableHead>
              <TableHead>Статус</TableHead>
              {isAdmin && <TableHead className="text-right">Действия</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  {isAdmin && <TableCell />}
                </TableRow>
              ))}

            {!isLoading && (!judges || judges.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 5 : 4}
                  className="text-center py-8 text-muted-foreground text-sm"
                >
                  Судьи не найдены
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              judges?.map((judge) => (
                <TableRow
                  key={judge.id}
                  className={!judge.isActive ? "opacity-50" : ""}
                >
                  <TableCell className="font-medium">{judge.fullName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {judge.category ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {judge.defaultRole ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        judge.isActive
                          ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : "bg-muted/50 text-muted-foreground border-border"
                      }
                    >
                      {judge.isActive ? "Активен" : "Неактивен"}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(judge)}
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {/* Деактивация только для активных судей */}
                        {judge.isActive && (
                          <Button
                            data-testid={`btn-deactivate-judge-${judge.id}`}
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => deactivateMutation.mutate(judge)}
                            disabled={deactivateMutation.isPending}
                            title="Деактивировать"
                          >
                            <PowerOff className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Диалог */}
      <JudgeDialog
        open={judgeDialogOpen}
        onOpenChange={setJudgeDialogOpen}
        editData={editJudge}
      />
    </div>
  );
}

// ============================================================
// ОСНОВНАЯ СТРАНИЦА
// ============================================================

export default function ReferencesPage() {
  const { user } = useAuth();

  // Доступ только для главного судьи и главного секретаря
  const isAdmin =
    user?.role === "chief_judge" || user?.role === "chief_secretary";

  // Если пользователь не имеет права доступа — показываем заглушку
  if (!isAdmin) {
    return (
      <AppShell>
        <div
          data-testid="references-access-denied"
          className="flex-1 flex items-center justify-center"
        >
          <div className="text-center space-y-3 max-w-sm">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20">
              <ShieldAlert className="w-7 h-7 text-destructive" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">
                Доступ запрещён
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Раздел «Справочники» доступен только главному судье и главному
                секретарю.
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Шапка страницы */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border flex-shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-base font-semibold text-foreground">
            Справочники
          </h1>
        </div>

        {/* Содержимое с табами */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="maps" className="space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="maps" className="gap-1.5">
                <Map className="w-3.5 h-3.5" />
                Карты
              </TabsTrigger>
              <TabsTrigger value="violations" className="gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Нарушения
              </TabsTrigger>
              <TabsTrigger value="judges" className="gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Судьи
              </TabsTrigger>
            </TabsList>

            {/* Таб карт */}
            <TabsContent value="maps">
              <MapsTab isAdmin={isAdmin} />
            </TabsContent>

            {/* Таб типов нарушений */}
            <TabsContent value="violations">
              <ViolationTypesTab isAdmin={isAdmin} />
            </TabsContent>

            {/* Таб судей */}
            <TabsContent value="judges">
              <JudgesTab isAdmin={isAdmin} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}
