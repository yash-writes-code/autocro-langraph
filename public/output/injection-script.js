(function() {
  'use strict';

  var zones = [
  {
    "zone": "headline",
    "sel": "div > div.bg-dark-primary.min-h-screen > main > section.min-h-screen.flex > div.container.mx-auto > div.text-center.max-w-4xl > div > h1.text-4xl.md\\:text-5xl",
    "text": "Stop Wasting Hours on Project Chaos"
  },
  {
    "zone": "subheadline",
    "sel": "div > div.bg-dark-primary.min-h-screen > main > section.min-h-screen.flex > div.container.mx-auto > div.text-center.max-w-4xl > p.text-lg.md\\:text-xl",
    "text": "Reclaim your 8 hours weekly. Expert CRO for remote teams to eliminate project chaos and boost results."
  },
  {
    "zone": "cta",
    "sel": "div > div.bg-dark-primary.min-h-screen > main > section.min-h-screen.flex > div.container.mx-auto > div.text-center.max-w-4xl > div.flex.flex-col > a.w-full.sm\\:w-auto > button.w-full.h-\\[52px\\]",
    "text": "Claim 50% Off Now"
  },
  {
    "zone": "cta_secondary",
    "sel": "div > div.bg-dark-primary.min-h-screen > main > section.py-20.relative > div.container.mx-auto > div.grid.grid-cols-1 > div.relative > form.space-y-6 > button.w-full.h-\\[52px\\]",
    "text": "Get Your Discount"
  },
  {
    "zone": "cta_tertiary",
    "sel": "div > div.bg-dark-primary.min-h-screen > main > section.min-h-screen.flex > div.container.mx-auto > div.text-center.max-w-4xl > div.flex.flex-col > button.w-full.sm\\:w-auto",
    "text": "Grab 50% Off"
  }
];
  var styleProfile = {
  "fontFamily": "Montserrat, sans-serif",
  "textColor": "rgb(255, 255, 255)",
  "surfaceColor": "rgb(0, 0, 0)",
  "accentColor": "rgb(255, 255, 255)",
  "accentTextColor": "rgb(255, 255, 255)",
  "accentSoftColor": "rgba(17, 24, 39, 0.08)",
  "accentBorderColor": "rgb(229, 231, 235)",
  "borderRadius": "0px",
  "cardRadius": "0px",
  "shadow": "0 12px 28px rgba(15, 23, 42, 0.18)",
  "softShadow": "0 12px 24px rgba(15, 23, 42, 0.08)"
};
  var banner = {
  "text": "DISCOUNT — Stop wasting 8hrs/week on project chaos.",
  "backgroundColor": "rgb(255, 255, 255)",
  "textColor": "rgb(255, 255, 255)"
};

  function setStyles(node, styles) {
    Object.keys(styles).forEach(function(key) {
      node.style[key] = styles[key];
    });
  }

  function createBanner() {
    if (!banner || !banner.text) return;

    var existing = document.getElementById('troopod-offer-banner');
    if (existing) existing.remove();

    var node = document.createElement('div');
    node.id = 'troopod-offer-banner';
    node.setAttribute('data-troopod-ui', 'banner');
    node.innerText = banner.text;
    setStyles(node, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      zIndex: '2147483646',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '54px',
      padding: '14px 24px',
      background: banner.backgroundColor || styleProfile.accentColor || '#111827',
      color: banner.textColor || styleProfile.accentTextColor || '#ffffff',
      fontFamily: styleProfile.fontFamily || 'inherit',
      fontWeight: '700',
      letterSpacing: '0.01em',
      boxShadow: styleProfile.shadow || '0 12px 28px rgba(15, 23, 42, 0.18)'
    });

    document.body.prepend(node);
    document.body.style.paddingTop = node.offsetHeight + 'px';
  }

  zones.forEach(function(z) {
    try {
      var el = document.querySelector(z.sel);
      if (!el) return;
      el.innerText = z.text;
    } catch(e) {
      console.warn('[troopod] zone update failed:', z.sel, e.message);
    }
  });

  createBanner();
})();