// Battle System JavaScript - Flask-based Version (Optimized)
let battleState = null;
let eventListenersSetup = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeBattle();
    setupEventListeners();
    setupAllDragScrolling();
});

function initializeBattle() {
    // Get team_id and action from data attributes
    const battleContainer = document.querySelector('.battle-container');
    const teamIdStr = battleContainer.getAttribute('data-team-id');
    const teamId = teamIdStr && teamIdStr !== 'null' ? parseInt(teamIdStr) : null;
    const hasExistingBattle = battleContainer.getAttribute('data-has-existing-battle') === 'true';
    const action = battleContainer.getAttribute('data-action');
    
    // Handle based on action and existing battle state
    if (hasExistingBattle && action === 'resume') {
        // Restore existing battle
        fetch('/api/battle/restore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Battle restore error:', data.error);
                // Fallback to new battle
                startNewBattle(teamId);
                return;
            }
            
            battleState = data;
            updateBattleDisplay();
            updateBattleLog();
        })
        .catch(error => {
            console.error('Error restoring battle:', error);
            // Fallback to new battle
            startNewBattle(teamId);
        });
    } else {
        // Start new battle (either no existing battle or action is 'new')
        startNewBattle(teamId);
    }
}

function startNewBattle(teamId) {
    // Start a new battle with the server
    fetch('/api/battle/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            team_id: teamId
        })
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
    

    
    // Update player level display
    if (battleState.player_level) {
        document.getElementById('player-level-display').textContent = battleState.player_level;
    }
    
    // Update player Pokemon display
    const player = battleState.player_pokemon;
    document.getElementById('player-name').textContent = player.name;
    document.getElementById('player-level').textContent = `Lv. ${player.level || 50}`;
    const playerId = player.id || player.pokemon_id;
    const playerSprite = document.getElementById('player-sprite');
    if (playerId) {
        playerSprite.src = `/api/pokemon_image/${playerId}`;
        playerSprite.style.display = 'block';
        playerSprite.onerror = function() { this.style.display = 'none'; };
    } else {
        playerSprite.style.display = 'none';
    }
    
    // Use current_hp and max_hp from server, fallback to hp if not available
    const playerCurrentHp = (typeof player.current_hp === 'number') ? Math.max(0, player.current_hp) : player.hp;
    const playerMaxHp = (typeof player.max_hp === 'number') ? player.max_hp : player.hp;
    const playerHpPercent = Math.max(0, Math.min(100, (playerCurrentHp / playerMaxHp) * 100));
    const playerHpBar = document.getElementById('player-health-fill');
    if (playerHpBar) playerHpBar.style.width = playerHpPercent + '%';
    const playerHpText = document.getElementById('player-health-text');
    if (playerHpText) playerHpText.textContent = `${Math.round(playerCurrentHp)}/${Math.round(playerMaxHp)}`;
    
    // Update enemy Pokemon display
    const enemy = battleState.enemy_pokemon;
    document.getElementById('enemy-name').textContent = enemy.name;
    document.getElementById('enemy-level').textContent = `Lv. ${enemy.level || 50}`;
    const enemyId = enemy.id || enemy.pokemon_id;
    const enemySprite = document.getElementById('enemy-sprite');
    if (enemyId) {
        enemySprite.src = `/api/pokemon_image/${enemyId}`;
        enemySprite.style.display = 'block';
        enemySprite.onerror = function() { this.style.display = 'none'; };
    } else {
        enemySprite.style.display = 'none';
    }
    
    const enemyCurrentHp = (typeof enemy.current_hp === 'number') ? Math.max(0, enemy.current_hp) : enemy.hp;
    const enemyMaxHp = (typeof enemy.max_hp === 'number') ? enemy.max_hp : enemy.hp;
    const enemyHpPercent = Math.max(0, Math.min(100, (enemyCurrentHp / enemyMaxHp) * 100));
    const enemyHpBar = document.getElementById('enemy-health-fill');
    if (enemyHpBar) enemyHpBar.style.width = enemyHpPercent + '%';
    const enemyHpText = document.getElementById('enemy-health-text');
    if (enemyHpText) enemyHpText.textContent = `${Math.round(enemyCurrentHp)}/${Math.round(enemyMaxHp)}`;
    
    // Update Pokemon type badges
    updatePokemonTypes();
    
    // Update enemy team display (if you want to show enemy team)
    if (battleState.enemy_team && document.getElementById('enemy-team-list')) {
        const enemyTeamList = document.getElementById('enemy-team-list');
        enemyTeamList.innerHTML = '';
        battleState.enemy_team.forEach((poke, idx) => {
            const pokeId = poke.id || poke.pokemon_id;
            const pokeDiv = document.createElement('div');
            pokeDiv.className = 'enemy-team-poke';
            if (pokeId) {
                pokeDiv.innerHTML = `<img src="/api/pokemon_image/${pokeId}" alt="${poke.name}" style="width:32px;height:32px;" onerror="this.style.display='none';"> <span>${poke.name}</span>`;
            } else {
                pokeDiv.innerHTML = `<span>${poke.name}</span>`;
            }
            enemyTeamList.appendChild(pokeDiv);
        });

    }
    
    // Update battle log
    const battleLog = document.getElementById('battle-log');
    battleLog.innerHTML = '';
    battleState.battle_log.forEach(log => {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = log;
        battleLog.appendChild(logEntry);
    });
    battleLog.scrollTop = battleLog.scrollHeight;
    
    // Update move buttons
    updateMoveButtons();
    
    // Update team displays
    updateTeamDisplay();
    updateEnemyTeamDisplay();
    
    // Update battle button states if battle is ended
    const fightBtn = document.getElementById('fight-btn');
    const runBtn = document.getElementById('run-btn');
    
    if (battleState.battle_ended) {
        // Battle is over - disable all battle buttons
        if (fightBtn) {
            fightBtn.disabled = true;
            fightBtn.style.opacity = '0.5';
            fightBtn.style.cursor = 'not-allowed';
        }
        
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.style.opacity = '0.5';
            runBtn.style.cursor = 'not-allowed';
            
            // Update button text and state based on battle result
            if (battleState.winner === 'player') {
                runBtn.textContent = 'VICTORY!';
                runBtn.setAttribute('data-state', 'victory');
            } else {
                runBtn.textContent = 'DEFEAT!';
                runBtn.setAttribute('data-state', 'defeat');
            }
        }
    } else {
        // Battle is ongoing - enable all buttons
        if (fightBtn) {
            fightBtn.disabled = false;
            fightBtn.textContent = 'FIGHT';
            fightBtn.style.opacity = '1';
            fightBtn.style.cursor = 'pointer';
        }
        
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.textContent = 'RUN';
            runBtn.style.opacity = '1';
            runBtn.style.cursor = 'pointer';
            runBtn.removeAttribute('data-state');
        }
    }
}

