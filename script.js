/**
 * ==========================================================================
 * KANDY SERVICES WEBSITE ENGINE
 * Public site renderer. Reads all content from the shared data layer
 * (data.js), which talks to Supabase. Content is edited from the separate
 * Admin Dashboard (dashboard.html / dashboard.js).
 * ==========================================================================
 */

const THEME_KEY = 'drew-theme';

document.addEventListener('DOMContentLoaded', async () => {
    initLoader();
    initThreeBackground();
    initThemeManager();
    initCustomCursor();
    initMagneticButtons();
    await renderSiteFromData();
    initContactForm();
    initNavigationProgress();
    initAccessibilitySettings();
});

/* ==========================================================================
   INITIALIZATION LOADER SCREEN
   ========================================================================== */
function initLoader() {
    const loader = document.getElementById('loader');
    const loadPercentage = document.getElementById('load-percentage');
    const loadBar = document.querySelector('.loading-bar');
    let progress = 0;

    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 5;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => {
                loader.classList.add('hidden');
                initCounterAnimation();
            }, 500);
        }
        loadPercentage.textContent = `${progress}%`;
        loadBar.style.width = `${progress}%`;
    }, 100);
}

/* ==========================================================================
   METRIC STATS COUNTER ANIMATION
   ========================================================================== */
function initCounterAnimation() {
    const metrics = document.querySelectorAll('.metric-num');
    metrics.forEach(metric => {
        const target = parseInt(metric.getAttribute('data-val')) || 0;
        let count = 0;
        const speed = target / 40 || 1;
        const updateCount = () => {
            count += speed;
            if (count < target) {
                metric.textContent = Math.floor(count);
                requestAnimationFrame(updateCount);
            } else {
                metric.textContent = target;
            }
        };
        updateCount();
    });
}

/* ==========================================================================
   THREE.JS INTERACTIVE WEBGL BACKGROUND
   ========================================================================== */
function initThreeBackground() {
    const canvas = document.getElementById('three-bg-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const particleCount = 120;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 12;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleTexture = createParticleTexture();

    const material = new THREE.PointsMaterial({
        size: 0.12,
        map: particleTexture,
        transparent: true,
        color: 0x2563eb,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    camera.position.z = 5;

    let mouseX = 0, mouseY = 0;
    window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) - 0.5;
        mouseY = -(e.clientY / window.innerHeight) + 0.5;
    });

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();
        particleSystem.rotation.y = elapsedTime * 0.05 + mouseX * 0.2;
        particleSystem.rotation.x = elapsedTime * 0.02 + mouseY * 0.2;
        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    return new THREE.CanvasTexture(canvas);
}

/* ==========================================================================
   DYNAMIC TYPING EFFECT
   ========================================================================== */
function initTypingEffect(roles) {
    const target = document.getElementById('typing-text');
    if (!target) return;

    const professions = (roles && roles.length) ? roles : ['Developer'];

    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function type() {
        const currentWord = professions[wordIndex];
        if (isDeleting) {
            target.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
        } else {
            target.textContent = currentWord.substring(0, charIndex + 1);
            charIndex++;
        }

        let speed = isDeleting ? 40 : 80;

        if (!isDeleting && charIndex === currentWord.length) {
            speed = 2000;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % professions.length;
            speed = 500;
        }

        setTimeout(type, speed);
    }

    setTimeout(type, 1000);
}

/* ==========================================================================
   LIGHT / DARK THEME SYSTEM
   ========================================================================== */
