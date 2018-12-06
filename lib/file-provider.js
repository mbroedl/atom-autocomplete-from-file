const Papa = require('papaparse');
const fs = require('fs');
const stringSimilarity = require('string-similarity');
const providerConfig = require('./provider-config');
const {watchPath} = require('atom')

module.exports =
    class FileProvider {
        constructor(settings_selector) {
            this._conf = settings_selector;

            this.selector = this._getConf(`selector`)
            this.inclusionPriority = this._getConf(`inclusionPriority`)
            this.suggestionPriority = this._getConf(`suggestionPriority`)
            this.filterSuggestions = this._getConf(`useAutocompleteFilter`)
            this.excludeLowerPriority = this._getConf(`excludeLowerPriority`)

            this._fileDisposable = null;
            atom.config.observe(`${this._conf}.fileProvided`, (fn) => this.changeFile(fn))
            atom.config.onDidChange(`${this._conf}.delimiter`, () => this.loadFile())
        }

        async changeFile(filename) {
            if (!filename) return;
            this._file = filename;

            this.loadFile();

            // TODO dispose of whole autocomplete+ provider
            if (this._fileDisposable !== null) this._fileDisposable.dispose();

            this._fileDisposable = await watchPath(this._file, {}, (events) =>
                events.forEach((event) =>
                    (event.action == 'modified' & event.path == this._file) ? this.loadFile() : null));
        }

        loadFile() {
            if (!fs.existsSync(this._file) || ! fs.lstatSync(this._file).isFile()) {
                // TODO throw a notice!
                return;
            }
            let file = fs.readFileSync(this._file, "utf8");
            let options = {
                header: true,
                skipEmptyLines: true,
                complete: ((results) => {
                    this.data = results.data;
                }).bind(this)
            };
            if (this._getConf(`delimiter`) != 'auto') options.delimiter = this._getConf(`delimiter`);

            Papa.parse(file, options);
        }

        _getConf(conf) {
            let confItem = atom.config.get(`${this._conf}.${conf}`);
            return (confItem === undefined) ? providerConfig.properties[conf].default : confItem;
        }

        getSuggestions({
            editor,
            bufferPosition
        }) {
            if (!this._getConf(`enabled`)) return [];
            const prefix = this.getPrefix(editor, bufferPosition);
            if (prefix.match != '') {
                return(new Promise((resolve) => resolve(this.findSuggestionsForPrefix(prefix))));
            } else {
                return [];
            }
        }

        findSuggestionsForPrefix({match, keep, key}) {
            let suggestions = this.data
                .map((record) => ({
                    text: keep + record.text,
                    displayText: record.display ? record.display : '',
                    className: record.className ? record.className : '',
                    iconHTML: record.icon ? `<i class="icon-${record.icon}"></i>` : '',
                    rightLabel: record.right ? record.right : '',
                    leftLabel: record.left ? record.left : '',
                    description: record.description ? record.description : (record.url ? '->' : ''),
                    descriptionMoreUrl: record.url ? record.url : '',
                    replacementPrefix: match,
                    similarity: stringSimilarity.compareTwoStrings(record[this._getConf(`sortSuggestionsByField`)], key)
                }));
            if (!this.filterSuggestions) suggestions.sort((a, b) => b.similarity - a.similarity);
            if (this._getConf(`numberOfSuggestions`) > 0) suggestions = suggestions.slice(0, this._getConf(`numberOfSuggestions`));
            return suggestions;
        }

        getPrefix(editor, bufferPosition) {
            let regex = new RegExp(this._getConf(`matchPrefix`));
            let line = editor.getTextInRange([
                [bufferPosition.row, 0], bufferPosition
            ]);
            let match = line.match(regex);
            let rtrn = {match: '', keep: '', key: ''};
            if (match === null) return rtrn;
            rtrn.match = match[0];
            rtrn.key = match[0];
            if (this._getConf('retainFirstCapture') && match.length > 1) {
                rtrn.keep = match[1];
                rtrn.key = match[0].replace(match[1], '');
            }
            return rtrn;
        }
    }
