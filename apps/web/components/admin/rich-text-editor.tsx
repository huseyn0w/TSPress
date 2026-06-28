'use client';

import { MediaPickerDialog } from '@/components/admin/media-picker-dialog';
import { cn } from '@/lib/utils';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react';
import { useState } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      className={cn(
        'inline-flex items-center justify-center h-7 w-7 rounded text-sm',
        'transition-colors duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-40',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" aria-hidden />;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      // Block images inserted from the media library. The API sanitizer keeps
      // only src/alt/title/width/height on <img> (http/https), so no class here.
      Image.configure({ inline: false }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Start writing…',
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate({ editor: ed }) {
      onChange(ed.getHTML());
    },
  });

  if (!editor) {
    return (
      <div className="min-h-[280px] rounded-md border border-input bg-muted/30 animate-pulse" />
    );
  }

  function handleSetLink() {
    const prev = editor?.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    // Only allow safe schemes (the API also sanitizes on save).
    if (!/^(https?:|mailto:|\/)/i.test(url)) {
      return;
    }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div className="rounded-md border border-input bg-transparent overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-colors duration-150">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Ordered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Blockquote"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={handleSetLink} isActive={editor.isActive('link')} title="Link">
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setPickerOpen(true)} title="Insert image">
          <ImagePlus className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="tiptap prose px-4 py-3 min-h-[280px] text-sm text-foreground focus:outline-none"
      />

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onInsert={({ src, alt }) => editor.chain().focus().setImage({ src, alt }).run()}
      />
    </div>
  );
}
