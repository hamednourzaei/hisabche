'use client'

// The article editor: Tiptap (MIT) with the project's own vocabulary.
//
// Fonts and sizes come from @hisabche/validation — the SAME lists the server
// sanitiser keeps (backend/src/services/blog/blog.sanitize.ts). No colour
// picker, no free font family: what the author can make is exactly what the
// site will show. Images require alt text before they are inserted.
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { BLOG_FONT_FAMILIES, BLOG_FONT_SIZES, type BlogLocale } from '@hisabche/validation'
import { apiErrorMessage } from '@hisabche/api'

import { Button, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAdminBlogPosts, useUploadBlogImage } from '@/hooks/use-admin-blog'

export interface BlogEditorChange {
  html: string
  json: Record<string, unknown>
}

export function BlogEditor({
  locale,
  initialContent,
  onChange,
}: {
  locale: BlogLocale
  initialContent: Record<string, unknown> | null
  onChange: (value: BlogEditorChange) => void
}) {
  const t = useTranslations()
  const dir = locale === 'en' ? 'ltr' : 'rtl'

  const editor = useEditor({
    // Next renders this client component on the server too; Tiptap must not
    // build its DOM there (hydration mismatch).
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      TextStyle,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: false, allowBase64: false }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: t('admin.blog.editor.placeholder') }),
      CharacterCount,
    ],
    content: (initialContent as JSONContent | null) ?? '',
    editorProps: {
      attributes: {
        dir,
        class: 'blog-prose min-h-[420px] max-w-none px-4 py-3 focus:outline-none',
      },
    },
    onUpdate: ({ editor: e }) =>
      onChange({ html: e.getHTML(), json: e.getJSON() as Record<string, unknown> }),
  })

  if (!editor) {
    return (
      <div className="min-h-[480px] rounded-2xl border border-border bg-card" aria-busy="true" />
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <Toolbar editor={editor} locale={locale} />
      <EditorContent editor={editor} />
      <WordCount editor={editor} />
    </div>
  )
}

function WordCount({ editor }: { editor: Editor }) {
  const t = useTranslations()
  const words = useEditorState({
    editor,
    selector: (s) => s.editor.storage.characterCount.words() as number,
  })
  return (
    <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
      {t('admin.blog.editor.words', { count: words })}
    </p>
  )
}

