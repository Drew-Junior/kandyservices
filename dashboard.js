/**
 * ==========================================================================
 * ADMIN DASHBOARD ENGINE — Supabase-backed
 * Requires a real admin login (Supabase Auth) before showing anything.
 * Reads/writes through data.js, which talks to Supabase instead of
 * localStorage, so saved changes appear on index.html for every visitor.
 * ==========================================================================
 */

const THEME_KEY = 'drew-theme';

const PANEL_META = {
    profile:   { title: 'Profile & Hero', desc: 'Edit your name, headline roles, hero copy, and profile photo.' },
    about:     { title: 'About & Metrics', desc: 'Edit your biography, philosophy quote, and the animated impact metrics.' },
    skills:    { title: 'Skills', desc: 'Manage the technology pills shown in the Technological Core section.' },
    services:  { title: 'Services', desc: 'Manage specialized services, pricing, and an optional service image.' },
    projects:  { title: 'Projects', desc: 'Manage your project portfolio, including an optional cover image.' },
    companies: { title: 'Companies', desc: 'Manage the businesses you run, with a real uploaded logo or a fallback icon.' },
    blog:      { title: 'Tech Hub / Blog', desc: 'Write, categorize, tag, and publish full articles shown in the Tech Hub.' },
    testimonials: { title: 'Testimonials', desc: 'Manage client testimonials. Only published ones appear on the live site.' },
    tickets:   { title: 'Help Desk', desc: 'View, search, and respond to support tickets submitted by visitors.' },
    stats:     { title: 'Business Stats', desc: 'Set the numbers shown in the animated business activity counters.' },
    portfolio: { title: 'Portfolio Link', desc: 'Point visitors to your separate portfolio site.' },
    social:    { title: 'Social Links', desc: 'Add real social platform links — rendered as brand icons across the site.' },
    contact:   { title: 'Contact Info', desc: 'Edit phone numbers, email, WhatsApp, and operating hours.' },
    settings:  { title: 'Settings', desc: 'Your admin account info.' }
};

/* Tracks the currently-selected (but not-yet-uploaded) image per uploader key.
   Holds { file: File|null, url: string } — file is only set when the user
   picked something new; url is the already-saved image otherwise. */
const pendingImages = {
    'profile-avatar': { file: null, url: '' },
    'service-image':  { file: null, url: '' },
    'project-image':  { file: null, url: '' },
    'company-logo':   { file: null, url: '' },
    'blog-image':      { file: null, url: '' },
    'testimonial-photo': { file: null, url: '' }
};

const DEFAULT_PREVIEW_ICON = {
    'profile-avatar': '<i class="fa-solid fa-robot"></i>',
    'service-image': '<i class="fa-solid fa-image"></i>',
    'project-image': '<i class="fa-solid fa-image"></i>',
    'company-logo': '<i class="fa-solid fa-building"></i>',
    'blog-image': '<i class="fa-solid fa-image"></i>',
    'testimonial-photo': '<i class="fa-solid fa-user"></i>'
};

document.addEventListener('DOMContentLoaded', async () => {
    initLoginForm();
    initLogoutButton();

    const session = await getSession();
    if (session) {
        const isAdmin = await currentUserIsAdmin();
        if (isAdmin) {
            await showApp();
            return;
        }
        await signOutAdmin();
    }
    showLogin();
});

/* ==========================================================================
   AUTH / LOGIN GATE
   ========================================================================== */
function showLogin() {
    document.getElementById('dash-login-screen').style.display = 'flex';
    document.getElementById('dash-shell').style.display = 'none';
}

async function showApp() {
    document.getElementById('dash-login-screen').style.display = 'none';
    document.getElementById('dash-shell').style.display = 'grid';
    await initDashboard();
}

function initLoginForm() {
    const form = document.getElementById('form-login');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errEl = document.getElementById('login-error');
        errEl.hidden = true;

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in…';

        const result = await signInAdmin(email, password);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';

        if (!result.ok) {
            errEl.textContent = result.error;
            errEl.hidden = false;
            return;
        }
        form.reset();
        await showApp();
    });
}

function initLogoutButton() {
    const btn = document.getElementById('btn-logout');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        await signOutAdmin();
        window.location.reload();
    });
}

/* ==========================================================================
   DASHBOARD INIT (runs only after a confirmed admin session)
   ========================================================================== */
async function initDashboard() {
    initDashTheme();
    initPanelNavigation();
    initImageUploaders();
    initConfirmModal();

    await loadProfilePanel();
    await loadAboutPanel();
    await loadSkillsPanel();
    await loadServicesPanel();
    await loadProjectsPanel();
    await loadCompaniesPanel();
    await loadBlogPanel();
    await loadTestimonialsPanel();
    await loadTicketsPanel();
    await loadStatsPanel();
    await loadPortfolioPanel();
    await loadSocialPanel();
    await loadContactPanel();
    await initSettingsPanel();
}

/* ==========================================================================
   THEME (purely a local UI preference — not site content)
   ========================================================================== */
function initDashTheme() {
    const toggleBtn = document.getElementById('dash-theme-toggle');
    if (!toggleBtn) return;
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateDashThemeIcon(savedTheme);

    toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(THEME_KEY, next);
        updateDashThemeIcon(next);
    });
}

function updateDashThemeIcon(theme) {
    const icon = document.querySelector('#dash-theme-toggle i');
    if (!icon) return;
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

/* ==========================================================================
   PANEL NAVIGATION
   ========================================================================== */
function initPanelNavigation() {
    const navItems = document.querySelectorAll('.dash-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const panelKey = item.getAttribute('data-panel');
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`panel-${panelKey}`).classList.add('active');

            const meta = PANEL_META[panelKey];
            document.getElementById('dash-panel-title').textContent = meta.title;
            document.getElementById('dash-panel-desc').textContent = meta.desc;
        });
    });
}

