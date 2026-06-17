import { PostForm } from '@/components/admin/post-form';
import { apiGet } from '@/lib/admin/api';
import type { CategoryView, TagView } from '@/types/content';
import { createPostAction } from '../actions';

export const dynamic = 'force-dynamic';

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

export default async function NewPostPage() {
  const [categories, tags] = await Promise.all([fetchCategories(), fetchTags()]);

  return <PostForm categories={categories} tags={tags} createAction={createPostAction} />;
}
