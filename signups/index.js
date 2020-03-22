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
            context.log.error("unexpected request:");
            context.log.error(req);  //shouldn't happen, Azure is keeping bad verbs out because of function.json
            context.res = { status: 500 };
        }
    } catch (error) {
        context.log.error(error); 
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
    try{
        const urlSignupId = req.params.signupId;
        const signup = req.body;

        if (urlSignupId && signup.signupId){
            if (signup.signupId !== urlSignupId){
                return {
                    status: 400, //Post = update, if there is no existing signup, use PUT
                    body: "ID mismatch between URL and data"
                };
            }
            const existingSignup = await getSignup (urlSignupId);
            if (existingSignup) {
                const updatedSignup = await updateSignup(signup);
                return { 
                    status: 200,
                    body: updatedSignup 
                };
            } else {
                return {
                    status: 404, //Post = update, if there is no existing signup, use PUT
                    body: "Use PUT for creation"
                };
            }
        } else {
            return {
                status: 406, //Not Accepted
                body: "sign up ID required."
            };
        }
    } catch (error){
        console.error("handlePost error:");
        console.error(error);
        throw error;
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
        const signupsData = await DB_UTILS.asyncQueryEntities (TABLE_SIGNUP, new DB_UTILS.AZURE.TableQuery());
        const signups = await Promise.all (signupsData.map (decorateSignup));
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
        return decorateSignup (signup);
    } catch (error) {
        console.error("getSignup error:");
        console.error(error);
        throw error;
    }
}

async function decorateSignup (rawSignup){
    const signupId = rawSignup.RowKey;
    const members = await getMembersForSignup(signupId);
    delete rawSignup.RowKey;
    
    return { signupId, ...rawSignup, members};
}

async function undecorateSignup (signup){
    const dbSignup = {...signup};
    const members = dbSignup.members;
    
    dbSignup.RowKey = dbSignup.signupId;
    delete dbSignup.signupId;
    delete dbSignup.members;
    
    return {dbSignup, members};
}

async function decorateMemberSignup (signupMember, member){
    return {
        "signupMemberId": signupMember.RowKey,
        "signupId": signupMember.signupId,
        "memberId": signupMember.memberId,
        "comment": signupMember.comment,
        "attending": signupMember.attending,
        "signupMemberCreateTimestamp": signupMember.createTimestamp,
        "signupMemberUpdateTimestamp": signupMember.Timestamp,
        "name": member.name,
        "memberCreateTimestamp": member.createTimestamp,
        "memberUpdateTimestamp": member.Timestamp,
    };
}

async function undecorateMemberSignup (memberSignup){
    return {
        "signupMemberRecord":{
            "RowKey": memberSignup.signupMemberId,
            "PartitionKey": DB_UTILS.DEFAULT_PARTITION,
            "signupId": memberSignup.signupId, 
            "memberId": memberSignup.memberId, 
            "comment": memberSignup.comment, 
            "attending": memberSignup.attending || "Y",
            "createTimestamp": memberSignup.signupMemberCreateTimestamp || new Date(), //on update this shouldn't be editable, but is needed for inserts.  later enhancement would be to seperate upsert for this reason.
        },
        "memberRecord":{ 
            "PartitionKey": DB_UTILS.DEFAULT_PARTITION,
            "RowKey": memberSignup.memberId,
            "name": memberSignup.name,
            "createTimestamp": memberSignup.memberCreateTimestamp || new Date(),
        }
    }
}

async function getMembersForSignup(signupId) {
    const signupMembersQuery = new DB_UTILS.AZURE.TableQuery ().where ("signupId eq ? and attending eq 'Y'", signupId);
    const signupMembers = await DB_UTILS.asyncQueryEntities (TABLE_SIGNUP_MEMBER, signupMembersQuery);
    const members = await Promise.all (signupMembers.map ((signupMember) => 
        decorateMemberSignup (signupMember, getMember (signupMember.memberId))));
    return members;
}

async function getMember(memberId){
    try{
        return await DB_UTILS.asyncRetrieveEntity (TABLE_MEMBER, memberId);
    } catch (error) {
        console.error ("getMember error:");
        console.error (error);
        throw error;
    }
}

async function updateSignup(signup){
    try{
        const {dbSignup, members}  = await undecorateSignup(signup);
        delete dbSignup.createTimestamp; //createTimestamp is not updateable.
        
        await upsertSignupMembership (members);
        return await DB_UTILS.asyncMergeEntity (TABLE_SIGNUP, dbSignup);
    } catch (error) {
        console.error ("updateSignup error:");
        console.error (error);
        throw error;
    }
}

async function upsertSignupMembership (members){
    if (members){
        members.map (
            async member => {
                try {
                    const {signupMemberRecord, memberRecord} = await undecorateMemberSignup(member);

                    DB_UTILS.asyncInsertOrMergeEntity (TABLE_MEMBER, memberRecord);
                    DB_UTILS.asyncInsertOrMergeEntity (TABLE_SIGNUP_MEMBER, signupMemberRecord);
                } catch (error) {
                    console.error("updateSignupMembership error:");
                    console.error(error); 
                    throw error;
                }
            });
    }
}