/**
 * ==========================================================================
 * SHARED DATA LAYER — Supabase-backed
 * Single source of truth for the public site (script.js) and the
 * Admin Dashboard (dashboard.js). Replaces the old localStorage version.
 * All functions that touch the network are async — call sites must await
 * them.
 * ==========================================================================
 */

const SUPABASE_URL = 'https://gcwmrwbotziizrptnzhq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjd21yd2JvdHppaXpycHRuemhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MTAwNjAsImV4cCI6MjEwNTA4NjA2MH0.eQZKzkkM_CGd5WmCy8VR5_iiFfEhBC80OS-qXNe4gCg';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Real brand icon presets (Font Awesome Brands 6.4.0) used for social links
   everywhere they appear (footer, hero, contact, dashboard). Static, so it
   stays a plain JS object rather than a database table. */
const PLATFORM_MAP = {
    linkedin:  { label: 'LinkedIn',      icon: 'fa-brands fa-linkedin-in' },
    github:    { label: 'GitHub',        icon: 'fa-brands fa-github' },
    x:         { label: 'X (Twitter)',   icon: 'fa-brands fa-x-twitter' },
    instagram: { label: 'Instagram',     icon: 'fa-brands fa-instagram' },
    facebook:  { label: 'Facebook',      icon: 'fa-brands fa-facebook-f' },
    youtube:   { label: 'YouTube',       icon: 'fa-brands fa-youtube' },
    tiktok:    { label: 'TikTok',        icon: 'fa-brands fa-tiktok' },
    whatsapp:  { label: 'WhatsApp',      icon: 'fa-brands fa-whatsapp' },
    behance:   { label: 'Behance',       icon: 'fa-brands fa-behance' },
    dribbble:  { label: 'Dribbble',      icon: 'fa-brands fa-dribbble' },
    medium:    { label: 'Medium',        icon: 'fa-brands fa-medium' },
    threads:   { label: 'Threads',       icon: 'fa-brands fa-threads' },
    telegram:  { label: 'Telegram',      icon: 'fa-brands fa-telegram' }
};

/* ==========================================================================
 * AUTH — dashboard admin login only. The public site never calls these.
 * ========================================================================== */
async function signInAdmin(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };

    const isAdmin = await currentUserIsAdmin();
    if (!isAdmin) {
        await supabaseClient.auth.signOut();
        return { ok: false, error: 'This account is not authorized for admin access.' };
    }
    return { ok: true, session: data.session };
}

async function signOutAdmin() {
    await supabaseClient.auth.signOut();
}

async function getSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
}

async function currentUserIsAdmin() {
    const { data: userData } = await supabaseClient.auth.getUser();
    if (!userData?.user) return false;
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .maybeSingle();
    if (error || !data) return false;
    return data.role === 'admin';
}

/* ==========================================================================
 * SITE CONFIG — profile, skills, services, projects, companies, social,
 * contact, portfolio_link, business_stats. Each is one row in site_config
 * keyed by name, value is JSONB holding the same shape the old defaults did.
 * ========================================================================== */
async function getConfig(key) {
    const { data, error } = await supabaseClient
        .from('site_config')
        .select('value')
        .eq('key', key)
        .maybeSingle();
    if (error) {
        console.error(`Failed to load config "${key}"`, error);
        return null;
    }
    return data ? data.value : null;
}

async function setConfig(key, value) {
    const { error } = await supabaseClient
        .from('site_config')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) {
        console.error(`Failed to save config "${key}"`, error);
        return { ok: false, error: error.message };
    }
    return { ok: true };
}

/* ==========================================================================
 * IMAGE UPLOAD — replaces fileToDataURL/base64-in-localStorage.
 * Uploads to the "site-media" storage bucket and returns a public URL.
 * ========================================================================== */
async function uploadImage(file, folder = 'misc') {
    if (!file) return { ok: true, url: '' };
    const ext = file.name.split('.').pop();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabaseClient
        .storage
        .from('site-media')
        .upload(path, file, { upsert: false });

    if (uploadError) {
        console.error('Image upload failed', uploadError);
        return { ok: false, error: uploadError.message };
    }

    const { data } = supabaseClient.storage.from('site-media').getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
}

/* ==========================================================================
 * TESTIMONIALS
 * ========================================================================== */
async function getTestimonials({ publishedOnly = true } = {}) {
    let query = supabaseClient.from('testimonials').select('*').order('display_order', { ascending: true });
    if (publishedOnly) query = query.eq('is_published', true);
    const { data, error } = await query;
    if (error) { console.error('Failed to load testimonials', error); return []; }
    return data;
}

async function upsertTestimonial(testimonial) {
    const { data, error } = await supabaseClient.from('testimonials').upsert(testimonial).select().maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, testimonial: data };
}