function updateEnemyTeamDisplay() {
    if (!battleState || !battleState.enemy_team) return;
    
    const enemyTeamList = document.getElementById('enemy-team-list');
    if (!enemyTeamList) return;
    
    enemyTeamList.innerHTML = '';

    battleState.enemy_team.forEach((pokemon, index) => {
        const teamItem = document.createElement('div');
        teamItem.className = 'enemy-team-item';
        
        // Use current_hp and max_hp from server, fallback to hp if not available
        const currentHp = (typeof pokemon.current_hp === 'number') ? Math.max(0, pokemon.current_hp) : pokemon.hp || 100;
        const maxHp = pokemon.max_hp || pokemon.hp || 100;
        
        // Determine if this Pokemon is active or fainted
        const isActive = index === battleState.current_enemy_index;
        const isFainted = currentHp <= 0;
        
        if (isActive) teamItem.classList.add('active');
        if (isFainted) teamItem.classList.add('fainted');
        
        // Create the Pokemon image
        const pokemonId = pokemon.id || pokemon.pokemon_id;
        const imgSrc = pokemonId ? `/api/pokemon_image/${pokemonId}` : '/static/images/placeholder.png';
        
        // Create the team item HTML
        teamItem.innerHTML = `
            <img src="${imgSrc}" alt="${pokemon.name}" onerror="this.src='/static/images/placeholder.png'">
            <div class="team-pokemon-info">
                <div class="team-pokemon-name">${pokemon.name}</div>
                <div class="team-pokemon-health">${Math.round(currentHp)}/${Math.round(maxHp)}</div>
                ${isFainted ? '<div class="team-pokemon-status">Fainted</div>' : ''}
            </div>
        `;
        
        enemyTeamList.appendChild(teamItem);
    });
}

