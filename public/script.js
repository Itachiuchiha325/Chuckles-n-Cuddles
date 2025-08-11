// Little Treasures Store - JavaScript

// Global variables initialization
let wishlistItems = [];
let products = [
    {
        _id: '1',
        name: 'Colorful Crayons Set',
        price: 150,
        description: 'Set of 24 vibrant crayons perfect for drawing and coloring',
        mainImage: '🖍️',
        stock: 25,
        category: 'art-supplies',
        tags: ['crayons', 'art', 'kids']
    },
    {
        _id: '2',
        name: 'School Notebook',
        price: 80,
        description: 'A4 ruled notebook with 200 pages',
        mainImage: '📓',
        stock: 50,
        category: 'notebooks',
        tags: ['notebook', 'school', 'writing']
    },
    {
        _id: '3',
        name: 'Pencil Box',
        price: 120,
        description: 'Colorful pencil box with compartments',
        mainImage: '📦',
        stock: 15,
        category: 'accessories',
        tags: ['pencil-box', 'storage', 'school']
    }
];
let orders = [];
let users = [];
let isAdminLoggedIn = false;
let currentUser = null;
let cartItems = [];

// Mock analytics object
const analytics = {
    track: function(event, data) {
        console.log(`Analytics: ${event}`, data);
    }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeApp();
        renderProducts();
        initializeDarkMode();
        initializeNetworkMonitoring();
        enableLazyLoading();
        
        console.log('Little Treasures Store initialized successfully');
    } catch (error) {
        console.error('Failed to initialize store:', error);
    }
});

// Initialize application
function initializeApp() {
    // Setup event listeners
    setupEventListeners();
    
    // Initialize cart
    updateCartDisplay();
    
    // Check if user is logged in
    checkAuthStatus();
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // Category filters
    const categoryButtons = document.querySelectorAll('.filter-btn');
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            filterProductsByCategory(category);
            
            // Update active filter
            categoryButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Modal close handlers
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Search functionality
function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    if (query === '') {
        renderProducts();
        return;
    }

    const filteredProducts = products.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.tags.some(tag => tag.toLowerCase().includes(query))
    );

    renderProducts(filteredProducts);
}

// Filter products by category
function filterProductsByCategory(category) {
    if (category === 'all' || !category) {
        renderProducts();
        return;
    }

    const filteredProducts = products.filter(product => 
        product.category === category
    );

    renderProducts(filteredProducts);
}

// Render products
function renderProducts(productsToRender) {
    if (!productsToRender) {
        productsToRender = products;
    }
    
    const productsGrid = document.querySelector('.products-grid');
    if (!productsGrid) return;

    if (productsToRender.length === 0) {
        productsGrid.innerHTML = '<div class="loading">No products found</div>';
        return;
    }

    var productsHTML = '';
    for (var i = 0; i < productsToRender.length; i++) {
        var product = productsToRender[i];
        var imageHTML = '';
        
        if (product.mainImage && product.mainImage.indexOf('/uploads/') === 0) {
            imageHTML = '<img src="' + product.mainImage + '" alt="' + product.name + '" loading="lazy">';
        } else {
            imageHTML = '<div style="font-size: 3rem;">' + (product.mainImage || '📦') + '</div>';
        }
        
        var tagsHTML = '';
        for (var j = 0; j < product.tags.length; j++) {
            tagsHTML += '<span class="tag">' + product.tags[j] + '</span>';
        }
        
        var wishlistClass = isInWishlist(product._id) ? 'active' : '';
        var stockStatus = product.stock <= 0;
        var buttonClass = stockStatus ? '' : 'btn-primary';
        var buttonText = stockStatus ? 'Out of Stock' : 'Add to Cart';
        var buttonDisabled = stockStatus ? 'disabled' : '';
        
        productsHTML += 
            '<div class="product-card">' +
                '<div class="product-image">' +
                    imageHTML +
                    '<button class="wishlist-btn ' + wishlistClass + '" ' +
                            'onclick="toggleWishlist(\'' + product._id + '\', this)" ' +
                            'aria-label="Toggle wishlist">♥</button>' +
                '</div>' +
                '<div class="product-name">' + product.name + '</div>' +
                '<div class="product-price">₹' + product.price + '</div>' +
                '<div class="product-description">' + product.description + '</div>' +
                '<div class="product-stock">Stock: ' + product.stock + '</div>' +
                '<div class="product-tags">' + tagsHTML + '</div>' +
                '<button class="btn ' + buttonClass + '" ' +
                        'onclick="addToCart(\'' + product._id + '\')" ' +
                        buttonDisabled + ' ' +
                        'aria-label="' + (stockStatus ? 'Out of stock' : 'Add to cart') + '">' +
                    buttonText +
                '</button>' +
            '</div>';
    }
    
    productsGrid.innerHTML = productsHTML;
}

