'use strict';

console.log('Loading function');

var getStock = require('./getstock').getStock;


/**
 * Demonstrates a simple HTTP endpoint using API Gateway. You have full
 * access to the request and response payload, including headers and
 * status code.
 *
 */
exports.handler = (event, context, callback) => {

    const done = (err, res) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err.message : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    switch (event.httpMethod) {
        case 'GET':
           getStock(event.queryStringParameters, done)
           break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
