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

    // --- Battle History Card Helpers (copied from battle_history.js) ---
    function createTeamPokemon(team) {
        if (!team || team.length === 0) {
            return '<div class="pokemon-card empty">No Pokemon</div>';
        }
        return team.map(pokemon => {
            const isFainted = pokemon.current_hp === 0 || pokemon.fainted;
            const hpPercent = pokemon.max_hp ? Math.max(0, (pokemon.current_hp / pokemon.max_hp) * 100) : 0;
            let hpClass = 'high';
            if (isFainted || hpPercent === 0) hpClass = 'fainted';
            else if (hpPercent < 25) hpClass = 'low';
            else if (hpPercent < 50) hpClass = 'medium';
            const pokemonId = pokemon.id || pokemon.pokemon_id;
            const imageUrl = `/static/images/${pokemonId}.png`;
            return `
                <div class="pokemon-card ${isFainted ? 'fainted' : ''}">
                    <div class="pokemon-image">
                        <img src="${imageUrl}" alt="${pokemon.name}" onerror="this.src='/static/images/1.png'" />
                    </div>
                    <div class="pokemon-name">${pokemon.name}</div>
                    <div class="pokemon-hp">${pokemon.current_hp || 0} / ${pokemon.max_hp || 0}</div>
                    <div class="hp-bar">
                        <div class="hp-bar-fill ${hpClass}" style="width: ${hpPercent}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
    function createBattleLogContent(battleLog) {
        if (!battleLog || battleLog.length === 0) {
            return '<div class="battle-log-line">No battle log available</div>';
        }
        return battleLog.map(line => `<div class="battle-log-line">&gt; ${line}</div>`).join('');
    }
    // --- End helpers ---

    // Last Battle card
    let lastBattleHtml = '<div style="color:#888;">No battles found.</div>';
    let highestLevelBattleHtml = '<div style="color:#888;">No battles found.</div>';
    try {
        const battleHistoryRes = await fetch('/api/battle/history');
        const battleHistoryData = await battleHistoryRes.json();
        const records = battleHistoryData.records || [];
        const lastBattle = records.length > 0 ? records[0] : null;
        if (lastBattle) {
            const date = new Date(lastBattle.timestamp);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const level = lastBattle.level || 'Unknown';
            const result = lastBattle.result;
            const resultClass = result === 'win' ? 'win' : 'loss';
            const resultText = result === 'win' ? 'Victory' : 'Defeat';
            lastBattleHtml = `
                <div class="battle-record battle-${result}">
                    <div class="battle-header">
                        <div class="battle-result-row">
                            <div class="battle-result ${resultClass}">${resultText}</div>
                            <div class="battle-meta">
                                <div class="battle-date">📅 ${dateStr} at ${timeStr}</div>
                                <div class="battle-level">⭐ Level ${level}</div>
                            </div>
                        </div>
                    </div>
                    <div class="teams-container">
                        <div class="teams-row">
                            <div class="team-section player-team">
                                <div class="team-title">Your Team</div>
                                <div class="pokemon-grid">
                                    ${createTeamPokemon(lastBattle.player_team || [])}
                                </div>
                            </div>
                            <div class="vs-divider">VS</div>
                            <div class="team-section enemy-team">
                                <div class="team-title">Enemy Team</div>
                                <div class="pokemon-grid">
                                    ${createTeamPokemon(lastBattle.enemy_team || [])}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="battle-log-section">
                        <div class="battle-log-toggle" onclick="toggleProfileBattleLog()">
                            <span>Battle Log</span>
                        </div>
                        <div class="battle-log" id="profile-battle-log">
                            <div class="battle-log-content">
                                ${createBattleLogContent(lastBattle.battle_log || [])}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        // Highest Level Battle
        let highestLevelBattle = null;
        for (const battle of records) {
            if (battle.level !== undefined && battle.level !== null) {
                if (!highestLevelBattle || battle.level > highestLevelBattle.level) {
                    highestLevelBattle = battle;
                }
            }
        }
        if (highestLevelBattle) {
            const date = new Date(highestLevelBattle.timestamp);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const level = highestLevelBattle.level || 'Unknown';
            const result = highestLevelBattle.result;
            const resultClass = result === 'win' ? 'win' : 'loss';
            const resultText = result === 'win' ? 'Victory' : 'Defeat';
            highestLevelBattleHtml = `
                <div class="battle-record battle-${result}">
                    <div class="battle-header">
                        <div class="battle-result-row">
                            <div class="battle-result ${resultClass}">${resultText}</div>
                            <div class="battle-meta">
                                <div class="battle-date">📅 ${dateStr} at ${timeStr}</div>
                                <div class="battle-level">⭐ Level ${level}</div>
                            </div>
                        </div>
                    </div>
                    <div class="teams-container">
                        <div class="teams-row">
                            <div class="team-section player-team">
                                <div class="team-title">Your Team</div>
                                <div class="pokemon-grid">
                                    ${createTeamPokemon(highestLevelBattle.player_team || [])}
                                </div>
                            </div>
                            <div class="vs-divider">VS</div>
                            <div class="team-section enemy-team">
                                <div class="team-title">Enemy Team</div>
                                <div class="pokemon-grid">
                                    ${createTeamPokemon(highestLevelBattle.enemy_team || [])}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="battle-log-section">
                        <div class="battle-log-toggle" onclick="toggleProfileHighestLevelBattleLog()">
                            <span>Battle Log</span>
                        </div>
                        <div class="battle-log" id="profile-highest-level-battle-log">
                            <div class="battle-log-content">
                                ${createBattleLogContent(highestLevelBattle.battle_log || [])}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        lastBattleHtml = '<div style="color:red;">Failed to load last battle.</div>';
        highestLevelBattleHtml = '<div style="color:red;">Failed to load highest level battle.</div>';
    }
    const lastBattleSection = document.createElement('div');
    lastBattleSection.className = 'profile-section';
    lastBattleSection.innerHTML = `
        <h2>Last Battle</h2>
        ${lastBattleHtml}
    `;

    // Highest Level Battle section
    const highestLevelBattleSection = document.createElement('div');
    highestLevelBattleSection.className = 'profile-section';
    highestLevelBattleSection.innerHTML = `
        <h2>Highest Level Battle</h2>
        ${highestLevelBattleHtml}
    `;

    // Append all sections
    wrapper.appendChild(statsSection);
    wrapper.appendChild(lastBattleSection);
    wrapper.appendChild(highestLevelBattleSection);
});

// Add toggle logic for profile battle log
window.toggleProfileBattleLog = function() {
    const logElement = document.getElementById('profile-battle-log');
    const toggleElement = document.querySelector('.battle-log-toggle');
    const isExpanded = logElement.classList.contains('expanded');
    if (isExpanded) {
        logElement.classList.remove('expanded');
        toggleElement.classList.remove('expanded');
    } else {
        logElement.classList.add('expanded');
        toggleElement.classList.add('expanded');
    }
}
// Add toggle logic for highest level battle log
window.toggleProfileHighestLevelBattleLog = function() {
    const logElement = document.getElementById('profile-highest-level-battle-log');
    const toggleElement = document.querySelectorAll('.battle-log-toggle')[1];
    const isExpanded = logElement.classList.contains('expanded');
    if (isExpanded) {
        logElement.classList.remove('expanded');
        toggleElement.classList.remove('expanded');
    } else {
        logElement.classList.add('expanded');
        toggleElement.classList.add('expanded');
    }
}