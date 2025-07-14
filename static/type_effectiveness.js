// Update navigation visibility based on authentication status
function updateNavigationVisibility(isAuthenticated) {
    // Handle auth-required items (show when authenticated)
    const authRequiredItems = document.querySelectorAll('.auth-required');
    authRequiredItems.forEach(item => {
        if (isAuthenticated) {
            item.classList.add('authenticated');
        } else {
            item.classList.remove('authenticated');
        }
    });
    
    // Handle guest-only items (hide when authenticated)
    const guestOnlyItems = document.querySelectorAll('.guest-only');
    guestOnlyItems.forEach(item => {
        if (isAuthenticated) {
            item.classList.add('authenticated');
        } else {
            item.classList.remove('authenticated');
        }
    });
}

// Setup mobile menu functionality
function setupMobileMenu() {
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const navLinks = document.getElementById('nav-links');
    const navAuth = document.getElementById('nav-auth');
    
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
            navAuth.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.navbar')) {
            mobileToggle?.classList.remove('active');
            navLinks?.classList.remove('active');
            navAuth?.classList.remove('active');
        }
    });
}

// Back button functionality
function goBack() {
    // Go back to previous page in browser history
    window.history.back();
}

// Setup navbar authentication
async function setupNavAuth() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();
        
        const authSection = document.getElementById('nav-auth');
        if (data.username) {
            // Update navigation visibility for authenticated user
            updateNavigationVisibility(true);
            authSection.innerHTML = `
                <span class="welcome-text">Welcome, ${data.username}</span>
                <button class="btn-standard btn-logout" onclick="logout()">Logout</button>
            `;
        } else {
            // Update navigation visibility for non-authenticated user
            updateNavigationVisibility(false);
            authSection.innerHTML = `
                <button class="btn-standard btn-profile" onclick="window.location.href='/'">Login</button>
                <button class="btn-standard btn-profile" onclick="window.location.href='/'">Register</button>
            `;
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/';
    }
}

const typeColors = {
    'normal': '#A8A878',
    'fire': '#F08030',
    'water': '#6890F0',
    'electric': '#F8D030',
    'grass': '#78C850',
    'ice': '#98D8D8',
    'fighting': '#C03028',
    'poison': '#A040A0',
    'ground': '#E0C068',
    'flying': '#A890F0',
    'psychic': '#F85888',
    'bug': '#A8B820',
    'rock': '#B8A038',
    'ghost': '#705898',
    'dragon': '#7038F8',
    'dark': '#705848',
    'steel': '#B8B8D0',
    'fairy': '#EE99AC'
};

let currentRotation = 0;
let selectedType = null;

const canvas = document.getElementById('typeWheelCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const types = Object.keys(typeColors);
const sliceAngle = 2 * Math.PI / types.length;

// Change the fancy font for wheel types
const fancyFont = "'Fredoka One', 'Comic Sans MS', cursive, sans-serif";

let hoveredTypeIndex = null;

function drawTypeWheel(rotation = 0) {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 10;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    types.forEach((type, i) => {
        // Highlight hovered segment
        if (i === hoveredTypeIndex) {
            ctx.save();
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 18;
            ctx.globalAlpha = 0.92;
        }
        // Draw slice
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, i * sliceAngle, (i + 1) * sliceAngle);
        ctx.closePath();
        ctx.fillStyle = typeColors[type];
        ctx.fill();
        if (i === hoveredTypeIndex) {
            ctx.restore();
        }
        // Draw text
        ctx.save();
        ctx.rotate((i + 0.5) * sliceAngle);
        ctx.textAlign = 'right';
        ctx.font = `bold 22px ${fancyFont}`;
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.textBaseline = 'middle';
        ctx.strokeText(type.charAt(0).toUpperCase() + type.slice(1), radius - 10, 0);
        ctx.fillText(type.charAt(0).toUpperCase() + type.slice(1), radius - 10, 0);
        ctx.restore();
    });
    ctx.restore();
}

function getSelectedType(rotation) {
    // 0 rad is up, so invert rotation and map to type
    let angle = (3 * Math.PI / 2 - rotation) % (2 * Math.PI);
    if (angle < 0) angle += 2 * Math.PI;
    const idx = Math.floor(angle / sliceAngle) % types.length;
    return types[idx];
}

function selectType(type) {
    if (selectedType === type) return; // Prevent unnecessary updates
    selectedType = type;
    // Only update the selected type badge and effectiveness display
    const typeBadge = document.querySelector('.selected-type .type-badge');
    if (typeBadge) {
        typeBadge.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        typeBadge.style.backgroundColor = typeColors[type];
    }
    updateEffectivenessDisplay(type);
}

