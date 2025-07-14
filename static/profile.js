// Profile page specific functionality

document.addEventListener('DOMContentLoaded', async () => {
    
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

    // Preferences card
    const prefsSection = document.createElement('div');
    prefsSection.className = 'profile-section';
    prefsSection.innerHTML = `
        <h2>Preferences</h2>
        <ul>
            <li><span class="profile-label">Sound</span> <span class="profile-value">${p.preferences.sound ? 'On' : 'Off'}</span></li>
            <li><span class="profile-label">Theme</span> <span class="profile-value">${p.preferences.theme}</span></li>
        </ul>
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
    wrapper.appendChild(prefsSection);
    wrapper.appendChild(lastBattleSection);
});