function updateMoveButtons() {
    if (!battleState || !battleState.player_pokemon || !battleState.player_pokemon.assigned_moves) {
        return;
    }
    
    // Clear any existing tooltips
    hideMoveTooltip();

    const assignedMoves = battleState.player_pokemon.assigned_moves;

    // Fetch move data with type information for each move
    const movePromises = assignedMoves.map(moveId =>
        fetch(`/api/move/${moveId}`)
            .then(response => response.json())
            .then(moveData => {
                return {
                    name: moveData.move_name || 'Unknown Move',
                    type: moveData.type_id || 1 // Default to Normal type
                };
            })
            .catch(error => {
                return { name: 'Unknown Move', type: 1 };
            })
    );
    
    Promise.all(movePromises)
        .then(moveData => {
            
            // Get type names for the move types
            const typePromises = moveData.map(move => {
                if (move.type === 1) return Promise.resolve('Normal');
                return fetch(`/api/type/${move.type}`)
                    .then(response => response.json())
                    .then(typeData => typeData.type_name || 'Normal')
                    .catch(() => 'Normal');
            });
            
            return Promise.all(typePromises).then(typeNames => {
                return moveData.map((move, index) => ({
                    name: move.name,
                    type: typeNames[index]
                }));
            });
        })
        .then(movesWithTypes => {
            // Update move buttons with the assigned move names and type colors
            for (let i = 0; i < 4; i++) {
                const moveBtn = document.getElementById(`move-${i + 1}`);
                if (moveBtn && movesWithTypes[i]) {
                    const move = movesWithTypes[i];
                    moveBtn.textContent = move.name || '---';
                    
                    // Disable move buttons if battle is ended
                    if (battleState.battle_ended) {
                        moveBtn.disabled = true;
                        moveBtn.style.opacity = '0.5';
                        moveBtn.style.cursor = 'not-allowed';
                    } else {
                        moveBtn.disabled = !move.name;
                        moveBtn.style.opacity = '1';
                        moveBtn.style.cursor = 'pointer';
                    }
                    
                    // Apply type color styling
                    moveBtn.className = `move-btn type-${move.type.toLowerCase()}`;
                    
                    // Add tooltip functionality if move has name
                    if (move.name && move.name !== '---') {
                        setupMoveTooltip(moveBtn, battleState.player_pokemon.assigned_moves[i]);
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error fetching move data:', error);
            // Fallback to default moves
            const moves = ['Tackle', 'Growl', 'Scratch', 'Leer'];
            for (let i = 0; i < 4; i++) {
                const moveBtn = document.getElementById(`move-${i + 1}`);
                if (moveBtn) {
                    moveBtn.textContent = moves[i] || '---';
                    
                    // Disable move buttons if battle is ended
                    if (battleState.battle_ended) {
                        moveBtn.disabled = true;
                        moveBtn.style.opacity = '0.5';
                        moveBtn.style.cursor = 'not-allowed';
                    } else {
                        moveBtn.disabled = !moves[i];
                        moveBtn.style.opacity = '1';
                        moveBtn.style.cursor = 'pointer';
                    }
                    
                    moveBtn.className = 'move-btn type-normal';
                    
                    // Add tooltip functionality for assigned moves
                    if (moves[i] && battleState.player_pokemon.assigned_moves && battleState.player_pokemon.assigned_moves[i]) {
                        setupMoveTooltip(moveBtn, battleState.player_pokemon.assigned_moves[i]);
                    }
                }
            }
        });
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
    if (eventListenersSetup) return;
    eventListenersSetup = true;

    // FIGHT button: Show move selection, hide menu
    const fightBtn = document.getElementById('fight-btn');
    if (fightBtn) {
        fightBtn.onclick = function() {
            // Check if battle is ended
            if (battleState && battleState.battle_ended) {
                showNotification('Battle Over', 'The battle has already ended!');
                return;
            }
            
            document.getElementById('battle-menu').style.display = 'none';
            document.getElementById('move-selection').style.display = 'flex';
        };
    }

    // RUN button: Show run confirmation modal
    const runBtn = document.getElementById('run-btn');
    if (runBtn) {
        runBtn.onclick = function() {
            // Check if battle is ended
            if (battleState && battleState.battle_ended) {
                showNotification('Battle Over', 'The battle has already ended!');
                return;
            }
            
            showRunModal();
        };
    }

    // BACK button in move selection: Show menu, hide move selection
    const backToMenuBtn = document.getElementById('back-to-menu');
    if (backToMenuBtn) {
        backToMenuBtn.onclick = function() {
            document.getElementById('move-selection').style.display = 'none';
            document.getElementById('battle-menu').style.display = 'flex';
        };
    }

    // BACK button in pokemon selection: Show menu, hide pokemon selection
    const backToMenuPokemonBtn = document.getElementById('back-to-menu-pokemon');
    if (backToMenuPokemonBtn) {
        backToMenuPokemonBtn.onclick = function() {
            document.getElementById('pokemon-selection').style.display = 'none';
            document.getElementById('battle-menu').style.display = 'flex';
        };
    }

    // Run modal buttons
    const runCancelBtn = document.getElementById('run-cancel-btn');
    const runConfirmBtn = document.getElementById('run-confirm-btn');
    
    if (runCancelBtn) {
        runCancelBtn.onclick = function() {
            hideRunModal();
        };
    }
    
    if (runConfirmBtn) {
        runConfirmBtn.onclick = function() {
            hideRunModal();
            runFromBattle();
        };
    }

    // Close modal when clicking outside
    const runModal = document.getElementById('run-modal');
    if (runModal) {
        runModal.onclick = function(e) {
            if (e.target === runModal) {
                hideRunModal();
            }
        };
    }

    // Notification modal OK button
    const notificationOkBtn = document.getElementById('notification-ok-btn');
    if (notificationOkBtn) {
        notificationOkBtn.onclick = function() {
            hideNotification();
        };
    }

    // Close notification modal when clicking outside
    const notificationModal = document.getElementById('notification-modal');
    if (notificationModal) {
        notificationModal.onclick = function(e) {
            if (e.target === notificationModal) {
                hideNotification();
            }
        };
    }



    // Set up move button event listeners once
    const moveBtns = document.querySelectorAll('.move-btn');
    moveBtns.forEach((btn, index) => {
        btn.addEventListener('click', function(e) {
            useMove(index);
        });
    });
}

function showMainMenu() {
    // Clear any leftover selection messages
    const pokemonList = document.getElementById('pokemon-list');
    if (pokemonList) {
        const messageDiv = pokemonList.querySelector('.selection-message');
        if (messageDiv) {
            messageDiv.remove();
        }
    }
    
    // Clear any move tooltips
    hideMoveTooltip();
    
    // Show main menu and hide others
    document.getElementById('battle-menu').style.display = 'flex';
    document.getElementById('move-selection').style.display = 'none';
    document.getElementById('pokemon-selection').style.display = 'none';
    
    // Ensure back button is visible
    const backBtn = document.getElementById('back-to-menu-pokemon');
    if (backBtn) {
        backBtn.style.display = 'block';
    }
    
    // Handle battle end state - disable all buttons except exit
    const fightBtn = document.getElementById('fight-btn');
    const runBtn = document.getElementById('run-btn');
    
    if (battleState && battleState.battle_ended) {
        // Battle is over - disable all battle buttons
        if (fightBtn) {
            fightBtn.disabled = true;
            fightBtn.style.opacity = '0.5';
            fightBtn.style.cursor = 'not-allowed';
        }
        
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.style.opacity = '0.5';
            runBtn.style.cursor = 'not-allowed';
            
            // Update button text and state based on battle result
            if (battleState.winner === 'player') {
                runBtn.textContent = 'VICTORY!';
                runBtn.setAttribute('data-state', 'victory');
            } else {
                runBtn.textContent = 'DEFEAT!';
                runBtn.setAttribute('data-state', 'defeat');
            }
        }
    } else {
        // Battle is ongoing - enable all buttons
        if (fightBtn) {
            fightBtn.disabled = false;
            fightBtn.textContent = 'FIGHT';
            fightBtn.style.opacity = '1';
            fightBtn.style.cursor = 'pointer';
        }
        
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.textContent = 'RUN';
            runBtn.style.opacity = '1';
            runBtn.style.cursor = 'pointer';
            runBtn.removeAttribute('data-state');
        }
    }
}

function showMoveSelection() {
    // Clear any move tooltips
    hideMoveTooltip();
    
    document.getElementById('battle-menu').style.display = 'none';
    document.getElementById('move-selection').style.display = 'block';
    document.getElementById('pokemon-selection').style.display = 'none';
}

function showPokemonSelection() {
    // Only show the pokemon selection overlay, do not hide the rest of the UI
    document.getElementById('battle-menu').style.display = 'none';
    document.getElementById('move-selection').style.display = 'none';
    document.getElementById('pokemon-selection').style.display = 'block';
    // Check if current Pokemon fainted - if so, disable back button
    const currentPokemon = battleState.player_pokemon;
    const backBtn = document.getElementById('back-to-menu-pokemon');
    if (currentPokemon && currentPokemon.current_hp <= 0) {
        backBtn.style.display = 'none'; // Hide the back button
        // Add a message to inform the player they must choose
        const pokemonList = document.getElementById('pokemon-list');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'selection-message';
        messageDiv.textContent = 'Choose your next Pokemon!';
        messageDiv.style.cssText = 'text-align: center; color: #ff4444; font-weight: bold; margin-bottom: 10px; padding: 10px; background: #ffeeee; border-radius: 5px;';
        pokemonList.insertBefore(messageDiv, pokemonList.firstChild);
    } else {
        backBtn.style.display = 'block';
    }
    populatePokemonList();
}

function populatePokemonList() {
    if (!battleState || !battleState.player_team) return;
    
    const pokemonList = document.getElementById('pokemon-list');
    pokemonList.innerHTML = '';

    battleState.player_team.forEach((pokemon, index) => {
        const pokemonItem = document.createElement('div');
        pokemonItem.className = 'pokemon-item';
        
        // Use current_hp and max_hp from server, fallback to hp if not available
        const currentHp = (typeof pokemon.current_hp === 'number') ? Math.max(0, pokemon.current_hp) : 0;
        const maxHp = pokemon.max_hp || pokemon.hp || 100;
        
        pokemonItem.innerHTML = `
            <img src="/api/pokemon_image/${pokemon.id}" alt="${pokemon.name}" onerror="this.src='/static/images/placeholder.png'">
            <div class="name">${pokemon.name}</div>
            <div class="health">${currentHp}/${maxHp}</div>
        `;
        
        if (currentHp > 0) {
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
    
    // Setup drag scrolling for the Pokemon list
    setupDragScrolling(pokemonList);
}

// Drag scrolling functionality for Pokemon selection
function setupDragScrolling(element) {
    let isDown = false;
    let startX;
    let scrollLeft;
    
    // Check if the target element should be excluded from drag scrolling
    function shouldExcludeTarget(target) {
        // Check if the target or any of its parents is a button or clickable element
        const excludedSelectors = [
            'button',
            '.pokemon-item',
            '.back-btn',
            '.menu-btn',
            '.move-btn',
            'input',
            'select',
            'textarea',
            'a'
        ];
        
        let currentElement = target;
        while (currentElement && currentElement !== element) {
            // Check if current element matches any excluded selector
            for (const selector of excludedSelectors) {
                if (currentElement.matches && currentElement.matches(selector)) {
                    return true;
                }
            }
            currentElement = currentElement.parentElement;
        }
        return false;
    }
    
    element.addEventListener('mousedown', (e) => {
        // Don't start drag if clicking on a button or interactive element
        if (shouldExcludeTarget(e.target)) {
            return;
        }
        
        isDown = true;
        element.classList.add('dragging');
        startX = e.pageX - element.offsetLeft;
        scrollLeft = element.scrollLeft;
        element.style.cursor = 'grabbing';
    });
    
    element.addEventListener('mouseleave', () => {
        isDown = false;
        element.classList.remove('dragging');
        element.style.cursor = 'grab';
    });
    
    element.addEventListener('mouseup', () => {
        isDown = false;
        element.classList.remove('dragging');
        element.style.cursor = 'grab';
    });
    
    element.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - element.offsetLeft;
        const walk = (x - startX) * 2; // Adjust scroll speed
        element.scrollLeft = scrollLeft - walk;
    });
    
    // Touch events for mobile
    element.addEventListener('touchstart', (e) => {
        // Don't start drag if touching a button or interactive element
        if (shouldExcludeTarget(e.target)) {
            return;
        }
        
        isDown = true;
        startX = e.touches[0].pageX - element.offsetLeft;
        scrollLeft = element.scrollLeft;
    });
    
    element.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.touches[0].pageX - element.offsetLeft;
        const walk = (x - startX) * 2;
        element.scrollLeft = scrollLeft - walk;
    });
    
    element.addEventListener('touchend', () => {
        isDown = false;
    });
    
    // Set initial cursor
    element.style.cursor = 'grab';
}

