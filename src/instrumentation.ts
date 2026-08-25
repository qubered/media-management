export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startOscServer } = await import("@/lib/server/osc");
    startOscServer();

    const { startScheduler } = await import("@/lib/server/scheduler");
    startScheduler();
  }
}
