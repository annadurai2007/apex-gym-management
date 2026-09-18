/* ==========================================================================
   APEX FITNESS CLUB - ULTRA-LUXURY LANDING PAGE CONTROLLER
   Zone Explorer, Billing Switcher, VIP Booking, FAQ Accordion, Telemetry
   ========================================================================== */

const LandingState = {
  billingCycle: 'monthly', // 'monthly' | 'annual'
  plansCache: [],
  currentZone: 'coliseum',
  zones: {
    coliseum: {
      code: 'ZONE 01 // HEAVY COMPOUND',
      title: 'The Iron Coliseum',
      desc: 'Engineered for maximal force production. Featuring 8 competition Eleiko powerlifting platforms, calibrated cast-iron plates, custom monolifts, and dumbbells up to 150 lbs.',
      image: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1000&q=80',
      specs: [
        { label: 'Barbells', value: 'Eleiko IPF Certified' },
        { label: 'Dumbbells', value: '5 to 150 lbs' },
        { label: 'Platforms', value: '8 Hardwood Racks' },
        { label: 'Specialty Bars', value: 'Safety Squat & Trap' }
      ]
    },
    cryo: {
      code: 'ZONE 02 // RECOVERY & THERAPY',
      title: 'Cryo & Cellular Vault',
      desc: 'State-of-the-art biological restoration. Sub-zero whole body cryotherapy (-110°C), full-spectrum infrared saunas, and pneumatic NormaTec compression boots.',
      image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=1000&q=80',
      specs: [
        { label: 'Cryo Temp', value: '-110° Celsius' },
        { label: 'Infrared Saunas', value: 'Near, Mid & Far' },
        { label: 'Cold Plunge', value: '42°F Circulating' },
        { label: 'Compression', value: 'Hyperice Boots' }
      ]
    },
    cardio: {
      code: 'ZONE 03 // ENDURANCE & METABOLICS',
      title: 'Cardio Amphitheater',
      desc: 'Non-motorized curved treadmills, Concept2 SkiErgs, and assault bikes with real-time biometric telemetry broadcasted on heads-up displays.',
      image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1000&q=80',
      specs: [
        { label: 'Treadmills', value: 'Woodway Curve' },
        { label: 'Ergometers', value: 'Concept2 Row & Ski' },
        { label: 'Stair Climbers', value: 'StairMaster Gauntlet' },
        { label: 'Telemetry', value: 'Polar & Garmin Sync' }
      ]
    },
    apothecary: {
      code: 'ZONE 04 // BIO-NUTRITION',
      title: 'Fuel Lounge & Apothecary',
      desc: 'Precision post-workout recovery smoothies, cold-pressed green elixirs, and bespoke meal preparation formulated specifically to match your daily macronutrient targets.',
      image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1000&q=80',
      specs: [
        { label: 'Protein', value: 'Grass-Fed Whey & Plant' },
        { label: 'Electrolytes', value: 'Raw Himalayan Salt' },
        { label: 'Meal Prep', value: 'Chef-Formulated' },
        { label: 'Espresso', value: 'Single-Origin Roasts' }
      ]
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initUltraLanding();
});

async function initUltraLanding() {
  UI.refreshIcons();
  setupZoneExplorer();
  setupBillingToggle();
  setupFaqAccordion();
  setupVipBooking();
  setupMobileMenu();
  setupBmiCalculator();
  await loadPlans();
  await loadTrainers();
  UI.refreshIcons();
}

/* --------------------------------------------------------------------------
   1. ZONE EXPLORER SWITCHER
--------------------------------------------------------------------------- */
function setupZoneExplorer() {
  const tabs = document.querySelectorAll('.zone-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const zoneKey = tab.getAttribute('data-zone');
      if (LandingState.zones[zoneKey]) {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderZoneDisplay(zoneKey);
      }
    });
  });
}

