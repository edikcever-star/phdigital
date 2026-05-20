/**
 * СТРАНИЦА ИМПОРТА СТАТИСТИКИ
 *
 * Трёхшаговый wizard для загрузки и применения данных из Excel/CSV файлов.
 * Маршрут: /#/matches/:matchId/import
 *
 * Шаг 1 — выбор типа импорта и загрузка файла
 * Шаг 2 — превью данных с валидацией
 * Шаг 3 — результат применения импорта
 */

import { useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, API_BASE } from "@/lib/queryClient";
import type { ImportPreviewDTO } from "@shared/contracts/api";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

// -------------------------------------------------------
// Константы типов импорта
// -------------------------------------------------------

type ImportType = "digital_stats" | "physical_stats" | "players";

const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  digital_stats: "Статистика цифрового этапа",
  physical_stats: "Статистика физического этапа",
  players: "Список игроков",
};

// -------------------------------------------------------
// Шаг 1 — Выбор типа и файла
// -------------------------------------------------------

interface Step1Props {
  matchId: string;
  onPreviewReady: (preview: ImportPreviewDTO) => void;
}

function Step1Upload({ matchId, onPreviewReady }: Step1Props) {
  const [importType, setImportType] = useState<ImportType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Принимаемые расширения файлов */
  const ACCEPTED_EXTENSIONS = ".xlsx,.xls,.csv";

  /**
   * Проверяет формат файла по расширению.
   */
  function isValidFile(f: File): boolean {
    return /\.(xlsx|xls|csv)$/i.test(f.name);
  }

  /**
   * Обработчик выбора файла через input.
   */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!isValidFile(selected)) {
      setError("Неверный формат файла. Допустимы: .xlsx, .xls, .csv");
      setFile(null);
      return;
    }
    setError(null);
    setFile(selected);
  }

  /**
   * Drag-and-drop обработчики.
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;

    if (!isValidFile(dropped)) {
      setError("Неверный формат файла. Допустимы: .xlsx, .xls, .csv");
      setFile(null);
      return;
    }
    setError(null);
    setFile(dropped);
  }, []);

  /**
   * Отправляет файл на сервер для получения превью.
   * Использует обычный fetch с FormData (не apiRequest), т.к. тело — multipart.
   */
  async function handleUpload() {
    if (!file) {
      setError("Выберите файл для загрузки.");
      return;
    }
    if (!importType) {
      setError("Выберите тип импорта.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${API_BASE}/api/v1/matches/${matchId}/import/preview?importType=${importType}`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: { message: "Ошибка сети" } }));
        throw new Error(
          errJson?.error?.message ?? `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const json = (await res.json()) as { success: boolean; data: ImportPreviewDTO };

      if (!json.success) {
        throw new Error("Сервер вернул ошибку при обработке файла.");
      }

      onPreviewReady(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Заголовок шага */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Шаг 1: Выбор типа и файла</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Выберите тип данных для импорта и загрузите файл Excel или CSV.
        </p>
      </div>

      {/* Выбор типа импорта */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Тип импорта</label>
        <Select
          value={importType}
          onValueChange={(val) => setImportType(val as ImportType)}
        >
          <SelectTrigger
            className="w-full max-w-sm"
            data-testid="import-type-select"
          >
            <SelectValue placeholder="Выберите тип..." />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(IMPORT_TYPE_LABELS) as [ImportType, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Drag-and-drop зона */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          isDragging
            ? "border-primary bg-primary/5"
            : file
            ? "border-green-500/50 bg-green-500/5"
            : "border-border hover:border-primary/40 hover:bg-muted/30",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleFileChange}
        />

        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileSpreadsheet className="w-10 h-10 text-green-500" />
            <p className="font-medium text-foreground text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} КБ — нажмите, чтобы сменить файл
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-10 h-10 text-muted-foreground" />
            <p className="font-medium text-foreground text-sm">
              Перетащите файл или нажмите для выбора
            </p>
            <p className="text-xs text-muted-foreground">
              Поддерживаются форматы: .xlsx, .xls, .csv (до 10 МБ)
            </p>
          </div>
        )}
      </div>

      {/* Ошибка */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Кнопка загрузки */}
      <Button
        data-testid="btn-upload"
        onClick={handleUpload}
        disabled={isLoading || !file || !importType}
        className="w-full sm:w-auto"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Загрузка и проверка...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Загрузить и проверить
          </>
        )}
      </Button>
    </div>
  );
}

// -------------------------------------------------------
// Шаг 2 — Превью и валидация
// -------------------------------------------------------

interface Step2Props {
  preview: ImportPreviewDTO;
  matchId: string;
  onApplied: (appliedCount: number) => void;
  onBack: () => void;
}

function Step2Preview({ preview, matchId, onApplied, onBack }: Step2Props) {
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  /**
   * Отправляет данные на сервер для применения импорта.
   */
  async function handleApply() {
    setIsApplying(true);
    setApplyError(null);

    try {
      // Собираем все валидные строки из превью (для MVP передаём только их)
      const validRows = preview.preview
        .filter((r) => r.isValid)
        .map((r) => r.data);

      type ApplyResponse = { success: boolean; data: { applied: number; errors: string[] } };

      const resp = await apiRequest<ApplyResponse>(
        "POST",
        `/api/v1/matches/${matchId}/import/apply`,
        {
          importId: preview.importId,
          importType: preview.importType,
          rows: validRows,
          matchId: Number(matchId),
        }
      );

      if (!resp.success) {
        throw new Error("Сервер вернул ошибку при применении импорта.");
      }

      onApplied(resp.data.applied);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Неизвестная ошибка применения");
    } finally {
      setIsApplying(false);
    }
  }

  const canApply = preview.validRows > 0;

  return (
    <div className="space-y-6">
      {/* Заголовок шага */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Шаг 2: Превью данных</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Файл: <span className="font-medium text-foreground">{preview.filename}</span>
          {" — "}
          {IMPORT_TYPE_LABELS[preview.importType as ImportType] ?? preview.importType}
        </p>
      </div>

      {/* Статистика строк */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <span className="text-sm text-muted-foreground">Всего строк:</span>
          <span className="font-semibold text-foreground">{preview.totalRows}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm text-muted-foreground">Валидных:</span>
          <span className="font-semibold text-green-500">{preview.validRows}</span>
        </div>
        {preview.invalidRows > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-muted-foreground">С ошибками:</span>
            <span className="font-semibold text-red-500">{preview.invalidRows}</span>
          </div>
        )}
      </div>

      {/* Предупреждение — нет валидных строк */}
      {!canApply && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Файл не содержит валидных строк. Исправьте данные и загрузите файл заново.
          </AlertDescription>
        </Alert>
      )}

      {/* Таблица превью */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">
          Превью (первые {preview.preview.length} строк)
        </h3>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="w-20 text-center">Статус</TableHead>
                  {preview.columns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap">
                      {col}
                    </TableHead>
                  ))}
                  <TableHead>Ошибки</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.preview.map((row) => (
                  <TableRow
                    key={row.rowIndex}
                    className={
                      row.isValid
                        ? ""
                        : "bg-red-500/5 border-l-2 border-red-500"
                    }
                  >
                    {/* Номер строки */}
                    <TableCell className="text-center text-muted-foreground text-xs">
                      {row.rowIndex}
                    </TableCell>

                    {/* Иконка статуса */}
                    <TableCell className="text-center">
                      {row.isValid ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                      )}
                    </TableCell>

                    {/* Данные ячеек */}
                    {preview.columns.map((col) => (
                      <TableCell key={col} className="text-xs whitespace-nowrap">
                        {String(row.data[col] ?? "")}
                      </TableCell>
                    ))}

                    {/* Список ошибок */}
                    <TableCell className="text-xs text-red-400 min-w-[200px]">
                      {row.errors.length > 0 ? (
                        <ul className="list-disc list-inside space-y-0.5">
                          {row.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-green-500">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Ошибка применения */}
      {applyError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{applyError}</AlertDescription>
        </Alert>
      )}

      {/* Действия */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onBack} disabled={isApplying}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Загрузить другой файл
        </Button>

        <Button
          data-testid="btn-apply"
          onClick={handleApply}
          disabled={!canApply || isApplying}
        >
          {isApplying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Применение...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Применить импорт
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Шаг 3 — Результат
// -------------------------------------------------------

interface Step3Props {
  appliedCount: number;
  matchId: string;
  onImportMore: () => void;
}

function Step3Result({ appliedCount, matchId, onImportMore }: Step3Props) {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-6">
      {/* Успех */}
      <div className="flex flex-col items-center text-center py-8 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Импорт выполнен</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Применено строк:{" "}
            <span className="font-semibold text-foreground">{appliedCount}</span>
          </p>
        </div>

        <Badge
          variant="outline"
          className="bg-green-500/10 text-green-500 border-green-500/30 text-sm"
        >
          Успешно
        </Badge>
      </div>

      {/* Действия */}
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(`/matches/${matchId}/setup`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          К матчу
        </Button>

        <Button onClick={onImportMore}>
          <Upload className="w-4 h-4 mr-2" />
          Импортировать ещё
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Индикатор шагов wizard
// -------------------------------------------------------

function WizardSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Загрузка" },
    { n: 2, label: "Превью" },
    { n: 3, label: "Результат" },
  ];

  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((step, idx) => (
        <div key={step.n} className="flex items-center gap-1">
          <div
            className={[
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all",
              current === step.n
                ? "bg-primary text-primary-foreground"
                : current > step.n
                ? "bg-green-500 text-white"
                : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {current > step.n ? <CheckCircle2 className="w-4 h-4" /> : step.n}
          </div>
          <span
            className={[
              "text-xs",
              current === step.n ? "text-foreground font-medium" : "text-muted-foreground",
            ].join(" ")}
          >
            {step.label}
          </span>
          {idx < steps.length - 1 && (
            <ChevronRight className="w-3 h-3 text-muted-foreground mx-1" />
          )}
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------
// Главный компонент страницы
// -------------------------------------------------------

export default function ImportPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId ?? "";

  // Текущий шаг wizard
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Данные превью (шаг 2)
  const [preview, setPreview] = useState<ImportPreviewDTO | null>(null);

  // Количество применённых строк (шаг 3)
  const [appliedCount, setAppliedCount] = useState(0);

  /**
   * Переход к шагу 2 после получения превью.
   */
  function handlePreviewReady(data: ImportPreviewDTO) {
    setPreview(data);
    setStep(2);
  }

  /**
   * Переход к шагу 3 после применения импорта.
   */
  function handleApplied(count: number) {
    setAppliedCount(count);
    setStep(3);
  }

  /**
   * Сброс wizard — назад к шагу 1.
   */
  function handleReset() {
    setPreview(null);
    setAppliedCount(0);
    setStep(1);
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Заголовок страницы */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Импорт статистики
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Матч #{matchId} — загрузка данных из Excel/CSV файла
          </p>
        </div>

        {/* Прогресс-индикатор */}
        <WizardSteps current={step} />

        {/* Контент шага */}
        <div className="rounded-xl border border-border bg-card p-6">
          {step === 1 && (
            <Step1Upload matchId={matchId} onPreviewReady={handlePreviewReady} />
          )}

          {step === 2 && preview && (
            <Step2Preview
              preview={preview}
              matchId={matchId}
              onApplied={handleApplied}
              onBack={handleReset}
            />
          )}

          {step === 3 && (
            <Step3Result
              appliedCount={appliedCount}
              matchId={matchId}
              onImportMore={handleReset}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
