import { useEffect, useRef, useState } from "react";
import { Button } from "./base/Button";
import { TextInput } from "./base/TextInput";
import { hasEncryptedVault } from "../services/notesDb";

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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    let isActive = true;
    hasEncryptedVault()
      .then((result) => {
        if (isActive) setHasVault(result);
      })
      .catch((error) => {
        console.error(error);
        if (isActive) setHasVault(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = password.trim();
    const trimmedConfirm = confirmPassword.trim();
    if (!trimmed) {
      setLocalError(
        hasVault
          ? "Enter your vault password to unlock notes."
          : "Enter a new vault password.",
      );
      return;
    }
    if (hasVault === false) {
      if (!trimmedConfirm) {
        setLocalError("Confirm your new vault password.");
        return;
      }
      if (trimmed !== trimmedConfirm) {
        setLocalError("New passwords do not match.");
        return;
      }
    }
    setLocalError(null);
    await onUnlock(trimmed);
  };

  const message =
    localError ??
    (hasVault === false && errorMessage
      ? "Unable to set up the vault. Try again."
      : errorMessage);
  const isCheckingVault = hasVault === null;
  const title = hasVault ? "Unlock notes" : "Set up vault";
  const description = hasVault
    ? "Enter your vault password to decrypt and access your content."
    : "Create a vault password to encrypt your notes.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label
            className="text-xs text-slate-400"
            htmlFor="vault-password"
          >
            {hasVault ? "Password" : "New password"}
          </label>
          <TextInput
            ref={inputRef}
            id="vault-password"
            type="password"
            autoComplete={hasVault ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isUnlocking || isCheckingVault}
            className="mt-2 w-full px-3 py-2 text-sm text-slate-200"
          />
          {hasVault === false ? (
            <>
              <label
                className="text-xs text-slate-400"
                htmlFor="vault-password-confirm"
              >
                Confirm new password
              </label>
              <TextInput
                id="vault-password-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isUnlocking || isCheckingVault}
                className="mt-2 w-full px-3 py-2 text-sm text-slate-200"
              />
            </>
          ) : null}
          {message ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {message}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={isUnlocking || isCheckingVault}
            variant="solid"
            tone="primary"
            size="sm"
            fullWidth
            className="font-semibold"
          >
            {isCheckingVault
              ? "Checking..."
              : isUnlocking
                ? "Unlocking..."
                : hasVault
                  ? "Unlock"
                  : "Create vault"}
          </Button>
        </form>
      </div>
    </div>
  );
}
