var groupsApi = require('../index.js');
var extraMatchers = require('./lib/jasmineMatchers.js');
var helper = require('./lib/helper.js');

describe('Test Api',function() {
  beforeEach(function() {
    this.addMatchers(extraMatchers);
  });

  describe("Test api setup", function () {
    var testProps = [
      'test'
      , 'verbose'
      , 'verboseSettings'
      , 'jwt'
      , 'log'
      , 'getAllGroups'
      , 'getGroupMembers'
      , 'setGroupMembers'
      , 'setUserRole'
      , 'insertGroup'
      , 'insertMember'
      , 'deleteGroup'
      , 'deleteMember'
    ];

    it("Api is created from input object", function (done) {
      groupsApi({}, function (api) {

        expect(api).toBeObject();

        testProps.forEach(function (prop) {
          expect(api).toHaveProperty(prop);
        });

        done();
      });
    });

    it("Api is created from input object", function (done) {
      groupsApi('./tests/blank.json', function (api) {

        expect(api).toBeObject();

        testProps.forEach(function (prop) {
          expect(api).toHaveProperty(prop);
        });

        done();
      });
    });

  });


  describe("Test Api calls", function () {
    it("Insert group", function(done) {
      groupsApi('./tests/options.json', function(api){
        var groupId = "jasmine-test1@"+api.domain;
        var groupName = "Jasmine Test Group";
        var groupDescription = "Unit Test Group for Jasmine";

        api.insertGroup(groupId, groupName, groupDescription, function(body){
          expect(body).not.toHaveProperty("error");
          expect(body.email).toEqual(groupId);
          expect(body.name).toEqual(groupName);
          expect(body.description).toEqual(groupDescription);

          done();
        });

      });
    });

    it("Delete group", function(done) {
      groupsApi('./tests/options.json', function(api){

        api.deleteGroup("jasmine-test1@"+api.domain, function(body){
          expect(body).not.toHaveProperty("error");

          done();
        });

      });
    });

    it("Get all groups", function(done) {
      groupsApi('./tests/options.json', function(api){
        helper.createTestGroups(3, api, function(){
          api.getAllGroups(function(allgroups){
            expect(allgroups.groups.length).toBeGreaterThan(2);

            var testGroupCount = 0;
            allgroups.groups.forEach(function(group){
              if(/jasmine\-test\d\@/.test(group.email)){
                testGroupCount++;
              }
            });
            expect(testGroupCount).toEqual(3);

            helper.deleteTestGroups(api, done);
          });
        });
      });
    }, 15*1000);

    it("Insert Member", function(done) {
      groupsApi('./tests/options.json', function(api){
        helper.createTestGroups(1, api, function(){
          api.insertMember("jasmine-test1@"+api.domain, "jasmine-user1@"+api.domain, "MEMBER", function(body){
            expect(body).not.toHaveProperty("error");

            done();
          });
        });
      });
    }, 10*1000);

    it("Delete Member", function(done) {
      groupsApi('./tests/options.json', function(api){
        api.deleteMember("jasmine-test1@"+api.domain, "jasmine-user1@"+api.domain, function(body){
          expect(body).not.toHaveProperty("error");

          done();
        });
      });
    });

    it("Get Group Members", function(done) {
      groupsApi('./tests/options.json', function(api){
        helper.createTestMembers(3, api, function(){
          api.getGroupMembers("jasmine-test1@"+api.domain, function(allmembers){
            expect(allmembers.members.length).toEqual(3);


            helper.deleteTestGroups(api, done);
          });
        });
      });

    }, 15*1000);

    it("Get Member", function(done) {
      groupsApi('./tests/options.json', function(api){
        helper.createTestMembers(1, api, function(){
          api.getMember("jasmine-test1@"+api.domain, "jasmine-user1@"+api.domain, function(member){
            expect(body).not.toHaveProperty("error");
            expect(member.email).toEqual("jasmine-user1@"+api.domain);

            helper.deleteTestGroups(api, done);
          });
        });
      });

    }, 15*1000);

    it("Set User Role", function(done) {
      var roles = ["MEMBER", "OWNER", "MANAGER"];

      function testSetRole(api, role, callback){
        api.setUserRole("jasmine-test1@"+api.domain, "jasmine-user1@"+api.domain, role, function(body){
          expect(body).not.toHaveProperty("error");

          api.getMember("jasmine-test1@"+api.domain, "jasmine-user1@"+api.domain, function(member){
            expect(member.role).toEqual(role);

            callback();
          });
        });
      }

      function next(api, role){
        testSetRole(api, role, function(){
          if(roles.length <= 0){
            helper.deleteTestGroups(api, done);
          }else{
            next(api, roles.pop());
          }
        });
      }

      groupsApi('./tests/options.json', function(api){
        helper.createTestMembers(1, api, function(){
          next(api, roles.pop());
        });
      });

    }, 25*1000);

    it("Get User Role", function(done) {
      groupsApi('./tests/options.json', function(api){
        helper.createTestMembers(1, api, function(){
          api.getUserRole("jasmine-test1@"+api.domain, "jasmine-user1@"+api.domain, function(role){
            expect(role).toEqual("MEMBER");

            helper.deleteTestGroups(api, done);
          });
        });
      });
    }, 15*1000);

  });
});