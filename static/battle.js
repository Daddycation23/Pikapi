// Battle System JavaScript - Flask-based Version
let battleState = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeBattle();
    setupEventListeners();
});

function initializeBattle() {
    // Start a new battle with the server
    fetch('/api/battle/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('Battle start error:', data.error);
            return;
        }
        
        battleState = data;
        updateBattleDisplay();
        updateBattleLog();
    })
    .catch(error => {
        console.error('Error starting battle:', error);
    });
}

function updateBattleDisplay() {
    if (!battleState) return;
    
    // Update player Pokemon display
    const player = battleState.player_pokemon;
    document.getElementById('player-name').textContent = player.name;
    document.getElementById('player-level').textContent = `Lv. ${player.level || 50}`;
    document.getElementById('player-sprite').src = `/api/pokemon_image/${player.id}`;
    updateHealthBar('player', player.hp, player.hp);

    // Update enemy Pokemon display
    const enemy = battleState.enemy_pokemon;
    document.getElementById('enemy-name').textContent = enemy.name;
    document.getElementById('enemy-level').textContent = `Lv. ${enemy.level || 50}`;
    document.getElementById('enemy-sprite').src = `/api/pokemon_image/${enemy.id}`;
    updateHealthBar('enemy', enemy.hp, enemy.hp);

    // Update move buttons
    updateMoveButtons();
}

function updateMoveButtons() {
    if (!battleState || !battleState.player_pokemon) return;
    
    const moves = battleState.player_pokemon.moves || ['Tackle', 'Growl', 'Scratch', 'Leer'];
    for (let i = 0; i < 4; i++) {
        const moveBtn = document.getElementById(`move-${i + 1}`);
        if (moveBtn) {
            moveBtn.textContent = moves[i] || '---';
            moveBtn.disabled = !moves[i];
        }
    }
}

function updateHealthBar(target, currentHp, maxHp) {
    const percentage = (currentHp / maxHp) * 100;
    const healthFill = document.getElementById(`${target}-health-fill`);
    const healthText = document.getElementById(`${target}-health-text`);
    
    if (healthFill && healthText) {
        healthFill.style.width = `${percentage}%`;
        healthText.textContent = `${currentHp}/${maxHp}`;

        // Change color based on health percentage
        if (percentage > 50) {
            healthFill.style.background = 'linear-gradient(90deg, #44aa44, #66cc66)';
        } else if (percentage > 25) {
            healthFill.style.background = 'linear-gradient(90deg, #ffaa44, #ffcc66)';
        } else {
            healthFill.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
        }
    }
}

function updateBattleLog() {
    if (!battleState || !battleState.battle_log) return;
    
    const battleLog = document.getElementById('battle-log');
    battleLog.innerHTML = '';
    
    battleState.battle_log.forEach(message => {
        const logMessage = document.createElement('div');
        logMessage.className = 'log-message';
        logMessage.textContent = message;
        battleLog.appendChild(logMessage);
    });
    
    // Auto-scroll to bottom
    battleLog.scrollTop = battleLog.scrollHeight;
}

function setupEventListeners() {
    // Menu buttons
    const fightBtn = document.getElementById('fight-btn');
    const pokemonBtn = document.getElementById('pokemon-btn');
    
    if (fightBtn) {
        fightBtn.addEventListener('click', function() {
            showMoveSelection();
        });
    }
    
    if (pokemonBtn) {
        pokemonBtn.addEventListener('click', function() {
            showPokemonSelection();
        });
    }

    // Move selection
    const backToMenuBtn = document.getElementById('back-to-menu');
    if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', function() {
            showMainMenu();
        });
    }
    
    // Set up move button event listeners
    setTimeout(() => {
        const moveBtns = document.querySelectorAll('.move-btn');
        moveBtns.forEach((btn, index) => {
            btn.addEventListener('click', function(e) {
                useMove(index);
            });
        });
    }, 100);

    // Pokemon selection
    const backToMenuPokemonBtn = document.getElementById('back-to-menu-pokemon');
    if (backToMenuPokemonBtn) {
        backToMenuPokemonBtn.addEventListener('click', function() {
            showMainMenu();
        });
    }
}