function renderZoneDisplay(zoneKey) {
  const z = LandingState.zones[zoneKey];
  if (!z) return;

  const card = document.getElementById('zone-display-card');
  if (!card) return;

  card.style.opacity = '0.4';
  card.style.transform = 'scale(0.98)';

  setTimeout(() => {
    document.getElementById('zone-code-display').textContent = z.code;
    document.getElementById('zone-title-display').textContent = z.title;
    document.getElementById('zone-desc-display').textContent = z.desc;
    document.getElementById('zone-img-display').src = z.image;

    const specsContainer = document.getElementById('zone-specs-display');
    if (specsContainer) {
      specsContainer.innerHTML = z.specs.map(s => `
        <div>
          <div class="spec-item-label">${s.label}</div>
          <div class="spec-item-value">${s.value}</div>
        </div>
      `).join('');
    }

    card.style.opacity = '1';
    card.style.transform = 'scale(1)';
  }, 150);
}

/* --------------------------------------------------------------------------
   2. MEMBERSHIP PLANS WITH BILLING TOGGLE
--------------------------------------------------------------------------- */
function setupBillingToggle() {
  const monthlyBtn = document.getElementById('billing-monthly-btn');
  const annualBtn = document.getElementById('billing-annual-btn');

  if (monthlyBtn && annualBtn) {
    monthlyBtn.addEventListener('click', () => {
      LandingState.billingCycle = 'monthly';
      monthlyBtn.classList.add('active');
      annualBtn.classList.remove('active');
      renderMembershipCards();
    });

    annualBtn.addEventListener('click', () => {
      LandingState.billingCycle = 'annual';
      annualBtn.classList.add('active');
      monthlyBtn.classList.remove('active');
      renderMembershipCards();
    });
  }
}

async function loadPlans() {
  const res = await apiFetch('/plans');
  if (res.success && res.data) {
    LandingState.plansCache = res.data;
    renderMembershipCards();
  }
}

function renderMembershipCards() {
  const container = document.getElementById('editorial-plans-container');
  if (!container) return;

  const isAnnual = LandingState.billingCycle === 'annual';
  const plans = LandingState.plansCache;

  if (!plans || plans.length === 0) {
    container.innerHTML = '<p class="text-muted text-center" style="grid-column: 1/-1;">Loading membership plans...</p>';
    return;
  }

  container.innerHTML = plans.map(p => {
    // If annual, apply 20% savings discount
    let displayPrice = p.price;
    let durationLabel = `${p.duration_months} ${p.duration_months === 1 ? 'Month' : 'Months'}`;

    if (isAnnual) {
      displayPrice = Math.round(p.price * 0.80);
      durationLabel = 'Month (Billed Annually)';
    }

    const isFeatured = p.badge === 'Popular' || p.badge === 'Best Value';
    const features = p.features_list || [];

    return `
      <div class="plan-card ${isFeatured ? 'featured' : ''}">
        ${p.badge ? `<div class="plan-badge">${p.badge}</div>` : ''}
        <div class="plan-header">
          <h3 class="plan-name">${p.name}</h3>
          <p class="plan-desc">${p.description || 'Full luxury athletic floor & amenities.'}</p>
        </div>
        <div class="plan-price-box">
          <span class="plan-currency">$</span>
          <span class="plan-price">${Math.round(displayPrice)}</span>
          <span class="plan-duration">/ ${durationLabel}</span>
        </div>
        <ul class="plan-features">
          ${features.map(f => `
            <li class="plan-feature-item">
              <i data-lucide="check" class="plan-feature-icon" style="width: 16px; height: 16px;"></i>
              <span>${f}</span>
            </li>
          `).join('')}
        </ul>
        <a href="/login?plan=${p.id}" class="btn ${isFeatured ? 'btn-primary' : 'btn-secondary'} btn-lg" style="width: 100%;">
          Claim ${p.name} Pass
        </a>
      </div>
    `;
  }).join('');

  UI.refreshIcons();
}