function initThemeManager() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem(THEME_KEY, nextTheme);
        updateThemeIcon(nextTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (!icon) return;
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

/* ==========================================================================
   CUSTOM CURSOR & MAGNETIC HOVER SYSTEMS
   ========================================================================== */
function initCustomCursor() {
    const cursor = document.getElementById('custom-cursor');
    const glow = document.getElementById('cursor-glow');
    if (!cursor || !glow) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let targetX = 0, targetY = 0;
    let curX = 0, curY = 0;
    let glX = 0, glY = 0;

    window.addEventListener('mousemove', (e) => {
        targetX = e.clientX;
        targetY = e.clientY;
    });

    function update() {
        curX += (targetX - curX) * 0.2;
        curY += (targetY - curY) * 0.2;
        glX += (targetX - glX) * 0.1;
        glY += (targetY - glY) * 0.1;

        cursor.style.left = `${curX}px`;
        cursor.style.top = `${curY}px`;
        glow.style.left = `${glX}px`;
        glow.style.top = `${glY}px`;

        requestAnimationFrame(update);
    }
    update();

    attachCursorHoverListeners();
}

function attachCursorHoverListeners() {
    const glow = document.getElementById('cursor-glow');
    if (!glow) return;
    document.querySelectorAll('a, button, select, input, textarea, .magnetic').forEach(elem => {
        elem.addEventListener('mouseenter', () => {
            glow.style.transform = 'translate(-50%, -50%) scale(1.5)';
            glow.style.borderColor = 'var(--accent)';
        });
        elem.addEventListener('mouseleave', () => {
            glow.style.transform = 'translate(-50%, -50%) scale(1)';
            glow.style.borderColor = 'var(--primary)';
        });
    });
}

function initMagneticButtons() {
    attachMagneticListeners();
}

function attachMagneticListeners() {
    const magnetics = document.querySelectorAll('.magnetic');
    magnetics.forEach(btn => {
        if (btn.dataset.magneticBound) return;
        btn.dataset.magneticBound = 'true';
        btn.addEventListener('mousemove', (e) => {
            const bounds = btn.getBoundingClientRect();
            const x = e.clientX - bounds.left - bounds.width / 2;
            const y = e.clientY - bounds.top - bounds.height / 2;
            btn.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0px, 0px)';
        });
    });
}

/* ==========================================================================
   MASTER RENDER — pulls every section from the shared data layer
   ========================================================================== */
async function renderSiteFromData() {
    const [profile, skills, services, projects, companies, social, contact] = await Promise.all([
        getConfig('profile'),
        getConfig('skills'),
        getConfig('services'),
        getConfig('projects'),
        getConfig('companies'),
        getConfig('social'),
        getConfig('contact')
    ]);

    renderProfile(profile || {});
    renderSkills(skills || []);
    renderServices(services || []);
    renderProjects(projects || []);
    renderCompanies(companies || []);
    renderSocialIcons(social || []);
    renderContact(contact || {}, social || []);
    renderBlogs();
    renderBusinessStats();
    renderTestimonials();
    renderPortfolioLink();
    initHelpDesk();

    initTypingEffect((profile && profile.roles) || []);
    setupPortfolioFilters();
    attachMagneticListeners();
    attachCursorHoverListeners();
    initLiveChatLoop();
}

/* -------------------- Looping Demo Chat Widget -------------------- */
/* Purely illustrative — not a real conversation or a real client. Loops
   a short scripted exchange to show what working with Kandy Services
   feels like, styled as a live chat window. */
const LIVE_CHAT_SCRIPT = [
    { sender: 'client', text: 'Hi! Do you build custom business websites?' },
    { sender: 'kandy', text: 'Yes — design, build, and launch, all handled end to end.' },
    { sender: 'client', text: 'How fast can a project like that turn around?' },
    { sender: 'kandy', text: 'Most sites launch in 2–3 weeks. Want a free quote?' }
];

function initLiveChatLoop() {
    const body = document.getElementById('chat-widget-body');
    if (!body) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        body.innerHTML = LIVE_CHAT_SCRIPT.map(m => `
            <div class="chat-bubble chat-bubble-${m.sender === 'kandy' ? 'kandy' : 'client'}">${escapeHtml(m.text)}</div>
        `).join('');
        return;
    }

    let cancelled = false;
    async function runLoop() {
        while (!cancelled) {
            body.innerHTML = '';
            for (const msg of LIVE_CHAT_SCRIPT) {
                if (cancelled) return;
                await wait(900);
                if (cancelled) return;
                showTyping(body);
                await wait(1100);
                if (cancelled) return;
                removeTyping(body);
                appendBubble(body, msg);
                trimBubbles(body);
            }
            await wait(3200);
        }
    }
    runLoop();

    // Pause the loop for tabs in the background to save resources.
    document.addEventListener('visibilitychange', () => {
        cancelled = document.hidden;
        if (!cancelled) runLoop();
    });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showTyping(body) {
    const el = document.createElement('div');
    el.className = 'chat-typing-indicator';
    el.id = 'chat-typing-now';
    el.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(el);
}

