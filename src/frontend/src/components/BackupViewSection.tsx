import { AdvancedChartSection } from "@/components/AdvancedChartSection";
import { DashboardCard } from "@/components/DashboardCard";
import {
  type HoveredGroup,
  TSICSensorChart,
} from "@/components/TSICSensorChart";
import { Button } from "@/components/ui/button";
import { useActor } from "@/hooks/useActor";
import { type SensorGroup, getGroupColor } from "@/hooks/useSensorGroups";
import { useSyncedTimeWindow } from "@/hooks/useSyncedTimeWindow";
import type { TSICDataPoint } from "@/lib/tsicDataParsing";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Eye, EyeOff, Save, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { BackupEntry } from "../backend.d";

// ─── Serialize / Deserialize ─────────────────────────────────────────────────

export function serializeTSICData(data: TSICDataPoint[]): string {
  const compact = data.map((pt) => ({
    t: pt.timestamp.getTime(),
    s: Array.from({ length: 72 }, (_, i) => {
      const key = `S${i + 1}` as keyof typeof pt.sensors;
      return pt.sensors[key] ?? 0;
    }),
  }));
  return JSON.stringify(compact);
}

export function deserializeTSICData(json: string): TSICDataPoint[] {
  try {
    const compact: { t: number; s: number[] }[] = JSON.parse(json);
    return compact.map((pt) => {
      const sensors: any = {};
      for (let i = 0; i < 72; i++) {
        sensors[`S${i + 1}`] = pt.s[i] ?? 0;
      }
      return { timestamp: new Date(pt.t), sensors };
    });
  } catch {
    return [];
  }
}

// ─── Parse backup state ───────────────────────────────────────────────────────

interface ParsedBackupState {
  groups: SensorGroup[];
  boldSensors: Set<number>;
  dottedSensors: Set<number>;
  ungroupedVisible: boolean;
  sensorVisibilityOverrides: Record<number, boolean>;
  nameColors: Record<string, string>;
  nameVisibility: Record<string, boolean>;
}

function parseBackupGroups(json: string): ParsedBackupState {
  try {
    const parsed = JSON.parse(json);
    return {
      groups: parsed.groups ?? [],
      boldSensors: new Set(parsed.boldSensors ?? []),
      dottedSensors: new Set(parsed.dottedSensors ?? []),
      ungroupedVisible: parsed.ungroupedVisible ?? true,
      sensorVisibilityOverrides: parsed.sensorVisibilityOverrides ?? {},
      nameColors: parsed.nameColors ?? {},
      nameVisibility: parsed.nameVisibility ?? {},
    };
  } catch {
    return {
      groups: [],
      boldSensors: new Set(),
      dottedSensors: new Set(),
      ungroupedVisible: true,
      sensorVisibilityOverrides: {},
      nameColors: {},
      nameVisibility: {},
    };
  }
}

