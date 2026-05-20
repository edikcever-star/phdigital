/**
 * СТРАНИЦА ВХОДА
 *
 * Профессиональный экран выбора роли и имени для судейской бригады.
 * Не похож на обычную форму логина — это выбор участника команды.
 *
 * UX принципы:
 * - Крупные кликабельные карточки ролей
 * - Быстрый вход из существующего списка
 * - Возможность создать нового участника
 * - PIN только если он задан
 */

import { useState } from "react";
import { useAuth, useUsersList } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  BookOpen,
  ChevronRight,
  UserPlus,
  ArrowLeft,
  Lock,
  Loader2,
} from "lucide-react";
import type { UserRole } from "@shared/schema";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@shared/constants/roles";

// Иконки и цвета для ролей
const ROLE_CONFIG: Record<UserRole, { icon: typeof Shield; color: string; bgColor: string }> = {
  chief_judge: { icon: Shield, color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/60" },
  chief_secretary: { icon: BookOpen, color: "text-indigo-400", bgColor: "bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/60" },
  deputy_judge: { icon: Shield, color: "text-cyan-400", bgColor: "bg-cyan-500/10 border-cyan-500/30 hover:border-cyan-500/60" },
  tech_secretary: { icon: BookOpen, color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60" },
};

type LoginStep = "select_user" | "select_role" | "enter_name" | "enter_pin";

export default function LoginPage() {
  const { login, isLoggingIn, loginError } = useAuth();
  const { data: usersData, isLoading: usersLoading } = useUsersList();

  const [step, setStep] = useState<LoginStep>("select_user");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");

  const existingUsers = usersData?.data ?? [];

  const handleSelectExistingUser = async (user: (typeof existingUsers)[0]) => {
    if (user.requiresPin) {
      setSelectedRole(user.role as UserRole);
      setDisplayName(user.displayName);
      setStep("enter_pin");
    } else {
      await login({ displayName: user.displayName, role: user.role });
    }
  };

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setStep("enter_name");
  };

  const handleSubmitName = () => {
    if (!displayName.trim() || !selectedRole) return;
    setStep("enter_pin"); // Сначала попробуем — PIN потребуется если задан
    // Попытка входа без PIN
    login({ displayName: displayName.trim(), role: selectedRole }).catch(() => {
      // Если ошибка — может требоваться PIN
    });
  };

  const handleSubmitPin = async () => {
    if (!selectedRole) return;
    await login({ displayName, role: selectedRole, pin });
  };

  const handleBack = () => {
    setPin("");
    if (step === "enter_pin") {
      setStep(displayName ? "select_user" : "select_role");
    } else if (step === "enter_name") {
      setStep("select_role");
    } else if (step === "select_role") {
      setStep("select_user");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            {/* SVG логотип */}
            <svg
              viewBox="0 0 32 32"
              className="w-8 h-8 text-primary"
              fill="none"
              aria-label="Фиджитал-спорт"
            >
              {/* F — цифровой */}
              <rect x="4" y="4" width="3" height="14" fill="currentColor" opacity="0.9" rx="1"/>
              <rect x="4" y="4" width="10" height="3" fill="currentColor" opacity="0.9" rx="1"/>
              <rect x="4" y="10" width="7" height="2.5" fill="currentColor" opacity="0.7" rx="1"/>
              {/* P — физический (зеркальный) */}
              <rect x="17" y="14" width="3" height="14" fill="currentColor" opacity="0.5" rx="1"/>
              <rect x="17" y="14" width="10" height="3" fill="currentColor" opacity="0.5" rx="1"/>
              <rect x="17" y="20" width="7" height="2.5" fill="currentColor" opacity="0.4" rx="1"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">
            Протокол матча
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Фиджитал-спорт · Версия 2
          </p>
        </div>

        <Card className="border-border bg-card shadow-md">
          {/* Шаг: выбор существующего пользователя */}
          {step === "select_user" && (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                  Выберите участника или войдите как новый
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Загрузка...
                  </div>
                ) : existingUsers.length > 0 ? (
                  <>
                    {existingUsers.map((user) => {
                      const config = ROLE_CONFIG[user.role as UserRole];
                      const Icon = config.icon;
                      return (
                        <button
                          key={user.id}
                          data-testid={`user-card`}
                          data-user-id={user.id}
                          onClick={() => handleSelectExistingUser(user)}
                          disabled={isLoggingIn}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-150
                            ${config.bgColor} active:scale-[0.99]`}
                        >
                          <div className={`flex-shrink-0 ${config.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="font-medium text-foreground text-sm">
                              {user.displayName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {ROLE_LABELS[user.role as UserRole]}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {user.requiresPin && (
                              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}

                    <Separator className="my-3" />
                  </>
                ) : null}

                <button
                  data-testid="btn-new-user"
                  onClick={() => setStep("select_role")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-border
                    hover:border-primary/50 hover:bg-primary/5 transition-all duration-150"
                >
                  <UserPlus className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Войти как новый участник
                  </span>
                </button>

                {loginError && (
                  <p className="text-sm text-destructive mt-2 text-center">
                    {loginError}
                  </p>
                )}
              </CardContent>
            </>
          )}

          {/* Шаг: выбор роли */}
          {step === "select_role" && (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <CardTitle className="text-base font-semibold">
                    Выберите роль
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => {
                  const config = ROLE_CONFIG[role];
                  const Icon = config.icon;
                  return (
                    <button
                      key={role}
                      data-testid={`role-card`}
                      data-role={role}
                      onClick={() => handleSelectRole(role)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-150
                        ${config.bgColor} active:scale-[0.99]`}
                    >
                      <div className={`flex-shrink-0 ${config.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-foreground text-sm">
                          {ROLE_LABELS[role]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ROLE_DESCRIPTIONS[role]}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </CardContent>
            </>
          )}

          {/* Шаг: ввод имени */}
          {step === "enter_name" && (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <CardTitle className="text-base font-semibold">
                    Введите ФИО
                  </CardTitle>
                </div>
                {selectedRole && (
                  <Badge variant="outline" className="w-fit mt-1 text-xs">
                    {ROLE_LABELS[selectedRole]}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  data-testid="input-display-name"
                  placeholder="Фамилия Имя Отчество"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitName()}
                  className="text-base h-11"
                  autoFocus
                />
                {loginError && (
                  <p className="text-sm text-destructive">{loginError}</p>
                )}
                <Button
                  data-testid="btn-confirm-name"
                  onClick={handleSubmitName}
                  disabled={!displayName.trim() || isLoggingIn}
                  className="w-full h-11"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Войти
                </Button>
              </CardContent>
            </>
          )}

          {/* Шаг: ввод PIN */}
          {step === "enter_pin" && (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <CardTitle className="text-base font-semibold">
                    Введите PIN
                  </CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {displayName}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  data-testid="input-pin"
                  type="password"
                  placeholder="PIN-код"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitPin()}
                  className="text-base h-11 tracking-widest text-center"
                  autoFocus
                  maxLength={8}
                />
                {loginError && (
                  <p className="text-sm text-destructive">{loginError}</p>
                )}
                <Button
                  data-testid="btn-confirm-pin"
                  onClick={handleSubmitPin}
                  disabled={!pin || isLoggingIn}
                  className="w-full h-11"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Войти
                </Button>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Локальная сеть · Без интернета
        </p>
      </div>
    </div>
  );
}