function removeTyping(body) {
    const el = document.getElementById('chat-typing-now');
    if (el) el.remove();
}

function appendBubble(body, msg) {
    const el = document.createElement('div');
    el.className = `chat-bubble chat-bubble-${msg.sender === 'kandy' ? 'kandy' : 'client'}`;
    el.textContent = msg.text;
    body.appendChild(el);
}

function trimBubbles(body) {
    // Keep the widget from growing unbounded — show at most the last 3 lines.
    while (body.children.length > 3) {
        body.removeChild(body.firstChild);
    }
}

/* -------------------- Profile / Hero / About -------------------- */
function renderProfile(profile) {
    const badge = document.getElementById('hero-badge-text');
    if (badge) badge.textContent = profile.badge || '';

    const lead = document.getElementById('hero-lead');
    if (lead) lead.textContent = profile.heroLead || '';

    const bio1 = document.getElementById('about-bio-1');
    if (bio1) bio1.textContent = profile.bio1 || '';

    const bio2 = document.getElementById('about-bio-2');
    if (bio2) bio2.textContent = profile.bio2 || '';

    const quote = document.getElementById('about-quote');
    if (quote) quote.textContent = profile.quote ? `"${profile.quote}"` : '';

    const chatDot = document.querySelector('.chat-widget-dot');
    const chatStatus = document.querySelector('.chat-widget-status');
    if (chatDot && chatStatus) {
        const isAvailable = profile.available !== false; // defaults to true
        chatStatus.textContent = isAvailable ? 'Online' : 'Away';
        chatDot.style.backgroundColor = isAvailable ? '#22c55e' : '#6b7280';
        chatDot.style.boxShadow = isAvailable ? '0 0 8px #22c55e' : 'none';
    }

    const metricsCont = document.getElementById('metrics-container');
    if (metricsCont && Array.isArray(profile.metrics)) {
        metricsCont.innerHTML = profile.metrics.map(m => `
            <div class="metric-card">
                <span class="metric-num" data-val="${m.val}">0</span><span class="metric-plus">+</span>
                <span class="metric-label">${escapeHtml(m.label)}</span>
            </div>
        `).join('');
    }

    const chatAvatar = document.getElementById('chat-window-avatar');
    if (chatAvatar) {
        chatAvatar.innerHTML = profile.avatarImg
            ? `<img src="${profile.avatarImg}" alt="${escapeHtml(profile.name || 'Kandy Services')}">`
            : `<i class="fa-solid fa-building"></i>`;
    }
}

/* -------------------- Skills -------------------- */
function renderSkills(skills) {
    const skillsCont = document.getElementById('skills-container');
    if (!skillsCont) return;
    skillsCont.innerHTML = skills.map(skill => `
        <div class="skill-tag-pill">
            <i class="${skill.icon}"></i>
            <span>${escapeHtml(skill.name)}</span>
        </div>
    `).join('');
}

/* -------------------- Services -------------------- */
function renderServices(services) {
    const servicesCont = document.getElementById('services-container-grid');
    if (!servicesCont) return;
    servicesCont.innerHTML = services.map(srv => `
        <div class="service-card glass-card">
            ${srv.image ? `<div class="service-media"><img src="${srv.image}" alt="${escapeHtml(srv.name)}"></div>` : ''}
            <div class="service-header-ui">
                <div class="service-icon-box"><i class="${srv.icon}"></i></div>
                <h3>${escapeHtml(srv.name)}</h3>
                <p class="service-desc">${escapeHtml(srv.desc)}</p>
            </div>
            <div class="service-pricing-row">
                <div class="price-box">
                    <span class="price-label">Pricing Guide</span>
                    <span class="price-val">${escapeHtml(srv.price)}</span>
                </div>
                <a href="#contact" class="service-cta-link">Initiate <i class="fa-solid fa-arrow-right-long"></i></a>
            </div>
        </div>
    `).join('');
}

