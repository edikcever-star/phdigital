import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { createMatch } from "./matches.api";
import { useToast } from "@/hooks/use-toast";
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
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
// Добавьте Select для выбора судей
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

// -------------------------------------------------------
// Схема валидации
// -------------------------------------------------------

const createMatchSchema = z.object({
  matchNumber: z.string().min(1, "Укажите номер матча").max(50, "Слишком длинный номер"),
  stage: z.string().max(100, "Слишком длинная метка стадии").optional(),
  scheduledAt: z.string().optional(),
  // Новые поля по ТЗ
  expectedSpectators: z.number().min(0).optional(),
});

type CreateMatchFormData = z.infer<typeof createMatchSchema>;

interface CreateMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: number;
}

export function CreateMatchDialog({ open, onOpenChange, competitionId }: CreateMatchDialogProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Локальный стейт для множественного выбора судей (до 5 человек)
  const [selectedJudges, setSelectedJudges] = useState<number[]>([]);

  const form = useForm<CreateMatchFormData>({
    resolver: zodResolver(createMatchSchema),
    defaultValues: {
      matchNumber: "",
      stage: "",
      scheduledAt: "",
      expectedSpectators: 0,
    },
  });

  // Загружаем глобальный список судей для выбора
  const { data: globalJudges, isLoading: judgesLoading } = useQuery({
    queryKey: ["/api/v1/references/judges"],
    queryFn: async () => {
      const response = await apiRequest<{ success: boolean; data: any[] }>(
        "GET", 
        "/api/v1/references/judges"
      );
      return response.data;
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateMatchFormData) =>
      createMatch(competitionId, {
        matchNumber: data.matchNumber,
        stage: data.stage || undefined,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
        // Передаем новые данные на бэкенд
        expectedSpectators: data.expectedSpectators || 0,
        matchJudges: selectedJudges, // Массив ID судей
      }),
    onSuccess: (newMatch) => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/competitions/${competitionId}/matches`] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/competitions"] });
      toast({ title: "Матч создан", description: `Матч #${newMatch.matchNumber ?? newMatch.id} успешно создан` });
      
      form.reset();
      setSelectedJudges([]);
      onOpenChange(false);
      // Автоматический переход в Модуль 3 (Настройка матча) согласно ТЗ
      navigate(`/matches/${newMatch.id}/setup`);
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка создания", description: err.message, variant: "destructive" });
    },
  });

  function onSubmit(data: CreateMatchFormData) {
    createMutation.mutate(data);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      form.reset();
      setSelectedJudges([]);
    }
    onOpenChange(nextOpen);
  }

  // Функция добавления судьи в массив (если их меньше 5)
  const handleAddJudge = (val: string) => {
    const judgeId = parseInt(val);
    if (!selectedJudges.includes(judgeId) && selectedJudges.length < 5) {
      setSelectedJudges([...selectedJudges, judgeId]);
    }
  };

  // Функция удаления судьи из выбранных
  const handleRemoveJudge = (judgeId: number) => {
    setSelectedJudges(selectedJudges.filter(id => id !== judgeId));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Создать новый матч</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            
            <div className="grid grid-cols-2 gap-4">
              {/* Номер матча */}
              <FormField
                control={form.control}
                name="matchNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Номер матча *</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: 15" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Стадия */}
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Стадия (необязательно)</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: Полуфинал 1" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Запланированное время */}
              <FormField
                control={form.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дата и время начала</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Зрители */}
              <FormField
                control={form.control}
                name="expectedSpectators"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ожидаемо зрителей</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* МАТЧЕВЫЕ СУДЬИ (Лазертаг) */}
            <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border/50">
              <div>
                <FormLabel>Матчевые судьи (до 5 человек)</FormLabel>
                <p className="text-xs text-muted-foreground mt-1">Отвечают за контроль физического этапа на площадке.</p>
              </div>
              
              <Select onValueChange={handleAddJudge} disabled={judgesLoading || selectedJudges.length >= 5}>
                <SelectTrigger>
                  <SelectValue placeholder={judgesLoading ? "Загрузка..." : selectedJudges.length >= 5 ? "Максимум 5 судей" : "Выберите судью..."} />
                </SelectTrigger>
                <SelectContent>
                  {globalJudges?.map((judge: any) => (
                    <SelectItem 
                      key={judge.id} 
                      value={judge.id.toString()}
                      disabled={selectedJudges.includes(judge.id)}
                    >
                      {judge.fullName} {judge.category ? `(${judge.category})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Выбранные судьи (Бейджи) */}
              {selectedJudges.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedJudges.map(judgeId => {
                    const judge = globalJudges?.find((j: any) => j.id === judgeId);
                    return (
                      <Badge key={judgeId} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                        <span className="text-xs">{judge?.fullName}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveJudge(judgeId)}
                          className="h-4 w-4 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center text-muted-foreground"
                        >
                          &times;
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={createMutation.isPending}>
                Отмена
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Создание...</> : "Создать матч"}
              </Button>
            </DialogFooter>

          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}