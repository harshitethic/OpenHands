import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CanvasExtensionsService from "#/api/canvas-extensions-service";
import {
  useInstallCanvasExtension,
  useRefreshCanvasExtension,
} from "#/hooks/mutation/use-manage-canvas-extensions";
import { CORS_OR_NETWORK_ERROR_MESSAGE } from "#/utils/user-facing-error";

const displayErrorToast = vi.fn();
vi.mock("#/utils/custom-toast-handlers", () => ({
  displayErrorToast: (message: string) => displayErrorToast(message),
  displaySuccessToast: vi.fn(),
}));

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
};

/** The shape the shared TypeScript client throws for a failed request. */
class HttpError extends Error {
  status: number;

  response: unknown;

  constructor(status: number, detail: string) {
    super(
      `HTTP request failed (${status} Bad Request): ${JSON.stringify({ detail })}`,
    );
    this.name = "HttpError";
    this.status = status;
    this.response = { detail };
  }
}

describe("useInstallCanvasExtension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces the server's reason instead of the raw HTTP message", async () => {
    const detail =
      "Failed to fetch canvas extension source: Subdirectory 'canvas-puls' not found in local source '/repo'";
    vi.spyOn(CanvasExtensionsService, "install").mockRejectedValue(
      new HttpError(400, detail),
    );

    const { result } = renderHook(() => useInstallCanvasExtension(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ source: "/repo", repo_path: "canvas-puls" });

    await waitFor(() => expect(displayErrorToast).toHaveBeenCalled());
    expect(displayErrorToast).toHaveBeenCalledWith(detail);
    expect(displayErrorToast).not.toHaveBeenCalledWith(
      expect.stringContaining("HTTP request failed"),
    );
  });

  it("keeps the shared disconnect wording when the request never lands", async () => {
    vi.spyOn(CanvasExtensionsService, "install").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    const { result } = renderHook(() => useInstallCanvasExtension(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ source: "/repo" });

    await waitFor(() => expect(displayErrorToast).toHaveBeenCalled());
    expect(displayErrorToast).toHaveBeenCalledWith(
      CORS_OR_NETWORK_ERROR_MESSAGE,
    );
  });
});


describe("useRefreshCanvasExtension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("force-reinstalls from the original source and preserves enabled state", async () => {
    vi.spyOn(CanvasExtensionsService, "install").mockResolvedValue({
      name: "demo",
      version: "0.2.0",
      description: "updated",
      enabled: false,
      source: "github:example/apps",
      requested_ref: "main",
      resolved_ref: "new-sha",
      repo_path: "apps/demo",
      installed_at: "2026-09-24T00:00:00Z",
      install_path: "/tmp/demo",
    });
    const setEnabled = vi
      .spyOn(CanvasExtensionsService, "setEnabled")
      .mockResolvedValue({ name: "demo", enabled: true });

    const { result } = renderHook(() => useRefreshCanvasExtension(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: "demo",
      version: "0.1.0",
      description: "old",
      enabled: true,
      source: "github:example/apps",
      requested_ref: "main",
      resolved_ref: "old-sha",
      repo_path: "apps/demo",
      installed_at: "2026-09-23T00:00:00Z",
      install_path: "/tmp/demo",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(CanvasExtensionsService.install).toHaveBeenCalledWith({
      source: "github:example/apps",
      ref: "main",
      repo_path: "apps/demo",
      force: true,
    });
    expect(setEnabled).toHaveBeenCalledWith("demo", true);
  });

  it("does not toggle a disabled App after refresh", async () => {
    vi.spyOn(CanvasExtensionsService, "install").mockResolvedValue({
      name: "demo",
      version: "0.2.0",
      description: null,
      enabled: false,
      source: "/workspace/demo",
      requested_ref: null,
      resolved_ref: null,
      repo_path: null,
      installed_at: "2026-09-24T00:00:00Z",
      install_path: "/tmp/demo",
    });
    const setEnabled = vi.spyOn(CanvasExtensionsService, "setEnabled");

    const { result } = renderHook(() => useRefreshCanvasExtension(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: "demo",
      version: "0.1.0",
      enabled: false,
      source: "/workspace/demo",
      requested_ref: null,
      resolved_ref: null,
      repo_path: null,
      installed_at: "2026-09-23T00:00:00Z",
      install_path: "/tmp/demo",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setEnabled).not.toHaveBeenCalled();
  });
});
