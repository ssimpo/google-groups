var request = require('google-oauth-jwt').requestWithJWT();
var jsonfile = require('jsonfile');

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

function makeRequest(options, jwt) {
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

function getVerboseSettings(id, api) {
    var setting = false;

    if(api.verbose) {
        if(isProperty(api.verboseSettings, id)) {
            setting = api.verboseSettings[id];
        }
    }
    api = null;

    return setting;
}

module.exports = function (options, callback) {
    var jwt = {
        scopes: [
            'https://www.googleapis.com/auth/admin.directory.orgunit',
            'https://www.googleapis.com/auth/admin.directory.device.chromeos',
            'https://www.googleapis.com/auth/admin.directory.user',
            'https://www.googleapis.com/auth/admin.directory.group'
        ]
    };

    var api = {
        test: false,
        verbose: false,
        deleteLog: {},
        insertLog: {},
        verboseSettings: {},
        threads: 1,

        log: function (id) {
            var messages = [];
            for(var i=1; i<arguments.length; i++) {
                messages.push(arguments[i]);
            }
            if(getVerboseSettings(id, api)) {
                console.log.apply(api, messages);
            }
        },

        getAllGroups: function (callback) {
            var domain = jwt.delegationEmail.split('@')[1];
            makeRequest({
                type: 'get',
                url: 'groups?domain='+domain,
                callback: callback
            }, jwt);
        },

        getGroupMembers: function (groupId, callback) {
            makeRequest({
                type: 'get',
                url: 'groups/'+groupId+'/members',
                callback: callback
            }, jwt);
        },

        setGroupMembers: function (groupId, members, callback) {
            if(api.test) {
                api.log('warnings', 'Running in test mode. Change test option in options.json to true to run for real.  This will result in warnings about people not being added to groups as member insertion is only simulated not actually actioned.');
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
                                        api.log('warnings', 'Could not add member to group ('+groupId+'): ', member.email);
                                    }
                                });
                            }
                            callback();
                        }
                    }, jwt);
                }
            }

            makeRequest({
                type: 'get',
                url: 'groups/'+groupId+'/members',
                callback: function (group) {
                    members.forEach(function (member) {
                        newMembersLookup[member.email.toLowerCase()] = member.role;
                        api.log('queueInsertMember', 'INSERT MEMBER ADDED TO QUEUE', member.role, member.email, groupId);
                        queue.push(function () {
                            api.insertMember(groupId, member.email, member.role, next);
                        });
                    });

                    if(group.members) {
                        group.members.forEach(function (member) {
                            if(!isProperty(newMembersLookup, member.email.toLowerCase())) {
                                api.log('queueDeleteMember', 'DELETE MEMBER ADDED TO QUEUE', groupId, member.email);
                                queue.push(function () {
                                    api.deleteMember(groupId, member.email, function (body) {
                                        api.log('deleteMemberDone', 'DELETE MEMBER DONE', member.email, groupId, body);
                                        next(body);
                                    });
                                });
                            }
                        });
                    }

                    for(var thread=0; thread<=api.threads; thread++) {
                        next();
                    }
                }
            }, jwt);
        },

        setUserRole: function (groupId, userId, role, callback) {
            api.log('setUserRole', 'F: SET USER ROLE', groupId, userId);
            if(!api.test) {
                makeRequest({
                    type: 'put',
                    url: 'groups/'+groupId+'/members/'+userId,
                    callback: callback,
                    body: {
                        role: role.toUpperCase()
                    }
                }, jwt);
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
                api.insertLog[id] = true;
                if (isProperty(api.deleteLog, id)) {
                    api.log('insertDeleteError', 'Error: Inserting '+actionObject+' just deleted.', groupId, userId);
                }
            }else{
                api.deleteLog[id] = true;
                if (isProperty(api.insertLog, id)) {
                    api.log('insertDeleteError', 'Error: Deleting '+actionObject+' just inserted', groupId, userId);
                }
            }
        },

        insertGroup: function (groupId, groupName, groupDescription, callback) {
            if(groupId) {
                api.log('insertGroup', 'F: INSERT GROUP', groupId);
                api.insertDeleteErrorCheck(true, groupId);

                if (!api.test) {
                    api.getAllGroups(function (groups) {
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
                            }, jwt);
                        }
                    });
                } else {
                    callback();
                }
            }
        },

        insertMember: function (groupId, userId, role, callback) {
            if(groupId && userId) {
                api.log('insertMember', 'F: INSERT MEMBER', groupId, userId);
                api.insertDeleteErrorCheck(true, groupId, userId);

                if (!api.test) {
                    makeRequest({
                        type: 'post',
                        url: 'groups/' + groupId + '/members',
                        callback: function (newUser) {
                            api.setUserRole(groupId, userId, role, callback);
                        },
                        body: {
                            'email': userId
                        }
                    }, jwt);
                } else {
                    api.setUserRole(groupId, userId, role, callback);
                }
            }
        },

        deleteGroup: function (groupId, callback) {
            if(groupId) {
                api.log('deleteGroup', 'F: DELETE GROUP', groupId);
                api.insertDeleteErrorCheck(false, groupId);

                if (!api.test) {
                    makeRequest({
                        type: 'del',
                        url: 'groups/' + groupId,
                        callback: callback
                    }, jwt);
                } else {
                    callback();
                }
            }
        },

        deleteMember: function (groupId, userId, callback) {
            if(groupId && userId) {
                api.log('deleteMember', 'F: DELETE MEMBER', groupId, userId);
                api.insertDeleteErrorCheck(false, groupId, userId);

                if (!api.test) {
                    makeRequest({
                        type: 'del',
                        url: 'groups/' + groupId + '/members/' + userId,
                        callback: callback
                    }, jwt);
                } else {
                    callback();
                }
            }
        }
    };

    getOptions(options, function (options) {
        api['verbose'] = ((isProperty(options, 'verbose'))? options['verbose'] : api['verbose']);
        api['verboseSettings'] = ((isProperty(options, 'verboseSettings'))? options['verboseSettings'] : api['verboseSettings']);

        for(option in options) {
            if (isProperty(api, option)) {
                api.log('settingsReport', 'Adding api option: ' + option, options[option]);
                api[option] = options[option];
            } else {
                api.log('settingsReport', 'Adding JWT option: ' + option, options[option]);
                jwt[option] = options[option];
            }
        }

        callback(api);
    });
};