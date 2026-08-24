/** A centered spinner with a message, for a step that takes a moment (server processing, a network fetch). */
export default function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
