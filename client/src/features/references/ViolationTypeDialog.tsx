/**
 * ДИАЛОГ СОЗДАНИЯ / РЕДАКТИРОВАНИЯ ТИПА НАРУШЕНИЯ
 *
 * Поля: article, description, penaltyPts, vtype.
 * После сохранения инвалидирует кеш /api/v1/references/violation-types.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { createViolationType, updateViolationType } from "./references.api";
import { useToast } from "@/hooks/use-toast";
import type { ViolationTypeRecord, ViolationType } from "@shared/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// -------------------------------------------------------
// Русские метки для типов нарушений
// -------------------------------------------------------

export const VTYPE_LABELS: Record<ViolationType, string> = {
  warning: "Предупреждение",
  disqualification: "Дисквалификация",
  technical: "Техническое нарушение",
  other: "Прочее",
};

// -------------------------------------------------------
// Схема формы
// -------------------------------------------------------

const violationFormSchema = z.object({
  article: z.string().min(1, "Статья регламента обязательна"),
  description: z.string().min(1, "Описание обязательно"),
  penaltyPts: z
    .number({ invalid_type_error: "Введите число" })
    .min(0, "Штраф не может быть отрицательным"),
  vtype: z.enum(["warning", "disqualification", "technical", "other"]),
});

type ViolationFormData = z.infer<typeof violationFormSchema>;

// -------------------------------------------------------
// Пропсы
// -------------------------------------------------------

interface ViolationTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Данные для редактирования. Если не переданы — режим создания. */
  editData?: ViolationTypeRecord | null;
}

// -------------------------------------------------------
// Компонент
// -------------------------------------------------------

export function ViolationTypeDialog({
  open,
  onOpenChange,
  editData,
}: ViolationTypeDialogProps) {
  const { toast } = useToast();
  const isEdit = !!editData;

  const form = useForm<ViolationFormData>({
    resolver: zodResolver(violationFormSchema),
    defaultValues: {
      article: "",
      description: "",
      penaltyPts: 0,
      vtype: "warning",
    },
  });

  // Заполняем форму при открытии в режиме редактирования
  useEffect(() => {
    if (open) {
      if (editData) {
        form.reset({
          article: editData.article,
          description: editData.description,
          penaltyPts: editData.penaltyPts,
          vtype: editData.vtype,
        });
      } else {
        form.reset({
          article: "",
          description: "",
          penaltyPts: 0,
          vtype: "warning",
        });
      }
    }
  }, [open, editData, form]);

  // Ключ инвалидации кеша
  const VT_KEY = ["/api/v1/references/violation-types"];

  const saveMutation = useMutation({
    mutationFn: (data: ViolationFormData) => {
      const payload = {
        article: data.article,
        description: data.description,
        penaltyPts: data.penaltyPts,
        vtype: data.vtype,
        isActive: editData?.isActive ?? true,
      };
      return isEdit
        ? updateViolationType(editData!.id, payload)
        : createViolationType(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VT_KEY });
      toast({
        title: isEdit ? "Тип нарушения обновлён" : "Тип нарушения добавлен",
        description: `Статья «${form.getValues("article")}» сохранена`,
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось сохранить тип нарушения",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ViolationFormData) => saveMutation.mutate(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Редактировать тип нарушения" : "Добавить тип нарушения"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Статья регламента */}
            <FormField
              control={form.control}
              name="article"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Статья регламента *</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-vt-article"
                      placeholder="3.2.1"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Описание */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание *</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-vt-description"
                      placeholder="Использование запрещённого ПО"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Штрафные очки */}
            <FormField
              control={form.control}
              name="penaltyPts"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Штраф (очки)</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-vt-penalty"
                      type="number"
                      min={0}
                      step={0.5}
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Тип нарушения */}
            <FormField
              control={form.control}
              name="vtype"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип нарушения</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-vt-type">
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.entries(VTYPE_LABELS) as [ViolationType, string][]).map(
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
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveMutation.isPending}
              >
                Отмена
              </Button>
              <Button
                data-testid="btn-submit-vt"
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