/* ==========================================================================
   TOAST
   ========================================================================== */
let toastTimer = null;
function showToast(message) {
    const toast = document.getElementById('dash-save-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
}

/* ==========================================================================
   CONFIRM MODAL (delete)
   ========================================================================== */
let confirmCallback = null;
function initConfirmModal() {
    const overlay = document.getElementById('confirm-modal');
    const yesBtn = document.getElementById('confirm-modal-yes');
    const noBtn = document.getElementById('confirm-modal-no');
    if (!overlay) return;

    yesBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        if (typeof confirmCallback === 'function') confirmCallback();
        confirmCallback = null;
    });

    noBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        confirmCallback = null;
    });
}

function openConfirm(text, onYes) {
    const overlay = document.getElementById('confirm-modal');
    document.getElementById('confirm-modal-text').textContent = text;
    confirmCallback = onYes;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
}

/* ==========================================================================
   IMAGE UPLOAD HANDLING
   Selecting a file only previews it locally — the actual upload to Supabase
   Storage happens when the surrounding form is submitted, via resolveImageUrl().
   ========================================================================== */
function initImageUploaders() {
    document.querySelectorAll('[data-image-input]').forEach(input => {
        input.addEventListener('change', (e) => {
            const key = input.getAttribute('data-image-input');
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showToast('Please choose an image file.');
                return;
            }
            pendingImages[key] = { file, url: (pendingImages[key] && pendingImages[key].url) || '' };
            setImagePreview(key, URL.createObjectURL(file));
        });
    });

    document.querySelectorAll('[data-image-clear]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-image-clear');
            pendingImages[key] = { file: null, url: '' };
            setImagePreview(key, '');
            const input = document.querySelector(`[data-image-input="${key}"]`);
            if (input) input.value = '';
        });
    });
}

function setImagePreview(key, url) {
    const preview = document.getElementById(`preview-${key}`);
    if (!preview) return;
    preview.innerHTML = url
        ? `<img src="${url}" alt="Preview">`
        : (DEFAULT_PREVIEW_ICON[key] || '<i class="fa-solid fa-image"></i>');
}

/* Resets an image field's pending state + preview to a given already-saved URL
   (used when opening an edit form). */
function primeImageField(key, existingUrl) {
    pendingImages[key] = { file: null, url: existingUrl || '' };
    setImagePreview(key, existingUrl || '');
    const input = document.querySelector(`[data-image-input="${key}"]`);
    if (input) input.value = '';
}

/* Uploads the pending file (if any) and returns the URL to save.
   Returns { ok: false } if an upload was attempted and failed — callers
   should abort the save in that case. */
async function resolveImageUrl(key, folder) {
    const state = pendingImages[key];
    if (state && state.file) {
        const res = await uploadImage(state.file, folder);
        if (!res.ok) {
            showToast('Image upload failed: ' + res.error);
            return { ok: false };
        }
        return { ok: true, url: res.url };
    }
    return { ok: true, url: state ? state.url : '' };
}

/* ==========================================================================
   PROFILE & HERO
   ========================================================================== */
async function loadProfilePanel() {
    const profile = (await getConfig('profile')) || {};
    document.getElementById('pf-name').value = profile.name || '';
    document.getElementById('pf-badge').value = profile.badge || '';
    document.getElementById('pf-roles').value = (profile.roles || []).join(', ');
    document.getElementById('pf-lead').value = profile.heroLead || '';
    document.getElementById('pf-available').checked = profile.available !== false;
    primeImageField('profile-avatar', profile.avatarImg || '');

    document.getElementById('form-profile').addEventListener('submit', async (e) => {
        e.preventDefault();
        const imgRes = await resolveImageUrl('profile-avatar', 'profile');
        if (!imgRes.ok) return;

        const current = (await getConfig('profile')) || {};
        const updated = {
            ...current,
            name: document.getElementById('pf-name').value.trim(),
            badge: document.getElementById('pf-badge').value.trim(),
            roles: document.getElementById('pf-roles').value.split(',').map(r => r.trim()).filter(Boolean),
            heroLead: document.getElementById('pf-lead').value.trim(),
            available: document.getElementById('pf-available').checked,
            avatarImg: imgRes.url
        };
        const saveRes = await setConfig('profile', updated);
        if (!saveRes.ok) { showToast('Save failed: ' + saveRes.error); return; }
        showToast('Profile & hero saved.');
    });
}

/* ==========================================================================
   ABOUT & METRICS
   ========================================================================== */
async function loadAboutPanel() {
    const profile = (await getConfig('profile')) || {};
    document.getElementById('ab-bio1').value = profile.bio1 || '';
    document.getElementById('ab-bio2').value = profile.bio2 || '';
    document.getElementById('ab-quote').value = profile.quote || '';

    document.getElementById('form-about').addEventListener('submit', async (e) => {
        e.preventDefault();
        const current = (await getConfig('profile')) || {};
        const updated = {
            ...current,
            bio1: document.getElementById('ab-bio1').value.trim(),
            bio2: document.getElementById('ab-bio2').value.trim(),
            quote: document.getElementById('ab-quote').value.trim()
        };
        const saveRes = await setConfig('profile', updated);
        if (!saveRes.ok) { showToast('Save failed: ' + saveRes.error); return; }
        showToast('About section saved.');
    });

    renderMetricsEditor(profile.metrics || []);
    document.getElementById('btn-add-metric').addEventListener('click', () => {
        const rows = readMetricsFromEditor();
        rows.push({ label: 'New Metric', val: 0 });
        renderMetricsEditor(rows);
    });
    document.getElementById('btn-save-metrics').addEventListener('click', async () => {
        const rows = readMetricsFromEditor();
        const current = (await getConfig('profile')) || {};
        const saveRes = await setConfig('profile', { ...current, metrics: rows });
        if (!saveRes.ok) { showToast('Save failed: ' + saveRes.error); return; }
        showToast('Metrics saved.');
    });
}

