import { DashboardCard } from "@/components/DashboardCard";
import { SensorGroupManager } from "@/components/SensorGroupManager";
import { TSICSensorChart } from "@/components/TSICSensorChart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsCallerAdmin } from "@/hooks/useIsCallerAdmin";
import type { SensorGroup } from "@/hooks/useSensorGroups";
import { useSensorGroups } from "@/hooks/useSensorGroups";
import {
  useResetSensorLabels,
  useSensorLabels,
  useSetSensorLabel,
} from "@/hooks/useSensorLabels";
import { useSyncedTimeWindow } from "@/hooks/useSyncedTimeWindow";
import { useTSICData } from "@/hooks/useTSICData";
import { useSetLoggerLabel, useTSICLabels } from "@/hooks/useTSICLabels";
import { format } from "date-fns";
import {
  AlertCircle,
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

interface TSICSensorLegendProps {
  groups: SensorGroup[];
  ungroupedSensors: number[];
  ungroupedVisible: boolean;
  activeSensors: number[];
  getSensorColor: (n: number) => string;
  sensorLabels?: Map<number, string>;
}

/**
 * Purely informative legend rendered below the TSIC chart.
 * Shows each group with its sensors; no click handlers.
 * Uses user-defined sensor labels if available, falls back to "S{n}".
 */
function TSICSensorLegend({
  groups,
  ungroupedSensors,
  ungroupedVisible,
  activeSensors,
  getSensorColor,
  sensorLabels,
}: TSICSensorLegendProps) {
  const activeSet = new Set(activeSensors);

  // Groups that have at least one active sensor
  const visibleGroups = groups.filter((g) =>
    g.sensors.some((s) => activeSet.has(s)),
  );

  // Ungrouped sensors that are active
  const activeUngrouped = ungroupedSensors.filter((s) => activeSet.has(s));

  if (visibleGroups.length === 0 && activeUngrouped.length === 0) return null;

  const getDisplayLabel = (sensorNum: number) => {
    const custom = sensorLabels?.get(sensorNum);
    return custom && custom.trim() !== "" ? custom : `S${sensorNum}`;
  };

  return (
    <div
      className="border-t border-border pt-4 pb-6 px-1"
      style={{ fontFamily: "Avenir, 'Avenir Next', Nunito, sans-serif" }}
    >
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Legend
      </p>
      <div className="flex flex-col gap-4">
        {visibleGroups.map((group) => {
          const groupColor = `hsl(${group.hue}, 70%, 50%)`;
          const groupSensors = group.sensors.filter((s) => activeSet.has(s));
          return (
            <div key={group.id} className="flex flex-wrap items-center gap-2">
              {/* Group label with colored dot */}
              <div className="flex items-center gap-1.5 min-w-[90px] shrink-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: groupColor }}
                />
                <span className="text-xs font-semibold text-foreground truncate max-w-[130px]">
                  {group.name}
                </span>
              </div>
              {/* Sensor chips */}
              <div className="flex flex-wrap gap-1.5">
                {groupSensors.map((sensorNum) => {
                  const sensorColor = getSensorColor(sensorNum);
                  const displayLabel = getDisplayLabel(sensorNum);
                  const originalLabel = `S${sensorNum}`;
                  return (
                    <span
                      key={sensorNum}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-border bg-muted/50"
                      title={originalLabel}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: sensorColor }}
                      />
                      <span className="text-foreground font-medium">
                        {displayLabel}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Ungrouped sensors */}
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
                const originalLabel = `S${sensorNum}`;
                return (
                  <span
                    key={sensorNum}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-border bg-muted/50"
                    title={originalLabel}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: sensorColor }}
                    />
                    <span className="text-foreground font-medium">
                      {displayLabel}
                    </span>
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

/**
 * Admin-only inline label editor for a single logger ID button.
 * Renders nothing for non-admins.
 */
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

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(currentLabel);
    setIsEditing(true);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave(id, draft);
    setIsEditing(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(currentLabel);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSave(id, draft);
      setIsEditing(false);
    } else if (e.key === "Escape") {
      setDraft(currentLabel);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: presentational wrapper stops event propagation only
      <div
        className="flex items-center gap-1 mt-1.5 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Label..."
          className="h-6 text-xs px-1.5 py-0 flex-1 min-w-0"
          autoFocus
          maxLength={30}
          disabled={isSaving}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="text-primary hover:text-primary/80 disabled:opacity-50 flex-shrink-0"
          title="Save"
        >
          {isSaving ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50 flex-shrink-0"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: presentational wrapper stops event propagation only
    <div
      className="flex items-center justify-center gap-1 mt-1.5 w-full group/label"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-xs text-muted-foreground truncate max-w-[80px]">
        {currentLabel || <span className="italic opacity-50">label...</span>}
      </span>
      <button
        type="button"
        onClick={handleEdit}
        className="opacity-0 group-hover/label:opacity-100 transition-opacity text-muted-foreground hover:text-foreground flex-shrink-0"
        title="Edit label"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

export function TSICLoggersPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useTSICData(selectedId);
  const { visibleRange, setRange, resetZoom, isZoomed } = useSyncedTimeWindow(
    data?.length || 0,
  );

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Y-axis controls (reset to null for automatic scaling on page refresh)
  const [yAxisMin, setYAxisMin] = useState<number | null>(null);
  const [yAxisMax, setYAxisMax] = useState<number | null>(null);

  // Collapsible state for Sensor Groups — collapsed by default
  const [sensorGroupsOpen, setSensorGroupsOpen] = useState(false);

  // Track data length to detect when new data is loaded
  const prevDataLengthRef = useRef<number>(0);

  // Admin status and labels — only fetched when admin
  const { isAdmin, isConfirmed } = useIsCallerAdmin();
  const { data: labelsMap } = useTSICLabels();
  const { mutate: saveLabel, isPending: isSavingLabel } = useSetLoggerLabel();

  // Sensor labels (admin only)
  const { data: sensorLabels } = useSensorLabels();
  const { mutate: saveSensorLabel, isPending: isSavingSensorLabel } =
    useSetSensorLabel();
  const { mutate: resetSensorLabels } = useResetSensorLabels();

  // Sensor grouping (persistent, ICP backend)
  const {
    groups,
    ungroupedSensors,
    ungroupedVisible,
    sensorVisibilityOverrides,
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
    getSensorColor,
    isSensorVisible,
    isLoading: isGroupsLoading,
  } = useSensorGroups(isAdmin, selectedId);

  // Track which ID is currently being saved
  const [savingId, setSavingId] = useState<number | null>(null);

  const handleSaveLabel = useCallback(
    (id: number, label: string) => {
      setSavingId(id);
      saveLabel(
        { id, label },
        {
          onSettled: () => setSavingId(null),
        },
      );
    },
    [saveLabel],
  );

  const handleSaveSensorLabel = useCallback(
    (sensorNum: number, label: string) => {
      saveSensorLabel({ sensorNum, label });
    },
    [saveSensorLabel],
  );

  // Reset groups and sensor labels together
  const handleReset = useCallback(() => {
    resetGroups();
    resetSensorLabels();
  }, [resetGroups, resetSensorLabels]);

  // Reset states when new data is loaded
  const handleResetStates = useCallback(() => {
    const currentDataLength = data?.length || 0;

    // Only reset if data length changed (new data loaded)
    if (
      currentDataLength > 0 &&
      currentDataLength !== prevDataLengthRef.current
    ) {
      prevDataLengthRef.current = currentDataLength;

      // Reset Y-axis controls
      setYAxisMin(null);
      setYAxisMax(null);
    }
  }, [data?.length]);

  // Calculate date range indices
  const dateRangeIndices = useMemo(() => {
    if (!data || !startDate || !endDate) return null;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      return null;
    if (start > end) return null;

    // Set end date to end of day for inclusive range
    end.setHours(23, 59, 59, 999);

    // Find indices
    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < data.length; i++) {
      const pointTime = data[i].timestamp.getTime();
      if (startIndex === -1 && pointTime >= start.getTime()) {
        startIndex = i;
      }
      if (pointTime <= end.getTime()) {
        endIndex = i;
      }
    }

    // Check if we found any data in range
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      return { startIndex: -1, endIndex: -1, isEmpty: true };
    }

    return { startIndex, endIndex, isEmpty: false };
  }, [data, startDate, endDate]);

  // Apply date range zoom when indices change
  useMemo(() => {
    if (dateRangeIndices && !dateRangeIndices.isEmpty) {
      setRange(dateRangeIndices.startIndex, dateRangeIndices.endIndex);
    }
  }, [dateRangeIndices, setRange]);

  const handleResetZoom = () => {
    resetZoom();
    setStartDate("");
    setEndDate("");
  };

  const handleIdClick = (id: number) => {
    setSelectedId(id);
    // Reset zoom and date filters when switching IDs
    resetZoom();
    setStartDate("");
    setEndDate("");
    // Reset Y-axis controls
    setYAxisMin(null);
    setYAxisMax(null);
    // Reset data length tracker
    prevDataLengthRef.current = 0;
  };

  const refreshingIndicator = isRefetching ? (
    <span className="text-sm font-normal text-muted-foreground flex items-center gap-2">
      <RefreshCw className="h-3 w-3 animate-spin" />
      Refreshing...
    </span>
  ) : null;

  // Get min and max dates from data for input constraints
  const dateConstraints = useMemo(() => {
    if (!data || data.length === 0) return null;
    const minDate = format(data[0].timestamp, "yyyy-MM-dd");
    const maxDate = format(data[data.length - 1].timestamp, "yyyy-MM-dd");
    return { minDate, maxDate };
  }, [data]);

  // Derive which sensors actually have data (from the chart's perspective)
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

  // Build sensorColorMap for the chart
  const sensorColorMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (let s = 1; s <= 72; s++) {
      map[s] = getSensorColor(s);
    }
    return map;
  }, [getSensorColor]);

  // Build sensorVisibility for the chart: merge group-level and individual overrides
  const sensorVisibility = useMemo(() => {
    const visibility: Record<string, boolean> = {};
    for (let s = 1; s <= 72; s++) {
      visibility[`S${s}`] = isSensorVisible(s);
    }
    return visibility;
  }, [isSensorVisible]);

  // Only show labels and group manager section when admin status is confirmed and user is admin
  const showAdminFeatures = isConfirmed && isAdmin;

  return (
    <main className="container mx-auto px-6 py-8 space-y-6">
      {/* ── ID Selector — horizontal scrollable pill bar ── */}
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
                  {/* Admin-only label editor — rendered below pill, never shown to non-admins */}
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

      {/* Loading State */}
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

      {/* Error State */}
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

      {/* No ID Selected */}
      {selectedId === null && (
        <Card className="shadow-lg" data-ocid="tsic.empty_state">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center text-muted-foreground">
              <p className="text-lg">
                Please select a logger ID to view sensor data
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data Available */}
      {data && data.length === 0 && !isLoading && selectedId !== null && (
        <Alert className="shadow-lg" data-ocid="tsic.empty_state">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            No valid data points to display for ID {selectedId}. Please check
            the data source.
          </AlertDescription>
        </Alert>
      )}

      {/* Data Display */}
      {data && data.length > 0 && selectedId !== null && (
        <>
          {/* ── Combined Chart Controls card ── */}
          <Card className="shadow-sm" data-ocid="tsic.controls.card">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Chart Controls
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Left column — Date Range */}
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
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        min={dateConstraints?.minDate}
                        max={dateConstraints?.maxDate}
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
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={dateConstraints?.minDate}
                        max={dateConstraints?.maxDate}
                        className="w-full h-8 text-sm"
                        data-ocid="tsic.controls.input"
                      />
                    </div>
                  </div>
                  {(isZoomed || startDate || endDate) && (
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
                        No data points between selected dates. Choose a
                        different range.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Right column — Y-Axis */}
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
            </CardContent>
          </Card>

          {/* ── Sensor Groups — collapsible, admin only ── */}
          {showAdminFeatures && !isGroupsLoading && (
            <Collapsible
              open={sensorGroupsOpen}
              onOpenChange={setSensorGroupsOpen}
            >
              {/* Collapsible header row */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    data-ocid="tsic.sensor_groups.toggle"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      Sensor Groups
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
                      onReset={handleReset}
                      onChangeGroupColor={changeGroupColor}
                      sensorLabels={sensorLabels}
                      onSaveSensorLabel={handleSaveSensorLabel}
                      isSavingSensorLabel={isSavingSensorLabel}
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Chart + Legend in one card */}
          <DashboardCard
            title={`TSIC Logger ${selectedId} - All sensor readings over time`}
            headerAction={refreshingIndicator}
          >
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
            />
            {/* Informative legend — inline below chart, same card */}
            <div className="mt-4">
              <TSICSensorLegend
                groups={groups}
                ungroupedSensors={ungroupedSensors}
                ungroupedVisible={ungroupedVisible}
                activeSensors={activeSensors}
                getSensorColor={getSensorColor}
                sensorLabels={sensorLabels}
              />
            </div>
          </DashboardCard>
        </>
      )}
    </main>
  );
}
