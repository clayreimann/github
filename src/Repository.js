'use strict';
/**
 * @file
 * @copyright  2013 Michael Aufreiter (Development Seed) and 2016 Yahoo Inc.
 * @license    Licensed under {@link https://spdx.org/licenses/BSD-3-Clause-Clear.html BSD-3-Clause-Clear}.
 *             Github.js is freely distributable.
 */

import Requestable from './Requestable';
import debug from 'debug';
const log = debug('github:repository');

/**
 * Respository encapsulates the functionality to create, query, and modify files.
 */
class Repository extends Requestable {
   /**
    * Create a Repository.
    * @param {string} [apiBase=https://api.github.com] - the base Github API URL
    * @param {Requestable.auth} [auth] - information required to authenticate to Github
    * @param {Object} options
    */
   constructor(auth, apiBase, options) {
      super(auth, apiBase);
      let path = `/repos/${options.fullname}`;

      let repo = options.name;
      let user = options.user;
      if (user !== '' && repo !== '') {
         path = '/repos/' + user + '/' + repo;
      }

      this.__repoPath = path;
      this.__currentTree = {
         branch: null,
         sha: null
      };
   }

   _updateTree(branch, cb) {
      if (branch === this.__currentTree.branch && this.__currentTree.sha) {
         return cb(null, this.__currentTree.sha);
      }

      this.getRef('heads/' + branch, function(err, sha) {
         this.__currentTree.branch = branch;
         this.__currentTree.sha = sha;
         cb(err, sha);
      });
   }

   /**
    * Get a reference
    * @see https://developer.github.com/v3/git/refs/#get-a-reference
    * @param {string} ref - the reference to get
    * @param {Function} cb - will receive the reference or a list of matching references
    * @return {Promise} - the promise for the http request {[type]} [description]
    */
   getRef(ref, cb) {
      this._request('GET', `${repoPath}/git/refs/${ref}`)
         .then(function(result) {
            if (cb) {
               cb(null, result.object.sha, xhr);
            }

            return result.object.sha;
         });
   }

   /**
    * Create a reference
    * @see https://developer.github.com/v3/git/refs/#create-a-reference
    * @param {Object} options - the object describing the ref
    * @param {Function} cb - will receive the ref
    * @return {Promise} - the promise for the http request {[type]} [description]
    */
   createRef(options, cb) {
      this._request('POST', `${repoPath}/git/refs`, options, cb);
   }

   /**
    * Delete a reference
    * @see https://developer.github.com/v3/git/refs/#delete-a-reference
    * @param {string} ref - the name of the ref to delte
    * @param {Function} cb - will receive true if the request is successful
    * @return {Promise} - the promise for the http request {[type]} [description]
    */
   deleteRef(ref, cb) {
      this._request('DELETE', `${repoPath}/git/refs/${ref}`, options, cb);
   }

   /**
    * Delete a repository
    * @see https://developer.github.com/v3/repos/#delete-a-repository
    * @param {Function} cb - will receive true if the request is successful
    * @return {Promise} - the promise for the http request {[type]} [description]
    */
   deleteRepo(cb) {
      this._request('DELETE', repoPath, options, cb);
   }

   /**
    * List the tags on a repository
    * @see https://developer.github.com/v3/repos/#list-tags
    * @param {Function} cb - will receive the tag data
    * @return {Promise} - the promise for the http request {[type]} [description]
    */
   listTags(cb) {
      this._request('GET', `${repoPath}/tags`, null, cb);
   }

   // List all pull requests of a respository
   // -------
   listPulls(options, cb) {
      options = options || {};
      this._request('GET', `${repoPath}/pulls`, options, cb);
   }

   // Gets details for a specific pull request
   // -------
   getPull(number, cb) {
      this._request('GET', repoPath + '/pulls/' + number, null, cb);
   }