// Setup drag scrolling for all scrollable areas
function setupAllDragScrolling() {
    // Battle scene
    const battleScene = document.querySelector('.battle-scene');
    if (battleScene) {
        setupVerticalDragScrolling(battleScene);
    }
    
    // Enemy team display
    const enemyTeamDisplay = document.querySelector('.enemy-team-display');
    if (enemyTeamDisplay) {
        setupVerticalDragScrolling(enemyTeamDisplay);
    }
    
    // Player team display
    const playerTeamDisplay = document.querySelector('.player-team-display');
    if (playerTeamDisplay) {
        setupVerticalDragScrolling(playerTeamDisplay);
    }
    
    // Battle log
    const battleLog = document.querySelector('.battle-log');
    if (battleLog) {
        setupVerticalDragScrolling(battleLog);
    }
}

// Vertical drag scrolling functionality for battle areas
function setupVerticalDragScrolling(element) {
    let isDown = false;
    let startY;
    let scrollTop;
    
    // Check if the target element should be excluded from drag scrolling
    function shouldExcludeTarget(target) {
        // Check if the target or any of its parents is a button or clickable element
        const excludedSelectors = [
            'button',
            '.swap-in-btn',
            '.pokemon-item',
            '.back-btn',
            '.menu-btn',
            '.move-btn',
            'input',
            'select',
            'textarea',
            'a'
        ];
        
        let currentElement = target;
        while (currentElement && currentElement !== element) {
            // Check if current element matches any excluded selector
            for (const selector of excludedSelectors) {
                if (currentElement.matches && currentElement.matches(selector)) {
                    return true;
                }
            }
            currentElement = currentElement.parentElement;
        }
        return false;
    }
    
    element.addEventListener('mousedown', (e) => {
        // Don't start drag if clicking on a button or interactive element
        if (shouldExcludeTarget(e.target)) {
            return;
        }
        
        isDown = true;
        element.classList.add('dragging');
        startY = e.pageY - element.offsetTop;
        scrollTop = element.scrollTop;
        element.style.cursor = 'grabbing';
    });
    
    element.addEventListener('mouseleave', () => {
        isDown = false;
        element.classList.remove('dragging');
        element.style.cursor = 'grab';
    });
    
    element.addEventListener('mouseup', () => {
        isDown = false;
        element.classList.remove('dragging');
        element.style.cursor = 'grab';
    });
    
    element.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const y = e.pageY - element.offsetTop;
        const walk = (y - startY) * 2; // Adjust scroll speed
        element.scrollTop = scrollTop - walk;
    });
    
    // Touch events for mobile
    element.addEventListener('touchstart', (e) => {
        // Don't start drag if touching a button or interactive element
        if (shouldExcludeTarget(e.target)) {
            return;
        }
        
        isDown = true;
        startY = e.touches[0].pageY - element.offsetTop;
        scrollTop = element.scrollTop;
    });
    
    element.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const y = e.touches[0].pageY - element.offsetTop;
        const walk = (y - startY) * 2;
        element.scrollTop = scrollTop - walk;
    });
    
    element.addEventListener('touchend', () => {
        isDown = false;
    });
    
    // Set initial cursor
    element.style.cursor = 'grab';
}

