/**
 * Moustache Leads — Offerwall Embed Script
 * 
 * Include this script on any page where you embed the offerwall iframe.
 * It automatically:
 *  1. Resizes the iframe to match content height (no scrollbars inside iframe)
 *  2. Handles responsive width
 *  3. Supports touch scrolling on mobile
 * 
 * Usage:
 *   <iframe 
 *     id="moustache-offerwall" 
 *     src="https://offerwall.moustacheleads.com/offerwall?placement_id=YOUR_ID&user_id=USER_ID"
 *     style="width:100%;border:none;min-height:600px;"
 *     allow="clipboard-write"
 *     loading="lazy"
 *   ></iframe>
 *   <script src="https://offerwall.moustacheleads.com/offerwall-embed.js"></script>
 * 
 * Or manually specify the iframe:
 *   <script>
 *     MoustacheOfferwall.init({ iframeId: 'my-custom-iframe-id' });
 *   </script>
 */
(function () {
  'use strict';

  var MoustacheOfferwall = {
    initialized: false,
    iframes: [],

    init: function (options) {
      options = options || {};
      var self = this;

      if (this.initialized) return;
      this.initialized = true;

      // Find offerwall iframes
      if (options.iframeId) {
        var el = document.getElementById(options.iframeId);
        if (el) this.iframes.push(el);
      } else {
        // Auto-detect: find iframes with offerwall URL
        var allIframes = document.querySelectorAll('iframe');
        for (var i = 0; i < allIframes.length; i++) {
          var src = allIframes[i].src || '';
          if (src.indexOf('moustacheleads.com/offerwall') !== -1 ||
              src.indexOf('placement_id=') !== -1) {
            this.iframes.push(allIframes[i]);
          }
        }
      }

      // Apply base styles to detected iframes
      for (var j = 0; j < this.iframes.length; j++) {
        var iframe = this.iframes[j];
        iframe.style.width = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        iframe.style.minHeight = iframe.style.minHeight || '600px';
        iframe.style.transition = 'height 0.2s ease';
        // Allow scrolling on iOS
        iframe.setAttribute('scrolling', 'yes');
        iframe.style.webkitOverflowScrolling = 'touch';
        iframe.style.overflow = 'auto';
      }

      // Listen for height messages from the offerwall
      window.addEventListener('message', function (event) {
        if (!event.data || event.data.type !== 'moustache-offerwall-resize') return;
        var height = event.data.height;
        if (!height || height < 200) return;

        // Add small buffer to prevent content clipping
        height = height + 20;

        for (var k = 0; k < self.iframes.length; k++) {
          // Only resize if the message came from this iframe's origin
          try {
            var iframeSrc = self.iframes[k].src || '';
            var iframeOrigin = new URL(iframeSrc).origin;
            if (event.origin === iframeOrigin || event.origin === '*') {
              self.iframes[k].style.height = height + 'px';
            }
          } catch (e) {
            // Fallback: resize all detected iframes
            self.iframes[k].style.height = height + 'px';
          }
        }
      });

      // Fallback: if no postMessage received after 3s, set a reasonable height
      setTimeout(function () {
        for (var m = 0; m < self.iframes.length; m++) {
          if (!self.iframes[m].style.height || self.iframes[m].style.height === '') {
            self.iframes[m].style.height = '800px';
          }
        }
      }, 3000);
    }
  };

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      MoustacheOfferwall.init();
    });
  } else {
    // DOM already loaded
    setTimeout(function () {
      MoustacheOfferwall.init();
    }, 0);
  }

  // Expose globally for manual init
  window.MoustacheOfferwall = MoustacheOfferwall;
})();
