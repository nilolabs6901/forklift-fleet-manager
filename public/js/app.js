/**
 * Forklift Fleet Manager - Client-side JavaScript
 * Modern Glassmorphism UI with Animations
 */

// ===== Global Toast Function =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const id = 'toast-' + Date.now();
  const icons = {
    success: 'bi-check-circle-fill',
    danger: 'bi-exclamation-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
  };

  const gradients = {
    success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    danger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
  };

  const toast = document.createElement('div');
  toast.className = 'toast show';
  toast.id = id;
  toast.setAttribute('role', 'alert');
  toast.style.animation = 'slideInRight 0.3s ease';
  toast.innerHTML = `
    <div class="toast-header" style="background: ${gradients[type] || gradients.info}; color: white; border: none;">
      <i class="bi ${icons[type] || icons.info} me-2"></i>
      <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
    </div>
    <div class="toast-body" style="padding: 16px;">
      ${message}
    </div>
  `;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);

  // Close button handler
  toast.querySelector('.btn-close').addEventListener('click', () => {
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  });
}

// Add keyframe animations dynamically
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(100px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideOutRight {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(100px); }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;
document.head.appendChild(styleSheet);

// ===== Page Load Animations =====
document.addEventListener('DOMContentLoaded', function() {
  // Animate stat cards on load
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
      card.style.transition = 'all 0.5s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 100 + (index * 100));
  });

  // Animate glass cards on load
  const glassCards = document.querySelectorAll('.glass-card, .chart-container');
  glassCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
      card.style.transition = 'all 0.5s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 300 + (index * 100));
  });

  // Animate table rows on load
  const tableRows = document.querySelectorAll('.table tbody tr, .alert-item');
  tableRows.forEach((row, index) => {
    row.style.opacity = '0';
    row.style.transform = 'translateX(-10px)';
    setTimeout(() => {
      row.style.transition = 'all 0.3s ease';
      row.style.opacity = '1';
      row.style.transform = 'translateX(0)';
    }, 50 + (index * 30));
  });
});

// ===== Sidebar Toggle =====
document.addEventListener('DOMContentLoaded', function() {
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');

  if (sidebarToggle && sidebar) {
    // Create overlay for mobile
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    sidebarToggle.addEventListener('click', function() {
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', function() {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
    });
  }
});

// ===== Resolve Alert Handler =====
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.resolve-alert').forEach(btn => {
    btn.addEventListener('click', async function() {
      const id = this.dataset.id;
      const button = this;

      // Add loading state
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      try {
        const response = await fetch(`/api/alerts/${id}/resolve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
          showToast('Alert resolved successfully', 'success');

          // Animate the alert item
          const alertItem = button.closest('.list-group-item, .alert-item');
          if (alertItem) {
            alertItem.style.transition = 'all 0.3s ease';
            alertItem.style.opacity = '0.5';
            alertItem.style.transform = 'translateX(20px)';
          }

          // Reload after animation
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast(result.error || 'Failed to resolve alert', 'danger');
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-check-lg"></i>';
        }
      } catch (error) {
        showToast('Error resolving alert', 'danger');
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-check-lg"></i>';
        console.error(error);
      }
    });
  });
});

// ===== Load Active Alerts Badge =====
document.addEventListener('DOMContentLoaded', async function() {
  const alertBadge = document.getElementById('alertBadge');
  const alertsDropdownMenu = document.getElementById('alertsDropdownMenu');

  if (alertBadge && alertsDropdownMenu) {
    try {
      const response = await fetch('/api/alerts?resolved=false&limit=5');
      const result = await response.json();

      if (result.success) {
        const activeCount = result.count;

        if (activeCount > 0) {
          alertBadge.style.display = 'block';
          alertsDropdownMenu.innerHTML = `
            <li class="dropdown-header">
              <span>Notifications (${activeCount})</span>
              <a href="/alerts" class="view-all">View All</a>
            </li>
            <li><hr class="dropdown-divider"></li>
            ${result.data.map(alert => `
              <li>
                <a class="dropdown-item d-flex align-items-center py-2" href="/alerts">
                  <span class="badge badge-severity-${alert.severity} me-2" style="font-size: 0.65rem;">
                    ${alert.severity.toUpperCase()}
                  </span>
                  <span class="text-truncate" style="max-width: 200px;">${alert.title}</span>
                </a>
              </li>
            `).join('')}
          `;
        }
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  }
});

// ===== Smooth Scroll =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ===== Button Click Animation =====
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      // Create ripple effect
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: rippleEffect 0.6s ease-out;
        pointer-events: none;
      `;

      this.style.position = 'relative';
      this.style.overflow = 'hidden';
      this.appendChild(ripple);

      setTimeout(() => ripple.remove(), 600);
    });
  });

  // Add ripple keyframes
  const rippleStyle = document.createElement('style');
  rippleStyle.textContent = `
    @keyframes rippleEffect {
      to { transform: scale(4); opacity: 0; }
    }
  `;
  document.head.appendChild(rippleStyle);
});

