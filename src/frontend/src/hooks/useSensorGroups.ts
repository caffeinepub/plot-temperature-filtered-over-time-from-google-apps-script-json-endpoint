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
}

const DEFAULT_STATE: SensorGroupsState = {
  groups: [],
  sensorVisibilityOverrides: {},
  ungroupedVisible: true,
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
    };
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * Generates a random hue (0-360) that avoids near-white / near-grey hues.
 * Hue itself is just the color angle; it's the saturation/lightness that
 * determines "whiteness", so all hues are fine as long as we use good S/L
 * values. We do still avoid a narrow "near-white yellow-green" band just to
 * be safe and spread hues across the wheel.
 */
function randomHue(): number {
  // Pick a random hue from the full wheel.
  // We skip nothing — all hues look vivid at 70% saturation.
  return Math.floor(Math.random() * 360);
}

export function useSensorGroups(isAdmin: boolean, selectedId: number | null) {
  const { actor, isFetching: actorFetching } = useActor();
  const [state, setState] = useState<SensorGroupsState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(false);

  // Track which ID we last loaded so we can reload when selectedId changes
  const loadedForIdRef = useRef<number | null>(undefined as unknown as null);

  // Load state from backend whenever selectedId changes
  useEffect(() => {
    if (!actor || actorFetching) return;
    if (selectedId === null) {
      setState(DEFAULT_STATE);
      loadedForIdRef.current = null;
      return;
    }
    // Already loaded for this ID — skip
    if (loadedForIdRef.current === selectedId) return;

    loadedForIdRef.current = selectedId;
    setIsLoading(true);
    actor
      .getSensorGroupsForId(BigInt(selectedId))
      .then((raw: string) => {
        if (!raw || raw.trim() === "") {
          setState(DEFAULT_STATE);
        } else {
          setState(parseState(raw));
        }
      })
      .catch(() => {
        setState(DEFAULT_STATE);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [actor, actorFetching, selectedId]);

  // Persist to backend whenever state changes (admin only)
  // Use a ref to avoid saving on the initial load for this ID
  const lastSavedStateRef = useRef<SensorGroupsState>(DEFAULT_STATE);
  const isSavingAllowedRef = useRef(false);

  // When loading completes, allow saves and record the loaded state as baseline.
  // IMPORTANT: "state" must NOT be in the dependency array here.
  // If it were, every state mutation would reset lastSavedStateRef to the new
  // state, making the diff-check in the save effect always return "no change",
  // so nothing would ever be persisted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally omit "state" to avoid resetting the save baseline on every mutation
  useEffect(() => {
    if (!isLoading && selectedId !== null) {
      lastSavedStateRef.current = state;
      isSavingAllowedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, selectedId]); // <-- "state" deliberately excluded

  // Reset save-allowed flag when selectedId changes so we don't save on load
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedId is the trigger; only refs are mutated inside
  useEffect(() => {
    isSavingAllowedRef.current = false;
    lastSavedStateRef.current = DEFAULT_STATE;
  }, [selectedId]);

  useEffect(() => {
    if (!isSavingAllowedRef.current) return;
    if (!isAdmin || !actor || selectedId === null) return;
    // Only save if state actually differs from last saved
    if (JSON.stringify(state) === JSON.stringify(lastSavedStateRef.current))
      return;

    lastSavedStateRef.current = state;
    actor
      .saveSensorGroupsForId(BigInt(selectedId), JSON.stringify(state))
      .catch(() => {
        // Ignore save errors silently
      });
  }, [state, isAdmin, actor, selectedId]);

  // Derived: set of all grouped sensor numbers
  const groupedSensorSet = useMemo(() => {
    const set = new Set<number>();
    for (const group of state.groups) {
      for (const s of group.sensors) {
        set.add(s);
      }
    }
    return set;
  }, [state.groups]);

  // Derived: ungrouped sensor numbers (1-72, minus those in a group)
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
      name: name.trim() || "Groep",
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
          // Add sensor if not already present
          if (!g.sensors.includes(sensorNum)) {
            return { ...g, sensors: [...g.sensors, sensorNum] };
          }
          return g;
        }
        // Remove from other groups
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
      // undefined or true → false; false → true
      const next = current === false;
      return {
        ...prev,
        sensorVisibilityOverrides: {
          ...prev.sensorVisibilityOverrides,
          [sensorNum]: next,
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

  /**
   * Returns the display color for a sensor.
   * - Grouped: HSL gradient from light (L=68%) to dark (L=32%) based on position
   * - Ungrouped: neutral grey
   */
  const getSensorColor = useCallback(
    (sensorNum: number): string => {
      for (const group of state.groups) {
        const idx = group.sensors.indexOf(sensorNum);
        if (idx !== -1) {
          const count = group.sensors.length;
          // Lightness: 68% for first sensor, 32% for last
          const lightness =
            count === 1 ? 50 : 68 - ((68 - 32) * idx) / (count - 1);
          return `hsl(${group.hue}, 70%, ${lightness.toFixed(1)}%)`;
        }
      }
      // Ungrouped: medium grey (never black or white)
      return "#9ca3af";
    },
    [state.groups],
  );

  /**
   * Returns true if a sensor should be shown in the chart.
   * - Individual override (false) hides the sensor regardless of group
   * - Group visibility hides all sensors in the group
   * - Ungrouped sensors are visible by default
   */
  const isSensorVisible = useCallback(
    (sensorNum: number): boolean => {
      // Individual override takes priority
      if (state.sensorVisibilityOverrides[sensorNum] === false) return false;

      // Find the group this sensor belongs to
      for (const group of state.groups) {
        if (group.sensors.includes(sensorNum)) {
          return group.visible;
        }
      }

      // Ungrouped — follow ungroupedVisible state
      return state.ungroupedVisible;
    },
    [state.groups, state.sensorVisibilityOverrides, state.ungroupedVisible],
  );

  return {
    groups: state.groups,
    ungroupedSensors,
    ungroupedVisible: state.ungroupedVisible,
    sensorVisibilityOverrides: state.sensorVisibilityOverrides,
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
    getSensorColor,
    isSensorVisible,
  };
}
