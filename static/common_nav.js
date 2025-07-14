// ===== COMMON NAVIGATION FUNCTIONALITY =====
// This file contains shared navigation, mobile menu, and authentication logic

// Update navigation visibility based on authentication status
function updateNavigationVisibility(isAuthenticated) {
    const authRequiredItems = document.querySelectorAll('.auth-required');
    authRequiredItems.forEach(item => {
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

// Common authentication UI setup function
async function setupCommonAuth() {
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
            return { isAuthenticated: true, username: data.username };
        } else {
            // Update navigation visibility for non-authenticated user
            updateNavigationVisibility(false);
            authSection.innerHTML = `
                <button class="btn-standard btn-profile" onclick="showLogin ? showLogin() : (window.location.href='/')">Login</button>
                <button class="btn-standard btn-profile" onclick="showRegister ? showRegister() : (window.location.href='/')">Register</button>
            `;
            return { isAuthenticated: false, username: null };
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        updateNavigationVisibility(false);
        return { isAuthenticated: false, username: null };
    }
}

// Common logout function
async function logout() {
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            window.location.href = '/';
        } else {
            console.error('Logout failed:', data.error);
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/';
    }
}

// Initialize common navigation functionality
function initializeCommonNav() {
    setupMobileMenu();
    return setupCommonAuth();
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeCommonNav();
}); 