/* -------------------- Projects -------------------- */
function renderProjects(projects) {
    const projectsCont = document.getElementById('projects-target-grid');
    if (!projectsCont) return;
    projectsCont.innerHTML = projects.map(proj => `
        <div class="project-card" data-category="${proj.cat}">
            <div class="project-media-ph">
                ${proj.image ? `<img src="${proj.image}" alt="${escapeHtml(proj.title)}" class="project-media-img">` : ''}
                <span class="project-tag-absolute">${proj.cat.toUpperCase()}</span>
            </div>
            <div class="project-info-deck">
                <div>
                    <div class="tech-tag-row">
                        ${proj.tech.split(',').map(t => `<span class="tech-pill">${escapeHtml(t.trim())}</span>`).join('')}
                    </div>
                    <h3 class="project-title">${escapeHtml(proj.title)}</h3>
                    <p class="project-desc">${escapeHtml(proj.desc)}</p>
                </div>
                <div class="project-client-row">
                    <span>Client: ${escapeHtml(proj.client)}</span>
                    <div class="project-links">
                        ${proj.git ? `<a href="${proj.git}" class="project-link-icon" target="_blank" rel="noopener" aria-label="GitHub Repository"><i class="fa-brands fa-github"></i></a>` : ''}
                        <a href="#contact" class="project-link-icon" aria-label="Inquire Info"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

/* -------------------- Companies -------------------- */
function renderCompanies(companies) {
    const cont = document.getElementById('companies-showcase-grid');
    if (!cont) return;
    cont.innerHTML = companies.map(co => `
        <div class="company-card glass-card">
            <div class="company-brand">
                <div class="company-logo-ph">
                    ${co.logo ? `<img src="${co.logo}" alt="${escapeHtml(co.name)} logo" class="company-logo-img">` : `<i class="${co.icon || 'fa-solid fa-building'} company-icon"></i>`}
                </div>
                <h3>${escapeHtml(co.name)}</h3>
            </div>
            <p class="company-desc">${escapeHtml(co.desc)}</p>
            <ul class="company-highlights">
                ${(co.highlights || []).map(h => `<li><i class="fa-solid fa-circle-check"></i> ${escapeHtml(h)}</li>`).join('')}
            </ul>
            <div class="company-actions">
                <span class="badge-role">${escapeHtml(co.role || 'Founder')}</span>
                <a href="${co.ctaLink || '#contact'}" class="company-cta">${escapeHtml(co.ctaText || 'Learn More')} <i class="fa-solid fa-arrow-right-long"></i></a>
            </div>
        </div>
    `).join('');
}

/* -------------------- Blog / Tech Hub -------------------- */
async function renderBlogs() {
    const blogsCont = document.getElementById('blog-posts-grid');
    if (!blogsCont) return;

    const posts = await getBlogPosts({ publishedOnly: true, limit: 6 });

    if (!posts.length) {
        blogsCont.innerHTML = `<p style="color:var(--text-muted); padding:2rem 0;">No articles published yet — check back soon.</p>`;
        return;
    }

    blogsCont.innerHTML = posts.map(post => {
        const catLabel = post.blog_categories ? post.blog_categories.name : 'Article';
        const dateLabel = post.published_at
            ? new Date(post.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : '';
        return `
        <div class="blog-card">
            <div class="blog-ph">
                ${post.featured_image_url ? `<img src="${post.featured_image_url}" alt="${escapeHtml(post.title)}" class="blog-media-img">` : ''}
                <span class="blog-tag">${escapeHtml(catLabel)}</span>
            </div>
            <div class="blog-details">
                <div>
                    <div class="blog-meta">${escapeHtml(dateLabel)} • ${escapeHtml(post.author)}</div>
                    <h3 class="blog-title">${escapeHtml(post.title)}</h3>
                    <p class="blog-excerpt">${escapeHtml(post.excerpt || '')}</p>
                </div>
                <a href="post.html?slug=${encodeURIComponent(post.slug)}" class="blog-link">Access Log <i class="fa-solid fa-arrow-right-long"></i></a>
            </div>
        </div>
    `;
    }).join('');
}

/* -------------------- Business Activity Stats -------------------- */
async function renderBusinessStats() {
    const section = document.getElementById('activity');
    const grid = document.getElementById('activity-stats-grid');
    if (!section || !grid) return;

    const stats = (await getConfig('business_stats')) || {};
    const entries = [];
    if (stats.websites_developed !== null && stats.websites_developed !== undefined) {
        entries.push({ label: 'Websites Developed', val: stats.websites_developed });
    }
    if (stats.laptops_sold !== null && stats.laptops_sold !== undefined) {
        entries.push({ label: 'Laptops Sold', val: stats.laptops_sold });
    }

    if (!entries.length) { section.hidden = true; return; }
    section.hidden = false;

    grid.innerHTML = entries.map(e => `
        <div class="metric-card">
            <span class="metric-num" data-count-to="${e.val}">0</span>
            <span class="metric-label">${escapeHtml(e.label)}</span>
        </div>
    `).join('');

    animateCounters(grid);
}

function animateCounters(scope) {
    const els = scope.querySelectorAll('[data-count-to]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const target = parseInt(el.getAttribute('data-count-to'), 10) || 0;
            const duration = 1400;
            const start = performance.now();
            function tick(now) {
                const progress = Math.min((now - start) / duration, 1);
                el.textContent = Math.floor(progress * target);
                if (progress < 1) requestAnimationFrame(tick);
                else el.textContent = target;
            }
            requestAnimationFrame(tick);
            observer.unobserve(el);
        });
    }, { threshold: 0.4 });
    els.forEach(el => observer.observe(el));
}

/* -------------------- Testimonials -------------------- */
async function renderTestimonials() {
    const section = document.getElementById('testimonials');
    const grid = document.getElementById('testimonials-grid');
    if (!section || !grid) return;

    const testimonials = await getTestimonials({ publishedOnly: true });
    if (!testimonials.length) { section.hidden = true; return; }
    section.hidden = false;

    grid.innerHTML = testimonials.map(t => `
        <div class="testimonial-card">
            <i class="fa-solid fa-quote-left testimonial-quote-icon"></i>
            <p class="testimonial-text">${escapeHtml(t.testimonial)}</p>
            <div class="testimonial-client">
                <div class="testimonial-avatar">
                    ${t.photo_url ? `<img src="${t.photo_url}" alt="${escapeHtml(t.client_name)}">` : `<i class="fa-solid fa-user"></i>`}
                </div>
                <div>
                    <span class="testimonial-client-name">${escapeHtml(t.client_name)}</span>
                    ${t.client_info ? `<span class="testimonial-client-info">${escapeHtml(t.client_info)}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

/* -------------------- Portfolio Link -------------------- */
async function renderPortfolioLink() {
    const section = document.getElementById('portfolio-link');
    const btn = document.getElementById('portfolio-link-btn');
    if (!section || !btn) return;

    const link = (await getConfig('portfolio_link')) || {};
    if (!link.url) { section.hidden = true; return; }
    section.hidden = false;
    btn.setAttribute('href', link.url);
    btn.innerHTML = `${escapeHtml(link.label || 'View Portfolio')} <i class="fa-solid fa-arrow-right-long"></i>`;
}

/* -------------------- Help Desk -------------------- */
function initHelpDesk() {
    const tabs = document.querySelectorAll('.help-desk-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.help-desk-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`hd-panel-${tab.getAttribute('data-hd-tab')}`).classList.add('active');
        });
    });

    const submitForm = document.getElementById('form-submit-ticket');
    if (submitForm) {
        submitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const resultEl = document.getElementById('hd-submit-result');
            const btn = submitForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Submitting…';

            const res = await submitTicket({
                subject: document.getElementById('hd-subject').value.trim(),
                description: document.getElementById('hd-description').value.trim(),
                category: document.getElementById('hd-category').value,
                priority: document.getElementById('hd-priority').value,
                customerName: document.getElementById('hd-name').value.trim(),
                customerEmail: document.getElementById('hd-email').value.trim()
            });

            btn.disabled = false;
            btn.textContent = 'Submit Ticket';

            resultEl.hidden = false;
            if (res.ok) {
                resultEl.innerHTML = `Ticket submitted. Your reference is <strong>${escapeHtml(res.reference)}</strong> — save it to track your ticket's status.`;
                submitForm.reset();
            } else {
                resultEl.textContent = 'Something went wrong: ' + res.error;
            }
        });
    }

    const trackForm = document.getElementById('form-track-ticket');
    if (trackForm) {
        trackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const resultCont = document.getElementById('hd-track-result');
            const reference = document.getElementById('hd-track-reference').value.trim();
            const email = document.getElementById('hd-track-email').value.trim();

            const res = await trackTicket(reference, email);
            if (!res.ok) {
                resultCont.innerHTML = `<div class="hd-result">${escapeHtml(res.error)}</div>`;
                return;
            }
            renderTicketTrackResult(res.ticket, reference, email);
        });
    }
}