// Check if product is in wishlist
function isInWishlist(productId) {
    return wishlistItems.some(item => item._id === productId);
}

// Toggle wishlist
function toggleWishlist(productId, element) {
    try {
        const product = products.find(p => p._id === productId);
        if (!product) {
            showError('Product not found');
            return;
        }

        const index = wishlistItems.findIndex(item => item._id === productId);
        if (index > -1) {
            // Remove from wishlist
            wishlistItems.splice(index, 1);
            element.classList.remove('active');
            showSuccess('Removed from wishlist');
        } else {
            // Add to wishlist
            wishlistItems.push(product);
            element.classList.add('active');
            showSuccess('Added to wishlist');
        }

        updateWishlistCount();
    } catch (error) {
        showError('Failed to update wishlist: ' + error.message);
    }
}

// Update wishlist count
function updateWishlistCount() {
    const wishlistCount = document.getElementById('wishlistCount');
    if (wishlistCount) {
        wishlistCount.textContent = wishlistItems.length;
    }
}

// Load wishlist modal
function loadWishlist() {
    const wishlistModal = document.getElementById('wishlistModal');
    if (!wishlistModal) {
        showError('Wishlist modal not found');
        return;
    }

    try {
        const wishlistContent = document.getElementById('wishlistContent');
        if (wishlistContent) {
            if (wishlistItems.length === 0) {
                wishlistContent.innerHTML = '<div class="loading">Your wishlist is empty</div>';
            } else {
                var wishlistHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">';
                
                for (var i = 0; i < wishlistItems.length; i++) {
                    var product = wishlistItems[i];
                    var imageHTML = '';
                    
                    if (product.mainImage && product.mainImage.indexOf('/uploads/') === 0) {
                        imageHTML = '<img src="' + product.mainImage + '" alt="' + product.name + '" loading="lazy">';
                    } else {
                        imageHTML = '<div style="font-size: 3rem;">' + (product.mainImage || '📦') + '</div>';
                    }
                    
                    var stockStatus = product.stock <= 0;
                    var buttonClass = stockStatus ? '' : 'btn-primary';
                    var buttonText = stockStatus ? 'Out of Stock' : 'Add to Cart';
                    var buttonDisabled = stockStatus ? 'disabled' : '';
                    
                    wishlistHTML += 
                        '<div class="product-card" style="position: relative;">' +
                            '<div class="product-image">' +
                                imageHTML +
                                '<button class="wishlist-btn active" onclick="toggleWishlist(\'' + product._id + '\', this)" aria-label="Remove from wishlist">♥</button>' +
                            '</div>' +
                            '<div class="product-name">' + product.name + '</div>' +
                            '<div class="product-price">₹' + product.price + '</div>' +
                            '<div class="product-description">' + product.description + '</div>' +
                            '<button class="btn ' + buttonClass + '" ' +
                                    'onclick="addToCart(\'' + product._id + '\')" ' +
                                    buttonDisabled + ' ' +
                                    'aria-label="' + (stockStatus ? 'Out of stock' : 'Add to cart') + '">' +
                                buttonText +
                            '</button>' +
                        '</div>';
                }
                
                wishlistHTML += '</div>';
                wishlistContent.innerHTML = wishlistHTML;
            }
        }

        wishlistModal.style.display = 'block';
    } catch (error) {
        showError('Failed to load wishlist: ' + error.message);
    }
}

