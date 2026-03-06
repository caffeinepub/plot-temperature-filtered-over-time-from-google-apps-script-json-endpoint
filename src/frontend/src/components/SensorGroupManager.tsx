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
  Check,
  Eye,
  EyeOff,
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
  onReset: () => void;
  onChangeGroupColor: (id: string, hue: number) => void;
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
  onToggleVisible: () => void;
  chipIndex: number;
  // Label editing (admin only)
  label?: string;
  isAdmin?: boolean;
  onSaveLabel?: (sensorNum: number, label: string) => void;
  isSavingLabel?: boolean;
}

function SensorChip({
  sensorNum,
  color,
  isVisible,
  onToggleVisible,
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
    if (onSaveLabel) {
      onSaveLabel(sensorNum, draft.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(label ?? "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: presentational stop propagation
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
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono
        cursor-grab active:cursor-grabbing select-none
        border transition-all duration-150
        ${isVisible ? "opacity-100" : "opacity-40"}
        hover:shadow-sm hover:scale-105
        ${isAdmin && onSaveLabel ? "cursor-grab" : ""}
      `}
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible();
        }}
        className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
        title={isVisible ? "Hide" : "Show"}
      >
        {isVisible ? (
          <Eye className="w-2.5 h-2.5" />
        ) : (
          <EyeOff className="w-2.5 h-2.5" />
        )}
      </button>
    </div>
  );
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

interface DropZoneProps {
  label: string;
  onDrop: (sensorNum: number) => void;
  children: React.ReactNode;
  isEmpty?: boolean;
}

function DropZone({ label, onDrop, children, isEmpty }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData("text/plain");
    const sensorNum = Number.parseInt(raw, 10);
    if (!Number.isNaN(sensorNum)) {
      onDrop(sensorNum);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        min-h-[40px] rounded-md p-2 flex flex-wrap gap-1.5 items-start content-start
        border-2 border-dashed transition-all duration-150
        ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border/40 bg-muted/20"
        }
      `}
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

// ─── Group card ───────────────────────────────────────────────────────────────

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

interface GroupCardProps {
  group: SensorGroup;
  groupIndex: number;
  activeSensors: number[];
  sensorVisibilityOverrides: Record<number, boolean>;
  getSensorColor: (n: number) => string;
  isSensorVisible: (n: number) => boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onAddSensor: (groupId: string, sensorNum: number) => void;
  onRemoveSensor: (groupId: string, sensorNum: number) => void;
  onToggleSensorVisible: (sensorNum: number) => void;
  onChangeColor: (id: string, hue: number) => void;
  // Label props
  sensorLabels?: Map<number, string>;
  isAdmin?: boolean;
  onSaveSensorLabel?: (sensorNum: number, label: string) => void;
  isSavingSensorLabel?: boolean;
}

function GroupCard({
  group,
  groupIndex,
  getSensorColor,
  isSensorVisible,
  onRename,
  onDelete,
  onToggleVisible,
  onAddSensor,
  onRemoveSensor,
  onToggleSensorVisible,
  onChangeColor,
  sensorLabels,
  isAdmin,
  onSaveSensorLabel,
  isSavingSensorLabel,
}: GroupCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(group.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const hslDot = `hsl(${group.hue}, 70%, 50%)`;
  const hslBorder = `hsl(${group.hue}, 60%, 75%)`;

  const startEdit = () => {
    setDraftName(group.name);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (draftName.trim()) onRename(group.id, draftName);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setDraftName(group.name);
    setIsEditing(false);
  };

  return (
    <div
      className="border rounded-lg p-3 space-y-2 transition-all duration-150"
      style={{ borderColor: hslBorder }}
    >
      {/* Group header */}
      <div className="flex items-center gap-2">
        {/* Color picker dot */}
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
          <div className="flex-1 flex items-center gap-1">
            <Input
              ref={inputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="h-6 text-xs px-1.5 py-0 flex-1"
              maxLength={40}
            />
            <button
              type="button"
              onClick={commitEdit}
              className="text-primary hover:text-primary/80"
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-muted-foreground hover:text-foreground"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="flex-1 text-left text-sm font-medium hover:text-primary transition-colors flex items-center gap-1 group"
            title="Edit name"
          >
            <span className="truncate">{group.name}</span>
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
          </button>
        )}

        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          {/* Group visibility toggle */}
          <Switch
            checked={group.visible}
            onCheckedChange={() => onToggleVisible(group.id)}
            data-ocid={`tsic.group.toggle.${groupIndex}`}
            className="h-4 w-7 data-[state=checked]:bg-primary"
          />
          {/* Delete button */}
          <button
            type="button"
            onClick={() => onDelete(group.id)}
            data-ocid={`tsic.group.delete_button.${groupIndex}`}
            className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
            title="Delete group"
          >
            <Trash2 className="w-3.5 h-3.5" />
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
              onToggleVisible={() => onToggleSensorVisible(sensorNum)}
              chipIndex={chipIdx + 1}
              label={sensorLabels?.get(sensorNum)}
              isAdmin={isAdmin}
              onSaveLabel={onSaveSensorLabel}
              isSavingLabel={isSavingSensorLabel}
            />
            {/* Remove from group button */}
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
  sensorVisibilityOverrides,
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
  onReset,
  onChangeGroupColor,
  sensorLabels,
  onSaveSensorLabel,
  isSavingSensorLabel,
}: SensorGroupManagerProps) {
  const [newGroupName, setNewGroupName] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const isAdmin = !!onSaveSensorLabel;

  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (name) {
      onCreateGroup(name);
      setNewGroupName("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleCreateGroup();
  };

  // For ungrouped drop zone: if sensor is already in a group, remove it first,
  // then it becomes ungrouped. If already ungrouped, do nothing.
  const handleDropOnUngrouped = (sensorNum: number) => {
    // Find if it's in any group and remove it
    for (const group of groups) {
      if (group.sensors.includes(sensorNum)) {
        onRemoveSensorFromGroup(group.id, sensorNum);
        return;
      }
    }
    // Already ungrouped — do nothing
  };

  // Only show ungrouped sensors that actually have data (are in activeSensors)
  const visibleUngrouped = ungroupedSensors.filter((s) =>
    activeSensors.includes(s),
  );

  return (
    <div
      data-ocid="tsic.group_manager.panel"
      className="border border-border rounded-xl p-4 bg-card shadow-sm space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">
            Sensor Groups
          </h3>
          {isAdmin && (
            <p className="text-xs text-muted-foreground">
              Double-click a sensor to edit its label
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowResetConfirm(true)}
          data-ocid="tsic.reset_groups.button"
          className="h-7 gap-1.5 text-xs text-destructive border-destructive/30
            hover:bg-destructive/10 hover:text-destructive hover:border-destructive/60"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>

        {/* Reset confirmation dialog */}
        <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
          <DialogContent
            className="max-w-sm"
            data-ocid="tsic.reset_confirm.dialog"
          >
            <DialogHeader>
              <DialogTitle>Reset groups</DialogTitle>
              <DialogDescription>
                Are you sure you want to reset all sensor groups and labels?
                This cannot be undone.
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

      {/* Ungrouped sensors */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Ungrouped:
          </span>
          <Switch
            checked={ungroupedVisible}
            onCheckedChange={onToggleUngroupedVisible}
            data-ocid="tsic.ungrouped.toggle"
            className="h-4 w-7 data-[state=checked]:bg-primary"
          />
        </div>
        <DropZone
          label="All sensors are assigned to groups"
          onDrop={handleDropOnUngrouped}
          isEmpty={visibleUngrouped.length === 0}
        >
          {visibleUngrouped.map((sensorNum, idx) => (
            <SensorChip
              key={sensorNum}
              sensorNum={sensorNum}
              color={getSensorColor(sensorNum)}
              isVisible={isSensorVisible(sensorNum)}
              onToggleVisible={() => onToggleSensorVisible(sensorNum)}
              chipIndex={idx + 1}
              label={sensorLabels?.get(sensorNum)}
              isAdmin={isAdmin}
              onSaveLabel={onSaveSensorLabel}
              isSavingLabel={isSavingSensorLabel}
            />
          ))}
        </DropZone>
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div className="space-y-2">
          {groups.map((group, idx) => (
            <GroupCard
              key={group.id}
              group={group}
              groupIndex={idx + 1}
              activeSensors={activeSensors}
              sensorVisibilityOverrides={sensorVisibilityOverrides}
              getSensorColor={getSensorColor}
              isSensorVisible={isSensorVisible}
              onRename={onRenameGroup}
              onDelete={onDeleteGroup}
              onToggleVisible={onToggleGroupVisible}
              onAddSensor={onAddSensorToGroup}
              onRemoveSensor={onRemoveSensorFromGroup}
              onToggleSensorVisible={onToggleSensorVisible}
              onChangeColor={onChangeGroupColor}
              sensorLabels={sensorLabels}
              isAdmin={isAdmin}
              onSaveSensorLabel={onSaveSensorLabel}
              isSavingSensorLabel={isSavingSensorLabel}
            />
          ))}
        </div>
      )}

      {/* Add group */}
      <div className="flex gap-2">
        <Input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Group name…"
          className="h-8 text-xs flex-1"
          maxLength={40}
          data-ocid="tsic.add_group.input"
        />
        <Button
          onClick={handleCreateGroup}
          disabled={!newGroupName.trim()}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          data-ocid="tsic.add_group.button"
        >
          <Plus className="w-3.5 h-3.5" />
          Add group
        </Button>
      </div>
    </div>
  );
}
