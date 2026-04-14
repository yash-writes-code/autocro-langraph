(function() {
  'use strict';

  var zones = [
  {
    "zone": "subheadline",
    "sel": "div > div > div.homepage-hero-paralax-container > section.section.section-pullup-before > div.owl-wrapper-outer > div.owl-wrapper.owl-origin > div.owl-item > div.slide > div.section-inner.titleban > p.btn-default.inverse",
    "text": "Find Out More"
  },
  {
    "zone": "cta",
    "sel": "div > div > div > a",
    "text": "Fitness First"
  },
  {
    "zone": "cta_secondary",
    "sel": "div > div > div.homepage-hero-paralax-container > section.section.section-pullup-before > div.owl-wrapper-outer > div.owl-wrapper.owl-origin > div.owl-item.owl-fade-out > div.slide > div.section-inner.titleban > p.btn-default.inverse > a",
    "text": "Start Now"
  },
  {
    "zone": "cta_tertiary",
    "sel": "div > div > div.homepage-hero-paralax-container > section.section.section-pullup-before > div.owl-wrapper-outer > div.owl-wrapper.owl-origin > div.owl-item > div.slide > div.section-inner.titleban > p.btn-default.inverse > a",
    "text": "Find Out More"
  }
];
  var styleProfile = {
  "fontFamily": "\"Calibri W01 Regular 904604\", tahoma, arial, helvetica, verdana, sans-serif",
  "textColor": "rgb(122, 122, 122)",
  "surfaceColor": "rgb(200, 16, 46)",
  "accentColor": "rgb(122, 122, 122)",
  "accentTextColor": "rgb(200, 16, 46)",
  "accentSoftColor": "rgba(17, 24, 39, 0.08)",
  "accentBorderColor": "rgb(200, 16, 46)",
  "borderRadius": "0px",
  "cardRadius": "0px",
  "shadow": "0 12px 28px rgba(15, 23, 42, 0.18)",
  "softShadow": "0 12px 24px rgba(15, 23, 42, 0.08)"
};
  var banner = {
  "text": "FREE TRIAL — Increase your muscle power — Get the challenge for your strong body",
  "backgroundColor": "rgb(122, 122, 122)",
  "textColor": "rgb(200, 16, 46)"
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