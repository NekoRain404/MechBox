import { defineStore } from "pinia";
import iso286Data from "../../../data/standards/tolerances/iso286.json";
import { getElectronDb } from "../utils/electron-db";
import {
  appendWorkflowCalculationRun,
  type CalculationRunRecord,
  listWorkflowCalculationRuns,
  replaceWorkflowCalculationRuns,
} from "../utils/calculation-runs";
import {
  fallbackBearings,
  fallbackBolts,
  getFallbackOringList,
  fallbackThreads,
} from "../utils/local-standard-fallbacks";

export interface FavoriteItem {
  id: string;
  module: string;
  name: string;
  data: unknown;
  createdAt: number;
}

export interface RecentCalculationItem {
  id: string;
  module: string;
  name: string;
  data: unknown;
  createdAt: number;
}

interface RecentCalculationOptions {
  id?: string;
  createdAt?: number;
  persistToWorkflow?: boolean;
  workflowRecord?: Partial<CalculationRunRecord>;
}

type ITGradeCode = keyof typeof iso286Data.it_grades;
type HoleDeviationCode = keyof typeof iso286Data.fundamental_deviations.holes;
type ShaftDeviationCode = keyof typeof iso286Data.fundamental_deviations.shafts;

export const FAVORITES_STORAGE_KEY = "mechbox-favorites";
export const RECENT_STORAGE_KEY = "mechbox-recent-calculations";
export const UNIT_STORAGE_KEY = "mechbox-unit";
const RECENT_HYDRATION_DELAY_MS = 2500;

let recentHydrationScheduled = false;

function normalizeFavoriteItem(input: unknown, index: number): FavoriteItem | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  return {
    id: String(item.id ?? `favorite_import_${index}`),
    module: String(item.module ?? "unknown"),
    name: String(item.name ?? "未命名收藏"),
    data: item.data ?? null,
    createdAt: Number(item.createdAt ?? Date.now()),
  };
}

function normalizeRecentCalculationItem(input: unknown, index: number): RecentCalculationItem | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  return {
    id: String(item.id ?? `recent_import_${index}`),
    module: String(item.module ?? "unknown"),
    name: String(item.name ?? "未命名计算"),
    data: item.data ?? null,
    createdAt: Number(item.createdAt ?? Date.now()),
  };
}

export function loadStoredUnitPreference(): "mm" | "inch" {
  try {
    const unit = localStorage.getItem(UNIT_STORAGE_KEY);
    return unit === "inch" ? "inch" : "mm";
  } catch (_error) {
    return "mm";
  }
}

export function saveStoredUnitPreference(unit: "mm" | "inch") {
  localStorage.setItem(UNIT_STORAGE_KEY, unit);
}

export function loadStoredFavoriteItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => normalizeFavoriteItem(item, index))
      .filter((item): item is FavoriteItem => Boolean(item));
  } catch (_error) {
    return [];
  }
}

export function saveStoredFavoriteItems(items: FavoriteItem[]) {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items));
}

export function loadStoredRecentCalculationItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => normalizeRecentCalculationItem(item, index))
      .filter((item): item is RecentCalculationItem => Boolean(item));
  } catch (_error) {
    return [];
  }
}

export function saveStoredRecentCalculationItems(items: RecentCalculationItem[]) {
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(items));
}

