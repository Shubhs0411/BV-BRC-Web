/**
 * Wrapper for the Taxonomy viewer's Phylogeny tab: when the current taxon_id
 * has a Nextstrain dataset in config, shows the Nextstrain iframe with that
 * dataset; otherwise shows the existing phyloxml tree (Phylogeny widget).
 */
define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/dom-construct',
  'dojo/dom-style',
  'dojo/request',
  'dijit/layout/ContentPane',
  'dijit/layout/BorderContainer',
  './Phylogeny'
], function (
  declare,
  lang,
  domConstruct,
  domStyle,
  xhr,
  ContentPane,
  BorderContainer,
  Phylogeny
) {
  return declare([BorderContainer], {
    baseClass: 'PhylogenyNextstrainOrTree',
    state: null,
    configUrl: '/public/config/taxon_nextstrain.json',
    configCache: null,
    _phyloxmlWidget: null,
    _nextstrainPane: null,
    _iframeNode: null,

    constructor: function () {
      this.configCache = null;
      this._phyloxmlWidget = null;
      this._nextstrainPane = null;
      this._iframeNode = null;
    },

    _setStateAttr: function (state) {
      this._set('state', state);
      var taxonId = state && (state.taxon_id !== undefined && state.taxon_id !== null) ? String(state.taxon_id) : '';
      if (!taxonId) {
        this._showPhyloxml();
        return;
      }
      var self = this;
      if (!this.configCache) {
        xhr.get(this.configUrl, {
          handleAs: 'json',
          headers: { accept: 'application/json' }
        }).then(lang.hitch(this, function (config) {
          this.configCache = Array.isArray(config) ? config : (config ? [config] : []);
          this._applyMode(taxonId);
        }), lang.hitch(this, function () {
          this.configCache = [];
          this._applyMode(taxonId);
        }));
      } else {
        this._applyMode(taxonId);
      }
    },

    _applyMode: function (taxonId) {
      var entry = this.configCache && this.configCache.find(function (e) {
        var id = e.taxon_id !== undefined && e.taxon_id !== null ? String(e.taxon_id) : '';
        var aliases = e.alias_ids || [];
        return id === taxonId || aliases.indexOf(taxonId) !== -1;
      });
      var path = entry && entry.dataset && entry.dataset.paths && entry.dataset.paths.nextstrain_path;
      if (path) {
        this._showNextstrain(path);
      } else {
        this._showPhyloxml();
      }
    },

    _showNextstrain: function (path) {
      if (this._phyloxmlWidget) {
        this.removeChild(this._phyloxmlWidget);
        this._phyloxmlWidget.destroyRecursive(false);
        this._phyloxmlWidget = null;
      }
      var origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
      var url = origin + '/nextstrain-viewer/' + path;
      if (!this._nextstrainPane) {
        this._nextstrainPane = new ContentPane({
          region: 'center',
          style: 'height: 100%; min-height: 600px; position: relative; padding: 0; margin: 0;'
        });
        domStyle.set(this._nextstrainPane.domNode, {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          minHeight: '600px',
          width: '100%',
          height: '100%'
        });
        this._iframeNode = domConstruct.create('iframe', {
          src: url,
          style: { width: '100%', height: '100%', minHeight: '600px', border: 'none', display: 'block' }
        });
        domConstruct.place(this._iframeNode, this._nextstrainPane.containerNode);
      } else {
        this._iframeNode.src = url;
      }
      this.addChild(this._nextstrainPane);
    },

    _showPhyloxml: function () {
      if (this._nextstrainPane) {
        try {
          this.removeChild(this._nextstrainPane);
        } catch (e) {}
      }
      if (!this._phyloxmlWidget) {
        this._phyloxmlWidget = new Phylogeny({
          title: 'Phylogeny',
          id: this.id + '_phyloxml',
          state: this.state,
          region: 'center'
        });
      }
      this._phyloxmlWidget.set('state', this.state);
      this.addChild(this._phyloxmlWidget);
      if (!this._phyloxmlWidget._started) {
        this._phyloxmlWidget.startup();
      }
    },

    postCreate: function () {
      this.inherited(arguments);
    },

    startup: function () {
      this.inherited(arguments);
      if (this.state) {
        this._setStateAttr(this.state);
      }
    }
  });
});
