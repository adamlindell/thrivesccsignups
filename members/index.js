module.exports = async (context, req) => {
    context.log(req);
/*    switch (req.method){
    case "GET":
        context.res = handleGet();
        break;
    case "PUT":
        context.res = {
            body: "put some"
        };
        break;
    case "POST":
        context.res = handlePost(req);
        break;
    default:
        context.log("unexpected request: " + req);  //shouldn't happen, Azure is keeping bad verbs out because of function.json
    }*/
};

/**
 * handleGet processes all get requests.
 * @returns an Azure response object.
 * @param {*} req - the request object.
 */
function handleGet(req){
    let result;
    if ( req.params.signupId ){
        result = getSignup(req.params.signupId);
        if (result){
            return { body: result };
        } else {
            return { status: 404 };
        }
    }

    //if no id, list the signups
    return {
        body: getAllSignups()
    };
}

/**
 * handlePost processes all post requests.
 * @returns an Azure response object.
 * @param {*} req - the request object.
 */
function handlePost(req){
    if ( req.params.signupId ){
        let updatedSignup = updateSignup( req );
        if (updatedSignup){
            return { body: updatedSignup };
        } else {
            return {
                status: 500, //Server Error
                body: "POST failed. Please try again later."
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
function handlePut(req){
    createSignup(signup);
}

function getAllSignups(){
    return getSignup(1).concat(getSignup(2));
}

function getSignup(signupId){
    return [{
        name: "test signup",
        startTime: new Date (2010, 02, 01, 12, 10, 29, 9394),
    }];
}

function createSignup (signup){

}

function updateSignup (signup){

}