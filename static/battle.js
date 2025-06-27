// Battle System JavaScript - Simplified Version
let playerPokemon = null;
let enemyPokemon = null;
let playerTeam = [];
let currentPlayerIndex = 0;
let battleState = 'menu';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeBattle();
    setupEventListeners();
});

function initializeBattle() {
    // Use fallback Pokemon
    const randomPokemon = [
        { id: 25, name: 'Pikachu', hp: 100, maxHp: 100, level: 50, moves: ['Thunderbolt', 'Quick Attack', 'Thunder Wave', 'Iron Tail'] },
        { id: 6, name: 'Charizard', hp: 120, maxHp: 120, level: 50, moves: ['Flamethrower', 'Air Slash', 'Dragon Claw', 'Earthquake'] },
        { id: 9, name: 'Blastoise', hp: 110, maxHp: 110, level: 50, moves: ['Hydro Pump', 'Ice Beam', 'Skull Bash', 'Flash Cannon'] },
        { id: 3, name: 'Venusaur', hp: 115, maxHp: 115, level: 50, moves: ['Solar Beam', 'Sludge Bomb', 'Sleep Powder', 'Earthquake'] }
    ];

    playerPokemon = { ...randomPokemon[Math.floor(Math.random() * randomPokemon.length)] };
    enemyPokemon = { ...randomPokemon[Math.floor(Math.random() * randomPokemon.length)] };
    playerTeam = [playerPokemon, ...randomPokemon.slice(0, 3)];
    
    updateBattleDisplay();
    addLogMessage(`A wild ${enemyPokemon.name} appeared!`);
}

function updateBattleDisplay() {
    // Update player Pokemon display
    document.getElementById('player-name').textContent = playerPokemon.name;
    document.getElementById('player-level').textContent = `Lv. ${playerPokemon.level}`;
    document.getElementById('player-sprite').src = `/api/pokemon_image/${playerPokemon.id}`;
    updateHealthBar('player', playerPokemon.hp, playerPokemon.maxHp);

    // Update enemy Pokemon display
    document.getElementById('enemy-name').textContent = enemyPokemon.name;
    document.getElementById('enemy-level').textContent = `Lv. ${enemyPokemon.level}`;
    document.getElementById('enemy-sprite').src = `/api/pokemon_image/${enemyPokemon.id}`;
    updateHealthBar('enemy', enemyPokemon.hp, enemyPokemon.maxHp);

    // Update move buttons
    updateMoveButtons();
}

function updateMoveButtons() {
    const moves = playerPokemon.moves || ['Tackle', 'Growl', 'Scratch', 'Leer'];
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
    battleState = 'menu';
    document.getElementById('battle-menu').style.display = 'block';
    document.getElementById('move-selection').style.display = 'none';
    document.getElementById('pokemon-selection').style.display = 'none';
}

function showMoveSelection() {
    battleState = 'move-selection';
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
    battleState = 'pokemon-selection';
    document.getElementById('battle-menu').style.display = 'none';
    document.getElementById('pokemon-selection').style.display = 'block';
    populatePokemonList();
}