function useMove(moveIndex) {
    
    // Disable move buttons to prevent spam
    const moveBtns = document.querySelectorAll('.move-btn');
    moveBtns.forEach(btn => btn.disabled = true);
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
            // Re-enable buttons on error
            moveBtns.forEach(btn => btn.disabled = false);
            return;
        }
        battleState = data;
        
        // Always update display and log first, regardless of what happens next
        updateBattleDisplay();
        updateBattleLog();
        
        // Handle level up if player won
        if (data.battle_ended && data.winner === 'player' && data.new_level) {
    
            // Update the level display immediately
            document.getElementById('player-level-display').textContent = data.new_level;
            // Add a visual effect for level up
            const levelDisplay = document.getElementById('player-level-display');
            levelDisplay.style.animation = 'levelUp 0.5s ease-in-out';
            setTimeout(() => {
                levelDisplay.style.animation = '';
            }, 500);
        }
        
        // Add a small delay to ensure UI updates are visible before any menu changes
        setTimeout(() => {
            if (data.battle_ended) {
        
                handleBattleEnd(data.winner);
            } else {
                // Check if player's Pokemon fainted and they need to choose next Pokemon
                const playerPokemon = data.player_pokemon;
                if (playerPokemon.current_hp <= 0) {
    
                    showPokemonSelection();
                } else {

                    showMainMenu();
                }
            }
            // Re-enable buttons for next turn
            moveBtns.forEach(btn => btn.disabled = false);
        }, 100); // Small delay to ensure UI updates are visible
    })
    .catch(error => {
        console.error('Error using move:', error);
        // Re-enable buttons on error
        moveBtns.forEach(btn => btn.disabled = false);
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
            const playerPokemon = data.player_pokemon;
            if (playerPokemon.current_hp <= 0) {
                showPokemonSelection();
            } else {
                const backBtn = document.getElementById('back-to-menu-pokemon');
                backBtn.style.display = 'block';
                showMainMenu();
            }
        }
    })
    .catch(error => {
        console.error('Error switching Pokemon:', error);
    });
}

