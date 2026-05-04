export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLangfuseTelemetry } = await import("./lib/observability");
    await startLangfuseTelemetry();
  }
}
