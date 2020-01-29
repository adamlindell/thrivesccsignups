const AZURE = require('azure-storage');
const TABLE_SIGNUP = "signup";
const TABLE_MEMBER = "member";
const TABLE_SIGNUP_MEMBER = "signupMember";
const DEFAULT_PARTITION = "default";

module.exports = async (context, req) => {
    initDB();
    context.log(req);
    switch (req.method){
    case "GET":
        context.res = await handleGet(req);
        break;
    case "PUT":
        context.res = await handlePut(req);
        break;
    case "POST":
        context.res = await handlePost(req);
        break;
    default:
        context.error("unexpected request:");
        context.error(req);  //shouldn't happen, Azure is keeping bad verbs out because of function.json
        context.res = { status: 500 };
    }
};

function initDB (){
    initTable(TABLE_SIGNUP);
    initTable(TABLE_SIGNUP_MEMBER);
    initTable(TABLE_MEMBER);
}

function initTable (tableName){
    AZURE.createTableService().createTableIfNotExists(tableName, function(error, result, response){
        if(error){
            context.error("create " + tableName + "table:");
            context.error(error);
        }
    });
}

/**
 * handleGet processes all get requests.
 * @returns an Azure response object.
 * @param {*} req - the request object.
 */
async function handleGet(req){
    let result;
    if ( req.params.signupId ){
        result = await getSignup(req.params.signupId);
        if (result){
            return { body: result };
        } else {
            return { status: 404 };
        }
    }

    //if no id, list the signups
    return {
        body: await getAllSignups()
    };
}

/**
 * handlePost processes all post requests.
 * @returns an Azure response object.
 * @param {*} req - the request object.
 */
async function handlePost(req){
    if (req.params.signupId){
        const existingSignup = await getSignup (req.params.signupId);
        if (existingSignup) {
            const updatedSignup = await updateSignup(existingSignup.id, existingSignup[partitionKeyName], req.body);
            return { status: 200 };
        } else {
            return {
                status: 404, //Post = update, if there is no existing signup, use PUT
            };
        }
    } else {
        return {
            status: 406, //Not Accepted
            body: "sign up ID required."
        };
    }
}

/**
 * handlePut processes all put requests.
 * @returns an Azure response object.
 * @param {*} req - the request object.
 */
async function handlePut(req){
    createSignup(req.body);
    return {
        status: 200
    };
}

async function getAllSignups(){
    const {resources} = await client.database(databaseName).container(containerName).items.readAll().fetchAll();
    return resources;
}

async function getSignup(signupId){
    try{
        const signup = await asyncRetrieveEntity(TABLE_SIGNUP, DEFAULT_PARTITION, signupId);
        const signupMembersQuery = new AZURE.TableQuery().where ("signupId eq ?", signupId);
        const signupMembers = await asyncQueryEntities(TABLE_SIGNUP_MEMBER, signupMembersQuery);
        const members = await Promise.all( signupMembers.entries.map( (signupMember) => {
            return getMember(signupMember.memberId._);
        })) ;
        return {signup, signupMembers, members};
    } catch (error) {
        console.error("getSignup error:");
        console.error(error);
    }
}

async function getMember(memberId){
    try{
        return await asyncRetrieveEntity(TABLE_MEMBER, DEFAULT_PARTITION, memberId);
    } catch (error) {
        console.error("getMember error:");
        console.error(error);
    }
}

function asyncRetrieveEntity ( tableName, partitionKeyName, rowId){
    return new Promise((resolve, reject) => AZURE.createTableService().retrieveEntity(tableName, partitionKeyName, rowId, (error, result, response) => {
        if(error){
            reject({error, response});
        } else {
            resolve(result);
        }
    }));
}

function asyncQueryEntities ( tableName, query, continuationToken){
    return new Promise ((resolve, reject) => AZURE.createTableService().queryEntities(tableName, query, continuationToken, function(error, result, response) {
        if(error){
            reject({error, response});
        } else {
            resolve(result);
        }
    }));
}

async function createSignup (signup){
    const response = await client.database(databaseName).container(containerName).items.create(signup);
    return response;
}

