
/* global angular, console, StellarSdk */

angular.module('app')
.directive('accountName', function ($q, Reverse) {
	'use strict';

	function link(scope, element, attrs) {
		Reverse.lookupAndFill(
			function (res) {scope.name = res;},
			scope.id,
			scope.network,
			scope.tx
		);
	}

	return {
		restrict: 'E',
		scope: {
			id: '@',
			network: '@',
			tx: '='
		},
		link: link,
		template: '{{name}}'
	};
});