// Add to cart
function addToCart(productId) {
    try {
        const product = products.find(p => p._id === productId);
        if (!product) {
            showError('Product not found');
            return;
        }
        
        if (product.stock <= 0) {
            showError('Product is out of stock');
            return;
        }

        // Check if product is already in cart
        const existingItem = cartItems.find(item => item._id === productId);
        if (existingItem) {
            if (existingItem.quantity < product.stock) {
                existingItem.quantity += 1;
                showSuccess('Quantity updated in cart');
            } else {
                showError('Cannot add more items - insufficient stock');
                return;
            }
        } else {
            cartItems.push({
                ...product,
                quantity: 1
            });
            showSuccess('Product added to cart');
        }

        updateCartDisplay();
        analytics.track('add_to_cart', { productId, productName: product.name });
    } catch (error) {
        showError('Failed to add to cart: ' + error.message);
    }
}

// Update cart display
function updateCartDisplay() {
    const cartItemsContainer = document.querySelector('.cart-items');
    const cartTotal = document.querySelector('.cart-total');
    const cartToggle = document.querySelector('.cart-toggle');

    // Update cart count
    var totalItems = 0;
    for (var i = 0; i < cartItems.length; i++) {
        totalItems += cartItems[i].quantity;
    }
    
    if (cartToggle) {
        cartToggle.innerHTML = '🛒 (' + totalItems + ')';
    }

    if (!cartItemsContainer) return;

    if (cartItems.length === 0) {
        cartItemsContainer.innerHTML = '<div class="loading">Your cart is empty</div>';
        if (cartTotal) cartTotal.innerHTML = '<strong>Total: ₹0</strong>';
        return;
    }

    // Render cart items
    var cartHTML = '';
    for (var i = 0; i < cartItems.length; i++) {
        var item = cartItems[i];
        var minusDisabled = item.quantity <= 1 ? 'disabled' : '';
        var plusDisabled = item.quantity >= item.stock ? 'disabled' : '';
        
        cartHTML += 
            '<div class="cart-item">' +
                '<div>' +
                    '<div class="product-name">' + item.name + '</div>' +
                    '<div class="product-price">₹' + item.price + ' x ' + item.quantity + '</div>' +
                '</div>' +
                '<div>' +
                    '<button onclick="updateCartQuantity(\'' + item._id + '\', ' + (item.quantity - 1) + ')" ' + minusDisabled + '>-</button>' +
                    '<span>' + item.quantity + '</span>' +
                    '<button onclick="updateCartQuantity(\'' + item._id + '\', ' + (item.quantity + 1) + ')" ' + plusDisabled + '>+</button>' +
                    '<button onclick="removeFromCart(\'' + item._id + '\')" class="delete-btn">Remove</button>' +
                '</div>' +
            '</div>';
    }
    
    cartItemsContainer.innerHTML = cartHTML;

    // Update total
    var total = 0;
    for (var i = 0; i < cartItems.length; i++) {
        total += cartItems[i].price * cartItems[i].quantity;
    }
    
    if (cartTotal) {
        cartTotal.innerHTML = 
            '<strong>Total: ₹' + total + '</strong>' +
            '<button class="btn btn-primary" onclick="checkout()" style="width: 100%; margin-top: 1rem;">' +
                'Checkout' +
            '</button>';
    }
}

// Update cart quantity
function updateCartQuantity(productId, newQuantity) {
    try {
        if (newQuantity <= 0) {
            removeFromCart(productId);
            return;
        }

        const item = cartItems.find(item => item._id === productId);
        if (!item) return;

        const product = products.find(p => p._id === productId);
        if (newQuantity > product.stock) {
            showError('Insufficient stock');
            return;
        }

        item.quantity = newQuantity;
        updateCartDisplay();
        showSuccess('Cart updated');
    } catch (error) {
        showError('Failed to update cart: ' + error.message);
    }
}

