import {
  type HoveredGroup,
  TSICSensorChart,
} from "@/components/TSICSensorChart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActor } from "@/hooks/useActor";
import { useIsCallerAdmin } from "@/hooks/useIsCallerAdmin";
import { type SensorGroup, getGroupColor } from "@/hooks/useSensorGroups";
import { useSyncedTimeWindow } from "@/hooks/useSyncedTimeWindow";
import type { TSICDataPoint } from "@/lib/tsicDataParsing";
import { fetchTSICData } from "@/lib/tsicDataSource";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

interface BackupEntry {
  id: string;
  loggerId: number;
  label: string;
  timestampMs: number;
  sensorGroupsJson: string;
  advancedConfigJson: string;
  sensorLabelsJson: string;
}

interface SensorGroupsState {
  groups: SensorGroup[];
  sensorVisibilityOverrides: Record<string, boolean>;
  ungroupedVisible: boolean;
  boldSensors: number[];
  dottedSensors: number[];
  nameColors: Record<string, string>;
  nameVisibility: Record<string, boolean>;
}

interface AdvancedConfig {
  formulas?: Array<{ id: string; name: string; expression: string }>;
  bands?: Array<{ id: string; name: string; sensors: number[] }>;
  events?: Array<{ id: string; label: string; timestamp: number }>;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function BackupDetailView({
  backup,
  onBack,
}: {
  backup: BackupEntry;
  onBack: () => void;
}) {
  const [data, setData] = useState<TSICDataPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredGroups, setHoveredGroups] = useState<HoveredGroup[] | null>(
    null,
  );
  const [hoveredTimestamp, setHoveredTimestamp] = useState<string | null>(null);