// ===== Form Validation Feedback =====
document.addEventListener('DOMContentLoaded', function() {
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      if (!form.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
        showToast('Please fill in all required fields', 'warning');
      }
      form.classList.add('was-validated');
    });
  });
});

// ===== Confirm Delete =====
function confirmDelete(message = 'Are you sure you want to delete this item?') {
  return confirm(message);
}

// ===== Format Numbers =====
function formatNumber(num) {
  return new Intl.NumberFormat().format(num);
}

// ===== Format Currency =====
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// ===== Format Date =====
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// ===== API Helper =====
const api = {
  async get(url) {
    const response = await fetch(url);
    return response.json();
  },

  async post(url, data) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async put(url, data) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async delete(url) {
    const response = await fetch(url, { method: 'DELETE' });
    return response.json();
  }
};

// ===== Debounce Function =====
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

// ===== Search Input Handler =====
document.addEventListener('DOMContentLoaded', function() {
  const searchInputs = document.querySelectorAll('input[name="search"], .search-input');
  searchInputs.forEach(input => {
    // Add focus animation
    input.addEventListener('focus', function() {
      this.parentElement.style.transform = 'scale(1.02)';
      this.parentElement.style.transition = 'transform 0.2s ease';
    });
    input.addEventListener('blur', function() {
      this.parentElement.style.transform = 'scale(1)';
    });
  });
});

// ===== Table Row Hover Effect =====
document.addEventListener('DOMContentLoaded', function() {
  const tableRows = document.querySelectorAll('.table tbody tr, .modern-table tbody tr');
  tableRows.forEach(row => {
    row.addEventListener('mouseenter', function() {
      this.style.transform = 'translateX(4px)';
      this.style.transition = 'transform 0.2s ease';
    });
    row.addEventListener('mouseleave', function() {
      this.style.transform = 'translateX(0)';
    });
  });
});

// ===== Initialize Bootstrap Tooltips =====
document.addEventListener('DOMContentLoaded', function() {
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"], [title]'));
  tooltipTriggerList.forEach(function(tooltipTriggerEl) {
    if (tooltipTriggerEl.title) {
      new bootstrap.Tooltip(tooltipTriggerEl);
    }
  });
});

// ===== Initialize Bootstrap Popovers =====
document.addEventListener('DOMContentLoaded', function() {
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function(popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
});

// ===== Counter Animation =====
function animateCounter(element, target, duration = 1000) {
  const start = 0;
  const increment = target / (duration / 16);
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = formatNumber(target);
      clearInterval(timer);
    } else {
      element.textContent = formatNumber(Math.floor(current));
    }
  }, 16);
}

// ===== Lazy Load Images =====
document.addEventListener('DOMContentLoaded', function() {
  const lazyImages = document.querySelectorAll('img[data-src]');
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  });

  lazyImages.forEach(img => imageObserver.observe(img));
});

// ===== Export for use in inline scripts =====
window.showToast = showToast;
window.confirmDelete = confirmDelete;
window.formatNumber = formatNumber;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.api = api;
window.animateCounter = animateCounter;