function parseBackupLabels(json: string): Map<number, string> {
  try {
    const entries: [number, string][] = JSON.parse(json);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

// ─── HoverSidePanel (local copy) ─────────────────────────────────────────────

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

// ─── TSICSensorLegend (local copy) ────────────────────────────────────────────

function TSICSensorLegend({
  groups,
  ungroupedSensors,
  ungroupedVisible,
  activeSensors,
  getSensorColor,
  sensorLabels,
  boldSensors,
}: {
  groups: SensorGroup[];
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

// ─── GroupColorDot ────────────────────────────────────────────────────────────

function GroupColorDot({
  color,
  onChange,
}: { color: string; onChange: (c: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className="relative flex-shrink-0">
      <span
        role="button"
        tabIndex={0}
        title="Change group color"
        className="inline-block w-3 h-3 rounded-full ring-1 ring-inset ring-black/10 cursor-pointer"
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
    </span>
  );
}

// ─── BackupGroupPanel ─────────────────────────────────────────────────────────

function BackupGroupPanel({
  groups,
  setGroups,
  boldSensors,
  setBoldSensors,
  dottedSensors,
  setDottedSensors,
  ungroupedVisible,
  setUngroupedVisible,
  sensorVisibilityOverrides,
  setSensorVisibilityOverrides,
  sensorLabels,
}: {
  groups: SensorGroup[];
  setGroups: (g: SensorGroup[]) => void;
  boldSensors: Set<number>;
  setBoldSensors: (s: Set<number>) => void;
  dottedSensors: Set<number>;
  setDottedSensors: (s: Set<number>) => void;
  ungroupedVisible: boolean;
  setUngroupedVisible: (v: boolean) => void;
  sensorVisibilityOverrides: Record<number, boolean>;
  setSensorVisibilityOverrides: (r: Record<number, boolean>) => void;
  sensorLabels: Map<number, string>;
}) {
  const [open, setOpen] = useState(false);

  const getDisplayLabel = (sensorNum: number) => {
    const custom = sensorLabels.get(sensorNum);
    return custom && custom.trim() !== "" ? custom : `S${sensorNum}`;
  };

  const handleGroupColorChange = (groupId: string, color: string) => {
    setGroups(groups.map((g) => (g.id === groupId ? { ...g, color } : g)));
  };

  const handleToggleGroupVisible = (groupId: string) => {
    setGroups(
      groups.map((g) =>
        g.id === groupId ? { ...g, visible: !(g.visible !== false) } : g,
      ),
    );
  };

  const handleToggleSensorVisible = (sensorNum: number) => {
    const current = sensorVisibilityOverrides[sensorNum];
    // default is visible (true), so toggle off means set to false
    const next = current === false;
    setSensorVisibilityOverrides({
      ...sensorVisibilityOverrides,
      [sensorNum]: next,
    });
  };

  const handleToggleBold = (sensorNum: number) => {
    const next = new Set(boldSensors);
    if (next.has(sensorNum)) next.delete(sensorNum);
    else next.add(sensorNum);
    setBoldSensors(next);
  };

  const handleToggleDotted = (sensorNum: number) => {
    const next = new Set(dottedSensors);
    if (next.has(sensorNum)) next.delete(sensorNum);
    else next.add(sensorNum);
    setDottedSensors(next);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={() => setOpen((v) => !v)}
        data-ocid="backup.groups.toggle"
      >
        <span className="text-sm font-semibold text-foreground">Groups</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-4">
          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
            Backups are read-only — group names and sensor assignments cannot be
            changed. Save as new backup to change current changes of the
            advanced graph.
          </div>
          {groups.map((group) => {
            const groupColor = getGroupColor(group);
            const groupVisible = group.visible !== false;
            return (
              <div key={group.id}>
                {/* Group header row */}
                <div className="flex items-center gap-2 mb-1.5">
                  <GroupColorDot
                    color={groupColor}
                    onChange={(c) => handleGroupColorChange(group.id, c)}
                  />
                  <span className="text-xs font-semibold text-foreground flex-1 truncate">
                    {group.name}
                  </span>
                  <button
                    type="button"
                    title={groupVisible ? "Hide group" : "Show group"}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => handleToggleGroupVisible(group.id)}
                    data-ocid="backup.groups.toggle"
                  >
                    {groupVisible ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                {/* Sensor chips */}
                <div className="flex flex-wrap gap-1.5 pl-5">
                  {group.sensors.map((sensorNum) => {
                    const label = getDisplayLabel(sensorNum);
                    const override = sensorVisibilityOverrides[sensorNum];
                    const sensorVisible = override !== false;
                    const isBold = boldSensors.has(sensorNum);
                    const isDotted = dottedSensors.has(sensorNum);
                    return (
                      <div
                        key={sensorNum}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-border bg-muted/40"
                      >
                        <span
                          className={`font-medium ${isBold ? "font-bold" : ""}`}
                          title={`S${sensorNum}`}
                        >
                          {label}
                        </span>
                        <button
                          type="button"
                          title={sensorVisible ? "Hide sensor" : "Show sensor"}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => handleToggleSensorVisible(sensorNum)}
                          data-ocid="backup.groups.toggle"
                        >
                          {sensorVisible ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          title="Toggle bold"
                          className={`text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded transition-colors ${
                            isBold
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => handleToggleBold(sensorNum)}
                          data-ocid="backup.groups.toggle"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          title="Toggle dotted"
                          className={`text-[10px] font-medium w-4 h-4 flex items-center justify-center rounded transition-colors ${
                            isDotted
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => handleToggleDotted(sensorNum)}
                          data-ocid="backup.groups.toggle"
                        >
                          D
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Ungrouped row */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
            <span className="inline-block w-3 h-3 rounded-full bg-[#9ca3af] flex-shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground flex-1">
              Ungrouped
            </span>
            <button
              type="button"
              title={ungroupedVisible ? "Hide ungrouped" : "Show ungrouped"}
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setUngroupedVisible(!ungroupedVisible)}
              data-ocid="backup.groups.toggle"
            >
              {ungroupedVisible ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BackupViewSection ────────────────────────────────────────────────────────

interface BackupViewSectionProps {
  backup: BackupEntry;
  onClose: () => void;
  isAdmin: boolean;
}

export function BackupViewSection({
  backup,
  onClose,
  isAdmin,
}: BackupViewSectionProps) {
  const data = useMemo(
    () => deserializeTSICData(backup.sensorDataJson),
    [backup.sensorDataJson],
  );

  const initialBackupState = useMemo(
    () => parseBackupGroups(backup.sensorGroupsJson),
    [backup.sensorGroupsJson],
  );

  const sensorLabels = useMemo(
    () => parseBackupLabels(backup.sensorLabelsJson),
    [backup.sensorLabelsJson],
  );

  const { visibleRange, setRange } = useSyncedTimeWindow(data.length);

  const [yAxisMin, setYAxisMin] = useState<number | null>(null);
  const [yAxisMax, setYAxisMax] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localAdvancedConfig, setLocalAdvancedConfig] = useState<string>(
    backup.advancedConfigJson ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const { actor } = useActor();
  const queryClient = useQueryClient();

  const [hoveredGroups, setHoveredGroups] = useState<HoveredGroup[] | null>(
    null,
  );
  const [hoveredTimestamp, setHoveredTimestamp] = useState<string | null>(null);

  // ── Mutable local state for group management ──
  const [groups, setGroups] = useState<SensorGroup[]>(
    () => initialBackupState.groups,
  );
  const [boldSensors, setBoldSensors] = useState<Set<number>>(
    () => initialBackupState.boldSensors,
  );
  const [dottedSensors, setDottedSensors] = useState<Set<number>>(
    () => initialBackupState.dottedSensors,
  );
  const [ungroupedVisible, setUngroupedVisible] = useState<boolean>(
    initialBackupState.ungroupedVisible,
  );
  const [sensorVisibilityOverrides, setSensorVisibilityOverrides] = useState<
    Record<number, boolean>
  >(() => initialBackupState.sensorVisibilityOverrides);

  const handleHoverChange = useCallback(
    (grps: HoveredGroup[] | null, timestamp: string | null) => {
      setHoveredGroups(grps);
      setHoveredTimestamp(timestamp);
    },
    [],
  );

  const groupedSensorSet = useMemo(
    () => new Set(groups.flatMap((g) => g.sensors)),
    [groups],
  );

  const ungroupedSensors = useMemo(() => {
    const all: number[] = [];
    for (let s = 1; s <= 72; s++) {
      if (!groupedSensorSet.has(s)) all.push(s);
    }
    return all;
  }, [groupedSensorSet]);

  // Ungrouped sensors → grey (#9ca3af); grouped sensors → group color
  const getSensorColor = useCallback(
    (sensorNum: number): string => {
      const group = groups.find((g) => g.sensors.includes(sensorNum));
      if (group) return getGroupColor(group);
      return "#9ca3af";
    },
    [groups],
  );

  const sensorColorMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (let s = 1; s <= 72; s++) map[s] = getSensorColor(s);
    return map;
  }, [getSensorColor]);

  const sensorVisibility = useMemo(() => {
    const vis: Record<string, boolean> = {};
    for (let s = 1; s <= 72; s++) {
      const override = sensorVisibilityOverrides[s];
      const group = groups.find((g) => g.sensors.includes(s));
      let visible = override !== undefined ? override : true;
      if (group && group.visible === false) visible = false;
      if (!ungroupedVisible && !groupedSensorSet.has(s)) visible = false;
      vis[`S${s}`] = visible;
    }
    return vis;
  }, [sensorVisibilityOverrides, groups, ungroupedVisible, groupedSensorSet]);

  const activeSensors = useMemo(() => {
    if (!data || data.length === 0) return [];
    const active: number[] = [];
    for (let s = 1; s <= 72; s++) {
      const key = `S${s}` as keyof (typeof data)[0]["sensors"];
      const hasData = data.some((pt) => {
        const val = pt.sensors[key];
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

  const handleSaveAsNewBackup = useCallback(async () => {
    if (!actor) return;
    const label =
      saveLabel.trim() ||
      `Copy of ${backup.backupLabel || `ID ${backup.loggerId} Backup`}`;
    setIsSaving(true);
    try {
      await (actor as any).saveBackup(
        BigInt(backup.loggerId),
        label,
        backup.sensorDataJson,
        backup.sensorGroupsJson,
        backup.sensorLabelsJson,
        localAdvancedConfig,
      );
      toast.success("Saved as new backup");
      await queryClient.invalidateQueries({ queryKey: ["allBackups"] });
      setShowSaveDialog(false);
      setSaveLabel("");
    } catch (_e) {
      toast.error("Failed to save backup");
    } finally {
      setIsSaving(false);
    }
  }, [actor, backup, localAdvancedConfig, saveLabel, queryClient]);

  const loggerId = Number(backup.loggerId);
  const backupDate = new Date(Number(backup.timestampMs));
  const dateStr = backupDate.toLocaleDateString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: "#808A54" }}
          >
            {loggerId}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {backup.backupLabel || `ID ${loggerId} Backup`}
            </p>
            <p className="text-xs text-muted-foreground">{dateStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && !showSaveDialog && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaveDialog(true)}
              className="gap-1.5 text-xs"
              data-ocid="backup.save_as_new"
            >
              <Save className="h-3.5 w-3.5" />
              Save as new backup
            </Button>
          )}
          {isAdmin && showSaveDialog && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Backup label (optional)"
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                className="h-7 text-xs px-2 rounded-md border border-border bg-background w-44"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveAsNewBackup();
                  if (e.key === "Escape") setShowSaveDialog(false);
                }}
              />
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSaveAsNewBackup}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-1.5 text-xs"
            data-ocid="backup.close_button"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </Button>
        </div>
      </div>

      {/* Groups panel */}
      {isAdmin && (
        <BackupGroupPanel
          groups={groups}
          setGroups={setGroups}
          boldSensors={boldSensors}
          setBoldSensors={setBoldSensors}
          dottedSensors={dottedSensors}
          setDottedSensors={setDottedSensors}
          ungroupedVisible={ungroupedVisible}
          setUngroupedVisible={setUngroupedVisible}
          sensorVisibilityOverrides={sensorVisibilityOverrides}
          setSensorVisibilityOverrides={setSensorVisibilityOverrides}
          sensorLabels={sensorLabels}
        />
      )}

      {/* Chart + side panel */}
      <DashboardCard
        title={`Backup: ID ${loggerId} — ${backup.backupLabel || dateStr}`}
      >
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
              onResetStates={() => {}}
              sensorColorMap={sensorColorMap}
              groups={groups}
              sensorLabels={sensorLabels}
              boldSensors={boldSensors}
              dottedSensors={dottedSensors}
              onHoverChange={handleHoverChange}
            />
          </div>
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

      {/* Y-axis controls */}
      <div className="flex flex-wrap gap-3 items-end px-1">
        <div className="flex items-center gap-2">
          <label htmlFor="bkp-ymin" className="text-xs text-muted-foreground">
            Y min
          </label>
          <input
            id="bkp-ymin"
            type="number"
            placeholder="Auto"
            value={yAxisMin ?? ""}
            onChange={(e) =>
              setYAxisMin(e.target.value ? Number(e.target.value) : null)
            }
            className="w-20 h-7 text-xs px-2 rounded-md border border-border bg-background"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="bkp-ymax" className="text-xs text-muted-foreground">
            Y max
          </label>
          <input
            id="bkp-ymax"
            type="number"
            placeholder="Auto"
            value={yAxisMax ?? ""}
            onChange={(e) =>
              setYAxisMax(e.target.value ? Number(e.target.value) : null)
            }
            className="w-20 h-7 text-xs px-2 rounded-md border border-border bg-background"
          />
        </div>
        {(yAxisMin !== null || yAxisMax !== null) && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setYAxisMin(null);
              setYAxisMax(null);
            }}
          >
            Reset Y
          </Button>
        )}
      </div>

      {/* Advanced toggle */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border/50 hover:border-border transition-colors bg-card"
          data-ocid="backup.advanced.toggle"
        >
          <span>
            {showAdvanced ? "Hide Advanced" : "Advanced (from backup)"}
          </span>
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
          selectedId={loggerId}
          isAdmin={isAdmin}
          sensorLabels={sensorLabels}
          initialConfigJson={backup.advancedConfigJson}
          localOnly={true}
          onConfigChange={setLocalAdvancedConfig}
        />
      )}
    </div>
  );
}
