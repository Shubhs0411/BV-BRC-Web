define([
  'dojo/_base/declare', 'dojo/_base/Deferred', 'dojo/request', 'dojo/_base/lang', 'dojo/topic',
  './_GenomeList', '../PhylogenyNextstrainOrTree', '../../util/PathJoin', '../../store/SFVTViruses',
  '../TaxonomyTreeGridContainer', '../TaxonomyOverview', '../../util/QueryToEnglish'
], function (
  declare, Deferred, xhr, lang, Topic,
  GenomeList, PhylogenyNextstrainOrTree, PathJoin, SFVTViruses,
  TaxonomyTreeGrid, TaxonomyOverview, QueryToEnglish
) {
  return declare([GenomeList], {
    params: null,
    taxon_id: '',
    apiServiceUrl: window.App.dataAPI,
    taxonomy: null,
    context: 'bacteria',
    perspectiveLabel: 'Taxon View',
    perspectiveIconClass: 'icon-selection-Taxonomy',
    postCreate: function () {
      this.inherited(arguments);

      this.phylogeny = new PhylogenyNextstrainOrTree({
        title: 'Phylogeny',
        id: this.viewer.id + '_phylogeny',
        state: this.state
      });

      this.taxontree = new TaxonomyTreeGrid({
        title: 'Taxonomy',
        id: this.viewer.id + '_taxontree',
        state: this.state
      });
      // Option C: bacteria always get Phylogeny tab; add it here so it's present on initial load
      this.viewer.addChild(this.phylogeny, 1);
      this.viewer.addChild(this.taxontree, 2);

      this.watch('taxonomy', lang.hitch(this, 'onSetTaxonomy'));
    },

    _setTaxon_idAttr: function (id) {
      if (id && this.taxon_id == id) {
        return;
      }
      this.taxon_id = id;

      xhr.get(PathJoin(this.apiServiceUrl, 'taxonomy', id), {
        headers: {
          accept: 'application/json'
        },
        handleAs: 'json'
      }).then(lang.hitch(this, function (taxonomy) {
        this.set('taxonomy', taxonomy);
      }));

    },

    changeToBacteriaContext: function () {
      this.overview.set('context', 'bacteria');

      // Option C: bacteria always get Phylogeny tab
      this.viewer.addChild(this.phylogeny, 1);
      this.viewer.addChild(this.amr, 4);
      this.viewer.addChild(this.sequences, 5)
      this.viewer.addChild(this.specialtyGenes, 8);
      // this.viewer.addChild(this.proteinFamilies, 10);
      this.viewer.addChild(this.pathways, 11);
      this.viewer.addChild(this.subsystems, 12);
      // this.viewer.addChild(this.transcriptomics, 13);
      this.viewer.addChild(this.interactions, 14);
    },

    changeToVirusContext: function () {
      this.viewer.removeChild(this.phylogeny);
      this.viewer.removeChild(this.amr);
      this.viewer.removeChild(this.sequences);
      this.viewer.removeChild(this.specialtyGenes);
      // this.viewer.removeChild(this.proteinFamilies);
      this.viewer.removeChild(this.pathways);
      this.viewer.removeChild(this.subsystems);
      // this.viewer.removeChild(this.transcriptomics);
      this.viewer.removeChild(this.interactions);
    },

    onSetTaxonomy: function (attr, oldVal, taxonomy) {
      this.queryNode.innerHTML = this.buildHeaderContent(taxonomy);
      var taxon_header_label = 'Taxon View - ' + taxonomy.lineage.split(',').reverse()[0];
      this.perspectiveLabel = taxon_header_label;
      // customization for viruses only when the context is changed
      if (this.context === 'bacteria') {
        if (this.taxonomy.lineage_names.includes('Influenza A virus') || this.taxonomy.lineage_names.includes('Rhinovirus A')) {
          if (!this.surveillance) {
            this.viewer.addChild(this.surveillance);
          }
          if (!this.serology) {
            this.viewer.addChild(this.serology);
          }
        } else {
          this.viewer.removeChild(this.surveillance);
          this.viewer.removeChild(this.serology);
        }

        // SFVT
        if (this.taxonomy.lineage_ids.some(id => SFVTViruses.get(id))) {
          if (!this.sfvt) {
            this.viewer.addChild(this.sfvt);
          }
        } else {
          this.viewer.removeChild(this.sfvt);
        }

        // strains
        // if (this.taxonomy.lineage_names.includes('Orthomyxoviridae') || this.taxonomy.lineage_names.includes('Bunyavirales')) {
        //   this.viewer.addChild(this.strains, 3);
        // } else {
        //   this.viewer.removeChild(this.strains);
        // }

        if (this.taxonomy.lineage_names.includes('Orthomyxoviridae')) {
          this.viewer.addChild(this.strains_orthomyxoviridae, 3);
        } else if (this.taxonomy.lineage_names.includes('Bunyavirales')) {
          this.viewer.addChild(this.strains_bunyavirales, 3);
        } else {
          this.viewer.removeChild(this.strains || this.strains_orthomyxoviridae || this.strains_bunyavirales);
        }
      }

      // Option C (hybrid): bacteria always have Phylogeny tab; viruses only when tree exists (Nextstrain or phyloxml)
      if (this.taxonomy.lineage_names.includes('Bacteria') && this.context === 'virus') {
        this.set('context', 'bacteria');
        this.changeToBacteriaContext();
      } else if (this.taxonomy.lineage_names.includes('Viruses')) {
        if (this.context === 'bacteria') {
          this.set('context', 'virus');
          this.changeToVirusContext();
        } else {
          try { this.viewer.removeChild(this.phylogeny); } catch (e) {}
        }
        this._addPhylogenyTabIfHasTree();
      }

      this.taxonomy = this.state.taxonomy = taxonomy;
      this.setActivePanelState();
    },

    _nextstrainConfigCache: null,
    _taxonTreeDictCache: null,
    /** Add Phylogeny tab only when this taxon has a tree: Nextstrain config (e.g. zika) or phyloxml entry in taxon_tree_dict. Used for viruses only (Option C); bacteria always have the tab. */
    _addPhylogenyTabIfHasTree: function () {
      var taxonId = String(this.state.taxon_id || this.taxon_id || '');
      if (!taxonId) return;
      var self = this;
      var addPhylogenyTab = function () {
        self.viewer.addChild(self.phylogeny, 1);
      };
      var hasNextstrain = function (config) {
        var list = Array.isArray(config) ? config : (config ? [config] : []);
        var entry = list.filter(function (e) {
          var id = (e.taxon_id != null) ? String(e.taxon_id) : '';
          var aliases = e.alias_ids || [];
          return id === taxonId || aliases.indexOf(taxonId) !== -1;
        })[0];
        return !!(entry && entry.dataset && entry.dataset.paths && entry.dataset.paths.nextstrain_path);
      };
      var hasPhyloxmlTree = function (dict) {
        return dict && typeof dict === 'object' && Object.prototype.hasOwnProperty.call(dict, taxonId);
      };
      var tryAddFromNextstrain = function (config) {
        if (hasNextstrain(config)) {
          addPhylogenyTab();
          return true;
        }
        return false;
      };
      var tryAddFromPhyloxmlDict = function (dict) {
        if (hasPhyloxmlTree(dict)) {
          addPhylogenyTab();
          return true;
        }
        return false;
      };
      if (this._nextstrainConfigCache && tryAddFromNextstrain(this._nextstrainConfigCache)) {
        return;
      }
      if (!this._nextstrainConfigCache) {
        xhr.get('/public/config/taxon_nextstrain.json', {
          handleAs: 'json',
          headers: { accept: 'application/json' }
        }).then(lang.hitch(this, function (config) {
          this._nextstrainConfigCache = config;
          if (tryAddFromNextstrain(config)) return;
          if (this._taxonTreeDictCache) {
            tryAddFromPhyloxmlDict(this._taxonTreeDictCache);
          } else {
            this._fetchTaxonTreeDictThenAdd(tryAddFromPhyloxmlDict);
          }
        }), lang.hitch(this, function () {
          this._nextstrainConfigCache = [];
          if (this._taxonTreeDictCache) {
            tryAddFromPhyloxmlDict(this._taxonTreeDictCache);
          } else {
            this._fetchTaxonTreeDictThenAdd(tryAddFromPhyloxmlDict);
          }
        }));
      } else {
        if (this._taxonTreeDictCache) {
          tryAddFromPhyloxmlDict(this._taxonTreeDictCache);
        } else {
          this._fetchTaxonTreeDictThenAdd(tryAddFromPhyloxmlDict);
        }
      }
    },
    _fetchTaxonTreeDictThenAdd: function (tryAddFromPhyloxmlDict) {
      var treeDictUrl = 'https://www.bv-brc.org/api/content/bvbrc_phylogeny_tab/taxon_tree_dict.json?version=012324';
      xhr.get(treeDictUrl, { handleAs: 'json', headers: { accept: 'application/json' } }).then(lang.hitch(this, function (dict) {
        this._taxonTreeDictCache = dict && typeof dict === 'object' ? dict : {};
        tryAddFromPhyloxmlDict(this._taxonTreeDictCache);
      }), lang.hitch(this, function () {
        this._taxonTreeDictCache = {};
      }));
    },
    onSetQuery: function (attr, oldVal, newVal) {
      // prevent default action
    },
    onSetReferenceGenomes: function () {
      // prevent default action
    },
    buildTaxonIdByState: function (state) {
      var def = new Deferred();
      var parts = state.pathname.split('/');

      var taxon_id_or_name = parts[parts.length - 1];
      if (taxon_id_or_name == parseInt(taxon_id_or_name)) {
        def.resolve(parseInt(taxon_id_or_name));
      }
      else {
        xhr.post(PathJoin(this.apiServiceUrl, 'taxonomy'), {
          headers: {
            accept: 'application/json',
            'content-type': 'application/rqlquery+x-www-form-urlencoded',
            'X-Requested-With': null,
            Authorization: (window.App.authorizationToken || '')
          },
          data: 'eq(taxon_name,' + taxon_id_or_name + ')&in(taxon_rank,(genus,species))&select(taxon_id,taxon_name,taxon_rank)&limit(1)',
          handleAs: 'json'
        }).then(function (data) {
          if (data.length == 0) {
            def.reject('Failed to load corresponding taxonomy: ' + taxon_id_or_name);
          } else {
            def.resolve(data[0].taxon_id);
          }
        });
      }
      return def;
    },
    onSetState: function (attr, oldState, state) {
      oldState = oldState || {};
      if (!state) {
        throw Error('No State Set');
      }

      this.buildTaxonIdByState(state).then( lang.hitch(this, function (taxon_id) {
        state.taxon_id = taxon_id;
        this.set('taxon_id', state.taxon_id);

        var s = 'eq(taxon_lineage_ids,' + state.taxon_id + ')';
        state.search = state.search.replace(s, '');
        if (state.search) {
          this.filteredTaxon = QueryToEnglish(state.search.replace(s, ''));
          var sx = [s];
          if (state.search && state.search != s) {
            sx.push(state.search);
          }
          state.search = sx.join('&').replace('&&', '&');
          if (this.taxonomy) {
            this.queryNode.innerHTML = this.buildHeaderContent(this.taxonomy);
          }

        } else {
          state.search = s;
          this.filteredTaxon = false;
          if (this.taxonomy) {
            this.queryNode.innerHTML = this.buildHeaderContent(this.taxonomy);
          }
        }

        if (!state.taxonomy && state.taxon_id) {
          if (oldState && oldState.taxon_id) {
            if ((state.taxon_id == oldState.taxon_id)) {
              if (oldState.taxonomy || this.taxonomy) {
                state.taxonomy = oldState.taxonomy || this.taxonomy;
              } else {
                console.log('oldState missing Taxonomy');
              }
            }
          }
        }

        this.set('query', state.search);

        if (!state.hashParams) {
          if (oldState.hashParams && oldState.hashParams.view_tab) {
            state.hashParams = { view_tab: oldState.hashParams.view_tab };
          } else {
            state.hashParams = { view_tab: this.defaultTab };
          }
        }
        if (state.hashParams) {
          if (!state.hashParams.view_tab) {
            state.hashParams.view_tab = this.defaultTab;
          }

          if (this[state.hashParams.view_tab]) {
            var vt = this[state.hashParams.view_tab];
            vt.set('visible', true);
            this.viewer.selectChild(vt);
          }
        }

        this.setActivePanelState();
      }), lang.hitch(this, function (msg) {
        this.queryNode.innerHTML = '<b>' + msg + '</b>';
        this.totalCountNode.innerHTML = '';
      }));
    },
    onSetGenomeIds: function (attr, oldVal, genome_ids) {
      // stop
    },
    setActivePanelState: function () {

      var active = (this.state && this.state.hashParams && this.state.hashParams.view_tab) ? this.state.hashParams.view_tab : 'overview';
      var activeTab = this[active];

      // only trigger active tab auto filter message once
      if (activeTab.state && activeTab.state.autoFilterMessage) {
        delete this.state.autoFilterMessage;
      }

      if (!activeTab) {
        console.warn('ACTIVE TAB NOT FOUND: ', active);
        return;
      }
      switch (active) {
        case 'taxontree':
          activeTab.set('state', lang.mixin({}, this.state, {
            search: 'eq(taxon_id,' + encodeURIComponent(this.state.taxon_id) + ')',
            hashParams: lang.mixin({}, this.state.hashParams)
          }));
          break;
        case 'phylogeny':
          activeTab.set('state', lang.mixin({}, this.state));
          break;
        case 'sfvt':
          activeTab.set('state', lang.mixin({}, this.state, {
            search: 'eq(taxon_id,' + this.state.taxon_id + ')'
          }));
          break;
        case 'structures':
        case 'surveillance':
        case 'serology':
        case 'strains':
        case 'strains_orthomyxoviridae':
        case 'strains_bunyavirales':
        case 'epitope':
        case 'experiments':
          activeTab.set('state', lang.mixin({}, this.state, {
            search: 'eq(taxon_lineage_ids,' + this.state.taxon_id + ')'
          }));
          break;

        default:
          var activeQueryState;
          var prop = 'genome_id';
          if (active === 'interactions') {
            prop = 'genome_id_a';
          }
          var context = [`eq(taxon_lineage_ids,${this.state.taxon_id})`]
          if (this.state.search) {
            context = this.state.search.split('&')
          }
          activeQueryState = lang.mixin({}, this.state, {
            search: `eq(${prop},*)&genome(${(prop !== 'genome_id') ? `to(${prop}),` : ''}${(context.length > 1 ? `and(${context.join(',')})` : context[0])})`,
            hashParams: lang.mixin({}, this.state.hashParams)
          });

          if (activeQueryState) {
            activeTab.set('state', activeQueryState);
          } else {
            console.warn('MISSING activeQueryState for PANEL: ' + active);
          }
          break;
      }

      if (this.taxonomy) {
        var pageTitle = this.taxonomy.taxon_name + '::Taxonomy ' + activeTab.title;
        if (window.document.title !== pageTitle) {
          window.document.title = pageTitle;
        }
      }
    },

    buildHeaderContent: function (taxon) {
      var taxon_lineage_names = taxon.lineage_names;
      var taxon_lineage_ids = taxon.lineage_ids;
      var taxon_lineage_ranks = taxon.lineage_ranks;

      var visibleRanks = ['superkingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
      var visibleIndexes = taxon_lineage_ranks.filter(function (rank) {
        return visibleRanks.indexOf(rank) > -1;
      }).map(function (rank) {
        return taxon_lineage_ranks.indexOf(rank);
      });

      var lastVisibleIndex = visibleIndexes[visibleIndexes.length - 1];
      var lastIndex = taxon_lineage_ranks.length - 1;

      if (lastVisibleIndex < lastIndex) {
        visibleIndexes.push(taxon_lineage_ranks.length - 1);
        lastVisibleIndex = visibleIndexes[visibleIndexes.length - 1];
      }

      var out = visibleIndexes.map(function (idx) {
        return '<a class="navigationLink' + ((idx === lastVisibleIndex) ? ' current' : '') + '" href="/view/Taxonomy/' + taxon_lineage_ids[idx] + '">' + taxon_lineage_names[idx] + '</a>';
      });

      if (this.filteredTaxon) {
        out.push(this.filteredTaxon);
      }

      return out.join(' &raquo; ');
    },

    createOverviewPanel: function () {
      return new TaxonomyOverview({
        title: 'Overview',
        id: this.viewer.id + '_overview'
      });
    },

    onSetAnchor: function (evt) {
      evt.stopPropagation();
      evt.preventDefault();
      var parts = [];

      if (evt.filter && evt.filter != 'false') {
        parts.push(evt.filter);
      }

      var q;
      if (parts.length > 1) {
        q = '?and(' + parts.join(',') + ')';
      } else if (parts.length == 1) {
        q = '?' + parts[0];
      } else {
        q = '';
      }

      var hp;
      if (this.state.hashParams && this.state.hashParams.view_tab) {
        hp = { view_tab: this.state.hashParams.view_tab };
      } else {
        hp = {};
      }

      hp.filter = 'false';

      var l = window.location.pathname + q + '#' + Object.keys(hp).map(function (key) {
        return key + '=' + hp[key];
      }, this).join('&');

      Topic.publish('/navigate', { href: l });
    }
  });
});