function renderTicketTrackResult(ticket, reference, email) {
    const cont = document.getElementById('hd-track-result');
    const statusLabels = {
        new: 'New', open: 'Open', in_progress: 'In Progress',
        waiting_on_customer: 'Waiting on Customer', resolved: 'Resolved', closed: 'Closed'
    };
    cont.innerHTML = `
        <div class="hd-ticket-card">
            <h3>${escapeHtml(ticket.subject)}</h3>
            <div class="hd-ticket-status-row">
                <span class="hd-status-badge">${statusLabels[ticket.status] || ticket.status}</span>
                <span class="hd-status-badge">${escapeHtml((ticket.priority || '').toUpperCase())}</span>
                <span class="hd-status-badge">${escapeHtml(ticket.reference)}</span>
            </div>
            <div id="hd-responses">
                ${(ticket.responses || []).map(r => `
                    <div class="hd-response">
                        <strong>${r.sender_type === 'admin' ? 'Support Team' : 'You'}</strong>
                        ${escapeHtml(r.message)}
                    </div>
                `).join('') || '<p style="color:var(--text-muted);">No responses yet.</p>'}
            </div>
            <form id="form-ticket-public-reply" class="hd-reply-form">
                <div class="form-group"><label>Add a reply</label><textarea id="hd-reply-text" rows="3" required></textarea></div>
                <button type="submit" class="btn btn-secondary btn-small">Send Reply</button>
            </form>
        </div>
    `;

    document.getElementById('form-ticket-public-reply').addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = document.getElementById('hd-reply-text').value.trim();
        if (!message) return;
        const res = await replyToTicket(reference, email, message);
        if (!res.ok) { alert('Could not send reply: ' + res.error); return; }
        const updated = await trackTicket(reference, email);
        if (updated.ok) renderTicketTrackResult(updated.ticket, reference, email);
    });
}

