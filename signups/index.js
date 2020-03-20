'use strict';
const DB_UTILS = require ('./dbUtils.js');

const TABLE_SIGNUP = "signup";
const TABLE_MEMBER = "member";
const TABLE_SIGNUP_MEMBER = "signupMember";

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
    DB_UTILS.initTable(TABLE_SIGNUP);
    DB_UTILS.initTable(TABLE_SIGNUP_MEMBER);
    DB_UTILS.initTable(TABLE_MEMBER);
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
        const signupsData = await DB_UTILS.asyncQueryEntities(TABLE_SIGNUP, new DB_UTILS.AZURE.TableQuery());
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
        const signup = await DB_UTILS.asyncRetrieveEntity(TABLE_SIGNUP, signupId);
        const members = await getMembersForSignup(signupId);

        return { ...signup, members};
    } catch (error) {
        console.error("getSignup error:");
        console.error(error);
        throw error;
    }
}

async function getMembersForSignup (signupId) {
    const signupMembersQuery = new DB_UTILS.AZURE.TableQuery().where ("signupId eq ?", signupId);
    const signupMembers = await DB_UTILS.asyncQueryEntities(TABLE_SIGNUP_MEMBER, signupMembersQuery);
    const members = await Promise.all(
        signupMembers.map( 
            (signupMember) => getMember(signupMember.memberId)));
    return members;
}

async function getMember(memberId){
    try{
        return await DB_UTILS.asyncRetrieveEntity(TABLE_MEMBER, memberId);
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
        
        //updateSignupMembership (signupId, members);
        return await DB_UTILS.asyncMergeEntity (TABLE_SIGNUP, signup);
    } catch (error) {
        console.error("updateSignup error:");
        console.error(error);
        throw error;
    }
}

/*async function updateSignupMembership (signupId, members){
//TODO: break down members into signupmemebers in comment and regular members 
    const dbMembers = await getMembersForSignup (signupId);
    if ( members ){
        members.map (
            member => {
                try {
                    const signupMemberRecord = {signupId, "memberId": member.memberId, "PARTITIONKEY": DEFAULT_PARTITION};
                    DB_UTILS.asyncInsertOrMergeEntity (TABLE_MEMBER, member);
                    //DB_UTILS.asyncInsertOrMergeEntity (TABLE_SIGNUP_MEMBER, signupMemberRecord);
                } catch (error) {
                    console.error("updateSignupMembership error:");
                    console.error(error); 
                    throw error;
                }
            }
        );
    }
}*/