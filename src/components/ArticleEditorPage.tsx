import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Sparkles, 
  Globe, 
  Tag, 
  Image as ImageIcon, 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  List, 
  ListOrdered, 
  Quote, 
  Heading1, 
  Heading2, 
  Heading3, 
  Undo, 
  Redo, 
  Link as LinkIcon, 
  Check, 
  AlertCircle,
  FileText,
  Clock,
  Layers,
  Sparkle,
  Upload,
  UploadCloud,
  Loader2,
  CheckCircle2,
  ImagePlus
} from 'lucide-react';
import { Post, ContentVertical, PublicationStatus, UserProfile } from '../types';
import { normalizeImageUrl } from '../lib/router';
import { compressImage, formatBytes } from '../lib/imageCompression';

interface ArticleEditorPageProps {
  post: Partial<Post> | null;
  currentUser: UserProfile | null;
  onSave: (postData: Partial<Post>) => Promise<{ success: boolean; error?: string } | void> | void;
  onCancel: () => void;
}

export const ArticleEditorPage: React.FC<ArticleEditorPageProps> = ({
  post,
  currentUser,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [isSlugUserEdited, setIsSlugUserEdited] = useState(Boolean(post?.slug));
  const [locale, setLocale] = useState(post?.locale || 'en-us');
  const [vertical, setVertical] = useState<ContentVertical>(post?.vertical || 'finance');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [status, setStatus] = useState<PublicationStatus>(post?.status || 'draft');
  const [coverImage, setCoverImage] = useState(
    normalizeImageUrl(post?.cover_image) || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200'
  );
  const [tagsInput, setTagsInput] = useState(post?.tags ? post.tags.join(', ') : 'Finance, Tech, Market Analysis');
  const [dualSilo, setDualSilo] = useState(Boolean(post?.dual_silo));
  const [authorName, setAuthorName] = useState(post?.author_name || currentUser?.full_name || 'Startup Crème Editorial');
  const [authorRole, setAuthorRole] = useState(post?.author_role || 'Senior Analyst');
  const [metaDescription, setMetaDescription] = useState(post?.meta_description || '');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Cloudflare R2 Upload States
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadCoverError, setUploadCoverError] = useState<string | null>(null);
  const [uploadCoverSuccess, setUploadCoverSuccess] = useState(false);
  const [uploadCoverStorage, setUploadCoverStorage] = useState<'r2' | 'local' | null>(null);
  const [uploadCoverMessage, setUploadCoverMessage] = useState<string | null>(null);
  const [uploadingInline, setUploadingInline] = useState(false);

  // Initialize Tiptap Editor
  const initialContent = React.useMemo(() => {
    if (!post?.content) {
      return '<p></p>';
    }
    if (typeof post.content === 'string') {
      return post.content;
    }
    // If it's a JSON doc object
    return post.content;
  }, [post]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Write your story or editorial content here... Use headers, quotes, lists, or images to build a high-impact publication.',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-cyan-600 underline font-medium hover:text-cyan-700',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl border border-slate-200 my-6 shadow-sm max-w-full h-auto',
        },
      }),
    ],
    content: initialContent,
  });

  // Calculate word count & reading time
  const textContent = editor?.getText() || '';
  const wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // Auto generate slug from title if not manually edited
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!isSlugUserEdited) {
      const generatedSlug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setSlug(generatedSlug);
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value);
    setIsSlugUserEdited(true);
  };

  const handleSaveArticle = async (saveStatus: PublicationStatus = status) => {
    if (!title.trim()) {
      alert('Please enter an article title.');
      return;
    }
    if (!slug.trim()) {
      alert('Please enter an article slug.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const htmlContent = editor?.getHTML() || '';
    const tagsArray = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const postPayload: Partial<Post> = {
      ...post,
      title: title.trim(),
      slug: slug.trim(),
      locale,
      vertical,
      excerpt: excerpt.trim(),
      content: htmlContent, // Saves rich HTML from Tiptap
      status: saveStatus,
      cover_image: normalizeImageUrl(coverImage.trim()),
      tags: tagsArray.length > 0 ? tagsArray : ['Editorial'],
      dual_silo: dualSilo,
      author_name: authorName,
      author_role: authorRole,
      author_avatar: currentUser?.avatar_url || post?.author_avatar,
      meta_description: metaDescription.trim() || excerpt.trim(),
      reading_time_minutes: readingTime,
      word_count: wordCount,
    };

    try {
      const result = await onSave(postPayload);
      if (result && !result.success && result.error) {
        setSaving(false);
        setSaveError(result.error);
        return;
      }
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onCancel();
      }, 1000);
    } catch (err: any) {
      setSaving(false);
      setSaveError(err?.message || 'Error saving article to database');
    }
  };

  const uploadFileToR2 = async (rawFile: File): Promise<{
    url: string;
    isR2: boolean;
    storage: 'r2' | 'local';
    note?: string;
  }> => {
    let fileToUpload = rawFile;
    let compressionInfo = '';

    // Automatically resize & compress image before network upload (WebP, max 1920x1920)
    try {
      const compressed = await compressImage(rawFile, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.82,
        mimeType: 'image/webp',
      });
      fileToUpload = compressed.file;

      if (compressed.originalSize > compressed.compressedSize) {
        compressionInfo = `Optimized image (${compressed.ratio}): ${formatBytes(compressed.originalSize)} → ${formatBytes(compressed.compressedSize)}`;
        console.log(`[Image Optimization] ${compressionInfo}`);
      }
    } catch (compressErr) {
      console.warn('Image compression skipped, proceeding with original file:', compressErr);
    }

    try {
      const formData = new FormData();
      formData.append('image', fileToUpload);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        // non-json response
      }

      if (response.ok && data.success && data.url) {
        const serverMsg = data.message || (data.storage === 'r2' ? 'Uploaded to Cloudflare R2' : 'Uploaded to server storage');
        const finalNote = compressionInfo ? `${compressionInfo}. ${serverMsg}` : serverMsg;

        return {
          url: data.url,
          isR2: data.storage === 'r2',
          storage: data.storage === 'r2' ? 'r2' : 'local',
          note: finalNote,
        };
      }

      const serverError = data.error || (response.status !== 200 ? `Server status ${response.status}` : 'Upload failed');
      
      // Fallback to Data URL for instant preview without blocking the user
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          resolve({
            url: dataUrl,
            isR2: false,
            storage: 'local',
            note: compressionInfo ? `${compressionInfo}. ${serverError}` : serverError,
          });
        };
        reader.onerror = () => {
          resolve({
            url: URL.createObjectURL(fileToUpload),
            isR2: false,
            storage: 'local',
            note: serverError,
          });
        };
        reader.readAsDataURL(fileToUpload);
      });
    } catch (err: any) {
      // Network error or server unreachable: fallback to local Data URL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          resolve({
            url: dataUrl,
            isR2: false,
            storage: 'local',
            note: err?.message || 'Network error attempting to reach upload endpoint',
          });
        };
        reader.onerror = () => {
          resolve({
            url: URL.createObjectURL(fileToUpload),
            isR2: false,
            storage: 'local',
            note: err?.message || 'Error processing local file',
          });
        };
        reader.readAsDataURL(fileToUpload);
      });
    }
  };

  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    setUploadCoverError(null);
    setUploadCoverSuccess(false);
    setUploadCoverMessage(null);

    try {
      const res = await uploadFileToR2(file);
      setCoverImage(res.url);
      setUploadCoverStorage(res.storage);
      setUploadCoverMessage(res.note || null);
      setUploadCoverSuccess(true);
      setTimeout(() => setUploadCoverSuccess(false), 8000);
    } catch (err: any) {
      setUploadCoverError(err.message || 'Error uploading file');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleInlineFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingInline(true);
    try {
      const res = await uploadFileToR2(file);
      if (editor) {
        editor.chain().focus().setImage({ src: res.url }).run();
      }
      if (!res.isR2 && res.note) {
        console.warn('R2 upload unconfigured, used local Data URL:', res.note);
      }
    } catch (err: any) {
      alert(`Image Upload Error: ${err.message || 'Upload failed'}`);
    } finally {
      setUploadingInline(false);
      e.target.value = '';
    }
  };

  const addImagePrompt = () => {
    const choice = window.confirm('Click OK to upload an image from your device to Cloudflare R2, or Cancel to enter an Image URL directly.');
    if (choice) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => handleInlineFileUpload(e as any);
      input.click();
    } else {
      const url = window.prompt('Enter Image URL:');
      if (url && editor) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }
  };

  const addLinkPrompt = () => {
    const previousUrl = editor?.getAttributes('link').href;
    const url = window.prompt('Enter Link URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      {/* Top Bar Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-serif text-base font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                {title || 'Untitled Article'}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-4 text-xs text-slate-500 font-mono border-r border-slate-200 pr-4">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>{wordCount} words</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{readingTime} min read</span>
              </span>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveArticle('draft')}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveArticle('published')}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-2"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved to DB!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Publish Article</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {saveError && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-900 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-bold block text-sm mb-1">Supabase Database Error</span>
              <p>{saveError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left / Main Column - Editor & Core Fields */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Title Input Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
            <input
              type="text"
              placeholder="Article Title..."
              value={title}
              onChange={handleTitleChange}
              className="w-full text-2xl sm:text-4xl font-serif font-bold text-slate-900 border-none outline-none placeholder:text-slate-300 bg-transparent mb-4"
            />

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono border-t border-slate-100 pt-4">
              <span className="text-slate-400 font-sans font-semibold">Slug:</span>
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder="article-url-slug"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-cyan-800 font-mono focus:bg-white focus:border-cyan-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Excerpt Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Article Excerpt & Meta Description
            </label>
            <textarea
              rows={2}
              placeholder="Provide a compelling 1-2 sentence preview summary of this publication for cards and search engine results..."
              value={excerpt}
              onChange={(e) => {
                setExcerpt(e.target.value);
                if (!metaDescription) setMetaDescription(e.target.value);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-cyan-500 outline-none resize-y"
            />
          </div>

          {/* Tiptap Professional Rich Text Editor */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[500px]">
            {/* Toolbar */}
            <div className="bg-slate-50 border-b border-slate-200 p-2 sm:p-3 flex flex-wrap items-center gap-1 sm:gap-1.5 sticky top-0 z-20">
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-2 rounded-lg text-xs font-bold flex items-center transition-colors ${
                  editor?.isActive('heading', { level: 1 }) ? 'bg-cyan-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded-lg text-xs font-bold flex items-center transition-colors ${
                  editor?.isActive('heading', { level: 2 }) ? 'bg-cyan-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-2 rounded-lg text-xs font-bold flex items-center transition-colors ${
                  editor?.isActive('heading', { level: 3 }) ? 'bg-cyan-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Heading 3"
              >
                <Heading3 className="w-4 h-4" />
              </button>

              <div className="h-5 w-px bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={`p-2 rounded-lg transition-colors ${
                  editor?.isActive('bold') ? 'bg-cyan-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={`p-2 rounded-lg transition-colors ${
                  editor?.isActive('italic') ? 'bg-cyan-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleStrike().run()}
                className={`p-2 rounded-lg transition-colors ${
                  editor?.isActive('strike') ? 'bg-cyan-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Strikethrough"
              >
                <Strikethrough className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleCode().run()}
                className={`p-2 rounded-lg transition-colors ${
                  editor?.isActive('code') ? 'bg-cyan-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Inline Code"
              >
                <Code className="w-4 h-4" />
              </button>

              <div className="h-5 w-px bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded-lg transition-colors ${
                  editor?.isActive('bulletList') ? 'bg-cyan-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded-lg transition-colors ${
                  editor?.isActive('orderedList') ? 'bg-cyan-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                className={`p-2 rounded-lg transition-colors ${
                  editor?.isActive('blockquote') ? 'bg-cyan-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>

              <div className="h-5 w-px bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={addLinkPrompt}
                className={`p-2 rounded-lg transition-colors ${
                  editor?.isActive('link') ? 'bg-cyan-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Insert Link"
              >
                <LinkIcon className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={addImagePrompt}
                className="p-2 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
                title="Insert Image"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <div className="h-5 w-px bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => editor?.chain().focus().undo().run()}
                className="p-2 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
                title="Undo"
              >
                <Undo className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor?.chain().focus().redo().run()}
                className="p-2 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
                title="Redo"
              >
                <Redo className="w-4 h-4" />
              </button>
            </div>

            {/* Editor Workspace Container */}
            <div className="p-6 sm:p-8 flex-1 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
              <style>{`
                .tiptap {
                  min-height: 380px;
                  outline: none;
                }
                .tiptap p.is-editor-empty:first-child::before {
                  color: #94a3b8;
                  content: attr(data-placeholder);
                  float: left;
                  height: 0;
                  pointer-events: none;
                }
                .tiptap h1 {
                  font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
                  font-size: 1.875rem;
                  font-weight: 700;
                  margin-top: 1.5rem;
                  margin-bottom: 0.75rem;
                  color: #0f172a;
                }
                .tiptap h2 {
                  font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
                  font-size: 1.5rem;
                  font-weight: 700;
                  margin-top: 1.25rem;
                  margin-bottom: 0.5rem;
                  color: #0f172a;
                  border-bottom: 1px solid #e2e8f0;
                  padding-bottom: 0.5rem;
                }
                .tiptap h3 {
                  font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
                  font-size: 1.25rem;
                  font-weight: 700;
                  margin-top: 1rem;
                  margin-bottom: 0.5rem;
                  color: #0f172a;
                }
                .tiptap p {
                  font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
                  font-size: 1.125rem;
                  line-height: 1.75rem;
                  margin-bottom: 1.25rem;
                  color: #1e293b;
                }
                .tiptap ul {
                  list-style-type: disc;
                  padding-left: 1.5rem;
                  margin-bottom: 1.25rem;
                }
                .tiptap ol {
                  list-style-type: decimal;
                  padding-left: 1.5rem;
                  margin-bottom: 1.25rem;
                }
                .tiptap blockquote {
                  border-left: 4px solid #0891b2;
                  padding-left: 1rem;
                  font-style: italic;
                  margin-bottom: 1.25rem;
                  color: #334155;
                }
                .tiptap code {
                  background-color: #f1f5f9;
                  padding: 0.2rem 0.4rem;
                  border-radius: 0.25rem;
                  font-family: monospace;
                  font-size: 0.875em;
                }
              `}</style>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Right Column - Article Metadata & Settings */}
        <div className="lg:col-span-4 space-y-6">
          {/* Publication Settings Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="font-serif text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-600" />
              <span>Publication Settings</span>
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Publication Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PublicationStatus)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:bg-white"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="outdated_translation">Outdated Translation</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vertical *</label>
                <select
                  value={vertical}
                  onChange={(e) => setVertical(e.target.value as ContentVertical)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:bg-white"
                >
                  <option value="finance">Finance</option>
                  <option value="tech">Tech</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Locale *</label>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-mono font-semibold focus:bg-white"
                >
                  <option value="en-us">en-us</option>
                  <option value="en-gb">en-gb</option>
                  <option value="de-de">de-de</option>
                  <option value="ja-jp">ja-jp</option>
                  <option value="fr-fr">fr-fr</option>
                </select>
              </div>
            </div>

            {/* Dual Silo Toggle */}
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2.5 text-xs font-bold text-purple-800 cursor-pointer p-2.5 rounded-xl bg-purple-50/60 hover:bg-purple-50 transition-colors">
                <input
                  type="checkbox"
                  checked={dualSilo}
                  onChange={(e) => setDualSilo(e.target.checked)}
                  className="rounded bg-white border-purple-300 text-purple-600 focus:ring-0 w-4 h-4"
                />
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Dual Silo (Visible in both Finance & Tech)</span>
              </label>
            </div>
          </div>

          {/* Cover Image Settings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4.5 h-4.5 text-cyan-600" />
                <span>Cover Image</span>
              </h3>
              <span className="text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <UploadCloud className="w-3 h-3 text-cyan-600" />
                <span>Cloudflare R2</span>
              </span>
            </div>

            {/* Select image from device button */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Select Image from Device</label>
              <label className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                uploadingCover 
                  ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed' 
                  : 'bg-cyan-50/50 hover:bg-cyan-50 border-cyan-300 hover:border-cyan-400 text-cyan-900'
              }`}>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingCover}
                  onChange={handleCoverFileUpload}
                  className="hidden"
                />
                {uploadingCover ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
                    <span className="text-xs font-bold text-slate-700">Uploading to Cloudflare R2...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-cyan-600" />
                    <span className="text-xs font-bold">Choose File & Upload to R2</span>
                  </>
                )}
              </label>
            </div>

            {/* Upload Feedback */}
            {uploadCoverSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-0.5">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {uploadCoverStorage === 'r2'
                      ? 'Image optimized & uploaded to Cloudflare R2!'
                      : 'Cover image uploaded and ready!'}
                  </span>
                </div>
                {uploadCoverMessage && (
                  <p className="text-[11px] text-emerald-700 pl-6 leading-relaxed font-mono">
                    {uploadCoverMessage}
                  </p>
                )}
              </div>
            )}

            {uploadCoverError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Upload Failed</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-700">{uploadCoverError}</p>
                <p className="text-[10px] text-slate-500 font-mono pt-1">
                  Ensure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY & R2_BUCKET_NAME are configured in Settings environment variables.
                </p>
              </div>
            )}

            {/* Manual Image URL Input */}
            <div className="pt-2 border-t border-slate-100 space-y-1">
              <label className="block text-xs font-semibold text-slate-600">Or enter Image URL manually</label>
              <input
                type="text"
                placeholder="https://images.unsplash.com/..."
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:border-cyan-500 outline-none"
              />
            </div>

            {coverImage && (
              <div className="space-y-1">
                <span className="block text-[10px] font-bold uppercase text-slate-400">Cover Preview</span>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                  <img
                    src={normalizeImageUrl(coverImage)}
                    alt="Cover Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tags & Author Info */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="font-serif text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Tag className="w-4 h-4 text-cyan-600" />
              <span>Tags & Attribution</span>
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tags (Comma-separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Finance, Venture Capital, Tech"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Author Name</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Author Role</label>
                <input
                  type="text"
                  value={authorRole}
                  onChange={(e) => setAuthorRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
