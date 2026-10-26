export const DEFAULT_AUTH_TOKEN = "marctang33";

type EnvLike = Record<string, string | undefined>;

export function expectedAuthToken(env?: EnvLike): string {
  const source: EnvLike = env ?? (process.env as EnvLike);
  const configured = source.READ_AUTH_TOKEN;
  if (typeof configured === "string" && configured.length > 0) return configured;
  return DEFAULT_AUTH_TOKEN;
}