function handleBattleEnd(winner) {
    // Hide move selection and show main menu
    showMainMenu();
    
    // Clear any existing timeouts
    if (window.battleEndTimeout) {
        clearTimeout(window.battleEndTimeout);
    }
    
    window.battleEndTimeout = setTimeout(() => {
        // Show appropriate message based on winner
        const title = winner === 'player' ? 'Victory!' : 'Defeat!';
        const message = winner === 'player' 
            ? `Battle won! You are now level ${battleState.new_level || 'unknown'}! Redirecting to team building...`
            : `Battle lost! You have been reset to level ${battleState.reset_level || 1}. Redirecting to team building...`;
        
        // Show custom notification and redirect after user clicks OK
        showBattleEndNotification(title, message);
    }, 1000);
}

// Add error handling for network issues
function handleNetworkError(error, context) {
    console.error(`Network error in ${context}:`, error);
    showNotification('Connection Error', `Connection error: ${error.message}. Please refresh the page.`);
}

// Add this to the end of the file for better debugging
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    console.error('Error details:', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
    });
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    e.preventDefault();
});

// Function to update Pokémon type badges for both player and enemy
async function updatePokemonTypes() {
    if (!battleState) return;
    
    // Update player types
    const playerId = battleState.player_pokemon?.id || battleState.player_pokemon?.pokemon_id;
    if (playerId) {
        try {
            const response = await fetch(`/api/pokemon/${playerId}`);
            const data = await response.json();
            
            if (data.success && data.pokemon && data.pokemon.type) {
                const typesContainer = document.getElementById('player-types');
                if (typesContainer) {
                    const typeBadges = data.pokemon.type.map(type => 
                        `<span class="type-badge type-${type.toLowerCase()}">${type}</span>`
                    ).join('');
                    typesContainer.innerHTML = typeBadges;
                }
            }
        } catch (error) {
            console.error('Error fetching player Pokémon types:', error);
        }
    }
    
    // Update enemy types
    const enemyId = battleState.enemy_pokemon?.id || battleState.enemy_pokemon?.pokemon_id;
    if (enemyId) {
        try {
            const response = await fetch(`/api/pokemon/${enemyId}`);
            const data = await response.json();
            
            if (data.success && data.pokemon && data.pokemon.type) {
                const typesContainer = document.getElementById('enemy-types');
                if (typesContainer) {
                    const typeBadges = data.pokemon.type.map(type => 
                        `<span class="type-badge type-${type.toLowerCase()}">${type}</span>`
                    ).join('');
                    typesContainer.innerHTML = typeBadges;
                }
            }
        } catch (error) {
            console.error('Error fetching enemy Pokémon types:', error);
        }
    }
}