function populatePokemonList() {
    const pokemonList = document.getElementById('pokemon-list');
    pokemonList.innerHTML = '';

    playerTeam.forEach((pokemon, index) => {
        const pokemonItem = document.createElement('div');
        pokemonItem.className = 'pokemon-item';
        pokemonItem.innerHTML = `
            <img src="/api/pokemon_image/${pokemon.id}" alt="${pokemon.name}" onerror="this.src='/static/images/placeholder.png'">
            <div class="name">${pokemon.name}</div>
            <div class="health">${pokemon.hp}/${pokemon.maxHp}</div>
        `;
        
        if (pokemon.hp > 0) {
            if (index === currentPlayerIndex) {
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
    const moves = playerPokemon.moves || ['Tackle', 'Growl', 'Scratch', 'Leer'];
    const selectedMove = moves[moveIndex];
    
    if (!selectedMove) {
        return;
    }
    
    addLogMessage(`${playerPokemon.name} used ${selectedMove}!`);
    attack(selectedMove);
}

function attack(selectedMove = null) {
    // Player attacks
    const moves = playerPokemon.moves || ['Tackle', 'Growl', 'Scratch', 'Leer'];
    const playerMove = selectedMove || moves[Math.floor(Math.random() * moves.length)];
    
    const playerDamage = Math.floor(Math.random() * 20) + 10;
    enemyPokemon.hp = Math.max(0, enemyPokemon.hp - playerDamage);
    updateHealthBar('enemy', enemyPokemon.hp, enemyPokemon.maxHp);
    addLogMessage(`${playerPokemon.name} used ${playerMove}!`);
    addLogMessage(`It dealt ${playerDamage} damage!`);

    // Check if enemy fainted
    if (enemyPokemon.hp <= 0) {
        addLogMessage(`${enemyPokemon.name} fainted!`);
        addLogMessage('You won the battle!');
        setTimeout(() => {
            if (confirm('Battle won! Start a new battle?')) {
                startNewBattle();
            }
        }, 2000);
        return;
    }

    // Enemy attacks
    setTimeout(() => {
        const enemyMoves = enemyPokemon.moves || ['Tackle', 'Growl', 'Scratch', 'Leer'];
        const enemyMove = enemyMoves[Math.floor(Math.random() * enemyMoves.length)];
        const enemyDamage = Math.floor(Math.random() * 20) + 10;
        playerPokemon.hp = Math.max(0, playerPokemon.hp - enemyDamage);
        updateHealthBar('player', playerPokemon.hp, playerPokemon.maxHp);
        addLogMessage(`${enemyPokemon.name} used ${enemyMove}!`);
        addLogMessage(`It dealt ${enemyDamage} damage!`);

        // Check if player fainted
        if (playerPokemon.hp <= 0) {
            addLogMessage(`${playerPokemon.name} fainted!`);
            addLogMessage('You lost the battle!');
            setTimeout(() => {
                if (confirm('Battle lost! Start a new battle?')) {
                    startNewBattle();
                }
            }, 2000);
            return;
        }

        // Return to menu for next turn
        showMainMenu();
    }, 1000);
}

function switchPokemon(index) {
    if (index === currentPlayerIndex || playerTeam[index].hp <= 0) return;
    
    currentPlayerIndex = index;
    playerPokemon = playerTeam[index];
    updateBattleDisplay();
    addLogMessage(`Go! ${playerPokemon.name}!`);
    
    showMainMenu();
    
    // Enemy gets a free turn
    setTimeout(() => enemyTurn(), 1000);
}

function enemyTurn() {
    const enemyMoves = enemyPokemon.moves || ['Tackle', 'Growl', 'Scratch', 'Leer'];
    const enemyMove = enemyMoves[Math.floor(Math.random() * enemyMoves.length)];
    const enemyDamage = Math.floor(Math.random() * 20) + 10;
    playerPokemon.hp = Math.max(0, playerPokemon.hp - enemyDamage);
    updateHealthBar('player', playerPokemon.hp, playerPokemon.maxHp);
    addLogMessage(`${enemyPokemon.name} used ${enemyMove}!`);

    // Check if player fainted
    if (playerPokemon.hp <= 0) {
        addLogMessage(`${playerPokemon.name} fainted!`);
        addLogMessage('You lost the battle!');
        setTimeout(() => {
            if (confirm('Battle lost! Start a new battle?')) {
                startNewBattle();
            }
        }, 2000);
        return;
    }
}

function startNewBattle() {
    location.reload();
}

function addLogMessage(message) {
    const battleLog = document.getElementById('battle-log');
    const logMessage = document.createElement('div');
    logMessage.className = 'log-message';
    logMessage.textContent = message;
    
    battleLog.appendChild(logMessage);
    
    // Remove old messages if too many
    while (battleLog.children.length > 3) {
        battleLog.removeChild(battleLog.firstChild);
    }
    
    // Auto-scroll to bottom
    battleLog.scrollTop = battleLog.scrollHeight;
} 