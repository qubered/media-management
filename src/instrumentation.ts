export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startOscServer } = await import("@/lib/server/osc");
    startOscServer();
  }
}