   // Retrieve the changes made between base and head
   // -------
   compare(base, head, cb) {
      this._request('GET', repoPath + '/compare/' + base + '...' + head, null, cb);
   }

   // List all branches of a repository
   // -------
   listBranches(cb) {
      this._request('GET', repoPath + '/git/refs/heads', null, function(err, heads, xhr) {
         if (err) {
            return cb(err);
         }

         heads = heads.map(function(head) {
            return head.ref.replace(/^refs\/heads\//, '');
         });

         cb(null, heads, xhr);
      });
   }

   // Retrieve the contents of a blob
   // -------
   getBlob(sha, cb) {
      this._request('GET', repoPath + '/git/blobs/' + sha, null, cb, 'raw');
   }

   // For a given file path, get the corresponding sha (blob for files, tree for dirs)
   // -------
   getCommit(branch, sha, cb) {
      this._request('GET', repoPath + '/git/commits/' + sha, null, cb);
   }

   // For a given file path, get the corresponding sha (blob for files, tree for dirs)
   // -------
   getSha(branch, path, cb) {
      if (!path || path === '') {
         return this.getRef('heads/' + branch, cb);
      }

      this._request('GET', repoPath + '/contents/' + path + (branch ? '?ref=' + branch : ''),
         null, function(err, pathContent, xhr) {
            if (err) {
               return cb(err);
            }

            cb(null, pathContent.sha, xhr);
         });
   }

   // Get the statuses for a particular SHA
   // -------
   getStatuses(sha, cb) {
      this._request('GET', repoPath + '/statuses/' + sha, null, cb);
   }

   // Retrieve the tree a commit points to
   // -------
   getTree(tree, cb) {
      this._request('GET', repoPath + '/git/trees/' + tree, null, function(err, res, xhr) {
         if (err) {
            return cb(err);
         }

         cb(null, res.tree, xhr);
      });
   }

   // Post a new blob object, getting a blob SHA back
   // -------
   postBlob(content, cb) {
      if (typeof content === 'string') {
         content = {
            content: Utf8.encode(content),
            encoding: 'utf-8'
         };
      } else {
         if (typeof Buffer !== 'undefined' && content instanceof Buffer) {
            // When we're in Node
            content = {
               content: content.toString('base64'),
               encoding: 'base64'
            };
         } else if (typeof Blob !== 'undefined' && content instanceof Blob) {
            content = {
               content: b64encode(content),
               encoding: 'base64'
            };
         } else {
            throw new Error('Unknown content passed to postBlob. Must be string or Buffer (node) or Blob (web)');
         }
      }

      this._request('POST', repoPath + '/git/blobs', content, function(err, res, xhr) {
         if (err) {
            return cb(err);
         }

         cb(null, res.sha, xhr);
      });
   }

   // Update an existing tree adding a new blob object getting a tree SHA back
   // -------
   updateTree(baseTree, path, blob, cb) {
      var data = {
         'base_tree': baseTree,
         'tree': [
            {
               path: path,
               mode: '100644',
               type: 'blob',
               sha: blob
            }
         ]
      };

      this._request('POST', repoPath + '/git/trees', data, function(err, res, xhr) {
         if (err) {
            return cb(err);
         }

         cb(null, res.sha, xhr);
      });
   }

   // Post a new tree object having a file path pointer replaced
   // with a new blob SHA getting a tree SHA back
   // -------
   postTree(tree, cb) {
      this._request('POST', repoPath + '/git/trees', {
         tree: tree
      }, function(err, res, xhr) {
         if (err) {
            return cb(err);
         }

         cb(null, res.sha, xhr);
      });
   }

   // Create a new commit object with the current commit SHA as the parent
   // and the new tree SHA, getting a commit SHA back
   // -------
   commit(parent, tree, message, cb) {
      var user = new Github.User();

      user.show(null, function(err, userData) {
         if (err) {
            return cb(err);
         }

         var data = {
            message: message,
            author: {
               name: options.user,
               email: userData.email
            },
            parents: [
               parent
            ],
            tree: tree
         };

         this._request('POST', repoPath + '/git/commits', data, function(err, res, xhr) {
            if (err) {
               return cb(err);
            }

            this.__currentTree.sha = res.sha; // Update latest commit

            cb(null, res.sha, xhr);
         });
      });
   }

   // Update the reference of your head to point to the new commit SHA
   // -------
   updateHead(head, commit, cb) {
      this._request('PATCH', repoPath + '/git/refs/heads/' + head, {
         sha: commit
      }, cb);
   }

   // Show repository information
   // -------
   show(cb) {
      this._request('GET', repoPath, null, cb);
   }

   // Show repository contributors
   // -------
   contributors(cb, retry) {
      retry = retry || 1000;

      this._request('GET', repoPath + '/stats/contributors', null, function(err, data, xhr) {
         if (err) {
            return cb(err);
         }

         if (xhr.status === 202) {
            setTimeout(
               function() {
                  that.contributors(cb, retry);
               },
               retry
            );
         } else {
            cb(err, data, xhr);
         }
      });
   }

   // Show repository collaborators
   // -------
   collaborators(cb) {
      this._request('GET', repoPath + '/collaborators', null, cb);
   }

   // Check whether user is a collaborator on the repository
   // -------
   isCollaborator(username, cb) {
      this._request('GET', repoPath + '/collaborators/' + username, null, cb);
   }

   // Get contents
   // --------
   contents(ref, path, cb) {
      path = encodeURI(path);
      this._request('GET', repoPath + '/contents' + (path ? '/' + path : ''), {
         ref: ref
      }, cb);
   }

   // Fork repository
   // -------
   fork(cb) {
      this._request('POST', repoPath + '/forks', null, cb);
   }

   // List forks
   // --------
   listForks(cb) {
      this._request('GET', repoPath + '/forks', null, cb);
   }

   // Branch repository
   // --------
   branch(oldBranch, newBranch, cb) {
      if (arguments.length === 2 && typeof arguments[1] === 'function') {
         cb = newBranch;
         newBranch = oldBranch;
         oldBranch = 'master';
      }

      this.getRef('heads/' + oldBranch, function(err, ref) {
         if (err && cb) {
            return cb(err);
         }

         this.createRef({
            ref: 'refs/heads/' + newBranch,
            sha: ref
         }, cb);
      });
   }

   // Create pull request
   // --------
   createPullRequest(options, cb) {
      this._request('POST', repoPath + '/pulls', options, cb);
   }

   // List hooks
   // --------
   listHooks(cb) {
      this._request('GET', repoPath + '/hooks', null, cb);
   }

   // Get a hook
   // --------
   getHook(id, cb) {
      this._request('GET', repoPath + '/hooks/' + id, null, cb);
   }

   // Create a hook
   // --------
   createHook(options, cb) {
      this._request('POST', repoPath + '/hooks', options, cb);
   }

   // Edit a hook
   // --------
   editHook(id, options, cb) {
      this._request('PATCH', repoPath + '/hooks/' + id, options, cb);
   }

   // Delete a hook
   // --------
   deleteHook(id, cb) {
      this._request('DELETE', repoPath + '/hooks/' + id, null, cb);
   }

   // Read file at given path
   // -------
   read(branch, path, cb) {
      this._request('GET', repoPath + '/contents/' + encodeURI(path) + (branch ? '?ref=' + branch : ''),
         null, cb, true);
   }

   // Remove a file
   // -------
   remove(branch, path, cb) {
      this.getSha(branch, path, function(err, sha) {
         if (err) {
            return cb(err);
         }

         this._request('DELETE', repoPath + '/contents/' + path, {
            message: path + ' is removed',
            sha: sha,
            branch: branch
         }, cb);
      });
   }

   // Move a file to a new location
   // -------
   move(branch, path, newPath, cb) {
      this._updateTree(branch, function(err, latestCommit) {
         this.getTree(latestCommit + '?recursive=true', function(err, tree) {
            // Update Tree
            tree.forEach(function(ref) {
               if (ref.path === path) {
                  ref.path = newPath;
               }

               if (ref.type === 'tree') {
                  delete ref.sha;
               }
            });

            this.postTree(tree, function(err, rootTree) {
               this.commit(latestCommit, rootTree, 'Deleted ' + path, function(err, commit) {
                  this.updateHead(branch, commit, cb);
               });
            });
         });
      });
   }

   // Write file contents to a given branch and path
   // -------
   write(branch, path, content, message, options, cb) {
      if (typeof options === 'function') {
         cb = options;
         options = {};
      }

      this.getSha(branch, encodeURI(path), function(err, sha) {
         var writeOptions = {
            message: message,
            content: typeof options.encode === 'undefined' || options.encode ? b64encode(content) : content,
            branch: branch,
            committer: options && options.committer ? options.committer : undefined,
            author: options && options.author ? options.author : undefined
         };

         // If no error, we set the sha to overwrite an existing file
         if (!(err && err.error !== 404)) {
            writeOptions.sha = sha;
         }

         this._request('PUT', repoPath + '/contents/' + encodeURI(path), writeOptions, cb);
      });
   }

   // List commits on a repository. Takes an object of optional parameters:
   // sha: SHA or branch to start listing commits from
   // path: Only commits containing this file path will be returned
   // author: Only commits by this author will be returned. Its value can be the GitHub login or the email address
   // since: ISO 8601 date - only commits after this date will be returned
   // until: ISO 8601 date - only commits before this date will be returned
   // -------
   getCommits(options, cb) {
      options = options || {};
      var url = repoPath + '/commits';
      var params = [];

      if (options.sha) {
         params.push('sha=' + encodeURIComponent(options.sha));
      }

      if (options.path) {
         params.push('path=' + encodeURIComponent(options.path));
      }

      if (options.author) {
         params.push('author=' + encodeURIComponent(options.author));
      }

      if (options.since) {
         var since = options.since;

         if (since.constructor === Date) {
            since = since.toISOString();
         }

         params.push('since=' + encodeURIComponent(since));
      }

      if (options.until) {
         var until = options.until;

         if (until.constructor === Date) {
            until = until.toISOString();
         }

         params.push('until=' + encodeURIComponent(until));
      }

      if (options.page) {
         params.push('page=' + options.page);
      }

      if (options.perpage) {
         params.push('per_page=' + options.perpage);
      }

      if (params.length > 0) {
         url += '?' + params.join('&');
      }

      this._request('GET', url, null, cb);
   }

   // Check if a repository is starred.
   // --------
   isStarred(owner, repository, cb) {
      this._request('GET', '/user/starred/' + owner + '/' + repository, null, cb);
   }

   // Star a repository.
   // --------
   star(owner, repository, cb) {
      this._request('PUT', '/user/starred/' + owner + '/' + repository, null, cb);
   }

   // Unstar a repository.
   // --------
   unstar(owner, repository, cb) {
      this._request('DELETE', '/user/starred/' + owner + '/' + repository, null, cb);
   }

   // Create a new release
   // --------
   createRelease(options, cb) {
      this._request('POST', repoPath + '/releases', options, cb);
   }

   // Edit a release
   // --------
   editRelease(id, options, cb) {
      this._request('PATCH', repoPath + '/releases/' + id, options, cb);
   }

   // Get a single release
   // --------
   getRelease(id, cb) {
      this._request('GET', repoPath + '/releases/' + id, null, cb);
   }

   // Remove a release
   // --------
   deleteRelease(id, cb) {
      this._request('DELETE', repoPath + '/releases/' + id, null, cb);
   }
}

module.exports = Repository;
