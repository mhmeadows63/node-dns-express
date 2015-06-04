var Usey = require('usey')
	, dns = require('native-dns')
	, dnsTypes = ['A','AAAA', 'NS', 'CNAME', 'PTR', 'NAPTR', 'TXT', 'MX', 'SRV', 'SOA', 'TLSA']
	;

module.exports = ExpressDNS;

function ExpressDNS (options) {
	var DNS = Usey();
	var server = dns.createServer();

	DNS.use(function (req, res, next) {
		req.questions.forEach(function (question) {
			question.remote = req.remote;
			question.typeName = (dns.consts.qtypeToName(question.type) || "").toLowerCase();
		});

		return next();
	});

	dnsTypes.concat("ALL").forEach(function (type) {
		var ltype = type.toLowerCase();

		DNS[ltype] = function (route, fn) {
			if (arguments.length === 1) {
				fn = route;
				route = null;
			}

			DNS.use(function (req, res, next) {
				var questions = req.questions;
				var match = false;
				var question;

				for (var x = 0; x < questions.length; x++) {
					question = questions[x];
					
					//this is where the matching happens.
					//TODO: expand this to handle matching in ways other than regex
					if ((question.typeName === ltype || ltype === 'all') && (!route || route.test(question.name)) ) {
						match = true;
						res.begins += 1;

						fn(question, res, next);
					}
				}

				if (match) {
					return
				}

				return next();
			});
		};
	});

	DNS.listen = function () {
		server.serve.apply(server, arguments);
	};

	server.on('request', function (req, res) {
		var request = new DNSRequest(req, res);
		var response = new DNSResponse(req, res);

		DNS(request, response);
	});

	return DNS;
}

function DNSRequest (req, res) {
	var self = this;

	self.questions = req.question;
	self.remote = req.address;
}

function DNSResponse (req, res) {
	var self = this;
	self.begins = 0;
	self.ends = 0;

	dnsTypes.forEach(function (type) {
		ltype = type.toLowerCase();

		self[ltype] = function () {
			res.answer.push(dns[type].apply(dns, arguments));
		}
	});

	self.end = function () {
		self.ends += 1;

		//only send the response if once we have called 'end'
		//for each of the questions.
		if (self.ends >= self.begins) {
			res.send();
		}
	};
}