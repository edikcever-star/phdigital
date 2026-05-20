/**
 * ДИАЛОГ СОЗДАНИЯ / РЕДАКТИРОВАНИЯ СУДЬИ
 *
 * Поля: fullName, category, defaultRole.
 * После сохранения инвалидирует кеш /api/v1/references/judges.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { createJudge, updateJudge } from "./references.api";
import { useToast } from "@/hooks/use-toast";
import type { Judge } from "@shared/schema";
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

// -------------------------------------------------------
// Схема формы
// -------------------------------------------------------

const judgeFormSchema = z.object({
  fullName: z
    .string()
    .min(2, "ФИО должно содержать минимум 2 символа")
    .max(120, "ФИО слишком длинное"),
  category: z.string().optional(),
  defaultRole: z.string().optional(),
});

type JudgeFormData = z.infer<typeof judgeFormSchema>;

// -------------------------------------------------------
// Пропсы
// -------------------------------------------------------

interface JudgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Данные для редактирования. Если не переданы — режим создания. */
  editData?: Judge | null;
}

// -------------------------------------------------------
// Компонент
// -------------------------------------------------------

export function JudgeDialog({ open, onOpenChange, editData }: JudgeDialogProps) {
  const { toast } = useToast();
  const isEdit = !!editData;

  const form = useForm<JudgeFormData>({
    resolver: zodResolver(judgeFormSchema),
    defaultValues: { fullName: "", category: "", defaultRole: "" },
  });

  // При открытии — заполняем форму данными для редактирования
  useEffect(() => {
    if (open) {
      if (editData) {
        form.reset({
          fullName: editData.fullName,
          category: editData.category ?? "",
          defaultRole: editData.defaultRole ?? "",
        });
      } else {
        form.reset({ fullName: "", category: "", defaultRole: "" });
      }
    }
  }, [open, editData, form]);

  // Ключ инвалидации кеша судей
  const JUDGES_KEY = ["/api/v1/references/judges"];

  const saveMutation = useMutation({
    mutationFn: (data: JudgeFormData) => {
      const payload = {
        fullName: data.fullName,
        category: data.category || null,
        defaultRole: data.defaultRole || null,
        isActive: editData?.isActive ?? true,
      };
      return isEdit
        ? updateJudge(editData!.id, payload)
        : createJudge(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JUDGES_KEY });
      toast({
        title: isEdit ? "Судья обновлён" : "Судья добавлен",
        description: `«${form.getValues("fullName")}» сохранён`,
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось сохранить судью",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JudgeFormData) => saveMutation.mutate(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Редактировать судью" : "Добавить судью"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* ФИО */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ФИО *</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-judge-fullname"
                      placeholder="Иванов Иван Иванович"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Категория */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Категория</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-judge-category"
                      placeholder="Первая, Вторая, Национальная..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Должность по умолчанию */}
            <FormField
              control={form.control}
              name="defaultRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Должность по умолчанию</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-judge-role"
                      placeholder="Главный судья, Секретарь..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveMutation.isPending}
              >
                Отмена
              </Button>
              <Button
                data-testid="btn-submit-judge"
                type="submit"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                {isEdit ? "Сохранить" : "Добавить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
