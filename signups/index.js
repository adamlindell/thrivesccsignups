'use strict';
const SIGNUP = require ('./signup.js');
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
        context.log.error(error);   //Generic Error Handling, make sure the client knows there's a problem.
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
        const result = await SIGNUP.getSignup(req.params.signupId);
        if (result){
            return { body: result };
        } else {
            return { status: 404 };
        }
    }

    //if no id, list the signups
    return {
        body: await SIGNUP.getAllSignups()
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
            const existingSignup = await SIGNUP.getSignup (urlSignupId);
            if (existingSignup) {
                const updatedSignup = await SIGNUP.updateSignup(signup);
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
    SIGNUP.createSignup(req.body);
    return {
        status: 200
    };
}