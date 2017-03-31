/* global angular, console, StellarSdk */

angular.module('app')
.controller('IndexCtrl', function ($http, $ionicBody, $ionicLoading, $ionicPopup, $location, $q, $rootScope, $scope, $translate, Contacts, Horizon, Keychain, Language, Modal, Storage, Wallet) {
	'use strict';

	$scope.physicalScreenWidth = ((window.innerWidth > 0) ? window.innerWidth : screen.width);

	function handleAccountImport(account, key) {

		var data = window.btoa(JSON.stringify({
			account: account,
			key: key
		}));
		$location.path('/side-menu/import-account/' + data);
	}

	function handleAccount(account) {

		if (!(account.id in Wallet.accounts) && !Contacts.lookup(account.id, account.network)) {

			$scope.model = {
				id:			account.id,
				meta:		account.meta,
				meta_type:	account.meta_type
			};

			if (account.network) {
				$scope.model.network = account.network;
			}

			Modal.show('app/account/modals/add-contact.html', $scope);
		}
	}

	function handlePayment(payment) {
		var object = {
			destination:	payment.destination,
			amount:			payment.amount
		};

		if (!payment.asset) {
			object.asset_type	= 'native';
		} else {
			object.asset_code	= payment.asset.code;
			object.asset_issuer	= payment.asset.issuer;
		}

		if (payment.memo) {
			object.memo = payment.memo;
		}

		$location.path('/account/send')
		.search(object);
	}

	function handleChallenge(challenge) {

		var id = challenge.id ? challenge.id : Wallet.current.id;

		if (Keychain.isLocalSigner(id)) {
			Keychain.signMessage(id, challenge.message)
			.then(function (sig) {

				$ionicLoading.show({
					template: 'Submitting response...'
				});

				$http.post(challenge.url, {
					id: id,
					msg: challenge.message,
					sig: sig
				})
				.then(function (res) {
					$ionicLoading.hide();
				}, function (err) {
					$ionicLoading.hide();
				});
			});
		}
	}

     function get_remote_tx_v2(xml_url,txTag){
       // version 2.0
       console.log("started get_remote_tx");
       console.log("xml_url");
       var client = setup_xml(xml_response_get_remote_tx)
       client.open("GET", xml_url + 'tx_tag=' + txTag, true); 
       client.send();
     }

    var remote_txData;

    function xml_response_get_remote_tx(data){
        console.log("xml_response get_remote_tx: ");
        // versions > 2.0
//Object { destination: "GDUPQLNDVSUKJ4XKQQDITC7RFYCJTROCR6A…", amount: "204.9900", asset: "USD", issuer: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCG…", memo: "32" }
       // versions <= 2.0 we use stargazer transaction format and or branches of it with added escrow at V3.0 and above
       //{"stellar":{"payment":{"destination":"GDUPQLNDVSUKJ4XKQQDITC7RFYCJTROCR6AMUBAMPGBIZXQU4UTAGX7C","network":"cee0302d","amount":"106.0000","asset":{"code":"USD","issuer":"GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ"},"memo":{"type":"text","value":"19"},"order_status":"Processed","escrow":{"publicId":"GAVUFP3ZYPZUI2WBSFAGRMDWUWK2UDCPD4ODIIADOILQKB4GI3APVGIF","email":"funtracker.site.bank@gmail.com","expire_ts":1491268194,"expire_dt":"2017-04-04","fee":275,"callback":"http:\/\/b.funtracker.site\/store\/?route=extension\/payment\/stellar_net\/submit_escrow&"}},"version":"3.0"}}

        console.log(data);
        if (data == "escrow_submit_accepted"){
          // responce back from OpenCart escrow submit as good
          //tx_status.textContent = "Escrow Submit Accpeted";
          return;
        }
        data = decodeURI(data);
        remote_txData = JSON.parse(data);
        console.log("remote_txData");
        console.log(remote_txData);
        if (typeof remote_txData.content != "undefined") {
          // multisig app format return
          console.log(remote_txData.content.tx.tx_xdr);
          //fill_envelope_b64(remote_txData.content.tx.tx_xdr);
          remote_txData.b64_escrow_tx = remote_txData.content.tx.tx_xdr; 
        }
        if (typeof remote_txData.stellar != "undefined") {
          // stargazer app format return
          console.log("stellar stargazer format detected");
          if (remote_txData.stellar.payment.order_status != null){
            console.log("order_status: " , remote_txData.stellar.payment.order_status);
            //tx_status.textContent = "Order Status: " + remote_txData.stellar.payment.order_status;
            return;
          }
          //stargazer_payment_convert(remote_txData);
           // we should get this from the store: remote_txData.payment.escrow.callback
          if (typeof remote_txData.stellar.version != "undefined"){
            // version is added when data from OpenCart plugin return format starting at V3.0 escrow 
            console.log("version number detected: ",remote_txData.stellar.version); 
            if (remote_txData.stellar.version = "3.0"){
              console.log("remote_txData version 3.0 detected, will perform escrow setup");
              if (remote_txData.stellar.payment.escrow.status != "0"){
                console.log("order_status: " , remote_txData.stellar.payment.escrow.status);
                if (remote_txData.stellar.payment.escrow.status == "1"){
                  //tx_status.textContent = "Escrow Status Proccessing "
                  console.log("Escrow Status Proccessing ";
                  // we should clear these values to prevent repeat spending
                  //destination.value = "";
                  //amount.value = "";
                }else if (remote_txData.stellar.payment.escrow.status == "2"){
                  //tx_status.textContent = "Escrow Status Proccessed "
                  console.log("Escrow Status Proccessed ");               
                  //destination.value = "";
                  //amount.value = "";
                }else{
                  //tx_status.textContent = "Escrow Status failed error: " + remote_txData.stellar.payment.escrow.status;
                  console.log("Escrow Status failed error: " + remote_txData.stellar.payment.escrow.status);
                  //destination.value = "";
                  //amount.value = "";
                }
                return;
              }
              escrow_setup();
              return;
            }
          }          
          //return;
        }

        if (typeof remote_txData.destination != "undefined"){
          //my_wallet V1.0 format detected, convert to stargazer format V2.1
          remote_txData.stellar = {};
          remote_txData.stellar.payment = {};
          remote_txData.stellar.payment.asset = {};
          remote_txData.stellar.payment.memo = {};
          remote_txData.stellar.payment.destination = remote_txData.destination;
          remote_txData.stellar.payment.amount = remote_txData.amount;
          remote_txData.stellar.payment.asset.code = remote_txData.asset;
          remote_txData.stellar.payment.asset.issuer = issuer.value = remote_txData.issuer;
          remote_txData.stellar.payment.memo.type = "text";
          remote_txData.stellar.payment.memo.value = remote_txData.memo;
          if (remote_txData.network == "live"){
            //live net
            remote_txData.stellar.payment.network = "7ac33997";
          }else{
            //testnet (default)
            remote_txData.stellar.payment.network = "cee0302d";
          }
        }
        
        data = remote_txData;

        if (!data.stellar) {
			return;
		}
        

		if (data.stellar.account) {
			if (data.stellar.key) {
				handleAccountImport(data.stellar.account, data.stellar.key);
			} else {
				handleAccount(data.stellar.account);
			}
		}

		else if (data.stellar.payment) {
			handlePayment(data.stellar.payment);
		}

		else if (data.stellar.challenge) {
			handleChallenge(data.stellar.challenge);
		}                  
     }

    function xml_response_get_remote_tx2(data){
        console.log("xml_response get_remote_tx: ");

        console.log(data);
        data = decodeURI(data);
        data = JSON.parse(data);

        if (!data.stellar) {
			return;
		}
        

		if (data.stellar.account) {
			if (data.stellar.key) {
				handleAccountImport(data.stellar.account, data.stellar.key);
			} else {
				handleAccount(data.stellar.account);
			}
		}

		else if (data.stellar.payment) {
			handlePayment(data.stellar.payment);
		}

		else if (data.stellar.challenge) {
			handleChallenge(data.stellar.challenge);
		}       
     }

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
    
     //var keystore = Keychain.getKeyInfo(Wallet.current.id);
     //var active_keypair = StellarSdk.Keypair.fromSecret(keyStore);
     var active_keypair = StellarSdk.Keypair.fromSecret(Keychain.getKeyInfo(Wallet.current.id));

     function escrow_setup(){      
       // this will create a new random account, set it up as an escrow account. all data needed to set it up is in global remote_txData
       //remote_txData: {"stellar":{"payment":{"destination":"GDUPQLNDVSUKJ4XKQQDITC7RFYCJTROCR6AMUBAMPGBIZXQU4UTAGX7C","network":"cee0302d","amount":"85.0000","asset":{"code":"USD","issuer":"GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ"},"memo":{"type":"text","value":"70"},"order_status":null,"escrow":{"publicId":"GAVUFP3ZYPZUI2WBSFAGRMDWUWK2UDCPD4ODIIADOILQKB4GI3APVGIF","email":"funtracker.site.bank@gmail.com","expire_ts":1491268569,"expire_dt":"2017-04-04","fee":222.5,"callback":"http:\/\/b.funtracker.site\/store\/?route=extension\/payment\/stellar_net\/submit_escrow&"}},"version":"3.0"}}

      // //remote_txData.escrow_status  1= escrow_submition_ready escrow funded, 2 error 
       console.log("start escrow_setup");
       console.log(remote_txData);
       // I'm not sure this is the right thing to do, if the object is attached to Wallet in this way here then with changes to remote_txData
       // should be reflected in this Wallet.remote_txData object also in realtime? or only each time it is reassigned? 
       //Wallet.remote_txData = remote_txData;
       var keypair_escrow = StellarSdk.Keypair.random();
       var store_obj = {};
       store_obj.signers = keypair_escrow.secret();
       Storage.setItem('account.escrow_' + remote_txData.stellar.payment.memo.value , store_obj);
       //save_seed("escrow_"+remote_txData.stellar.payment.memo.value, "", keypair_escrow.secret() );
       remote_txData.keypair_escrow = keypair_escrow;
       // status will be changed to "Escrow Setup Mode" to show user that we are preparing for escrow tx
       // need way to provide feedback to user of state in stargazer
       //tx_status.textContent = "Escrow Setup not funded?";
       var tx_array = [];
 
       tx_array.push(StellarSdk.Operation.createAccount({
                   destination: keypair_escrow.publicKey(),
                   startingBalance: fix7dec(61)
                 }));

       var asset_obj;
       if (remote_txData.stellar.payment.asset.code == "XLM"){
         asset_obj = new StellarSdk.Asset.native();
       } else{
         asset_obj = new StellarSdk.Asset(remote_txData.stellar.payment.asset.code, remote_txData.stellar.payment.asset.issuer);
         tx_array.push(StellarSdk.Operation.changeTrust({asset: asset_obj,source:keypair_escrow.publicKey()}));
       }
       remote_txData.escrow_asset = asset_obj;

       var opts = {};
       opts.signer = {};
       // provide the store destination a signers slot on the escrow_publicId account
       opts.signer.ed25519PublicKey = remote_txData.stellar.payment.destination;
       opts.signer.weight = 1;
       console.log("opp setoption source: ",keypair_escrow.publicKey()); 
       opts.source = keypair_escrow.publicKey();
       tx_array.push(StellarSdk.Operation.setOptions(opts)); 
       //tx_array.push(StellarSdk.Operation.setOptions(clone(opts))); // not sure I'm going to need to do this or not

       // this is your present active accounts publicKey address that will also be used as source of funds (you are the customer)
       // I guess I won't need this unless I can figure out how to set keypair_escrow master signer weight to zero
       // so without this we will have to find a way to store and track the keypair_escrow key data in key storage
       //opts.signer.ed25519PublicKey = active_keypair.publicKey();
       //opts.signer.weight = 1;
       //opts.source = remote_txData.stellar.payment.escrow.publicId;
       //tx_array.push(StellarSdk.Operation.setOptions(opts)); 

       // escrows signers slot in the event of a problem with the transaction bettween store and you the customer
       opts.signer.ed25519PublicKey = remote_txData.stellar.payment.escrow.publicId;
       opts.signer.weight = 1;
       opts.source = keypair_escrow.publicKey();
       tx_array.push(StellarSdk.Operation.setOptions(opts));

       opts = {};
       
       //opts.masterWeight = 0;
       opts.lowThreshold = 2;
       opts.medThreshold = 2;
       opts.highThreshold = 2;
       opts.source = keypair_escrow.publicKey();
       tx_array.push(StellarSdk.Operation.setOptions(opts));

       // no source provided so funds comes from your active_keypair.PublicKey() account
       tx_array.push(StellarSdk.Operation.payment({
          destination: keypair_escrow.publicKey(),
          amount: fix7dec(remote_txData.stellar.payment.amount),
          asset: asset_obj
       }));

       //asset_obj = StellarSdk.Asset.native();
       // this is the fee payment to the escrow.publicId paid in native XLM from you the buyer
       // we skip this if no fee's from this escrow service provider
       if (remote_txData.stellar.payment.escrow.fee > 0){
         tx_array.push(StellarSdk.Operation.payment({
            destination: remote_txData.stellar.payment.escrow.publicId,
            amount: fix7dec(remote_txData.stellar.payment.escrow.fee),
            asset: StellarSdk.Asset.native()
         }));
       }
       
       server.loadAccount(active_keypair.publicKey())
          .then(function (account) { 
             var memo_tr = StellarSdk.Memo.text(remote_txData.stellar.payment.memo.value);           
             transaction = new StellarSdk.TransactionBuilder(account,{memo: memo_tr});
             console.log("es setup tx: ", transaction);
             tx_array.forEach(function (item) {
               transaction.addOperation(item);
             });
             transaction = transaction.build();
             // need to find were stargazer stores it's keypair to sign this (key?)
             transaction.sign(active_keypair);
             // we just created this key but haven't yet found a place to store it to recover dispute with 3rd party
             transaction.sign(keypair_escrow);
             console.log("es signed tx: " , transaction);
             //tx_status.textContent = "Escrow Submition Ready";
             remote_txData.escrow_status = 1;
             // we just need to store this global for now as stargazer has no remote sign or envelope viewer features 
             //fill_envelope_b64(transaction.toEnvelope().toXDR().toString("base64"));
             remote_txData.b64_escrow_tx = transaction.toEnvelope().toXDR().toString("base64");
             Wallet.remote_txData = remote_txData;
             //Wallet.remote_txData.escrow_status == 1
          });
       
     }

     //have moved these function send_escrow_to_callback(),submit_escrow(), fix7dec(string) added functions to ./app/account/controllers/send.js
     function send_escrow_to_callback(){
        //this sends the generated timed escrow transaction and other needed info to the escrow callback
        //b64_timed_tx_env: the signed time based transaction that becomes valid at escrow_expire time 
        //escrow_holding_publicId: GKDS...
        //tx_tag: the stores transaction id that this payment is attached to.
        //escrow_expire_timestamp: time that escrow transaction becomes valid to transact for store to collect funds
        //
        // remote_txData: {"stellar":{"payment":{"stellar":{"payment":{"destination":"GDUPQLNDVSUKJ4XKQQDITC7RFYCJTROCR6AMUBAMPGBIZXQU4UTAGX7C","network":"cee0302d","amount":"85.0000","asset":{"code":"USD","issuer":"GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ"},"memo":{"type":"text","value":"1"},"escrow":{"publicId":"GAVUFP3ZYPZUI2WBSFAGRMDWUWK2UDCPD4ODIIADOILQKB4GI3APVGIF","email":"funtracker.site.bank@gmail.com","expire_ts":1491262504,"expire_dt":"2017-04-03","fee":222.5,"callback":"http:\/\/b.funtracker.site\/store\/?route=extension\/payment\/stellar_net\/submit_escrow&"}},"version":"2.1"}}

        console.log("send_escrow_to_callback");
        console.log(remote_txData.stellar.payment.escrow.callback);
        var b64 = encodeURIComponent(remote_txData.b64_escrow_tx);
        var client = setup_xml(xml_response_get_remote_tx);
        var ss = remote_txData.stellar.payment.escrow.callback + 'tx_tag=' + remote_txData.stellar.payment.memo.value + "&b64_tx=" + b64 + "&exp=" + remote_txData.stellar.payment.escrow.expire_ts + "&escPID=" + remote_txData.keypair_escrow.publicKey();
        console.log("sending: ");
        console.log(ss);
        client.open("GET", ss, true); 
        client.send();
      }
        
      function submit_escrow(){
         //this generates the timed escrow payment transaction, then sends it to the stores escrow callback
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
                 destination: active_keypair.publicKey()
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
                  send_escrow_to_callback();
               });
             }).catch(function(e) {
               console.log("submitTransaction error");
               remote_txData.escrow_status = 4;
               console.log(e);
               //tx_status.textContent = "Transaction failed";
               console.log("Transaction failed");
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


    
	$scope.onQrCodeScanned = function (data) {

        data = decodeURI(data);
		data = JSON.parse(data);

        if (data.ver == "2.1"){
          get_remote_tx_v2(data.callback,data.tx_tag);
        }else if(data.ver == "3.0"){
          // what now?  for escrow mode
        } else {
		  if (!data.stellar) {
			  return;
		  }
        }

		if (data.stellar.account) {
			if (data.stellar.key) {
				handleAccountImport(data.stellar.account, data.stellar.key);
			} else {
				handleAccount(data.stellar.account);
			}
		}

		else if (data.stellar.payment) {
			handlePayment(data.stellar.payment);
		}

		else if (data.stellar.challenge) {
			handleChallenge(data.stellar.challenge);
		}
	};

	$rootScope.$on('$submitter.failed', function (event, err) {
		$ionicPopup.alert({
			title: $translate.instant(err)
		}).then(function () {
			//	:KLUDGE: ionic 1.3.2 messes up, so we have to manually remove this
			$ionicBody.removeClass('modal-open');
		});
	});
});
