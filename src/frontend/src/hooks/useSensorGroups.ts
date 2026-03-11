import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActor } from "./useActor";

export interface SensorGroup {
  id: string;
  name: string;
  hue: number; // 0-360
  sensors: number[]; // sensor numbers 1-72
  visible: boolean;
}

interface SensorGroupsState {
  groups: SensorGroup[];
  sensorVisibilityOverrides: Record<number, boolean>;
  ungroupedVisible: boolean;
  boldSensors: number[];
  nameColors: Record<string, number>; // label -> hue 0-360
  nameVisibility: Record<string, boolean>; // label -> visible
}

const DEFAULT_STATE: SensorGroupsState = {
  groups: [],
  sensorVisibilityOverrides: {},
  ungroupedVisible: true,
  boldSensors: [],
  nameColors: {},
  nameVisibility: {},
};

function parseState(raw: string): SensorGroupsState {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;
    return {
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      sensorVisibilityOverrides:
        parsed.sensorVisibilityOverrides &&
        typeof parsed.sensorVisibilityOverrides === "object"
          ? parsed.sensorVisibilityOverrides
          : {},
      ungroupedVisible:
        typeof parsed.ungroupedVisible === "boolean"
          ? parsed.ungroupedVisible
          : true,
      boldSensors: Array.isArray(parsed.boldSensors) ? parsed.boldSensors : [],
      nameColors:
        parsed.nameColors && typeof parsed.nameColors === "object"
          ? parsed.nameColors
          : {},
      nameVisibility:
        parsed.nameVisibility && typeof parsed.nameVisibility === "object"
          ? parsed.nameVisibility
          : {},
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function randomHue(): number {
  return Math.floor(Math.random() * 360);
}

/** Deterministic hue from a label string (for byName color mode) */
export function labelToHue(label: string): number {
  let hash = 5381;
  for (let i = 0; i < label.length; i++) {
    hash = ((hash << 5) + hash) ^ label.charCodeAt(i);
  }
  return Math.abs(hash) % 360;
}

export function useSensorGroups(isAdmin: boolean, selectedId: number | null) {
  const { actor, isFetching: actorFetching } = useActor();
  const [state, setState] = useState<SensorGroupsState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(false);

  const loadedForIdRef = useRef<number | null>(undefined as unknown as null);

  // Load state from backend whenever selectedId changes
  useEffect(() => {
    if (!actor || actorFetching) return;
    if (selectedId === null) {
      setState(DEFAULT_STATE);
      loadedForIdRef.current = null;
      return;
    }
    if (loadedForIdRef.current === selectedId) return;

    loadedForIdRef.current = selectedId;
    setIsLoading(true);
    actor
      .getSensorGroupsForId(BigInt(selectedId))
      .then((raw: string) => {
        setState(raw && raw.trim() !== "" ? parseState(raw) : DEFAULT_STATE);
      })
      .catch(() => setState(DEFAULT_STATE))
      .finally(() => setIsLoading(false));
  }, [actor, actorFetching, selectedId]);

  const lastSavedStateRef = useRef<SensorGroupsState>(DEFAULT_STATE);
  const isSavingAllowedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally omit "state"
  useEffect(() => {
    if (!isLoading && selectedId !== null) {
      lastSavedStateRef.current = state;
      isSavingAllowedRef.current = true;
    }
  }, [isLoading, selectedId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedId is the trigger
  useEffect(() => {
    isSavingAllowedRef.current = false;
    lastSavedStateRef.current = DEFAULT_STATE;
  }, [selectedId]);

  useEffect(() => {
    if (!isSavingAllowedRef.current) return;
    if (!isAdmin || !actor || selectedId === null) return;
    if (JSON.stringify(state) === JSON.stringify(lastSavedStateRef.current))
      return;

    lastSavedStateRef.current = state;
    actor
      .saveSensorGroupsForId(BigInt(selectedId), JSON.stringify(state))
      .catch(() => {});
  }, [state, isAdmin, actor, selectedId]);

  const groupedSensorSet = useMemo(() => {
    const set = new Set<number>();
    for (const group of state.groups) {
      for (const s of group.sensors) set.add(s);
    }
    return set;
  }, [state.groups]);

  const ungroupedSensors = useMemo(() => {
    const result: number[] = [];
    for (let s = 1; s <= 72; s++) {
      if (!groupedSensorSet.has(s)) result.push(s);
    }
    return result;
  }, [groupedSensorSet]);

  const createGroup = useCallback((name: string) => {
    const newGroup: SensorGroup = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim() || "Group",
      hue: randomHue(),
      sensors: [],
      visible: true,
    };
    setState((prev) => ({ ...prev, groups: [...prev.groups, newGroup] }));
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== id),
    }));
  }, []);

  const renameGroup = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === id ? { ...g, name: name.trim() || g.name } : g,
      ),
    }));
  }, []);

  const changeGroupColor = useCallback((id: string, hue: number) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === id ? { ...g, hue } : g)),
    }));
  }, []);

  const addSensorToGroup = useCallback((groupId: string, sensorNum: number) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id === groupId) {
          if (!g.sensors.includes(sensorNum)) {
            return { ...g, sensors: [...g.sensors, sensorNum] };
          }
          return g;
        }
        return { ...g, sensors: g.sensors.filter((s) => s !== sensorNum) };
      }),
    }));
  }, []);

  const removeSensorFromGroup = useCallback(
    (groupId: string, sensorNum: number) => {
      setState((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId
            ? { ...g, sensors: g.sensors.filter((s) => s !== sensorNum) }
            : g,
        ),
      }));
    },
    [],
  );

  const toggleGroupVisible = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === id ? { ...g, visible: !g.visible } : g,
      ),
    }));
  }, []);

  const toggleSensorVisible = useCallback((sensorNum: number) => {
    setState((prev) => {
      const current = prev.sensorVisibilityOverrides[sensorNum];
      return {
        ...prev,
        sensorVisibilityOverrides: {
          ...prev.sensorVisibilityOverrides,
          [sensorNum]: current === false,
        },
      };
    });
  }, []);

  const resetGroups = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const toggleUngroupedVisible = useCallback(() => {
    setState((prev) => ({ ...prev, ungroupedVisible: !prev.ungroupedVisible }));
  }, []);

  const toggleSensorBold = useCallback((sensorNum: number) => {
    setState((prev) => {
      const isBold = prev.boldSensors.includes(sensorNum);
      return {
        ...prev,
        boldSensors: isBold
          ? prev.boldSensors.filter((s) => s !== sensorNum)
          : [...prev.boldSensors, sensorNum],
      };
    });
  }, []);

  const changeNameGroupColor = useCallback((name: string, hue: number) => {
    setState((prev) => ({
      ...prev,
      nameColors: { ...prev.nameColors, [name]: hue },
    }));
  }, []);

  const toggleNameGroupVisible = useCallback((name: string) => {
    setState((prev) => ({
      ...prev,
      nameVisibility: {
        ...prev.nameVisibility,
        [name]: prev.nameVisibility[name] === false,
      },
    }));
  }, []);

  /** Reorder groups: move the group at fromIndex to toIndex */
  const reorderGroups = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      if (fromIndex === toIndex) return prev;
      const newGroups = [...prev.groups];
      const [moved] = newGroups.splice(fromIndex, 1);
      newGroups.splice(toIndex, 0, moved);
      return { ...prev, groups: newGroups };
    });
  }, []);

  /**
   * Single flat color per group (no gradient). Ungrouped = grey.
   */
  const getSensorColor = useCallback(
    (sensorNum: number): string => {
      for (const group of state.groups) {
        if (group.sensors.includes(sensorNum)) {
          return `hsl(${group.hue}, 70%, 50%)`;
        }
      }
      return "#9ca3af";
    },
    [state.groups],
  );

  /**
   * Color based on the sensor's label (all sensors with same label share same color).
   */
  const getSensorColorByName = useCallback(
    (sensorNum: number, getLabel: (n: number) => string): string => {
      const label = getLabel(sensorNum) || `S${sensorNum}`;
      const storedHue = state.nameColors[label];
      const hue = storedHue !== undefined ? storedHue : labelToHue(label);
      return `hsl(${hue}, 70%, 50%)`;
    },
    [state.nameColors],
  );

  /**
   * Visibility in byGroup mode.
   */
  const isSensorVisible = useCallback(
    (sensorNum: number): boolean => {
      if (state.sensorVisibilityOverrides[sensorNum] === false) return false;
      for (const group of state.groups) {
        if (group.sensors.includes(sensorNum)) return group.visible;
      }
      return state.ungroupedVisible;
    },
    [state.groups, state.sensorVisibilityOverrides, state.ungroupedVisible],
  );

  /**
   * Visibility in byName mode.
   */
  const isSensorVisibleByName = useCallback(
    (sensorNum: number, getLabel: (n: number) => string): boolean => {
      if (state.sensorVisibilityOverrides[sensorNum] === false) return false;
      const label = getLabel(sensorNum) || `S${sensorNum}`;
      return state.nameVisibility[label] !== false;
    },
    [state.sensorVisibilityOverrides, state.nameVisibility],
  );

  const boldSensorsSet = useMemo(
    () => new Set(state.boldSensors),
    [state.boldSensors],
  );

  return {
    groups: state.groups,
    ungroupedSensors,
    ungroupedVisible: state.ungroupedVisible,
    sensorVisibilityOverrides: state.sensorVisibilityOverrides,
    boldSensors: boldSensorsSet,
    nameColors: state.nameColors,
    nameVisibility: state.nameVisibility,
    isLoading,
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
    changeNameGroupColor,
    toggleNameGroupVisible,
    reorderGroups,
    getSensorColor,
    getSensorColorByName,
    isSensorVisible,
    isSensorVisibleByName,
  };
}
