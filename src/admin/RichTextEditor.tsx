import { Extension } from "@tiptap/core";
import Bold from "@tiptap/extension-bold";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { UndoRedo } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useId, useRef, useState } from "react";
import { langFor } from "../lib/bangla";
import { BIJOY_WARNING, cleanPastedHtml, looksLikeBijoy, sanitizeRichText } from "../lib/richText";
import { Button } from "./ui/Button";
import styles from "./RichTextEditor.module.css";

type RichTextEditorProps = {
  label: string;
  value: string;
  onChange: (html: string) => void;
  error?: string;
};

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

/** "example.org/page" -> "https://example.org/page"; null if it can't be a safe link */
function normaliseLink(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (SAFE_LINK.test(value)) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value)) return `https://${value}`;
  return null;
}

/**
 * Story copy editor: paragraphs, bold, italic, and links, nothing else, so
 * every page keeps the newspaper look. Pasting from Word keeps those and drops
 * the rest; the schema has nowhere to put fonts, colours, or headings.
 */
export function RichTextEditor({ label, value, onChange, error }: RichTextEditorProps) {
  const labelId = useId();
  const linkInputId = useId();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [bijoy, setBijoy] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);

  function openLink() {
    if (!editor) return;
    setLinkValue(editor.getAttributes("link").href ?? "");
    setLinkError(null);
    setLinkOpen(true);
    requestAnimationFrame(() => linkInput.current?.focus());
  }

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      HardBreak,
      UndoRedo,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        protocols: ["mailto"],
        isAllowedUri: (url) => SAFE_LINK.test(url),
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Extension.create({
        name: "linkShortcut",
        addKeyboardShortcuts: () => ({
          "Mod-k": () => {
            openLink();
            return true;
          },
        }),
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: styles.content,
        "aria-labelledby": labelId,
        "aria-multiline": "true",
        role: "textbox",
      },
      transformPastedHTML: cleanPastedHtml,
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const isBijoy = looksLikeBijoy(text);
        setBijoy(isBijoy);
        return isBijoy; // true stops the paste
      },
    },
    onUpdate: ({ editor }) => {
      const html = sanitizeRichText(editor.getHTML());
      editor.view.dom.setAttribute("lang", langFor(html) ?? "");
      onChange(html);
    },
    onCreate: ({ editor }) => {
      editor.view.dom.setAttribute("lang", langFor(value) ?? "");
    },
  });

  const marks = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      link: editor?.isActive("link") ?? false,
    }),
  });

  function applyLink() {
    if (!editor) return;
    const href = normaliseLink(linkValue);
    if (!href) {
      setLinkError("Use a web address (https://…) or an email address.");
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      // Nothing selected: insert the address itself as the link text
      chain.insertContent({ type: "text", text: linkValue.trim(), marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    setLinkOpen(false);
  }

  const message = error ?? (bijoy ? BIJOY_WARNING : undefined);

  return (
    <div className={styles.field}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div className={styles.toolbar} role="toolbar" aria-label={`${label} formatting`}>
        <Button
          size="sm"
          aria-pressed={marks?.bold}
          title="Bold (Ctrl+B)"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <strong>Bold</strong>
        </Button>
        <Button
          size="sm"
          aria-pressed={marks?.italic}
          title="Italic (Ctrl+I)"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <em>Italic</em>
        </Button>
        <Button size="sm" aria-pressed={marks?.link} title="Link (Ctrl+K)" onClick={openLink}>
          Link
        </Button>
        <Button
          size="sm"
          disabled={!marks?.link}
          onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}
        >
          Remove link
        </Button>
      </div>

      {linkOpen && (
        // Not a <form>: it sits inside the issue form, and a nested form would submit the issue
        <div className={styles.linkForm} role="group" aria-label="Link">
          <label htmlFor={linkInputId} className={styles.label}>
            Link address
          </label>
          <input
            id={linkInputId}
            ref={linkInput}
            className={styles.linkInput}
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.org"
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setLinkOpen(false);
                editor?.commands.focus();
              }
            }}
            aria-invalid={linkError ? true : undefined}
          />
          {linkError && (
            <p className={styles.error} role="alert">
              {linkError}
            </p>
          )}
          <div className={styles.linkActions}>
            <Button size="sm" variant="primary" onClick={applyLink}>
              Add link
            </Button>
            <Button size="sm" onClick={() => (setLinkOpen(false), editor?.commands.focus())}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className={styles.box} data-invalid={message ? true : undefined}>
        <EditorContent editor={editor} />
      </div>
      <p className={styles.hint}>Paste from Word keeps paragraphs, bold, italic and links.</p>
      {message && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
