/**
 * @file
 * @copyright  2016 Yahoo Inc.
 * @license    Licensed under {@link https://spdx.org/licenses/BSD-3-Clause-Clear.html BSD-3-Clause-Clear}.
 *             Github.js is freely distributable.
 */

import axios from 'axios';
import debug from 'debug';
import {Base64} from 'js-base64';

const log = debug('github:request');

/**
 * Requestable wraps the logic for making http requests to the API
 */
class Requestable {
   /**
    * Either a username and password or an oauth token for Github
    * @typedef {Object} Requestable.auth
    * @prop {string} [username] - the Github username
    * @prop {string} [password] - the user's password
    * @prop {token} [token] - an OAuth token
    */
   /**
    * Initialize the http internals.
    * @param {string} [apiBase=https://api.github.com] - the base Github API URL
    * @param {Requestable.auth} [auth] - the credentials to authenticate to Github. If auth is
    *                                  not provided request will be made unauthenticated
    */
   constructor(auth, apiBase) {
      this.__apiBase = apiBase || 'https://api.github.com';
      this.__auth = {
         token: auth.token,
         username: auth.username,
         password: auth.password
      };

      if (auth.token) {
         this.__authorizationHeader = 'token ' + auth.token;
      } else if (auth.username && auth.password) {
         this.__authorizationHeader = 'Basic ' + Base64.encode(auth.username + ':' + auth.password);
      }
   }

   /**
    * Compute the URL to use to make a request.
    * @private
    * @param {string} path - either a URL relative to the API base or an absolute URL
    * @return {string} - the URL to use
    */
   __getURL(path) {
      let url = path;

      if (path.indexOf('//') >= 0) {
         url = this.__baseUrl + path;
      }

      let newCacheBuster = 'timestamp=' + new Date().getTime();
      return url.replace(/(timestamp=\d+)/, newCacheBuster);
   }

   /**
    * Compute the headers required for an API request.
    * @private
    * @param {boolean} raw - if the request should be treated as JSON or as a raw request
    * @return {Object} - the headers to use in the request
    */
   __getRequestHeaders(raw) {
      let headers = {
         'Accept': raw ? 'application/vnd.github.v3.raw+json' : 'application/vnd.github.v3+json',
         'Content-Type': 'application/json;charset=UTF-8'
      };

      if (this.__authorizationHeader) {
         headers.Authorization = this.__authorizationHeader;
      }

      return headers;
   }

   /**
    * Sets the default options for API requests
    * @protected
    * @param {Object} [requestOptions={}] - the current options for the request
    * @return - the options to pass to the request
    */
   _getOptionsWithDefaults(requestOptions = {}) {
      requestOptions.type = requestOptions.type || 'all';
      requestOptions.sort = requestOptions.sort || 'updated';
      requestOptions.per_page = requestOptions.per_page || '100'; // jscs:ignore

      return requestOptions;
   }

   /**
    * A function that receives the result of the API request.
    * @callback Requestable.callback
    * @param {Requestable.Error} error - the error returned by the API or `null`
    * @param {(Object|true)} result - the data returned by the API or `true` if the API returns `204 No Content`
    * @param {Object} request - the raw {@linkcode https://github.com/mzabriskie/axios#response-schema Response}
    */
   /**
    * Make a request.
    * @param {string} method - the method for the request (GET, PUT, POST, DELETE)
    * @param {string} path - the path for the request
    * @param {*} [data] - the data to send to the server. For HTTP methods that don't have a body the data
    *                   will be sent as query parameters
    * @param {Requestable.callback} [cb] - the callback for the request
    * @param {boolean} [raw=false] - if the request should be sent as raw. If this is a falsy value then the
    *                              request will be made as JSON
    * @return {Promise} - the Promise for the http request
    */
   _request(method, path, data, cb, raw) {
      const url = this._getURL(path);
      const headers = this._getRequestHeaders(raw);
      let queryParams = {};

      const shouldUseDataAsParams = data && (typeof data === 'object') && methodHasNoBody(method);
      if (shouldUseDataAsParams) {
         queryParams = data;
         data = undefined;
      }

      const config = {
         url: url,
         method: method,
         headers: headers,
         params: queryParams,
         data: data,
         responseType: raw ? 'text' : 'json'
      };

      log(`${config.method} to ${config.url}`);
      const requestPromise = axios(config);

      if (cb) {
         requestPromise.then((response) => {
            cb(null, response.data || true, response);
         }).catch(callbackErrorOrThrow(cb, path));
      }

      return requestPromise;
   }

   /**
    * Make a request and fetch all the available data. Github will paginate responses so for queries
    * that might span multiple pages this method is preferred to {@link Requestable#request}
    * @param {string} path - the path to request
    * @param {Object} options - the query parameters to include
    * @param {Requestable.callback} cb - the function to receive the data. The returned data will always be an array.
    * @param {Object[]} results - the partial results. This argument is intended for interal use only.
    * @return {Promise} - a promise which will resolve when all pages have been fetched
    * @deprecated This will be folded into {@link Requestable#_request} in the 2.0 release.
    */
   _requestAllPages(path, options, cb, results) {
      results = results || [];

      return this._request('GET', path, null)
         .then((response) => {
            results.push.apply(results, response.data);

            const nextUrl = getNextPage(response.headers.link);
            if (nextUrl) {
               log(`getting next page: ${nextUrl}`);
               return this._requestAllPages(nextUrl, cb, results);
            }

            if (cb) {
               cb(null, results);
            }

            return results;
         }).catch(callbackErrorOrThrow(cb, path));
   }
}

module.exports = Requestable;

// ////////////////////////// //
//  Private helper functions  //
// ////////////////////////// //
function buildError(path, response) {
   return {
      path: path,
      request: response.config,
      response: response,
      status: response.status
   };
}

const METHODS_WITH_NO_BODY = ['GET', 'HEAD', 'DELETE'];
function methodHasNoBody(method) {
   return METHODS_WITH_NO_BODY.indexOf(method) !== -1;
}

function getNextPage(linksHeader) {
   const links = linksHeader.split(/\s*,\s*/); // splits and strips the urls
   return links.reduce(function(nextUrl, link) {
      if (link.search(/rel="next"/) !== -1) {
         return (link.match(/<(.*)>/) || [])[1];
      }

      return nextUrl;
   }, undefined);
}

function callbackErrorOrThrow(cb, path) {
   return function handler(response) {
      log(`error making request ${response.config.method} ${response.config.url} ${JSON.stringify(response.data)}`);
      if (cb) {
         cb(buildError(path, response));
      } else {
         throw response;
      }
   };
}