// Remove from cart
function removeFromCart(productId) {
    try {
        const index = cartItems.findIndex(item => item._id === productId);
        if (index > -1) {
            cartItems.splice(index, 1);
            updateCartDisplay();
            showSuccess('Item removed from cart');
        }
    } catch (error) {
        showError('Failed to remove item: ' + error.message);
    }
}

// Toggle cart
function toggleCart() {
    const cart = document.querySelector('.cart');
    if (cart) {
        cart.classList.toggle('open');
    }
}

// Checkout
function checkout() {
    if (cartItems.length === 0) {
        showError('Your cart is empty');
        return;
    }

    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.style.display = 'block';
    } else {
        // Simple checkout process
        const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const confirmed = confirm(`Proceed with checkout? Total: ₹${total}`);
        
        if (confirmed) {
            processOrder();
        }
    }
}

// Process order
function processOrder() {
    try {
        const order = {
            _id: Date.now().toString(),
            orderNumber: 'ORD' + Date.now(),
            items: [...cartItems],
            totalAmount: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            customerName: currentUser?.name || 'Guest',
            customerPhone: currentUser?.phone || '',
            customerAddress: currentUser?.address || '',
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        orders.push(order);
        
        // Update product stock
        cartItems.forEach(cartItem => {
            const product = products.find(p => p._id === cartItem._id);
            if (product) {
                product.stock -= cartItem.quantity;
            }
        });

        cartItems = [];
        updateCartDisplay();
        renderProducts(); // Refresh to show updated stock
        
        showSuccess(`Order placed successfully! Order ID: ${order.orderNumber}`);
        
        // Close any open modals
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.style.display = 'none');
        
        analytics.track('purchase', { orderId: order._id, total: order.totalAmount });
    } catch (error) {
        showError('Failed to process order: ' + error.message);
    }
}

// Authentication functions
function checkAuthStatus() {
    // Mock authentication check
    console.log('Checking auth status...');
}

function login() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'block';
    }
}

function register() {
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        registerModal.style.display = 'block';
    }
}

function logout() {
    currentUser = null;
    isAdminLoggedIn = false;
    showSuccess('Logged out successfully');
    updateAuthDisplay();
}

function updateAuthDisplay() {
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;

    if (currentUser) {
        authButtons.innerHTML = 
            '<div class="user-info">' +
                '<div class="user-avatar">' + currentUser.name.charAt(0).toUpperCase() + '</div>' +
                '<span>Hi, ' + currentUser.name + '</span>' +
                '<button class="btn" onclick="logout()">Logout</button>' +
            '</div>';
    } else {
        authButtons.innerHTML = 
            '<button class="btn" onclick="login()">Login</button>' +
            '<button class="btn btn-primary" onclick="register()">Register</button>';
    }
}

// Admin functions
function showAdminLogin() {
    const adminModal = document.getElementById('adminModal');
    if (adminModal) {
        adminModal.style.display = 'block';
    } else {
        const password = prompt('Enter admin password:');
        if (password === 'admin123') {
            isAdminLoggedIn = true;
            showAdminPanel();
            showSuccess('Admin logged in successfully');
        } else {
            showError('Invalid admin password');
        }
    }
}

function showAdminPanel() {
    const adminPanel = document.querySelector('.admin-panel');
    if (adminPanel) {
        adminPanel.classList.add('active');
        renderAdminDashboard();
    }
}

function renderAdminDashboard() {
    // This would render admin dashboard content
    console.log('Rendering admin dashboard...');
}

// Utility functions
function showError(message) {
    console.error(message);
    showNotification(message, 'error');
}

function showSuccess(message) {
    console.log(message);
    showNotification(message, 'success');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem;
        border-radius: 4px;
        color: white;
        z-index: 10000;
        max-width: 300px;
        background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);

    // Click to dismiss
    notification.addEventListener('click', () => {
        if (notification.parentNode) {
            notification.remove();
        }
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
        }
    }
    
    // Alt + C for cart
    if (e.altKey && e.key === 'c') {
        e.preventDefault();
        toggleCart();
    }
    
    // Alt + A for admin (if logged in)
    if (e.altKey && e.key === 'a' && isAdminLoggedIn) {
        e.preventDefault();
        showAdminPanel();
    }

    // Escape to close modals
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal[style*="block"]');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
        
        const cart = document.querySelector('.cart.open');
        if (cart) {
            cart.classList.remove('open');
        }
    }
});

