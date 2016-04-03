'use strict';

var Github = require('../src/github.js');

var expect = require('must');
var testUser = require('./fixtures/user.json');
var assertSuccessful = require('./helpers').assertSuccessful;
var assertFailure = require('./helpers').assertFailure;

describe('Github', function() {
   var github, user;

   describe('with authentication', function() {
      before(function() {
         github = new Github({
            username: testUser.USERNAME,
            password: testUser.PASSWORD,
            auth: 'basic'
         });

         user = github.getUser();
      });

      // 200ms between tests so that Github has a chance to settle
      beforeEach(function(done) {
         setTimeout(done, 200);
      });

      it('should authenticate and return no errors', function(done) {
         user.notifications(assertSuccessful(done));
      });
   });

   describe('without authentication', function() {
      before(function() {
         github = new Github();
      });

      // 200ms between tests so that Github has a chance to settle
      beforeEach(function(done) {
         setTimeout(done, 200);
      });

      it('should read public information', function(done) {
         var gist = github.getGist('f1c0f84e53aa6b98ec03');

         gist.read(function(err, res, xhr) {
            try {
               expect(err).not.to.exist();
               expect(res).to.exist();
               expect(xhr).to.be.an.object();

               done();
            } catch(e) {
               try {
                  if (err && err.request.headers['x-ratelimit-remaining'] === '0') {
                     done();

                     return;
                  }
               } catch(e2) {
                  done(e);
               }

               done(e);
            }
         });
      });
   });

   describe('with bad authentication', function() {
      before(function() {
         github = new Github({
            username: testUser.USERNAME,
            password: 'fake124',
            auth: 'basic'
         });

         user = github.getUser();
      });

      // 200ms between tests so that Github has a chance to settle
      beforeEach(function(done) {
         setTimeout(done, 200);
      });

      it('should fail authentication and return err', function(done) {
         user.notifications(assertFailure(done, function(err) {
            expect(err.error).to.be.equal(401, 'Return 401 status for bad auth');
            expect(err.request.data.message).to.equal('Bad credentials');

            done();
         }));
      });
   });
});