function renderMetricsEditor(metrics) {
    const cont = document.getElementById('metrics-editor-list');
    cont.innerHTML = metrics.map((m, i) => `
        <div class="dash-metric-row" data-index="${i}">
            <input type="text" class="metric-label-input" value="${escapeAttr(m.label)}" placeholder="Label">
            <input type="number" class="metric-val-input" value="${m.val}" placeholder="Value">
            <button type="button" class="dash-remove-row-btn" aria-label="Remove metric"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `).join('');

    cont.querySelectorAll('.dash-remove-row-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const rows = readMetricsFromEditor();
            const idx = parseInt(btn.closest('.dash-metric-row').getAttribute('data-index'));
            rows.splice(idx, 1);
            renderMetricsEditor(rows);
        });
    });
}

function readMetricsFromEditor() {
    const rows = [];
    document.querySelectorAll('#metrics-editor-list .dash-metric-row').forEach(row => {
        const label = row.querySelector('.metric-label-input').value.trim();
        const val = parseInt(row.querySelector('.metric-val-input').value) || 0;
        if (label) rows.push({ label, val });
    });
    return rows;
}

/* ==========================================================================
   SKILLS
   ========================================================================== */
async function loadSkillsPanel() {
    await renderSkillsList();
    document.getElementById('form-skill').addEventListener('submit', async (e) => {
        e.preventDefault();
        const skills = (await getConfig('skills')) || [];
        skills.push({
            name: document.getElementById('sk-name').value.trim(),
            icon: document.getElementById('sk-icon').value.trim()
        });
        const saveRes = await setConfig('skills', skills);
        if (!saveRes.ok) { showToast('Save failed: ' + saveRes.error); return; }
        e.target.reset();
        await renderSkillsList();
        showToast('Skill added.');
    });
}

async function renderSkillsList() {
    const skills = (await getConfig('skills')) || [];
    const cont = document.getElementById('list-skills');
    cont.innerHTML = skills.map((s, i) => `
        <div class="dash-item-card">
            <div class="dash-item-icon"><i class="${s.icon}"></i></div>
            <div class="dash-item-body"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.icon)}</span></div>
            <button class="dash-delete-btn" data-delete-skill="${i}" aria-label="Delete skill"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('') || emptyState('No skills yet.');

    cont.querySelectorAll('[data-delete-skill]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-delete-skill'));
            openConfirm('Delete this skill?', async () => {
                const skills = (await getConfig('skills')) || [];
                skills.splice(idx, 1);
                await setConfig('skills', skills);
                await renderSkillsList();
                showToast('Skill deleted.');
            });
        });
    });
}

/* ==========================================================================
   SERVICES
   ========================================================================== */
async function loadServicesPanel() {
    await renderServicesList();
    const form = document.getElementById('form-service');
    const cancelBtn = document.getElementById('sv-cancel-edit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const imgRes = await resolveImageUrl('service-image', 'services');
        if (!imgRes.ok) return;

        const services = (await getConfig('services')) || [];
        const editIndex = document.getElementById('sv-edit-index').value;
        const entry = {
            name: document.getElementById('sv-name').value.trim(),
            icon: document.getElementById('sv-icon').value.trim(),
            desc: document.getElementById('sv-desc').value.trim(),
            price: document.getElementById('sv-price').value.trim(),
            image: imgRes.url
        };
        if (editIndex !== '') {
            services[parseInt(editIndex)] = entry;
        } else {
            services.push(entry);
        }
        const saveRes = await setConfig('services', services);
        if (!saveRes.ok) { showToast('Save failed: ' + saveRes.error); return; }
        resetServiceForm();
        await renderServicesList();
        showToast(editIndex !== '' ? 'Service updated.' : 'Service added.');
    });

    cancelBtn.addEventListener('click', resetServiceForm);
}

function resetServiceForm() {
    document.getElementById('form-service').reset();
    document.getElementById('sv-edit-index').value = '';
    document.getElementById('service-form-heading').textContent = 'Add Service';
    document.getElementById('sv-cancel-edit').hidden = true;
    primeImageField('service-image', '');
}

async function renderServicesList() {
    const services = (await getConfig('services')) || [];
    const cont = document.getElementById('list-services');
    cont.innerHTML = services.map((s, i) => `
        <div class="dash-item-card">
            ${s.image ? `<div class="dash-item-thumb"><img src="${s.image}" alt=""></div>` : `<div class="dash-item-icon"><i class="${s.icon}"></i></div>`}
            <div class="dash-item-body"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.price)}</span></div>
            <div class="dash-item-actions">
                <button class="dash-edit-btn" data-edit-service="${i}" aria-label="Edit service"><i class="fa-solid fa-pen"></i></button>
                <button class="dash-delete-btn" data-delete-service="${i}" aria-label="Delete service"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('') || emptyState('No services yet.');

    cont.querySelectorAll('[data-edit-service]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.getAttribute('data-edit-service'));
            const s = ((await getConfig('services')) || [])[idx];
            document.getElementById('sv-edit-index').value = idx;
            document.getElementById('sv-name').value = s.name;
            document.getElementById('sv-icon').value = s.icon;
            document.getElementById('sv-desc').value = s.desc;
            document.getElementById('sv-price').value = s.price;
            primeImageField('service-image', s.image);
            document.getElementById('service-form-heading').textContent = 'Edit Service';
            document.getElementById('sv-cancel-edit').hidden = false;
            document.getElementById('form-service').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    cont.querySelectorAll('[data-delete-service]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-delete-service'));
            openConfirm('Delete this service?', async () => {
                const services = (await getConfig('services')) || [];
                services.splice(idx, 1);
                await setConfig('services', services);
                await renderServicesList();
                showToast('Service deleted.');
            });
        });
    });
}

