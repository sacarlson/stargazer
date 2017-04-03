/* global angular, console, Decimal, StellarSdk */

angular.module('app')
.controller('SendCtrl', function ($location, $scope, Modal, Signer, Submitter, Wallet) {
	'use strict';

	$scope.advanced = false;
	$scope.destinationAssets = [];
	$scope.send = {};
	$scope.forms = {};
	$scope.flags = {};

	var assetCodeCollisions;
	var hasPath			= false;
	var isPathPending	= true;
	var isPreFilled		= false;

	function createAsset(json, prefix) {

		if (!prefix) {
			prefix = '';
		}

		var asset;
		if (json[prefix + 'asset_type'] === 'native') {
			asset = StellarSdk.Asset.native();
		} else {
			asset = new StellarSdk.Asset(
				json[prefix + 'asset_code'],
				json[prefix + 'asset_issuer']
			);
		}

		return asset;
	}

	function updateCollisions(assets) {
		assetCodeCollisions = Wallet.getAssetCodeCollisions(assets);
	}

	function onDestInfo(destInfo) {

		if (isPreFilled) {
			return;
		}

		if (!destInfo) {
			hasPath = false;
			isPathPending = true;
			delete $scope.send.amount;
			return;
		}

		var currentAccount = Wallet.current;

		currentAccount.horizon().accounts()
		.accountId(destInfo.id)
		.call()

		//	destInfo.id is a registered account

		.then(function (res) {
			if (destInfo.memo_type) {
				$scope.send.memo_type	= destInfo.memo_type;
				$scope.send.memo		= destInfo.memo;
			} else {
				$scope.send.memo_type	= null;
				$scope.send.memo		= null;
			}

			var assetSortFunction = function (a, b) {
				return a.asset_code > b.asset_code;
			};

			updateCollisions(res.balances.concat(Wallet.current.balances));

			//	append any issuing assets we hold in the wallet
			var issuing = currentAccount.getAssetsFromIssuer(destInfo.id);

			var assets = res.balances.concat(issuing);
			var native = assets.filter(function (e) {
				return e.asset_type === 'native';
			});

			var credit_alphanum4 = assets.filter(function (e) {
				return e.asset_type === 'credit_alphanum4';
			});

			var credit_alphanum12 = assets.filter(function (e) {
				return e.asset_type === 'credit_alphanum12';
			});

			credit_alphanum4.sort(assetSortFunction);
			credit_alphanum12.sort(assetSortFunction);

			native[0].asset_code = 'XLM';
			$scope.destinationAssets = native.concat(credit_alphanum4, credit_alphanum12);
			$scope.send.asset = $scope.destinationAssets[0];
			$scope.flags.isUnregistered = false;
		})

		//	destInfo.id is not (currently) a registered account

		.catch(function (err) {

			var assets = [{
				asset_type: 'native',
				asset_code: 'XLM'
			}];

			var issuing = currentAccount.getAssetsFromIssuer(destInfo.id);
			$scope.destinationAssets = assets.concat(issuing);

			updateCollisions(Wallet.current.balances);

			$scope.send.asset = $scope.destinationAssets[0];
			$scope.flags.isUnregistered = true;
		})

		.finally(function () {
			$scope.$apply();
		});
	}

	function getPaths() {

		isPathPending	= true;
		hasPath			= false;

		if (!$scope.send.amount) {
			return;
		}

		if ($scope.flags.isUnregistered &&
			$scope.send.asset.asset_type === 'native' &&
			$scope.send.amount < 20
		) {
			return;
		}

		var amount;
		var currentAccount = Wallet.current;
		var source = currentAccount.id;

		//	check if we're the issuing account for this asset
		if ($scope.send.asset.asset_type !== 'native' &&
			$scope.send.asset.asset_issuer === source
		) {
			var code = $scope.send.asset.asset_code;
			amount = $scope.send.amount.toString();
			$scope.send.pathRecords = [{
				destination_amount: amount,
				destination_asset_code: code,
				destination_asset_issuer: source,
				source_amount: amount,
				source_asset_code: code,
				source_asset_issuer: source,
				path: [],
				enabled: true
			}];

			isPathPending = false;
			hasPath = true;
			$scope.$apply();

			return;
		}

		if ($scope.flags.isUnregistered &&
			$scope.send.asset.asset_type === 'native'
		) {
			amount = $scope.send.amount.toString();
			$scope.send.pathRecords = [{
				destination_amount: amount,
				destination_asset_type: 'native',
				source_amount: amount,
				source_asset_type: 'native',
				path: [],
				enabled: currentAccount.canSend(amount, 1)
			}];

			isPathPending = false;
			hasPath = true;
			$scope.$apply();

			return;
		}

		var destInfo = $scope.send.destInfo;
		var asset = createAsset($scope.send.asset);
		var dest = destInfo.id;
		currentAccount.horizon().paths(source, dest, asset, $scope.send.amount)
		.call()
		.then(function (res) {

			if (res.records.length) {

				//
				//	filter paths... keep the cheapest path per asset,
				//	excluding paths with a zero cost
				//

				var paths = {};
				res.records.forEach(function (record) {
					if (record.source_amount === '0.0000000') {
						return;
					}

					var key = (record.source_asset_type === 'native')?
						'native' : record.source_asset_issuer + record.source_asset_code;

					if (key in paths) {
						if ((paths[key].source_amount - record.source_amount) > 0) {
							paths[key] = record;
						}
					} else {
						paths[key] = record;
					}
				});

				//
				//	go through the remaining paths and disable the ones that are underfunded
				//

				currentAccount.balances.forEach(function (asset) {
					var key = (asset.asset_code === 'XLM')?
						'native' : asset.asset_issuer + asset.asset_code;

					if (key in paths) {
						var amount = paths[key].source_amount;
						if (asset.asset_code === 'XLM') {
							paths[key].enabled = currentAccount.canSend(amount, 1);
						} else {
							paths[key].enabled = ((asset.balance - amount) >= 0) && currentAccount.canSend(0, 1);
						}
					}
				});

				$scope.send.pathRecords = Object.keys(paths).map(function (key) {
					return paths[key];
				});

				hasPath = ($scope.send.pathRecords.length !== 0);
			}

			isPathPending = false;
			$scope.$apply();
		});
	}

	//
	//	rendering
	//

	$scope.getAssetDescription = function (asset) {
		if (asset.asset_type !== 'native') {
			if (asset.asset_code in assetCodeCollisions) {
				return asset.asset_code + '.' + asset.asset_issuer;
			} else {
				return asset.asset_code;
			}
		} else {
			return 'XLM';
		}
	};

	$scope.getSourceAssetDescription = function (path) {
		return $scope.getAssetDescription({
			asset_type:		path.source_asset_type,
			asset_code:		path.source_asset_code,
			asset_issuer:	path.source_asset_issuer
		});
	};

	//
	//	actions
	//

	$scope.selectRecipient = function () {

		//	invalidate form records first
		$scope.send.pathRecords = [];

		$scope.send.destination = '';
		$scope.send.destInfo = null;
		Modal.show('app/core/modals/select-contact.html', $scope);
	};

	$scope.onAmount = function () {
		getPaths();
	};

	$scope.onAsset = function () {
		getPaths();
	};

    function setup_xml(callback) {
       var xmlhttp_ = new XMLHttpRequest();
       xmlhttp_.onreadystatechange = function() {
         if (this.readyState == 4 && this.status == 200) {
           //var data = JSON.parse(this.responseText);
           callback(this.responseText);
         }
       };
       return xmlhttp_
    }

    function xml_response_escrow_submit(data){
        console.log("xml_response_escrow_submit: ",data);

        if (data == "escrow_submit_accepted"){
          console.log("Escrow Submit Accpeted");
          alert("Escrow Submit Accpeted");
          // remove amount value from send to prevent sending twice
          //delete $scope.send.amount;
          $location.path('/');
          // responce back from OpenCart escrow submit as good
          //tx_status.textContent = "Escrow Submit Accpeted";
          return;
        }
    }

    function send_escrow_to_callback(remote_txData){
        //this sends the generated timed escrow transaction and other needed info to the escrow callback
        //b64_timed_tx_env: the signed time based transaction that becomes valid at escrow_expire time 
        //escrow_holding_publicId: GKDS...
        //tx_tag: the stores transaction id that this payment is attached to.
        //escrow_expire_timestamp: time that escrow transaction becomes valid to transact for store to collect funds
        //
        // remote_txData: {"stellar":{"payment":{"stellar":{"payment":{"destination":"GDUPQLNDVSUKJ4XKQQDITC7RFYCJTROCR6AMUBAMPGBIZXQU4UTAGX7C","network":"cee0302d","amount":"85.0000","asset":{"code":"USD","issuer":"GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ"},"memo":{"type":"text","value":"1"},"escrow":{"publicId":"GAVUFP3ZYPZUI2WBSFAGRMDWUWK2UDCPD4ODIIADOILQKB4GI3APVGIF","email":"funtracker.site.bank@gmail.com","expire_ts":1491262504,"expire_dt":"2017-04-03","fee":222.5,"callback":"http:\/\/b.funtracker.site\/store\/?route=extension\/payment\/stellar_net\/submit_escrow&"}},"version":"2.1"}}

        //var remote_txData = Wallet.remote_txData;
        console.log("send_escrow_to_callback");
        console.log(remote_txData.stellar.payment.escrow.callback);
        var b64 = encodeURIComponent(remote_txData.b64_escrow_tx);
        var client = setup_xml(xml_response_escrow_submit);
        var ss = remote_txData.stellar.payment.escrow.callback + 'tx_tag=' + remote_txData.stellar.payment.memo.value + "&b64_tx=" + b64 + "&exp=" + remote_txData.stellar.payment.escrow.expire_ts + "&escPID=" + remote_txData.keypair_escrow.publicKey();
        console.log("sending: ");
        console.log(ss);
        client.open("GET", ss, true); 
        client.send();
      }
        
      var transaction;
      function submit_escrow(){
         //this generates the timed escrow payment transaction, then sends it to the stores escrow callback
         var remote_txData = Wallet.remote_txData;
         var current_keypair = remote_txData.current_keypair;
         //var network = Wallet.current.network;
         //console.log("network");
         //console.log(network);
         //var server = Horizon.getServer(network);
         var currentAccount = Wallet.current;
		 var server = currentAccount.horizon();
         transaction = new StellarSdk.Transaction(remote_txData.b64_escrow_tx);
            //tx_status.textContent = "Escrow Tx Funding ";
            console.log("Escrow Tx Funding ");
            remote_txData.escrow_status = 2;
            server.submitTransaction(transaction).then(function(result) {              
               //tx_status.textContent = "Escrow Funding Completed OK";
               
               console.log("Escrow Funding Completed OK");
               remote_txData.escrow_status = 3;
               var tx_array = [];
               
               // the vendor now gets the asset sent to his store account
               tx_array.push(StellarSdk.Operation.payment({
                 destination: remote_txData.stellar.payment.destination,
                 amount: fix7dec(remote_txData.stellar.payment.amount),
                 asset: remote_txData.escrow_asset
               }));

               // remove trust in our added asset to allow accountMerge bellow
               var asset3 = new StellarSdk.Asset(remote_txData.stellar.payment.asset.code, remote_txData.stellar.payment.asset.issuer);
               tx_array.push(StellarSdk.Operation.changeTrust({asset: asset3,limit: "0"}));              

               //send back what's left of the XLM back to the buyer who created the escrow (you).
               tx_array.push(StellarSdk.Operation.accountMerge({
                 destination: current_keypair.publicKey()
               })); 
               
               server.loadAccount(remote_txData.keypair_escrow.publicKey())
                .then(function (account) {
                  // this transaction won't be valid until escrow expire timestamp date and time
                  var timebounds = {
                    minTime: remote_txData.stellar.payment.escrow.expire_ts.toString(),
                    maxTime: "0"
                  };
                  var memo_tr = StellarSdk.Memo.text(remote_txData.stellar.payment.memo.value);
                  transaction = new StellarSdk.TransactionBuilder(account,{timebounds, memo: memo_tr});         
                  tx_array.forEach(function (item) {
                    transaction.addOperation(item);
                  });
                  transaction = transaction.build();
                  // we have this key already
                  transaction.sign(remote_txData.keypair_escrow); 
                  //fill_envelope_b64(transaction.toEnvelope().toXDR().toString("base64"));
                  remote_txData.b64_escrow_tx = transaction.toEnvelope().toXDR().toString("base64");
                  // at this point we can send envelope_b64.value to store with the other info it needs
                  // it won't be submited to the stellar net until it's time becomes valid
                  //tx_status.textContent = "Escrow Submited to callback";
                  console.log("Escrow Submited to callback");
                  send_escrow_to_callback(remote_txData);
               });
             }).catch(function(e) {
               console.log("submitTransaction error");
               remote_txData.escrow_status = 4;
               console.log(e);
               //tx_status.textContent = "Transaction failed";
               console.log("Transaction failed");
               alert("Transaction failed");
               if (e.extras.result_codes.transaction == "tx_bad_auth"){
                  remote_txData.escrow_status = 5;
                  //tx_status.textContent = "Transaction error: tx_bad_auth";
                  console.log("Transaction error: tx_bad_auth");
               } else {           
                 //tx_status.textContent = "Transaction error: " + e.extras.result_codes.operations[0];
                 console.log("Transaction error: " + e.extras.result_codes.operations[0]);
               }                      
          })
          .then(function (transactionResult) {
            console.log("tx_result");
            console.log(transactionResult);
            if (typeof transactionResult == "undefined") {
              console.log("tx res undefined");
              //tx_status.textContent = "tx res undefined";
            }            
          })
          .catch(function (err) {
            //console.log(err);
            //tx_status.textContent = "Transaction Error: " + err;
            console.log("Transaction Error: " + err); 
          });
      }

     function fix7dec(string) {
        var num = Number(string).toFixed(7);
        string = num.toString();
        return string;
     }

	$scope.submit = function (index) {
        
        if (Wallet.remote_txData.escrow_status == 1){
          //escrow_status == 1 indicates escrow mode active and ready
          console.log("scope.submit Wallet.remote_txData.escrow_status == 1");
          console.log(Wallet.remote_txData);
          // we don't want to process it twice so we change escrow_status here
          Wallet.remote_txData.escrow_status = 10;
          submit_escrow();
          return;
        }
		var currentAccount = Wallet.current;
		var source = currentAccount.id;

		currentAccount.horizon().loadAccount(source)
		.then(function (account) {
			var destInfo = $scope.send.destInfo;

			var record = $scope.send.pathRecords[index];
			var sendAsset = createAsset(record, 'source_');
			var destAsset = createAsset(record, 'destination_');
			var destAmount = record.destination_amount;

			var operation;

			if ($scope.flags.isUnregistered && (destAsset.code === 'XLM')) {
				operation = StellarSdk.Operation.createAccount({
					destination: destInfo.id,
					startingBalance: destAmount
				});
			}

			else if (sendAsset.equals(destAsset) && (record.path.length === 0)) {
				operation = StellarSdk.Operation.payment({
					destination: destInfo.id,
					asset: destAsset,
					amount: destAmount
				});
			}

			else {
				var path = record.path.map(function (p) {
					return new StellarSdk.Asset(p.asset_code, p.asset_issuer);
				});

				operation = StellarSdk.Operation.pathPayment({
					sendAsset: sendAsset,
					sendMax: record.source_amount,
					destination: destInfo.id,
					destAsset: destAsset,
					destAmount: destAmount,
					path: path
				});
			}

			var builder = new StellarSdk.TransactionBuilder(account).addOperation(operation);

			if ($scope.send.memo_type) {
				var memo = new StellarSdk.Memo[$scope.send.memo_type]($scope.send.memo);
				builder.addMemo(memo);
			}

			var tx = builder.build();
			return {
				tx: tx,
				network: currentAccount.network
			};
		})
		.then(Signer.sign)
		.then(Submitter.submit)
		.then(function () {
			$location.path('/');
		});
	};

	var query = $location.search();
	if (Object.keys(query).length !== 0) {
		$scope.send.destination = query.destination;
		$scope.send.amount		= query.amount;
		$scope.send.asset 		= query;
		$scope.destinationAssets.push(query);

		if (query.memo) {
			$scope.send.memo_type = query.memo.type;
			$scope.send.memo      = query.memo.value;
		}

		updateCollisions($scope.destinationAssets.concat(Wallet.current.balances));

		isPreFilled = true;

		$scope.send.destInfo = {
			id: query.destination
		};

		getPaths();
	}

	$scope.showUnregistered = function () {
		return $scope.flags.isUnregistered && $scope.send.destInfo && isPathPending;
	};

	$scope.isEmail = function (address) {
		return /^[\w\.\+]+@([\w]+\.)+[\w]{2,}$/.test(address);
	};

	$scope.showPaths = function () {
		return hasPath && !isPathPending;
	};

	$scope.showNoPaths = function () {
		return !hasPath && !isPathPending;
	};

	$scope.showRaw = function () {
		return $scope.send.destInfo && ($scope.send.destInfo.id !== $scope.send.destination);
	};

	$scope.$watch('send.destInfo', onDestInfo);
});
