/**
 * ДИАЛОГ СОЗДАНИЯ / РЕДАКТИРОВАНИЯ КАРТЫ
 *
 * Принимает editData для режима редактирования.
 * После сохранения инвалидирует кеш /api/v1/references/maps.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { createMap, updateMap } from "./references.api";
import { useToast } from "@/hooks/use-toast";
import type { MapRecord } from "@shared/schema";
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

const mapFormSchema = z.object({
  name: z.string().min(1, "Название карты обязательно").max(80, "Слишком длинное название"),
  imagePath: z.string().optional(),
});

type MapFormData = z.infer<typeof mapFormSchema>;

// -------------------------------------------------------
// Пропсы компонента
// -------------------------------------------------------

interface MapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Данные для редактирования. Если не переданы — режим создания. */
  editData?: MapRecord | null;
}

// -------------------------------------------------------
// Компонент
// -------------------------------------------------------

export function MapDialog({ open, onOpenChange, editData }: MapDialogProps) {
  const { toast } = useToast();
  const isEdit = !!editData;

  const form = useForm<MapFormData>({
    resolver: zodResolver(mapFormSchema),
    defaultValues: { name: "", imagePath: "" },
  });

  // При открытии диалога в режиме редактирования — заполняем форму
  useEffect(() => {
    if (open) {
      if (editData) {
        form.reset({
          name: editData.name,
          imagePath: editData.imagePath ?? "",
        });
      } else {
        form.reset({ name: "", imagePath: "" });
      }
    }
  }, [open, editData, form]);

  // Ключ инвалидации кеша карт
  const MAPS_KEY = ["/api/v1/references/maps"];

  const saveMutation = useMutation({
    mutationFn: (data: MapFormData) => {
      const payload = {
        name: data.name,
        imagePath: data.imagePath || null,
        isActive: editData?.isActive ?? true,
      };
      return isEdit
        ? updateMap(editData!.id, payload)
        : createMap(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MAPS_KEY });
      toast({
        title: isEdit ? "Карта обновлена" : "Карта добавлена",
        description: `«${form.getValues("name")}» сохранена`,
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось сохранить карту",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MapFormData) => saveMutation.mutate(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать карту" : "Добавить карту"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Название */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название *</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-map-name"
                      placeholder="de_dust2"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Путь к изображению (опционально) */}
            <FormField
              control={form.control}
              name="imagePath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Путь к изображению</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-map-image-path"
                      placeholder="/images/maps/dust2.png"
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
                data-testid="btn-submit-map"
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