/* -------------------- Social Icons (real brand icons, everywhere) -------------------- */
function renderSocialIcons(social) {
    const targets = document.querySelectorAll('[data-social-target]');
    const html = social.map(s => {
        const meta = PLATFORM_MAP[s.platform] || { label: s.platform, icon: 'fa-solid fa-link' };
        return `<a href="${s.url}" target="_blank" rel="noopener" aria-label="${escapeHtml(meta.label)} Profile" class="magnetic"><i class="${meta.icon}"></i></a>`;
    }).join('');
    targets.forEach(t => t.innerHTML = html);
}

/* -------------------- Contact -------------------- */
function renderContact(contact, social) {
    const setLink = (id, href, text) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (href !== undefined) el.setAttribute('href', href);
        if (text !== undefined) el.textContent = text;
    };

    setLink('contact-personal-phone', `tel:${contact.personalPhone || ''}`, contact.personalPhone || '');
    setLink('contact-business-phone', `tel:${contact.businessPhone || ''}`, contact.businessPhone || '');
    setLink('contact-email', `mailto:${contact.email || ''}`, contact.email || '');

    const linkedin = social.find(s => s.platform === 'linkedin');
    const linkedinRow = document.getElementById('contact-linkedin-row');
    if (linkedinRow) {
        if (linkedin) {
            linkedinRow.style.display = '';
            setLink('contact-linkedin', linkedin.url, linkedin.url.replace(/^https?:\/\//, ''));
        } else {
            linkedinRow.style.display = 'none';
        }
    }

    const hoursWeekday = document.getElementById('hours-weekday');
    if (hoursWeekday) hoursWeekday.textContent = contact.hoursWeekday || '';
    const hoursSat = document.getElementById('hours-saturday');
    if (hoursSat) hoursSat.textContent = contact.hoursSaturday || '';
    const hoursSun = document.getElementById('hours-sunday');
    if (hoursSun) hoursSun.textContent = contact.hoursSunday || '';

    const waBtn = document.getElementById('whatsapp-float-btn');
    if (waBtn) {
        const msg = encodeURIComponent(contact.whatsappMessage || '');
        waBtn.setAttribute('href', `https://wa.me/${contact.whatsapp || ''}?text=${msg}`);
    }

    const companyCallBtns = document.querySelectorAll('[data-company-call]');
    companyCallBtns.forEach(btn => btn.setAttribute('href', `tel:${contact.businessPhone || ''}`));
}

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ==========================================================================
   PORTFOLIO GALLERY FILTER SYSTEM
   ========================================================================== */
function setupPortfolioFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('project-search');

    function filterDeck() {
        const projectCards = document.querySelectorAll('.project-card');
        const activeBtn = document.querySelector('.filter-btn.active');
        const activeFilter = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

        projectCards.forEach(card => {
            const cardCat = card.getAttribute('data-category');
            const cardTitle = card.querySelector('.project-title').textContent.toLowerCase();
            const cardDesc = card.querySelector('.project-desc').textContent.toLowerCase();
            const matchesFilter = (activeFilter === 'all' || cardCat === activeFilter);
            const matchesSearch = (cardTitle.includes(query) || cardDesc.includes(query));

            card.style.display = (matchesFilter && matchesSearch) ? 'flex' : 'none';
        });
    }

    filterBtns.forEach(btn => {
        if (btn.dataset.filterBound) return;
        btn.dataset.filterBound = 'true';
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterDeck();
        });
    });

    if (searchInput && !searchInput.dataset.filterBound) {
        searchInput.dataset.filterBound = 'true';
        searchInput.addEventListener('input', filterDeck);
    }
}