async function deleteTestimonial(id) {
    const { error } = await supabaseClient.from('testimonials').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

/* ==========================================================================
 * BLOG — categories, tags, posts
 * ========================================================================== */
async function getBlogCategories() {
    const { data, error } = await supabaseClient.from('blog_categories').select('*').order('name');
    if (error) { console.error('Failed to load categories', error); return []; }
    return data;
}

async function upsertBlogCategory(category) {
    const { data, error } = await supabaseClient.from('blog_categories').upsert(category).select().maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, category: data };
}

async function getBlogTags() {
    const { data, error } = await supabaseClient.from('blog_tags').select('*').order('name');
    if (error) { console.error('Failed to load tags', error); return []; }
    return data;
}

async function upsertBlogTag(tag) {
    const { data, error } = await supabaseClient.from('blog_tags').upsert(tag).select().maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, tag: data };
}

/* publishedOnly=true is what the public site uses; the dashboard passes
   false to see drafts too. */
async function getBlogPosts({ publishedOnly = true, categoryId = null, limit = null } = {}) {
    let query = supabaseClient
        .from('blog_posts')
        .select('*, blog_categories(name, slug), blog_post_tags(blog_tags(name, slug))')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

    if (publishedOnly) query = query.eq('status', 'published');
    if (categoryId) query = query.eq('category_id', categoryId);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) { console.error('Failed to load blog posts', error); return []; }
    return data;
}

async function getBlogPostBySlug(slug) {
    const { data, error } = await supabaseClient
        .from('blog_posts')
        .select('*, blog_categories(name, slug), blog_post_tags(blog_tags(name, slug))')
        .eq('slug', slug)
        .maybeSingle();
    if (error) { console.error('Failed to load post', error); return null; }
    return data;
}

async function upsertBlogPost(post) {
    const { data, error } = await supabaseClient.from('blog_posts').upsert(post).select().maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, post: data };
}

async function setBlogPostTags(postId, tagIds) {
    await supabaseClient.from('blog_post_tags').delete().eq('post_id', postId);
    if (!tagIds.length) return { ok: true };
    const rows = tagIds.map(tag_id => ({ post_id: postId, tag_id }));
    const { error } = await supabaseClient.from('blog_post_tags').insert(rows);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

async function deleteBlogPost(id) {
    const { error } = await supabaseClient.from('blog_posts').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

function slugify(text) {
    return text.toString().toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/* ==========================================================================
 * HELP DESK — public submission/lookup, admin management
 * ========================================================================== */
async function submitTicket({ subject, description, category, priority, customerName, customerEmail }) {
    const { data, error } = await supabaseClient
        .from('tickets')
        .insert({
            subject, description, category, priority,
            customer_name: customerName,
            customer_email: customerEmail
        })
        .select('reference')
        .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, reference: data.reference };
}

/* Public lookup — requires reference + email, verified server-side. */
async function trackTicket(reference, email) {
    const { data, error } = await supabaseClient.rpc('get_ticket_status', {
        p_reference: reference,
        p_email: email
    });
    if (error) return { ok: false, error: error.message };
    if (!data || !data.length) return { ok: false, error: 'No matching ticket found for that reference and email.' };
    return { ok: true, ticket: data[0] };
}

/* Public reply — same reference + email verification, no direct table access. */
async function replyToTicket(reference, email, message) {
    const { data, error } = await supabaseClient.rpc('add_ticket_response', {
        p_reference: reference,
        p_email: email,
        p_message: message
    });
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'No matching ticket found for that reference and email.' };
    return { ok: true };
}

/* Admin-only from here down — RLS blocks these for non-admins regardless. */
async function adminListTickets({ status = null, search = null } = {}) {
    let query = supabaseClient.from('tickets').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`subject.ilike.%${search}%,customer_email.ilike.%${search}%,reference.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) { console.error('Failed to load tickets', error); return []; }
    return data;
}

async function adminGetTicket(id) {
    const { data: ticket, error: tErr } = await supabaseClient.from('tickets').select('*').eq('id', id).maybeSingle();
    if (tErr || !ticket) return null;
    const { data: responses, error: rErr } = await supabaseClient
        .from('ticket_responses').select('*').eq('ticket_id', id).order('created_at', { ascending: true });
    if (rErr) return { ...ticket, responses: [] };
    return { ...ticket, responses };
}

async function adminUpdateTicket(id, fields) {
    const { error } = await supabaseClient.from('tickets').update(fields).eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

async function adminReplyToTicket(ticketId, message) {
    const { error } = await supabaseClient.from('ticket_responses').insert({
        ticket_id: ticketId, sender_type: 'admin', message
    });
    if (error) return { ok: false, error: error.message };
    await supabaseClient.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);
    return { ok: true };
}
