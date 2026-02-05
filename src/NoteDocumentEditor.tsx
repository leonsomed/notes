import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import { type Block, type PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";

interface NoteDocumentEditorProps {
  initialContent: PartialBlock[] | undefined;
  onChange: (blocks: Block[]) => unknown;
  className?: string;
}

export function NoteDocumentEditor({
  initialContent,
  onChange,
  className,
}: NoteDocumentEditorProps) {
  const editor = useCreateBlockNote({ initialContent });

  return (
    <BlockNoteView
      theme="dark"
      editor={editor}
      className={className}
      onChange={() => {
        onChange(editor.document);
      }}
    />
  );
}
