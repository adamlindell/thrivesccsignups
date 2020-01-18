module.exports = async (context, req) => {
    context.log(req);
    switch ( req.method ){
        case "GET":
            let result = [];
            if ( req.params.signupId ){
                result = getSignup(req.params.signupId);
            } else {
                result = getAllSignups();
            }
            context.res = {
                body: result
            }
            break;
        case "PUT":
            context.res = {
                body: "put some"
            };
            break;
        case "POST":
            context.res = {
                body: "post some"
            };
            break;
        default:
            context.res = {
                status: 405, /* Method Not Allowed */
                headers: {
                    "Allow": "GET, PUT, POST",
                    "Garbage": "yes"
                }
            };
    }
};

function getAllSignups (){
    return getSignup(1).concat(getSignup(2));
}

function getSignup (signupId){
    return [{
        name: "test signup",
        startTime: new Date (2010, 02, 01, 12, 10, 29, 9394),
    }];
}