/* ==========================================================================
   PROJECTS
   ========================================================================== */
async function loadProjectsPanel() {
    await renderProjectsList();
    const form = document.getElementById('form-project');
    const cancelBtn = document.getElementById('pj-cancel-edit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const imgRes = await resolveImageUrl('project-image', 'projects');
        if (!imgRes.ok) return;

        const projects = (await getConfig('projects')) || [];
        const editIndex = document.getElementById('pj-edit-index').value;
        const entry = {
            title: document.getElementById('pj-title').value.trim(),
            cat: document.getElementById('pj-cat').value,
            tech: document.getElementById('pj-tech').value.trim(),
            desc: document.getElementById('pj-desc').value.trim(),
            client: document.getElementById('pj-client').value.trim(),
            git: document.getElementById('pj-git').value.trim(),
            image: imgRes.url
        };
        if (editIndex !== '') {
            projects[parseInt(editIndex)] = entry;
        } else {
            projects.push(entry);
        }
        const saveRes = await setConfig('projects', projects);
        if (!saveRes.ok) { showToast('Save failed: ' + saveRes.error); return; }
        resetProjectForm();
        await renderProjectsList();
        showToast(editIndex !== '' ? 'Project updated.' : 'Project added.');
    });

    cancelBtn.addEventListener('click', resetProjectForm);
}

function resetProjectForm() {
    document.getElementById('form-project').reset();
    document.getElementById('pj-edit-index').value = '';
    document.getElementById('project-form-heading').textContent = 'Add Project';
    document.getElementById('pj-cancel-edit').hidden = true;
    primeImageField('project-image', '');
}

async function renderProjectsList() {
    const projects = (await getConfig('projects')) || [];
    const cont = document.getElementById('list-projects');
    cont.innerHTML = projects.map((p, i) => `
        <div class="dash-item-card">
            ${p.image ? `<div class="dash-item-thumb"><img src="${p.image}" alt=""></div>` : `<div class="dash-item-icon"><i class="fa-solid fa-diagram-project"></i></div>`}
            <div class="dash-item-body"><strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(p.client)} • ${escapeHtml((p.cat || '').toUpperCase())}</span></div>
            <div class="dash-item-actions">
                <button class="dash-edit-btn" data-edit-project="${i}" aria-label="Edit project"><i class="fa-solid fa-pen"></i></button>
                <button class="dash-delete-btn" data-delete-project="${i}" aria-label="Delete project"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('') || emptyState('No projects yet.');

    cont.querySelectorAll('[data-edit-project]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.getAttribute('data-edit-project'));
            const p = ((await getConfig('projects')) || [])[idx];
            document.getElementById('pj-edit-index').value = idx;
            document.getElementById('pj-title').value = p.title;
            document.getElementById('pj-cat').value = p.cat;
            document.getElementById('pj-tech').value = p.tech;
            document.getElementById('pj-desc').value = p.desc;
            document.getElementById('pj-client').value = p.client;
            document.getElementById('pj-git').value = p.git || '';
            primeImageField('project-image', p.image);
            document.getElementById('project-form-heading').textContent = 'Edit Project';
            document.getElementById('pj-cancel-edit').hidden = false;
            document.getElementById('form-project').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    cont.querySelectorAll('[data-delete-project]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-delete-project'));
            openConfirm('Delete this project?', async () => {
                const projects = (await getConfig('projects')) || [];
                projects.splice(idx, 1);
                await setConfig('projects', projects);
                await renderProjectsList();
                showToast('Project deleted.');
            });
        });
    });
}

/* ==========================================================================
   COMPANIES
   ========================================================================== */
async function loadCompaniesPanel() {
    await renderCompaniesList();
    const form = document.getElementById('form-company');
    const cancelBtn = document.getElementById('co-cancel-edit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const imgRes = await resolveImageUrl('company-logo', 'companies');
        if (!imgRes.ok) return;

        const companies = (await getConfig('companies')) || [];
        const editIndex = document.getElementById('co-edit-index').value;
        const entry = {
            name: document.getElementById('co-name').value.trim(),
            icon: document.getElementById('co-icon').value.trim() || 'fa-solid fa-building',
            logo: imgRes.url,
            desc: document.getElementById('co-desc').value.trim(),
            highlights: document.getElementById('co-highlights').value.split('\n').map(h => h.trim()).filter(Boolean),
            role: document.getElementById('co-role').value.trim(),
            ctaText: document.getElementById('co-cta-text').value.trim(),
            ctaLink: document.getElementById('co-cta-link').value.trim()
        };
        if (editIndex !== '') {
            companies[parseInt(editIndex)] = entry;
        } else {
            companies.push(entry);
        }
        const saveRes = await setConfig('companies', companies);
        if (!saveRes.ok) { showToast('Save failed: ' + saveRes.error); return; }
        resetCompanyForm();
        await renderCompaniesList();
        showToast(editIndex !== '' ? 'Company updated.' : 'Company added.');
    });

    cancelBtn.addEventListener('click', resetCompanyForm);
}

function resetCompanyForm() {
    document.getElementById('form-company').reset();
    document.getElementById('co-edit-index').value = '';
    document.getElementById('company-form-heading').textContent = 'Add Company';
    document.getElementById('co-cancel-edit').hidden = true;
    primeImageField('company-logo', '');
}

async function renderCompaniesList() {
    const companies = (await getConfig('companies')) || [];
    const cont = document.getElementById('list-companies');
    cont.innerHTML = companies.map((c, i) => `
        <div class="dash-item-card">
            ${c.logo ? `<div class="dash-item-thumb"><img src="${c.logo}" alt=""></div>` : `<div class="dash-item-icon"><i class="${c.icon || 'fa-solid fa-building'}"></i></div>`}
            <div class="dash-item-body"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.role || '')}</span></div>
            <div class="dash-item-actions">
                <button class="dash-edit-btn" data-edit-company="${i}" aria-label="Edit company"><i class="fa-solid fa-pen"></i></button>
                <button class="dash-delete-btn" data-delete-company="${i}" aria-label="Delete company"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('') || emptyState('No companies yet.');

    cont.querySelectorAll('[data-edit-company]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.getAttribute('data-edit-company'));
            const c = ((await getConfig('companies')) || [])[idx];
            document.getElementById('co-edit-index').value = idx;
            document.getElementById('co-name').value = c.name;
            document.getElementById('co-icon').value = c.icon || '';
            document.getElementById('co-role').value = c.role || '';
            document.getElementById('co-cta-text').value = c.ctaText || '';
            document.getElementById('co-cta-link').value = c.ctaLink || '';
            document.getElementById('co-desc').value = c.desc;
            document.getElementById('co-highlights').value = (c.highlights || []).join('\n');
            primeImageField('company-logo', c.logo);
            document.getElementById('company-form-heading').textContent = 'Edit Company';
            document.getElementById('co-cancel-edit').hidden = false;
            document.getElementById('form-company').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    cont.querySelectorAll('[data-delete-company]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-delete-company'));
            openConfirm('Delete this company?', async () => {
                const companies = (await getConfig('companies')) || [];
                companies.splice(idx, 1);
                await setConfig('companies', companies);
                await renderCompaniesList();
                showToast('Company deleted.');
            });
        });
    });
}

