document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/battle/history')
        .then(res => res.json())
        .then(data => renderHistory(data.records || []));
});

function renderHistory(records) {
    const list = document.getElementById('history-list');
    if (!records.length) {
        list.innerHTML = '<div style="text-align:center;color:#888;">No battle history yet.</div>';
        return;
    }
    records.forEach((rec, idx) => {
        const div = document.createElement('div');
        div.className = 'record';
        const resultClass = rec.result === 'win' ? 'win' : 'loss';
        const resultText = rec.result === 'win' ? 'Victory' : 'Defeat';
        const ts = rec.timestamp ? new Date(rec.timestamp).toLocaleString() : '';
        div.innerHTML = `
            <div class="record-header">
                <span class="result ${resultClass}">${resultText}</span>
                <span class="timestamp">${ts}</span>
            </div>
            <div class="teams">
                <div class="team">
                    <div class="team-title">Your Team</div>
                    <div class="pokemon-list">
                        ${renderTeam(rec.player_team)}
                    </div>
                </div>
                <div class="team">
                    <div class="team-title">Enemy Team</div>
                    <div class="pokemon-list">
                        ${renderTeam(rec.enemy_team)}
                    </div>
                </div>
            </div>
            <div class="battle-log-toggle" data-idx="${idx}">Show Battle Log &#9660;</div>
            <div class="battle-log" id="battle-log-${idx}">
                ${rec.battle_log.map(line => `<div>${escapeHtml(line)}</div>`).join('')}
            </div>
        `;
        list.appendChild(div);
    });
    // Add expand/collapse logic
    document.querySelectorAll('.battle-log-toggle').forEach(el => {
        el.addEventListener('click', function() {
            const idx = this.getAttribute('data-idx');
            const log = document.getElementById('battle-log-' + idx);
            if (log.classList.contains('open')) {
                log.classList.remove('open');
                this.innerHTML = 'Show Battle Log &#9660;';
            } else {
                log.classList.add('open');
                this.innerHTML = 'Hide Battle Log &#9650;';
            }
        });
    });
}

function renderTeam(team) {
    if (!team || !team.length) return '<span style="color:#bbb;">N/A</span>';
    return team.map(poke => {
        const hp = poke.hp !== undefined ? poke.hp : poke.current_hp;
        const maxHp = poke.max_hp || 100;
        const fainted = (hp === 0);
        const percent = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
        return `
            <div class="pokemon">
                <img src="/static/images/${poke.id || poke.pokemon_id || 0}.png" class="${fainted ? 'fainted' : ''}" title="${poke.name || 'Pokémon'}">
                <div style="font-size:0.9em;">${poke.name || ''}</div>
                <div class="hp-bar"><div class="hp-bar-inner" style="width:${percent}%;background:${fainted ? '#aaa' : '#4caf50'}"></div></div>
            </div>
        `;
    }).join('');
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function(m) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]);
    });
} 