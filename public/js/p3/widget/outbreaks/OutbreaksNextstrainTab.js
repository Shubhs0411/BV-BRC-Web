/**
 * Nextstrain tab: embeds the Auspice viewer in an iframe.
 * Uses the viewer built into BV-BRC at /nextstrain-viewer (no separate server).
 * Override with window.App.nextstrainUrl or nextstrainMeaslesUrl to use an external URL.
 */
define([
  'dojo/_base/declare',
  'dojo/dom-construct',
  'dojo/dom-style',
  'dojo/_base/lang',
  'dijit/layout/ContentPane'
], function (
  declare,
  domConstruct,
  domStyle,
  lang,
  ContentPane
) {
  return declare([ContentPane], {
    baseClass: 'OutbreaksNextstrainTab',
    defaultUrl: 'https://nextstrain.org/measles',
    style: 'height: 100%; min-height: 600px; position: relative;',

    postCreate: function () {
      this.inherited(arguments);
      domStyle.set(this.containerNode, {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        minHeight: '600px',
        width: '100%',
        height: '100%'
      });
      var url = (window.App && (window.App.nextstrainMeaslesUrl || window.App.nextstrainUrl));
      if (!url) {
        var origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
        url = origin + '/nextstrain-viewer';
      }
      this.iframe = domConstruct.create('iframe', {
        src: url,
        style: { width: '100%', height: '100%', minHeight: '600px', border: 'none', display: 'block' }
      });
      domConstruct.place(this.iframe, this.containerNode);
    },

    _onShow: function () {
      this.inherited(arguments);
      if (this.iframe && this._resizeTimer) {
        clearTimeout(this._resizeTimer);
      }
      var self = this;
      this._resizeTimer = setTimeout(function () {
        self._resizeTimer = null;
        if (self.iframe && self.domNode) {
          var h = self.domNode.clientHeight || 600;
          self.iframe.style.height = Math.max(600, h) + 'px';
        }
      }, 100);
    }
  });
});