/* ==========================================================================
   BLOG / TECH HUB
   ========================================================================== */
async function loadBlogPanel() {
    await loadBlogCategoryManager();
    await renderBlogPostsList();

    const form = document.getElementById('form-blog');
    const cancelBtn = document.getElementById('bl-cancel-edit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const imgRes = await resolveImageUrl('blog-image', 'blog');
        if (!imgRes.ok) return;

        const editId = document.getElementById('bl-edit-id').value;
        const title = document.getElementById('bl-title').value.trim();
        const status = document.getElementById('bl-status').value;
        const wasPublished = document.getElementById('bl-was-published') ? document.getElementById('bl-was-published').value === 'true' : false;

        const post = {
            title,
            slug: slugify(title) + (editId ? '' : '-' + Date.now().toString(36)),
            excerpt: document.getElementById('bl-excerpt').value.trim(),
            content: document.getElementById('bl-content').value.trim(),
            featured_image_url: imgRes.url,
            author: 'Kandy Services',
            category_id: document.getElementById('bl-category').value || null,
            meta_description: document.getElementById('bl-meta-desc').value.trim() || null,
            status,
            published_at: (status === 'published' && !wasPublished) ? new Date().toISOString() : undefined
        };
        if (editId) {
            post.id = editId;
            // keep the existing slug/published_at on edits — refetch them
            const existing = (await getBlogPosts({ publishedOnly: false })).find(p => p.id === editId);
            if (existing) {
                post.slug = existing.slug;
                post.published_at = (status === 'published') ? (existing.published_at || new Date().toISOString()) : existing.published_at;
            }
        }

        const res = await upsertBlogPost(post);
        if (!res.ok) { showToast('Save failed: ' + res.error); return; }

        const tagNames = document.getElementById('bl-tags').value.split(',').map(t => t.trim()).filter(Boolean);
        const tagIds = [];
        for (const name of tagNames) {
            const slug = slugify(name);
            const tagRes = await upsertBlogTag({ name, slug });
            if (tagRes.ok) tagIds.push(tagRes.tag.id);
        }
        await setBlogPostTags(res.post.id, tagIds);

        resetBlogForm();
        await renderBlogPostsList();
        showToast(editId ? 'Article updated.' : 'Article saved.');
    });

    cancelBtn.addEventListener('click', resetBlogForm);
}

async function loadBlogCategoryManager() {
    await renderBlogCategoryOptions();
    await renderBlogCategoryList();

    document.getElementById('bl-add-category').addEventListener('click', async () => {
        const input = document.getElementById('bl-new-category');
        const name = input.value.trim();
        if (!name) return;
        const res = await upsertBlogCategory({ name, slug: slugify(name) });
        if (!res.ok) { showToast('Could not add category: ' + res.error); return; }
        input.value = '';
        await renderBlogCategoryOptions();
        await renderBlogCategoryList();
        showToast('Category added.');
    });
}

async function renderBlogCategoryOptions() {
    const categories = await getBlogCategories();
    const select = document.getElementById('bl-category');
    const current = select.value;
    select.innerHTML = '<option value="">No category</option>' +
        categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    select.value = current;
}

async function renderBlogCategoryList() {
    const categories = await getBlogCategories();
    const cont = document.getElementById('list-blog-categories');
    cont.innerHTML = categories.map(c => `
        <div class="dash-item-card">
            <div class="dash-item-icon"><i class="fa-solid fa-tag"></i></div>
            <div class="dash-item-body"><strong>${escapeHtml(c.name)}</strong></div>
        </div>
    `).join('') || emptyState('No categories yet.');
}

function resetBlogForm() {
    document.getElementById('form-blog').reset();
    document.getElementById('bl-edit-id').value = '';
    const marker = document.getElementById('bl-was-published');
    if (marker) marker.remove();
    document.getElementById('blog-form-heading').textContent = 'Write Article';
    document.getElementById('bl-cancel-edit').hidden = true;
    primeImageField('blog-image', '');
}

