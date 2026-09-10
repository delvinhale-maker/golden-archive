import type { CreatorStudioRenderPlan } from "@/lib/creator-studio.render-plan";

export type CreatorStudioResolvedMedia = Record<string, string>;

export type CreatorStudioProviderStatus =
  | { state: "QUEUED" | "RENDERING"; providerStatus: string; metadata: Record<string, unknown> }
  | {
      state: "SUCCEEDED";
      providerStatus: string;
      outputUrl: string;
      metadata: Record<string, unknown>;
    }
  | {
      state: "FAILED";
      providerStatus: string;
      safeErrorCode: string;
      safeErrorMessage: string;
      metadata: Record<string, unknown>;
    };

export interface CreatorStudioRenderProvider {
  readonly name: "SHOTSTACK";
  createRender(input: {
    plan: CreatorStudioRenderPlan;
    media: CreatorStudioResolvedMedia;
    callbackUrl: string;
  }): Promise<{ providerJobId: string; metadata: Record<string, unknown> }>;
  getRenderStatus(providerJobId: string): Promise<CreatorStudioProviderStatus>;
}

export class CreatorStudioProviderError extends Error {
  constructor(
    public readonly safeCode: string,
    public readonly safeMessage: string,
    public readonly privateDetails: Record<string, unknown> = {},
  ) {
    super(safeMessage);
    this.name = "CreatorStudioProviderError";
  }
}
