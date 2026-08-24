/**
 * Language switching.
 *
 * The pages are written in Spanish — that is the default, so no translation
 * runs on first paint and there is no flash of the wrong language. This file
 * supplies the English, applied only when the visitor asks for it.
 *
 * Markup contract:
 *   data-i18n="key"                     replaces textContent
 *   data-i18n-html="key"                replaces innerHTML (use sparingly)
 *   data-i18n-attr="placeholder:key"    replaces one or more attributes
 *
 * A key with no English entry is left alone, so a missed string degrades to
 * Spanish rather than to blank.
 */
(function (global) {
  'use strict';

  var STORE = 'melaos.lang';
  var EN = {
    /* ── Header & nav ── */
    'brand.tagline': 'Homes for Rent',
    'nav.homes': 'Homes for Rent',
    'nav.areas': 'Where We Rent',
    'nav.how': 'How It Works',
    'nav.about': 'About Us',
    'nav.tenants': 'Current Tenants',
    'nav.menu': 'Menu',
    'nav.open': 'Open menu',
    'nav.close': 'Close menu',
    'cta.whatsapp': 'WhatsApp us',
    'cta.whatsappLong': 'Message us on WhatsApp',
    'skip': 'Skip to main content',

    /* ── Hero ── */
    'hero.badge': 'Renting across Texas since 2009',
    'hero.title': 'Looking for a house to rent?',
    'hero.body': 'We rent clean, well-kept houses in Austin, Dallas–Fort Worth, Houston and San Antonio. Clear prices, no surprise fees, and repairs that actually get done.',
    'hero.see': 'See available homes',
    'hero.ask': 'Ask on WhatsApp',
    'hero.anytime': 'Message us any time —',
    'hero.fast': '. We answer fast.',
    'hero.alt': 'Illustration of a single-family rental house',

    /* ── Filter ── */
    'filter.legend': 'Find a home',
    'filter.city': 'City',
    'filter.allCities': 'All cities',
    'filter.rent': 'Monthly rent',
    'filter.anyRent': 'Any rent',
    'filter.under': 'Under $1,500',
    'filter.r1': '$1,500 – $2,000',
    'filter.r2': '$2,000 – $2,500',
    'filter.r3': '$2,500+',
    'filter.beds': 'Bedrooms',
    'filter.anySize': 'Any size',
    'filter.b2': '2+ bedrooms',
    'filter.b3': '3+ bedrooms',
    'filter.b4': '4+ bedrooms',
    'filter.search': 'Search',
    'filter.reset': 'Reset',

    /* ── Homes ── */
    'homes.title': 'Homes for rent',
    'homes.body': 'Available now, plus homes that are rented today so you can see what tends to come up.',
    'homes.tabs': 'Availability',
    'homes.available': 'Available now',
    'homes.occupied': 'Currently rented',
    'homes.forSale': 'For sale',
    'empty.title': 'Nothing listed here right now',
    'empty.body': 'Homes come up often and the good ones go fast. Message us and we will tell you what is opening up before it goes online.',
    'empty.cta': 'Tell us what you need',

    /* ── Areas ── */
    'areas.title': 'Where we rent',
    'areas.body': 'The areas we know well and keep houses in.',
    'areas.none': 'Areas will show here once they are added.',

    /* ── How it works ── */
    'how.title': 'How renting with us works',
    'how.body': 'Four steps, no runaround.',
    'how.s1.t': 'See the house',
    'how.s1.b': 'Message us and we will set up a time. Same week, usually same day.',
    'how.s2.t': 'Apply',
    'how.s2.b': 'Simple application. We tell you exactly what we look at, and what the fees are, before you pay anything.',
    'how.s3.t': 'Sign and pay',
    'how.s3.b': 'Lease in plain language. Deposit and first month, nothing hidden.',
    'how.s4.t': 'Move in',
    'how.s4.b': 'Keys, and a number that answers when something breaks.',

    /* ── About ── */
    'about.title': 'About us',
    'about.p1': 'Melao’s is a family business. We own and look after the houses we rent, so when you call about a problem you are talking to the people who can fix it — not a call center.',
    'about.p2': 'We are not the biggest landlord in Texas. We are the one that picks up the phone.',
    'about.cta': 'Talk to us',
    'about.c1.t': 'Repairs get done',
    'about.c1.b': 'Report it from your phone. Emergencies same day.',
    'about.c2.t': 'No surprise fees',
    'about.c2.b': 'What you are quoted is what you pay.',
    'about.c3.t': 'Straight answers',
    'about.c3.b': 'If a house will not work for you, we will say so.',
    'about.c4.t': 'Fair housing',
    'about.c4.b': 'Everyone gets the same terms and the same process.',

    /* ── Contact ── */
    'contact.title': 'Ask about a home',
    'contact.body': 'Fastest way to reach us is WhatsApp. Send a message and we will answer with what is available, what it costs, and when you can see it.',
    'contact.or': 'Or call',
    'contact.hours': 'Mon–Sat 8am–7pm',
    'contact.prefer': 'Prefer we contact you? Leave your details.',
    'form.name': 'Your name',
    'form.namePh': 'Jordan Alvarez',
    'form.nameErr': 'Please enter your name.',
    'form.phone': 'Phone',
    'form.phoneErr': 'Please enter a phone number we can reach you on.',
    'form.email': 'Email',
    'form.emailPh': 'you@email.com',
    'form.emailErr': 'That email does not look right.',
    'form.city': 'City',
    'form.chooseCity': 'Choose a city',
    'form.cityErr': 'Please choose a city.',
    'form.budget': 'Monthly budget',
    'form.notSure': 'Not sure yet',
    'form.when': 'When do you need it?',
    'form.now': 'Right away',
    'form.month': 'Within a month',
    'form.months': '1 – 3 months',
    'form.looking': 'Just looking',
    'form.else': 'Anything else?',
    'form.elsePh': 'Three bedrooms, fenced yard, near a school, we have a dog…',
    'form.consent': 'You can contact me about renting a home.',
    'form.consentErr': 'Please tick the box so we can reply.',
    'form.send': 'Send',

    /* ── Footer ── */
    'footer.blurb': 'Family-run rentals across Texas. We own the houses we rent and look after them ourselves.',
    'footer.homes': 'Homes',
    'footer.availableNow': 'Available now',
    'footer.rented': 'Currently rented',
    'footer.tenants': 'Tenants',
    'footer.portal': 'Tenant portal',
    'footer.repair': 'Report a repair',
    'footer.complaint': 'Make a complaint',
    'footer.contact': 'Contact',
    'footer.details': 'Send us your details',
    'footer.eho': 'Equal Housing Opportunity.',
    'footer.legal': 'We rent in accordance with federal, state and local fair housing law. We do not refuse to rent, or set different terms, because of race, color, religion, sex, disability, familial status or national origin. Rents, availability, deposits and terms are subject to change and are not a contract. Photographs may show a similar home. Applicant screening criteria are available on request.',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
    'footer.access': 'Accessibility',

    /* ── Listing modal ── */
    'modal.close': 'Close',
    'modal.wantSee': 'Want to see it?',
    'modal.ask': 'Ask about this home',
    'modal.rent': 'Rent',
    'modal.price': 'Price',
    'modal.beds': 'Bedrooms',
    'modal.baths': 'Bathrooms',
    'modal.sqft': 'Square feet',
    'modal.available': 'Available',
    'modal.rented': 'Currently rented',
    'modal.forSale': 'For sale',

    /* ── Card and status strings built in script ── */
    'card.available': 'Available',
    'card.rented': 'Rented',
    'card.availableNow': 'Available now',
    'card.moveIn': 'Move in',
    'card.freeFrom': 'Free from',
    'card.details': 'See details',
    'card.beds': 'Beds',
    'card.baths': 'Baths',
    'card.sqft': 'Sq ft',
    'card.availableCount': 'available',
    'card.perMonth': 'mo',
    'card.perYear': 'yr',
    'card.orYear': 'or',
    'card.rentedNow': 'Currently rented',
    'modal.rentYear': 'Yearly rent',
    'wa.looking': 'Hi, I am looking for a house to rent.',
    'wa.upcoming': 'Hi, do you have anything coming up for rent?',
    'wa.interested': 'Hi, I am interested in',
    'wa.stillAvailable': 'Is it still available?',
    'status.none': 'No homes listed online right now — message us and we will tell you what is coming up.',
    'status.matchOne': 'home matches what you are looking for.',
    'status.matchMany': 'homes match what you are looking for.',
    'status.allOne': 'Showing all 1 home.',
    'status.allMany': 'Showing all {n} homes.',
    'status.failed': 'Listings could not be loaded',
    'form.fix': 'Please check the highlighted boxes.',
    'form.thanks': 'Thanks',
    'form.sendNow': 'Send it now on WhatsApp',
    'form.forFastest': 'for the fastest answer, or',
    'form.emailIt': 'email it',
    'form.sending': 'Sending…',
    'form.failed': 'That did not send',
    'form.waInstead': 'Message us on WhatsApp instead',
    'lang.toggle': 'Español',
  };

  var lang = 'es';

  function apply() {
    var dict = lang === 'en' ? EN : null;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!el.hasAttribute('data-i18n-es')) el.setAttribute('data-i18n-es', el.textContent);
      var next = dict ? dict[key] : el.getAttribute('data-i18n-es');
      if (next != null) el.textContent = next;
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (!el.hasAttribute('data-i18n-es-html')) el.setAttribute('data-i18n-es-html', el.innerHTML);
      var next = dict ? dict[key] : el.getAttribute('data-i18n-es-html');
      if (next != null) el.innerHTML = next;
    });

    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var bits = pair.split(':');
        var attr = bits[0].trim(), key = bits[1].trim();
        var stash = 'data-i18n-es-' + attr;
        if (!el.hasAttribute(stash)) el.setAttribute(stash, el.getAttribute(attr) || '');
        var next = dict ? dict[key] : el.getAttribute(stash);
        if (next != null) el.setAttribute(attr, next);
      });
    });

    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang-toggle]').forEach(function (b) {
      // The button always offers the *other* language.
      b.textContent = lang === 'es' ? 'English' : 'Español';
      b.setAttribute('aria-label', lang === 'es' ? 'Switch to English' : 'Cambiar a español');
    });
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: lang } }));
  }

  var I18N = {
    get lang() { return lang; },
    /** Translate a script-built string. Falls back to the Spanish passed in. */
    t: function (key, spanish) {
      if (lang === 'en' && EN[key] != null) return EN[key];
      return spanish;
    },
    set: function (next) {
      lang = next === 'en' ? 'en' : 'es';
      try { localStorage.setItem(STORE, lang); } catch (e) {}
      apply();
    },
    toggle: function () { I18N.set(lang === 'es' ? 'en' : 'es'); },
    refresh: apply,
    init: function () {
      var saved = '';
      try { saved = localStorage.getItem(STORE) || ''; } catch (e) {}
      // Spanish is the default for everyone. English only if the visitor asked
      // for it and we remembered — the browser's own setting is not consulted,
      // because this business speaks Spanish first.
      lang = saved === 'en' ? 'en' : 'es';
      document.addEventListener('click', function (e) {
        if (e.target.closest('[data-lang-toggle]')) { e.preventDefault(); I18N.toggle(); }
      });
      apply();
    },
  };

  global.I18N = I18N;
})(window);