/* ==========================================================================
   CONTACT COMMUNICATIONS ENGINE
   ========================================================================== */
function initContactForm() {
    const contactForm = document.getElementById('portfolio-contact-form');
    if (!contactForm) return;

    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const contactData = {
            name: document.getElementById('form-name').value,
            email: document.getElementById('form-email').value,
            company: document.getElementById('form-company').value,
            phone: document.getElementById('form-phone').value,
            projectType: document.getElementById('form-project').value,
            budget: document.getElementById('form-budget').value,
            message: document.getElementById('form-message').value
        };

        console.info('Contact payload logged:', contactData);
        alert(`Thank you, ${contactData.name}. Your strategic inquiry has been successfully transmitted through local systems and archived!`);
        contactForm.reset();
    });

    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('news-email').value;
            console.info('Newsletter signup logged:', email);
            alert('Thanks for subscribing! You are now on the list.');
            newsletterForm.reset();
        });
    }
}

/* ==========================================================================
   NAVIGATION BAR & UX HELPERS
   ========================================================================== */
function initNavigationProgress() {
    const progress = document.getElementById('nav-progress');
    const b2t = document.getElementById('back-to-top');

    window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = height ? (winScroll / height) * 100 : 0;

        if (progress) progress.style.width = `${scrolled}%`;

        if (b2t) {
            if (winScroll > 600) {
                b2t.style.opacity = '1';
                b2t.style.pointerEvents = 'auto';
            } else {
                b2t.style.opacity = '0';
                b2t.style.pointerEvents = 'none';
            }
        }
    });

    if (b2t) {
        b2t.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
            menuToggle.setAttribute('aria-expanded', !expanded);
            navMenu.classList.toggle('active');
        });
    }
}

/* ==========================================================================
   ACCESSIBILITY & STANDARDS COMPLIANCE
   ========================================================================== */
function initAccessibilitySettings() {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                activeModal.classList.remove('active');
                activeModal.setAttribute('aria-hidden', 'true');
            }
        }
    });
}
