/* global angular, console, StellarSdk */

angular.module('app')
.factory('Keychain', function ($q, $rootScope, Crypto, Modal, Storage) {
	'use strict';

	function getKey(signer) {

		var keyStore = keychain[signer];
		if (typeof keyStore === 'string') {
			var keys =  StellarSdk.Keypair.fromSecret(keyStore);
			return $q.when(keys);
		}

		var scope = $rootScope.$new();
		scope.signer = signer;

		return Modal.show('app/core/modals/submit-password.html', scope)
		.then(function (password) {
			var secret = Crypto.decrypt(keyStore, password);
			return StellarSdk.Keypair.fromSecret(secret);
		}, function (err) {
			return $q.reject(err);
		});
	}

	function isValidPassword(keyStore, password) {
		if (typeof keyStore === 'string') {
			return true;
		}

		try {
			var seed = Crypto.decrypt(keyStore, password);
			return StellarSdk.StrKey.isValidEd25519SecretSeed(seed);
		} catch (error) {
			return false;
		}
	}

	var keychain = {};
	var keys = Storage.getItem('keys');
	if (keys) {
		keys.forEach(function (publicKey) {
			keychain[publicKey] = Storage.getItem('key.' + publicKey);
		});
	}

	/* */

	return {

		idFromKey: function (key, password) {
			if (typeof key === 'object') {
				key = Crypto.decrypt(key, password);
			}
			return StellarSdk.Keypair.fromSecret(key).publicKey();
		},

		setPassword: function (signer, password) {
			var keyStore = keychain[signer];
			keyStore = Crypto.encrypt(keyStore, password);
			keychain[signer] = keyStore;
			Storage.setItem('key.' + signer, keyStore);
		},

		removePassword: function (signer, password) {
			var keyStore = keychain[signer];
			keyStore = Crypto.decrypt(keyStore, password);
			keychain[signer] = keyStore;
			Storage.setItem('key.' + signer, keyStore);
		},

		addKey: function (accountId, seed) {
			keychain[accountId] = seed;
			Storage.setItem('key.' + accountId, seed);
			Storage.setItem('keys', Object.keys(keychain));
		},

		getKeyInfo: function (signer) {
			return keychain[signer];
		},

		signMessage: function (signer, message) {
			return getKey(signer)
			.then(function (key) {
				var hash = StellarSdk.hash(StellarSdk.hash(message));
				return key.sign(hash).toString('base64');
			});
		},

		signTransaction: function (signer, tx, txHash) {
			return getKey(signer)
			.then(
				function (key) {
					var sig = key.signDecorated(txHash);
					tx.signatures.push(sig);
				},
				function (err) {
					return $q.reject(err);
				}
			);
		},

		isValidPassword: isValidPassword,

		isValidPasswordForSigner: function (signer, password) {
			var keyStore = keychain[signer];
			return isValidPassword(keyStore, password);
		},

		isEncrypted: function (signer) {
			return (typeof keychain[signer] === 'object');
		},

		isLocalSigner: function (signer) {
			return (signer in keychain);
		}
	};
});