function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40',
        active && 'bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor, locale }: { editor: Editor; locale: BlogLocale }) {
  const t = useTranslations()
  const [panel, setPanel] = useState<'link' | 'image' | null>(null)

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      h4: e.isActive('heading', { level: 4 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      codeBlock: e.isActive('codeBlock'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      table: e.isActive('table'),
      image: e.isActive('image'),
      imageAlt: (e.getAttributes('image').alt as string | undefined) ?? '',
      fontFamily: (e.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
      fontSize: (e.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  const chain = () => editor.chain().focus()
  const label = (key: string) => t(`admin.blog.editor.${key}`)

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-0.5 p-2">
        <ToolButton
          label={label('undo')}
          disabled={!state.canUndo}
          onClick={() => chain().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('redo')}
          disabled={!state.canRedo}
          onClick={() => chain().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <ToolButton
          label={label('h2')}
          active={state.h2}
          onClick={() => chain().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('h3')}
          active={state.h3}
          onClick={() => chain().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('h4')}
          active={state.h4}
          onClick={() => chain().toggleHeading({ level: 4 }).run()}
        >
          <Heading4 className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <ToolButton
          label={label('bold')}
          active={state.bold}
          onClick={() => chain().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('italic')}
          active={state.italic}
          onClick={() => chain().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('underline')}
          active={state.underline}
          onClick={() => chain().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('strike')}
          active={state.strike}
          onClick={() => chain().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('code')}
          active={state.code}
          onClick={() => chain().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <ToolButton
          label={label('bulletList')}
          active={state.bullet}
          onClick={() => chain().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('orderedList')}
          active={state.ordered}
          onClick={() => chain().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('quote')}
          active={state.quote}
          onClick={() => chain().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('codeBlock')}
          active={state.codeBlock}
          onClick={() => chain().toggleCodeBlock().run()}
        >
          <SquareCode className="h-4 w-4" />
        </ToolButton>
        <ToolButton label={label('hr')} onClick={() => chain().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <ToolButton
          label={label('link')}
          active={state.link || panel === 'link'}
          onClick={() => setPanel(panel === 'link' ? null : 'link')}
        >
          <Link2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('image')}
          active={state.image || panel === 'image'}
          onClick={() => setPanel(panel === 'image' ? null : 'image')}
        >
          <ImagePlus className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={label('table')}
          active={state.table}
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon className="h-4 w-4" />
        </ToolButton>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-2 py-2 text-xs">
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground">{label('font')}</span>
          <select
            className="h-8 rounded-lg border border-border bg-background px-2"
            value={state.fontFamily}
            onChange={(e) =>
              e.target.value
                ? chain().setFontFamily(e.target.value).run()
                : chain().unsetFontFamily().run()
            }
          >
            <option value="">{label('fontDefault')}</option>
            {Object.entries(BLOG_FONT_FAMILIES).map(([key, value]) => (
              <option key={key} value={value}>
                {label(`fonts.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground">{label('size')}</span>
          <select
            className="h-8 rounded-lg border border-border bg-background px-2"
            value={state.fontSize}
            onChange={(e) =>
              e.target.value
                ? chain().setFontSize(e.target.value).run()
                : chain().unsetFontSize().run()
            }
          >
            <option value="">{label('sizeDefault')}</option>
            {BLOG_FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <span className="text-muted-foreground">{label('direction')}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => chain().setTextDirection('rtl').run()}
        >
          {label('rtl')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => chain().setTextDirection('ltr').run()}
        >
          {label('ltr')}
        </Button>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <ToolButton label={label('alignStart')} onClick={() => chain().setTextAlign('start').run()}>
          {locale === 'en' ? <AlignLeft className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
        </ToolButton>
        <ToolButton
          label={label('alignCenter')}
          onClick={() => chain().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolButton>
        <ToolButton label={label('alignEnd')} onClick={() => chain().setTextAlign('end').run()}>
          {locale === 'en' ? <AlignRight className="h-4 w-4" /> : <AlignLeft className="h-4 w-4" />}
        </ToolButton>
        <ToolButton
          label={label('alignJustify')}
          onClick={() => chain().setTextAlign('justify').run()}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolButton>
        {state.table ? (
          <>
            <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => chain().addRowAfter().run()}
            >
              {label('addRow')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => chain().addColumnAfter().run()}
            >
              {label('addColumn')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => chain().deleteRow().run()}
            >
              {label('deleteRow')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => chain().deleteColumn().run()}
            >
              {label('deleteColumn')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => chain().deleteTable().run()}
            >
              {label('deleteTable')}
            </Button>
          </>
        ) : null}
        {state.image ? <ImageAltEditor editor={editor} alt={state.imageAlt} /> : null}
      </div>

      {panel === 'link' ? (
        <LinkPanel editor={editor} locale={locale} onDone={() => setPanel(null)} />
      ) : null}
      {panel === 'image' ? <ImagePanel editor={editor} onDone={() => setPanel(null)} /> : null}
    </div>
  )
}

/** Alt text of the selected image — editable, and required. */
function ImageAltEditor({ editor, alt }: { editor: Editor; alt: string }) {
  const t = useTranslations()
  const [value, setValue] = useState(alt)
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim())
          editor.chain().focus().updateAttributes('image', { alt: value.trim() }).run()
      }}
    >
      <Input
        className="h-8 w-56"
        value={value}
        required
        aria-label={t('admin.blog.editor.imageAlt')}
        placeholder={t('admin.blog.editor.imageAlt')}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button type="submit" size="sm">
        {t('admin.blog.editor.apply')}
      </Button>
    </form>
  )
}

/**
 * A link: an article of this blog (searched, same language, published) or any
 * URL. Internal links are stored with the locale prefix; the server still
 * checks and adds `nofollow` for links into the app.
 */
function LinkPanel({
  editor,
  locale,
  onDone,
}: {
  editor: Editor
  locale: BlogLocale
  onDone: () => void
}) {
  const t = useTranslations()
  const [href, setHref] = useState((editor.getAttributes('link').href as string | undefined) ?? '')
  const [query, setQuery] = useState('')
  const search = useAdminBlogPosts({
    locale,
    status: 'published',
    q: query || undefined,
    page: 0,
    pageSize: 8,
  })

  const apply = (url: string) => {
    const chain = editor.chain().focus().extendMarkRange('link')
    if (url.trim()) chain.setLink({ href: url.trim() }).run()
    else chain.unsetLink().run()
    onDone()
  }

  return (
    <div className="space-y-2 border-t border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          dir="ltr"
          className="h-9 min-w-64 flex-1"
          value={href}
          placeholder="https://… /fa/blog/…"
          aria-label={t('admin.blog.editor.linkUrl')}
          onChange={(e) => setHref(e.target.value)}
        />
        <Button type="button" size="sm" onClick={() => apply(href)}>
          {t('admin.blog.editor.apply')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => apply('')}>
          {t('admin.blog.editor.unlink')}
        </Button>
      </div>
      <Input
        className="h-9"
        value={query}
        placeholder={t('admin.blog.editor.searchArticles')}
        aria-label={t('admin.blog.editor.searchArticles')}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {(search.data?.posts ?? []).map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="w-full rounded-lg px-2 py-1 text-start hover:bg-accent"
              onClick={() => apply(`/${locale}/blog/${p.slug}`)}
            >
              {p.title}{' '}
              <span className="text-xs text-muted-foreground" dir="ltr">
                /{locale}/blog/{p.slug}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ImagePanel({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const t = useTranslations()
  const upload = useUploadBlogImage()
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t border-border p-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        if (!file || !alt.trim()) return
        setError(null)
        upload.mutate(file, {
          onSuccess: (url) => {
            editor.chain().focus().setImage({ src: url, alt: alt.trim() }).run()
            onDone()
          },
          onError: (err) => setError(apiErrorMessage(err, t('admin.blog.errors.upload'))),
        })
      }}
    >
      <label className="space-y-1">
        <span className="block text-xs text-muted-foreground">
          {t('admin.blog.editor.imageFile')}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <label className="flex-1 space-y-1">
        <span className="block text-xs text-muted-foreground">
          {t('admin.blog.editor.imageAlt')}
        </span>
        <Input value={alt} required onChange={(e) => setAlt(e.target.value)} />
      </label>
      <Button type="submit" size="sm" disabled={upload.isPending || !file || !alt.trim()}>
        {upload.isPending ? t('admin.blog.editor.uploading') : t('admin.blog.editor.insertImage')}
      </Button>
      {error ? (
        <p role="alert" className="w-full text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
