import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { SensorGroup } from "@/hooks/useSensorGroups";
import {
  Bold,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

interface SensorGroupManagerProps {
  activeSensors: number[];
  groups: SensorGroup[];
  ungroupedSensors: number[];
  ungroupedVisible: boolean;
  sensorVisibilityOverrides: Record<number, boolean>;
  boldSensors?: Set<number>;
  getSensorColor: (n: number) => string;
  isSensorVisible: (n: number) => boolean;
  onCreateGroup: (name: string) => void;
  onDeleteGroup: (id: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onAddSensorToGroup: (groupId: string, sensorNum: number) => void;
  onRemoveSensorFromGroup: (groupId: string, sensorNum: number) => void;
  onToggleGroupVisible: (id: string) => void;
  onToggleSensorVisible: (sensorNum: number) => void;
  onToggleUngroupedVisible: () => void;
  onToggleSensorBold?: (sensorNum: number) => void;
  onReset: () => void;
  onChangeGroupColor: (id: string, hue: number) => void;
  onReorderGroups: (fromIndex: number, toIndex: number) => void;
  // Sensor label props (admin only)
  sensorLabels?: Map<number, string>;
  onSaveSensorLabel?: (sensorNum: number, label: string) => void;
  isSavingSensorLabel?: boolean;
}

// ─── Sensor chip ─────────────────────────────────────────────────────────────

interface SensorChipProps {
  sensorNum: number;
  color: string;
  isVisible: boolean;
  isBold?: boolean;
  onToggleVisible: () => void;
  onToggleBold?: () => void;
  chipIndex: number;
  label?: string;
  isAdmin?: boolean;
  onSaveLabel?: (sensorNum: number, label: string) => void;
  isSavingLabel?: boolean;
}

function SensorChip({
  sensorNum,
  color,
  isVisible,
  isBold,
  onToggleVisible,
  onToggleBold,
  chipIndex,
  label,
  isAdmin,
  onSaveLabel,
  isSavingLabel,
}: SensorChipProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(label ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const originalLabel = `S${sensorNum}`;
  const displayLabel = label && label.trim() !== "" ? label : originalLabel;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("text/plain", String(sensorNum));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!isAdmin || !onSaveLabel) return;
    e.stopPropagation();
    e.preventDefault();
    setDraft(label ?? "");
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = () => {
    if (onSaveLabel) onSaveLabel(sensorNum, draft.trim());
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(label ?? "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") handleSave();
    else if (e.key === "Escape") handleCancel();
  };

  if (isEditing) {
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation only
      <div
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border border-primary bg-primary/10"
        style={{ minWidth: 80 }}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={originalLabel}
          className="h-4 text-xs px-1 py-0 border-0 bg-transparent focus-visible:ring-0 w-16 min-w-0"
          maxLength={20}
          disabled={isSavingLabel}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
          disabled={isSavingLabel}
          className="text-primary hover:text-primary/80 disabled:opacity-50 flex-shrink-0"
          title="Save"
        >
          <Check className="w-2.5 h-2.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCancel();
          }}
          disabled={isSavingLabel}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50 flex-shrink-0"
          title="Cancel"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDoubleClick={handleDoubleClick}
      data-ocid={`tsic.sensor.drag_handle.${chipIndex}`}
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
        "cursor-grab active:cursor-grabbing select-none",
        "border transition-all duration-150",
        isVisible ? "opacity-100" : "opacity-40",
        isBold ? "font-bold" : "font-mono",
        "hover:shadow-sm hover:scale-105",
      ].join(" ")}
      style={{
        backgroundColor: `${color}22`,
        borderColor: color,
        color: "inherit",
      }}
      title={originalLabel}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span>{displayLabel}</span>
      {/* Visibility toggle */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible();
        }}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title={isVisible ? "Hide" : "Show"}
      >
        {isVisible ? (
          <Eye className="w-2.5 h-2.5" />
        ) : (
          <EyeOff className="w-2.5 h-2.5" />
        )}
      </button>
      {/* Bold toggle (admin only) */}
      {isAdmin && onToggleBold && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleBold();
          }}
          className={[
            "transition-colors",
            isBold
              ? "text-primary"
              : "text-muted-foreground/50 hover:text-muted-foreground",
          ].join(" ")}
          title={isBold ? "Remove bold" : "Make bold (foreground)"}
        >
          <Bold className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}

// ─── Drop zone (sensors) ──────────────────────────────────────────────────────