async function renderBlogPostsList() {
    const posts = await getBlogPosts({ publishedOnly: false });
    const cont = document.getElementById('list-blogs');
    cont.innerHTML = posts.map(p => `
        <div class="dash-item-card">
            ${p.featured_image_url ? `<div class="dash-item-thumb"><img src="${p.featured_image_url}" alt=""></div>` : `<div class="dash-item-icon"><i class="fa-solid fa-newspaper"></i></div>`}
            <div class="dash-item-body"><strong>${escapeHtml(p.title)}</strong><span>${p.status === 'published' ? 'Published' : 'Draft'} • ${p.blog_categories ? escapeHtml(p.blog_categories.name) : 'No category'}</span></div>
            <div class="dash-item-actions">
                <button class="dash-edit-btn" data-edit-post="${p.id}" aria-label="Edit article"><i class="fa-solid fa-pen"></i></button>
                <button class="dash-delete-btn" data-delete-post="${p.id}" aria-label="Delete article"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('') || emptyState('No articles yet.');

    cont.querySelectorAll('[data-edit-post]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-edit-post');
            const p = (await getBlogPosts({ publishedOnly: false })).find(post => post.id === id);
            if (!p) return;
            document.getElementById('bl-edit-id').value = p.id;
            document.getElementById('bl-title').value = p.title;
            document.getElementById('bl-category').value = p.category_id || '';
            const tags = (p.blog_post_tags || []).map(t => t.blog_tags.name).join(', ');
            document.getElementById('bl-tags').value = tags;
            document.getElementById('bl-excerpt').value = p.excerpt || '';
            document.getElementById('bl-content').value = p.content || '';
            document.getElementById('bl-meta-desc').value = p.meta_description || '';
            document.getElementById('bl-status').value = p.status;
            primeImageField('blog-image', p.featured_image_url);

            // stash whether it was already published, so saving a draft doesn't
            // reset published_at if it's re-published later
            let marker = document.getElementById('bl-was-published');
            if (!marker) {
                marker = document.createElement('input');
                marker.type = 'hidden';
                marker.id = 'bl-was-published';
                document.getElementById('form-blog').appendChild(marker);
            }
            marker.value = p.status === 'published' ? 'true' : 'false';

            document.getElementById('blog-form-heading').textContent = 'Edit Article';
            document.getElementById('bl-cancel-edit').hidden = false;
            document.getElementById('form-blog').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    cont.querySelectorAll('[data-delete-post]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-delete-post');
            openConfirm('Delete this article? This cannot be undone.', async () => {
                const res = await deleteBlogPost(id);
                if (!res.ok) { showToast('Delete failed: ' + res.error); return; }
                await renderBlogPostsList();
                showToast('Article deleted.');
            });
        });
    });
}

/* ==========================================================================
   TESTIMONIALS
   ========================================================================== */
async function loadTestimonialsPanel() {
    await renderTestimonialsList();
    const form = document.getElementById('form-testimonial');
    const cancelBtn = document.getElementById('te-cancel-edit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const imgRes = await resolveImageUrl('testimonial-photo', 'testimonials');
        if (!imgRes.ok) return;

        const editId = document.getElementById('te-edit-id').value;
        const entry = {
            client_name: document.getElementById('te-name').value.trim(),
            client_info: document.getElementById('te-info').value.trim(),
            testimonial: document.getElementById('te-text').value.trim(),
            photo_url: imgRes.url,
            is_published: document.getElementById('te-published').checked
        };
        if (editId) entry.id = editId;

        const res = await upsertTestimonial(entry);
        if (!res.ok) { showToast('Save failed: ' + res.error); return; }
        resetTestimonialForm();
        await renderTestimonialsList();
        showToast(editId ? 'Testimonial updated.' : 'Testimonial added.');
    });

    cancelBtn.addEventListener('click', resetTestimonialForm);
}

function resetTestimonialForm() {
    document.getElementById('form-testimonial').reset();
    document.getElementById('te-edit-id').value = '';
    document.getElementById('testimonial-form-heading').textContent = 'Add Testimonial';
    document.getElementById('te-cancel-edit').hidden = true;
    primeImageField('testimonial-photo', '');
}

async function renderTestimonialsList() {
    const testimonials = await getTestimonials({ publishedOnly: false });
    const cont = document.getElementById('list-testimonials');
    cont.innerHTML = testimonials.map(t => `
        <div class="dash-item-card">
            ${t.photo_url ? `<div class="dash-item-thumb" style="border-radius:50%; width:44px;"><img src="${t.photo_url}" alt=""></div>` : `<div class="dash-item-icon"><i class="fa-solid fa-user"></i></div>`}
            <div class="dash-item-body"><strong>${escapeHtml(t.client_name)}</strong><span>${t.is_published ? 'Published' : 'Draft'} • ${escapeHtml(t.client_info || '')}</span></div>
            <div class="dash-item-actions">
                <button class="dash-edit-btn" data-edit-testimonial="${t.id}" aria-label="Edit testimonial"><i class="fa-solid fa-pen"></i></button>
                <button class="dash-delete-btn" data-delete-testimonial="${t.id}" aria-label="Delete testimonial"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('') || emptyState('No testimonials yet.');

    cont.querySelectorAll('[data-edit-testimonial]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-edit-testimonial');
            const t = (await getTestimonials({ publishedOnly: false })).find(x => x.id === id);
            if (!t) return;
            document.getElementById('te-edit-id').value = t.id;
            document.getElementById('te-name').value = t.client_name;
            document.getElementById('te-info').value = t.client_info || '';
            document.getElementById('te-text').value = t.testimonial;
            document.getElementById('te-published').checked = t.is_published;
            primeImageField('testimonial-photo', t.photo_url);
            document.getElementById('testimonial-form-heading').textContent = 'Edit Testimonial';
            document.getElementById('te-cancel-edit').hidden = false;
            document.getElementById('form-testimonial').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    cont.querySelectorAll('[data-delete-testimonial]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-delete-testimonial');
            openConfirm('Delete this testimonial?', async () => {
                const res = await deleteTestimonial(id);
                if (!res.ok) { showToast('Delete failed: ' + res.error); return; }
                await renderTestimonialsList();
                showToast('Testimonial deleted.');
            });
        });
    });
}

