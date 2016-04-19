/**
 * @file
 * @copyright  2013 Michael Aufreiter (Development Seed) and 2016 Yahoo Inc.
 * @license    Licensed under {@link https://spdx.org/licenses/BSD-3-Clause-Clear.html BSD-3-Clause-Clear}.
 *             Github.js is freely distributable.
 */

import Requestable from './Requestable';
import debug from 'debug';
const log = debug('github:search');

/**
 * Wrap the Search API
 */
class Search extends Requestable {
   /**
    * Create a Search
    * @param {string} [apiBase=https://api.github.com] - the base Github API URL
    * @param {Requestable.auth} [auth] - information required to authenticate to Github
    * @param {Object} defaults - defaults for the search
    */
   constructor(auth, apiBase, defaults) {
      super(auth, apiBase);
      this._defaults = this._getOptionsWithDefaults(defaults);
   }

   /**
    * Extend the provided options with the defaults
    * @private
    * @param {Object} [withOptions=defaults] - the options the user provided for the search
    * @return {Promise} - the promise for the http request
    */
   _extendDefaults(withOptions) {
      let requestOptions = JSON.parse(JSON.stringify(this._defaults));

      for (let opt of withOptions) {
         requestOptions[opt] = withOptions[opt];
      }

      return requestOptions;
   }

   /**
    * Perform a search on the GitHub API
    * @private
    * @param {string} path - the scope of the search
    * @param {Object} [options] - additional parameters for the search
    * @param {Requestable.callback} cb - will receive the results of the search
    * @return {Promise} - the promise for the http request
    */
   _search(path, options, cb) {
      let requestOptions = this._extendDefaults(options);
      log(`searching ${path} with options:`, requestOptions);
      return this._request('GET', `/search/${path}`, requestOptions, cb);
   }

   /**
    * Search in repositories
    * @param {Object} [options] - additional parameters for the search
    * @param {Requestable.callback} cb - will receive the results of the search
    * @return {Promise} - the promise for the http request
    */
   repositories(options, cb) {
      return this._search('repositories', options, cb);
   }

   /**
    * Search amongst code
    * @param {Object} [options] - additional parameters for the search
    * @param {Requestable.callback} cb - will receive the results of the search
    * @return {Promise} - the promise for the http request
    */
   code(options, cb) {
      return this._search('code', options, cb);
   }

   /**
    * Search issues
    * @param {Object} [options] - additional parameters for the search
    * @param {Requestable.callback} cb - will receive the results of the search
    * @return {Promise} - the promise for the http request
    */
   issues(options, cb) {
      return this._search('issues', options, cb);
   }

   /**
    * Search for users
    * @param {Object} [options] - additional parameters for the search
    * @param {Requestable.callback} cb - will receive the results of the search
    * @return {Promise} - the promise for the http request
    */
   users(options, cb) {
      return this._search('users', options, cb);
   }
}

module.exports = Search;
