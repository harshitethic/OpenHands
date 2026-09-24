import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { GitRepository } from "#/types/git";
import { Provider } from "#/types/settings";

interface HomeState {
  /** Legacy unscoped recents kept for callers outside the backend-aware Home flow. */
  recentRepositories: GitRepository[];
  recentRepositoriesByScope: Record<string, GitRepository[]>;
  lastSelectedProvider: Provider | null;
}

interface HomeActions {
  addRecentRepository: (
    repository: GitRepository,
    scopeKey?: string,
  ) => void;
  clearRecentRepositories: (scopeKey?: string) => void;
  getRecentRepositories: (scopeKey?: string) => GitRepository[];
  setLastSelectedProvider: (provider: Provider | null) => void;
  getLastSelectedProvider: () => Provider | null;
}

type HomeStore = HomeState & HomeActions;

const initialState: HomeState = {
  recentRepositories: [],
  recentRepositoriesByScope: {},
  lastSelectedProvider: null,
};

function prependRecentRepository(
  repositories: GitRepository[],
  repository: GitRepository,
): GitRepository[] {
  const filteredRepos = repositories.filter(
    (repo) => repo.id !== repository.id,
  );
  return [repository, ...filteredRepos].slice(0, 3);
}

export const useHomeStore = create<HomeStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addRecentRepository: (repository: GitRepository, scopeKey?: string) =>
        set((state) => {
          if (!scopeKey) {
            return {
              recentRepositories: prependRecentRepository(
                state.recentRepositories,
                repository,
              ),
            };
          }

          const scopedRepositories =
            state.recentRepositoriesByScope[scopeKey] ?? [];
          return {
            recentRepositoriesByScope: {
              ...state.recentRepositoriesByScope,
              [scopeKey]: prependRecentRepository(
                scopedRepositories,
                repository,
              ),
            },
          };
        }),

      clearRecentRepositories: (scopeKey?: string) =>
        set((state) => {
          if (!scopeKey) {
            return { recentRepositories: [] };
          }

          const nextByScope = { ...state.recentRepositoriesByScope };
          delete nextByScope[scopeKey];
          return { recentRepositoriesByScope: nextByScope };
        }),

      getRecentRepositories: (scopeKey?: string) =>
        scopeKey
          ? (get().recentRepositoriesByScope[scopeKey] ?? [])
          : get().recentRepositories,

      setLastSelectedProvider: (provider: Provider | null) =>
        set(() => ({
          lastSelectedProvider: provider,
        })),

      getLastSelectedProvider: () => get().lastSelectedProvider,
    }),
    {
      name: "home-store", // unique name for localStorage
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