async function updateEffectivenessDisplay(type) {
    const display = document.querySelector('.type-effectiveness-display');
    const sections = display.querySelectorAll('.effectiveness-section');
    let loadingTimeout = null;
    let loadingShown = false;
    // Show loading indicator only if fetch is slow
    loadingTimeout = setTimeout(() => {
        loadingShown = true;
        sections.forEach(section => {
            const typeList = section.querySelector('.type-list');
            if (typeList.childElementCount === 0) {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading-message';
                loadingDiv.textContent = 'Loading...';
                typeList.appendChild(loadingDiv);
            }
        });
    }, 150);
    try {
        const data = await fetchTypeEffectiveness(type);
        clearTimeout(loadingTimeout);
        // Now update the DOM with new data (replace the old content)
        sections.forEach(section => {
            const typeList = section.querySelector('.type-list');
            while (typeList.firstChild) typeList.removeChild(typeList.firstChild);
        });
        Object.entries(data).forEach(([effectiveness, types]) => {
            const section = display.querySelector(`[data-effectiveness="${effectiveness}"]`);
            if (!section) return;
            const typeList = section.querySelector('.type-list');
            types.forEach(defType => {
                const badge = document.createElement('div');
                badge.className = 'type-badge';
                badge.textContent = defType.charAt(0).toUpperCase() + defType.slice(1);
                badge.style.backgroundColor = typeColors[defType.toLowerCase()];
                typeList.appendChild(badge);
            });
        });
    } catch (error) {
        clearTimeout(loadingTimeout);
        // Show error message only in the type lists
        sections.forEach(section => {
            const typeList = section.querySelector('.type-list');
            while (typeList.firstChild) typeList.removeChild(typeList.firstChild);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = 'Failed to load type data. Please try again.';
            typeList.appendChild(errorDiv);
        });
    }
}

function setupTypeWheel() {
    if (!canvas) return;
    drawTypeWheel(currentRotation);
}

async function fetchTypeEffectiveness(type) {
    try {
        const response = await fetch(`/api/type_effectiveness/${type.toLowerCase()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching type effectiveness:', error);
        throw error;
    }
}

function getTypeIndexAtCanvasPos(x, y) {
    const rect = canvas.getBoundingClientRect();
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const dx = x - rect.left - cx;
    const dy = y - rect.top - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > Math.min(cx, cy) - 10) return null;
    let angle = Math.atan2(dy, dx);
    // Use normalized currentRotation only
    let normRotation = ((currentRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    angle -= normRotation;
    if (angle < 0) angle += 2 * Math.PI;
    let idx = Math.floor(angle / sliceAngle);
    if (idx < 0 || idx >= types.length) return null;
    return idx;
}

if (canvas) {
    canvas.addEventListener('mousemove', (e) => {
        const idx = getTypeIndexAtCanvasPos(e.clientX, e.clientY);
        if (idx !== hoveredTypeIndex) {
            hoveredTypeIndex = idx;
            drawTypeWheel(currentRotation);
            canvas.style.cursor = (idx !== null) ? 'pointer' : 'default';
        }
    });
    canvas.addEventListener('mouseleave', () => {
        if (hoveredTypeIndex !== null) {
            hoveredTypeIndex = null;
            drawTypeWheel(currentRotation);
            canvas.style.cursor = 'default';
        }
    });
    canvas.addEventListener('click', (e) => {
        const idx = getTypeIndexAtCanvasPos(e.clientX, e.clientY);
        if (idx !== null) {
            selectType(types[idx]);
        }
    });
}

// Preload fancy font before drawing wheel
function preloadFancyFont(callback) {
    const font = new FontFace('Luckiest Guy', "url(https://fonts.gstatic.com/s/luckiestguy/v21/_gP_1RrxsjcxVyin9l9n_j2hTd52.woff2)");
    font.load().then(function(loadedFont) {
        document.fonts.add(loadedFont);
        callback();
    }).catch(function() {
        // Fallback: still call callback
        callback();
    });
}

function lockCanvasSize() {
    if (!canvas) return;
    // Set width/height attributes and style explicitly
    canvas.width = 400;
    canvas.height = 400;
    canvas.style.width = '400px';
    canvas.style.height = '400px';
}

document.addEventListener('DOMContentLoaded', async () => {
    setupMobileMenu();
    await setupNavAuth();
    
    lockCanvasSize();
    preloadFancyFont(() => {
        setupTypeWheel();
        // Initialize with a random type
        const randomType = types[Math.floor(Math.random() * types.length)];
        selectType(randomType);
        // Remove the Spin button
        const spinButton = document.querySelector('.center-button');
        if (spinButton) spinButton.remove();
    });
}); 