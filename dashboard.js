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
    blog:      { title: 'Tech Hub / Blog', desc: 'This editor is being rebuilt for the new blog system — coming in the next update.' },
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
    'blog-image':      { file: null, url: '' }
};

const DEFAULT_PREVIEW_ICON = {
    'profile-avatar': '<i class="fa-solid fa-robot"></i>',
    'service-image': '<i class="fa-solid fa-image"></i>',
    'project-image': '<i class="fa-solid fa-image"></i>',
    'company-logo': '<i class="fa-solid fa-building"></i>',
    'blog-image': '<i class="fa-solid fa-image"></i>'
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
    initBlogPlaceholder();

    await loadProfilePanel();
    await loadAboutPanel();
    await loadSkillsPanel();
    await loadServicesPanel();
    await loadProjectsPanel();
    await loadCompaniesPanel();
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
   BLOG / TECH HUB — placeholder until the new system lands
   ========================================================================== */
function initBlogPlaceholder() {
    const form = document.getElementById('form-blog');
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('The blog editor is being rebuilt for the new system — coming in the next update.');
    });
    const list = document.getElementById('list-blogs');
    if (list) list.innerHTML = emptyState('The new blog editor is coming in the next update.');
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
