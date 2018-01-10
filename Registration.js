var http = require('http');
var url = require('url');
var fs = require('fs');
var mysql = require('mysql');
var qs = require('querystring');
const https = require('https');
https.post = require('https-post');
var stringify = require('json-stringify');


process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';



var server = http.createServer(function (req, res) {
    if (req.method.toLowerCase() === 'get') {
        displayForm(res);
    } else if (req.method.toLowerCase() === 'post') {
        processAllFieldsOfTheForm(req, res);
    }

});

function processAllFieldsOfTheForm(req, resp) {

	var body='';
	var post='';
	req.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
                req.connection.destroy();
        });
		
		req.on('end', function () {
            post = qs.parse(body);

			var object = {} // empty Object
			object['member']={};
			object['member']['first_name']=post.first_name;
			object['member']['last_name']=post.last_name;
			object['member']['birth_date']=post.dob;
			object['member']['id']=post.provider_id;
			object['provider']={};
			object['provider']['first_name']=post.provider_first_name;
			object['provider']['last_name']=post.provider_last_name;
			object['provider']['npi']="1234567890";
			
			
			var agents={};
			
			agents['Aetna']='aetna';
			agents['United Health Care']='united_health_care';
			agents['Blue Cross/Blue Shield']='empire_blue_cross_blue_shield';
			agents['Cigna']='cigna';
			agents['No Insurance']='';
				
			object['trading_partner_id']=agents[post.agent];

			console.log(post.optradio);

			if(post.optradio){ // If he has insurance call the api and check for copay
				
				var postData = stringify(object,null,2);
				var options = {
					hostname: 'apistage.gohealthuc.com',
					port: 1981,
					path: '/v1/eligibility_demo',
					method: 'POST',
					headers: {
						'authtoken':'ghRamineni@17'
					},	
					timeout:120000
				};
			
				var req2 = https.request(options, (res) => {
					
					console.log('statusCode:', res.statusCode);
					console.log('headers:', res.headers);
					var myString='';
					res.on('data', function (d) {
						if(res.statusCode==200){
							myString+=d.toString();	
						}
					});
					res.on('end', function() {
       				 	var b=JSON.parse(myString);
       				 	if(b.data.coverage.active){
					 		//Insurance is active
					 		resp.write("The expected copay that need to be paid is : " );
					 		resp.write((b.data.coverage.copay[1].copayment.amount));
					 		resp.write((b.data.coverage.copay[1].copayment.currency));
					 		resp.end();
					 	}
					 	else{
					 		//Insurance is inactive
					 		resp.write("Your Insurance is inactive, Your insurance has expired on ");
					 		resp.write(b.data.coverage.plan_end_date);
					 	}
    				});	
				});
				
				req2.on('error', (e) => {
					console.error(e);
				});

				req2.write(postData);
				req2.end();
			}
			else{ //else save it to local database
				console.log("He doesnt have insurance");

				var con = mysql.createConnection({   //Enter the database details here
 					 host: "localhost",
  					 user: "admin",
  					 password: "",
  					 database: "GoHealth"
				});

				con.connect(function(err) {
  					if (err) throw err;
  					console.log("Connected to database!");
  					var sql = "INSERT INTO patients (firstName, lastName, DOB) VALUES (post.first_name, post.last_name,post.dob)";
  					con.query(sql, function (err, result) {
    				if (err) throw err;
    				console.log("Successfully Registered");

    				fs.readFile('redirect.html', function (err, data) {
						console.log("The magic length is " + data.length);
        				resp.writeHead(200, {
            			'Content-Type': 'text/html',
               			'Content-Length': data.length
        			});
        			resp.write(data);
        			resp.end();
    				});

  				});
			});
		}			
	});
}


function displayForm(res) {
    fs.readFile('Registration.html', function (err, data) {
	console.log("The magic length is " + data.length);
        res.writeHead(200, {
            'Content-Type': 'text/html',
                'Content-Length': data.length
        });
        res.write(data);
        res.end();
    });
}

server.listen(8081);
