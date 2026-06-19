import { apiBaseUrl } from '@/app/lib/api';
import { Comments } from '@/components/blog/comments';
import { LikeButton } from '@/components/blog/like-button';
import { alternatesFor } from '@/lib/i18n/metadata';
import { getSeoContent } from '@/lib/seo/fetch';
import { JsonLd } from '@/lib/seo/json-ld';
import { blogPostingJsonLd } from '@/lib/seo/jsonld';
import { siteUrl } from '@/lib/seo/site';
import { getActiveTheme } from '@/themes/active-theme';
import { type CommentThread, commentThreadSchema, postDetailSchema } from '@typress/config';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLikeState } from './like-actions';

export const dynamic = 'force-dynamic';

const EMPTY_THREAD: CommentThread = { items: [], total: 0 };

async function getPost(slug: string) {
  try {
    const res = await fetch(`${apiBaseUrl}/public/posts/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const parsed = postDetailSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function getComments(slug: string): Promise<CommentThread> {
  try {
    const res = await fetch(`${apiBaseUrl}/public/posts/${encodeURIComponent(slug)}/comments`, {
      cache: 'no-store',
    });
    if (!res.ok) return EMPTY_THREAD;
    const parsed = commentThreadSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : EMPTY_THREAD;
  } catch {
    return EMPTY_THREAD;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: alternatesFor(locale, `/blog/${post.slug}`),
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt ?? undefined,
      url: `${siteUrl}/blog/${post.slug}`,
      publishedTime: post.publishedAt ?? undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, { Layout, BlogPost }, { profile }, thread, like] = await Promise.all([
    getPost(slug),
    getActiveTheme(),
    getSeoContent(),
    getComments(slug),
    getLikeState(slug),
  ]);
  if (!post) notFound();

  return (
    <>
      <JsonLd
        data={blogPostingJsonLd(
          {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            publishedAt: post.publishedAt,
            authorName: post.author?.name ?? null,
          },
          profile,
          siteUrl,
        )}
      />
      <Layout>
        <BlogPost post={post} />
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 1.5rem 4rem' }}>
          <LikeButton
            slug={post.slug}
            initialLikes={like.state.likes}
            initialLiked={like.state.liked}
            signedIn={like.signedIn}
          />
          <Comments slug={post.slug} initialThread={thread} />
        </div>
      </Layout>
    </>
  );
}
