function createTestGroups(quanity, api, callback){
  var groupName = "Jasmine Test Group";
  var groupDescription = "Unit Test Group for Jasmine";
  var count = 0;

  function done(body){
    count++;
    if(count >= quanity){
      callback();
    }
  }

  for(var n=1; n<=quanity; n++){
    api.insertGroup(
      "jasmine-test"+n+"@"+api.domain,
      groupName+": "+n,
      groupDescription+" ("+n+")",
      done
    );
  }
};

function deleteTestGroups(api, callback){
  var toDelete = [];
  var count = 0;

  function done(body){
    count++;
    if(count >= toDelete.length){
      callback();
    }
  }

  api.getAllGroups(function(allgroups){
    allgroups.groups.forEach(function(group){
      if(/jasmine\-test(?:\d+|)\@/.test(group.email)){
        toDelete.push(group.email);
      }
    });

    if(toDelete.length > 0){
      toDelete.forEach(function(email){
        api.deleteGroup(email, done);
      });
    }else{
      callback();
    }
  });
};

function createTestMembers (quanity, api, callback){
  var groupName = "Jasmine Test Group";
  var groupDescription = "Unit Test Group for Jasmine";
  var count = 0;

  function done(body){
    count++;
    if(count >= quanity){
      callback();
    }
  }

  createTestGroups(1, api, function(){
    for(var n=1; n<=quanity; n++){
      api.insertMember(
        "jasmine-test1@"+api.domain,
        "jasmine-user"+n+"@"+api.domain,
        "MEMBER",
        done
      );
    }
  });
};

module.exports = {
  createTestGroups: createTestGroups,
  deleteTestGroups: deleteTestGroups,
  createTestMembers: createTestMembers
};