function DropZone({
  label,
  onDrop,
  children,
  isEmpty,
}: {
  label: string;
  onDrop: (sensorNum: number) => void;
  children: React.ReactNode;
  isEmpty?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        // Only accept sensor drags (text/plain with a number), not group drags
        if (e.dataTransfer.types.includes("application/group-id")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes("application/group-id")) return;
        e.preventDefault();
        setIsDragOver(false);
        const sensorNum = Number.parseInt(
          e.dataTransfer.getData("text/plain"),
          10,
        );
        if (!Number.isNaN(sensorNum)) onDrop(sensorNum);
      }}
      className={[
        "min-h-[32px] rounded-md p-1.5 flex flex-wrap gap-1 items-start content-start",
        "border-2 border-dashed transition-all duration-150",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-border/40 bg-muted/20",
      ].join(" ")}
    >
      {isEmpty ? (
        <span className="text-xs text-muted-foreground/60 italic self-center px-1">
          {label}
        </span>
      ) : (
        children
      )}
    </div>
  );
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToHue(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return Math.round(h * 360);
}

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

// ─── Group card (compact block) ───────────────────────────────────────────────

function GroupCard({
  group,
  groupIndex,
  boldSensors,
  getSensorColor,
  isSensorVisible,
  onRename,
  onDelete,
  onToggleVisible,
  onAddSensor,
  onRemoveSensor,
  onToggleSensorVisible,
  onToggleSensorBold,
  onChangeColor,
  sensorLabels,
  isAdmin,
  onSaveSensorLabel,
  isSavingSensorLabel,
  onDragGroupStart,
  onDragGroupOver,
  onDropGroup,
  isDragOverGroup,
}: {
  group: SensorGroup;
  groupIndex: number;
  boldSensors?: Set<number>;
  getSensorColor: (n: number) => string;
  isSensorVisible: (n: number) => boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onAddSensor: (groupId: string, sensorNum: number) => void;
  onRemoveSensor: (groupId: string, sensorNum: number) => void;
  onToggleSensorVisible: (sensorNum: number) => void;
  onToggleSensorBold?: (sensorNum: number) => void;
  onChangeColor: (id: string, hue: number) => void;
  sensorLabels?: Map<number, string>;
  isAdmin?: boolean;
  onSaveSensorLabel?: (sensorNum: number, label: string) => void;
  isSavingSensorLabel?: boolean;
  onDragGroupStart: (index: number) => void;
  onDragGroupOver: (index: number) => void;
  onDropGroup: () => void;
  isDragOverGroup: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(group.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const hslDot = `hsl(${group.hue}, 70%, 50%)`;
  const hslBorder = isDragOverGroup
    ? `hsl(${group.hue}, 70%, 50%)`
    : `hsl(${group.hue}, 50%, 70%)`;

  const commitEdit = () => {
    if (draftName.trim()) onRename(group.id, draftName);
    setIsEditing(false);
  };

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("application/group-id")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragGroupOver(groupIndex - 1);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("application/group-id")) return;
        e.preventDefault();
        onDropGroup();
      }}
      className={[
        "border rounded-lg p-2 space-y-1.5 transition-all duration-150 bg-card",
        isDragOverGroup ? "ring-2 ring-primary/60 scale-[1.02]" : "",
      ].join(" ")}
      style={{ borderColor: hslBorder }}
    >
      {/* Group header row */}
      <div className="flex items-center gap-1.5">
        {/* Drag handle for reordering groups */}
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "application/group-id",
              String(groupIndex - 1),
            );
            e.dataTransfer.effectAllowed = "move";
            onDragGroupStart(groupIndex - 1);
          }}
          data-ocid={`tsic.group.drag_handle.${groupIndex}`}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          title="Drag to reorder group"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Color dot */}
        <div className="relative flex-shrink-0" title="Change color">
          <span
            role="button"
            tabIndex={0}
            className="w-3 h-3 rounded-full block ring-1 ring-inset ring-black/10 cursor-pointer"
            style={{ backgroundColor: hslDot }}
            onClick={() => colorInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                colorInputRef.current?.click();
            }}
          />
          <input
            ref={colorInputRef}
            type="color"
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            value={hueToHex(group.hue)}
            onChange={(e) => onChangeColor(group.id, hexToHue(e.target.value))}
          />
        </div>

        {/* Name / inline editor */}
        {isEditing ? (
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <Input
              ref={inputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") {
                  setDraftName(group.name);
                  setIsEditing(false);
                }
              }}
              className="h-5 text-xs px-1.5 py-0 flex-1 min-w-0"
              maxLength={40}
              autoFocus
            />
            <button
              type="button"
              onClick={commitEdit}
              className="text-primary hover:text-primary/80 flex-shrink-0"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftName(group.name);
                setIsEditing(false);
              }}
              className="text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftName(group.name);
              setIsEditing(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="flex-1 min-w-0 text-left text-xs font-semibold hover:text-primary transition-colors flex items-center gap-1 group"
          >
            <span className="truncate">{group.name}</span>
            <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
          </button>
        )}

        {/* Controls */}
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <Switch
            checked={group.visible}
            onCheckedChange={() => onToggleVisible(group.id)}
            data-ocid={`tsic.group.toggle.${groupIndex}`}
            className="h-3.5 w-6 data-[state=checked]:bg-primary"
          />
          <button
            type="button"
            onClick={() => onDelete(group.id)}
            data-ocid={`tsic.group.delete_button.${groupIndex}`}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Delete group"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Sensor drop zone */}
      <DropZone
        label="Drag sensors here…"
        onDrop={(sensorNum) => onAddSensor(group.id, sensorNum)}
        isEmpty={group.sensors.length === 0}
      >
        {group.sensors.map((sensorNum, chipIdx) => (
          <div key={sensorNum} className="relative group/chip">
            <SensorChip
              sensorNum={sensorNum}
              color={getSensorColor(sensorNum)}
              isVisible={isSensorVisible(sensorNum)}
              isBold={boldSensors?.has(sensorNum)}
              onToggleVisible={() => onToggleSensorVisible(sensorNum)}
              onToggleBold={
                onToggleSensorBold
                  ? () => onToggleSensorBold(sensorNum)
                  : undefined
              }
              chipIndex={chipIdx + 1}
              label={sensorLabels?.get(sensorNum)}
              isAdmin={isAdmin}
              onSaveLabel={onSaveSensorLabel}
              isSavingLabel={isSavingSensorLabel}
            />
            <button
              type="button"
              onClick={() => onRemoveSensor(group.id, sensorNum)}
              className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-muted rounded-full
                text-muted-foreground hover:text-destructive hover:bg-destructive/10
                opacity-0 group-hover/chip:opacity-100 transition-opacity
                flex items-center justify-center text-[9px] leading-none"
              title="Remove from group"
            >
              ×
            </button>
          </div>
        ))}
      </DropZone>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SensorGroupManager({
  activeSensors,
  groups,
  ungroupedSensors,
  ungroupedVisible,
  sensorVisibilityOverrides: _svo,
  boldSensors,
  getSensorColor,
  isSensorVisible,
  onCreateGroup,
  onDeleteGroup,
  onRenameGroup,
  onAddSensorToGroup,
  onRemoveSensorFromGroup,
  onToggleGroupVisible,
  onToggleSensorVisible,
  onToggleUngroupedVisible,
  onToggleSensorBold,
  onReset,
  onChangeGroupColor,
  onReorderGroups,
  sensorLabels,
  onSaveSensorLabel,
  isSavingSensorLabel,
}: SensorGroupManagerProps) {
  const [newGroupName, setNewGroupName] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [columns, setColumns] = useState(2);

  // Group drag-and-drop state
  const [draggingGroupIndex, setDraggingGroupIndex] = useState<number | null>(
    null,
  );
  const [dragOverGroupIndex, setDragOverGroupIndex] = useState<number | null>(
    null,
  );

  const isAdmin = !!onSaveSensorLabel;

  const handleDropOnUngrouped = (sensorNum: number) => {
    for (const group of groups) {
      if (group.sensors.includes(sensorNum)) {
        onRemoveSensorFromGroup(group.id, sensorNum);
        return;
      }
    }
  };

  const handleDropGroup = () => {
    if (draggingGroupIndex !== null && dragOverGroupIndex !== null) {
      onReorderGroups(draggingGroupIndex, dragOverGroupIndex);
    }
    setDraggingGroupIndex(null);
    setDragOverGroupIndex(null);
  };

  const visibleUngrouped = ungroupedSensors.filter((s) =>
    activeSensors.includes(s),
  );

  return (
    <div data-ocid="tsic.group_manager.panel" className="p-3 space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Column selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Columns:</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setColumns(n)}
              className={[
                "w-6 h-6 rounded text-xs font-medium transition-colors",
                columns === n
                  ? "text-white"
                  : "text-muted-foreground border border-border hover:border-foreground/40 hover:text-foreground bg-transparent",
              ].join(" ")}
              style={columns === n ? { backgroundColor: "#808A54" } : undefined}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Add group + Reset */}
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newGroupName.trim()) {
                onCreateGroup(newGroupName.trim());
                setNewGroupName("");
              }
            }}
            placeholder="New group name…"
            className="h-7 text-xs min-w-0 max-w-[160px]"
            maxLength={40}
            data-ocid="tsic.add_group.input"
          />
          <Button
            onClick={() => {
              if (newGroupName.trim()) {
                onCreateGroup(newGroupName.trim());
                setNewGroupName("");
              }
            }}
            disabled={!newGroupName.trim()}
            size="sm"
            className="h-7 gap-1 text-xs flex-shrink-0 px-2"
            data-ocid="tsic.add_group.button"
          >
            <Plus className="w-3 h-3" />
            Add
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResetConfirm(true)}
            data-ocid="tsic.reset_groups.button"
            className="h-7 gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive flex-shrink-0 px-2"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </Button>
        </div>
      </div>

      {isAdmin && (
        <p className="text-xs text-muted-foreground">
          Double-click a sensor chip to edit its label. Click B to
          bold/foreground. Drag the <GripVertical className="inline w-3 h-3" />{" "}
          handle to reorder groups.
        </p>
      )}

      {/* ── Ungrouped (full width) ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Ungrouped
          </span>
          <Switch
            checked={ungroupedVisible}
            onCheckedChange={onToggleUngroupedVisible}
            data-ocid="tsic.ungrouped.toggle"
            className="h-3.5 w-6 data-[state=checked]:bg-primary"
          />
        </div>
        <DropZone
          label="All sensors are in groups"
          onDrop={handleDropOnUngrouped}
          isEmpty={visibleUngrouped.length === 0}
        >
          {visibleUngrouped.map((sensorNum, idx) => (
            <SensorChip
              key={sensorNum}
              sensorNum={sensorNum}
              color={getSensorColor(sensorNum)}
              isVisible={isSensorVisible(sensorNum)}
              isBold={boldSensors?.has(sensorNum)}
              onToggleVisible={() => onToggleSensorVisible(sensorNum)}
              onToggleBold={
                onToggleSensorBold
                  ? () => onToggleSensorBold(sensorNum)
                  : undefined
              }
              chipIndex={idx + 1}
              label={sensorLabels?.get(sensorNum)}
              isAdmin={isAdmin}
              onSaveLabel={onSaveSensorLabel}
              isSavingLabel={isSavingSensorLabel}
            />
          ))}
        </DropZone>
      </div>

      {/* ── Groups grid ── */}
      {groups.length > 0 && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: drag container
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          onDragEnd={() => {
            setDraggingGroupIndex(null);
            setDragOverGroupIndex(null);
          }}
        >
          {groups.map((group, idx) => (
            <GroupCard
              key={group.id}
              group={group}
              groupIndex={idx + 1}
              boldSensors={boldSensors}
              getSensorColor={getSensorColor}
              isSensorVisible={isSensorVisible}
              onRename={onRenameGroup}
              onDelete={onDeleteGroup}
              onToggleVisible={onToggleGroupVisible}
              onAddSensor={onAddSensorToGroup}
              onRemoveSensor={onRemoveSensorFromGroup}
              onToggleSensorVisible={onToggleSensorVisible}
              onToggleSensorBold={onToggleSensorBold}
              onChangeColor={onChangeGroupColor}
              sensorLabels={sensorLabels}
              isAdmin={isAdmin}
              onSaveSensorLabel={onSaveSensorLabel}
              isSavingSensorLabel={isSavingSensorLabel}
              onDragGroupStart={(index) => setDraggingGroupIndex(index)}
              onDragGroupOver={(index) => setDragOverGroupIndex(index)}
              onDropGroup={handleDropGroup}
              isDragOverGroup={
                dragOverGroupIndex === idx && draggingGroupIndex !== idx
              }
            />
          ))}
        </div>
      )}

      {/* Reset confirm dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent
          className="max-w-sm"
          data-ocid="tsic.reset_confirm.dialog"
        >
          <DialogHeader>
            <DialogTitle>Reset groups</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset all sensor groups and labels? This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowResetConfirm(false)}
              data-ocid="tsic.reset_confirm.cancel_button"
            >
              No
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onReset();
                setShowResetConfirm(false);
              }}
              data-ocid="tsic.reset_confirm.confirm_button"
            >
              Yes, reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
