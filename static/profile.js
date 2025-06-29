document.addEventListener('DOMContentLoaded', async () => {
    const res = await fetch('/api/profile');
    const data = await res.json();
    const usernameDiv = document.getElementById('profile-username');
    const wrapper = document.getElementById('profile-content-wrapper');
    if (!data.success) {
        usernameDiv.textContent = "Profile";
        wrapper.innerHTML = `<div style="color:red;">${data.error || 'Failed to load profile.'}</div>`;
        return;
    }
    const p = data.profile;
    const usernameTextSpan = document.getElementById('profile-username-text');
    if (usernameTextSpan) usernameTextSpan.textContent = p.username || '';

    // Clear wrapper
    wrapper.innerHTML = '';

    // Statistics card
    const statsSection = document.createElement('div');
    statsSection.className = 'profile-section';
    statsSection.innerHTML = `
        <h2>Statistics</h2>
        <ul>
            <li><span class="profile-label">Total Wins</span> <span class="profile-value">${p.statistics.total_wins}</span></li>
            <li><span class="profile-label">Total Losses</span> <span class="profile-value">${p.statistics.total_losses}</span></li>
            <li><span class="profile-label">Most Used Team ID</span> <span class="profile-value">${p.statistics.most_used_team_id ?? 'N/A'}</span></li>
            <li><span class="profile-label">Most Used Pokémon ID</span> <span class="profile-value">${p.statistics.most_used_pokemon_id ?? 'N/A'}</span></li>
        </ul>
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