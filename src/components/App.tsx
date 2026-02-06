import { useCallback, useState } from "react";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { initializeVault, type NoteDocument } from "../services/notesDb";
import { PairingGate } from "./PairingGate";
import { NotesApp } from "./NotesApp";

function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [initialDocuments, setInitialDocuments] = useState<NoteDocument[]>([]);

  const handleUnlock = useCallback(async (password: string) => {
    setIsUnlocking(true);
    setUnlockError(null);
    try {
      const payload = await initializeVault(password);
      setInitialDocuments(payload.documents);
      setIsUnlocked(true);
    } catch (e) {
      console.error(e);
      setUnlockError("Unable to decrypt notes. Check your password.");
    } finally {
      setIsUnlocking(false);
    }
  }, []);

  if (!isUnlocked) {
    return (
      <PairingGate
        onUnlock={handleUnlock}
        isUnlocking={isUnlocking}
        errorMessage={unlockError}
      />
    );
  }

  return <NotesApp initialDocuments={initialDocuments} />;
}

export default App;
