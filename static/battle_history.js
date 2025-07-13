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
        div.className = 'profile-section battle-card ' + (rec.result === 'win' ? 'battle-win' : 'battle-loss');
        // Heading
        const heading = document.createElement('div');
        heading.className = 'battle-result-heading';
        heading.textContent = rec.result === 'win' ? 'WIN' : 'LOSS';
        div.appendChild(heading);
        // Teams
        const teams = document.createElement('div');
        teams.className = 'teams';
        // Player team
        const playerTeam = document.createElement('div');
        playerTeam.className = 'team player-team';
        const playerTitle = document.createElement('div');
        playerTitle.className = 'team-title';
        playerTitle.textContent = 'Your Team';
        playerTeam.appendChild(playerTitle);
        const playerList = document.createElement('div');
        playerList.className = 'pokemon-list';
        (rec.player_team || []).forEach(p => {
            const pokeDiv = document.createElement('div');
            pokeDiv.className = 'pokemon' + (p.fainted ? ' fainted' : '');
            // Icon
            const img = document.createElement('img');
            img.src = `/static/images/${p.id}.png`;
            img.alt = p.name;
            if (p.fainted) img.classList.add('fainted');
            pokeDiv.appendChild(img);
            // Name
            const name = document.createElement('div');
            name.className = 'pokemon-name';
            name.textContent = p.name;
            pokeDiv.appendChild(name);
            // HP
            const hp = document.createElement('div');
            hp.className = 'pokemon-hp';
            const hpText = document.createElement('span');
            hpText.textContent = `${p.current_hp} / ${p.max_hp}`;
            hp.appendChild(hpText);
            // HP bar
            const hpBar = document.createElement('div');
            hpBar.className = 'hp-bar';
            const hpBarInner = document.createElement('div');
            hpBarInner.className = 'hp-bar-inner';
            const percent = p.max_hp ? Math.max(0, Math.round((p.current_hp / p.max_hp) * 100)) : 0;
            hpBarInner.style.width = percent + '%';
            if (p.fainted || percent === 0) {
                hpBarInner.style.background = 'var(--border-light)';
            } else if (percent < 25) {
                hpBarInner.style.background = 'var(--danger-color)';
            } else if (percent < 50) {
                hpBarInner.style.background = 'var(--secondary-color)';
            } else {
                hpBarInner.style.background = 'var(--primary-color)';
            }
            hpBar.appendChild(hpBarInner);
            hp.appendChild(hpBar);
            pokeDiv.appendChild(hp);
            playerList.appendChild(pokeDiv);
        });
        playerTeam.appendChild(playerList);
        // Enemy team
        const enemyTeam = document.createElement('div');
        enemyTeam.className = 'team enemy-team';
        const enemyTitle = document.createElement('div');
        enemyTitle.className = 'team-title';
        enemyTitle.textContent = 'Enemy Team';
        enemyTeam.appendChild(enemyTitle);
        const enemyList = document.createElement('div');
        enemyList.className = 'pokemon-list';
        (rec.enemy_team || []).forEach(p => {
            const pokeDiv = document.createElement('div');
            pokeDiv.className = 'pokemon' + (p.fainted ? ' fainted' : '');
            // Icon
            const img = document.createElement('img');
            img.src = `/static/images/${p.id}.png`;
            img.alt = p.name;
            if (p.fainted) img.classList.add('fainted');
            pokeDiv.appendChild(img);
            // Name
            const name = document.createElement('div');
            name.className = 'pokemon-name';
            name.textContent = p.name;
            pokeDiv.appendChild(name);
            // HP
            const hp = document.createElement('div');
            hp.className = 'pokemon-hp';
            const hpText = document.createElement('span');
            hpText.textContent = `${p.current_hp} / ${p.max_hp}`;
            hp.appendChild(hpText);
            // HP bar
            const hpBar = document.createElement('div');
            hpBar.className = 'hp-bar';
            const hpBarInner = document.createElement('div');
            hpBarInner.className = 'hp-bar-inner';
            const percent = p.max_hp ? Math.max(0, Math.round((p.current_hp / p.max_hp) * 100)) : 0;
            hpBarInner.style.width = percent + '%';
            if (p.fainted || percent === 0) {
                hpBarInner.style.background = 'var(--border-light)';
            } else if (percent < 25) {
                hpBarInner.style.background = 'var(--danger-color)';
            } else if (percent < 50) {
                hpBarInner.style.background = 'var(--secondary-color)';
            } else {
                hpBarInner.style.background = 'var(--primary-color)';
            }
            hpBar.appendChild(hpBarInner);
            hp.appendChild(hpBar);
            pokeDiv.appendChild(hp);
            enemyList.appendChild(pokeDiv);
        });
        enemyTeam.appendChild(enemyList);
        // Center both teams
        teams.appendChild(playerTeam);
        teams.appendChild(enemyTeam);
        div.appendChild(teams);
        // Timestamp
        const ts = document.createElement('div');
        ts.className = 'timestamp';
        const date = new Date(rec.timestamp);
        ts.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        div.appendChild(ts);
        // Battle log
        const logToggle = document.createElement('div');
        logToggle.className = 'battle-log-toggle';
        logToggle.textContent = 'Show Battle Log';
        logToggle.setAttribute('data-idx', idx);
        div.appendChild(logToggle);
        const logDiv = document.createElement('div');
        logDiv.className = 'battle-log';
        logDiv.style.display = 'none';
        logDiv.innerHTML = (rec.battle_log || []).map(line => `&gt; ${line}`).join('<br>');
        div.appendChild(logDiv);
        logToggle.addEventListener('click', () => {
            // Collapse all other logs
            document.querySelectorAll('.battle-log').forEach((el, i) => {
                if (i !== idx) {
                    el.style.display = 'none';
                    const toggle = document.querySelector(`.battle-log-toggle[data-idx="${i}"]`);
                    if (toggle) toggle.textContent = 'Show Battle Log';
                }
            });
            // Toggle this one
            if (logDiv.style.display === 'none') {
                logDiv.style.display = 'block';
                logToggle.textContent = 'Hide Battle Log';
            } else {
                logDiv.style.display = 'none';
                logToggle.textContent = 'Show Battle Log';
            }
        });
        list.appendChild(div);
    });
} 