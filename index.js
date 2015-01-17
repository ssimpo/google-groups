var request = require('google-oauth-jwt').requestWithJWT();
var jsonfile = require('jsonfile');

var jwt = {
    scopes: [
        'https://www.googleapis.com/auth/admin.directory.orgunit',
        'https://www.googleapis.com/auth/admin.directory.device.chromeos',
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/admin.directory.group'
    ]
};


function isObject(value) {
    return ((typeof value == 'object') && (value !== null))
}

function isProperty(obj, key) {
    if(isObject(obj)) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }
    return false;
}

function getOptions (options, callback) {
    if(isObject(options)){
        callback(options);
    }
    jsonfile.readFile(options, function(err, options){
        if(err){
            console.error(err);
        }else{
            callback(options);
        }
    })
}

function makeRequest(options) {
    options.type = ((isProperty(options, 'type')) ? options.type : 'get');
    options.url = 'https://www.googleapis.com/admin/directory/v1/' + options.url;

    var requestObj = {
        'url': options.url,
        'json': true,
        'jwt': jwt
    };

    if((options.type === 'post')||(options.type === 'put')) {
        requestObj.body = ((isProperty(options, 'body')) ? options.body : {});
    }

    request[options.type](requestObj, function (err, res, body) {
        if (err) console.log('Error', err);
        options.callback(body, res);
    });
}

