const AZURE = require('azure-storage');
const TABLE_SIGNUP = "signup";
const TABLE_MEMBER = "member";
const TABLE_SIGNUP_MEMBER = "signupMember";
const DEFAULT_PARTITION = "default";

module.exports = async (context, req) => {
    initDB();
    context.log(req);
    try{
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
    } catch (error) {
        context.error(error); 
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

function cleanUpAzureDBResponse (azureResponse){
    const result = {};
    Object.keys(azureResponse).map( key => {
        if (key === ".metadata"){ //metadata is only useful within a db transaction, so skip it
            return;
        }

        if (Array.isArray (azureResponse[key])){
            result[key] = azureResponse[key].map (cleanUpAzureDBResponse);
        } else {
        result[key] = azureResponse[key]._;
        }               
    });
    return result;
}


/**
 * handleGet processes all get requests.
 * @returns an Azure response object.
 * @param {*} req - the request object.
 */
async function handleGet(req){

    if ( req.params.signupId ){
        const result = await getSignup(req.params.signupId);
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
            const updatedSignup = await updateSignup(req.params.signupId, req.body);
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

async function createSignup (signup){
    //const response = await client.database(databaseName).container(containerName).items.create(signup);
    //return response;
}

async function getAllSignups(){
    try{
        const signupsData = await asyncQueryEntities(TABLE_SIGNUP, new AZURE.TableQuery());
        const signups = await Promise.all (signupsData.map( async (signup) => {
            const members = await getMembersForSignup (signup.RowKey);
            return { ...signup, members};
        } ));
        return signups;
    } catch (error) {
        console.error("getAllSignups error:");
        console.error(error);
        throw error;
    }
}

async function getSignup(signupId){
    try{
        const signup = await asyncRetrieveEntity(TABLE_SIGNUP, DEFAULT_PARTITION, signupId);
        const members = await getMembersForSignup(signupId);

        return { ...signup, members};
    } catch (error) {
        console.error("getSignup error:");
        console.error(error);
        throw error;
    }
}

async function getMembersForSignup (signupId) {
    const signupMembersQuery = new AZURE.TableQuery().where ("signupId eq ?", signupId);
    const signupMembers = await asyncQueryEntities(TABLE_SIGNUP_MEMBER, signupMembersQuery);
    const members = await Promise.all(
        signupMembers.map( 
            (signupMember) => getMember(signupMember.memberId)));
    return members;
}

async function getMember(memberId){
    try{
        return await asyncRetrieveEntity(TABLE_MEMBER, DEFAULT_PARTITION, ""+memberId);
    } catch (error) {
        console.error("getMember error:");
        console.error(error);
        throw error;
    }
}

async function updateSignup(signupid, signup){
    try{
        const members = signup.members;
        delete signup.members;
        delete signup.createTimestamp; //createTimestamp is not updateable.
        
        updateSignupMembership (signupId, members);
        return await asyncMergeEntity (TABLE_SIGNUP, signup);
    } catch (error) {
        console.error("updateSignup error:");
        console.error(error);
        throw error;
    }
}

async function updateSignupMembership (signupId, members){
//TODO: break down members into signupmemebers in comment and regular members 
    const dbMembers = await getMembersForSignup (signupId);
    if ( members ){
        members.map (
            member => {
                try {
                    const signupMemberRecord = {signupId, "ROWKEY": member.memberId, "PARTITIONKEY": DEFAULT_PARTITION};
                    asyncInsertOrMergeEntity (TABLE_MEMBER, member);
                    //asyncInsertOrMergeEntity (TABLE_SIGNUP_MEMBER, signupMemberRecord);
                } catch (error) {
                    console.error("updateSignupMembership error:");
                    console.error(error); 
                    throw error;
                }
            }
        );
    }
}

function asyncRetrieveEntity (tableName, partitionKeyName, rowId){
    return new Promise((resolve, reject) => AZURE.createTableService().retrieveEntity(tableName, partitionKeyName, rowId, (error, result, response) => {
        if(error){
            reject({error, response});
        } else {
            resolve (cleanUpAzureDBResponse (result));
        }
    }));
}

function asyncQueryEntities (tableName, query, continuationToken){
    return new Promise ((resolve, reject) => AZURE.createTableService().queryEntities(tableName, query, continuationToken, function(error, result, response) {
        if(error){
            reject({error, response});
        } else {
            if (result.entries){
                resolve(result.entries.map(cleanUpAzureDBResponse));
            } else {
                resolve(result.entries);
            }
           
        }
    }));
}

function asyncMergeEntity (tableName, entity, options = undefined){
    return new Promise ((resolve, reject) => AZURE.createTableService().mergeEntity(tableName, entity, options, function(error, result, response) {
        if(error){
            reject({error, response});
        } else {
            resolve(result); //successfully merged element
        }
    }));
}

function asyncInsertOrMergeEntity (tableName, entity, options = undefined){
    return new Promise ((resolve, reject) => AZURE.createTableService().insertOrMergeEntity(tableName, entity, options, function(error, result, response) {
        if(error){
            reject({error, response});
        } else {
            resolve(result); //successfully persisted element
        }
    }));
}

function asyncDeleteEntity (tableName, entity, options = undefined){
    return new Promise ((resolve, reject) => AZURE.createTableService().delete(tableName, entity, options, function(error, result, response) {
        if(error){
            reject({error, response});
        } else {
            resolve(result); //successfully deleted element
        }
    }));
}