/* global angular */

angular.module('app')
.factory('Storage', function ($window) {
	'use strict';

	function getItem(key) {
        console.log("getItem key: ",key);
        //localstorage_dump_keylist();
		var value = $window.localStorage.getItem(key);
        
		if (value) {
			return JSON.parse(value);
		} else {
			return null;
		}
	}

    function localstorage_dump_keylist() {
        console.log("dump localstorage keylist");
        for ( var i = 0, len = $window.localStorage.length; i < len; ++i ) {
          console.log(  $window.localStorage.key( i ) );
        }
      }

	function setItem(key, value) {
		$window.localStorage.setItem(key, JSON.stringify(value, function (key, value) {
			if (key.slice(0, 2) === '$$') {
				return undefined;
			}

			return value;
		}));
	}

	function removeItem(key) {
		$window.localStorage.removeItem(key);
	}

	var version = getItem('db-version');
	if (!version) {
		setItem('db-version', 1);
	}

	return {
		getItem: getItem,
		setItem: setItem,
		removeItem: removeItem
	};
});