// Function to update team display
function updateTeamDisplay() {
    if (!battleState || !battleState.player_team) return;
    
    const playerTeamList = document.getElementById('player-team-list');
    if (!playerTeamList) return;
    
    playerTeamList.innerHTML = '';

    battleState.player_team.forEach((pokemon, index) => {
        const teamItem = document.createElement('div');
        teamItem.className = 'player-team-item';
        
        // Use current_hp and max_hp from server, fallback to hp if not available
        const currentHp = (typeof pokemon.current_hp === 'number') ? Math.max(0, pokemon.current_hp) : pokemon.hp || 100;
        const maxHp = pokemon.max_hp || pokemon.hp || 100;
        
        // Determine if this Pokemon is active or fainted
        const isActive = index === battleState.current_player_index;
        const isFainted = currentHp <= 0;
        
        if (isActive) teamItem.classList.add('active');
        if (isFainted) teamItem.classList.add('fainted');
        
        // Create the Pokemon image
        const pokemonId = pokemon.id || pokemon.pokemon_id;
        const imgSrc = pokemonId ? `/api/pokemon_image/${pokemonId}` : '/static/images/placeholder.png';
        
        // Create the team item HTML
        teamItem.innerHTML = `
            <img src="${imgSrc}" alt="${pokemon.name}" onerror="this.src='/static/images/placeholder.png'">
            <div class="team-pokemon-info">
                <div class="team-pokemon-name">${pokemon.name}</div>
                <div class="team-pokemon-health">${Math.round(currentHp)}/${Math.round(maxHp)}</div>
                ${isFainted ? '<div class="team-pokemon-status">Fainted</div>' : ''}
            </div>
            ${!isActive && !isFainted && !battleState.battle_ended ? `<button class="swap-in-btn" onclick="swapInPokemon(${index})">Swap In</button>` : ''}
        `;
        
        playerTeamList.appendChild(teamItem);
    });
}

// Function to swap in a Pokemon from the team display
function swapInPokemon(pokemonIndex) {
    if (!battleState || !battleState.player_team) return;
    
    // Check if battle is ended
    if (battleState.battle_ended) {
        showNotification('Invalid Action', 'Cannot swap Pokemon after battle has ended!');
        return;
    }
    
    const pokemon = battleState.player_team[pokemonIndex];
    if (!pokemon) return;
    
    // Check if Pokemon is fainted
    const currentHp = (typeof pokemon.current_hp === 'number') ? Math.max(0, pokemon.current_hp) : pokemon.hp || 100;
    if (currentHp <= 0) {
        showNotification('Invalid Action', 'Cannot swap in a fainted Pokemon!');
        return;
    }
    
    // Check if Pokemon is already active
    if (pokemonIndex === battleState.current_player_index) {
        showNotification('Invalid Action', 'This Pokemon is already active!');
        return;
    }
    
    // Disable the button to prevent multiple clicks
    const swapBtn = event.target;
    swapBtn.disabled = true;
    swapBtn.textContent = 'Swapping...';
    
    // Call the switch Pokemon function
    switchPokemon(pokemonIndex);
} 