export const useStandardStore = defineStore("standard", {
  state: () => ({
    // Static data
    iso286Static: iso286Data,
    
    // Unit system
    unit: "mm" as "mm" | "inch",
    
    // Module data lists
    oringList: [] as any[],
    bearingList: [] as any[],
    boltList: [] as any[],
    threadList: [] as any[],
    
    // Favorites
    favorites: [] as FavoriteItem[],
    
    // Recent calculations
    recentCalculations: [] as RecentCalculationItem[],
  }),
  
  actions: {
    loadPersistedState() {
      this.unit = loadStoredUnitPreference();
      this.favorites = loadStoredFavoriteItems();
      this.recentCalculations = loadStoredRecentCalculationItems();

      if (!recentHydrationScheduled) {
        recentHydrationScheduled = true;
        window.setTimeout(() => {
          recentHydrationScheduled = false;
          void this.hydrateRecentCalculationsFromDb();
        }, RECENT_HYDRATION_DELAY_MS);
      }
    },

    persistFavorites() {
      saveStoredFavoriteItems(this.favorites);
    },

    persistRecentCalculations() {
      saveStoredRecentCalculationItems(this.recentCalculations);
    },

    async hydrateRecentCalculationsFromDb() {
      const localRecent = [...this.recentCalculations];
      const dbRuns = (await listWorkflowCalculationRuns(50))
        .filter((item) => item.sourceKind === 'recent-calculation')
        .slice(0, 20);

      if (!dbRuns.length && localRecent.length) {
        await replaceWorkflowCalculationRuns(
          localRecent.map((item) => ({
            id: `run_recent_${item.id}`,
            module: item.module,
            name: item.name,
            createdAt: new Date(item.createdAt).toISOString(),
            sourceKind: 'recent-calculation' as const,
            summary: item.name,
            outputData: item.data,
            metadata: {
              importedFrom: 'localStorage',
            },
          })),
        );
        return;
      }

      if (!dbRuns.length) return;

      this.recentCalculations = dbRuns.map((item) => ({
        id: item.id.replace(/^run_recent_/, ''),
        module: item.module,
        name: item.name,
        data: item.outputData ?? item.inputData ?? null,
        createdAt: new Date(item.createdAt).getTime(),
      }));
      this.persistRecentCalculations();
    },

    // Unit management
    setUnit(unit: "mm" | "inch") {
      this.unit = unit;
      saveStoredUnitPreference(unit);
    },
    
    // Tolerance helpers
    getSizeRangeIndex(size: number): number {
      return this.iso286Static.size_ranges.findIndex((range: number[]) => {
        return size > range[0] && size <= range[1];
      });
    },
    
    getITValue(grade: string, sizeIndex: number): number | null {
      // Use static ISO 286 data directly (Section 13 fix: removed broken IPC calls)
      const grades = this.iso286Static.it_grades;
      if (!grades) return null;

      const gradeKey = grade as ITGradeCode;
      const gradeData = grades[gradeKey];
      if (!gradeData || sizeIndex < 0 || sizeIndex >= gradeData.length) return null;

      return gradeData[sizeIndex]; // Value is in μm
    },

    getFundamentalDeviation(
      type: "holes" | "shafts",
      position: string,
      sizeIndex: number,
    ): number | null {
      // Use static ISO 286 data directly (Section 13 fix: removed broken IPC calls)
      const posData =
        type === "holes"
          ? this.iso286Static.fundamental_deviations.holes[position as HoleDeviationCode]
          : this.iso286Static.fundamental_deviations.shafts[position as ShaftDeviationCode];
      if (!posData || sizeIndex < 0 || sizeIndex >= posData.length) return null;

      return posData[sizeIndex]; // Value is in μm
    },
    
    // Data fetching
    async fetchOringList(standard: string) {
      const db = getElectronDb();
      if (!db) {
        this.oringList = getFallbackOringList(standard);
        return;
      }
      try {
        const result = await db.queryOringList(standard);
        this.oringList = result?.length ? result : getFallbackOringList(standard);
      } catch (_error) {
        this.oringList = getFallbackOringList(standard);
      }
    },
    
    async fetchBearings() {
      const db = getElectronDb();
      if (!db) {
        this.bearingList = fallbackBearings;
        return;
      }
      try {
        const result = await db.queryBearings();
        this.bearingList = result?.length ? result : fallbackBearings;
      } catch (_error) {
        this.bearingList = fallbackBearings;
      }
    },
    
    async fetchBolts() {
      const db = getElectronDb();
      if (!db) {
        this.boltList = fallbackBolts;
        return;
      }
      try {
        const result = await db.queryBolts();
        this.boltList = result?.length ? result : fallbackBolts;
      } catch (_error) {
        this.boltList = fallbackBolts;
      }
    },
    
    async fetchThreads() {
      const db = getElectronDb();
      if (!db) {
        this.threadList = fallbackThreads;
        return;
      }
      try {
        const result = await db.queryThreads();
        this.threadList = result?.length ? result : fallbackThreads;
      } catch (_error) {
        this.threadList = fallbackThreads;
      }
    },
    
    // Favorites management
    addFavorite(module: string, name: string, data: unknown, id?: string) {
      const favoriteId = id ?? `${module}_${Date.now()}`;
      this.favorites = this.favorites.filter((item) => item.id !== favoriteId);
      this.favorites.unshift({
        id: favoriteId,
        module,
        name,
        data,
        createdAt: Date.now(),
      });
      // Keep only last 50 favorites
      if (this.favorites.length > 50) {
        this.favorites = this.favorites.slice(0, 50);
      }
      this.persistFavorites();
    },

    isFavorite(id: string) {
      return this.favorites.some((favorite) => favorite.id === id);
    },
    
    removeFavorite(id: string) {
      this.favorites = this.favorites.filter(f => f.id !== id);
      this.persistFavorites();
    },
    
    clearFavorites() {
      this.favorites = [];
      this.persistFavorites();
    },

    mergeImportedFavorites(items: unknown[]) {
      const imported = items
        .map((item, index) => normalizeFavoriteItem(item, index))
        .filter((item): item is FavoriteItem => Boolean(item));

      if (!imported.length) return;

      this.favorites = [...imported, ...this.favorites]
        .filter((item, index, list) => list.findIndex((favorite) => favorite.id === item.id) === index)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50);
      this.persistFavorites();
    },
    
    // Recent calculations
    addRecentCalculation(module: string, name: string, data: unknown, options?: RecentCalculationOptions) {
      const createdAt = options?.createdAt ?? Date.now();
      const recordId = options?.id ?? `recent_${createdAt}`;
      this.recentCalculations.unshift({
        id: recordId,
        module,
        name,
        data,
        createdAt,
      });
      // Keep only last 20 recent items
      if (this.recentCalculations.length > 20) {
        this.recentCalculations = this.recentCalculations.slice(0, 20);
      }
      this.persistRecentCalculations();

      if (options?.persistToWorkflow !== false) {
        void appendWorkflowCalculationRun({
          id: options?.workflowRecord?.id ?? `run_recent_${recordId}`,
          module: options?.workflowRecord?.module ?? module,
          name: options?.workflowRecord?.name ?? name,
          createdAt: options?.workflowRecord?.createdAt ?? new Date(createdAt).toISOString(),
          projectId: options?.workflowRecord?.projectId,
          projectNumber: options?.workflowRecord?.projectNumber,
          projectName: options?.workflowRecord?.projectName,
          sourceKind: options?.workflowRecord?.sourceKind ?? 'recent-calculation',
          summary: options?.workflowRecord?.summary ?? name,
          linkedReportId: options?.workflowRecord?.linkedReportId,
          inputData: options?.workflowRecord?.inputData,
          outputData: options?.workflowRecord?.outputData ?? data,
          metadata: {
            origin: 'useStandardStore.addRecentCalculation',
            ...(options?.workflowRecord?.metadata ?? {}),
          },
        });
      }
    },

    mergeImportedRecentCalculations(items: unknown[]) {
      const imported = items
        .map((item, index) => normalizeRecentCalculationItem(item, index))
        .filter((item): item is RecentCalculationItem => Boolean(item));

      if (!imported.length) return;

      this.recentCalculations = [...imported, ...this.recentCalculations]
        .filter((item, index, list) => list.findIndex((recent) => recent.id === item.id) === index)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20);
      this.persistRecentCalculations();

      void replaceWorkflowCalculationRuns(
        this.recentCalculations.map((item) => ({
          id: `run_recent_${item.id}`,
          module: item.module,
          name: item.name,
          createdAt: new Date(item.createdAt).toISOString(),
          sourceKind: 'recent-calculation',
          summary: item.name,
          outputData: item.data,
          metadata: {
            importedFrom: 'mergeImportedRecentCalculations',
          },
        })),
      );
    },
  },
});