function showMainMenu() {
    document.getElementById('battle-menu').style.display = 'block';
    document.getElementById('move-selection').style.display = 'none';
    document.getElementById('pokemon-selection').style.display = 'none';
}

function showMoveSelection() {
    document.getElementById('battle-menu').style.display = 'none';
    document.getElementById('move-selection').style.display = 'block';
    document.getElementById('pokemon-selection').style.display = 'none';
    
    // Re-setup move button event listeners
    setTimeout(() => {
        const moveBtns = document.querySelectorAll('.move-btn');
        moveBtns.forEach((btn, index) => {
            // Remove existing listeners to prevent duplicates
            btn.replaceWith(btn.cloneNode(true));
        });
        
        // Re-get the buttons and add listeners
        const newMoveBtns = document.querySelectorAll('.move-btn');
        newMoveBtns.forEach((btn, index) => {
            btn.addEventListener('click', function(e) {
                useMove(index);
            });
        });
    }, 50);
}

function showPokemonSelection() {
    document.getElementById('battle-menu').style.display = 'none';
    document.getElementById('pokemon-selection').style.display = 'block';
    populatePokemonList();
}

function populatePokemonList() {
    if (!battleState || !battleState.player_team) return;
    
    const pokemonList = document.getElementById('pokemon-list');
    pokemonList.innerHTML = '';

    battleState.player_team.forEach((pokemon, index) => {
        const pokemonItem = document.createElement('div');
        pokemonItem.className = 'pokemon-item';
        pokemonItem.innerHTML = `
            <img src="/api/pokemon_image/${pokemon.id}" alt="${pokemon.name}" onerror="this.src='/static/images/placeholder.png'">
            <div class="name">${pokemon.name}</div>
            <div class="health">${pokemon.hp}/${pokemon.hp}</div>
        `;
        
        if (pokemon.hp > 0) {
            if (index === battleState.current_player_index) {
                pokemonItem.style.opacity = '0.5';
                pokemonItem.style.cursor = 'not-allowed';
                pokemonItem.innerHTML += '<div style="color: #666; font-size: 12px;">Current</div>';
            } else {
                pokemonItem.addEventListener('click', function() {
                    switchPokemon(index);
                });
                pokemonItem.style.cursor = 'pointer';
            }
        } else {
            pokemonItem.style.opacity = '0.5';
            pokemonItem.style.cursor = 'not-allowed';
            pokemonItem.innerHTML += '<div style="color: #666; font-size: 12px;">Fainted</div>';
        }
        
        pokemonList.appendChild(pokemonItem);
    });
}

function useMove(moveIndex) {
    fetch('/api/battle/use-move', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            move_index: moveIndex
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('Move error:', data.error);
            return;
        }
        
        battleState = data;
        updateBattleDisplay();
        updateBattleLog();
        
        if (data.battle_ended) {
            handleBattleEnd(data.winner);
        } else {
            showMainMenu();
        }
    })
    .catch(error => {
        console.error('Error using move:', error);
    });
}

function switchPokemon(pokemonIndex) {
    fetch('/api/battle/switch-pokemon', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            pokemon_index: pokemonIndex
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('Switch error:', data.error);
            return;
        }
        
        battleState = data;
        updateBattleDisplay();
        updateBattleLog();
        
        if (data.battle_ended) {
            handleBattleEnd(data.winner);
        } else {
            showMainMenu();
        }
    })
    .catch(error => {
        console.error('Error switching Pokemon:', error);
    });
}

function handleBattleEnd(winner) {
    setTimeout(() => {
        const message = winner === 'player' ? 'Battle won! Start a new battle?' : 'Battle lost! Start a new battle?';
        if (confirm(message)) {
            // End current battle and start new one
            fetch('/api/battle/end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(() => {
                initializeBattle();
            })
            .catch(error => {
                console.error('Error ending battle:', error);
            });
        }
    }, 2000);
} 