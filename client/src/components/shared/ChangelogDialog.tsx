import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, CheckCircle2, Wrench, Star, X, Rocket, Heart, Code2, Coffee, Sparkles } from "lucide-react";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "2.0.0";
const STORAGE_KEY = `changelog_seen_v${APP_VERSION}`;

interface ChangelogItem {
  type: "fix" | "feature" | "improve";
  text: string;
}

const CHANGELOG: ChangelogItem[] = [
  { type: "fix", text: "Слоты команд теперь восстанавливаются после перезагрузки страницы" },
  { type: "fix", text: "Команды отображаются в списке матчей и турнирной сетке" },
  { type: "fix", text: "Вход и выход из системы работает без перезагрузки страницы" },
  { type: "feature", text: "Редактирование названия и региона команды прямо в турнире" },
  { type: "feature", text: "Активная вкладка соревнования сохраняется при обновлении" },
  { type: "improve", text: "Версия системы отображается в боковой панели" },
  { type: "improve", text: "Визуальные улучшения навигации и карточек команд" },
];

const TYPE_CONFIG = {
  fix: {
    label: "Исправление",
    icon: Wrench,
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    iconClass: "text-red-400",
    dotClass: "bg-red-400",
    rowHover: "hover:border-red-500/30 hover:bg-red-500/5",
  },
  feature: {
    label: "Новая функция",
    icon: Star,
    className: "bg-primary/10 text-primary border-primary/20",
    iconClass: "text-primary",
    dotClass: "bg-primary",
    rowHover: "hover:border-primary/30 hover:bg-primary/5",
  },
  improve: {
    label: "Улучшение",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    iconClass: "text-emerald-400",
    dotClass: "bg-emerald-400",
    rowHover: "hover:border-emerald-500/30 hover:bg-emerald-500/5",
  },
};

const stats = {
  fixes: CHANGELOG.filter(i => i.type === "fix").length,
  features: CHANGELOG.filter(i => i.type === "feature").length,
  improvements: CHANGELOG.filter(i => i.type === "improve").length,
};

export function ChangelogDialog() {
  const [open, setOpen] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const timer = setTimeout(() => {
        setOpen(true);
        setTimeout(() => setAnimateIn(true), 50);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setAnimateIn(false);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "true");
      setOpen(false);
    }, 200);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300 ${animateIn ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Dialog — увеличен до max-w-2xl */}
      <div className={`relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${animateIn ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-6"}`}>

        {/* Радужная полоска */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-primary via-purple-500 to-pink-500" />

        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/5 to-purple-500/5 px-8 py-7 border-b border-border/50 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/8 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/8 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl pointer-events-none" />
          <div className="absolute top-5 right-20 opacity-20"><Sparkles className="w-6 h-6 text-primary" /></div>
          <div className="absolute top-14 right-12 opacity-10"><Sparkles className="w-4 h-4 text-purple-400" /></div>

          <button
            onClick={handleClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10 border border-border/50"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-5 relative">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/40 to-primary/10 border border-primary/30 flex items-center justify-center shadow-xl shadow-primary/20">
                <Rocket className="w-8 h-8 text-primary" />
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-emerald-500 rounded-full border-2 border-card flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground">Система обновлена!</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-muted-foreground">Фиджитал-спорт · Протокол матча</span>
                <Badge variant="outline" className="text-xs px-2.5 py-0.5 bg-primary/15 text-primary border-primary/25 font-black">
                  v{APP_VERSION}
                </Badge>
              </div>
            </div>
          </div>

          {/* Статистика */}
          <div className="flex items-center gap-4 mt-6">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <Wrench className="w-5 h-5 text-red-400" />
              <div>
                <div className="text-2xl font-black text-red-400 leading-none">{stats.fixes}</div>
                <div className="text-xs text-red-400/70 font-semibold mt-0.5">исправления</div>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
              <Star className="w-5 h-5 text-primary" />
              <div>
                <div className="text-2xl font-black text-primary leading-none">{stats.features}</div>
                <div className="text-xs text-primary/70 font-semibold mt-0.5">новых функции</div>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-2xl font-black text-emerald-400 leading-none">{stats.improvements}</div>
                <div className="text-xs text-emerald-400/70 font-semibold mt-0.5">улучшения</div>
              </div>
            </div>
          </div>
        </div>

        {/* Changelog list */}
        <div className="px-8 py-6 space-y-3 max-h-[360px] overflow-y-auto">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" />
            Что изменилось в версии {APP_VERSION}
          </p>
          {CHANGELOG.map((item, i) => {
            const cfg = TYPE_CONFIG[item.type];
            const Icon = cfg.icon;
            return (
              <div
                key={i}
                className={`flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-muted/20 transition-all duration-150 ${cfg.rowHover}`}
              >
                <div className={`mt-0.5 p-2.5 rounded-xl border flex-shrink-0 ${cfg.className}`}>
                  <Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] uppercase font-black tracking-wider ${cfg.iconClass}`}>
                      {cfg.label}
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full opacity-60 ${cfg.dotClass}`} />
                  </div>
                  <p className="text-sm text-foreground/85 leading-relaxed">{item.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Привет от разработчика */}
        <div className="mx-8 mb-6 p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/8 to-transparent border border-amber-500/25">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/40 to-orange-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-2xl shadow-sm">
              👨‍💻
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base font-black text-amber-500">Привет от разработчика!</span>
                <Code2 className="w-4 h-4 text-amber-500/70" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Это обновление сделал <span className="font-black text-foreground">Эдька</span> — с любовью,
                кофе <Coffee className="w-3.5 h-3.5 inline text-amber-500/80" /> и бессонными ночами 🌙.
                Если что-то сломалось, нашли баги или есть крутые идеи — пишите, всегда рад помочь и сделать систему лучше!
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                <Heart className="w-4 h-4 text-red-400 fill-red-400" />
                <span className="text-xs text-muted-foreground font-medium">Сделано с душой для фиджитал-спорта</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-7">
          <Button
            onClick={handleClose}
            className="w-full gap-2 h-12 text-base font-bold shadow-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 rounded-xl"
          >
            <Rocket className="w-5 h-5" />
            Отлично, поехали работать!
          </Button>
        </div>
      </div>
    </div>
  );
}