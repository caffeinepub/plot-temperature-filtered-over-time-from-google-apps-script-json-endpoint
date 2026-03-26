import { AdvancedChartSection } from "@/components/AdvancedChartSection";
import { DashboardCard } from "@/components/DashboardCard";
import { SensorGroupManager } from "@/components/SensorGroupManager";
import {
  type HoveredGroup,
  TSICSensorChart,
} from "@/components/TSICSensorChart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useActor } from "@/hooks/useActor";
import { useIsCallerAdmin } from "@/hooks/useIsCallerAdmin";
import {
  getGroupColor,
  labelToHue,
  useSensorGroups,
} from "@/hooks/useSensorGroups";
import {
  useResetSensorLabels,
  useSensorLabels,
  useSetSensorLabel,
} from "@/hooks/useSensorLabels";
import { useSyncedTimeWindow } from "@/hooks/useSyncedTimeWindow";
import { useTSICData } from "@/hooks/useTSICData";
import { useSetLoggerLabel, useTSICLabels } from "@/hooks/useTSICLabels";
import {
  AlertCircle,
  Archive,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Pencil,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

function parseDDMMYYYY(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const year = Number.parseInt(match[3], 10);
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day)
    return null;
  return d;
}

// ─── Color helpers (for name group color picker) ───
function hueToHex(hue: number): string {
  const s = 0.7;
  const l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ─── NameColorPicker (hex-based) ───
function NameColorPicker({
  color,
  onChange,
}: { color: string; onChange: (color: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative flex-shrink-0">
      <span
        role="button"
        tabIndex={0}
        className="w-3 h-3 rounded-full block ring-1 ring-inset ring-black/10 cursor-pointer"
        style={{ backgroundColor: color }}
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") ref.current?.click();
        }}
      />
      <input
        ref={ref}
        type="color"
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        value={color}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── NameGroupPanel (admin only, byName mode) ───
function NameGroupPanel({
  activeLabels,
  nameColors,
  nameVisibility,
  onToggleVisible,
  onChangeColor,
}: {
  activeLabels: string[];
  nameColors: Record<string, string>;
  nameVisibility: Record<string, boolean>;
  onToggleVisible: (name: string) => void;
  onChangeColor: (name: string, color: string) => void;
}) {
  if (activeLabels.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic py-2">
        No sensors loaded. Select a logger ID first.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {activeLabels.map((label) => {
        const color =
          nameColors[label] !== undefined
            ? nameColors[label]
            : `hsl(${labelToHue(label)}, 70%, 50%)`;
        const isVisible = nameVisibility[label] !== false;
        return (
          <div key={label} className="flex items-center gap-2 py-0.5">
            <NameColorPicker
              color={color}
              onChange={(c) => onChangeColor(label, c)}
            />
            <span className="text-xs flex-1 truncate">{label}</span>
            <Switch
              checked={isVisible}
              onCheckedChange={() => onToggleVisible(label)}
              className="h-4 w-7 data-[state=checked]:bg-primary"
              data-ocid="tsic.name_group.toggle"
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── TSIC sensor legend (informative, below chart) ───
function TSICSensorLegend({
  groups,
  ungroupedSensors,
  ungroupedVisible,
  activeSensors,
  getSensorColor,
  sensorLabels,
  boldSensors,
}: {
  groups: any[];
  ungroupedSensors: number[];
  ungroupedVisible: boolean;
  activeSensors: number[];
  getSensorColor: (n: number) => string;
  sensorLabels?: Map<number, string>;
  boldSensors?: Set<number>;
}) {
  const activeSet = new Set(activeSensors);
  const visibleGroups = groups.filter((g) =>
    g.sensors.some((s: number) => activeSet.has(s)),
  );
  const activeUngrouped = ungroupedSensors.filter((s) => activeSet.has(s));

  if (visibleGroups.length === 0 && activeUngrouped.length === 0) return null;

  const getDisplayLabel = (sensorNum: number) => {
    const custom = sensorLabels?.get(sensorNum);
    return custom && custom.trim() !== "" ? custom : `S${sensorNum}`;
  };

  return (
    <div className="border-t border-border pt-4 pb-6 px-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Legend
      </p>
      <div className="flex flex-col gap-4">
        {visibleGroups.map((group) => {
          const groupColor = getGroupColor(group);
          const groupSensors = group.sensors.filter((s: number) =>
            activeSet.has(s),
          );
          return (
            <div key={group.id} className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 min-w-[90px] shrink-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: groupColor }}
                />
                <span className="text-xs font-semibold text-foreground truncate max-w-[130px]">
                  {group.name}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {groupSensors.map((sensorNum: number) => {
                  const sensorColor = getSensorColor(sensorNum);
                  const displayLabel = getDisplayLabel(sensorNum);
                  const isBold = boldSensors?.has(sensorNum);
                  return (
                    <span
                      key={sensorNum}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-border bg-muted/50"
                      title={`S${sensorNum}`}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: sensorColor }}
                      />
                      <span className={isBold ? "font-bold" : "font-medium"}>
                        {displayLabel}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
        {ungroupedVisible && activeUngrouped.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 min-w-[90px] shrink-0">
              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-muted-foreground/50" />
              <span className="text-xs font-semibold text-muted-foreground">
                Ungrouped
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeUngrouped.map((sensorNum) => {
                const sensorColor = getSensorColor(sensorNum);
                const displayLabel = getDisplayLabel(sensorNum);
                return (
                  <span
                    key={sensorNum}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-border bg-muted/50"
                    title={`S${sensorNum}`}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: sensorColor }}
                    />
                    <span className="font-medium">{displayLabel}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hover side panel ───
function HoverSidePanel({
  groups,
  timestamp,
}: {
  groups: HoveredGroup[] | null;
  timestamp: string | null;
}) {
  if (!groups || groups.length === 0) return null;

  return (
    <div className="text-xs">
      {timestamp && (
        <div className="text-[10px] text-muted-foreground pb-1 mb-1.5 border-b border-border">
          {timestamp}
        </div>
      )}
      <div className="space-y-2">
        {[...groups]
          .sort((a, b) => a.groupName.localeCompare(b.groupName))
          .map((group) => (
            <div key={group.groupName}>
              <div
                className="text-[10px] font-semibold mb-0.5 leading-tight"
                style={{ color: group.groupColor }}
              >
                {group.groupName}
              </div>
              {group.sensors.map((s) => (
                <div
                  key={s.label}
                  className="flex justify-between gap-2 leading-tight py-px"
                >
                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                    {s.label}
                  </span>
                  <span
                    className={[
                      "text-[10px] tabular-nums flex-shrink-0",
                      s.isBold ? "font-bold" : "",
                    ].join(" ")}
                  >
                    {s.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Admin-only label editor for logger ID buttons ───
function LoggerIdLabelEditor({
  id,
  currentLabel,
  onSave,
  isSaving,
}: {
  id: number;
  currentLabel: string;
  onSave: (id: number, label: string) => void;
  isSaving: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(currentLabel);

  if (isEditing) {
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation
      <div
        className="flex items-center gap-1 mt-1.5 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(id, draft);
              setIsEditing(false);
            } else if (e.key === "Escape") {
              setDraft(currentLabel);
              setIsEditing(false);
            }
          }}
          placeholder="Label..."
          className="h-6 text-xs px-1.5 py-0 flex-1 min-w-0"
          autoFocus
          maxLength={30}
          disabled={isSaving}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSave(id, draft);
            setIsEditing(false);
          }}
          disabled={isSaving}
          className="text-primary hover:text-primary/80 disabled:opacity-50 flex-shrink-0"
        >
          {isSaving ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(currentLabel);
            setIsEditing(false);
          }}
          disabled={isSaving}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50 flex-shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation
    <div
      className="flex items-center justify-center gap-1 mt-1.5 w-full group/label"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-xs text-muted-foreground truncate max-w-[80px]">
        {currentLabel || <span className="italic opacity-50">label...</span>}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDraft(currentLabel);
          setIsEditing(true);
        }}
        className="opacity-0 group-hover/label:opacity-100 transition-opacity text-muted-foreground hover:text-foreground flex-shrink-0"
        title="Edit label"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Main page ───

export function TSICLoggersPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useTSICData(selectedId);
  const { visibleRange, setRange, resetZoom, isZoomed } = useSyncedTimeWindow(
    data?.length || 0,
  );

  const [startDateText, setStartDateText] = useState("");
  const [endDateText, setEndDateText] = useState("");
  const [yAxisMin, setYAxisMin] = useState<number | null>(null);
  const [yAxisMax, setYAxisMax] = useState<number | null>(null);
  const [sensorGroupsOpen, setSensorGroupsOpen] = useState(false);
  const [colorMode, setColorMode] = useState<"byGroup" | "byName">("byGroup");

  // Hover state for side panel
  const [hoveredGroups, setHoveredGroups] = useState<HoveredGroup[] | null>(
    null,
  );
  const [hoveredTimestamp, setHoveredTimestamp] = useState<string | null>(null);

  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backupLabel, setBackupLabel] = useState("");
  const [isSavingBackup, setIsSavingBackup] = useState(false);

  const prevDataLengthRef = useRef<number>(0);

  const { isAdmin, isConfirmed } = useIsCallerAdmin();
  const { actor } = useActor();
  const { data: labelsMap } = useTSICLabels();
  const { mutate: saveLabel, isPending: isSavingLabel } = useSetLoggerLabel();
  const { data: sensorLabels } = useSensorLabels(selectedId);
  const { mutate: saveSensorLabel, isPending: isSavingSensorLabel } =
    useSetSensorLabel();
  const { mutate: resetSensorLabels } = useResetSensorLabels();

  const {
    groups,
    ungroupedSensors,
    ungroupedVisible,
    sensorVisibilityOverrides,
    boldSensors,
    dottedSensors,
    nameColors,
    nameVisibility,
    createGroup,
    deleteGroup,
    renameGroup,
    changeGroupColor,
    addSensorToGroup,
    removeSensorFromGroup,
    toggleGroupVisible,
    toggleSensorVisible,
    toggleUngroupedVisible,
    resetGroups,
    toggleSensorBold,
    toggleSensorDotted,
    changeNameGroupColor,
    toggleNameGroupVisible,
    reorderGroups,
    getSensorColor,
    getSensorColorByName,
    isSensorVisible,
    isSensorVisibleByName,
    isLoading: isGroupsLoading,
  } = useSensorGroups(isAdmin, selectedId);

  const [savingId, setSavingId] = useState<number | null>(null);

  const handleSaveBackup = useCallback(async () => {
    if (!actor || selectedId === null || !backupLabel.trim()) return;
    setIsSavingBackup(true);
    try {
      const [sensorGroupsJson, advancedConfigJson, existingJson] =
        await Promise.all([
          actor.getSensorGroupsForId(BigInt(selectedId)),
          actor.getAdvancedChartConfigForId(BigInt(selectedId)),
          (actor as any).getBackupsForId(BigInt(selectedId)),
        ]);

      const labelsArray: [number, string][] = [];
      if (sensorLabels) {
        sensorLabels.forEach((label, num) => labelsArray.push([num, label]));
      }
      const sensorLabelsJson = JSON.stringify(labelsArray);

      const newEntry = {
        id: Date.now().toString(),
        loggerId: selectedId,
        label: backupLabel.trim(),
        timestampMs: Date.now(),
        sensorGroupsJson,
        advancedConfigJson,
        sensorLabelsJson,
      };

      let existing: (typeof newEntry)[] = [];
      try {
        existing = JSON.parse(existingJson);
      } catch {
        existing = [];
      }
      existing.push(newEntry);
      await (actor as any).saveBackupsForId(
        BigInt(selectedId),
        JSON.stringify(existing),
      );
      setBackupDialogOpen(false);
      setBackupLabel("");
    } catch (e) {
      console.error("Failed to save backup:", e);
    } finally {
      setIsSavingBackup(false);
    }
  }, [actor, selectedId, backupLabel, sensorLabels]);

  const handleSaveLabel = useCallback(
    (id: number, label: string) => {
      setSavingId(id);
      saveLabel({ id, label }, { onSettled: () => setSavingId(null) });
    },
    [saveLabel],
  );

  const handleSaveSensorLabel = useCallback(
    (sensorNum: number, label: string) => {
      if (selectedId === null) return;
      saveSensorLabel({ loggerId: selectedId, sensorNum, label });
    },
    [saveSensorLabel, selectedId],
  );

  const handleReset = useCallback(() => {
    resetGroups();
    if (selectedId !== null) resetSensorLabels({ loggerId: selectedId });
  }, [resetGroups, resetSensorLabels, selectedId]);

  const handleResetStates = useCallback(() => {
    const currentDataLength = data?.length || 0;
    if (
      currentDataLength > 0 &&
      currentDataLength !== prevDataLengthRef.current
    ) {
      prevDataLengthRef.current = currentDataLength;
      setYAxisMin(null);
      setYAxisMax(null);
    }
  }, [data?.length]);

  const handleHoverChange = useCallback(
    (groups: HoveredGroup[] | null, timestamp: string | null) => {
      setHoveredGroups(groups);
      setHoveredTimestamp(timestamp);
    },
    [],
  );

  const dateRangeIndices = useMemo(() => {
    const start = parseDDMMYYYY(startDateText);
    const end = parseDDMMYYYY(endDateText);
    if (!data || !start || !end) return null;
    if (start > end) return null;
    end.setHours(23, 59, 59, 999);

    let startIndex = -1;
    let endIndex = -1;
    for (let i = 0; i < data.length; i++) {
      const pointTime = data[i].timestamp.getTime();
      if (startIndex === -1 && pointTime >= start.getTime()) startIndex = i;
      if (pointTime <= end.getTime()) endIndex = i;
    }
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      return { startIndex: -1, endIndex: -1, isEmpty: true };
    }
    return { startIndex, endIndex, isEmpty: false };
  }, [data, startDateText, endDateText]);

  useMemo(() => {
    if (dateRangeIndices && !dateRangeIndices.isEmpty) {
      setRange(dateRangeIndices.startIndex, dateRangeIndices.endIndex);
    }
  }, [dateRangeIndices, setRange]);

  const handleResetZoom = () => {
    resetZoom();
    setStartDateText("");
    setEndDateText("");
  };

  const handleIdClick = (id: number) => {
    setSelectedId(id);
    resetZoom();
    setStartDateText("");
    setEndDateText("");
    setYAxisMin(null);
    setYAxisMax(null);
    setHoveredGroups(null);
    setHoveredTimestamp(null);
    prevDataLengthRef.current = 0;
  };

  // Derive active sensors
  const activeSensors = useMemo(() => {
    if (!data || data.length === 0) return [];
    const active: number[] = [];
    for (let s = 1; s <= 72; s++) {
      const key = `S${s}` as keyof (typeof data)[0]["sensors"];
      const hasData = data.some((point) => {
        const val = point.sensors[key];
        return (
          val !== undefined &&
          val !== null &&
          !Number.isNaN(val as number) &&
          (val as number) !== 0
        );
      });
      if (hasData) active.push(s);
    }
    return active;
  }, [data]);

  // Helper: get display label for a sensor
  const getLabel = useCallback(
    (sensorNum: number): string => {
      const custom = sensorLabels?.get(sensorNum);
      return custom && custom.trim() !== "" ? custom : `S${sensorNum}`;
    },
    [sensorLabels],
  );

  // Unique labels for active sensors (for NameGroupPanel)
  const activeLabels = useMemo(() => {
    const labelSet = new Set<string>();
    for (const s of activeSensors) labelSet.add(getLabel(s));
    return Array.from(labelSet).sort();
  }, [activeSensors, getLabel]);

  // Build sensorColorMap based on colorMode
  const sensorColorMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (let s = 1; s <= 72; s++) {
      map[s] =
        colorMode === "byName"
          ? getSensorColorByName(s, getLabel)
          : getSensorColor(s);
    }
    return map;
  }, [colorMode, getSensorColor, getSensorColorByName, getLabel]);

  // Build sensorVisibility based on colorMode
  const sensorVisibility = useMemo(() => {
    const visibility: Record<string, boolean> = {};
    for (let s = 1; s <= 72; s++) {
      visibility[`S${s}`] =
        colorMode === "byName"
          ? isSensorVisibleByName(s, getLabel)
          : isSensorVisible(s);
    }
    return visibility;
  }, [colorMode, isSensorVisible, isSensorVisibleByName, getLabel]);

  const showAdminFeatures = isConfirmed && isAdmin;

  const refreshingIndicator = isRefetching ? (
    <span className="text-sm font-normal text-muted-foreground flex items-center gap-2">
      <RefreshCw className="h-3 w-3 animate-spin" />
      Refreshing...
    </span>
  ) : null;

  void hueToHex;

  return (
    <main className="container mx-auto px-6 py-8 space-y-6">
      {/* ── ID Selector ── */}
      <div className="rounded-xl border border-border bg-card shadow-sm px-4 py-3">
        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((id) => {
              const isActive = selectedId === id;
              return (
                <div
                  key={id}
                  className="flex flex-col items-center min-w-[64px]"
                >
                  <button
                    type="button"
                    onClick={() => handleIdClick(id)}
                    disabled={isLoading}
                    data-ocid="tsic.id_selector.button"
                    className={[
                      "h-10 px-4 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed w-full",
                      isActive
                        ? "text-white shadow-sm"
                        : "bg-transparent text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30 hover:bg-muted/40",
                    ].join(" ")}
                    style={
                      isActive
                        ? { backgroundColor: "#808A54", border: "none" }
                        : undefined
                    }
                  >
                    ID {id}
                  </button>
                  {showAdminFeatures && (
                    <LoggerIdLabelEditor
                      id={id}
                      currentLabel={labelsMap?.get(id) ?? ""}
                      onSave={handleSaveLabel}
                      isSaving={isSavingLabel && savingId === id}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && selectedId !== null && (
        <Card
          className="shadow-lg p-0 overflow-hidden"
          data-ocid="tsic.loading_state"
        >
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">
                Loading data for ID {selectedId}...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {isError && selectedId !== null && (
        <Alert
          variant="destructive"
          className="shadow-lg"
          data-ocid="tsic.error_state"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription className="mt-2">
            {error instanceof Error ? error.message : "Failed to fetch data"}
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* No ID selected */}
      {selectedId === null && (
        <Card className="shadow-lg" data-ocid="tsic.empty_state">
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-lg text-muted-foreground">
              Please select a logger ID to view sensor data
            </p>
          </CardContent>
        </Card>
      )}

      {/* No data */}
      {data && data.length === 0 && !isLoading && selectedId !== null && (
        <Alert className="shadow-lg" data-ocid="tsic.empty_state">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            No valid data points to display for ID {selectedId}.
          </AlertDescription>
        </Alert>
      )}

      {/* Data display */}
      {data && data.length > 0 && selectedId !== null && (
        <>
          {/* ── Chart Controls ── */}
          <Card className="shadow-sm" data-ocid="tsic.controls.card">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Chart Controls
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Date Range */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Date Range
                  </p>
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="start-date"
                        className="text-xs text-muted-foreground"
                      >
                        Start Date
                      </Label>
                      <Input
                        id="start-date"
                        type="text"
                        value={startDateText}
                        onChange={(e) => setStartDateText(e.target.value)}
                        placeholder="DD/MM/JJJJ"
                        maxLength={10}
                        className="w-full h-8 text-sm"
                        data-ocid="tsic.controls.input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="end-date"
                        className="text-xs text-muted-foreground"
                      >
                        End Date
                      </Label>
                      <Input
                        id="end-date"
                        type="text"
                        value={endDateText}
                        onChange={(e) => setEndDateText(e.target.value)}
                        placeholder="DD/MM/JJJJ"
                        maxLength={10}
                        className="w-full h-8 text-sm"
                        data-ocid="tsic.controls.input"
                      />
                    </div>
                  </div>
                  {(isZoomed || startDateText || endDateText) && (
                    <Button
                      onClick={handleResetZoom}
                      variant="outline"
                      size="sm"
                      className="gap-2 w-full sm:w-auto"
                      data-ocid="tsic.controls.button"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset Zoom
                    </Button>
                  )}
                  {dateRangeIndices?.isEmpty && (
                    <Alert className="mt-2 py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-xs">
                        No Data in Selected Range
                      </AlertTitle>
                      <AlertDescription className="text-xs">
                        No data points between selected dates.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Y-Axis */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">
                    Y-Axis
                  </p>
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="y-axis-min"
                        className="text-xs text-muted-foreground"
                      >
                        Minimum
                      </Label>
                      <Input
                        id="y-axis-min"
                        type="number"
                        placeholder="Auto"
                        value={yAxisMin ?? ""}
                        onChange={(e) =>
                          setYAxisMin(
                            e.target.value
                              ? Number.parseFloat(e.target.value)
                              : null,
                          )
                        }
                        className="w-full h-8 text-sm"
                        data-ocid="tsic.controls.input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="y-axis-max"
                        className="text-xs text-muted-foreground"
                      >
                        Maximum
                      </Label>
                      <Input
                        id="y-axis-max"
                        type="number"
                        placeholder="Auto"
                        value={yAxisMax ?? ""}
                        onChange={(e) =>
                          setYAxisMax(
                            e.target.value
                              ? Number.parseFloat(e.target.value)
                              : null,
                          )
                        }
                        className="w-full h-8 text-sm"
                        data-ocid="tsic.controls.input"
                      />
                    </div>
                  </div>
                  {(yAxisMin !== null || yAxisMax !== null) && (
                    <Button
                      onClick={() => {
                        setYAxisMin(null);
                        setYAxisMax(null);
                      }}
                      variant="outline"
                      size="sm"
                      className="gap-2 w-full sm:w-auto"
                      data-ocid="tsic.controls.button"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset Y-Axis
                    </Button>
                  )}
                </div>
              </div>

              {/* Color mode toggle */}
              <div className="border-t border-border pt-3 mt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Color Mode
                </p>
                <div className="flex gap-2">
                  <Button
                    variant={colorMode === "byGroup" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setColorMode("byGroup")}
                    className="h-7 text-xs"
                    data-ocid="tsic.color_mode.button"
                    style={
                      colorMode === "byGroup"
                        ? { backgroundColor: "#808A54" }
                        : undefined
                    }
                  >
                    By Group
                  </Button>
                  <Button
                    variant={colorMode === "byName" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setColorMode("byName")}
                    className="h-7 text-xs"
                    data-ocid="tsic.color_mode.button"
                    style={
                      colorMode === "byName"
                        ? { backgroundColor: "#808A54" }
                        : undefined
                    }
                  >
                    By Sensor Name
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Merged: Sensor Groups + Name Groups (admin, collapsible) ── */}
          {showAdminFeatures && !isGroupsLoading && (
            <Collapsible
              open={sensorGroupsOpen}
              onOpenChange={setSensorGroupsOpen}
            >
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    data-ocid="tsic.sensor_groups.toggle"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      Sensor &amp; Name Groups
                    </span>
                    {sensorGroupsOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border">
                    <SensorGroupManager
                      activeSensors={activeSensors}
                      groups={groups}
                      ungroupedSensors={ungroupedSensors}
                      ungroupedVisible={ungroupedVisible}
                      sensorVisibilityOverrides={sensorVisibilityOverrides}
                      boldSensors={boldSensors}
                      dottedSensors={dottedSensors}
                      getSensorColor={getSensorColor}
                      isSensorVisible={isSensorVisible}
                      onCreateGroup={createGroup}
                      onDeleteGroup={deleteGroup}
                      onRenameGroup={renameGroup}
                      onAddSensorToGroup={addSensorToGroup}
                      onRemoveSensorFromGroup={removeSensorFromGroup}
                      onToggleGroupVisible={toggleGroupVisible}
                      onToggleSensorVisible={toggleSensorVisible}
                      onToggleUngroupedVisible={toggleUngroupedVisible}
                      onToggleSensorBold={toggleSensorBold}
                      onToggleSensorDotted={toggleSensorDotted}
                      onReset={handleReset}
                      onChangeGroupColor={changeGroupColor}
                      onReorderGroups={reorderGroups}
                      sensorLabels={sensorLabels}
                      onSaveSensorLabel={handleSaveSensorLabel}
                      isSavingSensorLabel={isSavingSensorLabel}
                    />

                    {/* Name Groups sub-section (only in byName mode) */}
                    {colorMode === "byName" && (
                      <div className="border-t border-border px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Name Groups
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">
                          Each unique sensor name gets its own color. Click the
                          dot to change it.
                        </p>
                        <NameGroupPanel
                          activeLabels={activeLabels}
                          nameColors={nameColors}
                          nameVisibility={nameVisibility}
                          onToggleVisible={toggleNameGroupVisible}
                          onChangeColor={changeNameGroupColor}
                        />
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* ── Chart + Side panel + Legend ── */}
          <DashboardCard
            title={`TSIC Logger ${selectedId} - All sensor readings over time`}
            headerAction={
              <div className="flex items-center gap-2">
                {refreshingIndicator}
                {showAdminFeatures && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBackupDialogOpen(true)}
                    className="h-7 text-xs gap-1.5"
                    data-ocid="tsic.backup.open_modal_button"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Save Backup
                  </Button>
                )}
              </div>
            }
          >
            {/* Chart + hover side panel */}
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div className="flex-1 min-w-0 w-full">
                <TSICSensorChart
                  data={data}
                  startIndex={visibleRange.startIndex}
                  endIndex={visibleRange.endIndex}
                  onRangeChange={setRange}
                  yAxisMin={yAxisMin}
                  yAxisMax={yAxisMax}
                  sensorVisibility={sensorVisibility}
                  onToggleSensor={undefined}
                  onResetStates={handleResetStates}
                  sensorColorMap={sensorColorMap}
                  groups={groups}
                  sensorLabels={sensorLabels}
                  boldSensors={boldSensors}
                  dottedSensors={dottedSensors}
                  onHoverChange={handleHoverChange}
                />
              </div>
              {/* Side panel: hover data */}
              <div className="w-full md:w-44 md:flex-shrink-0 pt-2">
                <HoverSidePanel
                  groups={hoveredGroups}
                  timestamp={hoveredTimestamp}
                />
              </div>
            </div>
            <div className="mt-4">
              <TSICSensorLegend
                groups={groups}
                ungroupedSensors={ungroupedSensors}
                ungroupedVisible={ungroupedVisible}
                activeSensors={activeSensors}
                getSensorColor={(n) => sensorColorMap[n] ?? "#9ca3af"}
                sensorLabels={sensorLabels}
                boldSensors={boldSensors}
              />
            </div>
          </DashboardCard>
          {/* Backup Dialog */}
          <Dialog open={backupDialogOpen} onOpenChange={setBackupDialogOpen}>
            <DialogContent data-ocid="backup.dialog">
              <DialogHeader>
                <DialogTitle>Save Configuration Backup</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">
                  Save a backup of logger ID {selectedId} including sensor
                  groups, labels, and advanced chart config.
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="backup-label" className="text-sm font-medium">
                    Backup Label
                  </label>
                  <input
                    id="backup-label"
                    type="text"
                    value={backupLabel}
                    onChange={(e) => setBackupLabel(e.target.value)}
                    placeholder="e.g. Before filter change 15/03"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    data-ocid="backup.input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && backupLabel.trim())
                        handleSaveBackup();
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBackupDialogOpen(false);
                    setBackupLabel("");
                  }}
                  data-ocid="backup.cancel_button"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveBackup}
                  disabled={!backupLabel.trim() || isSavingBackup}
                  style={{ backgroundColor: "#808A54" }}
                  data-ocid="backup.submit_button"
                >
                  {isSavingBackup ? "Saving..." : "Save Backup"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Advanced Chart Toggle */}
          <div className="flex justify-center mt-2">
            <button
              type="button"
              data-ocid="tsic.advanced.toggle"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border/50 hover:border-border transition-colors bg-card"
            >
              <span>{showAdvanced ? "Hide Advanced" : "Advanced"}</span>
              <ChevronDown
                className={
                  showAdvanced
                    ? "w-3 h-3 rotate-180 transition-transform"
                    : "w-3 h-3 transition-transform"
                }
              />
            </button>
          </div>
          {showAdvanced && (
            <AdvancedChartSection
              data={data}
              startIndex={visibleRange.startIndex}
              endIndex={visibleRange.endIndex}
              onRangeChange={setRange}
              selectedId={selectedId}
              isAdmin={showAdminFeatures}
              sensorLabels={sensorLabels}
            />
          )}
        </>
      )}
    </main>
  );
}
