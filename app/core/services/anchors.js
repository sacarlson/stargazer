/* global angular, toml */

angular.module('app')
.factory('Anchors', function ($http, $q) {
	'use strict';

	function lookup(domain) {

		if (!domain) {
			return $q.reject();
		}

		var url = 'https://' + domain + '/.well-known/stellar.toml';

		return $http.get(url)
		.then(function (res) {
			try {
				var config = toml.parse(res.data);
				if (config.CURRENCIES) {
					return config.CURRENCIES;
				} else {
					return $q.reject();
				}
			} catch (e) {
				return $q.reject();
			}
		});
	}

	return {
		lookup: lookup
	};
});