// Touch/swipe support for mobile
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', function(e) {
    if (!touchStartX || !touchStartY) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    
    // Minimum swipe distance
    if (Math.abs(diffX) < 50 && Math.abs(diffY) < 50) return;
    
    // Horizontal swipes
    if (Math.abs(diffX) > Math.abs(diffY)) {
        const cart = document.querySelector('.cart');
        if (!cart) return;

        if (diffX > 0) {
            // Swipe left - open cart
            if (!cart.classList.contains('open')) {
                toggleCart();
            }
        } else {
            // Swipe right - close cart
            if (cart.classList.contains('open')) {
                toggleCart();
            }
        }
    }
    
    touchStartX = 0;
    touchStartY = 0;
}, { passive: true });

// Image lazy loading
function enableLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px'
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            img.classList.add('lazy');
            imageObserver.observe(img);
        });
    }
}

// Dark mode functionality
let darkModeEnabled = false;

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    darkModeEnabled = document.body.classList.contains('dark-mode');
    
    console.log('Dark mode:', darkModeEnabled ? 'enabled' : 'disabled');
    showSuccess(`Dark mode ${darkModeEnabled ? 'enabled' : 'disabled'}`);
}

function initializeDarkMode() {
    console.log('Dark mode initialized');
}

// Network status monitoring
function initializeNetworkMonitoring() {
    function updateNetworkStatus() {
        const offlineIndicator = document.getElementById('offlineIndicator');
        
        if (navigator.onLine) {
            if (offlineIndicator) {
                offlineIndicator.remove();
            }
        } else {
            if (!offlineIndicator) {
                const indicator = document.createElement('div');
                indicator.id = 'offlineIndicator';
                indicator.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #f44336;
                    color: white;
                    padding: 0.5rem;
                    text-align: center;
                    z-index: 10001;
                `;
                indicator.textContent = 'You are currently offline. Some features may not work.';
                document.body.appendChild(indicator);
            }
        }
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();
}

// Export and backup functions (simplified for demo)
function exportToCSV(data, filename) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        showError('No data to export');
        return;
    }

    try {
        const csvContent = convertToCSV(data);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showSuccess('Data exported successfully');
        } else {
            showError('Export not supported in this browser');
        }
    } catch (error) {
        showError('Failed to export data: ' + error.message);
    }
}

function convertToCSV(data) {
    if (!data || !data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => 
        headers.map(header => {
            let value = row[header];
            
            if (value === null || value === undefined) {
                value = '';
            } else if (typeof value === 'object') {
                value = JSON.stringify(value);
            } else {
                value = String(value);
            }
            
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            
            return value;
        }).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
}

// Error handling
window.addEventListener('error', function(e) {
    console.error('Unhandled error:', e.error);
    analytics.track('error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
    });
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    analytics.track('promise_rejection', {
        reason: e.reason?.message || String(e.reason)
    });
});

// Browser compatibility check
function checkBrowserCompatibility() {
    const requiredFeatures = [
        'querySelector',
        'addEventListener',
        'JSON',
        'Promise'
    ];
    
    const unsupportedFeatures = requiredFeatures.filter(feature => !window[feature]);
    
    if (unsupportedFeatures.length > 0) {
        var featureList = '';
        for (var i = 0; i < unsupportedFeatures.length; i++) {
            featureList += '<li>' + unsupportedFeatures[i] + '</li>';
        }
    }
    
    return true;
}

// Initialize browser compatibility check
if (checkBrowserCompatibility()) {
    console.log('Little Treasures Store - All features loaded successfully!');
    console.log('Available keyboard shortcuts:');
    console.log('- Ctrl/Cmd + K: Focus search');
    console.log('- Alt + C: Toggle cart');
    console.log('- Alt + A: Admin panel (if logged in)');
    console.log('- Escape: Close modals');
}