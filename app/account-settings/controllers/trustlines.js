/* global angular, console, StellarSdk */

angular.module('app')
.controller('AccountTrustlinesCtrl', function ($location, $scope, Anchors, Destination, Modal, Signer, Submitter, Wallet) {
	'use strict';

	$scope.account = Wallet.current;

	$scope.getTrustlines = function () {
		return $scope.account.balances.filter(function (balance) {
			return balance.asset_type !== 'native';
		});
	};

	$scope.isDirty = function () {

		var pristine = true;
		$scope.anchors.forEach(function (anchor) {
			anchor.trustlines.forEach(function (trustline) {
				pristine = pristine && (trustline.state === trustline.oldState);
			});
		});

		return !pristine;
	};

	$scope.hasBalance = function (trustline) {
		return trustline.object.balance != 0;
	};

	function addAsset(asset) {

		var ids = $scope.anchors.map(function (item) {
			return item.id;
		});

		var index = ids.indexOf(asset.issuer);

		var value = {
			object: {
				asset_issuer:	asset.issuer,
				asset_code:		asset.code,
				balance:		0
			},
			state:		false,
			oldState:	false
		};

		if (index === -1) {
			$scope.anchors.push({
				id:			asset.issuer,
				trustlines: [
					value
				]
			});
		} else {
			var trustlines = $scope.anchors[index].trustlines;
			trustlines.push(value);
		}
	}

	var getAnchors = function () {
		var anchors = {};
		Wallet.current.balances.forEach(function (balance) {
			if (balance.asset_type === 'native') {
				return;
			}

			if (!(balance.asset_issuer in anchors)) {
				anchors[balance.asset_issuer] = [];
			}
			anchors[balance.asset_issuer].push({
				object: balance,
				state: true,
				oldState: true
			});
		});

		return Object.keys(anchors).map(function (key) {
			return {
				id: key,
				trustlines: anchors[key]
			};
		});
	};

	$scope.anchors = getAnchors();

	$scope.updateTrustlines = function () {

		$scope.account.horizon().loadAccount($scope.account.id)
		.then(function (account) {
			var builder = new StellarSdk.TransactionBuilder(account);

			$scope.anchors.forEach(function (anchor) {
				anchor.trustlines.forEach(function (trustline) {

					//	no change
					if (trustline.state === trustline.oldState) {
						return;
					}

					var object = trustline.object;
					var params = {
						asset: new StellarSdk.Asset(object.asset_code, object.asset_issuer)
					};

					if (trustline.state === false) {
						params.limit = '0';
					}

					builder.addOperation(StellarSdk.Operation.changeTrust(params));
				});
			});

			var tx = builder.build();

			return {
				tx: tx,
				network: Wallet.current.network
			};
		})
		.then(Signer.sign)
		.then(Submitter.submit)
		.then(function () {
			$scope.account.refresh()
			.then(function () {
				$location.path('/');
			});
		});
	};

	$scope.addAnchor = function () {
		Modal.show('app/account-settings/modals/add-trustline.html', $scope)
		.then(function (res) {

			Destination.lookup(res.anchor)
			.then(function (destInfo) {
				addAsset({
					issuer: destInfo.id,
					code:   res.asset
				});
			},
			function (err) {
				Anchors.lookup(res.anchor)
				.then(function (assetList){
					assetList.forEach(addAsset);
				});
			});
		});

	};
});
