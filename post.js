/**
 * ==========================================================================
 * INDIVIDUAL BLOG ARTICLE PAGE
 * Reads ?slug=... from the URL and renders that post from the shared
 * data layer (data.js / Supabase).
 * ==========================================================================
 */

const THEME_KEY = 'drew-theme';

document.addEventListener('DOMContentLoaded', async () => {
    initThemeToggle();
    await loadPost();
});

function initThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateIcon(savedTheme);

    if (!toggleBtn) return;
    toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(THEME_KEY, next);
        updateIcon(next);
    });
}

function updateIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

async function loadPost() {
    const cont = document.getElementById('post-content');
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');

    if (!slug) {
        cont.innerHTML = backLink() + '<p>No article specified.</p>';
        return;
    }

    const post = await getBlogPostBySlug(slug);

    if (!post || post.status !== 'published') {
        cont.innerHTML = backLink() + '<p>This article could not be found — it may have been unpublished or moved.</p>';
        return;
    }

    document.title = `${post.title} | Kandy Services`;
    setMeta('post-meta-description', post.meta_description || post.excerpt || '');
    setMeta('post-og-title', post.title);
    setMeta('post-og-description', post.excerpt || '');
    setMeta('post-og-image', post.featured_image_url || '');

    const dateLabel = post.published_at
        ? new Date(post.published_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
        : '';
    const catLabel = post.blog_categories ? post.blog_categories.name : null;
    const tags = (post.blog_post_tags || []).map(t => t.blog_tags.name);

    cont.innerHTML = `
        ${backLink()}
        <div class="post-article-meta">${escapeHtml(dateLabel)} • ${escapeHtml(post.author)}${catLabel ? ' • ' + escapeHtml(catLabel) : ''}</div>
        <h1 class="post-article-title">${escapeHtml(post.title)}</h1>
        ${post.featured_image_url ? `<img src="${post.featured_image_url}" alt="${escapeHtml(post.title)}" class="post-article-image">` : ''}
        <div class="post-article-body">${escapeHtml(post.content)}</div>
        ${tags.length ? `<div class="post-article-tags">${tags.map(t => `<span class="post-tag-pill">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    `;
}

function backLink() {
    return `<a href="index.html#tech-hub" class="post-back-link"><i class="fa-solid fa-arrow-left"></i> Back to Tech Hub</a>`;
}

function setMeta(id, value) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('content', value);
}

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