// Function to show the run confirmation modal
function showRunModal() {
    const modal = document.getElementById('run-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Function to hide the run confirmation modal
function hideRunModal() {
    const modal = document.getElementById('run-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Function to show notification modal
function showNotification(title, message) {
    const modal = document.getElementById('notification-modal');
    const titleElement = document.getElementById('notification-title');
    const messageElement = document.getElementById('notification-message');
    
    if (modal && titleElement && messageElement) {
        titleElement.textContent = title;
        messageElement.textContent = message;
        modal.style.display = 'flex';
    }
}

// Function to hide notification modal
function hideNotification() {
    const modal = document.getElementById('notification-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Function to show battle end notification with redirect
function showBattleEndNotification(title, message) {
    const modal = document.getElementById('notification-modal');
    const titleElement = document.getElementById('notification-title');
    const messageElement = document.getElementById('notification-message');
    const okButton = document.getElementById('notification-ok-btn');
    
    if (modal && titleElement && messageElement && okButton) {
        titleElement.textContent = title;
        messageElement.textContent = message;
        modal.style.display = 'flex';
        
        // Override the OK button to redirect to player page
        okButton.onclick = function() {
            hideNotification();
            window.location.href = '/player';
        };
    }
}

// Function to run from battle (exit as loss)
function runFromBattle() {
    // Disable the run button to prevent multiple clicks
    const runBtn = document.getElementById('run-btn');
    if (runBtn) {
        runBtn.disabled = true;
        runBtn.textContent = 'RUNNING...';
    }
    
    // Call the server to end the battle as a loss
    fetch('/api/battle/end', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            winner: 'enemy',
            reason: 'player_ran'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('Run error:', data.error);
            // Re-enable button on error
            if (runBtn) {
                runBtn.disabled = false;
                runBtn.textContent = 'RUN';
            }
            showNotification('Error', 'Failed to run from battle. Please try again.');
            return;
        }
        
        // Update battle state and handle as loss
        battleState = data;
        handleBattleEnd('enemy');
    })
    .catch(error => {
        console.error('Error running from battle:', error);
        // Re-enable button on error
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.textContent = 'RUN';
        }
        showNotification('Connection Error', 'Connection error. Please try again.');
    });
} 

// Move tooltip functionality
async function setupMoveTooltip(moveButton, moveId) {
    try {
        // Fetch detailed move information
        const response = await fetch(`/api/move/${moveId}`);
        const moveData = await response.json();
        
        const moveInfo = {
            name: moveData.move_name || 'Unknown Move',
            power: moveData.power || 0,
            accuracy: moveData.accuracy || 0,
            category: moveData.category || 'physical',
            type: moveData.type_id || 1
        };
        
        // Get type name
        let typeName = 'Normal';
        if (moveInfo.type !== 1) {
            try {
                const typeResponse = await fetch(`/api/type/${moveInfo.type}`);
                const typeData = await typeResponse.json();
                typeName = typeData.type_name || 'Normal';
            } catch (error) {
                console.error('Error fetching type name:', error);
            }
        }
        
        // Add event listeners for tooltip
        moveButton.addEventListener('mouseenter', () => {
            showMoveTooltip(moveButton, moveInfo, typeName);
        });
        
        moveButton.addEventListener('mouseleave', () => {
            hideMoveTooltip();
        });
        
    } catch (error) {
        console.error('Error setting up move tooltip:', error);
    }
}

// Show move tooltip
function showMoveTooltip(element, moveInfo, typeName) {
    hideMoveTooltip(); // Remove any existing tooltip
    
    const tooltip = document.createElement('div');
    tooltip.className = 'battle-move-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header">${moveInfo.name}</div>
        <div class="tooltip-content">
            <div class="move-stat">Type: <span class="type-badge type-${typeName.toLowerCase()}">${typeName}</span></div>
            <div class="move-stat">Category: <span class="move-category">${moveInfo.category}</span></div>
            <div class="move-stat">Power: <span class="move-power">${moveInfo.power || 'N/A'}</span></div>
            <div class="move-stat">Accuracy: <span class="move-accuracy">${moveInfo.accuracy || 'N/A'}%</span></div>
        </div>
    `;
    
    document.body.appendChild(tooltip);
    
    // Position tooltip
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
    
    // Add fade-in animation
    setTimeout(() => tooltip.classList.add('visible'), 10);
}

// Hide move tooltip
function hideMoveTooltip() {
    const existingTooltip = document.querySelector('.battle-move-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
} 