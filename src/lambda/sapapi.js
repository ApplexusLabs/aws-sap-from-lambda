var http = require('http');
var extsys = require('./settings').extsys;

var sAuth = 'Basic ';
sAuth += new Buffer(extsys.username + ':' + extsys.password).toString('base64');


// SAP Specific posting

function sendPOST(endpoint, data, success, error) {

// SAP require to send Get request prior to POST (to fetch token)

	var oGetRequest = new Promise(function (resolve, reject) {

		var headers = {
			'Authorization': sAuth,
			'x-csrf-token': "fetch"
		};

		var options = {
			host: extsys.host,
			port: extsys.port,
			path: endpoint,
			method: "GET",
			headers: headers
		};

		var req = http.request(options, function (res) {
			resolve(res);
		});

		req.setTimeout(60000, function () {
			reject( new Error("Server is unreachable"));
		});
		req.end();
		req.on('error', function (error) {
		   reject(error);
		});

	});

	oGetRequest.then(
		// resolve
		function (oGetRes) {

            //Payload with parameters  
			var dataString = JSON.stringify(data);

			var headers = {};
			headers['Authorization'] = sAuth;
			headers['Accept-Language'] = 'en';
			headers['X-Requested-With'] = "XMLHttpRequest";
			headers['Content-Type'] = 'application/json';
			headers['X-CSRF-Token'] = oGetRes.headers['x-csrf-token'];
			headers['cookie'] = oGetRes.headers['set-cookie']; //array should be converted to string with ; delimers?


			var options = {
				host: extsys.host,
				port: extsys.port,
				path: endpoint,
				method: "POST",
				headers: headers
			};

			var req = http.request(options, function (res) {

				if (res.statusCode !== 200) return error(new Error("Internal error"));

				res.setEncoding('utf-8');

				var responseString = '';

				res.on('data', function (data) {
					responseString += data;
				});

				res.on('end', function () {
						success(JSON.parse(responseString));
				});
			});

			req.write(dataString);
			req.end();
			req.on('error', function (error) {
				error(error);
			});

		},

		// reject
		function (err) {
			error(err);
		});
}

exports.sendPOST = sendPOST;
