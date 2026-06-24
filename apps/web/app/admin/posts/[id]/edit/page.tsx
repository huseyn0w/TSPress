import { PostForm } from '@/components/admin/post-form';
import { apiGet } from '@/lib/admin/api';
import type { CategoryView, TagView } from '@/types/content';
import { postDetailSchema } from '@cmstack-ts/config';
import type { PostDetail } from '@cmstack-ts/config';
import { notFound } from 'next/navigation';
import { updatePostAction } from '../../actions';

export const dynamic = 'force-dynamic';

async function fetchPost(id: string): Promise<PostDetail | null> {
  try {
    return await apiGet(`/posts/${id}`, postDetailSchema);
  } catch {
    return null;
  }
}

async function fetchCategories(): Promise<CategoryView[]> {
  try {
    return await apiGet<CategoryView[]>('/categories');
  } catch {
    return [];
  }
}

async function fetchTags(): Promise<TagView[]> {
  try {
    return await apiGet<TagView[]>('/tags');
  } catch {
    return [];
  }
}

interface EditPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const [post, categories, tags] = await Promise.all([
    fetchPost(id),
    fetchCategories(),
    fetchTags(),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <PostForm post={post} categories={categories} tags={tags} updateAction={updatePostAction} />
  );
}