  const { visibleRange, setRange } = useSyncedTimeWindow(data?.length ?? 0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTSICData(backup.loggerId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [backup.loggerId]);

  const groupsState: SensorGroupsState = (() => {
    try {
      return JSON.parse(backup.sensorGroupsJson);
    } catch {
      return {
        groups: [],
        sensorVisibilityOverrides: {},
        ungroupedVisible: true,
        boldSensors: [],
        dottedSensors: [],
        nameColors: {},
        nameVisibility: {},
      };
    }
  })();

  const sensorLabels: Map<number, string> = (() => {
    try {
      const arr = JSON.parse(backup.sensorLabelsJson) as [number, string][];
      return new Map(arr);
    } catch {
      return new Map();
    }
  })();

  const advancedConfig: AdvancedConfig = (() => {
    try {
      return JSON.parse(backup.advancedConfigJson);
    } catch {
      return {};
    }
  })();

  const sensorColorMap: Record<number, string> = {};
  for (const group of groupsState.groups) {
    const color = getGroupColor(group);
    for (const sNum of group.sensors) {
      sensorColorMap[sNum] = color;
    }
  }

  const sensorVisibility: Record<string, boolean> = {};
  for (let s = 1; s <= 72; s++) {
    sensorVisibility[`S${s}`] = true;
  }

  const boldSet = new Set<number>(groupsState.boldSensors ?? []);
  const dottedSet = new Set<number>(groupsState.dottedSensors ?? []);

  return (
    <div className="space-y-4" data-ocid="backup.detail.panel">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-2"
          data-ocid="backup.detail.close_button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Backups
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{backup.label}</h2>
          <p className="text-sm text-muted-foreground">
            Logger ID {backup.loggerId} · {formatDate(backup.timestampMs)}
          </p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Live data from logger ID {backup.loggerId} — configuration from backup
        </AlertDescription>
      </Alert>

      {loading && (
        <Card data-ocid="backup.detail.loading_state">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive" data-ocid="backup.detail.error_state">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && data && (
        <Card className="shadow-lg border-2">
          <CardHeader className="border-b p-6 bg-chart-header rounded-t-[calc(var(--radius)-2px)]">
            <CardTitle className="text-base">
              TSIC Logger {backup.loggerId} — Backup View
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div className="flex-1 min-w-0 w-full">
                <TSICSensorChart
                  data={data}
                  startIndex={visibleRange.startIndex}
                  endIndex={visibleRange.endIndex}
                  onRangeChange={setRange}
                  sensorVisibility={sensorVisibility}
                  sensorColorMap={sensorColorMap}
                  groups={groupsState.groups}
                  sensorLabels={sensorLabels}
                  boldSensors={boldSet}
                  dottedSensors={dottedSet}
                  onHoverChange={(groups, ts) => {
                    setHoveredGroups(groups);
                    setHoveredTimestamp(ts);
                  }}
                />
              </div>
              <div className="w-full md:w-44 md:flex-shrink-0 pt-2">
                {hoveredGroups && hoveredGroups.length > 0 && (
                  <div className="text-xs space-y-2">
                    {hoveredTimestamp && (
                      <p className="text-muted-foreground font-medium">
                        {hoveredTimestamp}
                      </p>
                    )}
                    {hoveredGroups.map((g) => (
                      <div key={g.groupName}>
                        <p
                          className="font-semibold"
                          style={{ color: g.groupColor }}
                        >
                          {g.groupName}
                        </p>
                        {g.sensors.map((s) => (
                          <p key={s.label} className="text-muted-foreground">
                            {s.label}: {s.value.toFixed(2)}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {advancedConfig.formulas?.length || advancedConfig.bands?.length ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Saved Advanced Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {advancedConfig.formulas && advancedConfig.formulas.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Formula Lines</p>
                <ul className="space-y-1">
                  {advancedConfig.formulas.map((f) => (
                    <li key={f.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {f.name}
                      </span>
                      :{" "}
                      <code className="bg-muted px-1 rounded">
                        {f.expression}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {advancedConfig.bands && advancedConfig.bands.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Sensor Bands</p>
                <ul className="space-y-1">
                  {advancedConfig.bands.map((b) => (
                    <li key={b.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {b.name}
                      </span>
                      : sensors {b.sensors.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function BackupPage() {
  const { actor } = useActor();
  const { isAdmin, isConfirmed } = useIsCallerAdmin();
  const [allBackups, setAllBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingBackup, setViewingBackup] = useState<BackupEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const isAdminConfirmed = isAdmin && isConfirmed;
  // Cast actor to any since getBackupsForId/saveBackupsForId may not be in generated types yet
  const actorAny = actor as any;

  useEffect(() => {
    if (!actorAny || !isAdminConfirmed) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(
      Array.from({ length: 10 }, (_, i) => i + 1).map((id) =>
        actorAny
          .getBackupsForId(BigInt(id))
          .then((json: string) => {
            try {
              return JSON.parse(json) as BackupEntry[];
            } catch {
              return [] as BackupEntry[];
            }
          })
          .catch(() => [] as BackupEntry[]),
      ),
    )
      .then((results: BackupEntry[][]) => {
        if (!cancelled) {
          const flat = results
            .flat()
            .sort((a, b) => b.timestampMs - a.timestampMs);
          setAllBackups(flat);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load backups");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [actorAny, isAdminConfirmed]);

  const handleDelete = async (backup: BackupEntry) => {
    if (!actorAny) return;
    setDeletingId(backup.id);
    try {
      const existingJson = await actorAny.getBackupsForId(
        BigInt(backup.loggerId),
      );
      const existing = JSON.parse(existingJson) as BackupEntry[];
      const updated = existing.filter((b) => b.id !== backup.id);
      await actorAny.saveBackupsForId(
        BigInt(backup.loggerId),
        JSON.stringify(updated),
      );
      setAllBackups((prev) => prev.filter((b) => b.id !== backup.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  if (!isAdminConfirmed) {
    return (
      <main className="container mx-auto px-6 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Admin access required to view backups.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  if (viewingBackup) {
    return (
      <main className="container mx-auto px-6 py-8">
        <BackupDetailView
          backup={viewingBackup}
          onBack={() => setViewingBackup(null)}
        />
      </main>
    );
  }

  const byId: Record<number, BackupEntry[]> = {};
  for (const b of allBackups) {
    if (!byId[b.loggerId]) byId[b.loggerId] = [];
    byId[b.loggerId].push(b);
  }
  const sortedIds = Object.keys(byId)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <main className="container mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Archive className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Backups</h1>
          <p className="text-sm text-muted-foreground">
            Configuration backups per logger ID — admin only
          </p>
        </div>
      </div>

      {loading && (
        <div className="space-y-4" data-ocid="backup.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive" data-ocid="backup.error_state">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && allBackups.length === 0 && (
        <Card data-ocid="backup.empty_state">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <Archive className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-lg font-medium text-muted-foreground">
                No backups yet
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Save a backup from the TSIC Loggers page to see it here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading &&
        sortedIds.map((id) => {
          const entries = byId[id];
          const isExpanded = expandedIds.has(String(id));
          return (
            <Card key={id} className="shadow-sm border">
              <button
                type="button"
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors focus-visible:outline-none"
                onClick={() =>
                  setExpandedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(String(id))) next.delete(String(id));
                    else next.add(String(id));
                    return next;
                  })
                }
                data-ocid="backup.panel"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    style={{ backgroundColor: "#808A54", color: "white" }}
                    className="font-mono"
                  >
                    ID {id}
                  </Badge>
                  <span className="text-sm font-semibold">
                    {entries.length} backup{entries.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t">
                  {entries.map((backup, idx) => (
                    <div
                      key={backup.id}
                      className="flex items-center justify-between px-5 py-3 border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                      data-ocid={`backup.item.${idx + 1}`}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-medium truncate">
                          {backup.label}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(backup.timestampMs)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingBackup(backup)}
                          className="h-7 text-xs"
                          data-ocid="backup.secondary_button"
                        >
                          View
                        </Button>
                        {confirmDeleteId === backup.id ? (
                          <>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(backup)}
                              disabled={deletingId === backup.id}
                              className="h-7 text-xs"
                              data-ocid="backup.confirm_button"
                            >
                              {deletingId === backup.id
                                ? "Deleting..."
                                : "Confirm"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-7 text-xs"
                              data-ocid="backup.cancel_button"
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteId(backup.id)}
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            data-ocid="backup.delete_button"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
    </main>
  );
}
