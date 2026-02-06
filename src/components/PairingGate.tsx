import { useEffect, useRef, useState } from "react";
import { Button } from "./base/Button";
import { TextInput } from "./base/TextInput";

interface PairingGateProps {
  onUnlock: (password: string) => Promise<void>;
  isUnlocking: boolean;
  errorMessage: string | null;
}

export function PairingGate({
  onUnlock,
  isUnlocking,
  errorMessage,
}: PairingGateProps) {
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setLocalError("Enter a password to unlock your notes.");
      return;
    }
    setLocalError(null);
    await onUnlock(trimmed);
  };

  const message = localError ?? errorMessage;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-slate-100">Unlock notes</h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter your vault password to decrypt and access your content.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="text-xs text-slate-400" htmlFor="vault-password">
            Password
          </label>
          <TextInput
            ref={inputRef}
            id="vault-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isUnlocking}
            className="mt-2 w-full px-3 py-2 text-sm text-slate-200"
          />
          {message ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {message}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={isUnlocking}
            variant="solid"
            tone="primary"
            size="sm"
            fullWidth
            className="font-semibold"
          >
            {isUnlocking ? "Unlocking..." : "Unlock"}
          </Button>
        </form>
      </div>
    </div>
  );
}
