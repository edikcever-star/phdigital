/**
 * ДИАЛОГ СОЗДАНИЯ ГЛОБАЛЬНОЙ КОМАНДЫ
 *
 * Форма с валидацией через react-hook-form + zod.
 * После создания инвалидирует кеш списка команд и показывает toast.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { createTeam } from "./teams.api";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// -------------------------------------------------------
// Схема валидации
// -------------------------------------------------------

const createTeamSchema = z.object({
  name: z
    .string()
    .min(2, "Название должно содержать минимум 2 символа")
    .max(120, "Название слишком длинное"),
  region: z.string().optional(),
  notes: z.string().optional(),
});

type CreateTeamFormData = z.infer<typeof createTeamSchema>;

// -------------------------------------------------------
// Компонент диалога
// -------------------------------------------------------

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTeamDialog({
  open,
  onOpenChange,
}: CreateTeamDialogProps) {
  const { toast } = useToast();

  const form = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: "",
      region: "",
      notes: "",
    },
  });

  // Мутация создания команды
  const createMutation = useMutation({
    mutationFn: (data: CreateTeamFormData) =>
      createTeam({
        name: data.name,
        region: data.region || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      // Инвалидируем список команд
      queryClient.invalidateQueries({ queryKey: ["/api/v1/teams"] });
      toast({
        title: "Команда создана",
        description: `«${form.getValues("name")}» добавлена в список`,
      });
      handleClose();
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось создать команду",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const onSubmit = (data: CreateTeamFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        data-testid="create-team-dialog"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Создать команду</DialogTitle>
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
                      data-testid="input-team-name"
                      placeholder="Название команды"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Регион */}
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Регион</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-team-region"
                      placeholder="Москва, Санкт-Петербург..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Заметки */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Заметки</FormLabel>
                  <FormControl>
                    <Textarea
                      data-testid="input-team-notes"
                      placeholder="Дополнительная информация..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2">
              <Button
                data-testid="btn-cancel-create-team"
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createMutation.isPending}
              >
                Отмена
              </Button>
              <Button
                data-testid="btn-submit-create-team"
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