/* ==========================================================================
   HELP DESK
   ========================================================================== */
const TICKET_STATUS_LABELS = {
    new: 'New', open: 'Open', in_progress: 'In Progress',
    waiting_on_customer: 'Waiting on Customer', resolved: 'Resolved', closed: 'Closed'
};

async function loadTicketsPanel() {
    await renderTicketsList();

    document.getElementById('tk-filter-status').addEventListener('change', renderTicketsList);
    let searchDebounce;
    document.getElementById('tk-search').addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(renderTicketsList, 300);
    });
    document.getElementById('tk-back-to-list').addEventListener('click', showTicketListView);
}

function showTicketListView() {
    document.getElementById('ticket-list-view').hidden = false;
    document.getElementById('ticket-detail-view').hidden = true;
    renderTicketsList();
}

async function renderTicketsList() {
    const status = document.getElementById('tk-filter-status').value;
    const search = document.getElementById('tk-search').value.trim();
    const tickets = await adminListTickets({ status: status || null, search: search || null });
    const cont = document.getElementById('list-tickets');
    cont.innerHTML = tickets.map(t => `
        <div class="dash-item-card">
            <div class="dash-item-icon"><i class="fa-solid fa-ticket"></i></div>
            <div class="dash-item-body"><strong>${escapeHtml(t.subject)}</strong><span>${escapeHtml(t.reference)} • ${escapeHtml(t.customer_name)} • ${TICKET_STATUS_LABELS[t.status] || t.status}</span></div>
            <div class="dash-item-actions">
                <button class="dash-edit-btn" data-open-ticket="${t.id}" aria-label="Open ticket"><i class="fa-solid fa-arrow-right"></i></button>
            </div>
        </div>
    `).join('') || emptyState('No tickets found.');

    cont.querySelectorAll('[data-open-ticket]').forEach(btn => {
        btn.addEventListener('click', () => openTicketDetail(btn.getAttribute('data-open-ticket')));
    });
}

async function openTicketDetail(id) {
    document.getElementById('ticket-list-view').hidden = true;
    document.getElementById('ticket-detail-view').hidden = false;
    await renderTicketDetail(id);
}

async function renderTicketDetail(id) {
    const ticket = await adminGetTicket(id);
    const cont = document.getElementById('ticket-detail-content');
    if (!ticket) { cont.innerHTML = emptyState('Ticket not found.'); return; }

    cont.innerHTML = `
        <h3>${escapeHtml(ticket.subject)}</h3>
        <p class="dash-hint">${escapeHtml(ticket.reference)} • ${escapeHtml(ticket.customer_name)} (${escapeHtml(ticket.customer_email)}) • ${escapeHtml(ticket.category)}</p>
        <div class="form-grid" style="margin:1rem 0;">
            <div class="form-group"><label>Status</label>
                <select id="tk-detail-status">
                    ${Object.entries(TICKET_STATUS_LABELS).map(([val, label]) => `<option value="${val}" ${ticket.status === val ? 'selected' : ''}>${label}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Priority</label>
                <select id="tk-detail-priority">
                    ${['low', 'normal', 'high', 'urgent'].map(p => `<option value="${p}" ${ticket.priority === p ? 'selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}
                </select>
            </div>
        </div>
        <button type="button" id="tk-save-status" class="btn btn-secondary btn-small">Update Status / Priority</button>

        <h3 style="margin-top:2rem;">Description</h3>
        <p>${escapeHtml(ticket.description)}</p>

        <h3 style="margin-top:2rem;">Responses</h3>
        <div class="dash-list">
            ${(ticket.responses || []).map(r => `
                <div class="dash-item-card" style="align-items:flex-start;">
                    <div class="dash-item-icon"><i class="fa-solid ${r.sender_type === 'admin' ? 'fa-user-shield' : 'fa-user'}"></i></div>
                    <div class="dash-item-body">
                        <strong>${r.sender_type === 'admin' ? 'You' : escapeHtml(ticket.customer_name)}</strong>
                        <span style="white-space:normal;">${escapeHtml(r.message)}</span>
                    </div>
                </div>
            `).join('') || emptyState('No responses yet.')}
        </div>

        <form id="form-ticket-reply" class="dash-form" style="margin-top:1rem;">
            <div class="form-group"><label>Reply to customer</label><textarea id="tk-reply-text" rows="3" required></textarea></div>
            <div class="dash-form-actions"><button type="submit" class="btn btn-primary btn-small">Send Reply</button></div>
        </form>
    `;

    document.getElementById('tk-save-status').addEventListener('click', async () => {
        const res = await adminUpdateTicket(id, {
            status: document.getElementById('tk-detail-status').value,
            priority: document.getElementById('tk-detail-priority').value
        });
        if (!res.ok) { showToast('Update failed: ' + res.error); return; }
        showToast('Ticket updated.');
    });

    document.getElementById('form-ticket-reply').addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = document.getElementById('tk-reply-text').value.trim();
        if (!message) return;
        const res = await adminReplyToTicket(id, message);
        if (!res.ok) { showToast('Reply failed: ' + res.error); return; }
        showToast('Reply sent.');
        await renderTicketDetail(id);
    });
}

/* ==========================================================================
   BUSINESS STATS
   ========================================================================== */
