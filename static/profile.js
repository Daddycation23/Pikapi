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

// Setup navbar authentication
async function setupNavAuth() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();
        
        const authSection = document.getElementById('nav-auth');
        if (data.username) {
            authSection.innerHTML = `
                <span class="welcome-text">Welcome, ${data.username}</span>
                <button class="btn-standard btn-logout" onclick="logout()">Logout</button>
            `;
        } else {
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

document.addEventListener('DOMContentLoaded', async () => {
    // Setup navbar
    setupMobileMenu();
    await setupNavAuth();
    
    // Fetch username for greeting
    const profileRes = await fetch('/api/profile');
    const profileData = await profileRes.json();
    const usernameDiv = document.getElementById('profile-username');
    const wrapper = document.getElementById('profile-content-wrapper');
    if (!profileData.success) {
        usernameDiv.textContent = "Profile";
        wrapper.innerHTML = `<div style="color:red;">${profileData.error || 'Failed to load profile.'}</div>`;
        return;
    }
    const p = profileData.profile;
    const usernameTextSpan = document.getElementById('profile-username-text');
    if (usernameTextSpan) usernameTextSpan.textContent = p.username || '';

    // Fetch stats from new endpoint
    const statsRes = await fetch('/api/user_stats');
    const statsData = await statsRes.json();

    // Clear wrapper
    wrapper.innerHTML = '';

    // Statistics card with most used team and Pokémon
    const statsSection = document.createElement('div');
    statsSection.className = 'profile-section';
    statsSection.innerHTML = `
        <h2>Statistics</h2>
        <ul>
            <li><span class="profile-label">Total Wins</span> <span class="profile-value">${statsData.total_wins}</span></li>
            <li><span class="profile-label">Total Losses</span> <span class="profile-value">${statsData.total_losses}</span></li>
        </ul>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; margin-top: 24px;">
            <div style="flex: 1;">
                <div style="font-weight: bold; margin-bottom: 8px; color: #2196F3;">Most Used Team</div>
                <div style="display: flex; gap: 12px;">
                    ${statsData.most_used_team && statsData.most_used_team.length > 0 ? statsData.most_used_team.map(pokemon => `
                        <div class="pokemon-card" style="text-align:center;">
                            <img src="/static/images/${pokemon.pokemon_id}.png" alt="${pokemon.name}" style="width:64px;height:64px;display:block;margin:0 auto;">
                            <div style="font-size:0.95em; font-weight:600;">${pokemon.name}</div>
                            <div style="font-size:0.85em; color:#666;">${pokemon.type1}${pokemon.type2 ? ' / ' + pokemon.type2 : ''}</div>
                        </div>
                    `).join('') : '<div style="color:#888;">N/A</div>'}
                </div>
            </div>
            <div style="flex: 0 0 220px; text-align:center;">
                <div style="font-weight: bold; margin-bottom: 8px; color: #2196F3;">Most Used Pokémon</div>
                ${statsData.most_used_pokemon ? `
                    <div class="pokemon-card" style="text-align:center;">
                        <img src="/static/images/${statsData.most_used_pokemon.pokemon_id}.png" alt="${statsData.most_used_pokemon.name}" style="width:80px;height:80px;display:block;margin:0 auto;">
                        <div style="font-size:1.1em; font-weight:700;">${statsData.most_used_pokemon.name}</div>
                        <div style="font-size:0.95em; color:#666;">${statsData.most_used_pokemon.type1}${statsData.most_used_pokemon.type2 ? ' / ' + statsData.most_used_pokemon.type2 : ''}</div>
                    </div>
                ` : '<div style="color:#888;">N/A</div>'}
            </div>
        </div>
    `;

    // Last Battle card
    const lastBattleSection = document.createElement('div');
    lastBattleSection.className = 'profile-section';
    lastBattleSection.innerHTML = `
        <h2>Last Battle</h2>
        <ul>
            <li><span class="profile-label">Last Battle ID</span> <span class="profile-value">${p.last_battle_id ?? 'N/A'}</span></li>
        </ul>
    `;

    // Append all sections
    wrapper.appendChild(statsSection);
    wrapper.appendChild(lastBattleSection);
});