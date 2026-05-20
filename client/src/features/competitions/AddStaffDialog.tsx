import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { addStaffToCompetition } from "./competitions.api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface AddStaffDialogProps {
  competitionId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STAFF_ROLES = [
  { value: "chief_judge", label: "Главный судья" },
  { value: "chief_secretary", label: "Главный секретарь" },
  { value: "deputy_chief_judge", label: "Заместитель главного судьи" },
  { value: "technical_secretary", label: "Технический секретарь" },
];

export function AddStaffDialog({ competitionId, open, onOpenChange }: AddStaffDialogProps) {
  const { toast } = useToast();
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");

     // Получаем глобальный список судей
  const { data: globalJudges, isLoading: judgesLoading } = useQuery({
    queryKey: ["/api/v1/references/judges"],
    queryFn: async () => {
      // apiRequest уже возвращает объект, который нам нужен (без вызова res.json())
      const response = await apiRequest<{ success: boolean; data: any[] }>(
        "GET", 
        "/api/v1/references/judges"
      );
      return response.data;
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => addStaffToCompetition(competitionId, { 
      judgeId: parseInt(selectedJudgeId), 
      staffRole: selectedRole 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/competitions/${competitionId}/staff`] });
      toast({ title: "Судья успешно назначен" });
      onOpenChange(false);
      setSelectedJudgeId("");
      setSelectedRole("");
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJudgeId || !selectedRole) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Назначить судью на соревнование</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Судья (из глобального справочника)</Label>
            <Select value={selectedJudgeId} onValueChange={setSelectedJudgeId} disabled={judgesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={judgesLoading ? "Загрузка..." : "Выберите судью"} />
              </SelectTrigger>
              <SelectContent>
                {globalJudges?.map((judge: any) => (
                  <SelectItem key={judge.id} value={judge.id.toString()}>
                    {judge.fullName} {judge.category ? `(${judge.category})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Роль в соревновании</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите роль" />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="mr-2">
              Отмена
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Назначить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}