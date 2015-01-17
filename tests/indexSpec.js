var groupsApi = require('../index.js');

function isObject(value) {
  return ((typeof value == 'object') && (value !== null))
}

function isProperty(obj, key) {
  if(isObject(obj)) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
  return false;
}

describe('Test Api',function(){

  describe("Test api setup", function(done) {
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

    it("Api is created from input object", function(done){
      groupsApi({}, function(api){

        expect(isObject(api)).toBe(true);

        testProps.forEach(function(prop){
          expect(isProperty(api, prop)).toBe(true);
        });

        done();
      });
    });

    it("Api is created from input object", function(done){
      groupsApi('./tests/blank.json', function(api){

        expect(isObject(api)).toBe(true);

        testProps.forEach(function(prop){
          expect(isProperty(api, prop)).toBe(true);
        });

        done();
      });
    });

  });

});