var module = {
    test: false,
    verbose: false,
    deleteLog: {},
    insertLog: {},
    verboseSettings: {},
    threads: 1,

    getVerboseSettings: function (id) {
        if(!module.verbose) {
            return false;
        }

        if(isProperty(module.verboseSettings, id)) {
            return module.verboseSettings[id];
        }

        return true;
    },

    log: function (id) {
        var messages = [];
        for(var i=1; i<arguments.length; i++) {
            messages.push(arguments[i]);
        }
        if(module.getVerboseSettings(id)) {
            console.log.apply(module, messages);
        }
    },

    setup: function (options, callback) {
        getOptions(options, function (options) {
            module['verbose'] = ((isProperty(options, 'verbose'))? options['verbose'] : module['verbose']);
            module['verboseSettings'] = ((isProperty(options, 'verboseSettings'))? options['verboseSettings'] : module['verboseSettings']);

            for(option in options) {
                if(isProperty(module, option)) {
                    module.log('settingsReport', 'Adding module option: ' + option, options[option]);
                    module[option] = options[option];
                }else {
                    module.log('settingsReport', 'Adding JWT option: ' + option, options[option]);
                    jwt[option] = options[option];
                }
            }

            callback();
        });
    },

    getAllGroups: function (callback) {
        var domain = jwt.delegationEmail.split('@')[1];
        makeRequest({
            type: 'get',
            url: 'groups?domain='+domain,
            callback: callback
        });
    },

    getGroupMembers: function (groupId, callback) {
        makeRequest({
            type: 'get',
            url: 'groups/'+groupId+'/members',
            callback: callback
        });
    },

    setGroupMembers: function (groupId, members, callback) {
        if(module.test) {
            module.log('warnings', 'Running in test mode. Change test option in options.json to true to run for real.  This will result in warnings about people not being added to groups as member insertion is only simulated not actually actioned.');
        }

        var newMembersLookup = {};
        var queue = [];

        function next(body) {
            if(queue.length > 0) {
                var task = queue.pop();
                task();
            }else{
                makeRequest({
                    type: 'get',
                    url: 'groups/' + groupId + '/members',
                    callback: function (group) {
                        if(group.members) {
                            var currentMembers = {};

                            group.members.forEach(function (member) {
                                currentMembers[member.email.toLowerCase()] = true;
                            });
                            members.forEach(function (member) {
                                if(!isProperty(currentMembers, member.email.toLowerCase())) {
                                    module.log('warnings', 'Could not add member to group ('+groupId+'): ', member.email);
                                }
                            });
                        }
                        callback();
                    }
                });
            }
        }

        makeRequest({
            type: 'get',
            url: 'groups/'+groupId+'/members',
            callback: function (group) {
                members.forEach(function (member) {
                    newMembersLookup[member.email.toLowerCase()] = member.role;
                    module.log('queueInsertMember', 'INSERT MEMBER ADDED TO QUEUE', member.role, member.email, groupId);
                    queue.push(function () {
                        module.insertMember(groupId, member.email, member.role, next);
                    });
                });

                if(group.members) {
                    group.members.forEach(function (member) {
                        if(!isProperty(newMembersLookup, member.email.toLowerCase())) {
                            module.log('queueDeleteMember', 'DELETE MEMBER ADDED TO QUEUE', groupId, member.email);
                            queue.push(function () {
                                module.deleteMember(groupId, member.email, function (body) {
                                    module.log('deleteMemberDone', 'DELETE MEMBER DONE', member.email, groupId, body);
                                    next(body);
                                });
                            });
                        }
                    });
                }

                for(var thread=0; thread<=module.threads; thread++) {
                    next();
                }
            }
        });
    },

    setUserRole: function (groupId, userId, role, callback) {
        module.log('setUserRole', 'F: SET USER ROLE', groupId, userId);
        if(!module.test) {
            makeRequest({
                type: 'put',
                url: 'groups/'+groupId+'/members/'+userId,
                callback: callback,
                body: {
                    role: role.toUpperCase()
                }
            });
        }else{
            callback();
        }
    },

    insertDeleteErrorCheck: function (inserting, groupId, userId) {
        userId = ((userId === undefined) ? '' : userId);

        var log1, log2;
        var id = groupId + userId;
        var actionObject = ((userId === '')?'group':'user');

        if(inserting) {
            module.insertLog[id] = true;
            if (isProperty(module.deleteLog, id)) {
                module.log('insertDeleteError', 'Error: Inserting '+actionObject+' just deleted.', groupId, userId);
            }
        }else{
            module.deleteLog[id] = true;
            if (isProperty(module.insertLog, id)) {
                module.log('insertDeleteError', 'Error: Deleting '+actionObject+' just inserted', groupId, userId);
            }
        }
    },

    insertGroup: function (groupId, groupName, groupDescription, callback) {
        if(groupId) {
            module.log('insertGroup', 'F: INSERT GROUP', groupId);
            module.insertDeleteErrorCheck(true, groupId);

            if (!module.test) {
                module.getAllGroups(function (groups) {
                    var found;
                    if(groups.groups) {
                        groups.groups.every(function (group) {
                            found = (group.email === groupId);
                            if (found) {
                                callback(group);
                            }
                            return !found;
                        });
                    }
                    if (!found) {
                        makeRequest({
                            type: 'post',
                            url: 'groups',
                            callback: callback,
                            body: {
                                email: groupId,
                                name: groupName,
                                description: groupDescription
                            }
                        });
                    }
                });
            } else {
                callback();
            }
        }
    },

    insertMember: function (groupId, userId, role, callback) {
        if(groupId && userId) {
            module.log('insertMember', 'F: INSERT MEMBER', groupId, userId);
            module.insertDeleteErrorCheck(true, groupId, userId);

            if (!module.test) {
                makeRequest({
                    type: 'post',
                    url: 'groups/' + groupId + '/members',
                    callback: function (newUser) {
                        module.setUserRole(groupId, userId, role, callback);
                    },
                    body: {
                        'email': userId
                    }
                });
            } else {
                module.setUserRole(groupId, userId, role, callback);
            }
        }
    },

    deleteGroup: function (groupId, callback) {
        if(groupId) {
            module.log('deleteGroup', 'F: DELETE GROUP', groupId);
            module.insertDeleteErrorCheck(false, groupId);

            if (!module.test) {
                makeRequest({
                    type: 'del',
                    url: 'groups/' + groupId,
                    callback: callback
                });
            } else {
                callback();
            }
        }
    },

    deleteMember: function (groupId, userId, callback) {
        if(groupId && userId) {
            module.log('deleteMember', 'F: DELETE MEMBER', groupId, userId);
            module.insertDeleteErrorCheck(false, groupId, userId);

            if (!module.test) {
                makeRequest({
                    type: 'del',
                    url: 'groups/' + groupId + '/members/' + userId,
                    callback: callback
                });
            } else {
                callback();
            }
        }
    }
};

exports.api = module;