async function loadStatsPanel() {
    const stats = (await getConfig('business_stats')) || {};
    document.getElementById('st-websites').value = (stats.websites_developed ?? '');
    document.getElementById('st-laptops').value = (stats.laptops_sold ?? '');

    document.getElementById('form-stats').addEventListener('submit', async (e) => {
        e.preventDefault();
        const websitesRaw = document.getElementById('st-websites').value;
        const laptopsRaw = document.getElementById('st-laptops').value;
        const updated = {
            websites_developed: websitesRaw === '' ? null : parseInt(websitesRaw),
            laptops_sold: laptopsRaw === '' ? null : parseInt(laptopsRaw)
        };
        const res = await setConfig('business_stats', updated);
        if (!res.ok) { showToast('Save failed: ' + res.error); return; }
        showToast('Business stats saved.');
    });
}

/* ==========================================================================
   PORTFOLIO LINK
   ========================================================================== */
async function loadPortfolioPanel() {
    const link = (await getConfig('portfolio_link')) || {};
    document.getElementById('pf-portfolio-url').value = link.url || '';
    document.getElementById('pf-portfolio-label').value = link.label || '';

    document.getElementById('form-portfolio').addEventListener('submit', async (e) => {
        e.preventDefault();
        const updated = {
            url: document.getElementById('pf-portfolio-url').value.trim(),
            label: document.getElementById('pf-portfolio-label').value.trim() || 'View my full portfolio'
        };
        const res = await setConfig('portfolio_link', updated);
        if (!res.ok) { showToast('Save failed: ' + res.error); return; }
        showToast('Portfolio link saved.');
    });
}

/* ==========================================================================
   SOCIAL LINKS
   ========================================================================== */
async function loadSocialPanel() {
    const select = document.getElementById('so-platform');
    select.innerHTML = Object.keys(PLATFORM_MAP).map(key =>
        `<option value="${key}">${PLATFORM_MAP[key].label}</option>`
    ).join('');

    await renderSocialList();

    document.getElementById('form-social').addEventListener('submit', async (e) => {
        e.preventDefault();
        const social = (await getConfig('social')) || [];
        const platform = select.value;
        const url = document.getElementById('so-url').value.trim();
        const existingIdx = social.findIndex(s => s.platform === platform);
        if (existingIdx > -1) {
            social[existingIdx].url = url;
        } else {
            social.push({ platform, url });
        }
        const saveRes = await setConfig('social', social);
        if (!saveRes.ok) { showToast('Save failed: ' + saveRes.error); return; }
        e.target.reset();
        await renderSocialList();
        showToast('Social link saved.');
    });
}

async function renderSocialList() {
    const social = (await getConfig('social')) || [];
    const cont = document.getElementById('list-social');
    cont.innerHTML = social.map((s, i) => {
        const meta = PLATFORM_MAP[s.platform] || { label: s.platform, icon: 'fa-solid fa-link' };
        return `
        <div class="dash-item-card">
            <div class="dash-item-icon"><i class="${meta.icon}"></i></div>
            <div class="dash-item-body"><strong>${escapeHtml(meta.label)}</strong><span>${escapeHtml(s.url)}</span></div>
            <button class="dash-delete-btn" data-delete-social="${i}" aria-label="Delete social link"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join('') || emptyState('No social links yet.');

    cont.querySelectorAll('[data-delete-social]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-delete-social'));
            openConfirm('Remove this social link?', async () => {
                const social = (await getConfig('social')) || [];
                social.splice(idx, 1);
                await setConfig('social', social);
                await renderSocialList();
                showToast('Social link removed.');
            });
        });
    });
}

/* ==========================================================================
   CONTACT INFO
   ========================================================================== */
async function loadContactPanel() {
    const contact = (await getConfig('contact')) || {};
    document.getElementById('ct-personal').value = contact.personalPhone || '';
    document.getElementById('ct-business').value = contact.businessPhone || '';
    document.getElementById('ct-email').value = contact.email || '';
    document.getElementById('ct-whatsapp').value = contact.whatsapp || '';
    document.getElementById('ct-wa-message').value = contact.whatsappMessage || '';
    document.getElementById('ct-hours-weekday').value = contact.hoursWeekday || '';
    document.getElementById('ct-hours-saturday').value = contact.hoursSaturday || '';
    document.getElementById('ct-hours-sunday').value = contact.hoursSunday || '';

    document.getElementById('form-contact').addEventListener('submit', async (e) => {
        e.preventDefault();
        const updated = {
            personalPhone: document.getElementById('ct-personal').value.trim(),
            businessPhone: document.getElementById('ct-business').value.trim(),
            email: document.getElementById('ct-email').value.trim(),
            whatsapp: document.getElementById('ct-whatsapp').value.trim(),
            whatsappMessage: document.getElementById('ct-wa-message').value.trim(),
            hoursWeekday: document.getElementById('ct-hours-weekday').value.trim(),
            hoursSaturday: document.getElementById('ct-hours-saturday').value.trim(),
            hoursSunday: document.getElementById('ct-hours-sunday').value.trim()
        };
        const saveRes = await setConfig('contact', updated);
        if (!saveRes.ok) { showToast('Save failed: ' + saveRes.error); return; }
        showToast('Contact info saved.');
    });
}

/* ==========================================================================
   SETTINGS
   ========================================================================== */
async function initSettingsPanel() {
    const emailEl = document.getElementById('settings-admin-email');
    if (emailEl) {
        const { data } = await supabaseClient.auth.getUser();
        emailEl.textContent = data?.user?.email || '—';
    }
}

/* ==========================================================================
   HELPERS
   ========================================================================== */
function emptyState(message) {
    return `<div class="dash-empty-state"><i class="fa-solid fa-circle-info"></i> ${message}</div>`;
}

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    return escapeHtml(str);
}