/* --------------------------------------------------------------------------
   3. COACHES SHOWCASE
--------------------------------------------------------------------------- */
async function loadTrainers() {
  const container = document.getElementById('editorial-trainers-container');
  if (!container) return;

  const res = await apiFetch('/trainers');
  if (res.success && res.data) {
    container.innerHTML = res.data.map(t => `
      <div class="trainer-card">
        <div class="trainer-image-box">
          <img src="${t.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'}" alt="${t.full_name}" class="trainer-image">
        </div>
        <div class="trainer-content">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
            <h3 class="trainer-name">${t.full_name}</h3>
            <span class="badge badge-lime" style="font-size: 0.68rem;">${t.experience_years}+ Yrs Experience</span>
          </div>
          <div class="trainer-spec">${t.specialization}</div>
          <p class="trainer-bio">${t.bio || 'Master coach.'}</p>
          <div class="trainer-schedule">
            <i data-lucide="clock" style="width: 15px; height: 15px; color: var(--accent-primary);"></i>
            <span>${t.schedule}</span>
          </div>
        </div>
      </div>
    `).join('');
    UI.refreshIcons();
  }
}

/* --------------------------------------------------------------------------
   4. VIP PASS BOOKING TERMINAL
--------------------------------------------------------------------------- */
function setupVipBooking() {
  const form = document.getElementById('vip-booking-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.vip_name.value.trim();
    const email = form.vip_email.value.trim();
    const phone = form.vip_phone.value.trim();
    const date = form.vip_date.value;
    const experience = form.vip_experience.value;

    if (!name || !email || !phone || !date) {
      UI.showToast('Please complete all reservation fields', 'warning');
      return;
    }

    UI.showToast(`VIP Pass reserved for ${name}! Our concierge will text your access pass for ${date}.`, 'success', 'Pass Confirmed');
    form.reset();
  });
}

/* --------------------------------------------------------------------------
   5. FAQ ACCORDION
--------------------------------------------------------------------------- */
function setupFaqAccordion() {
  const items = document.querySelectorAll('.faq-accordion-item');
  items.forEach(item => {
    const btn = item.querySelector('.faq-trigger-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        items.forEach(i => i.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });
}

/* --------------------------------------------------------------------------
   6. MOBILE MENU & BMI TOOL
--------------------------------------------------------------------------- */
function setupMobileMenu() {
  const toggleBtn = document.getElementById('mobile-nav-toggle');
  const navMenu = document.getElementById('mobile-nav-menu');
  const backdrop = document.getElementById('mobile-nav-backdrop');
  const closeBtn = document.getElementById('mobile-nav-close');
  const navLinks = document.querySelectorAll('.mobile-nav-link, .mobile-drawer-actions a');

  function openDrawer() {
    navMenu?.classList.add('active');
    backdrop?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    navMenu?.classList.remove('active');
    backdrop?.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggleBtn?.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  backdrop?.addEventListener('click', closeDrawer);
  navLinks.forEach(link => link.addEventListener('click', closeDrawer));
}

function setupBmiCalculator() {
  const calcBtn = document.getElementById('calc-submit-btn');
  if (!calcBtn) return;

  calcBtn.addEventListener('click', () => {
    const h = parseFloat(document.getElementById('calc-height').value);
    const w = parseFloat(document.getElementById('calc-weight').value);
    const activity = parseFloat(document.getElementById('calc-activity').value) || 1.55;

    if (!h || !w || h <= 0 || w <= 0) {
      UI.showToast('Please enter valid height and weight', 'warning');
      return;
    }

    const bmi = (w / ((h / 100) * (h / 100))).toFixed(1);
    const bmr = 10 * w + 6.25 * h - 5 * 28 + 5;
    const tdee = Math.round(bmr * activity);

    document.getElementById('calc-bmi-val').textContent = bmi;
    document.getElementById('calc-calories-val').textContent = `${tdee.toLocaleString()} kcal`;
    
    let status = 'Optimal';
    if (bmi < 18.5) status = 'Lean / Sub-Target';
    else if (bmi >= 25 && bmi < 30) status = 'Overweight';
    else if (bmi >= 30) status = 'High Body Mass';

    const statusEl = document.getElementById('calc-status-val');
    if (statusEl) {
      statusEl.textContent = status;
    }

    UI.showToast(`Biometrics calculated: BMI ${bmi} (${status})`, 'success');
  });
}
