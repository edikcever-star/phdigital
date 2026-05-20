/**
 * ДИАЛОГ СОЗДАНИЯ СОРЕВНОВАНИЯ
 *
 * Форма с валидацией через react-hook-form + zod.
 * После создания инвалидирует кеш списка и показывает toast.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { createCompetition } from "./competitions.api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// -------------------------------------------------------
// Схема валидации
// -------------------------------------------------------

const createCompetitionSchema = z.object({
  name: z
    .string()
    .min(2, "Название должно содержать минимум 2 символа")
    .max(120, "Название слишком длинное"),
  venue: z.string().optional(),
  format: z
    .enum(["olympic", "round_robin", "group_playoff"])
    .default("olympic"),
  startDate: z.string().min(1, "Укажите дату начала"),
  endDate: z.string().min(1, "Укажите дату окончания"),
  // Добавили поле для планового количества участников
  plannedParticipants: z.coerce
    .number()
    .min(2, "Минимум 2 участника")
    .default(0), 
});

type CreateCompetitionFormData = z.infer<typeof createCompetitionSchema>;

// -------------------------------------------------------
// Компонент диалога
// -------------------------------------------------------

interface CreateCompetitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCompetitionDialog({
  open,
  onOpenChange,
}: CreateCompetitionDialogProps) {
  const { toast } = useToast();

  const form = useForm<CreateCompetitionFormData>({
    resolver: zodResolver(createCompetitionSchema),
    defaultValues: {
      name: "",
      venue: "",
      format: "olympic",
      startDate: "",
      endDate: "",
      plannedParticipants: 0, // Дефолтное значение
    },
  });

  // Мутация создания соревнования
  const createMutation = useMutation({
    mutationFn: (data: CreateCompetitionFormData) =>
      createCompetition({
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        venue: data.venue || undefined,
        format: data.format,
        plannedParticipants: data.plannedParticipants, // Передаем на бэкенд
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/competitions"] });
      toast({
        title: "Соревнование создано",
        description: `«${form.getValues("name")}» добавлено в список`,
      });
      handleClose();
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось создать соревнование",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const onSubmit = (data: CreateCompetitionFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        data-testid="create-competition-dialog"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Создать соревнование</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {/* Название */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название *</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-competition-name"
                      placeholder="Кубок России по Фиджитал-спорту 2026"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Формат и Участники в одной строке */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Формат</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-competition-format">
                          <SelectValue placeholder="Выберите формат" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="olympic">Олимпийская система</SelectItem>
                        <SelectItem value="round_robin">Круговая система</SelectItem>
                        <SelectItem value="group_playoff">Группы + плей-офф</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="plannedParticipants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Участники (план) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="2"
                        data-testid="input-competition-participants"
                        placeholder="Например: 16"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Площадка */}
            <FormField
              control={form.control}
              name="venue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Площадка</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-competition-venue"
                      placeholder="Москва, Спортивный комплекс «Лужники»"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Даты — в одной строке */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дата начала *</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-competition-start-date"
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дата окончания *</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-competition-end-date"
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                data-testid="btn-cancel-create-competition"
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createMutation.isPending}
              >
                Отмена
              </Button>
              <Button
                data-testid="btn-submit-create-competition"
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Создать
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}