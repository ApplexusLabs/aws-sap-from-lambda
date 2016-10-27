//return stock positions based on parameters
//'use strict';

var sapapi = require('./sapapi');

exports.getStock = (params, callback) => {

var oParams = {
       plant: params.plant ? params.plant : "",
       storage: params.storage ? params.storage : "",
       material:  params.material ? params.material : "" };


if (oParams.plant == "" ) callback(new Error("Parameter 'plant' has not been provided"));

//call remote REST service via POST method.
sapapi.sendPOST("/sap/bc/rest/zaws/stock", 
                 oParams, 
                 (oData) => callback(undefined, oData), //success 
                 (oErr) => callback(oErr)               //error
                );

    
};



